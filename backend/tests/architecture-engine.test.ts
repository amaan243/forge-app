import { beforeEach, describe, expect, it, vi } from "vitest";

const { repository, projectRepository } = vi.hoisted(() => ({ repository: {
  version: vi.fn(), latest: vi.fn(), versions: vi.fn(), createVersion: vi.fn(), updateVersion: vi.fn(), deleteVersion: vi.fn(), nodes: vi.fn(), node: vi.fn(), createNode: vi.fn(), updateNode: vi.fn(), deleteNode: vi.fn(), edges: vi.fn(), edge: vi.fn(), createEdge: vi.fn(), updateEdge: vi.fn(), deleteEdge: vi.fn(), createTimelineEvent: vi.fn(),
}, projectRepository: { findById: vi.fn() } }));
vi.mock("../src/repositories/architecture-repository.js", () => ({ architectureRepository: repository }));
vi.mock("../src/repositories/project-repository.js", () => ({ projectRepository }));

import { ArchitectureGeneratorService } from "../src/services/architecture-generator-service.js";
import { architectureService } from "../src/services/architecture-service.js";
import { VersionComparisonService } from "../src/services/version-comparison-service.js";
import type { AIProvider } from "../src/integrations/ai-provider.js";

const generated = { name: "Orders", summary: "Service architecture", assumptions: [], nodes: [{ node_key: "api", name: "API", type: "api" as const }], edges: [], technologies: ["TypeScript"], securityConsiderations: [], scalabilityConsiderations: [], risks: [] };

beforeEach(() => { vi.clearAllMocks(); projectRepository.findById.mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }); repository.latest.mockResolvedValue(null); repository.createTimelineEvent.mockResolvedValue({}); });

describe("architecture engine", () => {
  it("rejects malformed structured AI output", async () => {
    const provider: AIProvider = { analyze: vi.fn().mockResolvedValue({}), generate: vi.fn(), structuredOutput: vi.fn().mockResolvedValue({ name: "missing required fields" }) };
    await expect(new ArchitectureGeneratorService(provider).generate("Build a service")).rejects.toThrow();
  });

  it("accepts deterministic structured AI output", async () => {
    const provider: AIProvider = { analyze: vi.fn().mockResolvedValue({ actors: ["user"] }), generate: vi.fn(), structuredOutput: vi.fn().mockResolvedValue(generated) };
    await expect(new ArchitectureGeneratorService(provider).generate("Build a service")).resolves.toEqual(generated);
  });

  it("does not update a published version", async () => {
    repository.version.mockResolvedValue({ id: "version-1", project_id: "project-1", status: "published" });
    await expect(architectureService.updateVersion("version-1", { name: "changed" })).rejects.toThrow("immutable");
    expect(repository.updateVersion).not.toHaveBeenCalled();
  });

  it("creates nodes and edges only through the version service", async () => {
    repository.version.mockResolvedValue({ id: "version-1", project_id: "project-1", status: "draft" });
    repository.createNode.mockResolvedValue({ id: "node-1", architecture_version_id: "version-1" });
    repository.nodes.mockResolvedValue([{ id: "node-1" }, { id: "node-2" }]);
    repository.createEdge.mockResolvedValue({ id: "edge-1", architecture_version_id: "version-1" });
    await architectureService.nodeCreate("version-1", { node_key: "api" });
    await architectureService.edgeCreate("version-1", { source_node_id: "node-1", target_node_id: "node-2" });
    expect(repository.createNode).toHaveBeenCalledWith({ architecture_version_id: "version-1", node_key: "api" });
    expect(repository.createEdge).toHaveBeenCalled();
  });

  it("compares added, removed, and modified nodes", async () => {
    repository.version.mockResolvedValue({ project_id: "project-1" });
    repository.nodes.mockImplementation(async (id: string) => id === "from" ? [{ node_key: "api", name: "API", technology: "Node" }, { node_key: "old", name: "Old" }] : [{ node_key: "api", name: "API", technology: "Bun" }, { node_key: "new", name: "New" }]);
    repository.edges.mockResolvedValue([]);
    const result = await new VersionComparisonService().compare("project-1", "from", "to");
    expect(result.summary).toMatchObject({ addedNodes: 1, removedNodes: 1, modifiedNodes: 1 });
  });
});
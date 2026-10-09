import { beforeEach, describe, expect, it, vi } from "vitest";

const { repository, projectRepository, engineeringRepository } = vi.hoisted(() => ({ repository: {
  version: vi.fn(), latest: vi.fn(), versions: vi.fn(), createVersion: vi.fn(), updateVersion: vi.fn(), deleteVersion: vi.fn(), nodes: vi.fn(), node: vi.fn(), createNode: vi.fn(), updateNode: vi.fn(), deleteNode: vi.fn(), edges: vi.fn(), edge: vi.fn(), createEdge: vi.fn(), updateEdge: vi.fn(), deleteEdge: vi.fn(), createTimelineEvent: vi.fn(),
}, projectRepository: { findById: vi.fn(), requirements: vi.fn() }, engineeringRepository: { markDocumentsOutdated: vi.fn().mockResolvedValue(undefined) } }));
vi.mock("../src/repositories/architecture-repository.js", () => ({ architectureRepository: repository }));
vi.mock("../src/repositories/project-repository.js", () => ({ projectRepository }));
vi.mock("../src/repositories/engineering-intelligence-repository.js", () => ({ engineeringRepository }));

import { ArchitectureGeneratorService } from "../src/services/architecture-generator-service.js";
import { architectureService } from "../src/services/architecture-service.js";
import { VersionComparisonService } from "../src/services/version-comparison-service.js";
import { DeterministicArchitectureGenerator } from "../src/services/deterministic-architecture-generator.js";
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

  it("deterministically derives architecture nodes from real requirements", () => {
    const generator = new DeterministicArchitectureGenerator();
    const reqs = [
      { id: "1", project_id: "p1", content: "User authentication with JWT tokens and secure passwords", version: 1, created_by: "u1", created_at: "", updated_at: "" },
      { id: "2", project_id: "p1", content: "PostgreSQL database storing user profiles and workspaces", version: 1, created_by: "u1", created_at: "", updated_at: "" },
      { id: "3", project_id: "p1", content: "Redis caching for high performance and low latency", version: 1, created_by: "u1", created_at: "", updated_at: "" },
    ];
    const preview = generator.generate(reqs, "My App");
    const nodeKeys = preview.nodes.map((n) => n.node_key);
    expect(nodeKeys).toContain("auth_service");
    expect(nodeKeys).toContain("primary_database");
    expect(nodeKeys).toContain("cache_store");
    expect(preview.edges.length).toBeGreaterThan(0);
  });

  it("produces meaningfully different architectures for TEST A (Auth) and TEST B (Semantic Search + PDF)", () => {
    const generator = new DeterministicArchitectureGenerator();

    const testAReqs = [
      {
        id: "req-a",
        project_id: "p1",
        content: "Users should be able to register, login and securely access their account using email authentication.",
        version: 1,
        created_by: "u1",
        created_at: "",
        updated_at: "",
      },
    ];

    const testBReqs = [
      {
        id: "req-b",
        project_id: "p1",
        content: "Users should upload PDF documents and perform semantic search across uploaded documents.",
        version: 1,
        created_by: "u1",
        created_at: "",
        updated_at: "",
      },
    ];

    const archA = generator.generate(testAReqs, "Auth App");
    const archB = generator.generate(testBReqs, "Search App");

    const keysA = archA.nodes.map((n) => n.node_key);
    const keysB = archB.nodes.map((n) => n.node_key);

    // Test A should contain auth-related components
    expect(keysA).toContain("auth_service");
    expect(keysA).toContain("user_service");
    expect(keysA).toContain("primary_database");
    expect(keysA).toContain("notification_service");
    expect(keysA).toContain("email_provider");
    expect(keysA).not.toContain("embedding_service");
    expect(keysA).not.toContain("vector_database");
    expect(keysA).not.toContain("document_service");
    expect(keysA).not.toContain("object_storage");

    // Test B should contain document handling & semantic search components
    expect(keysB).toContain("embedding_service");
    expect(keysB).toContain("vector_database");
    expect(keysB).toContain("document_service");
    expect(keysB).toContain("object_storage");
    expect(keysB).not.toContain("auth_service");
    expect(keysB).not.toContain("user_service");
    expect(keysB).not.toContain("notification_service");
    expect(keysB).not.toContain("email_provider");

    // Validate that all edges connect to valid nodes
    for (const edge of archA.edges) {
      expect(keysA).toContain(edge.source_node_key);
      expect(keysA).toContain(edge.target_node_key);
    }
    for (const edge of archB.edges) {
      expect(keysB).toContain(edge.source_node_key);
      expect(keysB).toContain(edge.target_node_key);
    }
  });

  it("generates preview without creating database version records", async () => {
    projectRepository.requirements.mockResolvedValue([
      { id: "1", project_id: "project-1", content: "Build web client with API Gateway and Database", version: 1, created_by: "u1", created_at: "", updated_at: "" },
    ]);
    const preview = await architectureService.generatePreview("project-1", "user-1");
    expect(preview.preview).toBe(true);
    expect(preview.architecture.nodes.length).toBeGreaterThan(0);
    expect(repository.createVersion).not.toHaveBeenCalled();
  });

  it("creates version with nodes and edges and auto-increments version number", async () => {
    repository.latest.mockResolvedValue({ version_number: 1 });
    repository.createVersion.mockImplementation((input: any) => Promise.resolve({ id: "v-2", ...input }));
    repository.createNode.mockImplementation((input: any) => Promise.resolve({ id: `node-${input.node_key}`, ...input }));
    repository.createEdge.mockImplementation((input: any) => Promise.resolve({ id: "e-1", ...input }));
    repository.nodes.mockResolvedValue([{ id: "node-fe", node_key: "fe" }]);
    repository.edges.mockResolvedValue([]);

    const result = await architectureService.createVersion("project-1", "user-1", {
      name: "Version 2",
      nodes: [
        { node_key: "fe", name: "Frontend", type: "frontend", position_x: 10, position_y: 20 },
        { node_key: "api", name: "API", type: "api", position_x: 30, position_y: 40 },
      ],
      edges: [
        { source_node_key: "fe", target_node_key: "api", relationship: "calls" },
      ],
    });

    expect(repository.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version_number: 2, project_id: "project-1" })
    );
    expect(repository.createNode).toHaveBeenCalledTimes(2);
    expect(repository.createEdge).toHaveBeenCalledTimes(1);
    expect(result.version_number).toBe(2);
  });
});
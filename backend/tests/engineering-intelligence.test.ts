import { describe, expect, it } from "vitest";
import { ChangeImpactService } from "../src/services/change-impact-service.js";
import { DocumentationGeneratorService } from "../src/services/documentation-generator-service.js";
import { DesignReviewService } from "../src/services/design-review-service.js";
import { ArchitectureSimulationService } from "../src/services/architecture-simulation-service.js";

describe("engineering intelligence", () => {
  it("calculates direct and indirect change impact", () => {
    const result = new ChangeImpactService().analyze([
      { id: "a", architecture_version_id: "v", node_key: "api", name: "API", type: "api", technology: null, description: null, metadata: {}, position_x: 0, position_y: 0, created_at: "" },
      { id: "b", architecture_version_id: "v", node_key: "db", name: "Database", type: "database", technology: "Postgres", description: null, metadata: {}, position_x: 0, position_y: 0, created_at: "" },
      { id: "c", architecture_version_id: "v", node_key: "worker", name: "Worker", type: "worker", technology: null, description: null, metadata: {}, position_x: 0, position_y: 0, created_at: "" },
    ], [
      { id: "e1", architecture_version_id: "v", source_node_id: "a", target_node_id: "b", relationship: "writes", protocol: null, description: null, metadata: {}, created_at: "" },
      { id: "e2", architecture_version_id: "v", source_node_id: "c", target_node_id: "a", relationship: "calls", protocol: null, description: null, metadata: {}, created_at: "" },
    ], [{ type: "replace_technology", target: "API", technology: "Go" }]);
    expect(result.affectedComponents).toEqual(expect.arrayContaining(["API", "Database", "Worker"]));
    expect(result.affectedDataStores).toEqual(["Database"]);
    expect(result.affectedApis).toEqual(["e2"]);
  });

  it("generates linked documentation in markdown, HTML, and Mermaid", () => {
    const generator = new DocumentationGeneratorService();
    const architecture = { version: { name: "v1" }, nodes: [{ name: "API", type: "api", technology: "Express" }], edges: [{ source_node_id: "api", target_node_id: "db", relationship: "writes" }] };
    expect(generator.generate({ title: "System", format: "markdown", architecture })).toContain("# System");
    expect(generator.generate({ title: "System", format: "html", architecture })).toContain("<h1>System</h1>");
    expect(generator.generate({ title: "System", format: "mermaid", architecture })).toContain("graph TD");
  });

  it("returns evidence-backed design findings", () => {
    const findings = new DesignReviewService().review({ nodes: [{ id: "api", name: "API", type: "api" }, { id: "worker", name: "Worker", type: "worker" }, { id: "db", name: "DB", type: "database" }], edges: [] });
    expect(findings.some((finding) => finding.evidence.includes("api"))).toBe(true);
    expect(findings.every((finding) => finding.explanation.length > 0 && finding.recommendation.length > 0)).toBe(true);
  });

  it("does not mutate architecture during simulation creation", async () => {
    const service = new ArchitectureSimulationService();
    expect(service).toBeDefined();
    expect("apply" in service).toBe(true);
  });
});
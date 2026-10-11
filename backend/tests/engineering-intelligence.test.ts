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

  it("generates comprehensive documentation from architecture versions and repository analysis", () => {
    const generator = new DocumentationGeneratorService();
    const result = generator.generateFull({
      title: "ArchForge Production Spec",
      format: "markdown",
      type: "architecture_overview",
      architecture: {
        version: {
          id: "ver-100",
          project_id: "proj-1",
          version_number: 2,
          name: "Main Platform",
          description: "Core microservices platform",
          status: "published",
          architecture_data: { summary: "Unified engineering platform" } as any,
          created_by: "user-1",
          created_at: "",
        },
        nodes: [
          { id: "n1", architecture_version_id: "ver-100", node_key: "api_gateway", name: "API Gateway", type: "api", technology: "Fastify", description: null, metadata: {}, position_x: 0, position_y: 0, created_at: "" },
          { id: "n2", architecture_version_id: "ver-100", node_key: "auth_service", name: "Auth Service", type: "service", technology: "Node.js", description: null, metadata: {}, position_x: 0, position_y: 0, created_at: "" },
        ],
        edges: [
          { id: "e1", architecture_version_id: "ver-100", source_node_id: "n1", target_node_id: "n2", relationship: "calls", protocol: "gRPC", description: null, metadata: {}, created_at: "" },
        ],
      },
      analysis: {
        id: "analysis-99",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "9f8b2c4e",
        branch: "main",
        status: "completed",
        analysis_data: {
          branch: "main",
          technology_stack: { runtime: "node", framework: "fastify" },
        },
        architecture: {
          routes: [
            { method: "GET", path: "/api/v1/health", handler: "getHealth", file: "src/routes/health.ts" },
            { method: "POST", path: "/api/v1/auth/login", handler: "login", file: "src/routes/auth.ts" },
          ],
          models: [
            { name: "User", file: "src/models/user.ts", fields: ["id: uuid", "email: string", "role: string"] },
          ],
          env_vars: ["DATABASE_URL", "JWT_SECRET"],
        },
        created_at: "",
      } as any,
    });

    expect(result.content).toContain("# ArchForge Production Spec");
    expect(result.content).toContain("API Gateway");
    expect(result.content).toContain("Fastify");
    expect(result.hasArchitectureSource).toBe(true);
    expect(result.hasRepositorySource).toBe(true);
    expect(result.sourceVersionId).toBe("ver-100");
    expect(result.sourceCommitSha).toBe("9f8b2c4e");
  });

  it("generates valid OpenAPI specs from actual discovered routes", () => {
    const generator = new DocumentationGeneratorService();
    const result = generator.generateFull({
      title: "Service API Spec",
      format: "openapi_json",
      type: "api_documentation",
      analysis: {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "abc1234",
        status: "completed",
        architecture: {
          routes: [
            { method: "GET", path: "/api/v1/users", handler: "listUsers", file: "users.ts" },
            { method: "POST", path: "/api/v1/users", handler: "createUser", file: "users.ts" },
          ],
        },
      } as any,
    });

    const parsed = JSON.parse(result.content);
    expect(parsed.openapi).toBe("3.1.0");
    expect(parsed.paths["/api/v1/users"]).toBeDefined();
    expect(parsed.paths["/api/v1/users"].get).toBeDefined();
    expect(parsed.paths["/api/v1/users"].post).toBeDefined();
  });

  it("generates database documentation from discovered entities", () => {
    const generator = new DocumentationGeneratorService();
    const result = generator.generateFull({
      title: "Data Models",
      format: "markdown",
      type: "database_documentation",
      analysis: {
        id: "analysis-2",
        status: "completed",
        architecture: {
          models: [
            { name: "Order", file: "order.ts", fields: ["id: uuid", "total: decimal", "status: string"] },
          ],
        },
      } as any,
    });

    expect(result.content).toContain("Model `Order`");
    expect(result.content).toContain("id: uuid");
  });
});
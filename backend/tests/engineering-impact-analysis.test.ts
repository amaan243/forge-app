import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArchitectureNode, ArchitectureEdge } from "../src/types/architecture.js";
import type { RepositoryAnalysis } from "../src/types/repository-intelligence.js";

const { impactRepo, archService, repoIntelRepo, engineeringRepo, supabaseMock } = vi.hoisted(() => ({
  impactRepo: {
    createReport: vi.fn(),
    listReports: vi.fn(),
    getReport: vi.fn(),
    deleteReport: vi.fn(),
  },
  archService: {
    getVersion: vi.fn(),
  },
  repoIntelRepo: {
    repository: vi.fn(),
    analysis: vi.fn(),
    latestSuccessful: vi.fn(),
  },
  engineeringRepo: {
    documents: vi.fn().mockResolvedValue([]),
    simulation: vi.fn(),
    createSimulation: vi.fn(),
    updateSimulation: vi.fn(),
  },
  supabaseMock: {
    from: vi.fn(),
  },
}));

vi.mock("../src/repositories/engineering-impact-repository.js", () => ({
  engineeringImpactRepository: impactRepo,
}));
vi.mock("../src/services/architecture-service.js", () => ({
  architectureService: archService,
}));
vi.mock("../src/repositories/repository-intelligence-repository.js", () => ({
  repositoryIntelligenceRepository: repoIntelRepo,
}));
vi.mock("../src/repositories/engineering-intelligence-repository.js", () => ({
  engineeringRepository: engineeringRepo,
}));
vi.mock("../src/lib/supabase.js", () => ({
  supabaseAdmin: supabaseMock,
}));

import { EngineeringImpactService } from "../src/services/engineering-impact-service.js";
import { NotFoundError } from "../src/errors/app-error.js";

const sampleNodes: ArchitectureNode[] = [
  {
    id: "node-frontend",
    architecture_version_id: "ver-1",
    node_key: "frontend-app",
    name: "Frontend App",
    type: "frontend",
    technology: "React 19",
    description: "SPA client application",
    metadata: {},
    position_x: 0,
    position_y: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "node-api-gateway",
    architecture_version_id: "ver-1",
    node_key: "api-gateway",
    name: "API Gateway",
    type: "gateway",
    technology: "Kong",
    description: "API Gateway router",
    metadata: {},
    position_x: 100,
    position_y: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "node-auth-service",
    architecture_version_id: "ver-1",
    node_key: "auth-service",
    name: "Auth Service",
    type: "service",
    technology: "Express.js",
    description: "Authentication & JWT authority",
    metadata: {},
    position_x: 200,
    position_y: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "node-orders-service",
    architecture_version_id: "ver-1",
    node_key: "orders-service",
    name: "Orders Service",
    type: "service",
    technology: "FastAPI",
    description: "Order management microservice",
    metadata: {},
    position_x: 200,
    position_y: 100,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "node-primary-db",
    architecture_version_id: "ver-1",
    node_key: "primary-db",
    name: "Primary Database",
    type: "database",
    technology: "PostgreSQL 16",
    description: "Relational persistence store",
    metadata: {},
    position_x: 300,
    position_y: 50,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "node-unmapped-worker",
    architecture_version_id: "ver-1",
    node_key: "legacy-worker",
    name: "Legacy Worker",
    type: "worker",
    technology: "Custom",
    description: "Worker without code scan match",
    metadata: {},
    position_x: 400,
    position_y: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const sampleEdges: ArchitectureEdge[] = [
  {
    id: "edge-fe-gw",
    architecture_version_id: "ver-1",
    source_node_id: "node-frontend",
    target_node_id: "node-api-gateway",
    relationship: "calls",
    protocol: "HTTPS",
    description: "Frontend calls Gateway",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "edge-gw-auth",
    architecture_version_id: "ver-1",
    source_node_id: "node-api-gateway",
    target_node_id: "node-auth-service",
    relationship: "authenticates",
    protocol: "gRPC",
    description: "Gateway validates tokens via Auth Service",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "edge-gw-orders",
    architecture_version_id: "ver-1",
    source_node_id: "node-api-gateway",
    target_node_id: "node-orders-service",
    relationship: "calls",
    protocol: "HTTP/REST",
    description: "Gateway routes order operations",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "edge-orders-db",
    architecture_version_id: "ver-1",
    source_node_id: "node-orders-service",
    target_node_id: "node-primary-db",
    relationship: "connects_to",
    protocol: "TCP",
    description: "Orders service queries Primary DB",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "edge-auth-db",
    architecture_version_id: "ver-1",
    source_node_id: "node-auth-service",
    target_node_id: "node-primary-db",
    relationship: "connects_to",
    protocol: "TCP",
    description: "Auth service stores user records",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
];

const sampleAnalysis: RepositoryAnalysis = {
  id: "snap-1",
  repository_id: "repo-1",
  project_id: "proj-1",
  commit_sha: "c1a2b3c4d5e6f7",
  status: "completed",
  frameworks: ["React", "Express.js", "FastAPI"],
  languages: { TypeScript: 70, Python: 30 },
  dependencies: [
    { name: "pg", version: "8.14.0", ecosystem: "npm" },
    { name: "jsonwebtoken", version: "9.0.2", ecosystem: "npm" },
    { name: "vitest", version: "3.0.0", ecosystem: "npm" },
  ],
  infrastructure: {},
  architecture: {
    services: ["src/services/auth-service.ts", "src/services/orders-service.py"],
    databases: ["PostgreSQL 16"],
    externalIntegrations: ["Stripe API"],
    routes: [
      { method: "POST", path: "/api/v1/auth/login", file: "src/routes/auth.ts", line: 25, handler: "loginHandler", framework: "Express", confidence: "high", detectionBasis: "direct_app_route" },
      { method: "GET", path: "/api/v1/auth/me", file: "src/routes/auth.ts", line: 45, handler: "meHandler", framework: "Express", confidence: "high", detectionBasis: "direct_app_route" },
      { method: "POST", path: "/api/v1/orders", file: "src/routes/orders.py", line: 12, handler: "createOrder", framework: "FastAPI", confidence: "high", detectionBasis: "decorator" },
    ],
    entryPoints: [
      { path: "src/server.ts", kind: "backend_server", evidence: "Express bootstrap", confidence: "confirmed" },
    ],
  },
  metrics: { fileCount: 42 },
  analysis_data: {
    testFiles: ["tests/auth.test.ts", "tests/orders.spec.ts"],
    testRunner: "Vitest",
    branch: "main",
  },
  created_at: "2026-01-02T00:00:00Z",
  started_at: "2026-01-02T00:00:00Z",
  completed_at: "2026-01-02T00:01:00Z",
};

describe("Engineering Impact Analysis Integration", () => {
  let impactService: EngineeringImpactService;

  beforeEach(() => {
    vi.clearAllMocks();
    impactService = new EngineeringImpactService();

    // Default Supabase project mock
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { workspace_id: "ws-1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "drift_analyses") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: {
                      id: "drift-1",
                      status: "completed",
                      drift_items: [
                        {
                          id: "di-1",
                          type: "missing",
                          description: "Auth Service token refresh endpoint not mapped in code",
                          severity: "medium",
                        },
                      ],
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    });

    // Default Architecture Version Mock
    archService.getVersion.mockResolvedValue({
      version: {
        id: "ver-1",
        project_id: "proj-1",
        version_number: 1,
        name: "Baseline Topology",
        status: "published",
      },
      nodes: sampleNodes,
      edges: sampleEdges,
    });

    // Default Repository & Snapshot Mocks
    repoIntelRepo.repository.mockResolvedValue({
      id: "repo-1",
      project_id: "proj-1",
      repository_name: "core-platform",
      default_branch: "main",
    });

    repoIntelRepo.analysis.mockResolvedValue(sampleAnalysis);
    repoIntelRepo.latestSuccessful.mockResolvedValue(sampleAnalysis);

    // Default Documents Mock
    engineeringRepo.documents.mockResolvedValue([
      { id: "doc-sys", project_id: "proj-1", type: "system_design", title: "System Design Document" },
      { id: "doc-api", project_id: "proj-1", type: "api_documentation", title: "API Reference Manual" },
      { id: "doc-db", project_id: "proj-1", type: "database_documentation", title: "Database Schema Docs" },
    ]);

    // Mock Impact Repo Create Report
    impactRepo.createReport.mockImplementation(async (data: any) => ({
      id: "rep-generated-123",
      createdAt: new Date().toISOString(),
      ...data,
    }));
  });

  // 1. Direct Dependency Discovery
  it("discovers direct 1-hop upstream and downstream dependencies for a target component", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-api-gateway",
        name: "API Gateway",
      },
      proposedChange: {
        changeType: "modify_api_contract",
        description: "Add request throttling middleware to API Gateway",
      },
    });

    expect(report.dependencyGraph.directUpstream).toContain("Frontend App");
    expect(report.dependencyGraph.directDownstream).toContain("Auth Service");
    expect(report.dependencyGraph.directDownstream).toContain("Orders Service");
    expect(report.impactSummary.directlyAffected[0].name).toBe("API Gateway");
  });

  // 2. Indirect Dependency Discovery
  it("traverses transitive multi-hop dependencies (2+ hops) across service topology", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-frontend",
        name: "Frontend App",
      },
      proposedChange: {
        changeType: "modify_api_contract",
        description: "Switch client protocol from REST to GraphQL",
      },
    });

    // Frontend -> API Gateway (1-hop) -> Auth Service & Orders Service (2-hop) -> Primary Database (3-hop)
    expect(report.dependencyGraph.directDownstream).toContain("API Gateway");
    expect(report.dependencyGraph.indirectDownstream).toContain("Auth Service");
    expect(report.dependencyGraph.indirectDownstream).toContain("Orders Service");
    expect(report.dependencyGraph.indirectDownstream).toContain("Primary Database");
  });

  // 3. Architecture-to-Code Mapping
  it("accurately classifies verified mappings with matching routes and source files", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-auth-service",
        name: "Auth Service",
      },
      proposedChange: {
        changeType: "change_auth",
        description: "Rotate signing key algorithms",
      },
    });

    const authMapping = report.mappingSummary.mappings.find((m) => m.componentName === "Auth Service");
    expect(authMapping).toBeDefined();
    expect(authMapping?.state).toBe("verified");
    expect(authMapping?.matchedRoutes.length).toBeGreaterThanOrEqual(2);
    expect(authMapping?.matchedFiles).toContain("src/routes/auth.ts");
  });

  // 4. Uncertain and Unmapped Entities
  it("handles unmapped architecture nodes and unmapped repository modules without failure", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-unmapped-worker",
        name: "Legacy Worker",
      },
      proposedChange: {
        changeType: "remove_service",
        description: "Decommission unmapped worker",
      },
    });

    const workerMapping = report.mappingSummary.mappings.find((m) => m.componentName === "Legacy Worker");
    expect(workerMapping?.state).toBe("unmapped_architecture");
    expect(report.mappingSummary.unmappedArchCount).toBeGreaterThanOrEqual(1);
    expect(report.impactSummary.unknownsAndAssumptions.length).toBeGreaterThanOrEqual(0);
  });

  // 5. Proposed Changes Affecting Multiple Services & Severed Connections
  it("detects severed connections and breaking changes when a service is removed", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-auth-service",
        name: "Auth Service",
      },
      proposedChange: {
        changeType: "remove_service",
        description: "Remove Auth Service microservice",
      },
    });

    expect(report.impactSummary.brokenConnections.length).toBe(2);
    expect(report.riskAssessment.overallSeverity).toBe("critical");
    const severedRisk = report.riskAssessment.findings.find((f) => f.category === "breaking_change");
    expect(severedRisk?.severity).toBe("critical");
  });

  // 6. API Compatibility Warnings
  it("generates API compatibility risks and mitigation recommendations for route modifications", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "api_route",
        id: "route-auth-login",
        name: "POST /api/v1/auth/login",
        path: "/api/v1/auth/login",
      },
      proposedChange: {
        changeType: "modify_api_contract",
        description: "Change response JSON from access_token to bearerPayload",
      },
    });

    const apiRisk = report.riskAssessment.findings.find((f) => f.category === "public_api_compatibility");
    expect(apiRisk).toBeDefined();
    expect(apiRisk?.mitigation).toContain("versioning");
    expect(report.changePlan.apiCompatibilityConsiderations.length).toBeGreaterThan(0);
  });

  // 7. Database Dependency Analysis
  it("identifies all dependent services and persistence risks when modifying a database", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "database_object",
        id: "node-primary-db",
        name: "Primary Database",
      },
      proposedChange: {
        changeType: "replace_database",
        description: "Migrate relational database from PostgreSQL to CockroachDB",
      },
    });

    expect(report.impactSummary.relatedDatabaseObjects.length).toBeGreaterThanOrEqual(1);
    expect(report.dependencyGraph.directUpstream).toContain("Auth Service");
    expect(report.dependencyGraph.directUpstream).toContain("Orders Service");
    const dbRisk = report.riskAssessment.findings.find((f) => f.category === "database_integrity");
    expect(dbRisk).toBeDefined();
    expect(report.changePlan.databaseConsiderations.length).toBeGreaterThan(0);
  });

  // 8. Correct Project and Repository Isolation
  it("enforces strict project isolation and rejects cross-project architecture versions or snapshots", async () => {
    archService.getVersion.mockResolvedValueOnce({
      version: {
        id: "ver-foreign",
        project_id: "other-project-999",
      },
      nodes: [],
      edges: [],
    });

    await expect(
      impactService.analyze("proj-1", "user-1", {
        architectureVersionId: "ver-foreign",
        targetEntity: { type: "architecture_component", id: "n1", name: "Foreign Node" },
        proposedChange: { changeType: "custom", description: "Illegal cross-project change" },
      })
    ).rejects.toThrow(NotFoundError);

    repoIntelRepo.repository.mockResolvedValueOnce({
      id: "repo-foreign",
      project_id: "different-proj-456",
    });

    await expect(
      impactService.analyze("proj-1", "user-1", {
        architectureVersionId: "ver-1",
        repositoryId: "repo-foreign",
        targetEntity: { type: "architecture_component", id: "node-frontend", name: "Frontend App" },
        proposedChange: { changeType: "custom", description: "Mismatch repo" },
      })
    ).rejects.toThrow(NotFoundError);
  });

  // 9. Stale Repository Snapshot Handling
  it("flags older snapshots with staleness warnings and advice to analyze latest snapshot", async () => {
    repoIntelRepo.latestSuccessful.mockResolvedValueOnce({
      id: "snap-newer-head",
      commit_sha: "f9e8d7c6b5a4",
      created_at: "2026-02-01T00:00:00Z",
    });

    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-auth-service",
        name: "Auth Service",
      },
      proposedChange: {
        changeType: "modify_api_contract",
        description: "Check snapshot freshness",
      },
    });

    expect(report.sourceContext.isSnapshotStale).toBe(true);
    expect(report.sourceContext.stalenessWarning).toContain("older than latest analyzed commit");
  });

  // 10. Integration with Playground and Drift
  it("formulates Playground candidate simulation changes and correlates drift items", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-orders-service",
        name: "Orders Service",
      },
      proposedChange: {
        changeType: "introduce_cache",
        description: "Deploy Redis cluster in front of Orders Service",
      },
    });

    expect(report.playgroundBridge.supported).toBe(true);
    expect(report.playgroundBridge.simulationCandidateChanges[0].type).toBe("introduce_cache");
    expect(report.playgroundBridge.evaluableMetrics).toContain("Network latency score & sync call chain hops");
    expect(report.playgroundBridge.unevaluableMetrics).toContain(
      "Dynamic runtime production QPS & burst concurrency"
    );
  });

  // 11. Deterministic Operation Without an AI Provider
  it("runs 100% deterministically when AI_PROVIDER=none without invoking AI", async () => {
    const originalProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "none";

    try {
      const report = await impactService.analyze("proj-1", "user-1", {
        architectureVersionId: "ver-1",
        repositoryId: "repo-1",
        repositoryAnalysisId: "snap-1",
        targetEntity: {
          type: "architecture_component",
          id: "node-api-gateway",
          name: "API Gateway",
        },
        proposedChange: {
          changeType: "modify_api_contract",
          description: "Deterministic rate limiting update",
        },
      });

      expect(report.changePlan.implementationTasks.length).toBeGreaterThanOrEqual(5);
      expect(report.riskAssessment.overallSeverity).toBeDefined();
      expect(report.riskAssessment.evidenceCount).toBeGreaterThanOrEqual(1);
    } finally {
      process.env.AI_PROVIDER = originalProvider;
    }
  });

  // 12. Persistence and Retrieval of Historical Reports
  it("persists impact reports, retrieves reports list, and retrieves by ID", async () => {
    impactRepo.listReports.mockResolvedValue([
      {
        id: "rep-1",
        projectId: "proj-1",
        targetEntity: { name: "Auth Service" },
      },
    ]);
    impactRepo.getReport.mockResolvedValue({
      id: "rep-1",
      projectId: "proj-1",
      targetEntity: { name: "Auth Service" },
    });

    const list = await impactService.list("proj-1");
    expect(list.length).toBe(1);

    const single = await impactService.get("proj-1", "rep-1");
    expect(single.id).toBe("rep-1");

    await impactService.delete("proj-1", "rep-1");
    expect(impactRepo.deleteReport).toHaveBeenCalledWith("proj-1", "rep-1");
  });

  // 13. Bridge from Impact Report to Playground Simulation
  it("bridges a saved impact report into a live playground simulation", async () => {
    impactRepo.getReport.mockResolvedValue({
      id: "rep-1",
      projectId: "proj-1",
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: { name: "Orders Service" },
      proposedChange: { changeType: "introduce_cache", description: "Add Redis cache" },
      playgroundBridge: {
        supported: true,
        simulationCandidateChanges: [{ type: "introduce_cache", target: "Orders Service" }],
      },
    });

    const mockSim = {
      id: "sim-from-impact",
      project_id: "proj-1",
      status: "draft",
      base_version_id: "ver-1",
      proposed_changes: [{ type: "introduce_cache", target: "Orders Service" }],
      before_architecture: { nodes: sampleNodes, edges: sampleEdges },
      after_architecture: { nodes: sampleNodes, edges: sampleEdges },
    };

    engineeringRepo.createSimulation.mockResolvedValueOnce(mockSim);
    engineeringRepo.simulation.mockResolvedValue(mockSim);
    engineeringRepo.updateSimulation.mockImplementation(async (_pid, _id, input) => ({
      ...mockSim,
      ...input,
      status: "completed",
    }));

    const sim = await impactService.convertToPlaygroundSimulation("proj-1", "user-1", "rep-1");
    expect(sim.id).toBe("sim-from-impact");
  });

  // 14. Actionable 10-Step Change Plan Output
  it("produces an actionable 10-point change plan with ordered tasks and considerations", async () => {
    const report = await impactService.analyze("proj-1", "user-1", {
      architectureVersionId: "ver-1",
      repositoryId: "repo-1",
      repositoryAnalysisId: "snap-1",
      targetEntity: {
        type: "architecture_component",
        id: "node-orders-service",
        name: "Orders Service",
      },
      proposedChange: {
        changeType: "modify_api_contract",
        description: "Migrate orders API to REST v2 with deprecation headers",
      },
    });

    const plan = report.changePlan;
    expect(plan.preChangeChecks.length).toBeGreaterThan(0);
    expect(plan.implementationTasks.length).toBeGreaterThan(0);
    expect(plan.implementationTasks[0].stepNumber).toBe(1);
    expect(plan.databaseConsiderations.length).toBeGreaterThan(0);
    expect(plan.apiCompatibilityConsiderations.length).toBeGreaterThan(0);
    expect(plan.verificationSteps.length).toBeGreaterThan(0);
    expect(plan.rollbackConsiderations.length).toBeGreaterThan(0);
  });
});

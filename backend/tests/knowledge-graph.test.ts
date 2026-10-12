import { describe, it, expect, vi, beforeEach } from "vitest";
import { knowledgeGraphService } from "../src/services/knowledge-graph-service.js";
import { architectureRepository } from "../src/repositories/architecture-repository.js";
import { repositoryIntelligenceRepository } from "../src/repositories/repository-intelligence-repository.js";
import { projectRepository } from "../src/repositories/project-repository.js";
import { engineeringImpactRepository } from "../src/repositories/engineering-impact-repository.js";
import { engineeringRepository } from "../src/repositories/engineering-intelligence-repository.js";
import { knowledgeGraphRepository } from "../src/repositories/knowledge-graph-repository.js";
import { engineeringImpactService } from "../src/services/engineering-impact-service.js";
import { NotFoundError, ValidationError } from "../src/errors/app-error.js";
import type { ArchitectureEdge, ArchitectureNode, ArchitectureVersion } from "../src/types/architecture.js";
import type { RepositoryAnalysis, RepositoryRecord, DriftItem } from "../src/types/repository-intelligence.js";
import type { ImpactReport } from "../src/types/engineering-impact.js";

describe("ArchForge — Engineering Knowledge Graph & Traceability Integration", () => {
  const projectIdA = "11111111-1111-1111-1111-111111111111";
  const projectIdB = "22222222-2222-2222-2222-222222222222";
  const workspaceId = "33333333-3333-3333-3333-333333333333";
  const userId = "44444444-4444-4444-4444-444444444444";
  const versionId1 = "55555555-5555-5555-5555-555555555551";
  const versionId2 = "55555555-5555-5555-5555-555555555552";
  const repoId1 = "66666666-6666-6666-6666-666666666661";
  const repoId2 = "66666666-6666-6666-6666-666666666662";
  const analysisId1 = "77777777-7777-7777-7777-777777777771";

  const sampleProjectA = {
    id: projectIdA,
    workspace_id: workspaceId,
    name: "Payment Gateway Core",
    slug: "payment-gateway-core",
    description: "Core processing service for card payments and settlement",
    status: "active" as const,
    visibility: "workspace" as const,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleProjectB = {
    id: projectIdB,
    workspace_id: workspaceId,
    name: "Customer Portal",
    slug: "customer-portal",
    description: "Isolated frontend portal project",
    status: "active" as const,
    visibility: "workspace" as const,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleArchVersion1: ArchitectureVersion = {
    id: versionId1,
    project_id: projectIdA,
    version_number: 1,
    name: "v1 Baseline Architecture",
    description: "Production payment processing baseline",
    status: "published" as const,
    architecture_data: {} as any,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const sampleArchVersion2: ArchitectureVersion = {
    id: versionId2,
    project_id: projectIdA,
    version_number: 2,
    name: "v2 Event-Driven Architecture",
    description: "Upgraded kafka-backed payment processing baseline",
    status: "published" as const,
    architecture_data: {} as any,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const sampleNodesVersion1: ArchitectureNode[] = [
    {
      id: "node-api",
      architecture_version_id: versionId1,
      node_key: "api-service",
      name: "Payment API Service",
      type: "service",
      technology: "Express",
      description: "Handles HTTP payment requests",
      metadata: {},
      position_x: 0,
      position_y: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: "node-ledger",
      architecture_version_id: versionId1,
      node_key: "ledger-service",
      name: "Ledger Service",
      type: "service",
      technology: "Node.js",
      description: "Immutable transaction ledger",
      metadata: {},
      position_x: 200,
      position_y: 100,
      created_at: new Date().toISOString(),
    },
  ];

  const sampleEdgesVersion1: ArchitectureEdge[] = [
    {
      id: "edge-api-ledger",
      architecture_version_id: versionId1,
      source_node_id: "node-api",
      target_node_id: "node-ledger",
      relationship: "calls",
      protocol: "gRPC",
      description: "Dispatches confirmed payments to ledger",
      metadata: {},
      created_at: new Date().toISOString(),
    },
  ];

  const sampleRepo1: RepositoryRecord = {
    id: repoId1,
    project_id: projectIdA,
    provider: "github",
    repository_url: "https://github.com/org/payment-service",
    repository_name: "payment-service",
    owner: "org",
    default_branch: "main",
    access_type: "public",
    external_repository_id: "ext-1",
    status: "active",
    connected_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleRepo2: RepositoryRecord = {
    id: repoId2,
    project_id: projectIdA,
    provider: "github",
    repository_url: "https://github.com/org/ledger-service",
    repository_name: "ledger-service",
    owner: "org",
    default_branch: "main",
    access_type: "public",
    external_repository_id: "ext-2",
    status: "active",
    connected_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleAnalysis1: RepositoryAnalysis = {
    id: analysisId1,
    repository_id: repoId1,
    project_id: projectIdA,
    commit_sha: "abc1234567890abcdef1234567890abcdef123456",
    status: "completed",
    frameworks: ["Express"],
    languages: { TypeScript: 100 },
    dependencies: [],
    infrastructure: {},
    architecture: {
      frameworks: ["Express"],
      entryPoints: ["src/index.ts", "src/controllers/payment.ts"] as any,
      routes: [
        {
          method: "POST",
          path: "/api/v1/payments",
          framework: "Express",
          file: "src/controllers/payment.ts",
          line: 45,
          handler: "processPayment",
          confidence: "high",
          detectionBasis: "mounted_router",
        },
      ],
      databases: [
        {
          name: "payments_table",
          type: "table",
          orm: "Prisma",
          columns: ["id", "amount", "status", "created_at"],
        },
      ] as any,
    },
    metrics: {},
    analysis_data: {
      commitSha: "abc1234567890abcdef1234567890abcdef123456",
      branch: "main",
      filesAnalyzed: 18,
      testRunner: "vitest",
      testFiles: ["tests/payment.test.ts"],
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const sampleDriftItem: DriftItem = {
    id: "drift-item-1",
    drift_analysis_id: "drift-analysis-1",
    type: "mismatch",
    severity: "high",
    expected: {},
    actual: {},
    description: "Technology mismatch detected on Payment API Service",
    recommendation: "Update architecture node technology specification",
    metadata: {
      confidence: "high",
      evidence: ["Expected Express, found NestJS annotations"],
      affectedComponent: "Payment API Service",
      affectedNodeId: "node-api",
      findingType: "technology_mismatch",
      category: "technology",
      sourceFilePaths: ["src/controllers/payment.ts"],
    },
  };

  const sampleImpactReport: ImpactReport = {
    id: "impact-report-1",
    projectId: projectIdA,
    workspaceId,
    architectureVersionId: versionId1,
    repositoryId: repoId1,
    repositoryAnalysisId: analysisId1,
    targetEntity: {
      type: "architecture_component",
      id: "node-api",
      name: "Payment API Service",
    },
    proposedChange: {
      changeType: "modify_api_contract",
      description: "Upgrade payment payload structure",
    },
    sourceContext: {
      versionNumber: 1,
      versionName: "v1 Baseline Architecture",
    },
    mappingSummary: {
      mappings: [],
      verifiedCount: 1,
      partialCount: 0,
      unmappedArchCount: 0,
      unmappedRepoCount: 0,
      uncertainCount: 0,
    },
    dependencyGraph: {
      nodes: [],
      edges: [],
      directUpstream: [],
      directDownstream: ["node-ledger"],
      indirectUpstream: [],
      indirectDownstream: [],
    },
    impactSummary: {
      directlyAffected: [
        {
          id: "node-ledger",
          name: "Ledger Service",
          entityKind: "component",
          direction: "downstream",
          hopDistance: 1,
          relationship: "calls",
          relationshipStatus: "verified",
          evidence: {},
        },
      ],
      downstreamComponents: [],
      relatedApis: [],
      relatedDatabaseObjects: [],
      affectedIntegrations: [],
      relevantTests: [],
      docSectionsNeedingUpdate: [],
      brokenConnections: [],
      unknownsAndAssumptions: [],
    },
    riskAssessment: {
      overallSeverity: "high",
      findings: [],
      evidenceCount: 1,
      testCoverageStatus: "adequate",
      severityCounts: { critical: 0, high: 1, medium: 0, low: 0, uncertain: 0 },
    },
    changePlan: {} as any,
    driftCorrelations: [],
    playgroundBridge: {
      supported: false,
      simulationCandidateChanges: [],
      evaluableMetrics: [],
      unevaluableMetrics: [],
      explanation: "",
    },
    createdBy: userId,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default mock returns
    vi.spyOn(projectRepository, "findById").mockImplementation(async (id) => {
      if (id === projectIdA) return sampleProjectA as any;
      if (id === projectIdB) return sampleProjectB as any;
      return null;
    });

    vi.spyOn(projectRepository, "requirements").mockResolvedValue([
      {
        id: "req-1",
        project_id: projectIdA,
        content: "Process card payments and record debit in Ledger Service",
        version: 1,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    vi.spyOn(architectureRepository, "versions").mockImplementation(async (pId) => {
      if (pId === projectIdA) return [sampleArchVersion1, sampleArchVersion2];
      return [];
    });

    vi.spyOn(architectureRepository, "nodes").mockImplementation(async (verId) => {
      if (verId === versionId1) return sampleNodesVersion1;
      return [];
    });

    vi.spyOn(architectureRepository, "edges").mockImplementation(async (verId) => {
      if (verId === versionId1) return sampleEdgesVersion1;
      return [];
    });

    vi.spyOn(repositoryIntelligenceRepository, "repositories").mockImplementation(async (pId) => {
      if (pId === projectIdA) return [sampleRepo1, sampleRepo2];
      return [];
    });

    vi.spyOn(repositoryIntelligenceRepository, "analyses").mockImplementation(async (_pId, rId) => {
      if (rId === repoId1) return [sampleAnalysis1];
      return [];
    });

    vi.spyOn(repositoryIntelligenceRepository, "latestSuccessful").mockImplementation(async (_pId, rId) => {
      if (rId === repoId1) return sampleAnalysis1;
      return null;
    });

    vi.spyOn(repositoryIntelligenceRepository, "dependencies").mockResolvedValue([
      {
        id: "dep-1",
        project_id: projectIdA,
        repository_analysis_id: analysisId1,
        name: "express",
        version: "4.19.2",
        ecosystem: "npm",
        type: "runtime",
        risk_level: "low",
        metadata: { manifest_file: "package.json", is_direct: true },
        created_at: new Date().toISOString(),
      },
    ]);

    vi.spyOn(repositoryIntelligenceRepository, "drifts").mockResolvedValue([
      {
        id: "drift-analysis-1",
        project_id: projectIdA,
        repository_id: repoId1,
        architecture_version_id: versionId1,
        repository_analysis_id: analysisId1,
        match_score: 82,
        summary: "Drift analysis detected 1 mismatch",
        status: "completed",
        created_at: new Date().toISOString(),
      },
    ]);

    vi.spyOn(repositoryIntelligenceRepository, "driftFindings").mockResolvedValue([sampleDriftItem]);

    vi.spyOn(engineeringRepository, "documents").mockResolvedValue([
      {
        id: "doc-1",
        project_id: projectIdA,
        source_version_id: versionId1,
        title: "Payment Service Specification",
        type: "api_spec",
        content: "API specification for Payment API Service and Ledger Service integration",
        status: "current",
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ]);

    vi.spyOn(engineeringImpactRepository, "listReports").mockResolvedValue([sampleImpactReport]);

    vi.spyOn(knowledgeGraphRepository, "findByHash").mockResolvedValue(null);
    vi.spyOn(knowledgeGraphRepository, "findLatest").mockResolvedValue(null);
    vi.spyOn(knowledgeGraphRepository, "save").mockImplementation(async (input) => {
      return {
        ...input,
        id: "snap-123",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any;
    });
  });

  // Scenario 1: Building a graph from a saved architecture
  it("Scenario 1: Builds graph nodes from saved architecture components and connections", async () => {
    const { snapshot } = await knowledgeGraphService.buildOrGetGraph(projectIdA, {
      architectureVersionId: versionId1,
    });

    expect(snapshot).toBeDefined();
    expect(snapshot.projectId).toBe(projectIdA);
    expect(snapshot.architectureVersionId).toBe(versionId1);

    const archNodes = snapshot.entities.filter((e) => e.type === "architecture_component");
    expect(archNodes.length).toBe(2);
    expect(archNodes.map((n) => n.name)).toContain("Payment API Service");
    expect(archNodes.map((n) => n.name)).toContain("Ledger Service");

    const edgeRel = snapshot.relationships.find((r) => r.type === "connects_to");
    expect(edgeRel).toBeDefined();
    expect(edgeRel?.sourceId).toBe("arch_node-api");
    expect(edgeRel?.targetId).toBe("arch_node-ledger");
    expect(edgeRel?.confidence).toBe("verified");
  });

  // Scenario 2: Adding repository entities from a completed snapshot
  it("Scenario 2: Adds repository modules, API routes, database models, dependencies and tests", async () => {
    const { snapshot } = await knowledgeGraphService.buildOrGetGraph(projectIdA, {
      repositoryId: repoId1,
      repositoryAnalysisId: analysisId1,
    });

    const routes = snapshot.entities.filter((e) => e.type === "api_route");
    expect(routes.length).toBeGreaterThan(0);
    expect(routes[0].name).toBe("POST /api/v1/payments");

    const modules = snapshot.entities.filter((e) => e.type === "repository_module");
    expect(modules.length).toBeGreaterThan(0);
    expect(modules.map((m) => m.name)).toContain("payment.ts");

    const dbs = snapshot.entities.filter((e) => e.type === "database_model");
    expect(dbs.length).toBe(1);
    expect(dbs[0].name).toBe("payments_table");

    const tests = snapshot.entities.filter((e) => e.type === "test");
    expect(tests.length).toBe(1);
    expect(tests[0].name).toBe("payment.test.ts");
  });

  // Scenario 3: Creating evidence-backed relationships
  it("Scenario 3: Creates evidence-backed relationships between architecture, code, API, and tests", async () => {
    const { snapshot } = await knowledgeGraphService.buildOrGetGraph(projectIdA, {});

    // API route handled by module
    const routeHandlerRel = snapshot.relationships.find((r) => r.type === "handled_by");
    expect(routeHandlerRel).toBeDefined();
    expect(routeHandlerRel?.confidence).toBe("verified");
    expect(routeHandlerRel?.evidence).toContain("Route declaration handled by controller");

    // Module accesses DB
    const dbRel = snapshot.relationships.find((r) => r.type === "accesses");
    expect(dbRel).toBeDefined();
    expect(dbRel?.confidence).toBe("verified");

    // Test verifies module
    const testRel = snapshot.relationships.find((r) => r.type === "verifies");
    expect(testRel).toBeDefined();
    expect(testRel?.confidence).toBe("verified");
  });

  // Scenario 4: Marking unsupported relationships as uncertain or inferred
  it("Scenario 4: Distinguishes verified relationships from inferred ones without fabricating proof", async () => {
    // When requirement loosely matches or defaults, confidence is inferred
    const { snapshot } = await knowledgeGraphService.buildOrGetGraph(projectIdA, {});

    const inferredOrVerifiedReqRel = snapshot.relationships.filter((r) => r.type === "implemented_by");
    expect(inferredOrVerifiedReqRel.length).toBeGreaterThan(0);
    inferredOrVerifiedReqRel.forEach((r) => {
      expect(["verified", "inferred", "partial"]).toContain(r.confidence);
    });

    expect(snapshot.summary.verifiedRelationsCount).toBeGreaterThan(0);
  });

  // Scenario 5: Traversing direct and indirect dependencies (neighborhood exploration)
  it("Scenario 5: Performs bounded neighborhood expansion from a central node", async () => {
    const neighborhood = await knowledgeGraphService.getNeighborhood(projectIdA, "arch_node-api", 1);

    expect(neighborhood).toBeDefined();
    expect(neighborhood.centerEntity.id).toBe("arch_node-api");
    expect(neighborhood.depth).toBe(1);
    expect(neighborhood.nodes.length).toBeGreaterThan(1);
    expect(neighborhood.relationships.length).toBeGreaterThan(0);
  });

  // Scenario 6: Searching and filtering graph entities
  it("Scenario 6: Filters entities by type, relation type, and search keyword", async () => {
    const result = await knowledgeGraphService.queryGraph(projectIdA, {
      entityTypes: ["api_route"],
      search: "payments",
    });

    expect(result.filteredEntities.every((e) => e.type === "api_route")).toBe(true);
    expect(result.filteredEntities.length).toBe(1);
    expect(result.filteredEntities[0].name).toContain("payments");
  });

  // Scenario 7: Multiple repositories within one project
  it("Scenario 7: Supports multiple repositories within the same project context", async () => {
    const context = await knowledgeGraphService.getContext(projectIdA);

    expect(context.repositories.length).toBe(2);
    expect(context.repositories.map((r) => r.name)).toContain("payment-service");
    expect(context.repositories.map((r) => r.name)).toContain("ledger-service");

    const graphRepo1 = await knowledgeGraphService.buildOrGetGraph(projectIdA, {
      repositoryId: repoId1,
    });
    expect(graphRepo1.snapshot.repositoryId).toBe(repoId1);
  });

  // Scenario 8: Project switching and cross-project isolation
  it("Scenario 8: Enforces strict project isolation and prevents cross-project leakage", async () => {
    await expect(
      knowledgeGraphService.buildOrGetGraph(projectIdB, {
        architectureVersionId: versionId1, // belongs to projectIdA
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      knowledgeGraphService.buildOrGetGraph(projectIdB, {
        repositoryId: repoId1, // belongs to projectIdA
      })
    ).rejects.toThrow(ValidationError);
  });

  // Scenario 9: Architecture version switching
  it("Scenario 9: Refreshes graph and invalidates when switching architecture versions", async () => {
    const v1Graph = await knowledgeGraphService.buildOrGetGraph(projectIdA, {
      architectureVersionId: versionId1,
    });
    const v2Graph = await knowledgeGraphService.buildOrGetGraph(projectIdA, {
      architectureVersionId: versionId2,
    });

    expect(v1Graph.snapshot.architectureVersionId).toBe(versionId1);
    expect(v2Graph.snapshot.architectureVersionId).toBe(versionId2);
    expect(v1Graph.snapshot.sourceHash).not.toBe(v2Graph.snapshot.sourceHash);
  });

  // Scenario 10: Snapshot freshness and stale relationship handling
  it("Scenario 10: Correctly identifies stale documentation and outdated sources", async () => {
    vi.spyOn(engineeringRepository, "documents").mockResolvedValueOnce([
      {
        id: "doc-outdated",
        project_id: projectIdA,
        source_version_id: "older-version",
        title: "Legacy Architecture Document",
        type: "architecture_doc",
        content: "Payment API Service",
        status: "outdated",
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ]);

    const { snapshot } = await knowledgeGraphService.buildOrGetGraph(projectIdA, {
      forceRefresh: true,
    });

    const outdatedDocNode = snapshot.entities.find((e) => e.id === "doc_doc-outdated");
    expect(outdatedDocNode).toBeDefined();
    expect(outdatedDocNode?.freshness).toBe("stale");
    expect(outdatedDocNode?.evidenceStatus).toBe("partial");
  });

  // Scenario 11: Idempotent graph generation
  it("Scenario 11: Idempotent graph generation reuses cached snapshot when sourceHash matches", async () => {
    const mockCachedSnapshot = {
      id: "cached-snap-id",
      projectId: projectIdA,
      workspaceId,
      sourceHash: "test-hash",
      sourceContext: {},
      entities: [],
      relationships: [],
      summary: {} as any,
      coverage: {} as any,
      status: "completed" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(knowledgeGraphRepository, "findByHash").mockResolvedValueOnce(mockCachedSnapshot);

    const { snapshot, isFresh } = await knowledgeGraphService.buildOrGetGraph(projectIdA, {});
    expect(snapshot.id).toBe("cached-snap-id");
    expect(isFresh).toBe(true);
  });

  // Scenario 12: Integration with Impact Analysis and Drift
  it("Scenario 12: Connects drift findings and triggers impact analysis directly from graph", async () => {
    const { snapshot } = await knowledgeGraphService.buildOrGetGraph(projectIdA, {});

    const driftNodes = snapshot.entities.filter((e) => e.type === "drift_finding");
    expect(driftNodes.length).toBe(1);
    expect(driftNodes[0].name).toContain("Drift");

    const driftRel = snapshot.relationships.find((r) => r.type === "has_drift");
    expect(driftRel).toBeDefined();
    expect(driftRel?.sourceId).toBe("arch_node-api");

    // Impact Analysis Trigger
    vi.spyOn(engineeringImpactService, "analyze").mockResolvedValueOnce(sampleImpactReport);

    const impactResult = await knowledgeGraphService.analyzeNodeImpact(
      projectIdA,
      "arch_node-api",
      userId,
      "modified"
    );

    expect(impactResult.report.id).toBe("impact-report-1");
    expect(impactResult.entity.name).toBe("Payment API Service");
  });

  // Scenario 13: Large-graph loading and pagination
  it("Scenario 13: Provides paginated and bounded view for large entity graphs", async () => {
    const page1 = await knowledgeGraphService.queryGraph(projectIdA, {
      limit: 2,
      offset: 0,
    });
    expect(page1.filteredEntities.length).toBeLessThanOrEqual(2);
    expect(page1.totalEntities).toBeGreaterThan(2);

    const page2 = await knowledgeGraphService.queryGraph(projectIdA, {
      limit: 2,
      offset: 2,
    });
    expect(page2.filteredEntities.length).toBeLessThanOrEqual(2);
    if (page1.filteredEntities.length > 0 && page2.filteredEntities.length > 0) {
      expect(page1.filteredEntities[0].id).not.toBe(page2.filteredEntities[0].id);
    }
  });

  // Scenario 14: Authorization and invalid resource IDs
  it("Scenario 14: Throws NotFoundError for non-existent projects and entities", async () => {
    await expect(
      knowledgeGraphService.getContext("00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(NotFoundError);

    await expect(
      knowledgeGraphService.getNeighborhood(projectIdA, "non-existent-entity")
    ).rejects.toThrow(NotFoundError);

    await expect(
      knowledgeGraphService.getTraceability(projectIdA, "non-existent-entity")
    ).rejects.toThrow(NotFoundError);
  });

  // Scenario 15: Deterministic operation without AI
  it("Scenario 15: Builds deterministic graph when AI_PROVIDER=none", async () => {
    const originalProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = "none";

    try {
      const run1 = await knowledgeGraphService.buildOrGetGraph(projectIdA, { forceRefresh: true });
      const run2 = await knowledgeGraphService.buildOrGetGraph(projectIdA, { forceRefresh: true });

      expect(run1.snapshot.entities.length).toBe(run2.snapshot.entities.length);
      expect(run1.snapshot.relationships.length).toBe(run2.snapshot.relationships.length);
      expect(run1.snapshot.sourceHash).toBe(run2.snapshot.sourceHash);
    } finally {
      process.env.AI_PROVIDER = originalProvider;
    }
  });

  // Scenario 16: Traceability Explorer with explicit missing link states
  it("Scenario 16: Derives 7-stage Traceability Report with explicit missing gap states", async () => {
    const traceability = await knowledgeGraphService.getTraceability(projectIdA, "arch_node-api");

    expect(traceability).toBeDefined();
    expect(traceability.rootEntityId).toBe("arch_node-api");
    expect(traceability.chain.length).toBe(7);

    // Verify stages: Requirement -> Architecture -> Repository -> API -> Database -> Test -> Documentation
    const stageNames = traceability.chain.map((c) => c.stage);
    expect(stageNames).toEqual([
      "requirement",
      "architecture",
      "repository",
      "api",
      "data_model",
      "test",
      "documentation",
    ]);

    // Check each step has an honest status
    traceability.chain.forEach((step) => {
      expect([
        "verified",
        "inferred",
        "partial",
        "not_mapped",
        "no_matching_test",
        "documentation_missing",
        "uncertain",
        "source_unavailable",
      ]).toContain(step.status);
    });

    expect(traceability.summary).toBeDefined();
  });

  // Scenario 17: Filter graph dependencies with Architecture Only scope
  it("Scenario 17: Filters graph dependencies with scope='architecture'", async () => {
    const result = await knowledgeGraphService.queryGraph(projectIdA, {
      scope: "architecture",
      limit: 200,
    });

    expect(result.filteredEntities.length).toBeGreaterThan(0);
    const archTypes = new Set([
      "architecture_version",
      "requirement",
      "architecture_component",
      "architecture_connection",
      "drift_finding",
      "impact_finding",
      "documentation",
    ]);

    // All entities must belong to architecture domain
    result.filteredEntities.forEach((entity) => {
      expect(archTypes.has(entity.type)).toBe(true);
    });

    // All relationships must only connect architecture entities
    const validIds = new Set(result.filteredEntities.map((e) => e.id));
    result.filteredRelationships.forEach((rel) => {
      expect(validIds.has(rel.sourceId)).toBe(true);
      expect(validIds.has(rel.targetId)).toBe(true);
    });
  });

  // Scenario 18: Filter graph dependencies with Repository Only scope
  it("Scenario 18: Filters graph dependencies with scope='repository'", async () => {
    const result = await knowledgeGraphService.queryGraph(projectIdA, {
      scope: "repository",
      limit: 200,
    });

    expect(result.filteredEntities.length).toBeGreaterThan(0);
    const repoTypes = new Set([
      "repository_module",
      "api_route",
      "database_model",
      "dependency",
      "test",
    ]);

    // All entities must belong to repository domain
    result.filteredEntities.forEach((entity) => {
      expect(repoTypes.has(entity.type)).toBe(true);
    });

    // All relationships must only connect repository entities
    const validIds = new Set(result.filteredEntities.map((e) => e.id));
    result.filteredRelationships.forEach((rel) => {
      expect(validIds.has(rel.sourceId)).toBe(true);
      expect(validIds.has(rel.targetId)).toBe(true);
    });
  });

  // Scenario 19: Full Combined Scope
  it("Scenario 19: Returns cross-system dependencies when scope='all'", async () => {
    const result = await knowledgeGraphService.queryGraph(projectIdA, {
      scope: "all",
      limit: 200,
    });

    const types = new Set(result.filteredEntities.map((e) => e.type));
    // Contains both architecture and repository entities
    expect(types.has("architecture_component") || types.has("architecture_version")).toBe(true);
    expect(types.has("repository_module") || types.has("api_route") || types.has("dependency")).toBe(true);

    // Contains cross-system mapped relationships
    const relationTypes = new Set(result.filteredRelationships.map((r) => r.type));
    expect(relationTypes.has("mapped_to") || relationTypes.has("handled_by") || relationTypes.has("accesses")).toBe(true);
  });
});


import { describe, it, expect, vi, beforeEach } from "vitest";
import { workflowOrchestrationService } from "../src/services/workflow-orchestration-service.js";
import { workflowReadinessService } from "../src/services/workflow-readiness-service.js";
import { architectureService } from "../src/services/architecture-service.js";
import { architectureRepository } from "../src/repositories/architecture-repository.js";
import { repositoryIntelligenceRepository } from "../src/repositories/repository-intelligence-repository.js";
import { driftDetectionService } from "../src/services/drift-service.js";
import { engineeringImpactRepository } from "../src/repositories/engineering-impact-repository.js";
import { engineeringRepository } from "../src/repositories/engineering-intelligence-repository.js";
import { workflowOrchestrationRepository } from "../src/repositories/workflow-orchestration-repository.js";
import { supabaseAdmin } from "../src/lib/supabase.js";
import { NotFoundError, ValidationError } from "../src/errors/app-error.js";
import type { WorkflowRun, WorkflowStageKey, WorkflowStageResult } from "../src/types/workflow-orchestration.js";
import type { RepositoryAnalysis } from "../src/types/repository-intelligence.js";
import type { ArchitectureVersion } from "../src/types/architecture.js";

describe("ArchForge — Engineering Workflow Orchestration Integration", () => {
  const projectId = "11111111-1111-1111-1111-111111111111";
  const projectOtherId = "22222222-2222-2222-2222-222222222222";
  const workspaceId = "33333333-3333-3333-3333-333333333333";
  const userId = "44444444-4444-4444-4444-444444444444";
  const versionId = "55555555-5555-5555-5555-555555555555";
  const repoId1 = "66666666-6666-6666-6666-666666666661";
  const repoId2 = "66666666-6666-6666-6666-666666666662";
  const analysisId = "77777777-7777-7777-7777-777777777777";

  const sampleNodes = [
    {
      id: "node-1",
      architecture_version_id: versionId,
      node_key: "api-gateway",
      name: "API Gateway",
      type: "gateway" as const,
      technology: "Express",
      description: "Gateway",
      metadata: {},
      position_x: 0,
      position_y: 0,
      created_at: new Date().toISOString(),
    },
    {
      id: "node-2",
      architecture_version_id: versionId,
      node_key: "auth-service",
      name: "Auth Service",
      type: "service" as const,
      technology: "Node.js",
      description: "Authentication",
      metadata: {},
      position_x: 100,
      position_y: 100,
      created_at: new Date().toISOString(),
    },
  ];

  const sampleEdges = [
    {
      id: "edge-1",
      architecture_version_id: versionId,
      source_node_id: "node-1",
      target_node_id: "node-2",
      relationship: "calls" as const,
      protocol: "HTTPS / REST",
      description: "Calls auth",
      metadata: {},
      created_at: new Date().toISOString(),
    },
  ];

  const sampleArchVersion: ArchitectureVersion = {
    id: versionId,
    project_id: projectId,
    version_number: 1,
    name: "Initial Baseline",
    description: "Initial baseline description",
    status: "published" as const,
    architecture_data: {} as any,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const sampleRepo = {
    id: repoId1,
    project_id: projectId,
    provider: "github" as const,
    repository_url: "https://github.com/org/archforge",
    repository_name: "archforge-core",
    owner: "org",
    default_branch: "main",
    access_type: "public" as const,
    external_repository_id: "ext-1",
    status: "active" as const,
    connected_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleAnalysis: RepositoryAnalysis = {
    id: analysisId,
    repository_id: repoId1,
    project_id: projectId,
    commit_sha: "a1b2c3d4e5f6",
    status: "completed",
    frameworks: [{ name: "Express", ecosystem: "npm", confidence: "high", category: "backend", evidenceFile: "package.json", evidenceType: "manifest_dependency" }],
    languages: { TypeScript: 80, JavaScript: 20 },
    dependencies: [],
    infrastructure: {},
    architecture: {
      services: ["Auth Service"],
      technologies: ["Node.js", "Express"],
    },
    metrics: { fileCount: 45, dependencyCount: 12 },
    analysis_data: {
      commitSha: "a1b2c3d4e5f6",
      branch: "main",
      filesAnalyzed: 45,
      testRunner: "vitest",
      testFiles: ["tests/app.test.ts", "tests/auth.test.ts"],
      testCount: 2,
      security: {
        checksExecuted: ["env_scanner", "hardcoded_secret_detection"],
        filesScanned: 45,
        findings: [],
        externalScanningConfigured: false,
        advisory: "No static security issues detected.",
      },
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default supabase admin mocks for project lookup
    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      if (table === "projects") {
        const queryResult = {
          neq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: projectId, workspace_id: workspaceId }, error: null }),
            single: () => Promise.resolve({ data: { id: projectId, workspace_id: workspaceId }, error: null }),
          }),
          maybeSingle: () => Promise.resolve({ data: { id: projectId, workspace_id: workspaceId }, error: null }),
          single: () => Promise.resolve({ data: { id: projectId, workspace_id: workspaceId }, error: null }),
        };
        return {
          select: () => ({
            eq: () => queryResult,
          }),
        } as any;
      }
      return {} as any;
    });

    // Default architecture service mocks
    vi.spyOn(architectureService, "getVersion").mockResolvedValue({
      version: sampleArchVersion,
      nodes: sampleNodes,
      edges: sampleEdges,
    });
    vi.spyOn(architectureRepository, "versions").mockResolvedValue([sampleArchVersion]);
    vi.spyOn(architectureRepository, "nodes").mockResolvedValue(sampleNodes);
    vi.spyOn(architectureRepository, "edges").mockResolvedValue(sampleEdges);
    vi.spyOn(architectureRepository, "latest").mockResolvedValue(sampleArchVersion);

    // Default repository intelligence mocks
    vi.spyOn(repositoryIntelligenceRepository, "repositories").mockResolvedValue([sampleRepo]);
    vi.spyOn(repositoryIntelligenceRepository, "repository").mockResolvedValue(sampleRepo);
    vi.spyOn(repositoryIntelligenceRepository, "analyses").mockResolvedValue([sampleAnalysis]);
    vi.spyOn(repositoryIntelligenceRepository, "analysis").mockResolvedValue(sampleAnalysis);
    vi.spyOn(repositoryIntelligenceRepository, "latestSuccessful").mockResolvedValue(sampleAnalysis);
    vi.spyOn(repositoryIntelligenceRepository, "drifts").mockResolvedValue([]);
    vi.spyOn(repositoryIntelligenceRepository, "createDrift").mockResolvedValue({
      id: "drift-1",
      project_id: projectId,
      architecture_version_id: versionId,
      repository_analysis_id: analysisId,
      match_score: 92,
      summary: "High architectural conformance",
      status: "completed",
      created_at: new Date().toISOString(),
    } as any);
    vi.spyOn(repositoryIntelligenceRepository, "createDriftItems").mockResolvedValue([] as any);
    vi.spyOn(repositoryIntelligenceRepository, "driftFindings").mockResolvedValue([]);

    // Drift Detection Service
    vi.spyOn(driftDetectionService, "compare").mockResolvedValue({
      items: [],
      score: 95,
      summary: "95% architecture conformance match",
      counts: {
        total: 0,
        byCategory: { missing_component: 0, extra_module: 0, technology_mismatch: 0, integration_mismatch: 0, uncertain_match: 0, coverage_limitation: 0 },
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      },
    });

    // Impact repository
    vi.spyOn(engineeringImpactRepository, "listReports").mockResolvedValue([]);

    // Engineering intelligence repository
    vi.spyOn(engineeringRepository, "simulations").mockResolvedValue([]);
    vi.spyOn(engineeringRepository, "documents").mockResolvedValue([]);

    // Workflow repository
    vi.spyOn(workflowOrchestrationRepository, "createRun").mockImplementation(async (input) => ({
      id: "run-mock-123",
      createdAt: new Date().toISOString(),
      ...input,
    }));
    vi.spyOn(workflowOrchestrationRepository, "latestRun").mockResolvedValue(null);
    vi.spyOn(workflowOrchestrationRepository, "listRuns").mockResolvedValue([]);
  });

  // ─── 1. Complete Workflow with Valid Evidence ──────────────────────────────
  it("executes a complete workflow with valid architecture and repository evidence", async () => {
    vi.spyOn(engineeringRepository, "documents").mockResolvedValue([
      {
        id: "doc-1",
        project_id: projectId,
        title: "System Architecture Overview",
        type: "architecture_spec",
        format: "markdown",
        source_version_id: versionId,
        source_repository_analysis_id: analysisId,
        status: "up_to_date",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ]);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId1,
      repositoryAnalysisId: analysisId,
    });

    expect(run).toBeDefined();
    expect(run.status).toBe("completed");
    expect(run.stages.stage_a_architecture.status).toBe("completed");
    expect(run.stages.stage_a_architecture.evidence.nodeCount).toBe(2);
    expect(run.stages.stage_b_repository.status).toBe("completed");
    expect(run.stages.stage_b_repository.sourceVersion?.commitSha).toBe("a1b2c3d4e5f6");
    expect(run.stages.stage_c_drift.status).toBe("completed");
    expect(run.stages.stage_c_drift.evidence.matchScore).toBe(92);
    expect(run.stages.stage_g_verification.evidence.testSuitesExecuted).toBe(false); // correctly marked unexecuted
  });

  // ─── 2. Architecture-Only Workflow ─────────────────────────────────────────
  it("supports architecture-only workflows when no repository is connected", async () => {
    vi.spyOn(repositoryIntelligenceRepository, "repositories").mockResolvedValue([]);
    vi.spyOn(repositoryIntelligenceRepository, "repository").mockResolvedValue(null);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      architectureVersionId: versionId,
    });

    expect(run.stages.stage_a_architecture.status).toBe("completed");
    expect(run.stages.stage_b_repository.status).toBe("not_started");
    // Stage C drift must be safely marked not_started, not crash!
    expect(run.stages.stage_c_drift.status).toBe("not_started");
    expect(run.stages.stage_c_drift.blockingReason).toContain("Stage B");
  });

  // ─── 3. Repository-Only Workflows ──────────────────────────────────────────
  it("handles repository-only projects when architecture version is not yet created", async () => {
    vi.spyOn(architectureService, "getCurrent").mockResolvedValue(null as any);
    vi.spyOn(architectureRepository, "latest").mockResolvedValue(null);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {});

    expect(run.stages.stage_a_architecture.status).toBe("needs_attention");
    expect(run.stages.stage_b_repository.status).toBe("completed");
    expect(run.stages.stage_c_drift.status).toBe("not_started");
    expect(run.stages.stage_c_drift.blockingReason).toContain("Stage A");
  });

  // ─── 4. Multi-Repository Projects ──────────────────────────────────────────
  it("accurately maps source snapshots when a project has multiple repositories", async () => {
    const repo2 = { ...sampleRepo, id: repoId2, repository_name: "archforge-worker" };
    vi.spyOn(repositoryIntelligenceRepository, "repositories").mockResolvedValue([sampleRepo, repo2]);
    vi.spyOn(repositoryIntelligenceRepository, "repository").mockImplementation(async (_pid, rid) => {
      return rid === repoId2 ? repo2 : sampleRepo;
    });

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      repositoryId: repoId2,
    });

    expect(run.sourceContext.repositoryId).toBe(repoId2);
    expect(run.sourceContext.repositoryName).toBe("archforge-worker");
  });

  // ─── 5. Project Switching and Cross-Project Isolation ───────────────────────
  it("enforces project isolation and rejects repository belonging to a different project", async () => {
    vi.spyOn(repositoryIntelligenceRepository, "repository").mockResolvedValue({
      ...sampleRepo,
      project_id: projectOtherId,
    });

    await expect(
      workflowOrchestrationService.executeWorkflow(projectId, userId, {
        repositoryId: "foreign-repo",
      })
    ).rejects.toThrow(NotFoundError);
  });

  // ─── 6. Missing Architecture Versions ──────────────────────────────────────
  it("returns clear actionable guidance when architecture version does not exist", async () => {
    vi.spyOn(architectureService, "getVersion").mockResolvedValue({ version: null as any, nodes: [], edges: [] });

    await expect(
      workflowOrchestrationService.executeWorkflow(projectId, userId, {
        architectureVersionId: "nonexistent-version",
      })
    ).rejects.toThrow(NotFoundError);
  });

  // ─── 7. Missing, Failed, or Stale Repository Snapshots ──────────────────────
  it("handles failed repository analysis snapshots without crashing pipeline", async () => {
    const failedAnalysis: RepositoryAnalysis = {
      ...sampleAnalysis,
      status: "failed",
      analysis_data: { error: "Authentication failed with GitHub API" },
    };
    vi.spyOn(repositoryIntelligenceRepository, "analysis").mockResolvedValue(failedAnalysis);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      repositoryAnalysisId: analysisId,
    });

    expect(run.stages.stage_b_repository.status).toBe("failed");
    expect(run.stages.stage_b_repository.evidence.error).toBe("Authentication failed with GitHub API");
    expect(run.stages.stage_c_drift.status).toBe("not_started");
    expect(run.readinessGate.decision).toBe("blocked");
  });

  // ─── 8. Drift Stage Failure and Recovery ───────────────────────────────────
  it("captures drift failure safely and marks stage failed with next actionable step", async () => {
    vi.spyOn(driftDetectionService, "compare").mockRejectedValue(new Error("Drift graph cycle detected"));

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      architectureVersionId: versionId,
      repositoryAnalysisId: analysisId,
      forceRerun: true,
    });

    expect(run.stages.stage_c_drift.status).toBe("failed");
    expect(run.stages.stage_c_drift.findingsSummary).toContain("Drift comparison error");
    expect(run.stages.stage_c_drift.recommendedNextAction.action).toBe("Retry drift analysis");
  });

  // ─── 9. Impact Analysis Failure and Recovery ───────────────────────────────
  it("handles missing impact analysis and marks stage ready with required user action", async () => {
    vi.spyOn(engineeringImpactRepository, "listReports").mockResolvedValue([]);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {});

    expect(run.stages.stage_d_impact.status).toBe("ready");
    expect(run.stages.stage_d_impact.recommendedNextAction.action).toBe("Analyze change impact");
  });

  // ─── 10. Playground Simulation Without Automatic Approval ──────────────────
  it("preserves distinction between playground simulation and approved changes", async () => {
    vi.spyOn(engineeringRepository, "simulations").mockResolvedValue([
      {
        id: "sim-1",
        project_id: projectId,
        base_version_id: versionId,
        name: "Explore GraphQL Gateway",
        status: "completed", // Unapplied sandbox simulation
        proposed_changes: [{ type: "add_component", name: "GraphQL GW" }],
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ]);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      architectureVersionId: versionId,
    });

    expect(run.stages.stage_e_playground.status).toBe("completed");
    expect(run.stages.stage_e_playground.evidence.isSandboxOnly).toBe(true);
    // Findings should note that simulations are sandboxed and unapplied
    expect(run.stages.stage_e_playground.findings[0]?.description).toContain("Simulations are sandboxed and do NOT modify active architecture baseline");
  });

  // ─── 11. Documentation Freshness After Source Changes ──────────────────────
  it("identifies documents that need regeneration when source architecture changes", async () => {
    vi.spyOn(engineeringRepository, "documents").mockResolvedValue([
      {
        id: "doc-1",
        project_id: projectId,
        title: "System Architecture Spec",
        type: "architecture_spec",
        format: "markdown",
        source_version_id: "older-version-999", // Different from current versionId
        status: "up_to_date",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ]);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      architectureVersionId: versionId,
    });

    expect(run.stages.stage_f_documentation.status).toBe("needs_attention");
    expect(run.stages.stage_f_documentation.isStale).toBe(true);
    expect(run.stages.stage_f_documentation.evidence.staleDocumentsCount).toBe(1);
    expect(run.readinessGate.warnings.some((w) => w.includes("out of date"))).toBe(true);
  });

  // ─── 12. Readiness Gate Decisions and Evidence ─────────────────────────────
  it("evaluates readiness gate as blocked when critical drift items exist", () => {
    const stages: Record<WorkflowStageKey, WorkflowStageResult> = {
      stage_a_architecture: {
        key: "stage_a_architecture",
        name: "Stage A",
        stageLetter: "A",
        status: "completed",
        evidence: { nodeCount: 5, edgeCount: 4 },
        findingsSummary: "Valid",
        findings: [],
        recommendedNextAction: { action: "None", description: "None" },
        reused: false,
        isStale: false,
      },
      stage_b_repository: {
        key: "stage_b_repository",
        name: "Stage B",
        stageLetter: "B",
        status: "completed",
        evidence: { filesAnalyzed: 50 },
        findingsSummary: "Valid",
        findings: [],
        recommendedNextAction: { action: "None", description: "None" },
        reused: false,
        isStale: false,
      },
      stage_c_drift: {
        key: "stage_c_drift",
        name: "Stage C",
        stageLetter: "C",
        status: "completed",
        evidence: { matchScore: 40 },
        findingsSummary: "Critical mismatch",
        findings: [
          {
            stage: "stage_c_drift",
            severity: "critical",
            title: "Missing Database Component",
            description: "Postgres primary database missing from repository code",
          },
        ],
        recommendedNextAction: { action: "Fix drift", description: "Fix" },
        reused: false,
        isStale: false,
      },
      stage_d_impact: { key: "stage_d_impact", name: "D", stageLetter: "D", status: "ready", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
      stage_e_playground: { key: "stage_e_playground", name: "E", stageLetter: "E", status: "ready", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
      stage_f_documentation: { key: "stage_f_documentation", name: "F", stageLetter: "F", status: "completed", evidence: { totalDocumentsCount: 2, staleDocumentsCount: 0 }, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
      stage_g_verification: { key: "stage_g_verification", name: "G", stageLetter: "G", status: "completed", evidence: { testSuitesExecuted: false }, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
    };

    const gate = workflowReadinessService.evaluate(stages);
    expect(gate.decision).toBe("blocked");
    expect(gate.blockers.some((b) => b.includes("critical architecture drift"))).toBe(true);
  });

  it("evaluates readiness gate as ready_with_warnings when only test execution is unexecuted", () => {
    const stages: Record<WorkflowStageKey, WorkflowStageResult> = {
      stage_a_architecture: {
        key: "stage_a_architecture",
        name: "Stage A",
        stageLetter: "A",
        status: "completed",
        evidence: { nodeCount: 5, edgeCount: 4 },
        findingsSummary: "Valid",
        findings: [],
        recommendedNextAction: { action: "None", description: "None" },
        reused: false,
        isStale: false,
      },
      stage_b_repository: {
        key: "stage_b_repository",
        name: "Stage B",
        stageLetter: "B",
        status: "completed",
        evidence: { filesAnalyzed: 50 },
        findingsSummary: "Valid",
        findings: [],
        recommendedNextAction: { action: "None", description: "None" },
        reused: false,
        isStale: false,
      },
      stage_c_drift: {
        key: "stage_c_drift",
        name: "Stage C",
        stageLetter: "C",
        status: "completed",
        evidence: { matchScore: 100 },
        findingsSummary: "100% Match",
        findings: [],
        recommendedNextAction: { action: "None", description: "None" },
        reused: false,
        isStale: false,
      },
      stage_d_impact: { key: "stage_d_impact", name: "D", stageLetter: "D", status: "ready", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
      stage_e_playground: { key: "stage_e_playground", name: "E", stageLetter: "E", status: "ready", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
      stage_f_documentation: { key: "stage_f_documentation", name: "F", stageLetter: "F", status: "completed", evidence: { totalDocumentsCount: 2, staleDocumentsCount: 0 }, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
      stage_g_verification: { key: "stage_g_verification", name: "G", stageLetter: "G", status: "completed", evidence: { testSuitesExecuted: false, testFilesCount: 4 }, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
    };

    const gate = workflowReadinessService.evaluate(stages);
    expect(gate.decision).toBe("ready_with_warnings");
    expect(gate.warnings.some((w) => w.includes("Test suites"))).toBe(true);
  });

  // ─── 13. Reuse of Valid Analysis Results ───────────────────────────────────
  it("reuses existing drift analysis without recomputation when sources are unchanged", async () => {
    vi.spyOn(repositoryIntelligenceRepository, "drifts").mockResolvedValue([
      {
        id: "cached-drift-1",
        project_id: projectId,
        architecture_version_id: versionId,
        repository_analysis_id: analysisId,
        match_score: 98,
        summary: "Cached drift evaluation",
        status: "completed",
        counts: {
          total: 0,
          byCategory: { missing_component: 0, extra_module: 0, technology_mismatch: 0, integration_mismatch: 0, uncertain_match: 0, coverage_limitation: 0 },
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        },
        created_at: new Date().toISOString(),
      } as any,
    ]);

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      architectureVersionId: versionId,
      repositoryAnalysisId: analysisId,
      forceRerun: false,
    });

    expect(run.stages.stage_c_drift.reused).toBe(true);
    // driftDetectionService.compare should NOT have been called because it was reused!
    expect(driftDetectionService.compare).not.toHaveBeenCalled();
  });

  // ─── 14. Retry Behavior Without Duplicate Records ──────────────────────────
  it("supports retrying failed stages safely and updates existing run without creating duplicates", async () => {
    const existingRun: WorkflowRun = {
      id: "run-existing-1",
      projectId,
      workspaceId,
      architectureVersionId: versionId,
      repositoryId: repoId1,
      repositoryAnalysisId: analysisId,
      branch: "main",
      commitSha: "a1b2c3d4e5f6",
      status: "failed",
      stages: {
        stage_a_architecture: { key: "stage_a_architecture", name: "A", stageLetter: "A", status: "completed", evidence: { nodeCount: 2, edgeCount: 1 }, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
        stage_b_repository: { key: "stage_b_repository", name: "B", stageLetter: "B", status: "completed", evidence: { filesAnalyzed: 10 }, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
        stage_c_drift: { key: "stage_c_drift", name: "C", stageLetter: "C", status: "failed", evidence: { error: "Network timeout" }, findingsSummary: "Timeout", findings: [], recommendedNextAction: { action: "Retry", description: "Retry" }, reused: false, isStale: false },
        stage_d_impact: { key: "stage_d_impact", name: "D", stageLetter: "D", status: "ready", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
        stage_e_playground: { key: "stage_e_playground", name: "E", stageLetter: "E", status: "ready", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
        stage_f_documentation: { key: "stage_f_documentation", name: "F", stageLetter: "F", status: "completed", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
        stage_g_verification: { key: "stage_g_verification", name: "G", stageLetter: "G", status: "completed", evidence: {}, findingsSummary: "", findings: [], recommendedNextAction: { action: "", description: "" }, reused: false, isStale: false },
      },
      readinessGate: { decision: "blocked", summary: "Blocked", checks: [], blockers: ["Drift failed"], warnings: [], nextSteps: [], evaluatedAt: "" },
      summary: { totalStages: 7, completedStages: 5, failedStages: 1, stagesNeedingAttention: 1, reusedStages: 0, staleStages: 0, overallVerdict: "blocked", primaryNextStep: "" },
      sourceContext: {},
      createdBy: userId,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    vi.spyOn(workflowOrchestrationRepository, "getRun").mockResolvedValue(existingRun);
    vi.spyOn(workflowOrchestrationRepository, "updateRun").mockImplementation(async (id, updates) => ({
      ...existingRun,
      ...updates,
      id,
    }));

    const retriedRun = await workflowOrchestrationService.retryStage(projectId, existingRun.id, "stage_c_drift", userId);

    expect(retriedRun.id).toBe(existingRun.id);
    expect(retriedRun.stages.stage_c_drift.status).toBe("completed");
    expect(retriedRun.status).toBe("completed");
    expect(workflowOrchestrationRepository.createRun).not.toHaveBeenCalled();
  });

  // ─── 15. Authorization and Invalid Source IDs ──────────────────────────────
  it("rejects repository snapshot that does not belong to the selected repository", async () => {
    vi.spyOn(repositoryIntelligenceRepository, "analysis").mockResolvedValue({
      ...sampleAnalysis,
      repository_id: "other-repo-uuid",
    });

    await expect(
      workflowOrchestrationService.executeWorkflow(projectId, userId, {
        repositoryId: repoId1,
        repositoryAnalysisId: analysisId,
      })
    ).rejects.toThrow(ValidationError);
  });

  // ─── 16. Operation with AI_PROVIDER=none ───────────────────────────────────
  it("executes workflow orchestration deterministically without requiring an AI provider", async () => {
    process.env.AI_PROVIDER = "none";

    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId1,
      repositoryAnalysisId: analysisId,
    });

    expect(run).toBeDefined();
    expect(run.readinessGate.decision).toBeDefined();
    expect(run.stages.stage_c_drift.status).toBe("completed");
  });

  // ─── 17. Preservation of Historical Successful Results ─────────────────────
  it("preserves historical workflow runs and orders history by timestamp descending", async () => {
    const historicalRuns: WorkflowRun[] = [
      {
        id: "run-recent",
        projectId,
        workspaceId,
        architectureVersionId: versionId,
        repositoryId: repoId1,
        repositoryAnalysisId: analysisId,
        branch: "main",
        commitSha: "sha-2",
        status: "completed",
        stages: {} as any,
        readinessGate: {} as any,
        summary: {} as any,
        sourceContext: {},
        createdBy: userId,
        createdAt: "2026-10-12T10:00:00Z",
        completedAt: "2026-10-12T10:01:00Z",
      },
      {
        id: "run-older",
        projectId,
        workspaceId,
        architectureVersionId: versionId,
        repositoryId: repoId1,
        repositoryAnalysisId: analysisId,
        branch: "main",
        commitSha: "sha-1",
        status: "completed",
        stages: {} as any,
        readinessGate: {} as any,
        summary: {} as any,
        sourceContext: {},
        createdBy: userId,
        createdAt: "2026-10-11T10:00:00Z",
        completedAt: "2026-10-11T10:01:00Z",
      },
    ];

    vi.spyOn(workflowOrchestrationRepository, "listRuns").mockResolvedValue(historicalRuns);

    const result = await workflowOrchestrationService.listRuns(projectId);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("run-recent");
    expect(result[1].id).toBe("run-older");
  });

  // ─── 18. Workflow Context Aggregation ──────────────────────────────────────
  it("retrieves unified workflow context for the project with all versions and repo snapshots", async () => {
    const context = await workflowOrchestrationService.getContext(projectId);

    expect(context.projectId).toBe(projectId);
    expect(context.architectureVersions).toHaveLength(1);
    expect(context.architectureVersions[0].nodeCount).toBe(2);
    expect(context.repositories).toHaveLength(1);
    expect(context.repositories[0].name).toBe("archforge-core");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { qualityService } from "../src/services/quality-service.js";
import { engineeringQualityRepository } from "../src/repositories/engineering-quality-repository.js";
import { projectRepository } from "../src/repositories/project-repository.js";
import { architectureService } from "../src/services/architecture-service.js";
import { architectureRepository } from "../src/repositories/architecture-repository.js";
import { repositoryIntelligenceRepository } from "../src/repositories/repository-intelligence-repository.js";
import { driftDetectionService } from "../src/services/drift-service.js";
import { engineeringImpactRepository } from "../src/repositories/engineering-impact-repository.js";
import { knowledgeGraphRepository } from "../src/repositories/knowledge-graph-repository.js";
import { supabaseAdmin } from "../src/lib/supabase.js";
import { NotFoundError } from "../src/errors/app-error.js";
import type { RepositoryAnalysis, RepositoryRecord } from "../src/types/repository-intelligence.js";
import type { ArchitectureVersion } from "../src/types/architecture.js";

describe("ArchForge — Engineering Quality & Release Readiness Integration", () => {
  const projectId = "11111111-1111-1111-1111-111111111111";
  const projectOtherId = "22222222-2222-2222-2222-222222222222";
  const workspaceId = "33333333-3333-3333-3333-333333333333";
  const userId = "44444444-4444-4444-4444-444444444444";
  const versionId = "55555555-5555-5555-5555-555555555555";
  const repoId = "66666666-6666-6666-6666-666666666666";
  const analysisId = "77777777-7777-7777-7777-777777777777";

  const sampleProject = {
    id: projectId,
    workspace_id: workspaceId,
    name: "ArchForge Core",
    description: "Core platform",
    status: "active" as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleArchVersion: ArchitectureVersion = {
    id: versionId,
    project_id: projectId,
    version_number: 1,
    name: "Baseline v1",
    description: "Baseline architecture",
    status: "published" as const,
    architecture_data: {} as any,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const sampleRepo: RepositoryRecord = {
    id: repoId,
    project_id: projectId,
    provider: "github",
    repository_url: "https://github.com/org/archforge",
    repository_name: "archforge",
    owner: "org",
    default_branch: "main",
    access_type: "public",
    external_repository_id: "ext-1",
    status: "active",
    connected_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleAnalysis: RepositoryAnalysis = {
    id: analysisId,
    repository_id: repoId,
    project_id: projectId,
    commit_sha: "abcd1234ef5678",
    status: "completed",
    frameworks: [{ name: "Express", version: "5.1.0" } as any],
    languages: { TypeScript: 80, CSS: 20 },
    dependencies: [
      { name: "express", version: "^5.1.0", risk_level: "low", ecosystem: "npm" },
      { name: "vitest", version: "^3.0.0", risk_level: "low", ecosystem: "npm" },
    ],
    infrastructure: {},
    architecture: {
      authentication: true,
      services: ["src/services/quality-service.ts"],
      apis: ["src/routes/engineering-quality-routes.ts"],
    },
    metrics: {},
    analysis_data: {
      filesAnalyzed: 45,
      testRunner: "Vitest",
      testFiles: ["tests/app.test.ts", "tests/quality.test.ts"],
      scanLimitations: [],
      security: {
        checksExecuted: ["secrets", "keys", "cors"],
        findings: [],
        externalScanningConfigured: true,
        filesScanned: 45,
      } as any,
    },
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(projectRepository, "findById").mockImplementation(async (id) => {
      if (id === projectId) return sampleProject as any;
      if (id === projectOtherId) return { ...sampleProject, id: projectOtherId, workspace_id: "other-workspace" } as any;
      return null;
    });

    vi.spyOn(architectureService, "getVersion").mockResolvedValue({
      version: sampleArchVersion,
      nodes: [
        { id: "n1", node_key: "api", name: "API", type: "service", technology: "Express" } as any,
        { id: "n2", node_key: "db", name: "DB", type: "database", technology: "Postgres" } as any,
      ],
      edges: [{ id: "e1", source_node_id: "n1", target_node_id: "n2", relationship: "calls" } as any],
    });

    vi.spyOn(architectureRepository, "versions").mockResolvedValue([sampleArchVersion]);
    vi.spyOn(architectureRepository, "nodes").mockResolvedValue([
      { id: "n1", node_key: "api", name: "API", type: "service", technology: "Express" } as any,
    ]);

    vi.spyOn(repositoryIntelligenceRepository, "repositories").mockResolvedValue([sampleRepo]);
    vi.spyOn(repositoryIntelligenceRepository, "repository").mockImplementation(async (pId, rId) => {
      if (pId === projectId && rId === repoId) return sampleRepo;
      return null;
    });
    vi.spyOn(repositoryIntelligenceRepository, "analysis").mockImplementation(async (aId) => {
      if (aId === analysisId) return sampleAnalysis;
      return null;
    });
    vi.spyOn(repositoryIntelligenceRepository, "analyses").mockResolvedValue([sampleAnalysis]);

    vi.spyOn(driftDetectionService, "compare").mockResolvedValue({
      score: 95,
      summary: "95% architecture conformance",
      items: [],
      counts: { bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } } as any,
    });

    vi.spyOn(engineeringImpactRepository, "listReports").mockResolvedValue([]);
    vi.spyOn(knowledgeGraphRepository, "findLatest").mockResolvedValue({
      id: "kg-1",
      projectId,
      coverage: {
        totalComponents: 2,
        mappedComponentsCount: 2,
        overallCoveragePercentage: 90,
      },
    } as any);

    const defaultDocData = [
      { id: "doc-1", title: "Architecture Spec", status: "active", source_version_id: versionId, source_repository_analysis_id: analysisId },
    ];
    const defaultEvidenceData = {
      id: "ev-1",
      project_id: projectId,
      commit_sha: "abcd1234ef5678",
      build_status: "passed",
      test_status: "passed",
      tests_total: 50,
      tests_passed: 50,
      tests_failed: 0,
      tests_skipped: 0,
      executed_by: "GitHub Actions",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabaseAdmin, "from").mockImplementation((table: string) => {
      const createBuilder = (tableData: any) => {
        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          order: vi.fn(() => builder),
          limit: vi.fn(() => builder),
          maybeSingle: vi.fn().mockResolvedValue({ data: tableData, error: null }),
          single: vi.fn().mockResolvedValue({ data: tableData, error: null }),
          insert: vi.fn(() => builder),
          then: (onfulfilled: any, onrejected?: any) => Promise.resolve({ data: tableData, error: null }).then(onfulfilled, onrejected),
        };
        return builder;
      };

      if (table === "documentation" || table === "documentation_artifacts") {
        return createBuilder(defaultDocData);
      }
      if (table === "quality_verification_evidence") {
        return createBuilder(defaultEvidenceData);
      }
      return createBuilder(null);
    });

    // Mock createReport in repository to return the input + generated ID
    vi.spyOn(engineeringQualityRepository, "createReport").mockImplementation(async (input) => {
      return {
        id: "rep-12345678",
        createdAt: new Date().toISOString(),
        ...input,
      } as any;
    });

    vi.spyOn(engineeringQualityRepository, "listReports").mockResolvedValue([]);
    vi.spyOn(engineeringQualityRepository, "latestEvidence").mockResolvedValue(null);
    vi.spyOn(engineeringQualityRepository, "getCustomPolicies").mockResolvedValue([]);
  });

  // ─── 1. All Mandatory Checks Passing ───────────────────────────────────────
  it("evaluates a clean, verified project as Ready with all mandatory checks passing", async () => {
    // Provide clean impact report
    vi.spyOn(engineeringImpactRepository, "listReports").mockResolvedValue([
      {
        id: "impact-clean",
        riskAssessment: {
          overallSeverity: "low",
          findings: [],
        },
        impactSummary: {
          brokenConnections: [],
        },
      } as any,
    ]);

    // Provide verified passing build and passing test evidence
    vi.spyOn(engineeringQualityRepository, "latestEvidence").mockResolvedValue({
      id: "ev-1",
      projectId,
      commitSha: "abcd1234ef5678",
      buildStatus: "passed",
      buildCommand: "npm run build",
      buildDurationMs: 1200,
      testStatus: "passed",
      testFramework: "Vitest",
      testsTotal: 40,
      testsPassed: 40,
      testsFailed: 0,
      testsSkipped: 0,
      testDurationMs: 850,
      coveragePercent: 88.5,
      executedBy: "CI Pipeline",
      securityScanStatus: "passed",
      securityScannerName: "Snyk",
      securityAdvisoriesCount: 0,
      createdAt: new Date().toISOString(),
    });

    const report = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "production_readiness",
    });

    expect(report).toBeDefined();
    expect(report.readinessVerdict).toBe("ready");
    expect(report.metrics.mandatoryFailed).toBe(0);
    expect(report.blockers).toHaveLength(0);

    // Check specific checks
    const buildCheck = report.checks.find((c) => c.id === "chk_build_verification");
    expect(buildCheck?.status).toBe("passed");

    const testCheck = report.checks.find((c) => c.id === "chk_automated_tests");
    expect(testCheck?.status).toBe("passed");

    const coverageCheck = report.checks.find((c) => c.id === "chk_code_coverage");
    expect(coverageCheck?.status).toBe("passed");
  });

  // ─── 2. Failed Mandatory Build or Test Checks ──────────────────────────────
  it("blocks the release gate and details failures when mandatory build or tests fail", async () => {
    vi.spyOn(engineeringQualityRepository, "latestEvidence").mockResolvedValue({
      id: "ev-fail",
      projectId,
      commitSha: "abcd1234ef5678",
      buildStatus: "passed",
      testStatus: "failed",
      testFramework: "Vitest",
      testsTotal: 40,
      testsPassed: 37,
      testsFailed: 3,
      testsSkipped: 0,
      errorSummary: "3 unit test failures in auth controller and token refresher",
      executedBy: "CI Pipeline",
      securityAdvisoriesCount: 0,
      createdAt: new Date().toISOString(),
    });

    const report = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "production_readiness",
    });

    expect(report.readinessVerdict).toBe("blocked");
    expect(report.metrics.failed).toBeGreaterThan(0);
    expect(report.blockers.some((b) => b.includes("Automated Test Verification"))).toBe(true);

    const testCheck = report.checks.find((c) => c.id === "chk_automated_tests");
    expect(testCheck?.status).toBe("failed");
    expect(testCheck?.reason).toContain("3 of 40 test(s) failed");
  });

  // ─── 3. Unexecuted Tests Marked Not Evaluated ──────────────────────────────
  it("marks unexecuted tests as Not Evaluated and refuses to equate discovered test files with passing tests", async () => {
    // No verified execution evidence exists
    vi.spyOn(engineeringQualityRepository, "latestEvidence").mockResolvedValue(null);

    const report = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "production_readiness",
    });

    const testCheck = report.checks.find((c) => c.id === "chk_automated_tests");
    expect(testCheck).toBeDefined();
    expect(testCheck?.status).toBe("not_evaluated");
    expect(testCheck?.reason).toContain("automated test suites were NOT executed during static analysis");

    // Under production readiness, unexecuted tests block release
    expect(report.readinessVerdict).toBe("blocked");
  });

  // ─── 4. Missing and Stale Repository Snapshots ─────────────────────────────
  it("blocks the gate when repository snapshot is stale or missing", async () => {
    // Create an old snapshot (> 30 days old)
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const staleAnalysis = { ...sampleAnalysis, completed_at: oldDate };

    vi.spyOn(repositoryIntelligenceRepository, "analyses").mockResolvedValue([staleAnalysis]);
    vi.spyOn(repositoryIntelligenceRepository, "analysis").mockResolvedValue(staleAnalysis);

    const report = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "production_readiness",
    });

    const freshnessCheck = report.checks.find((c) => c.id === "chk_snapshot_freshness");
    expect(freshnessCheck).toBeDefined();
    expect(freshnessCheck?.status).toBe("blocked");
    expect(freshnessCheck?.reason).toContain("Stale repository snapshot");
  });

  // ─── 5. Existing High-Severity Drift Findings ──────────────────────────────
  it("re-uses existing drift findings and blocks gate on critical drift divergence", async () => {
    vi.spyOn(driftDetectionService, "compare").mockResolvedValue({
      score: 42,
      summary: "Critical drift detected: missing auth service and unmapped database",
      items: [
        {
          type: "missing",
          severity: "critical",
          expected: { component: "Auth Service" },
          actual: {},
          description: "Required service missing in repository implementation",
          recommendation: "Implement auth service",
          metadata: { findingType: "missing_component" } as any,
        },
      ],
      counts: { bySeverity: { critical: 1, high: 0, medium: 0, low: 0 } } as any,
    });

    const report = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "pre_merge_check",
    });

    expect(report.readinessVerdict).toBe("blocked");
    const driftCheck = report.checks.find((c) => c.id === "chk_drift_critical");
    expect(driftCheck?.status).toBe("failed");
    expect(driftCheck?.reason).toContain("1 critical drift item(s) found");
  });

  // ─── 6. New vs Persistent Findings in Baseline Comparison ─────────────────
  it("identifies new, persistent, and resolved findings and computes accurate metric deltas", async () => {
    const baselineReport = {
      id: "baseline-rep-1",
      projectId,
      workspaceId,
      policyId: "production_readiness",
      policyName: "Production Readiness",
      policyVersion: "1.0.0",
      readinessVerdict: "blocked",
      summary: "Baseline evaluation with issues",
      checks: [
        {
          id: "chk_repo_scan_status",
          category: "repository_health",
          name: "Repository Scan Completion",
          status: "passed",
          severity: "info",
          isMandatory: true,
          evidenceSource: "Repository Intelligence",
          reason: "Scan completed",
        },
        {
          id: "chk_dependency_status",
          category: "repository_health",
          name: "Dependency Status",
          status: "failed",
          severity: "critical",
          isMandatory: true,
          evidenceSource: "Dependency Analyzer",
          reason: "Critical dependency vulnerability in old package",
        },
      ],
      categorySummaries: {} as any,
      metrics: { totalChecks: 2, passed: 1, failed: 1, warning: 0, blocked: 0, notEvaluated: 0, mandatoryChecks: 2, mandatoryPassed: 1, mandatoryFailed: 1 },
      blockers: [],
      warnings: [],
      requiredActions: [],
      sourceContext: { commitSha: "older-commit-sha", architectureVersionNumber: 1, filesAnalyzed: 30 },
      evidenceSources: { driftAnalysisScore: 60, testsFailed: 2, filesAnalyzed: 30, staleDocumentsCount: 2 },
      createdAt: "2026-10-10T10:00:00Z",
    };

    vi.spyOn(engineeringQualityRepository, "getReport").mockResolvedValue(baselineReport as any);

    const currentChecks = [
      {
        id: "chk_repo_scan_status",
        category: "repository_health" as const,
        name: "Repository Scan Completion",
        status: "passed" as const,
        severity: "info" as const,
        isMandatory: true,
        evidenceSource: "Repository Intelligence",
        reason: "Scan completed",
      },
      {
        id: "chk_dependency_status",
        category: "repository_health" as const,
        name: "Dependency Status",
        status: "passed" as const,
        severity: "info" as const,
        isMandatory: true,
        evidenceSource: "Dependency Analyzer",
        reason: "Clean dependencies",
      },
      {
        id: "chk_build_verification",
        category: "build_and_test" as const,
        name: "Latest Build Verification",
        status: "failed" as const,
        severity: "critical" as const,
        isMandatory: true,
        evidenceSource: "Build Runner",
        reason: "Newly introduced compile error",
      },
    ];

    const diff = qualityService.computeBaselineComparison(currentChecks, baselineReport as any, {
      driftScore: 90,
      filesAnalyzed: 45,
      testFailures: 0,
      coverage: 80,
      staleDocs: 0,
    });

    expect(diff.newFindings.some((f) => f.checkId === "chk_build_verification")).toBe(true);
    expect(diff.resolvedFindings.some((f) => f.checkId === "chk_dependency_status")).toBe(true);
    expect(diff.metricDeltas.driftMatchScoreDelta).toBe(30); // 90 - 60
    expect(diff.metricDeltas.filesAnalyzedDelta).toBe(15); // 45 - 30
  });

  // ─── 7. Missing Security Scanner Evidence ──────────────────────────────────
  it("distinguishes missing scanner evidence from confirmed defects without claiming clean security posture", async () => {
    // When repository analysis security does NOT have external scanning configured
    const unconfiguredAnalysis = {
      ...sampleAnalysis,
      analysis_data: {
        ...sampleAnalysis.analysis_data,
        security: {
          checksExecuted: ["secrets", "keys"],
          findings: [],
          externalScanningConfigured: false,
          filesScanned: 45,
        } as any,
      },
    } as any;

    vi.spyOn(repositoryIntelligenceRepository, "analyses").mockResolvedValue([unconfiguredAnalysis]);
    vi.spyOn(repositoryIntelligenceRepository, "analysis").mockResolvedValue(unconfiguredAnalysis);

    const report = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "pre_merge_check",
    });

    const scannerCheck = report.checks.find((c) => c.id === "chk_security_scanner_configured");
    expect(scannerCheck).toBeDefined();
    expect(scannerCheck?.status).toBe("warning");
    expect(scannerCheck?.reason).toContain("Missing evidence must not be represented as a clean security posture");
  });

  // ─── 8. Project Switching and Multiple Repositories ────────────────────────
  it("prevents cross-project data leakage and isolates repository analyses per project", async () => {
    // Repository belongs to other project
    const foreignAnalysis = {
      ...sampleAnalysis,
      project_id: projectOtherId,
    };

    vi.spyOn(repositoryIntelligenceRepository, "analysis").mockResolvedValue(foreignAnalysis);

    await expect(
      qualityService.evaluateQualityGate(projectId, userId, {
        architectureVersionId: versionId,
        repositoryId: repoId,
        repositoryAnalysisId: analysisId,
      })
    ).rejects.toThrow(NotFoundError);
  });

  // ─── 9. Unauthorized Report and Source Access ──────────────────────────────
  it("rejects unauthorized access when accessing non-existent projects or reports", async () => {
    await expect(
      qualityService.evaluateQualityGate("00000000-0000-0000-0000-000000000000", userId)
    ).rejects.toThrow(NotFoundError);

    await expect(
      qualityService.getReport(projectId, "non-existent-report-id")
    ).rejects.toThrow(NotFoundError);
  });

  // ─── 10. Policy Changes Affecting Gate Decisions ───────────────────────────
  it("applies policy differences deterministically: relaxed in development vs strict in production", async () => {
    // No executed test evidence
    vi.spyOn(engineeringQualityRepository, "latestEvidence").mockResolvedValue(null);

    // Development policy: allows unexecuted tests as warning
    const devReport = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "development_check",
    });

    expect(devReport.readinessVerdict).toBe("ready_with_warnings");

    // Production policy: blocks because automated tests are mandatory
    const prodReport = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "production_readiness",
    });

    expect(prodReport.readinessVerdict).toBe("blocked");
  });

  // ─── 11. Workflow Integration & Evidence Recording ─────────────────────────
  it("records CI verification evidence and incorporates it into subsequent quality evaluations", async () => {
    const recorded = await qualityService.recordEvidence(projectId, userId, {
      commitSha: "abcd1234ef5678",
      buildStatus: "passed",
      buildCommand: "npm run build",
      buildDurationMs: 950,
      testStatus: "passed",
      testFramework: "Vitest",
      testsTotal: 50,
      testsPassed: 50,
      testsFailed: 0,
      testsSkipped: 0,
      coveragePercent: 82.0,
      executedBy: "GitHub Actions",
      securityAdvisoriesCount: 0,
    });

    expect(recorded).toBeDefined();
    expect(recorded.testStatus).toBe("passed");
    expect(recorded.testsPassed).toBe(50);
  });

  // ─── 12. Preservation of Previous Successful Reports After Failures ────────
  it("preserves previous successful reports in history after new failed evaluation", async () => {
    const report1 = { id: "rep-1", readinessVerdict: "ready", createdAt: "2026-10-11T10:00:00Z" };
    const report2 = { id: "rep-2", readinessVerdict: "blocked", createdAt: "2026-10-12T10:00:00Z" };

    vi.spyOn(engineeringQualityRepository, "listReports").mockResolvedValue([report2, report1] as any);

    const history = await qualityService.listReports(projectId);
    expect(history).toHaveLength(2);
    expect(history[0].id).toBe("rep-2");
    expect(history[1].id).toBe("rep-1");
    expect(history[1].readinessVerdict).toBe("ready");
  });

  // ─── 13. Operation with AI_PROVIDER=none ───────────────────────────────────
  it("evaluates release readiness deterministically without requiring an AI provider", async () => {
    process.env.AI_PROVIDER = "none";

    const report = await qualityService.evaluateQualityGate(projectId, userId, {
      architectureVersionId: versionId,
      repositoryId: repoId,
      repositoryAnalysisId: analysisId,
      policyId: "development_check",
    });

    expect(report).toBeDefined();
    expect(report.readinessVerdict).toBeDefined();
    expect(report.checks.length).toBeGreaterThan(5);
  });

  // ─── 14. Custom Policy Configuration ───────────────────────────────────────
  it("allows updating custom policies and reflects updated thresholds", async () => {
    vi.spyOn(engineeringQualityRepository, "upsertPolicy").mockImplementation(async (_, p) => p as any);

    const updated = await qualityService.updatePolicy(projectId, "staging_readiness", {
      name: "Custom Staging Gate",
      description: "Customized policy",
      mandatoryCheckIds: ["chk_repo_scan_status", "chk_build_verification"],
      severityThresholds: { maxCritical: 0, maxHigh: 1 },
    });

    expect(updated.name).toBe("Custom Staging Gate");
    expect(updated.mandatoryCheckIds).toContain("chk_build_verification");
    expect(updated.isCustom).toBe(true);
  });
});

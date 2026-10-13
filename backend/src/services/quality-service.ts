import { NotFoundError, ValidationError } from "../errors/app-error.js";
import { projectRepository } from "../repositories/project-repository.js";
import { architectureService } from "./architecture-service.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import { driftDetectionService } from "./drift-service.js";
import { engineeringImpactRepository } from "../repositories/engineering-impact-repository.js";
import { knowledgeGraphRepository } from "../repositories/knowledge-graph-repository.js";
import { engineeringQualityRepository } from "../repositories/engineering-quality-repository.js";
import { supabaseAdmin } from "../lib/supabase.js";
import type {
  QualityGateCategory,
  QualityCheckStatus,
  ReadinessVerdict,
  QualityCheckItem,
  CategorySummary,
  QualityPolicyDefinition,
  QualityReport,
  VerificationEvidenceRecord,
  EvaluateQualityInput,
  QualityProjectContext,
  BaselineComparisonResult,
  FindingReference,
} from "../types/engineering-quality.js";
import type { RepositoryAnalysis, RepositoryRecord } from "../types/repository-intelligence.js";
import type { ArchitectureVersion, ArchitectureNode, ArchitectureEdge } from "../types/architecture.js";
import type { DriftResult, DriftFindingItem } from "./drift-service.js";
import type { KnowledgeGraphCoverage } from "../types/knowledge-graph.js";

export const DEFAULT_QUALITY_POLICIES: QualityPolicyDefinition[] = [
  {
    id: "development_check",
    name: "Development Check",
    description: "Iterative development hygiene gate: verifies baseline architecture and repository scanning without blocking on unexecuted test suites or minor drift.",
    mandatoryCheckIds: [
      "chk_repo_scan_status",
      "chk_architecture_baseline",
    ],
    severityThresholds: {
      maxCritical: 2,
      maxHigh: 5,
    },
  },
  {
    id: "pre_merge_check",
    name: "Pre-merge Check",
    description: "Pull request / pre-merge verification: enforces clean repository scanning, zero critical architecture drift, zero critical security advisories, and impact assessment.",
    mandatoryCheckIds: [
      "chk_repo_scan_status",
      "chk_architecture_baseline",
      "chk_drift_critical",
      "chk_security_critical",
      "chk_impact_assessment",
      "chk_dependency_status",
    ],
    severityThresholds: {
      maxCritical: 0,
      maxHigh: 2,
    },
  },
  {
    id: "staging_readiness",
    name: "Staging Readiness",
    description: "Staging environment readiness gate: requires architecture conformance (>= 70%), zero critical/high security findings, fresh documentation, and verified build.",
    mandatoryCheckIds: [
      "chk_repo_scan_status",
      "chk_architecture_baseline",
      "chk_drift_score",
      "chk_drift_critical",
      "chk_security_critical",
      "chk_security_high",
      "chk_impact_assessment",
      "chk_doc_freshness",
      "chk_dependency_status",
      "chk_build_verification",
    ],
    severityThresholds: {
      maxCritical: 0,
      maxHigh: 1,
    },
  },
  {
    id: "production_readiness",
    name: "Production Readiness",
    description: "Strict production release gate: requires fresh snapshot (< 14 days), high architecture conformance (>= 80%), verified passing build, verified automated tests (0 failures), security scanner configuration, and full component traceability.",
    mandatoryCheckIds: [
      "chk_repo_scan_status",
      "chk_snapshot_freshness",
      "chk_architecture_baseline",
      "chk_drift_score",
      "chk_drift_critical",
      "chk_drift_high",
      "chk_security_critical",
      "chk_security_high",
      "chk_security_scanner_configured",
      "chk_impact_assessment",
      "chk_build_verification",
      "chk_automated_tests",
      "chk_doc_presence",
      "chk_doc_freshness",
      "chk_component_code_traceability",
    ],
    severityThresholds: {
      maxCritical: 0,
      maxHigh: 0,
    },
  },
];

export class QualityService {
  async getPolicies(projectId: string): Promise<QualityPolicyDefinition[]> {
    const custom = await engineeringQualityRepository.getCustomPolicies(projectId);
    const customMap = new Map(custom.map((c) => [c.id, c]));
    return DEFAULT_QUALITY_POLICIES.map((p) => customMap.get(p.id) || p);
  }

  async getPolicy(projectId: string, policyId: string): Promise<QualityPolicyDefinition> {
    const policies = await this.getPolicies(projectId);
    const found = policies.find((p) => p.id === policyId);
    if (!found) {
      throw new NotFoundError(`Quality policy '${policyId}' not found`);
    }
    return found;
  }

  async updatePolicy(
    projectId: string,
    policyId: string,
    input: Omit<QualityPolicyDefinition, "id" | "projectId">
  ): Promise<QualityPolicyDefinition> {
    const policy: QualityPolicyDefinition = {
      id: policyId,
      projectId,
      name: input.name,
      description: input.description,
      mandatoryCheckIds: input.mandatoryCheckIds,
      severityThresholds: input.severityThresholds,
      isCustom: true,
    };
    return await engineeringQualityRepository.upsertPolicy(projectId, policy);
  }

  async getContext(projectId: string): Promise<QualityProjectContext> {
    const project = await projectRepository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");

    const versions = await architectureRepository.versions(projectId);
    const versionDetails = await Promise.all(
      versions.map(async (v) => {
        const nodes = await architectureRepository.nodes(v.id).catch(() => []);
        return {
          id: v.id,
          versionNumber: v.version_number,
          name: v.name || undefined,
          createdAt: v.created_at,
          componentCount: nodes.length,
        };
      })
    );

    const repos = await repositoryIntelligenceRepository.repositories(projectId);
    const repoDetails = await Promise.all(
      repos.map(async (repo) => {
        const rawAnalyses = await repositoryIntelligenceRepository.analyses(projectId, repo.id).catch(() => []);
        return {
          id: repo.id,
          name: repo.repository_name,
          url: repo.repository_url,
          provider: repo.provider,
          defaultBranch: repo.default_branch,
          analyses: rawAnalyses.map((a) => ({
            id: a.id,
            commitSha: a.commit_sha || "",
            branch: (a.analysis_data?.branch as string) || repo.default_branch,
            status: a.status,
            filesAnalyzed: Number(a.analysis_data?.filesAnalyzed || 0),
            createdAt: a.created_at,
            completedAt: a.completed_at,
          })),
        };
      })
    );

    const availablePolicies = await this.getPolicies(projectId);
    const latestReport = await engineeringQualityRepository.latestReport(projectId);
    const latestEvidence = await engineeringQualityRepository.latestEvidence(projectId);

    return {
      projectId,
      workspaceId: project.workspace_id,
      architectureVersions: versionDetails,
      repositories: repoDetails,
      availablePolicies,
      latestReport,
      latestEvidence,
    };
  }

  async recordEvidence(
    projectId: string,
    userId: string,
    input: Omit<Parameters<typeof engineeringQualityRepository.createEvidence>[0], "projectId">
  ): Promise<VerificationEvidenceRecord> {
    const project = await projectRepository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");

    if (input.repositoryId) {
      const repo = await repositoryIntelligenceRepository.repository(projectId, input.repositoryId);
      if (!repo || repo.project_id !== projectId) {
        throw new ValidationError({ repositoryId: "Repository does not belong to this project" });
      }
    }

    return await engineeringQualityRepository.createEvidence({
      ...input,
      projectId,
      createdBy: userId,
    });
  }

  async evaluateQualityGate(
    projectId: string,
    userId: string,
    input: EvaluateQualityInput = {}
  ): Promise<QualityReport> {
    // 1. Verify Project Scope & Workspace
    const project = await projectRepository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");
    const workspaceId = project.workspace_id;

    // 2. Resolve Policy
    const policyId = input.policyId || "production_readiness";
    const policy = await this.getPolicy(projectId, policyId);
    const mandatoryIds = new Set(policy.mandatoryCheckIds);

    // 3. Resolve Architecture Version
    let archVersion: ArchitectureVersion | null = null;
    let archNodes: ArchitectureNode[] = [];
    let archEdges: ArchitectureEdge[] = [];

    if (input.architectureVersionId) {
      const v = await architectureService.getVersion(input.architectureVersionId);
      if (!v || !v.version || v.version.project_id !== projectId) {
        throw new NotFoundError("Architecture version does not belong to this project");
      }
      archVersion = v.version;
      archNodes = v.nodes || [];
      archEdges = v.edges || [];
    } else {
      const current = await architectureService.getCurrent(projectId).catch(() => null);
      if (current && current.version) {
        archVersion = current.version;
        archNodes = current.nodes || [];
        archEdges = current.edges || [];
      } else {
        const latest = await architectureRepository.latest(projectId).catch(() => null);
        if (latest) {
          archVersion = latest;
          archNodes = await architectureRepository.nodes(latest.id).catch(() => []);
          archEdges = await architectureRepository.edges(latest.id).catch(() => []);
        }
      }
    }

    // 4. Resolve Repository & Repository Analysis Snapshot
    let repository: RepositoryRecord | null = null;
    let analysis: RepositoryAnalysis | null = null;
    const projectRepos = await repositoryIntelligenceRepository.repositories(projectId);

    if (input.repositoryId) {
      repository = await repositoryIntelligenceRepository.repository(projectId, input.repositoryId);
      if (!repository || repository.project_id !== projectId) {
        throw new NotFoundError("Repository not found for this project");
      }
    } else if (projectRepos.length > 0) {
      repository = projectRepos[0];
    }

    if (input.repositoryAnalysisId) {
      analysis = await repositoryIntelligenceRepository.analysis(input.repositoryAnalysisId);
      if (!analysis || analysis.project_id !== projectId) {
        throw new NotFoundError("Repository analysis snapshot not found for this project");
      }
    } else if (repository) {
      const analyses = await repositoryIntelligenceRepository.analyses(projectId, repository.id).catch(() => []);
      const completed = analyses.find((a) => a.status === "completed");
      analysis = completed || analyses[0] || null;
    }

    // Check if repository belongs to another project
    if (analysis && analysis.project_id !== projectId) {
      throw new ValidationError({ repositoryAnalysisId: "Repository analysis snapshot does not match project" });
    }

    // 5. Gather Analysis Data from Existing Engines
    // Drift Engine
    let driftResult: DriftResult | null = null;
    let driftScore = 0;
    let driftItems: DriftFindingItem[] = [];
    if (archVersion && analysis && analysis.status === "completed") {
      try {
        driftResult = await driftDetectionService.compare(projectId, archVersion.id, analysis);
        driftScore = Number(driftResult.score || 0);
        driftItems = driftResult.items || [];
      } catch (err: unknown) {
        console.warn("[QualityService] Drift comparison warning:", err instanceof Error ? err.message : err);
      }
    }

    // Impact Engine
    const impactReports = await engineeringImpactRepository.listReports(projectId).catch(() => []);
    const latestImpact = impactReports.length > 0 ? impactReports[0] : null;

    // Knowledge Graph Engine
    let kgCoverage: KnowledgeGraphCoverage | null = null;
    try {
      const kg = await knowledgeGraphRepository.findLatest(projectId);
      if (kg) {
        kgCoverage = kg.coverage;
      }
    } catch {
      // kg is optional, continue
    }

    // Documentation Engine
    const { data: rawDocs } = await supabaseAdmin
      .from("documentation")
      .select()
      .eq("project_id", projectId);
    const documents = rawDocs || [];

    // Verified Execution Evidence (CI or manual test/build run)
    const commitSha = analysis?.commit_sha || null;
    const verifiedEvidence = await engineeringQualityRepository.latestEvidence(projectId, commitSha);

    // 6. Evaluate Normalized Quality Checks
    const checks: QualityCheckItem[] = [];
    const sourceVer = {
      commitSha,
      architectureVersionId: archVersion?.id || null,
      analysisSnapshotId: analysis?.id || null,
      reportId: latestImpact?.id || null,
    };

    // -------------------------------------------------------------------------
    // CATEGORY A: Build and test verification
    // -------------------------------------------------------------------------
    const testRunner = (analysis?.analysis_data?.testRunner as string) || null;
    const testFiles = Array.isArray(analysis?.analysis_data?.testFiles) ? (analysis.analysis_data.testFiles as string[]) : [];

    // Check 1: Latest Build Verification
    if (verifiedEvidence && verifiedEvidence.buildStatus === "passed") {
      checks.push({
        id: "chk_build_verification",
        category: "build_and_test",
        name: "Latest Build Verification",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_build_verification"),
        evidenceSource: `Verified Execution Evidence (${verifiedEvidence.executedBy})`,
        sourceVersion: sourceVer,
        reason: `Build verified successfully (${verifiedEvidence.buildCommand || "build script"}, duration: ${verifiedEvidence.buildDurationMs || 0}ms).`,
        targetRoute: "/repository",
      });
    } else if (verifiedEvidence && verifiedEvidence.buildStatus === "failed") {
      checks.push({
        id: "chk_build_verification",
        category: "build_and_test",
        name: "Latest Build Verification",
        status: "failed",
        severity: "critical",
        isMandatory: mandatoryIds.has("chk_build_verification"),
        evidenceSource: `Verified Execution Evidence (${verifiedEvidence.executedBy})`,
        sourceVersion: sourceVer,
        reason: `Build failed with error: ${verifiedEvidence.buildOutput || verifiedEvidence.errorSummary || "Non-zero exit code"}.`,
        recommendedAction: "Fix compile or bundling errors and rerun build verification.",
        targetRoute: "/repository",
      });
    } else {
      checks.push({
        id: "chk_build_verification",
        category: "build_and_test",
        name: "Latest Build Verification",
        status: "not_evaluated",
        severity: mandatoryIds.has("chk_build_verification") ? "high" : "medium",
        isMandatory: mandatoryIds.has("chk_build_verification"),
        evidenceSource: "Repository Inspection",
        sourceVersion: sourceVer,
        reason: "No verified build execution record found for this commit snapshot. Build scripts in package.json/Dockerfile were not executed in an isolated runtime.",
        recommendedAction: "Run build verification in CI or record verified build result using the quality evidence API.",
        targetRoute: "/repository",
      });
    }

    // Check 2: Automated Test Results
    if (verifiedEvidence && verifiedEvidence.testStatus === "passed" && verifiedEvidence.testsFailed === 0 && verifiedEvidence.testsTotal > 0) {
      checks.push({
        id: "chk_automated_tests",
        category: "build_and_test",
        name: "Automated Test Verification",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_automated_tests"),
        evidenceSource: `Test Runner Evidence (${verifiedEvidence.testFramework || testRunner || "verified"})`,
        sourceVersion: sourceVer,
        reason: `All ${verifiedEvidence.testsPassed} test(s) passed (${verifiedEvidence.testsSkipped} skipped, duration: ${verifiedEvidence.testDurationMs || 0}ms).`,
        targetRoute: "/repository",
      });
    } else if (verifiedEvidence && (verifiedEvidence.testStatus === "failed" || verifiedEvidence.testsFailed > 0)) {
      checks.push({
        id: "chk_automated_tests",
        category: "build_and_test",
        name: "Automated Test Verification",
        status: "failed",
        severity: "critical",
        isMandatory: mandatoryIds.has("chk_automated_tests"),
        evidenceSource: `Test Runner Evidence (${verifiedEvidence.testFramework || testRunner || "verified"})`,
        sourceVersion: sourceVer,
        reason: `${verifiedEvidence.testsFailed} of ${verifiedEvidence.testsTotal} test(s) failed: ${verifiedEvidence.errorSummary || "Test suite failures encountered"}.`,
        recommendedAction: "Resolve test suite failures and record passing verification evidence.",
        targetRoute: "/repository",
      });
    } else {
      checks.push({
        id: "chk_automated_tests",
        category: "build_and_test",
        name: "Automated Test Verification",
        status: "not_evaluated",
        severity: mandatoryIds.has("chk_automated_tests") ? "critical" : "medium",
        isMandatory: mandatoryIds.has("chk_automated_tests"),
        evidenceSource: "Repository Static Scan",
        sourceVersion: sourceVer,
        reason: testFiles.length > 0
          ? `Discovered ${testFiles.length} test file(s) with runner '${testRunner || "detected"}', but automated test suites were NOT executed during static analysis.`
          : "No automated test suites or execution records exist for this snapshot.",
        recommendedAction: "Execute automated tests via CI/CD pipeline and record the verified test run.",
        targetRoute: "/repository",
      });
    }

    // Check 3: Code Coverage
    if (verifiedEvidence && verifiedEvidence.coveragePercent !== null && verifiedEvidence.coveragePercent !== undefined) {
      const cov = verifiedEvidence.coveragePercent;
      if (cov >= 75) {
        checks.push({
          id: "chk_code_coverage",
          category: "build_and_test",
          name: "Test Code Coverage",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_code_coverage"),
          evidenceSource: "Coverage Instrumenter",
          sourceVersion: sourceVer,
          reason: `Verified statement coverage is ${cov.toFixed(1)}% (meets >= 75% target).`,
          targetRoute: "/repository",
        });
      } else {
        checks.push({
          id: "chk_code_coverage",
          category: "build_and_test",
          name: "Test Code Coverage",
          status: "warning",
          severity: "medium",
          isMandatory: mandatoryIds.has("chk_code_coverage"),
          evidenceSource: "Coverage Instrumenter",
          sourceVersion: sourceVer,
          reason: `Verified coverage is ${cov.toFixed(1)}% (below recommended 75% threshold).`,
          recommendedAction: "Add integration tests for uncovered critical path modules.",
          targetRoute: "/repository",
        });
      }
    } else {
      checks.push({
        id: "chk_code_coverage",
        category: "build_and_test",
        name: "Test Code Coverage",
        status: "not_evaluated",
        severity: "low",
        isMandatory: mandatoryIds.has("chk_code_coverage"),
        evidenceSource: "Coverage Instrumenter",
        sourceVersion: sourceVer,
        reason: "No real code coverage instrumentation report uploaded. Coverage cannot be fabricated from file counts.",
        recommendedAction: "Generate lcov or Istanbul coverage report during CI run.",
        targetRoute: "/repository",
      });
    }

    // Check 4: Unexecuted Tests Evidence Gap
    if (!verifiedEvidence && testFiles.length > 0) {
      checks.push({
        id: "chk_unexecuted_tests_gap",
        category: "build_and_test",
        name: "Test Execution Evidence Gap",
        status: "warning",
        severity: "medium",
        isMandatory: mandatoryIds.has("chk_unexecuted_tests_gap"),
        evidenceSource: "Repository Static Scan",
        sourceVersion: sourceVer,
        reason: `${testFiles.length} test file(s) exist in repository but have unverified execution status. Do not equate discovered test files with passing tests.`,
        recommendedAction: "Execute test suite before deploying to staging or release.",
        targetRoute: "/repository",
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY B: Repository Health
    // -------------------------------------------------------------------------
    // Check 5: Repository Scan Completion
    if (analysis && analysis.status === "completed") {
      const filesAnalyzed = Number(analysis.analysis_data?.filesAnalyzed || 0);
      const languages = Object.keys((analysis.languages as Record<string, unknown>) || {});
      checks.push({
        id: "chk_repo_scan_status",
        category: "repository_health",
        name: "Repository Scan Completion & Languages",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_repo_scan_status"),
        evidenceSource: "Repository Intelligence",
        sourceVersion: sourceVer,
        reason: `Static scan completed for commit ${commitSha?.slice(0, 7) || "HEAD"} (${filesAnalyzed} files, languages: ${languages.join(", ") || "detected"}).`,
        targetRoute: "/repository",
      });
    } else if (analysis && analysis.status === "failed") {
      checks.push({
        id: "chk_repo_scan_status",
        category: "repository_health",
        name: "Repository Scan Completion & Languages",
        status: "failed",
        severity: "critical",
        isMandatory: mandatoryIds.has("chk_repo_scan_status"),
        evidenceSource: "Repository Intelligence",
        sourceVersion: sourceVer,
        reason: "Repository analysis snapshot failed or terminated unexpectedly.",
        recommendedAction: "Inspect repository connection and re-run repository analysis.",
        targetRoute: "/repository",
      });
    } else {
      checks.push({
        id: "chk_repo_scan_status",
        category: "repository_health",
        name: "Repository Scan Completion & Languages",
        status: "not_evaluated",
        severity: "critical",
        isMandatory: mandatoryIds.has("chk_repo_scan_status"),
        evidenceSource: "Repository Intelligence",
        sourceVersion: sourceVer,
        reason: "No completed repository analysis snapshot found for this project.",
        recommendedAction: "Connect a repository and trigger analysis scan in Repository Intelligence.",
        targetRoute: "/repository",
      });
    }

    // Check 6: Snapshot Freshness
    if (analysis && analysis.completed_at) {
      const ageMs = Date.now() - new Date(analysis.completed_at).getTime();
      const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
      if (ageDays <= 14) {
        checks.push({
          id: "chk_snapshot_freshness",
          category: "repository_health",
          name: "Repository Snapshot Freshness",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_snapshot_freshness"),
          evidenceSource: "Repository Analysis Metadata",
          sourceVersion: sourceVer,
          reason: `Snapshot is fresh (${ageDays} day(s) old, scanned on ${new Date(analysis.completed_at).toLocaleDateString()}).`,
          targetRoute: "/repository",
        });
      } else if (ageDays <= 30) {
        checks.push({
          id: "chk_snapshot_freshness",
          category: "repository_health",
          name: "Repository Snapshot Freshness",
          status: "warning",
          severity: "medium",
          isMandatory: mandatoryIds.has("chk_snapshot_freshness"),
          evidenceSource: "Repository Analysis Metadata",
          sourceVersion: sourceVer,
          reason: `Repository snapshot is ${ageDays} days old. Code changes may have occurred since last analysis.`,
          recommendedAction: "Trigger a fresh repository analysis scan to ensure up-to-date findings.",
          targetRoute: "/repository",
        });
      } else {
        checks.push({
          id: "chk_snapshot_freshness",
          category: "repository_health",
          name: "Repository Snapshot Freshness",
          status: mandatoryIds.has("chk_snapshot_freshness") ? "blocked" : "warning",
          severity: "high",
          isMandatory: mandatoryIds.has("chk_snapshot_freshness"),
          evidenceSource: "Repository Analysis Metadata",
          sourceVersion: sourceVer,
          reason: `Stale repository snapshot: last analyzed ${ageDays} days ago (> 30 days threshold). Stale snapshots block production gates.`,
          recommendedAction: "Trigger a fresh scan against latest repository commit.",
          targetRoute: "/repository",
        });
      }
    } else {
      checks.push({
        id: "chk_snapshot_freshness",
        category: "repository_health",
        name: "Repository Snapshot Freshness",
        status: "not_evaluated",
        severity: "medium",
        isMandatory: mandatoryIds.has("chk_snapshot_freshness"),
        evidenceSource: "Repository Analysis Metadata",
        sourceVersion: sourceVer,
        reason: "No completed snapshot timestamp available.",
        recommendedAction: "Perform repository scan.",
        targetRoute: "/repository",
      });
    }

    // Check 7: Dependency Analysis Status & Unresolved Dependencies
    const dependencies = Array.isArray(analysis?.dependencies)
      ? (analysis.dependencies as Array<{ name: string; version: string; risk_level?: string; riskLevel?: string }>)
      : [];
    const criticalDeps = dependencies.filter((d) => d.risk_level === "critical" || d.riskLevel === "critical");
    const highDeps = dependencies.filter((d) => d.risk_level === "high" || d.riskLevel === "high");
    const unpinnedDeps = dependencies.filter((d) => d.version === "*" || d.version === "latest");

    if (dependencies.length > 0) {
      if (criticalDeps.length > 0) {
        checks.push({
          id: "chk_dependency_status",
          category: "repository_health",
          name: "Dependency Status & Vulnerabilities",
          status: "failed",
          severity: "critical",
          isMandatory: mandatoryIds.has("chk_dependency_status"),
          evidenceSource: "Dependency Manifest Analyzer",
          sourceVersion: sourceVer,
          reason: `${criticalDeps.length} critical dependency advisory/vulnerability identified (${criticalDeps.map((d) => d.name).slice(0, 3).join(", ")}).`,
          recommendedAction: "Update vulnerable packages in lockfile/manifest.",
          targetRoute: "/dependencies",
        });
      } else if (highDeps.length > 0 || unpinnedDeps.length > 0) {
        checks.push({
          id: "chk_dependency_status",
          category: "repository_health",
          name: "Dependency Status & Vulnerabilities",
          status: "warning",
          severity: "high",
          isMandatory: mandatoryIds.has("chk_dependency_status"),
          evidenceSource: "Dependency Manifest Analyzer",
          sourceVersion: sourceVer,
          reason: `${dependencies.length} dependencies analyzed (${highDeps.length} high risk, ${unpinnedDeps.length} unpinned wildcard versions).`,
          recommendedAction: "Review high-risk dependencies and pin exact versions.",
          targetRoute: "/dependencies",
        });
      } else {
        checks.push({
          id: "chk_dependency_status",
          category: "repository_health",
          name: "Dependency Status & Vulnerabilities",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_dependency_status"),
          evidenceSource: "Dependency Manifest Analyzer",
          sourceVersion: sourceVer,
          reason: `All ${dependencies.length} dependencies parsed without critical vulnerabilities or unpinned versions.`,
          targetRoute: "/dependencies",
        });
      }
    } else {
      checks.push({
        id: "chk_dependency_status",
        category: "repository_health",
        name: "Dependency Status & Vulnerabilities",
        status: "warning",
        severity: "medium",
        isMandatory: mandatoryIds.has("chk_dependency_status"),
        evidenceSource: "Dependency Manifest Analyzer",
        sourceVersion: sourceVer,
        reason: "No dependencies detected or parsed from repository manifests.",
        recommendedAction: "Ensure package.json, requirements.txt, or pom.xml are present in repository.",
        targetRoute: "/dependencies",
      });
    }

    // Check 8: Parsing Limitations & Uninspected Files
    const scanLimitations = Array.isArray(analysis?.analysis_data?.scanLimitations)
      ? (analysis.analysis_data.scanLimitations as string[])
      : [];
    if (scanLimitations.length > 0) {
      checks.push({
        id: "chk_scan_limitations",
        category: "repository_health",
        name: "Parsing Limitations & Uninspected Files",
        status: "warning",
        severity: "low",
        isMandatory: mandatoryIds.has("chk_scan_limitations"),
        evidenceSource: "Static AST Parser",
        sourceVersion: sourceVer,
        reason: `Scan encountered parsing constraints: ${scanLimitations.join("; ")}.`,
        recommendedAction: "Review excluded or large files and adjust scan configuration.",
        targetRoute: "/repository",
      });
    } else {
      checks.push({
        id: "chk_scan_limitations",
        category: "repository_health",
        name: "Parsing Limitations & Uninspected Files",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_scan_limitations"),
        evidenceSource: "Static AST Parser",
        sourceVersion: sourceVer,
        reason: "All repository source files parsed within standard thresholds with 0 limitation notices.",
        targetRoute: "/repository",
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY C: Architecture Conformance
    // -------------------------------------------------------------------------
    // Check 9: Baseline Stored
    if (archVersion && archNodes.length > 0) {
      checks.push({
        id: "chk_architecture_baseline",
        category: "architecture_conformance",
        name: "Architecture Baseline Definition",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_architecture_baseline"),
        evidenceSource: "Architecture Service",
        sourceVersion: sourceVer,
        reason: `Baseline v${archVersion.version_number} active with ${archNodes.length} component(s) and ${archEdges.length} connection(s).`,
        targetRoute: "/workspace",
      });
    } else {
      checks.push({
        id: "chk_architecture_baseline",
        category: "architecture_conformance",
        name: "Architecture Baseline Definition",
        status: "failed",
        severity: "critical",
        isMandatory: mandatoryIds.has("chk_architecture_baseline"),
        evidenceSource: "Architecture Service",
        sourceVersion: sourceVer,
        reason: "No published architecture baseline exists for this project.",
        recommendedAction: "Design and publish an architecture version in Workspace canvas.",
        targetRoute: "/workspace",
      });
    }

    // Check 10: Drift Conformance Score (Reuses existing Drift formula)
    if (driftResult) {
      const requiredScore = policyId === "production_readiness" ? 80 : policyId === "staging_readiness" ? 70 : 50;
      if (driftScore >= requiredScore) {
        checks.push({
          id: "chk_drift_score",
          category: "architecture_conformance",
          name: "Architecture Conformance Score",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_drift_score"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `Conformance match score is ${driftScore}% (meets policy target >= ${requiredScore}%).`,
          targetRoute: "/drift",
        });
      } else {
        checks.push({
          id: "chk_drift_score",
          category: "architecture_conformance",
          name: "Architecture Conformance Score",
          status: mandatoryIds.has("chk_drift_score") ? "failed" : "warning",
          severity: "high",
          isMandatory: mandatoryIds.has("chk_drift_score"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `Conformance score ${driftScore}% is below policy requirement of ${requiredScore}%. ${driftResult.summary}`,
          recommendedAction: "Inspect architecture drift findings and synchronize codebase with architecture canvas.",
          targetRoute: "/drift",
        });
      }
    } else {
      checks.push({
        id: "chk_drift_score",
        category: "architecture_conformance",
        name: "Architecture Conformance Score",
        status: "not_evaluated",
        severity: mandatoryIds.has("chk_drift_score") ? "critical" : "medium",
        isMandatory: mandatoryIds.has("chk_drift_score"),
        evidenceSource: "Architecture Drift Engine",
        sourceVersion: sourceVer,
        reason: "Architecture drift comparison has not been evaluated between baseline and repository snapshot.",
        recommendedAction: "Run drift analysis in Drift view.",
        targetRoute: "/drift",
      });
    }

    // Check 11: Critical Architecture Drift
    const criticalDrift = driftItems.filter((i) => i.severity === "critical");
    const highDrift = driftItems.filter((i) => i.severity === "high");
    if (driftResult) {
      if (criticalDrift.length > 0) {
        checks.push({
          id: "chk_drift_critical",
          category: "architecture_conformance",
          name: "Architecture Drift — Critical Findings",
          status: "failed",
          severity: "critical",
          isMandatory: mandatoryIds.has("chk_drift_critical"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `${criticalDrift.length} critical drift item(s) found (e.g. missing primary components or unmapped database integrations).`,
          recommendedAction: "Resolve critical drift items or update architecture baseline.",
          targetRoute: "/drift",
        });
      } else {
        checks.push({
          id: "chk_drift_critical",
          category: "architecture_conformance",
          name: "Architecture Drift — Critical Findings",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_drift_critical"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: "0 critical architecture drift findings detected.",
          targetRoute: "/drift",
        });
      }

      if (highDrift.length > 0) {
        checks.push({
          id: "chk_drift_high",
          category: "architecture_conformance",
          name: "Architecture Drift — High Findings",
          status: mandatoryIds.has("chk_drift_high") ? "failed" : "warning",
          severity: "high",
          isMandatory: mandatoryIds.has("chk_drift_high"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `${highDrift.length} high-severity drift finding(s) detected.`,
          recommendedAction: "Review high-severity drift items in Drift tab.",
          targetRoute: "/drift",
        });
      } else {
        checks.push({
          id: "chk_drift_high",
          category: "architecture_conformance",
          name: "Architecture Drift — High Findings",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_drift_high"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: "0 high-severity architecture drift findings detected.",
          targetRoute: "/drift",
        });
      }
    }

    // Check 12: Missing Components & Tech Mismatches
    if (driftResult) {
      const missingComponents = driftItems.filter((i) => i.type === "missing");
      const mismatches = driftItems.filter((i) => i.type === "mismatch" || i.metadata?.findingType === "integration_mismatch");
      const extraModules = driftItems.filter((i) => i.type === "extra");
      const uncertain = driftItems.filter((i) => i.type === "uncertain" || i.metadata?.findingType === "coverage_limitation");

      if (missingComponents.length > 0) {
        checks.push({
          id: "chk_missing_components",
          category: "architecture_conformance",
          name: "Expected Architecture Components",
          status: "warning",
          severity: "high",
          isMandatory: mandatoryIds.has("chk_missing_components"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `${missingComponents.length} expected architecture component(s) have no detected implementation in repository.`,
          recommendedAction: "Implement missing components or remove outdated nodes from architecture spec.",
          targetRoute: "/drift",
        });
      }

      if (mismatches.length > 0) {
        checks.push({
          id: "chk_tech_mismatches",
          category: "architecture_conformance",
          name: "Technology & Integration Mismatches",
          status: "warning",
          severity: "medium",
          isMandatory: mandatoryIds.has("chk_tech_mismatches"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `${mismatches.length} technology or communication protocol mismatch(es) detected.`,
          recommendedAction: "Review framework and protocol divergence in Drift view.",
          targetRoute: "/drift",
        });
      }

      if (extraModules.length > 0) {
        checks.push({
          id: "chk_unmapped_modules",
          category: "architecture_conformance",
          name: "Unmapped Repository Modules",
          status: "warning",
          severity: "low",
          isMandatory: mandatoryIds.has("chk_unmapped_modules"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `${extraModules.length} repository module(s) exist without representation on architecture canvas.`,
          recommendedAction: "Map discovered repository modules to canvas components.",
          targetRoute: "/drift",
        });
      }

      if (uncertain.length > 0) {
        checks.push({
          id: "chk_uncertain_mappings",
          category: "architecture_conformance",
          name: "Uncertain Mappings & Analysis Limits",
          status: "warning",
          severity: "low",
          isMandatory: mandatoryIds.has("chk_uncertain_mappings"),
          evidenceSource: "Architecture Drift Engine",
          sourceVersion: sourceVer,
          reason: `${uncertain.length} component mapping(s) classified as uncertain due to heuristic limitations.`,
          recommendedAction: "Perform manual review of uncertain mappings in Drift inspector.",
          targetRoute: "/drift",
        });
      }
    }

    // -------------------------------------------------------------------------
    // CATEGORY D: Security
    // -------------------------------------------------------------------------
    const staticSec = (analysis?.analysis_data?.security as { checksExecuted?: string[]; findings?: Array<{ rule?: string; severity?: string; message?: string; file?: string }>; externalScanningConfigured?: boolean }) || {};
    const staticFindings = Array.isArray(staticSec.findings) ? staticSec.findings : [];
    const criticalSec = staticFindings.filter((f) => f.severity === "critical");
    const highSec = staticFindings.filter((f) => f.severity === "high");
    const externalScannerConfigured = Boolean(staticSec.externalScanningConfigured);

    // Check 13: Static Security Findings
    if (criticalSec.length > 0) {
      checks.push({
        id: "chk_security_critical",
        category: "security",
        name: "Security — Critical Vulnerabilities",
        status: "failed",
        severity: "critical",
        isMandatory: mandatoryIds.has("chk_security_critical"),
        evidenceSource: "Static Security Pattern Scanner",
        sourceVersion: sourceVer,
        reason: `${criticalSec.length} critical security issue(s) detected: ${criticalSec.map((s) => s.message).slice(0, 2).join("; ")}.`,
        recommendedAction: "Remove hardcoded credentials / private keys immediately and rotate exposed secrets.",
        targetRoute: "/repository",
      });
    } else {
      checks.push({
        id: "chk_security_critical",
        category: "security",
        name: "Security — Critical Vulnerabilities",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_security_critical"),
        evidenceSource: "Static Security Pattern Scanner",
        sourceVersion: sourceVer,
        reason: "0 critical static security patterns detected in inspected source code.",
        targetRoute: "/repository",
      });
    }

    if (highSec.length > 0) {
      checks.push({
        id: "chk_security_high",
        category: "security",
        name: "Security — High Severity Advisories",
        status: mandatoryIds.has("chk_security_high") ? "failed" : "warning",
        severity: "high",
        isMandatory: mandatoryIds.has("chk_security_high"),
        evidenceSource: "Static Security Pattern Scanner",
        sourceVersion: sourceVer,
        reason: `${highSec.length} high-severity security advisory item(s) found (e.g. unencrypted env file or permissive access).`,
        recommendedAction: "Review security findings in Repository Intelligence.",
        targetRoute: "/repository",
      });
    } else {
      checks.push({
        id: "chk_security_high",
        category: "security",
        name: "Security — High Severity Advisories",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_security_high"),
        evidenceSource: "Static Security Pattern Scanner",
        sourceVersion: sourceVer,
        reason: "0 high-severity security advisories detected.",
        targetRoute: "/repository",
      });
    }

    // Check 14: Authentication & Authorization Posture
    const authDetected = Boolean(analysis?.architecture?.authentication);
    if (authDetected) {
      checks.push({
        id: "chk_auth_posture",
        category: "security",
        name: "Authentication & Authorization Architecture",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_auth_posture"),
        evidenceSource: "Architecture Intelligence",
        sourceVersion: sourceVer,
        reason: "Authentication mechanism and protected routes detected in repository architecture.",
        targetRoute: "/architecture",
      });
    } else {
      checks.push({
        id: "chk_auth_posture",
        category: "security",
        name: "Authentication & Authorization Architecture",
        status: "warning",
        severity: "medium",
        isMandatory: mandatoryIds.has("chk_auth_posture"),
        evidenceSource: "Architecture Intelligence",
        sourceVersion: sourceVer,
        reason: "No authentication library or login/auth router endpoints detected. Ensure API boundaries are appropriately secured.",
        recommendedAction: "Confirm whether public-only API is intended or configure auth middleware.",
        targetRoute: "/architecture",
      });
    }

    // Check 15: Security Scanner Configuration Distinction
    if (externalScannerConfigured || verifiedEvidence?.securityScanStatus === "passed") {
      checks.push({
        id: "chk_security_scanner_configured",
        category: "security",
        name: "Dedicated Vulnerability Scanner Availability",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_security_scanner_configured"),
        evidenceSource: `External Security Integration (${verifiedEvidence?.securityScannerName || "Configured"})`,
        sourceVersion: sourceVer,
        reason: "External vulnerability scanner is configured and verified.",
        targetRoute: "/repository",
      });
    } else {
      checks.push({
        id: "chk_security_scanner_configured",
        category: "security",
        name: "Dedicated Vulnerability Scanner Availability",
        status: mandatoryIds.has("chk_security_scanner_configured") ? "warning" : "warning",
        severity: "medium",
        isMandatory: mandatoryIds.has("chk_security_scanner_configured"),
        evidenceSource: "Platform Security Integrations",
        sourceVersion: sourceVer,
        reason: "No external vulnerability scanner (e.g. Snyk, Trivy, Dependabot, SonarQube) configured. ArchForge's static pattern checks alone do not constitute a full CVE security scan. Missing evidence must not be represented as a clean security posture.",
        recommendedAction: "Connect an external security scanner to provide comprehensive CVE evidence.",
        targetRoute: "/repository",
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY E: Change Impact
    // -------------------------------------------------------------------------
    if (latestImpact) {
      const riskLevel = latestImpact.riskAssessment?.overallSeverity || "low";
      const criticalRisks = latestImpact.riskAssessment?.findings?.filter((f) => f.severity === "critical") || [];
      const highRisks = latestImpact.riskAssessment?.findings?.filter((f) => f.severity === "high") || [];
      const breakingChangeFindings = latestImpact.riskAssessment?.findings?.filter((f) => f.category === "breaking_change" || f.category === "public_api_compatibility") || [];
      const unvalidatedBroken = latestImpact.impactSummary?.brokenConnections || [];

      if (criticalRisks.length > 0 || riskLevel === "critical") {
        checks.push({
          id: "chk_impact_assessment",
          category: "change_impact",
          name: "Engineering Impact Risk Assessment",
          status: "failed",
          severity: "critical",
          isMandatory: mandatoryIds.has("chk_impact_assessment"),
          evidenceSource: `Engineering Impact Analysis (${latestImpact.id.slice(0, 8)})`,
          sourceVersion: sourceVer,
          reason: `${criticalRisks.length} critical engineering risk(s) identified in proposed change plan: ${criticalRisks.slice(0, 2).map((r) => r.title).join("; ")}.`,
          recommendedAction: "Review risk mitigation steps in Impact Analysis before merge.",
          targetRoute: "/impact",
        });
      } else if (highRisks.length > 0 || riskLevel === "high") {
        checks.push({
          id: "chk_impact_assessment",
          category: "change_impact",
          name: "Engineering Impact Risk Assessment",
          status: mandatoryIds.has("chk_impact_assessment") ? "warning" : "warning",
          severity: "high",
          isMandatory: mandatoryIds.has("chk_impact_assessment"),
          evidenceSource: `Engineering Impact Analysis (${latestImpact.id.slice(0, 8)})`,
          sourceVersion: sourceVer,
          reason: `${highRisks.length} high engineering risk(s) identified in impact assessment.`,
          recommendedAction: "Address high risks and review proposed change plan.",
          targetRoute: "/impact",
        });
      } else {
        checks.push({
          id: "chk_impact_assessment",
          category: "change_impact",
          name: "Engineering Impact Risk Assessment",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_impact_assessment"),
          evidenceSource: `Engineering Impact Analysis (${latestImpact.id.slice(0, 8)})`,
          sourceVersion: sourceVer,
          reason: `Impact assessment verified with '${riskLevel}' risk level and 0 blocking risks.`,
          targetRoute: "/impact",
        });
      }

      if (breakingChangeFindings.length > 0) {
        checks.push({
          id: "chk_api_compatibility",
          category: "change_impact",
          name: "API Compatibility & Breaking Changes",
          status: "warning",
          severity: "high",
          isMandatory: mandatoryIds.has("chk_api_compatibility"),
          evidenceSource: "Impact Analysis Blast Radius",
          sourceVersion: sourceVer,
          reason: `${breakingChangeFindings.length} potential API compatibility / breaking change issue(s) detected across related routes.`,
          recommendedAction: "Provide API backward compatibility layer or versioning.",
          targetRoute: "/impact",
        });
      }

      if (unvalidatedBroken.length > 0) {
        checks.push({
          id: "chk_affected_components_validation",
          category: "change_impact",
          name: "Affected Components Validation Evidence",
          status: "warning",
          severity: "medium",
          isMandatory: mandatoryIds.has("chk_affected_components_validation"),
          evidenceSource: "Impact Analysis Coverage",
          sourceVersion: sourceVer,
          reason: `${unvalidatedBroken.length} connection(s) broken or modified requiring validation evidence.`,
          recommendedAction: "Add targeted automated tests covering affected blast radius.",
          targetRoute: "/impact",
        });
      }
    } else {
      checks.push({
        id: "chk_impact_assessment",
        category: "change_impact",
        name: "Engineering Impact Risk Assessment",
        status: mandatoryIds.has("chk_impact_assessment") ? "not_evaluated" : "passed",
        severity: mandatoryIds.has("chk_impact_assessment") ? "medium" : "info",
        isMandatory: mandatoryIds.has("chk_impact_assessment"),
        evidenceSource: "Engineering Impact Service",
        sourceVersion: sourceVer,
        reason: "No planned change impact analysis has been executed for this baseline.",
        recommendedAction: "Run Impact Analysis if breaking changes or refactoring are proposed.",
        targetRoute: "/impact",
      });
    }

    // -------------------------------------------------------------------------
    // CATEGORY F: Documentation and Traceability
    // -------------------------------------------------------------------------
    let staleDocCount = 0;
    for (const d of documents) {
      if (archVersion && d.source_version_id && d.source_version_id !== archVersion.id) {
        staleDocCount++;
      } else if (analysis && d.source_repository_analysis_id && d.source_repository_analysis_id !== analysis.id) {
        staleDocCount++;
      } else if (d.status === "outdated") {
        staleDocCount++;
      }
    }

    // Check 16: Documentation Presence
    if (documents.length > 0) {
      checks.push({
        id: "chk_doc_presence",
        category: "documentation_traceability",
        name: "System Documentation Presence",
        status: "passed",
        severity: "info",
        isMandatory: mandatoryIds.has("chk_doc_presence"),
        evidenceSource: "Documentation Intelligence",
        sourceVersion: sourceVer,
        reason: `${documents.length} system specification document(s) generated.`,
        targetRoute: "/documentation",
      });
    } else {
      checks.push({
        id: "chk_doc_presence",
        category: "documentation_traceability",
        name: "System Documentation Presence",
        status: mandatoryIds.has("chk_doc_presence") ? "failed" : "warning",
        severity: mandatoryIds.has("chk_doc_presence") ? "high" : "medium",
        isMandatory: mandatoryIds.has("chk_doc_presence"),
        evidenceSource: "Documentation Intelligence",
        sourceVersion: sourceVer,
        reason: "No system documentation or API specifications exist for this project.",
        recommendedAction: "Generate system documentation in Documentation Intelligence.",
        targetRoute: "/documentation",
      });
    }

    // Check 17: Documentation Freshness
    if (documents.length > 0) {
      if (staleDocCount > 0) {
        checks.push({
          id: "chk_doc_freshness",
          category: "documentation_traceability",
          name: "Documentation Freshness Relative to Sources",
          status: mandatoryIds.has("chk_doc_freshness") ? "warning" : "warning",
          severity: "medium",
          isMandatory: mandatoryIds.has("chk_doc_freshness"),
          evidenceSource: "Documentation Intelligence",
          sourceVersion: sourceVer,
          reason: `${staleDocCount} of ${documents.length} document(s) are stale relative to current architecture version or commit SHA.`,
          recommendedAction: "Regenerate outdated documents in Documentation view.",
          targetRoute: "/documentation",
        });
      } else {
        checks.push({
          id: "chk_doc_freshness",
          category: "documentation_traceability",
          name: "Documentation Freshness Relative to Sources",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_doc_freshness"),
          evidenceSource: "Documentation Intelligence",
          sourceVersion: sourceVer,
          reason: `All ${documents.length} document(s) are aligned with latest architecture and repository snapshots.`,
          targetRoute: "/documentation",
        });
      }
    }

    // Check 18: Component to Code Traceability (Knowledge Graph)
    if (kgCoverage) {
      const overallCov = Number(kgCoverage.overallCoveragePercentage || 0);
      const totalComps = Number(kgCoverage.totalComponents || 0);
      const mappedComps = Number(kgCoverage.mappedComponentsCount || 0);
      const compCov = totalComps > 0 ? Math.round((mappedComps / totalComps) * 100) : 100;

      if (overallCov >= 70 && compCov >= 70) {
        checks.push({
          id: "chk_component_code_traceability",
          category: "documentation_traceability",
          name: "Architecture to Code Traceability",
          status: "passed",
          severity: "info",
          isMandatory: mandatoryIds.has("chk_component_code_traceability"),
          evidenceSource: "Engineering Knowledge Graph",
          sourceVersion: sourceVer,
          reason: `Verified ${compCov}% component code mapping (${mappedComps}/${totalComps}) and ${overallCov}% overall graph traceability.`,
          targetRoute: "/knowledge-graph",
        });
      } else {
        checks.push({
          id: "chk_component_code_traceability",
          category: "documentation_traceability",
          name: "Architecture to Code Traceability",
          status: mandatoryIds.has("chk_component_code_traceability") ? "warning" : "warning",
          severity: "medium",
          isMandatory: mandatoryIds.has("chk_component_code_traceability"),
          evidenceSource: "Engineering Knowledge Graph",
          sourceVersion: sourceVer,
          reason: `Traceability coverage is ${overallCov}% (component mapping: ${compCov}%). Important components lack verified code bindings.`,
          recommendedAction: "Map components to source files in Knowledge Graph.",
          targetRoute: "/knowledge-graph",
        });
      }
    } else {
      checks.push({
        id: "chk_component_code_traceability",
        category: "documentation_traceability",
        name: "Architecture to Code Traceability",
        status: mandatoryIds.has("chk_component_code_traceability") ? "not_evaluated" : "passed",
        severity: "low",
        isMandatory: mandatoryIds.has("chk_component_code_traceability"),
        evidenceSource: "Engineering Knowledge Graph",
        sourceVersion: sourceVer,
        reason: "Knowledge Graph traceability has not been calculated.",
        recommendedAction: "Generate Knowledge Graph snapshot.",
        targetRoute: "/knowledge-graph",
      });
    }

    // -------------------------------------------------------------------------
    // 7. Deterministic Decision & Category Summaries Computation
    // -------------------------------------------------------------------------
    const blockers: string[] = [];
    const warnings: string[] = [];
    const requiredActions: QualityReport["requiredActions"] = [];

    const categories: QualityGateCategory[] = [
      "build_and_test",
      "repository_health",
      "architecture_conformance",
      "security",
      "change_impact",
      "documentation_traceability",
    ];

    const categoryTitles: Record<QualityGateCategory, string> = {
      build_and_test: "Build & Test Verification",
      repository_health: "Repository Health",
      architecture_conformance: "Architecture Conformance",
      security: "Security",
      change_impact: "Change Impact",
      documentation_traceability: "Documentation & Traceability",
    };

    const categorySummaries = {} as Record<QualityGateCategory, CategorySummary>;

    for (const cat of categories) {
      const catChecks = checks.filter((c) => c.category === cat);
      const passed = catChecks.filter((c) => c.status === "passed").length;
      const failed = catChecks.filter((c) => c.status === "failed").length;
      const warning = catChecks.filter((c) => c.status === "warning").length;
      const blocked = catChecks.filter((c) => c.status === "blocked").length;
      const notEvaluated = catChecks.filter((c) => c.status === "not_evaluated").length;

      const mandatoryChecks = catChecks.filter((c) => c.isMandatory);
      const mandatoryPassed = mandatoryChecks.filter((c) => c.status === "passed").length;

      let catStatus: QualityCheckStatus = "passed";
      if (failed > 0) catStatus = "failed";
      else if (blocked > 0) catStatus = "blocked";
      else if (warning > 0) catStatus = "warning";
      else if (notEvaluated > 0) catStatus = "not_evaluated";

      categorySummaries[cat] = {
        category: cat,
        title: categoryTitles[cat],
        status: catStatus,
        passed,
        failed,
        warning,
        blocked,
        notEvaluated,
        mandatoryPassed,
        mandatoryTotal: mandatoryChecks.length,
        summary: `${passed}/${catChecks.length} checks passed (${mandatoryPassed}/${mandatoryChecks.length} mandatory).`,
      };
    }

    // Gather Blockers, Warnings, Actions
    for (const c of checks) {
      if (c.status === "failed") {
        if (c.isMandatory) {
          blockers.push(`[${c.name}] Failed mandatory check: ${c.reason}`);
        } else {
          warnings.push(`[${c.name}] Check failed: ${c.reason}`);
        }
        if (c.recommendedAction) {
          requiredActions.push({
            checkId: c.id,
            action: c.recommendedAction,
            targetRoute: c.targetRoute,
            severity: c.severity,
          });
        }
      } else if (c.status === "blocked") {
        blockers.push(`[${c.name}] Blocked: ${c.reason}`);
        if (c.recommendedAction) {
          requiredActions.push({
            checkId: c.id,
            action: c.recommendedAction,
            targetRoute: c.targetRoute,
            severity: c.severity,
          });
        }
      } else if (c.status === "not_evaluated" && c.isMandatory) {
        blockers.push(`[${c.name}] Mandatory check is not evaluated: ${c.reason}`);
        if (c.recommendedAction) {
          requiredActions.push({
            checkId: c.id,
            action: c.recommendedAction,
            targetRoute: c.targetRoute,
            severity: c.severity,
          });
        }
      } else if (c.status === "warning") {
        warnings.push(`[${c.name}] ${c.reason}`);
        if (c.recommendedAction) {
          requiredActions.push({
            checkId: c.id,
            action: c.recommendedAction,
            targetRoute: c.targetRoute,
            severity: c.severity,
          });
        }
      }
    }

    // Overall Verdict Determination
    let readinessVerdict: ReadinessVerdict = "ready";
    let summaryText = "";

    const passedCount = checks.filter((c) => c.status === "passed").length;
    const failedCount = checks.filter((c) => c.status === "failed").length;
    const warningCount = checks.filter((c) => c.status === "warning").length;
    const blockedCount = checks.filter((c) => c.status === "blocked").length;
    const notEvaluatedCount = checks.filter((c) => c.status === "not_evaluated").length;

    const mandatoryChecks = checks.filter((c) => c.isMandatory);
    const mandatoryPassedCount = mandatoryChecks.filter((c) => c.status === "passed").length;
    const mandatoryFailedCount = mandatoryChecks.filter((c) => c.status === "failed" || c.status === "blocked" || c.status === "not_evaluated").length;

    if (!archVersion || !analysis) {
      readinessVerdict = "not_evaluated";
      summaryText = "Evaluation incomplete: Select a valid architecture version and repository snapshot.";
    } else if (blockers.length > 0 || mandatoryFailedCount > 0) {
      readinessVerdict = "blocked";
      summaryText = `Release gate BLOCKED by ${blockers.length} mandatory issue(s): ${blockers[0]}`;
    } else if (warningCount > 0) {
      readinessVerdict = "ready_with_warnings";
      summaryText = `Ready with warnings. All ${mandatoryChecks.length} mandatory checks passed, but ${warningCount} advisory issue(s) require engineering attention: ${warnings[0]}`;
    } else {
      readinessVerdict = "ready";
      summaryText = `All ${checks.length} evidence checks passed with 0 blocking or warning issues under ${policy.name}.`;
    }

    // -------------------------------------------------------------------------
    // 8. Baseline Comparison
    // -------------------------------------------------------------------------
    let baselineComparison: BaselineComparisonResult | null = null;
    let baselineReport: QualityReport | null = null;

    if (input.baselineQualityReportId) {
      baselineReport = await engineeringQualityRepository.getReport(projectId, input.baselineQualityReportId);
      if (!baselineReport || baselineReport.projectId !== projectId) {
        throw new ValidationError({ baselineQualityReportId: "Baseline quality report does not belong to this project" });
      }
    } else {
      // Find latest previous report for project
      const pastReports = await engineeringQualityRepository.listReports(projectId);
      if (pastReports.length > 0) {
        baselineReport = pastReports[0];
      }
    }

    if (baselineReport) {
      baselineComparison = this.computeBaselineComparison(checks, baselineReport, {
        driftScore,
        filesAnalyzed: Number(analysis?.analysis_data?.filesAnalyzed || 0),
        testFailures: verifiedEvidence ? verifiedEvidence.testsFailed : 0,
        coverage: verifiedEvidence ? verifiedEvidence.coveragePercent : null,
        staleDocs: staleDocCount,
      });
    }

    // -------------------------------------------------------------------------
    // 9. Persist Quality Report
    // -------------------------------------------------------------------------
    const metrics = {
      totalChecks: checks.length,
      passed: passedCount,
      failed: failedCount,
      warning: warningCount,
      blocked: blockedCount,
      notEvaluated: notEvaluatedCount,
      mandatoryChecks: mandatoryChecks.length,
      mandatoryPassed: mandatoryPassedCount,
      mandatoryFailed: mandatoryFailedCount,
    };

    const sourceContext = {
      projectName: project.name,
      repositoryName: repository?.repository_name,
      branch: (analysis?.analysis_data?.branch as string) || repository?.default_branch || "main",
      commitSha: commitSha || "HEAD",
      architectureVersionNumber: archVersion?.version_number,
      analysisTimestamp: analysis?.completed_at || new Date().toISOString(),
    };

    const evidenceSources = {
      architectureVersionId: archVersion?.id || null,
      repositoryId: repository?.id || null,
      repositoryAnalysisId: analysis?.id || null,
      filesAnalyzed: Number(analysis?.analysis_data?.filesAnalyzed || 0),
      driftAnalysisScore: driftScore,
      driftItemsCount: driftItems.length,
      impactReportId: latestImpact?.id || null,
      testEvidenceId: verifiedEvidence?.id || null,
      testFramework: verifiedEvidence?.testFramework || testRunner,
      testsTotal: verifiedEvidence?.testsTotal || 0,
      testsPassed: verifiedEvidence?.testsPassed || 0,
      testsFailed: verifiedEvidence?.testsFailed || 0,
      coveragePercent: verifiedEvidence?.coveragePercent || null,
      documentsCount: documents.length,
      staleDocumentsCount: staleDocCount,
      kgOverallCoverage: kgCoverage?.overallCoveragePercentage || null,
    };

    const savedReport = await engineeringQualityRepository.createReport({
      projectId,
      workspaceId,
      architectureVersionId: archVersion?.id || null,
      repositoryId: repository?.id || null,
      repositoryAnalysisId: analysis?.id || null,
      baselineArchitectureVersionId: input.baselineArchitectureVersionId || baselineReport?.architectureVersionId || null,
      baselineRepositoryAnalysisId: input.baselineRepositoryAnalysisId || baselineReport?.repositoryAnalysisId || null,
      baselineQualityReportId: baselineReport?.id || null,
      policyId: policy.id,
      policyName: policy.name,
      policyVersion: "1.0.0",
      readinessVerdict,
      summary: summaryText,
      checks,
      categorySummaries,
      metrics,
      blockers,
      warnings,
      requiredActions,
      baselineComparison,
      sourceContext,
      evidenceSources,
      createdBy: userId,
    });

    return savedReport;
  }

  computeBaselineComparison(
    currentChecks: QualityCheckItem[],
    baselineReport: QualityReport,
    metrics: {
      driftScore: number;
      filesAnalyzed: number;
      testFailures: number;
      coverage?: number | null;
      staleDocs: number;
    }
  ): BaselineComparisonResult {
    const baselineCheckMap = new Map<string, QualityCheckItem>();
    for (const c of baselineReport.checks) {
      baselineCheckMap.set(c.id, c);
    }

    const currentNonPass = currentChecks.filter((c) => c.status !== "passed");
    const baselineNonPass = baselineReport.checks.filter((c) => c.status !== "passed");

    const newFindings: FindingReference[] = [];
    const persistentFindings: FindingReference[] = [];
    const severityChanges: BaselineComparisonResult["severityChanges"] = [];

    for (const c of currentNonPass) {
      const b = baselineCheckMap.get(c.id);
      if (!b || b.status === "passed") {
        newFindings.push({
          key: c.id,
          checkId: c.id,
          name: c.name,
          severity: c.severity,
          category: c.category,
          message: c.reason,
        });
      } else {
        persistentFindings.push({
          key: c.id,
          checkId: c.id,
          name: c.name,
          severity: c.severity,
          category: c.category,
          message: c.reason,
        });
        if (c.severity !== b.severity) {
          severityChanges.push({
            key: c.id,
            checkId: c.id,
            name: c.name,
            previousSeverity: b.severity,
            currentSeverity: c.severity,
          });
        }
      }
    }

    const currentCheckIds = new Set(currentNonPass.map((c) => c.id));
    const resolvedFindings: FindingReference[] = [];
    for (const b of baselineNonPass) {
      if (!currentCheckIds.has(b.id)) {
        resolvedFindings.push({
          key: b.id,
          checkId: b.id,
          name: b.name,
          severity: b.severity,
          category: b.category,
          message: `Resolved: ${b.reason}`,
        });
      }
    }

    // Metric deltas
    const prevDrift = Number(baselineReport.evidenceSources?.driftAnalysisScore ?? 0);
    const driftMatchScoreDelta = metrics.driftScore - prevDrift;

    const prevFiles = Number(baselineReport.evidenceSources?.filesAnalyzed ?? 0);
    const filesAnalyzedDelta = metrics.filesAnalyzed - prevFiles;

    const prevFailures = Number(baselineReport.evidenceSources?.testsFailed ?? 0);
    const testFailuresDelta = metrics.testFailures - prevFailures;

    const prevCov = baselineReport.evidenceSources?.coveragePercent !== null && baselineReport.evidenceSources?.coveragePercent !== undefined
      ? Number(baselineReport.evidenceSources.coveragePercent)
      : null;
    const coverageDelta = metrics.coverage !== null && metrics.coverage !== undefined && prevCov !== null
      ? metrics.coverage - prevCov
      : null;

    const prevStale = Number(baselineReport.evidenceSources?.staleDocumentsCount ?? 0);
    const staleDocsDelta = metrics.staleDocs - prevStale;

    const totalFindingsDelta = currentNonPass.length - baselineNonPass.length;

    let summary = `Comparison with baseline (${baselineReport.id.slice(0, 8)}): `;
    summary += `${newFindings.length} new finding(s), ${resolvedFindings.length} resolved, ${persistentFindings.length} persistent. `;
    if (driftMatchScoreDelta !== 0) {
      summary += `Drift score: ${driftMatchScoreDelta >= 0 ? "+" : ""}${driftMatchScoreDelta}%. `;
    }

    return {
      baselineReportId: baselineReport.id,
      baselineCommitSha: baselineReport.sourceContext?.commitSha || null,
      baselineArchitectureVersion: baselineReport.sourceContext?.architectureVersionNumber || null,
      newFindings,
      resolvedFindings,
      persistentFindings,
      severityChanges,
      metricDeltas: {
        driftMatchScoreDelta,
        filesAnalyzedDelta: filesAnalyzedDelta !== 0 ? filesAnalyzedDelta : undefined,
        testFailuresDelta: testFailuresDelta !== 0 ? testFailuresDelta : undefined,
        coverageDelta: coverageDelta !== null ? coverageDelta : undefined,
        totalFindingsDelta,
        staleDocsDelta: staleDocsDelta !== 0 ? staleDocsDelta : undefined,
      },
      summary,
    };
  }

  async listReports(projectId: string): Promise<QualityReport[]> {
    return await engineeringQualityRepository.listReports(projectId);
  }

  async getReport(projectId: string, reportId: string): Promise<QualityReport> {
    const report = await engineeringQualityRepository.getReport(projectId, reportId);
    if (!report) {
      throw new NotFoundError("Quality report not found");
    }
    return report;
  }
}

export const qualityService = new QualityService();

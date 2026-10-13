import { NotFoundError, ValidationError } from "../errors/app-error.js";
import { projectRepository } from "../repositories/project-repository.js";
import { architectureService } from "./architecture-service.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import { driftDetectionService } from "./drift-service.js";
import { engineeringImpactRepository } from "../repositories/engineering-impact-repository.js";
import { engineeringRepository } from "../repositories/engineering-intelligence-repository.js";
import { workflowOrchestrationRepository } from "../repositories/workflow-orchestration-repository.js";
import { workflowReadinessService } from "./workflow-readiness-service.js";
import type {
  RunWorkflowInput,
  WorkflowFinding,
  WorkflowProjectContext,
  WorkflowRun,
  WorkflowRunSummary,
  WorkflowSourceContext,
  WorkflowStageKey,
  WorkflowStageResult,
} from "../types/workflow-orchestration.js";
import type { ArchitectureEdge, ArchitectureNode, ArchitectureVersion } from "../types/architecture.js";
import type { RepositoryAnalysis, RepositoryRecord } from "../types/repository-intelligence.js";
import type { ImpactReport, RiskFinding } from "../types/engineering-impact.js";
import type { PlaygroundSimulation } from "../types/engineering-intelligence.js";

export class WorkflowOrchestrationService {
  async getContext(projectId: string): Promise<WorkflowProjectContext> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const versions = await architectureRepository.versions(projectId);
    const versionDetails = await Promise.all(
      versions.map(async (v) => {
        const [nodes, edges] = await Promise.all([
          architectureRepository.nodes(v.id).catch(() => []),
          architectureRepository.edges(v.id).catch(() => []),
        ]);
        return {
          id: v.id,
          versionNumber: v.version_number,
          name: v.name,
          status: v.status,
          createdAt: v.created_at,
          nodeCount: nodes.length,
          edgeCount: edges.length,
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
          status: repo.status || "active",
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

    const latestRun = await workflowOrchestrationRepository.latestRun(projectId);

    return {
      projectId,
      workspaceId: project.workspace_id,
      architectureVersions: versionDetails,
      repositories: repoDetails,
      latestRun,
    };
  }

  async executeWorkflow(
    projectId: string,
    userId: string,
    input: RunWorkflowInput = {}
  ): Promise<WorkflowRun> {
    // 1. Validate Project & Workspace
    const projectRow = await projectRepository.findById(projectId);
    if (!projectRow) {
      throw new NotFoundError("Project not found");
    }
    const workspaceId = projectRow.workspace_id;

    // 2. Resolve Architecture Version
    let archVersion: ArchitectureVersion | null = null;
    let archNodes: ArchitectureNode[] = [];
    let archEdges: ArchitectureEdge[] = [];

    if (input.architectureVersionId) {
      const v = await architectureService.getVersion(input.architectureVersionId);
      if (!v || !v.version || v.version.project_id !== projectId) {
        throw new NotFoundError("Architecture version not found for this project");
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

    // 3. Resolve Repository Context
    let repository: RepositoryRecord | null = null;
    const projectRepos = await repositoryIntelligenceRepository.repositories(projectId);

    if (input.repositoryId) {
      repository = await repositoryIntelligenceRepository.repository(projectId, input.repositoryId);
      if (!repository || repository.project_id !== projectId) {
        throw new NotFoundError("Repository not found for this project");
      }
    } else if (projectRepos.length > 0) {
      repository = projectRepos[0];
    }

    // 4. Resolve Repository Analysis Snapshot
    let analysis: RepositoryAnalysis | null = null;
    if (input.repositoryAnalysisId) {
      analysis = await repositoryIntelligenceRepository.analysis(input.repositoryAnalysisId);
      if (!analysis || analysis.project_id !== projectId) {
        throw new NotFoundError("Repository analysis snapshot not found for this project");
      }
      if (repository && analysis.repository_id && analysis.repository_id !== repository.id) {
        throw new ValidationError({
          repository: "The selected repository analysis snapshot does not belong to the selected repository.",
        });
      }
    } else if (repository) {
      analysis = await repositoryIntelligenceRepository.latestSuccessful(projectId, repository.id);
      if (!analysis) {
        analysis = await repositoryIntelligenceRepository.latestAnalysis(projectId, repository.id);
      }
    }

    // 5. Evaluate Stage A — Architecture
    const stageA = this.evaluateStageA(archVersion, archNodes, archEdges);

    // 6. Evaluate Stage B — Repository Intelligence
    const stageB = this.evaluateStageB(repository, analysis);

    // 7. Evaluate Stage C — Architecture Drift
    const stageC = await this.evaluateStageC(projectId, archVersion, analysis, repository, input.forceRerun);

    // 8. Evaluate Stage D — Engineering Impact Analysis
    const stageD = await this.evaluateStageD(projectId, archVersion, analysis);

    // 9. Evaluate Stage E — Engineering Playground
    const stageE = await this.evaluateStageE(projectId, archVersion);

    // 10. Evaluate Stage F — Documentation Intelligence
    const stageF = await this.evaluateStageF(projectId, archVersion, analysis);

    // 11. Evaluate Stage G — Verification & Testing Readiness
    const stageG = this.evaluateStageG(analysis);

    const stages: Record<WorkflowStageKey, WorkflowStageResult> = {
      stage_a_architecture: stageA,
      stage_b_repository: stageB,
      stage_c_drift: stageC,
      stage_d_impact: stageD,
      stage_e_playground: stageE,
      stage_f_documentation: stageF,
      stage_g_verification: stageG,
    };

    // 12. Evaluate Readiness Gate
    const readinessGate = workflowReadinessService.evaluate(stages);

    // 13. Build Summary & Source Context
    const stageList = Object.values(stages);
    const completedStages = stageList.filter((s) => s.status === "completed").length;
    const failedStages = stageList.filter((s) => s.status === "failed").length;
    const stagesNeedingAttention = stageList.filter((s) => s.status === "needs_attention").length;
    const reusedStages = stageList.filter((s) => s.reused).length;
    const staleStages = stageList.filter((s) => s.isStale).length;

    const summary: WorkflowRunSummary = {
      totalStages: stageList.length,
      completedStages,
      failedStages,
      stagesNeedingAttention,
      reusedStages,
      staleStages,
      overallVerdict: readinessGate.decision,
      primaryNextStep: readinessGate.nextSteps[0] || stageA.recommendedNextAction.action,
    };

    const sourceContext: WorkflowSourceContext = {
      architectureVersionId: archVersion?.id || null,
      architectureVersionNumber: archVersion?.version_number || null,
      architectureVersionName: archVersion?.name || null,
      repositoryId: repository?.id || null,
      repositoryName: repository?.repository_name || null,
      repositoryAnalysisId: analysis?.id || null,
      branch: (analysis?.analysis_data?.branch as string) || repository?.default_branch || input.branch || null,
      commitSha: analysis?.commit_sha || null,
      scannedAt: analysis?.completed_at || null,
    };

    let runStatus: WorkflowRun["status"] = "completed";
    if (failedStages > 0) runStatus = "failed";
    else if (stagesNeedingAttention > 0) runStatus = "needs_attention";

    // 14. Persist Workflow Run
    return workflowOrchestrationRepository.createRun({
      projectId,
      workspaceId,
      architectureVersionId: archVersion?.id || null,
      repositoryId: repository?.id || null,
      repositoryAnalysisId: analysis?.id || null,
      branch: sourceContext.branch || null,
      commitSha: sourceContext.commitSha || null,
      status: runStatus,
      stages,
      readinessGate,
      summary,
      sourceContext,
      createdBy: userId,
      completedAt: new Date().toISOString(),
    });
  }

  async listRuns(projectId: string): Promise<WorkflowRun[]> {
    return workflowOrchestrationRepository.listRuns(projectId);
  }

  async getRun(projectId: string, runId: string): Promise<WorkflowRun> {
    const run = await workflowOrchestrationRepository.getRun(projectId, runId);
    if (!run) throw new NotFoundError("Workflow run not found");
    return run;
  }

  async retryStage(
    projectId: string,
    runId: string,
    stageKey: WorkflowStageKey,
    _userId: string
  ): Promise<WorkflowRun> {
    void _userId;
    const run = await this.getRun(projectId, runId);
    if (run.projectId !== projectId) {
      throw new NotFoundError("Workflow run not found for this project");
    }

    const archVersion = run.architectureVersionId
      ? (await architectureService.getVersion(run.architectureVersionId)).version
      : null;
    const archNodes = run.architectureVersionId ? await architectureRepository.nodes(run.architectureVersionId) : [];
    const archEdges = run.architectureVersionId ? await architectureRepository.edges(run.architectureVersionId) : [];

    const repository = run.repositoryId
      ? await repositoryIntelligenceRepository.repository(projectId, run.repositoryId)
      : null;
    const analysis = run.repositoryAnalysisId
      ? await repositoryIntelligenceRepository.analysis(run.repositoryAnalysisId)
      : null;

    let updatedStage: WorkflowStageResult;
    switch (stageKey) {
      case "stage_a_architecture":
        updatedStage = this.evaluateStageA(archVersion, archNodes, archEdges);
        break;
      case "stage_b_repository":
        updatedStage = this.evaluateStageB(repository, analysis);
        break;
      case "stage_c_drift":
        updatedStage = await this.evaluateStageC(projectId, archVersion, analysis, repository, true);
        break;
      case "stage_d_impact":
        updatedStage = await this.evaluateStageD(projectId, archVersion, analysis);
        break;
      case "stage_e_playground":
        updatedStage = await this.evaluateStageE(projectId, archVersion);
        break;
      case "stage_f_documentation":
        updatedStage = await this.evaluateStageF(projectId, archVersion, analysis);
        break;
      case "stage_g_verification":
        updatedStage = this.evaluateStageG(analysis);
        break;
      default:
        throw new ValidationError({ stage: `Unknown workflow stage key: ${stageKey}` });
    }

    const updatedStages = {
      ...run.stages,
      [stageKey]: updatedStage,
    };

    const newReadiness = workflowReadinessService.evaluate(updatedStages);
    const stageList = Object.values(updatedStages);
    const completedStages = stageList.filter((s) => s.status === "completed").length;
    const failedStages = stageList.filter((s) => s.status === "failed").length;
    const stagesNeedingAttention = stageList.filter((s) => s.status === "needs_attention").length;

    let runStatus: WorkflowRun["status"] = "completed";
    if (failedStages > 0) runStatus = "failed";
    else if (stagesNeedingAttention > 0) runStatus = "needs_attention";

    const updatedSummary: WorkflowRunSummary = {
      ...run.summary,
      completedStages,
      failedStages,
      stagesNeedingAttention,
      overallVerdict: newReadiness.decision,
      primaryNextStep: newReadiness.nextSteps[0] || updatedStage.recommendedNextAction.action,
    };

    return workflowOrchestrationRepository.updateRun(run.id, {
      status: runStatus,
      stages: updatedStages,
      readinessGate: newReadiness,
      summary: updatedSummary,
      completedAt: new Date().toISOString(),
    });
  }

  // ─── Stage Evaluators ───────────────────────────────────────────────────────

  private evaluateStageA(
    version: ArchitectureVersion | null,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[]
  ): WorkflowStageResult {
    const now = new Date().toISOString();
    if (!version) {
      return {
        key: "stage_a_architecture",
        name: "Architecture Baseline",
        stageLetter: "A",
        status: "needs_attention",
        startedAt: now,
        completedAt: now,
        findingsSummary: "No architecture version found for this project.",
        findings: [
          {
            stage: "stage_a_architecture",
            severity: "high",
            title: "Missing Architecture Version",
            description: "No saved or published architecture baseline exists in the system for this project.",
            recommendation: "Create or generate an architecture design in the Workspace editor.",
          },
        ],
        evidence: {
          nodeCount: 0,
          edgeCount: 0,
          versionFound: false,
        },
        recommendedNextAction: {
          action: "Design and save architecture baseline",
          description: "Author requirements or use Workspace to generate your system architecture.",
          targetRoute: "/workspace",
        },
        reused: false,
        isStale: false,
      };
    }

    const typeBreakdown: Record<string, number> = {};
    nodes.forEach((n) => {
      typeBreakdown[n.type] = (typeBreakdown[n.type] || 0) + 1;
    });

    const protocolBreakdown: Record<string, number> = {};
    edges.forEach((e) => {
      const p = e.protocol || "unspecified";
      protocolBreakdown[p] = (protocolBreakdown[p] || 0) + 1;
    });

    const findings: WorkflowFinding[] = [];
    if (nodes.length === 0) {
      findings.push({
        stage: "stage_a_architecture",
        severity: "medium",
        title: "Empty Architecture",
        description: `Architecture version v${version.version_number} contains 0 components.`,
        recommendation: "Add services, databases, or frontend modules to the architecture canvas.",
      });
    }

    return {
      key: "stage_a_architecture",
      name: "Architecture Baseline",
      stageLetter: "A",
      status: "completed",
      startedAt: version.created_at,
      completedAt: version.created_at,
      sourceVersion: {
        versionId: version.id,
        versionNumber: version.version_number,
        versionName: version.name,
      },
      findingsSummary: `Architecture v${version.version_number} (${version.name}) verified: ${nodes.length} component(s), ${edges.length} connection(s).`,
      findings,
      evidence: {
        versionId: version.id,
        versionNumber: version.version_number,
        name: version.name,
        status: version.status,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        componentTypes: typeBreakdown,
        protocols: protocolBreakdown,
      },
      recommendedNextAction: {
        action: "Inspect architecture canvas",
        description: "View component relationships and topology in the architecture canvas.",
        targetRoute: "/workspace",
      },
      reused: true,
      isStale: false,
    };
  }

  private evaluateStageB(
    repository: RepositoryRecord | null,
    analysis: RepositoryAnalysis | null
  ): WorkflowStageResult {
    if (!repository) {
      return {
        key: "stage_b_repository",
        name: "Repository Intelligence",
        stageLetter: "B",
        status: "not_started",
        startedAt: null,
        completedAt: null,
        findingsSummary: "No repository connected to this project.",
        findings: [
          {
            stage: "stage_b_repository",
            severity: "info",
            title: "Repository Not Connected",
            description: "No Git repository has been connected to verify implementation code against architecture.",
            recommendation: "Connect a GitHub, GitLab, or Bitbucket repository in the Repository page.",
          },
        ],
        evidence: {
          connected: false,
        },
        recommendedNextAction: {
          action: "Connect a code repository",
          description: "Connect your source repository to enable static analysis and drift detection.",
          targetRoute: "/repository",
        },
        reused: false,
        isStale: false,
      };
    }

    if (!analysis) {
      return {
        key: "stage_b_repository",
        name: "Repository Intelligence",
        stageLetter: "B",
        status: "needs_attention",
        startedAt: repository.created_at,
        completedAt: null,
        sourceVersion: {
          repositoryId: repository.id,
          repositoryName: repository.repository_name,
          branch: repository.default_branch,
        },
        findingsSummary: `Repository '${repository.repository_name}' is connected, but has not completed any analysis snapshot.`,
        findings: [
          {
            stage: "stage_b_repository",
            severity: "high",
            title: "Missing Repository Snapshot",
            description: "A completed static analysis snapshot is required for repository intelligence and drift verification.",
            recommendation: "Trigger repository analysis in Repository Intelligence.",
          },
        ],
        evidence: {
          repositoryId: repository.id,
          repositoryName: repository.repository_name,
          defaultBranch: repository.default_branch,
          analysisCount: 0,
        },
        recommendedNextAction: {
          action: "Analyze repository snapshot",
          description: "Run repository analysis to discover frameworks, routes, and dependencies.",
          targetRoute: "/repository",
        },
        reused: false,
        isStale: false,
      };
    }

    if (analysis.status === "failed") {
      return {
        key: "stage_b_repository",
        name: "Repository Intelligence",
        stageLetter: "B",
        status: "failed",
        startedAt: analysis.started_at,
        completedAt: analysis.completed_at,
        sourceVersion: {
          repositoryId: repository.id,
          repositoryName: repository.repository_name,
          commitSha: analysis.commit_sha,
          branch: (analysis.analysis_data?.branch as string) || repository.default_branch,
          analysisSnapshotId: analysis.id,
        },
        findingsSummary: `Repository analysis failed on branch ${analysis.analysis_data?.branch || repository.default_branch}: ${analysis.analysis_data?.error || "Unknown scan error"}`,
        findings: [
          {
            stage: "stage_b_repository",
            severity: "critical",
            title: "Repository Analysis Failed",
            description: String(analysis.analysis_data?.error || "Scan job execution failed"),
            recommendation: "Check repository provider permissions and re-run analysis.",
          },
        ],
        evidence: {
          repositoryId: repository.id,
          analysisId: analysis.id,
          error: analysis.analysis_data?.error,
        },
        recommendedNextAction: {
          action: "Retry repository scan",
          description: "Inspect failure logs and re-run analysis from the Repository view.",
          targetRoute: "/repository",
        },
        reused: false,
        isStale: false,
      };
    }

    const filesAnalyzed = Number(analysis.analysis_data?.filesAnalyzed || 0);
    const frameworks = Array.isArray(analysis.analysis_data?.detectedFrameworks)
      ? analysis.analysis_data.detectedFrameworks
      : Array.isArray(analysis.frameworks)
      ? analysis.frameworks
      : [];
    const scanLimitations: string[] = [];
    if (filesAnalyzed < 5) {
      scanLimitations.push(`Only ${filesAnalyzed} source files analyzed; coverage is limited`);
    }
    const warnings = Array.isArray(analysis.analysis_data?.warnings) ? analysis.analysis_data.warnings : [];
    warnings.forEach((w) => scanLimitations.push(String(w)));

    const findings: WorkflowFinding[] = [];
    if (scanLimitations.length > 0) {
      findings.push({
        stage: "stage_b_repository",
        severity: "medium",
        title: "Scan Coverage Limitation",
        description: scanLimitations.join("; "),
        recommendation: "Verify repository contains non-ignored source files.",
      });
    }

    return {
      key: "stage_b_repository",
      name: "Repository Intelligence",
      stageLetter: "B",
      status: "completed",
      startedAt: analysis.started_at,
      completedAt: analysis.completed_at,
      sourceVersion: {
        repositoryId: repository.id,
        repositoryName: repository.repository_name,
        commitSha: analysis.commit_sha,
        branch: (analysis.analysis_data?.branch as string) || repository.default_branch,
        analysisSnapshotId: analysis.id,
      },
      findingsSummary: `Completed snapshot: commit ${analysis.commit_sha?.slice(0, 7) || "HEAD"} on branch ${analysis.analysis_data?.branch || repository.default_branch}. Scanned ${filesAnalyzed} file(s), detected ${frameworks.length} framework(s).`,
      findings,
      evidence: {
        repositoryId: repository.id,
        repositoryName: repository.repository_name,
        repositoryUrl: repository.repository_url,
        analysisId: analysis.id,
        commitSha: analysis.commit_sha,
        branch: (analysis.analysis_data?.branch as string) || repository.default_branch,
        filesAnalyzed,
        fileCounts: analysis.analysis_data?.fileCounts || {},
        frameworksCount: frameworks.length,
        frameworks,
        languages: analysis.languages || {},
        dependenciesCount: Array.isArray(analysis.dependencies) ? analysis.dependencies.length : 0,
        scanLimitations,
      },
      recommendedNextAction: {
        action: "Review repository dependencies and routes",
        description: "Examine detected endpoints, frameworks, and packages in Repository Intelligence.",
        targetRoute: "/repository",
      },
      reused: true,
      isStale: false,
    };
  }

  private async evaluateStageC(
    projectId: string,
    version: ArchitectureVersion | null,
    analysis: RepositoryAnalysis | null,
    repository: RepositoryRecord | null,
    forceRerun = false
  ): Promise<WorkflowStageResult> {
    const now = new Date().toISOString();

    if (!version || !analysis || analysis.status !== "completed") {
      const reason = !version
        ? "Blocked: Stage A (Architecture baseline) is required before drift detection."
        : "Blocked: Stage B (Completed repository snapshot) is required before drift detection.";

      return {
        key: "stage_c_drift",
        name: "Architecture Drift",
        stageLetter: "C",
        status: "not_started",
        startedAt: null,
        completedAt: null,
        findingsSummary: reason,
        findings: [
          {
            stage: "stage_c_drift",
            severity: "info",
            title: "Prerequisites Incomplete",
            description: reason,
            recommendation: "Ensure both architecture version and repository analysis snapshot are completed.",
          },
        ],
        evidence: {
          hasArchitecture: Boolean(version),
          hasAnalysis: Boolean(analysis && analysis.status === "completed"),
        },
        recommendedNextAction: {
          action: "Complete upstream stages",
          description: "Establish both architecture and repository snapshots to enable drift detection.",
          targetRoute: !version ? "/workspace" : "/repository",
        },
        reused: false,
        isStale: false,
        blockingReason: reason,
      };
    }

    try {
      // Check for existing drift analysis for this exact version and analysis pair
      const existingDrifts = await repositoryIntelligenceRepository.drifts(projectId).catch(() => []);
      const matchingDrift = existingDrifts.find(
        (d) => d.architecture_version_id === version.id && d.repository_analysis_id === analysis.id
      );

      let driftRecord = matchingDrift;
      let driftResultItems: any[] = [];
      let reused = false;

      if (matchingDrift && !forceRerun) {
        reused = true;
        driftResultItems = await repositoryIntelligenceRepository.driftFindings(matchingDrift.id).catch(() => []);
      } else {
        // Run drift comparison deterministically
        const comparison = await driftDetectionService.compare(projectId, version.id, analysis);
        reused = false;

        // Persist drift analysis record
        driftRecord = await repositoryIntelligenceRepository.createDrift({
          project_id: projectId,
          repository_id: analysis.repository_id || repository?.id || null,
          architecture_version_id: version.id,
          repository_analysis_id: analysis.id,
          match_score: comparison.score,
          summary: comparison.summary,
          status: "completed",
          counts: comparison.counts,
          completed_at: new Date().toISOString(),
        });

        if (comparison.items.length > 0) {
          await repositoryIntelligenceRepository.createDriftItems(
            comparison.items.map((item) => ({ ...item, drift_analysis_id: driftRecord!.id }))
          );
        }
        driftResultItems = comparison.items;
      }

      const findings: WorkflowFinding[] = driftResultItems.map((item: any) => ({
        id: item.id,
        stage: "stage_c_drift",
        severity: item.severity as any,
        title: item.metadata?.title || `${item.type.replace(/_/g, " ").toUpperCase()}: ${item.description.slice(0, 60)}`,
        description: item.description,
        recommendation: item.recommendation,
        category: item.metadata?.findingType || item.type,
        evidence: { expected: item.expected, actual: item.actual },
      }));

      const counts = (driftRecord?.counts as any) || {};
      const matchScore = Number(driftRecord?.match_score ?? 100);

      return {
        key: "stage_c_drift",
        name: "Architecture Drift",
        stageLetter: "C",
        status: "completed",
        startedAt: driftRecord?.created_at || now,
        completedAt: driftRecord?.completed_at || now,
        sourceVersion: {
          versionId: version.id,
          versionNumber: version.version_number,
          commitSha: analysis.commit_sha,
          branch: (analysis.analysis_data?.branch as string) || repository?.default_branch,
          analysisSnapshotId: analysis.id,
          driftAnalysisId: driftRecord?.id,
        },
        findingsSummary: driftRecord?.summary || `Drift score: ${matchScore}%. ${findings.length} finding(s) detected.`,
        findings,
        evidence: {
          driftAnalysisId: driftRecord?.id,
          matchScore,
          counts,
          missingComponentsCount: counts.byCategory?.missing_component || 0,
          extraModulesCount: counts.byCategory?.extra_module || 0,
          mismatchesCount: (counts.byCategory?.technology_mismatch || 0) + (counts.byCategory?.integration_mismatch || 0),
          uncertainCount: counts.byCategory?.uncertain_match || 0,
          coverageLimitationCount: counts.byCategory?.coverage_limitation || 0,
          scoreBreakdown: counts.scoreBreakdown || null,
        },
        recommendedNextAction: {
          action: "Inspect and resolve drift items",
          description: "Review component drift in the Drift Intelligence page and apply remediation.",
          targetRoute: "/drift",
        },
        reused,
        isStale: false,
      };
    } catch (driftError) {
      const msg = driftError instanceof Error ? driftError.message : "Drift analysis failed";
      return {
        key: "stage_c_drift",
        name: "Architecture Drift",
        stageLetter: "C",
        status: "failed",
        startedAt: now,
        completedAt: now,
        findingsSummary: `Drift comparison error: ${msg}`,
        findings: [
          {
            stage: "stage_c_drift",
            severity: "critical",
            title: "Drift Analysis Execution Failure",
            description: msg,
            recommendation: "Verify architecture version components and retry drift detection.",
          },
        ],
        evidence: { error: msg },
        recommendedNextAction: {
          action: "Retry drift analysis",
          description: "Resolve configuration issues and re-run drift detection.",
          targetRoute: "/drift",
        },
        reused: false,
        isStale: false,
      };
    }
  }

  private async evaluateStageD(
    projectId: string,
    version: ArchitectureVersion | null,
    _analysis: RepositoryAnalysis | null
  ): Promise<WorkflowStageResult> {
    void _analysis;
    const reports: ImpactReport[] = await engineeringImpactRepository.listReports(projectId).catch(() => []);

    if (reports.length === 0) {
      return {
        key: "stage_d_impact",
        name: "Engineering Impact Analysis",
        stageLetter: "D",
        status: "ready",
        startedAt: null,
        completedAt: null,
        findingsSummary: "No impact analysis reports recorded for this project yet.",
        findings: [
          {
            stage: "stage_d_impact",
            severity: "info",
            title: "No Impact Reports",
            description: "No proposed changes or component impact analyses have been executed.",
            recommendation: "Create an impact analysis to evaluate downstream Blast Radius before refactoring.",
          },
        ],
        evidence: { totalReportsCount: 0 },
        recommendedNextAction: {
          action: "Analyze change impact",
          description: "Select an architecture component and simulate a proposed change in Impact Analysis.",
          targetRoute: "/impact",
        },
        reused: false,
        isStale: false,
      };
    }

    // Correlate with current baseline version
    const relevantReports = version
      ? reports.filter((r) => r.architectureVersionId === version.id)
      : reports;

    const targetReport = relevantReports[0] || reports[0];
    const isStale = Boolean(version && targetReport.architectureVersionId !== version.id);

    const findings: WorkflowFinding[] = [];
    const risks = (targetReport.riskAssessment?.findings || []) as RiskFinding[];
    risks.forEach((r: RiskFinding) => {
      findings.push({
        id: r.id,
        stage: "stage_d_impact",
        severity: r.severity as any,
        title: r.title,
        description: r.description,
        recommendation: r.mitigation,
        category: r.category,
      });
    });

    const changeType = targetReport.proposedChange?.changeType || "change";
    const overallSev = targetReport.riskAssessment?.overallSeverity || "low";

    return {
      key: "stage_d_impact",
      name: "Engineering Impact Analysis",
      stageLetter: "D",
      status: "completed",
      startedAt: targetReport.createdAt,
      completedAt: targetReport.createdAt,
      sourceVersion: {
        versionId: targetReport.architectureVersionId,
        impactReportId: targetReport.id,
        analysisSnapshotId: targetReport.repositoryAnalysisId,
      },
      findingsSummary: `Report evaluated for '${targetReport.targetEntity.name}' (${changeType}). Overall risk severity: ${overallSev.toUpperCase()}.`,
      findings,
      evidence: {
        totalReportsCount: reports.length,
        relevantReportsCount: relevantReports.length,
        selectedReportId: targetReport.id,
        targetEntity: targetReport.targetEntity,
        proposedChange: targetReport.proposedChange,
        riskAssessment: targetReport.riskAssessment,
        affectedComponentsCount: targetReport.impactSummary?.directlyAffected?.length || 0,
        driftCorrelationsCount: targetReport.driftCorrelations?.length || 0,
        isBaselineMatched: !isStale,
      },
      recommendedNextAction: {
        action: "Review impact report and change plan",
        description: "Inspect affected components and transition tasks in Impact Analysis.",
        targetRoute: "/impact",
        targetParams: { reportId: targetReport.id },
      },
      reused: true,
      isStale,
      stalenessReason: isStale
        ? `Impact report was evaluated against architecture version ${targetReport.architectureVersionId}, while current baseline is ${version?.id}.`
        : null,
    };
  }

  private async evaluateStageE(
    projectId: string,
    version: ArchitectureVersion | null
  ): Promise<WorkflowStageResult> {
    const simulations: PlaygroundSimulation[] = await engineeringRepository.simulations(projectId).catch(() => []);

    const relevantSims = version
      ? simulations.filter((s) => s.base_version_id === version.id)
      : simulations;

    const findings: WorkflowFinding[] = [];
    const completedUnapplied = relevantSims.filter((s) => s.status === "completed");
    if (completedUnapplied.length > 0) {
      findings.push({
        stage: "stage_e_playground",
        severity: "info",
        title: "Sandbox Simulations Pending Approval",
        description: `${completedUnapplied.length} simulation(s) completed in Playground. Simulations are sandboxed and do NOT modify active architecture baseline.`,
        recommendation: "Apply simulation if changes are approved, or discard if exploratory.",
      });
    }

    return {
      key: "stage_e_playground",
      name: "Engineering Playground",
      stageLetter: "E",
      status: simulations.length > 0 ? "completed" : "ready",
      startedAt: simulations[0]?.created_at || null,
      completedAt: simulations[0]?.updated_at || null,
      sourceVersion: {
        versionId: version?.id || null,
        simulationId: simulations[0]?.id || null,
      },
      findingsSummary: simulations.length > 0
        ? `${simulations.length} simulation record(s) on file (${completedUnapplied.length} ready/unapplied, ${simulations.filter((s) => s.status === "applied").length} applied).`
        : "No Playground simulations on file. Baseline architecture is unmodified.",
      findings,
      evidence: {
        totalSimulationsCount: simulations.length,
        relevantSimulationsCount: relevantSims.length,
        simulations: relevantSims.map((s) => ({
          id: s.id,
          name: s.name,
          status: s.status,
          changesCount: Array.isArray(s.proposed_changes) ? s.proposed_changes.length : 0,
          appliedVersionId: s.applied_version_id || null,
          createdAt: s.created_at,
        })),
        isSandboxOnly: true,
      },
      recommendedNextAction: {
        action: "Launch playground simulation",
        description: "Simulate architecture migrations or protocol changes in a non-destructive sandbox.",
        targetRoute: "/playground",
      },
      reused: true,
      isStale: false,
    };
  }

  private async evaluateStageF(
    projectId: string,
    version: ArchitectureVersion | null,
    analysis: RepositoryAnalysis | null
  ): Promise<WorkflowStageResult> {
    const now = new Date().toISOString();
    const documents = await engineeringRepository.documents(projectId).catch(() => []);

    if (documents.length === 0) {
      return {
        key: "stage_f_documentation",
        name: "Documentation Intelligence",
        stageLetter: "F",
        status: "needs_attention",
        startedAt: null,
        completedAt: null,
        findingsSummary: "No documentation documents exist for this project.",
        findings: [
          {
            stage: "stage_f_documentation",
            severity: "medium",
            title: "Missing System Documentation",
            description: "No architecture specifications, OpenAPI specs, or engineering runbooks have been generated.",
            recommendation: "Generate documentation in Documentation Intelligence.",
          },
        ],
        evidence: {
          totalDocumentsCount: 0,
          upToDateCount: 0,
          staleCount: 0,
        },
        recommendedNextAction: {
          action: "Generate system documentation",
          description: "Generate architecture overview, API specifications, and service catalogs.",
          targetRoute: "/documentation",
        },
        reused: false,
        isStale: false,
      };
    }

    let staleCount = 0;
    const findings: WorkflowFinding[] = [];
    const docSummaryList = documents.map((doc: any) => {
      let isStale = false;
      let reason = "";

      if (version && doc.source_version_id && doc.source_version_id !== version.id) {
        isStale = true;
        reason = `Document based on architecture version ${doc.source_version_id}, but current baseline is ${version.id}.`;
      } else if (analysis && doc.source_repository_analysis_id && doc.source_repository_analysis_id !== analysis.id) {
        isStale = true;
        reason = `Document based on repository snapshot ${doc.source_repository_analysis_id}, but current snapshot is ${analysis.id}.`;
      } else if (doc.status === "outdated") {
        isStale = true;
        reason = "Document status is marked outdated.";
      }

      if (isStale) {
        staleCount++;
        findings.push({
          id: doc.id,
          stage: "stage_f_documentation",
          severity: "low",
          title: `Stale Document: ${doc.title}`,
          description: reason,
          recommendation: "Regenerate this document to reflect latest architecture and repository data.",
        });
      }

      return {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        format: doc.format,
        status: doc.status,
        isStale,
        reason,
        sourceVersionId: doc.source_version_id,
        sourceAnalysisId: doc.source_repository_analysis_id,
      };
    });

    return {
      key: "stage_f_documentation",
      name: "Documentation Intelligence",
      stageLetter: "F",
      status: staleCount > 0 ? "needs_attention" : "completed",
      startedAt: documents[0]?.created_at || now,
      completedAt: documents[0]?.updated_at || now,
      sourceVersion: {
        documentIds: documents.map((d) => d.id),
      },
      findingsSummary: `${documents.length} document(s) on file (${documents.length - staleCount} up-to-date, ${staleCount} stale).`,
      findings,
      evidence: {
        totalDocumentsCount: documents.length,
        upToDateCount: documents.length - staleCount,
        staleDocumentsCount: staleCount,
        documents: docSummaryList,
      },
      recommendedNextAction: {
        action: staleCount > 0 ? "Regenerate stale documents" : "View documentation",
        description: staleCount > 0
          ? "Update outdated documents to match current architecture and repository snapshots."
          : "Read and export system specifications and diagrams.",
        targetRoute: "/documentation",
      },
      reused: true,
      isStale: staleCount > 0,
      stalenessReason: staleCount > 0 ? `${staleCount} document(s) require regeneration.` : null,
    };
  }

  private evaluateStageG(analysis: RepositoryAnalysis | null): WorkflowStageResult {
    const now = new Date().toISOString();
    const testRunner = (analysis?.analysis_data?.testRunner as string | null) || null;
    const testFiles = Array.isArray(analysis?.analysis_data?.testFiles)
      ? (analysis?.analysis_data?.testFiles as string[])
      : [];
    const testCount = Number(analysis?.analysis_data?.testCount || testFiles.length || 0);

    const security = analysis?.analysis_data?.security as any;
    const secChecks = Array.isArray(security?.checksExecuted) ? security.checksExecuted : [];
    const secFindings = Array.isArray(security?.findings) ? security.findings : [];
    const externalScanningConfigured = Boolean(security?.externalScanningConfigured);

    const findings: WorkflowFinding[] = [];

    // Explicit notice on test execution
    findings.push({
      stage: "stage_g_verification",
      severity: testFiles.length === 0 ? "medium" : "low",
      title: "Test Execution Status",
      description: testCount > 0
        ? `Static scan identified ${testCount} test file(s) with runner '${testRunner || "detected"}'. Test suites were NOT executed during static analysis.`
        : "No test files or automated test suites identified in the repository snapshot.",
      recommendation: "Ensure CI/CD pipeline runs unit and integration tests prior to deployment.",
    });

    if (secFindings.length > 0) {
      secFindings.forEach((f: any) => {
        findings.push({
          stage: "stage_g_verification",
          severity: f.severity || "medium",
          title: `Security Finding: ${f.rule || "Static Check"}`,
          description: f.message || "Security advisory detected",
          recommendation: `Inspect ${f.file || "source files"} for security advisories.`,
        });
      });
    }

    return {
      key: "stage_g_verification",
      name: "Verification & Readiness Checks",
      stageLetter: "G",
      status: "completed",
      startedAt: analysis?.started_at || now,
      completedAt: analysis?.completed_at || now,
      sourceVersion: {
        analysisSnapshotId: analysis?.id || null,
        commitSha: analysis?.commit_sha || null,
      },
      findingsSummary: `Verification checks: ${testFiles.length} test file(s) detected (${testRunner || "runner"}), ${secChecks.length} static security check(s) executed. Automated tests: NOT EXECUTED during static scan.`,
      findings,
      evidence: {
        testRunner,
        testFilesCount: testFiles.length,
        testFiles: testFiles.slice(0, 10),
        testSuitesExecuted: false,
        testExecutionNotice: "Test suites were not executed during repository static analysis scan.",
        securityChecksExecuted: secChecks,
        securityFindingsCount: secFindings.length,
        securityFindings: secFindings,
        externalScanningConfigured,
      },
      recommendedNextAction: {
        action: "Evaluate Release Readiness Quality Gate",
        description: "Evaluate policy-driven readiness gates and verified CI evidence in Release Quality.",
        targetRoute: "/quality",
      },
      reused: true,
      isStale: false,
    };
  }
}

export const workflowOrchestrationService = new WorkflowOrchestrationService();

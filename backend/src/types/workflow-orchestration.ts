export type WorkflowStageKey =
  | "stage_a_architecture"
  | "stage_b_repository"
  | "stage_c_drift"
  | "stage_d_impact"
  | "stage_e_playground"
  | "stage_f_documentation"
  | "stage_g_verification";

export type WorkflowStageLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type WorkflowStageStatus =
  | "not_started"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "needs_attention";

export type ReadinessGateDecision =
  | "ready"
  | "ready_with_warnings"
  | "blocked"
  | "not_evaluated";

export type ReadinessCheckStatus = "pass" | "warn" | "fail" | "not_executed";

export interface ReadinessCheckItem {
  id: string;
  category: "architecture" | "repository" | "drift" | "impact" | "testing" | "documentation" | "security";
  name: string;
  status: ReadinessCheckStatus;
  evidence: string | Record<string, unknown>;
  actionRequired?: string;
}

export interface ReadinessGateResult {
  decision: ReadinessGateDecision;
  summary: string;
  checks: ReadinessCheckItem[];
  blockers: string[];
  warnings: string[];
  nextSteps: string[];
  evaluatedAt: string;
}

export type WorkflowFindingSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface WorkflowFinding {
  id?: string;
  stage: WorkflowStageKey;
  severity: WorkflowFindingSeverity;
  title: string;
  description: string;
  recommendation?: string;
  category?: string;
  evidence?: unknown;
}

export interface WorkflowRecommendedAction {
  action: string;
  description: string;
  targetRoute?: string;
  targetParams?: Record<string, string>;
}

export interface WorkflowStageSourceVersion {
  versionId?: string | null;
  versionNumber?: number | null;
  versionName?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  commitSha?: string | null;
  branch?: string | null;
  analysisSnapshotId?: string | null;
  driftAnalysisId?: string | null;
  impactReportId?: string | null;
  simulationId?: string | null;
  documentIds?: string[];
}

export interface WorkflowStageResult {
  key: WorkflowStageKey;
  name: string;
  stageLetter: WorkflowStageLetter;
  status: WorkflowStageStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  sourceVersion?: WorkflowStageSourceVersion;
  findingsSummary: string;
  findings: WorkflowFinding[];
  evidence: Record<string, unknown>;
  recommendedNextAction: WorkflowRecommendedAction;
  reused: boolean;
  isStale: boolean;
  stalenessReason?: string | null;
  blockingReason?: string | null;
}

export interface WorkflowRunSummary {
  totalStages: number;
  completedStages: number;
  failedStages: number;
  stagesNeedingAttention: number;
  reusedStages: number;
  staleStages: number;
  overallVerdict: ReadinessGateDecision;
  primaryNextStep: string;
}

export interface WorkflowSourceContext {
  architectureVersionId?: string | null;
  architectureVersionNumber?: number | null;
  architectureVersionName?: string | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  repositoryAnalysisId?: string | null;
  branch?: string | null;
  commitSha?: string | null;
  scannedAt?: string | null;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  workspaceId: string;
  architectureVersionId: string | null;
  repositoryId: string | null;
  repositoryAnalysisId: string | null;
  branch: string | null;
  commitSha: string | null;
  status: "queued" | "running" | "completed" | "failed" | "needs_attention";
  stages: Record<WorkflowStageKey, WorkflowStageResult>;
  readinessGate: ReadinessGateResult;
  summary: WorkflowRunSummary;
  sourceContext: WorkflowSourceContext;
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
}

export interface RunWorkflowInput {
  architectureVersionId?: string;
  repositoryId?: string;
  repositoryAnalysisId?: string;
  branch?: string;
  forceRerun?: boolean;
}

export interface WorkflowProjectContext {
  projectId: string;
  workspaceId: string;
  architectureVersions: Array<{
    id: string;
    versionNumber: number;
    name: string;
    status: string;
    createdAt: string;
    nodeCount: number;
    edgeCount: number;
  }>;
  repositories: Array<{
    id: string;
    name: string;
    url: string;
    provider: string;
    defaultBranch: string;
    status: string;
    analyses: Array<{
      id: string;
      commitSha: string;
      branch?: string;
      status: string;
      filesAnalyzed?: number;
      createdAt: string;
      completedAt: string | null;
    }>;
  }>;
  latestRun: WorkflowRun | null;
}

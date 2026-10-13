import apiClient from "./client";

export type QualityGateCategory =
  | "build_and_test"
  | "repository_health"
  | "architecture_conformance"
  | "security"
  | "change_impact"
  | "documentation_traceability";

export type QualityCheckStatus =
  | "passed"
  | "failed"
  | "warning"
  | "blocked"
  | "not_evaluated";

export type QualitySeverity = "critical" | "high" | "medium" | "low" | "info";

export type ReadinessVerdict =
  | "ready"
  | "ready_with_warnings"
  | "blocked"
  | "not_evaluated";

export interface QualityCheckItem {
  id: string;
  category: QualityGateCategory;
  name: string;
  status: QualityCheckStatus;
  severity: QualitySeverity;
  isMandatory: boolean;
  evidenceSource: string;
  sourceVersion?: {
    commitSha?: string | null;
    architectureVersionId?: string | null;
    analysisSnapshotId?: string | null;
    reportId?: string | null;
  };
  reason: string;
  recommendedAction?: string;
  targetRoute?: string;
  metadata?: Record<string, unknown>;
}

export interface CategorySummary {
  category: QualityGateCategory;
  title: string;
  status: QualityCheckStatus;
  passed: number;
  failed: number;
  warning: number;
  blocked: number;
  notEvaluated: number;
  mandatoryPassed: number;
  mandatoryTotal: number;
  summary: string;
}

export interface FindingReference {
  key: string;
  checkId: string;
  name: string;
  severity: QualitySeverity;
  category: QualityGateCategory;
  message: string;
}

export interface BaselineComparisonResult {
  baselineReportId?: string | null;
  baselineCommitSha?: string | null;
  baselineArchitectureVersion?: number | null;
  newFindings: FindingReference[];
  resolvedFindings: FindingReference[];
  persistentFindings: FindingReference[];
  severityChanges: Array<{
    key: string;
    checkId: string;
    name: string;
    previousSeverity: QualitySeverity;
    currentSeverity: QualitySeverity;
  }>;
  metricDeltas: {
    driftMatchScoreDelta?: number | null;
    filesAnalyzedDelta?: number | null;
    testFailuresDelta?: number | null;
    coverageDelta?: number | null;
    totalFindingsDelta: number;
    staleDocsDelta?: number | null;
  };
  summary: string;
}

export interface QualityPolicyDefinition {
  id: string;
  projectId?: string;
  name: string;
  description: string;
  mandatoryCheckIds: string[];
  severityThresholds: {
    maxCritical: number;
    maxHigh: number;
  };
  isCustom?: boolean;
}

export interface QualityRequiredAction {
  checkId: string;
  action: string;
  targetRoute?: string;
  severity: QualitySeverity;
}

export interface QualityReport {
  id: string;
  projectId: string;
  workspaceId: string;
  architectureVersionId?: string | null;
  repositoryId?: string | null;
  repositoryAnalysisId?: string | null;
  baselineArchitectureVersionId?: string | null;
  baselineRepositoryAnalysisId?: string | null;
  baselineQualityReportId?: string | null;
  policyId: string;
  policyName: string;
  policyVersion: string;
  readinessVerdict: ReadinessVerdict;
  summary: string;
  checks: QualityCheckItem[];
  categorySummaries: Record<QualityGateCategory, CategorySummary>;
  metrics: {
    totalChecks: number;
    passed: number;
    failed: number;
    warning: number;
    blocked: number;
    notEvaluated: number;
    mandatoryChecks: number;
    mandatoryPassed: number;
    mandatoryFailed: number;
  };
  blockers: string[];
  warnings: string[];
  requiredActions: QualityRequiredAction[];
  baselineComparison?: BaselineComparisonResult | null;
  sourceContext: {
    projectName?: string;
    repositoryName?: string;
    branch?: string;
    commitSha?: string;
    architectureVersionNumber?: number;
    analysisTimestamp?: string;
  };
  evidenceSources: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
}

export interface VerificationEvidenceRecord {
  id: string;
  projectId: string;
  repositoryId?: string | null;
  commitSha: string;
  branch?: string | null;
  buildStatus: "passed" | "failed" | "not_evaluated";
  buildCommand?: string | null;
  buildDurationMs?: number | null;
  buildOutput?: string | null;
  testStatus: "passed" | "failed" | "not_evaluated";
  testFramework?: string | null;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  testDurationMs?: number | null;
  coveragePercent?: number | null;
  errorSummary?: string | null;
  securityScanStatus?: "passed" | "failed" | "warning" | "not_evaluated" | null;
  securityScannerName?: string | null;
  securityAdvisoriesCount: number;
  executedBy: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EvaluateQualityInput {
  architectureVersionId?: string | null;
  repositoryId?: string | null;
  repositoryAnalysisId?: string | null;
  policyId?: string;
  baselineArchitectureVersionId?: string | null;
  baselineRepositoryAnalysisId?: string | null;
  baselineQualityReportId?: string | null;
}

export interface QualityProjectContext {
  projectId: string;
  workspaceId: string;
  architectureVersions: Array<{
    id: string;
    versionNumber: number;
    name?: string;
    createdAt: string;
    componentCount: number;
  }>;
  repositories: Array<{
    id: string;
    name: string;
    url: string;
    provider: string;
    defaultBranch: string;
    analyses: Array<{
      id: string;
      commitSha: string;
      branch: string;
      status: string;
      filesAnalyzed: number;
      createdAt: string;
      completedAt?: string | null;
    }>;
  }>;
  availablePolicies: QualityPolicyDefinition[];
  latestReport?: QualityReport | null;
  latestEvidence?: VerificationEvidenceRecord | null;
}

export interface RecordEvidenceInput {
  repositoryId?: string | null;
  commitSha: string;
  branch?: string | null;
  buildStatus: "passed" | "failed" | "not_evaluated";
  buildCommand?: string | null;
  buildDurationMs?: number | null;
  buildOutput?: string | null;
  testStatus: "passed" | "failed" | "not_evaluated";
  testFramework?: string | null;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  testsSkipped: number;
  testDurationMs?: number | null;
  coveragePercent?: number | null;
  errorSummary?: string | null;
  securityScanStatus?: "passed" | "failed" | "warning" | "not_evaluated" | null;
  securityScannerName?: string | null;
  securityAdvisoriesCount?: number;
  executedBy?: string;
  metadata?: Record<string, unknown>;
}

export async function getQualityContext(projectId: string): Promise<QualityProjectContext> {
  const response = await apiClient.get<{ success: boolean; data: QualityProjectContext }>(
    `/api/v1/projects/${projectId}/quality/context`
  );
  return response.data.data;
}

export async function evaluateQuality(
  projectId: string,
  input: EvaluateQualityInput = {}
): Promise<QualityReport> {
  const response = await apiClient.post<{ success: boolean; data: QualityReport }>(
    `/api/v1/projects/${projectId}/quality/evaluate`,
    input
  );
  return response.data.data;
}

export async function getQualityReports(projectId: string): Promise<QualityReport[]> {
  const response = await apiClient.get<{ success: boolean; data: QualityReport[] }>(
    `/api/v1/projects/${projectId}/quality/reports`
  );
  return response.data.data;
}

export async function getQualityReport(projectId: string, reportId: string): Promise<QualityReport> {
  const response = await apiClient.get<{ success: boolean; data: QualityReport }>(
    `/api/v1/projects/${projectId}/quality/reports/${reportId}`
  );
  return response.data.data;
}

export async function recordQualityEvidence(
  projectId: string,
  input: RecordEvidenceInput
): Promise<VerificationEvidenceRecord> {
  const response = await apiClient.post<{ success: boolean; data: VerificationEvidenceRecord }>(
    `/api/v1/projects/${projectId}/quality/evidence`,
    input
  );
  return response.data.data;
}

export async function getQualityEvidenceList(projectId: string): Promise<VerificationEvidenceRecord[]> {
  const response = await apiClient.get<{ success: boolean; data: VerificationEvidenceRecord[] }>(
    `/api/v1/projects/${projectId}/quality/evidence`
  );
  return response.data.data;
}

export async function getQualityPolicies(projectId: string): Promise<QualityPolicyDefinition[]> {
  const response = await apiClient.get<{ success: boolean; data: QualityPolicyDefinition[] }>(
    `/api/v1/projects/${projectId}/quality/policies`
  );
  return response.data.data;
}

export async function updateQualityPolicy(
  projectId: string,
  policyId: string,
  input: {
    name: string;
    description: string;
    mandatoryCheckIds: string[];
    severityThresholds: { maxCritical: number; maxHigh: number };
  }
): Promise<QualityPolicyDefinition> {
  const response = await apiClient.put<{ success: boolean; data: QualityPolicyDefinition }>(
    `/api/v1/projects/${projectId}/quality/policies/${policyId}`,
    input
  );
  return response.data.data;
}

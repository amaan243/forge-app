import apiClient from "./client";
import type { PlaygroundSimulation } from "./playground";

export type ImpactTargetEntityType =
  | "architecture_component"
  | "service_module"
  | "api_route"
  | "database_object"
  | "external_integration"
  | "dependency"
  | "architecture_connection";

export interface ImpactTargetEntity {
  type: ImpactTargetEntityType;
  id: string;
  name: string;
  nodeKey?: string;
  path?: string;
  method?: string;
  technology?: string;
  metadata?: Record<string, unknown>;
}

export type ProposedChangeType =
  | "modify_api_contract"
  | "replace_database"
  | "remove_service"
  | "change_auth"
  | "introduce_cache"
  | "change_connection"
  | "update_external_integration"
  | "refactor_service"
  | "modify_schema"
  | "custom";

export interface ProposedChange {
  changeType: ProposedChangeType | string;
  description: string;
  details?: Record<string, unknown>;
}

export type ArchitectureCodeMappingState =
  | "verified"
  | "partial"
  | "unmapped_architecture"
  | "unmapped_repository"
  | "uncertain";

export interface ArchitectureCodeMapping {
  componentId?: string;
  componentName: string;
  componentType: string;
  state: ArchitectureCodeMappingState;
  matchedFiles: string[];
  matchedRoutes: Array<{ method: string; path: string; file?: string; line?: number }>;
  matchedDependencies: string[];
  matchedDatabases: string[];
  confidence: "high" | "medium" | "low";
  evidenceNotes: string[];
}

export type DependencyDirection = "upstream" | "downstream" | "bidirectional" | "internal";
export type DependencyRelationshipStatus = "verified" | "inferred" | "unknown";

export interface ImpactedEntityFinding {
  id: string;
  name: string;
  entityKind: "component" | "module" | "route" | "database" | "integration" | "test" | "document" | "connection";
  direction: DependencyDirection;
  hopDistance: number;
  relationship: string;
  relationshipStatus: DependencyRelationshipStatus;
  evidence: {
    sourceFiles?: string[];
    routes?: string[];
    edges?: string[];
    dependencies?: string[];
    databases?: string[];
    testFiles?: string[];
    note?: string;
  };
}

export type RiskSeverity = "critical" | "high" | "medium" | "low" | "uncertain";

export interface RiskFinding {
  id: string;
  category:
    | "breaking_change"
    | "auth_security"
    | "database_integrity"
    | "public_api_compatibility"
    | "coupling_blast_radius"
    | "test_gap"
    | "drift_deviation"
    | "external_saas";
  severity: RiskSeverity;
  title: string;
  description: string;
  evidence: string[];
  rationale: string;
  mitigation: string;
}

export interface ChangePlanTask {
  stepNumber: number;
  title: string;
  category: "pre_check" | "implementation" | "database" | "api" | "test" | "documentation" | "verification" | "rollback";
  description: string;
  requirementLevel: "confirmed" | "recommended";
  targetFiles: string[];
  dependencies: number[];
}

export interface ChangePlan {
  summary: string;
  preChangeChecks: string[];
  affectedComponentsAndFiles: Array<{ name: string; file?: string; role: string }>;
  implementationTasks: ChangePlanTask[];
  databaseConsiderations: string[];
  apiCompatibilityConsiderations: string[];
  testsToUpdateOrCreate: Array<{
    testFile?: string;
    description: string;
    type: "unit" | "integration" | "contract" | "regression";
  }>;
  documentationToUpdate: Array<{
    docType: string;
    title: string;
    docId?: string;
    reason: string;
  }>;
  verificationSteps: string[];
  rollbackConsiderations: string[];
}

export interface ImpactSourceContext {
  versionNumber: number;
  versionName: string;
  repositoryId?: string | null;
  repositoryName?: string;
  repositoryUrl?: string;
  repositoryAnalysisId?: string | null;
  commitSha?: string;
  branch?: string;
  snapshotDate?: string;
  isSnapshotStale?: boolean;
  stalenessWarning?: string;
}

export interface ImpactDependencyGraph {
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    isTarget?: boolean;
    mappingState?: ArchitectureCodeMappingState;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship: string;
    status: DependencyRelationshipStatus;
    direction: DependencyDirection;
  }>;
  directUpstream: string[];
  directDownstream: string[];
  indirectUpstream: string[];
  indirectDownstream: string[];
}

export interface ImpactSummary {
  directlyAffected: ImpactedEntityFinding[];
  downstreamComponents: ImpactedEntityFinding[];
  relatedApis: ImpactedEntityFinding[];
  relatedDatabaseObjects: ImpactedEntityFinding[];
  affectedIntegrations: ImpactedEntityFinding[];
  relevantTests: ImpactedEntityFinding[];
  docSectionsNeedingUpdate: Array<{ section: string; documentId?: string; documentTitle?: string }>;
  brokenConnections: Array<{ edgeId: string; source: string; target: string; relationship: string; reason: string }>;
  unknownsAndAssumptions: string[];
}

export interface RiskAssessment {
  overallSeverity: RiskSeverity;
  findings: RiskFinding[];
  evidenceCount: number;
  testCoverageStatus: "adequate" | "minimal" | "missing" | "uncertain";
  severityCounts: Record<RiskSeverity, number>;
}

export interface DriftCorrelationFinding {
  type: string;
  description: string;
  severity: string;
  driftItemId?: string;
  component?: string;
}

export interface PlaygroundSimulationBridge {
  supported: boolean;
  simulationCandidateChanges: Array<{
    type: string;
    target?: string;
    name?: string;
    technology?: string;
    responsibility?: string;
    source?: string;
    target_component?: string;
  }>;
  evaluableMetrics: string[];
  unevaluableMetrics: string[];
  explanation: string;
}

export interface ImpactReport {
  id: string;
  projectId: string;
  workspaceId: string;
  architectureVersionId: string;
  repositoryId: string | null;
  repositoryAnalysisId: string | null;
  targetEntity: ImpactTargetEntity;
  proposedChange: ProposedChange;
  sourceContext: ImpactSourceContext;
  mappingSummary: {
    mappings: ArchitectureCodeMapping[];
    verifiedCount: number;
    partialCount: number;
    unmappedArchCount: number;
    unmappedRepoCount: number;
    uncertainCount: number;
  };
  dependencyGraph: ImpactDependencyGraph;
  impactSummary: ImpactSummary;
  riskAssessment: RiskAssessment;
  changePlan: ChangePlan;
  driftCorrelations: DriftCorrelationFinding[];
  playgroundBridge: PlaygroundSimulationBridge;
  createdBy: string;
  createdAt: string;
}

export interface ImpactAnalysisInput {
  architectureVersionId: string;
  repositoryId?: string | null;
  repositoryAnalysisId?: string | null;
  targetEntity: ImpactTargetEntity;
  proposedChange: ProposedChange;
}

export async function analyzeImpact(
  projectId: string,
  input: ImpactAnalysisInput
): Promise<ImpactReport> {
  const response = await apiClient.post<{ success: boolean; data: ImpactReport }>(
    `/api/v1/projects/${projectId}/impact/analyze`,
    input
  );
  return response.data.data;
}

export async function getImpactReports(projectId: string): Promise<ImpactReport[]> {
  const response = await apiClient.get<{ success: boolean; data: ImpactReport[] }>(
    `/api/v1/projects/${projectId}/impact/reports`
  );
  return response.data.data;
}

export async function getImpactReport(
  projectId: string,
  reportId: string
): Promise<ImpactReport> {
  const response = await apiClient.get<{ success: boolean; data: ImpactReport }>(
    `/api/v1/projects/${projectId}/impact/reports/${reportId}`
  );
  return response.data.data;
}

export async function deleteImpactReport(
  projectId: string,
  reportId: string
): Promise<void> {
  await apiClient.delete(`/api/v1/projects/${projectId}/impact/reports/${reportId}`);
}

export async function convertImpactToSimulation(
  projectId: string,
  reportId: string,
  input?: { name?: string; description?: string }
): Promise<PlaygroundSimulation> {
  const response = await apiClient.post<{ success: boolean; data: PlaygroundSimulation }>(
    `/api/v1/projects/${projectId}/impact/reports/${reportId}/to-simulation`,
    input || {}
  );
  return response.data.data;
}

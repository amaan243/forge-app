import apiClient from "./client";

export type KnowledgeGraphEntityType =
  | "requirement"
  | "architecture_component"
  | "architecture_connection"
  | "repository_module"
  | "api_route"
  | "database_model"
  | "dependency"
  | "test"
  | "documentation"
  | "drift_finding"
  | "impact_finding"
  | "architecture_version";

export type KnowledgeGraphRelationType =
  | "implemented_by"
  | "mapped_to"
  | "handled_by"
  | "accesses"
  | "imports"
  | "depends_on"
  | "verifies"
  | "describes"
  | "has_drift"
  | "affects"
  | "connects_to"
  | "contains";

export type EvidenceConfidence = "verified" | "inferred" | "partial" | "uncertain";
export type FreshnessStatus = "fresh" | "stale" | "unknown";

export interface SourceVersionContext {
  architectureVersionId?: string | null;
  architectureVersionNumber?: number | null;
  repositoryId?: string | null;
  repositoryName?: string | null;
  commitSha?: string | null;
  analysisSnapshotId?: string | null;
  branch?: string | null;
  documentIds?: string[];
}

export interface KnowledgeGraphEntityNode {
  id: string;
  name: string;
  type: KnowledgeGraphEntityType;
  projectId: string;
  repositoryId?: string | null;
  sourceReference: string;
  sourceVersion?: SourceVersionContext;
  evidenceStatus: EvidenceConfidence;
  freshness: FreshnessStatus;
  url?: string;
  metadata: Record<string, unknown>;
  tags?: string[];
}

export interface KnowledgeGraphRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: KnowledgeGraphRelationType;
  confidence: EvidenceConfidence;
  evidence: string;
  sourceSnapshot?: string | null;
  sourceVersion?: string | null;
  freshness: FreshnessStatus;
  metadata?: Record<string, unknown>;
}

export interface TraceabilityChainStep {
  stage:
    | "requirement"
    | "architecture"
    | "repository"
    | "api"
    | "data_model"
    | "test"
    | "documentation";
  stageLabel: string;
  status:
    | "verified"
    | "inferred"
    | "partial"
    | "not_mapped"
    | "no_matching_test"
    | "documentation_missing"
    | "uncertain"
    | "source_unavailable";
  entity?: KnowledgeGraphEntityNode;
  notes?: string;
}

export interface TraceabilityReport {
  rootEntityId: string;
  rootEntityType: KnowledgeGraphEntityType;
  rootEntityName: string;
  chain: TraceabilityChainStep[];
  complete: boolean;
  unresolvedGaps: string[];
  summary: string;
}

export interface KnowledgeGraphCoverage {
  totalRequirements: number;
  mappedRequirementsCount: number;
  totalComponents: number;
  mappedComponentsCount: number;
  totalRoutes: number;
  testedRoutesCount: number;
  totalModules: number;
  documentedModulesCount: number;
  totalDriftFindings: number;
  linkedDriftFindingsCount: number;
  gaps: {
    requirementsWithoutArchitecture: string[];
    componentsWithoutRepository: string[];
    routesWithoutTests: string[];
    modulesWithoutDocumentation: string[];
    staleSources: string[];
  };
  overallCoveragePercentage: number;
}

export interface KnowledgeGraphSummary {
  totalEntities: number;
  totalRelationships: number;
  entityTypeCounts: Record<string, number>;
  relationTypeCounts: Record<string, number>;
  verifiedRelationsCount: number;
  inferredRelationsCount: number;
  uncertainRelationsCount: number;
  staleRelationsCount: number;
}

export interface KnowledgeGraphSnapshot {
  id: string;
  projectId: string;
  workspaceId: string;
  architectureVersionId?: string | null;
  repositoryId?: string | null;
  repositoryAnalysisId?: string | null;
  sourceHash: string;
  sourceContext: SourceVersionContext;
  entities: KnowledgeGraphEntityNode[];
  relationships: KnowledgeGraphRelationship[];
  summary: KnowledgeGraphSummary;
  coverage: KnowledgeGraphCoverage;
  status: "active" | "completed" | "stale" | "archived";
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGraphContext {
  projectId: string;
  workspaceId: string;
  architectureVersions: Array<{
    id: string;
    versionNumber: number;
    name: string;
    status: string;
    createdAt: string;
  }>;
  repositories: Array<{
    id: string;
    name: string;
    url: string;
    defaultBranch: string;
    analyses: Array<{
      id: string;
      commitSha: string;
      branch: string;
      status: string;
      createdAt: string;
    }>;
  }>;
  latestSnapshotId: string | null;
  latestSourceHash: string | null;
  updatedAt: string | null;
}

export interface KnowledgeGraphQueryResult {
  snapshot: KnowledgeGraphSnapshot;
  filteredEntities: KnowledgeGraphEntityNode[];
  filteredRelationships: KnowledgeGraphRelationship[];
  totalEntities: number;
  totalRelationships: number;
}

export interface KnowledgeGraphNeighborhood {
  centerEntity: KnowledgeGraphEntityNode;
  nodes: KnowledgeGraphEntityNode[];
  relationships: KnowledgeGraphRelationship[];
  depth: number;
  totalNeighbors: number;
}

export type KnowledgeGraphScope = "architecture" | "repository" | "all";

export interface QueryKnowledgeGraphParams {
  architectureVersionId?: string;
  repositoryId?: string;
  repositoryAnalysisId?: string;
  scope?: KnowledgeGraphScope;
  entityTypes?: KnowledgeGraphEntityType[];
  relationTypes?: KnowledgeGraphRelationType[];
  search?: string;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
}

export async function getKnowledgeGraphContext(projectId: string): Promise<KnowledgeGraphContext> {
  const response = await apiClient.get<{ success: boolean; data: KnowledgeGraphContext }>(
    `/api/v1/projects/${projectId}/knowledge-graph/context`
  );
  return response.data.data;
}

export async function getKnowledgeGraph(
  projectId: string,
  params: QueryKnowledgeGraphParams = {}
): Promise<KnowledgeGraphQueryResult> {
  const queryParams = new URLSearchParams();
  if (params.architectureVersionId) queryParams.set("architectureVersionId", params.architectureVersionId);
  if (params.repositoryId) queryParams.set("repositoryId", params.repositoryId);
  if (params.repositoryAnalysisId) queryParams.set("repositoryAnalysisId", params.repositoryAnalysisId);
  if (params.scope) queryParams.set("scope", params.scope);
  if (params.entityTypes && params.entityTypes.length > 0) queryParams.set("entityTypes", params.entityTypes.join(","));
  if (params.relationTypes && params.relationTypes.length > 0) queryParams.set("relationTypes", params.relationTypes.join(","));
  if (params.search) queryParams.set("search", params.search);
  if (params.limit !== undefined) queryParams.set("limit", String(params.limit));
  if (params.offset !== undefined) queryParams.set("offset", String(params.offset));
  if (params.forceRefresh) queryParams.set("forceRefresh", "true");

  const url = `/api/v1/projects/${projectId}/knowledge-graph${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  const response = await apiClient.get<{ success: boolean; data: KnowledgeGraphQueryResult }>(url);
  return response.data.data;
}

export async function getKnowledgeGraphNeighborhood(
  projectId: string,
  entityId: string,
  depth = 1
): Promise<KnowledgeGraphNeighborhood> {
  const response = await apiClient.get<{ success: boolean; data: KnowledgeGraphNeighborhood }>(
    `/api/v1/projects/${projectId}/knowledge-graph/neighborhood/${entityId}?depth=${depth}`
  );
  return response.data.data;
}

export async function getKnowledgeGraphTraceability(
  projectId: string,
  entityId: string
): Promise<TraceabilityReport> {
  const response = await apiClient.get<{ success: boolean; data: TraceabilityReport }>(
    `/api/v1/projects/${projectId}/knowledge-graph/traceability/${entityId}`
  );
  return response.data.data;
}

export async function analyzeGraphNodeImpact(
  projectId: string,
  entityId: string,
  changeType: "modified" | "deprecated" | "removed" | "refactored" = "modified"
): Promise<{
  report: Record<string, unknown>;
  entity: KnowledgeGraphEntityNode;
  impactSummary: Record<string, unknown>;
  riskAssessment: Record<string, unknown>;
}> {
  const response = await apiClient.post<{
    success: boolean;
    data: {
      report: Record<string, unknown>;
      entity: KnowledgeGraphEntityNode;
      impactSummary: Record<string, unknown>;
      riskAssessment: Record<string, unknown>;
    };
  }>(`/api/v1/projects/${projectId}/knowledge-graph/impact`, {
    entityId,
    changeType,
  });
  return response.data.data;
}

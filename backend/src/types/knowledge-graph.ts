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
  status: "verified" | "inferred" | "partial" | "not_mapped" | "no_matching_test" | "documentation_missing" | "uncertain" | "source_unavailable";
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

export type KnowledgeGraphScope = "architecture" | "repository" | "all";

export interface QueryKnowledgeGraphInput {
  architectureVersionId?: string;
  repositoryId?: string;
  repositoryAnalysisId?: string;
  scope?: KnowledgeGraphScope;
  entityTypes?: KnowledgeGraphEntityType[];
  relationTypes?: KnowledgeGraphRelationType[];
  search?: string;
  centerEntityId?: string;
  neighborhoodDepth?: number;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
}

export interface KnowledgeGraphNeighborhood {
  centerEntity: KnowledgeGraphEntityNode;
  nodes: KnowledgeGraphEntityNode[];
  relationships: KnowledgeGraphRelationship[];
  depth: number;
  totalNeighbors: number;
}

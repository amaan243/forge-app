export type PlaygroundStatus = "draft" | "simulating" | "completed" | "applied" | "discarded" | "failed";

export type SimulationChangeType =
  | "add_service"
  | "add_component"
  | "remove_service"
  | "remove_component"
  | "replace_technology"
  | "change_technology"
  | "add_connection"
  | "remove_connection"
  | "change_database_technology"
  | "add_database"
  | "remove_database"
  | "introduce_cache"
  | "add_cache"
  | "remove_cache"
  | "introduce_queue"
  | "add_queue"
  | "remove_queue"
  | "change_communication"
  | "add_external_integration"
  | "modify_deployment"
  | "modify_scaling"
  | "modify_deployment_scaling"
  | "modify_api"
  | "change_infrastructure"
  | "change_authentication";

export type DocumentationType =
  | "architecture_overview"
  | "system_design"
  | "api_documentation"
  | "database_documentation"
  | "deployment"
  | "security"
  | "getting_started"
  | "repository_overview"
  | "testing_security"
  | "custom";

export type DocumentationFormat = "markdown" | "html" | "mermaid" | "openapi_json" | "openapi_yaml";

export interface SimulationChange {
  type: SimulationChangeType;
  target?: string;
  name?: string;
  responsibility?: string;
  technology?: string;
  node_type?: string;
  source?: string;
  target_component?: string;
  relationship?: string;
  protocol?: string;
  details?: Record<string, unknown>;
}

export interface MetricValue<T = number | string> {
  baseline: T;
  proposed: T;
  delta: number | string | null;
  unit?: string;
  status?: "improved" | "degraded" | "neutral" | "unknown";
  rationale: string;
  insufficientEvidence?: boolean;
}

export interface SimulationMetricsRecord {
  label: string;
  evaluationConfidence: "high" | "medium" | "low";
  performance: {
    latencyScore: MetricValue<string>;
    maxSyncHops: MetricValue<number>;
    potentialBottlenecks: string[];
    communicationChanges: string[];
  };
  scalability: {
    spofCount: MetricValue<number>;
    identifiedSpofs: string[];
    scalingLimitations: string[];
    potentialBottlenecks: string[];
  };
  cost: {
    relativeCostIndex: MetricValue<number>;
    introducedServices: string[];
    assumptions: string[];
  };
  complexity: {
    componentCount: MetricValue<number>;
    connectionCount: MetricValue<number>;
    couplingIndex: MetricValue<number>;
    additionalDependencies: string[];
  };
  security: {
    attackSurfacesCount: MetricValue<number>;
    identifiedRisks: string[];
    authGaps: string[];
    trustBoundaryChanges: string[];
    evidenceNote?: string;
  };
  developmentEffort: {
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    storyPointsEstimate: number;
    confidence: "high" | "medium" | "low";
    assumptions: string[];
  };
  overallRisk: "low" | "medium" | "high";
  assumptions: string[];
  warnings: string[];
  // Legacy numeric fields preserved for backward compatibility
  performance_score?: number;
  latency?: number;
  cost_score?: number;
  complexity_score?: number;
  security_score?: number;
  reliability?: number;
  scalability_score?: number;
  implementationEffort?: number;
}

export interface BrokenConnection {
  edgeId: string;
  source: string;
  target: string;
  relationship: string;
  reason: string;
}

export interface ImpactAnalysis {
  affectedComponents: string[];
  directlyChangedComponents: string[];
  connectedComponents: string[];
  affectedApis: string[];
  affectedDataStores: string[];
  affectedInfrastructure: string[];
  brokenConnections: BrokenConnection[];
  docSectionsNeedingUpdate: string[];
  repositoryEvidence: {
    hasEvidence: boolean;
    repositoryName?: string;
    commitSha?: string;
    matchedModules: string[];
    matchedRoutes: string[];
    statusNote: string;
  };
  potentialDrift: {
    hasDriftRisk: boolean;
    items: string[];
    note: string;
  };
  risks: string[];
  recommendedActions: string[];
}

export interface PlaygroundSimulation {
  id: string;
  project_id: string;
  base_version_id: string;
  repository_id?: string | null;
  snapshot_id?: string | null;
  applied_version_id?: string | null;
  name: string;
  description: string | null;
  status: PlaygroundStatus;
  proposed_changes: SimulationChange[];
  before_architecture: Record<string, unknown>;
  after_architecture: Record<string, unknown>;
  metrics: SimulationMetricsRecord | Record<string, unknown>;
  impact_analysis: ImpactAnalysis | Record<string, unknown>;
  ai_analysis: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentationDocument {
  id: string;
  project_id: string;
  type: DocumentationType;
  title: string;
  content: string;
  format: DocumentationFormat;
  source_version_id: string | null;
  source_repository_analysis_id?: string | null;
  source_commit_sha?: string | null;
  source_branch?: string | null;
  generation_metadata?: Record<string, unknown> | null;
  generated_by: string;
  status: "up_to_date" | "outdated";
  manually_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface DesignReviewFinding {
  finding: string;
  severity: "low" | "medium" | "high" | "critical";
  evidence: string[];
  explanation: string;
  recommendation: string;
  component_ids: string[];
}

export interface ProjectStory {
  id: string;
  project_id: string;
  content: Record<string, unknown>;
  generated_by: string;
  created_at: string;
  updated_at: string;
}

export interface AIJobRun {
  id: string;
  project_id: string;
  user_id: string;
  operation: string;
  provider: string;
  model: string | null;
  status: "queued" | "running" | "completed" | "failed";
  input_metadata: Record<string, unknown>;
  output_metadata: Record<string, unknown>;
  token_usage: Record<string, unknown>;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}
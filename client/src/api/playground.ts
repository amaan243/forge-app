import apiClient from "./client";
import type { ArchitectureNode, ArchitectureEdge, ArchitectureVersion } from "./architecture";

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
  before_architecture: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  after_architecture: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  metrics: SimulationMetricsRecord;
  impact_analysis: ImpactAnalysis;
  ai_analysis: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSimulationInput {
  base_version_id: string;
  repository_id?: string | null;
  snapshot_id?: string | null;
  name: string;
  description?: string | null;
  proposed_changes: SimulationChange[];
}

export async function createSimulation(
  projectId: string,
  input: CreateSimulationInput
): Promise<PlaygroundSimulation> {
  const response = await apiClient.post<{ success: boolean; data: PlaygroundSimulation }>(
    `/api/v1/projects/${projectId}/playground`,
    input
  );
  return response.data.data;
}

export async function getSimulations(projectId: string): Promise<PlaygroundSimulation[]> {
  const response = await apiClient.get<{ success: boolean; data: PlaygroundSimulation[] }>(
    `/api/v1/projects/${projectId}/playground`
  );
  return response.data.data;
}

export async function getSimulation(
  projectId: string,
  simulationId: string
): Promise<PlaygroundSimulation> {
  const response = await apiClient.get<{ success: boolean; data: PlaygroundSimulation }>(
    `/api/v1/projects/${projectId}/playground/${simulationId}`
  );
  return response.data.data;
}

export async function updateSimulation(
  projectId: string,
  simulationId: string,
  input: Partial<CreateSimulationInput>
): Promise<PlaygroundSimulation> {
  const response = await apiClient.patch<{ success: boolean; data: PlaygroundSimulation }>(
    `/api/v1/projects/${projectId}/playground/${simulationId}`,
    input
  );
  return response.data.data;
}

export async function runSimulation(
  projectId: string,
  simulationId: string
): Promise<PlaygroundSimulation> {
  const response = await apiClient.post<{ success: boolean; data: PlaygroundSimulation }>(
    `/api/v1/projects/${projectId}/playground/${simulationId}/simulate`
  );
  return response.data.data;
}

export async function applySimulation(
  projectId: string,
  simulationId: string
): Promise<ArchitectureVersion> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureVersion }>(
    `/api/v1/projects/${projectId}/playground/${simulationId}/apply`
  );
  return response.data.data;
}

export async function discardSimulation(
  projectId: string,
  simulationId: string
): Promise<PlaygroundSimulation> {
  const response = await apiClient.post<{ success: boolean; data: PlaygroundSimulation }>(
    `/api/v1/projects/${projectId}/playground/${simulationId}/discard`
  );
  return response.data.data;
}

export async function createAlternativeSimulation(
  projectId: string,
  simulationId: string
): Promise<PlaygroundSimulation> {
  const response = await apiClient.post<{ success: boolean; data: PlaygroundSimulation }>(
    `/api/v1/projects/${projectId}/playground/${simulationId}/alternative`
  );
  return response.data.data;
}

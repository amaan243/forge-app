import apiClient from "./client";

// ─── Shared Types ──────────────────────────────────────────────────────────────

export type ArchitectureVersionStatus = "draft" | "published" | "archived";

export type ArchitectureNodeType =
  | "frontend"
  | "backend"
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "storage"
  | "external_service"
  | "auth"
  | "worker"
  | "api"
  | "gateway"
  | "monitoring"
  | "infrastructure";

export type ArchitectureRelationship =
  | "calls"
  | "reads"
  | "writes"
  | "publishes"
  | "subscribes"
  | "authenticates"
  | "depends_on"
  | "connects_to";

export interface ArchitectureVersion {
  id: string;
  project_id: string;
  version_number: number;
  name: string;
  description: string | null;
  status: ArchitectureVersionStatus;
  architecture_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
  node_count?: number;
  edge_count?: number;
  node_types?: Record<string, number>;
  technologies?: string[];
  sample_nodes?: { id: string; name: string; type: ArchitectureNodeType; technology?: string | null }[];
}

export interface ArchitectureNode {
  id: string;
  architecture_version_id: string;
  node_key: string;
  name: string;
  type: ArchitectureNodeType;
  technology: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  position_x: number;
  position_y: number;
  created_at: string;
}

export interface ArchitectureEdge {
  id: string;
  architecture_version_id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: ArchitectureRelationship;
  protocol: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ArchitectureGraph {
  version: ArchitectureVersion | null;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

// ─── Input Types ───────────────────────────────────────────────────────────────

export interface CreateVersionInput {
  name: string;
  description?: string;
}

export interface CreateNodeInput {
  node_key: string;
  name: string;
  type: ArchitectureNodeType;
  technology?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
}

export interface CreateEdgeInput {
  source_node_id: string;
  target_node_id: string;
  relationship: ArchitectureRelationship;
  protocol?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateVersionInput {
  name?: string;
  description?: string;
  status?: "draft" | "archived";
}

export interface UpdateNodeInput {
  name?: string;
  type?: ArchitectureNodeType;
  technology?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  position_x?: number;
  position_y?: number;
}

export interface CopyVersionInput {
  name?: string;
  description?: string;
}

export interface GeneratedPreviewNode {
  id: string;
  node_key: string;
  name: string;
  type: ArchitectureNodeType;
  technology?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  position_x: number;
  position_y: number;
}

export interface GeneratedPreviewEdge {
  source: string;
  target: string;
  source_node_key: string;
  target_node_key: string;
  relationship: ArchitectureRelationship;
  protocol?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ArchitecturePreview {
  name: string;
  summary: string;
  assumptions: string[];
  nodes: GeneratedPreviewNode[];
  edges: GeneratedPreviewEdge[];
  technologies: string[];
  securityConsiderations: string[];
  scalabilityConsiderations: string[];
  risks: string[];
}

export interface ArchitecturePreviewResponse {
  preview: true;
  architecture: ArchitecturePreview;
}

export interface SaveArchitectureVersionInput {
  name?: string;
  description?: string;
  nodes: Array<{
    node_key: string;
    name: string;
    type: ArchitectureNodeType;
    technology?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown>;
    position_x?: number;
    position_y?: number;
  }>;
  edges: Array<{
    source_node_key: string;
    target_node_key: string;
    relationship: ArchitectureRelationship;
    protocol?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}

// ─── API Functions ─────────────────────────────────────────────────────────────

export async function generateArchitecture(projectId: string): Promise<ArchitecturePreviewResponse> {
  const response = await apiClient.post<{ success: boolean; data: ArchitecturePreviewResponse }>(
    `/api/v1/projects/${projectId}/architecture/generate`,
    undefined,
    { timeout: 60000 }
  );
  return response.data.data;
}

export async function saveArchitectureVersion(
  projectId: string,
  data: SaveArchitectureVersionInput
): Promise<ArchitectureGraph> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureGraph }>(
    `/api/v1/projects/${projectId}/architecture/versions`,
    data,
    { timeout: 60000 }
  );
  return response.data.data;
}

export async function getArchitecture(projectId: string): Promise<ArchitectureGraph> {
  const response = await apiClient.get<{ success: boolean; data: ArchitectureGraph }>(
    `/api/v1/projects/${projectId}/architecture`
  );
  return response.data.data;
}

export const getLatestArchitecture = getArchitecture;

export async function getArchitectureVersions(projectId: string): Promise<ArchitectureVersion[]> {
  const response = await apiClient.get<{ success: boolean; data: ArchitectureVersion[] }>(
    `/api/v1/projects/${projectId}/architecture/versions`
  );
  return response.data.data;
}

export async function getArchitectureVersion(
  projectId: string,
  versionId: string
): Promise<ArchitectureGraph> {
  const response = await apiClient.get<{ success: boolean; data: ArchitectureGraph }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}`
  );
  return response.data.data;
}

export async function createArchitectureVersion(
  projectId: string,
  data: CreateVersionInput
): Promise<ArchitectureVersion> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureVersion }>(
    `/api/v1/projects/${projectId}/architecture/versions`,
    data
  );
  return response.data.data;
}

export async function updateArchitectureVersion(
  projectId: string,
  versionId: string,
  data: UpdateVersionInput
): Promise<ArchitectureVersion> {
  const response = await apiClient.patch<{ success: boolean; data: ArchitectureVersion }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}`,
    data
  );
  return response.data.data;
}

export async function deleteArchitectureVersion(
  projectId: string,
  versionId: string
): Promise<void> {
  await apiClient.delete(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}`
  );
}

export async function publishArchitectureVersion(
  projectId: string,
  versionId: string
): Promise<ArchitectureVersion> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureVersion }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/publish`
  );
  return response.data.data;
}

export async function duplicateArchitectureVersion(
  projectId: string,
  versionId: string,
  data?: CopyVersionInput
): Promise<ArchitectureGraph> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureGraph }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/duplicate`,
    data ?? {}
  );
  return response.data.data;
}

export async function restoreArchitectureVersion(
  projectId: string,
  versionId: string
): Promise<ArchitectureGraph> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureGraph }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/restore`
  );
  return response.data.data;
}

// ─── Node API ─────────────────────────────────────────────────────────────────

export async function createArchitectureNode(
  projectId: string,
  versionId: string,
  data: CreateNodeInput
): Promise<ArchitectureNode> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureNode }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/nodes`,
    data
  );
  return response.data.data;
}

export async function updateArchitectureNode(
  projectId: string,
  versionId: string,
  nodeId: string,
  data: UpdateNodeInput
): Promise<ArchitectureNode> {
  const response = await apiClient.patch<{ success: boolean; data: ArchitectureNode }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/nodes/${nodeId}`,
    data
  );
  return response.data.data;
}

export async function deleteArchitectureNode(
  projectId: string,
  versionId: string,
  nodeId: string
): Promise<void> {
  await apiClient.delete(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/nodes/${nodeId}`
  );
}

// ─── Edge API ─────────────────────────────────────────────────────────────────

export async function createArchitectureEdge(
  projectId: string,
  versionId: string,
  data: CreateEdgeInput
): Promise<ArchitectureEdge> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureEdge }>(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/edges`,
    data
  );
  return response.data.data;
}

export async function deleteArchitectureEdge(
  projectId: string,
  versionId: string,
  edgeId: string
): Promise<void> {
  await apiClient.delete(
    `/api/v1/projects/${projectId}/architecture/versions/${versionId}/edges/${edgeId}`
  );
}

// ─── Compare API ──────────────────────────────────────────────────────────────

export interface ArchitectureComparison {
  added: ArchitectureNode[];
  removed: ArchitectureNode[];
  modified: ArchitectureNode[];
  unchanged: ArchitectureNode[];
  summary: {
    addedNodes: number;
    removedNodes: number;
    modifiedNodes: number;
    addedEdges: number;
    removedEdges: number;
    technologyChanges: number;
  };
}

export async function compareArchitectureVersions(
  projectId: string,
  fromVersionId: string,
  toVersionId: string
): Promise<ArchitectureComparison> {
  const response = await apiClient.get<{ success: boolean; data: ArchitectureComparison }>(
    `/api/v1/projects/${projectId}/architecture/compare`,
    { params: { from: fromVersionId, to: toVersionId } }
  );
  return response.data.data;
}

// ─── Timeline API ─────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  project_id: string;
  workspace_id: string;
  user_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getTimelineEvents(projectId: string): Promise<TimelineEvent[]> {
  const response = await apiClient.get<{ success: boolean; data: TimelineEvent[] }>(
    `/api/v1/projects/${projectId}/architecture/timeline`
  );
  return response.data.data;
}

// ─── Architecture Snapshots API ───────────────────────────────────────────────

export interface ArchitectureSnapshot {
  id: string;
  project_id: string;
  architecture_version_id?: string;
  version_id?: string;
  name: string;
  description: string | null;
  type?: string;
  snapshot_data: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export async function getArchitectureSnapshots(projectId: string): Promise<ArchitectureSnapshot[]> {
  const response = await apiClient.get<{ success: boolean; data: ArchitectureSnapshot[] }>(
    `/api/v1/projects/${projectId}/architecture/snapshots`
  );
  return response.data.data;
}

export async function createArchitectureSnapshot(
  projectId: string,
  data: {
    version_id?: string;
    architecture_version_id?: string;
    name: string;
    description?: string;
    type?: string;
  }
): Promise<ArchitectureSnapshot> {
  const versionId = data.architecture_version_id || data.version_id;
  const response = await apiClient.post<{ success: boolean; data: ArchitectureSnapshot }>(
    `/api/v1/projects/${projectId}/architecture/snapshots`,
    {
      architecture_version_id: versionId,
      version_id: versionId,
      name: data.name,
      description: data.description || undefined,
      type: data.type || "milestone",
    }
  );
  return response.data.data;
}

export async function restoreArchitectureSnapshot(
  projectId: string,
  snapshotId: string
): Promise<ArchitectureGraph> {
  const response = await apiClient.post<{ success: boolean; data: ArchitectureGraph }>(
    `/api/v1/projects/${projectId}/architecture/snapshots/${snapshotId}/restore`
  );
  return response.data.data;
}

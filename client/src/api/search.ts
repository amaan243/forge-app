import apiClient from "./client";

export interface SearchProjectResult {
  id: string;
  name: string;
  description: string | null;
  workspace_id: string;
}

export interface SearchNodeResult {
  id: string;
  name: string;
  type: string;
  architecture_version_id: string;
}

export interface SearchDocumentationResult {
  id: string;
  title: string;
  type: string;
  project_id: string;
}

export interface SearchRepositoryResult {
  id: string;
  repository_name: string;
  repository_url: string;
  project_id: string;
}

export interface SearchSnapshotResult {
  id: string;
  name: string;
  type: string;
  project_id: string;
}

export interface SearchTimelineResult {
  id: string;
  event_type: string;
  entity_type: string;
  project_id: string;
}

export interface GlobalSearchResults {
  projects: SearchProjectResult[];
  nodes: SearchNodeResult[];
  documentation: SearchDocumentationResult[];
  repositories: SearchRepositoryResult[];
  snapshots: SearchSnapshotResult[];
  timeline: SearchTimelineResult[];
}

export async function searchGlobal(query: string): Promise<GlobalSearchResults> {
  const response = await apiClient.get<{ success: boolean; data: GlobalSearchResults }>(
    "/api/v1/search",
    { params: { q: query } }
  );
  return response.data.data;
}

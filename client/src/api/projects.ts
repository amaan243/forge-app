import apiClient from "./client";

export type ProjectStatus = "active" | "archived" | "deleted";
export type ProjectVisibility = "private" | "workspace";

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  workspace_id?: string;
  name: string;
  slug?: string;
  description?: string;
  visibility?: ProjectVisibility;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: "active" | "archived";
  visibility?: ProjectVisibility;
}

export async function createProject(
  workspaceId: string,
  data: Omit<CreateProjectInput, "workspace_id">
): Promise<Project> {
  const response = await apiClient.post<{ success: boolean; data: Project }>(
    `/api/v1/workspaces/${workspaceId}/projects`,
    data
  );
  return response.data.data;
}

export async function getProjects(workspaceId?: string): Promise<Project[]> {
  const url = workspaceId
    ? `/api/v1/workspaces/${workspaceId}/projects`
    : "/api/v1/projects";
  const response = await apiClient.get<{ success: boolean; data: Project[] }>(url);
  return response.data.data;
}

export async function getProject(id: string): Promise<Project> {
  const response = await apiClient.get<{ success: boolean; data: Project }>(
    `/api/v1/projects/${id}`
  );
  return response.data.data;
}

export async function updateProject(
  id: string,
  data: UpdateProjectInput
): Promise<Project> {
  const response = await apiClient.patch<{ success: boolean; data: Project }>(
    `/api/v1/projects/${id}`,
    data
  );
  return response.data.data;
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/projects/${id}`);
}

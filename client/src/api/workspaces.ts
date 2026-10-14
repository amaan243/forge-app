import apiClient from "./client";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
}

export interface CreateWorkspaceInput {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
}

export async function createWorkspace(data: CreateWorkspaceInput): Promise<Workspace> {
  const response = await apiClient.post<{ success: boolean; data: Workspace }>(
    "/api/v1/workspaces",
    data
  );
  return response.data.data;
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const response = await apiClient.get<{ success: boolean; data: Workspace[] }>(
    "/api/v1/workspaces"
  );
  return response.data.data;
}

export async function getWorkspace(id: string): Promise<Workspace> {
  const response = await apiClient.get<{ success: boolean; data: Workspace }>(
    `/api/v1/workspaces/${id}`
  );
  return response.data.data;
}

export async function updateWorkspace(
  id: string,
  data: UpdateWorkspaceInput
): Promise<Workspace> {
  const response = await apiClient.patch<{ success: boolean; data: Workspace }>(
    `/api/v1/workspaces/${id}`,
    data
  );
  return response.data.data;
}

export async function deleteWorkspace(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/workspaces/${id}`);
}

export async function getWorkspaceMembers(id: string): Promise<WorkspaceMember[]> {
  const response = await apiClient.get<{ success: boolean; data: WorkspaceMember[] }>(
    `/api/v1/workspaces/${id}/members`
  );
  return response.data.data;
}

export async function addWorkspaceMember(
  workspaceId: string,
  input: { user_id: string; role?: "admin" | "member" | "viewer" }
): Promise<WorkspaceMember> {
  const response = await apiClient.post<{ success: boolean; data: WorkspaceMember }>(
    `/api/v1/workspaces/${workspaceId}/members`,
    input
  );
  return response.data.data;
}

export async function updateWorkspaceMember(
  workspaceId: string,
  memberId: string,
  input: { role: "admin" | "member" | "viewer" }
): Promise<WorkspaceMember> {
  const response = await apiClient.patch<{ success: boolean; data: WorkspaceMember }>(
    `/api/v1/workspaces/${workspaceId}/members/${memberId}`,
    input
  );
  return response.data.data;
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string
): Promise<void> {
  await apiClient.delete(`/api/v1/workspaces/${workspaceId}/members/${memberId}`);
}

export interface WorkspaceSettings {
  workspace_id: string;
  visibility: "private" | "workspace";
  default_architecture_settings: Record<string, unknown>;
  updated_at: string;
}

export async function getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
  const response = await apiClient.get<{ success: boolean; data: WorkspaceSettings }>(
    `/api/v1/workspaces/${workspaceId}/settings`
  );
  return response.data.data;
}

export async function updateWorkspaceSettings(
  workspaceId: string,
  input: { visibility?: "private" | "workspace"; default_architecture_settings?: Record<string, unknown> }
): Promise<WorkspaceSettings> {
  const response = await apiClient.patch<{ success: boolean; data: WorkspaceSettings }>(
    `/api/v1/workspaces/${workspaceId}/settings`,
    input
  );
  return response.data.data;
}


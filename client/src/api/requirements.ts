import apiClient from "./client";

export interface Requirement {
  id: string;
  project_id: string;
  content: string;
  version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRequirementInput {
  content: string;
}

export interface UpdateRequirementInput {
  content: string;
}

export async function getRequirements(projectId: string): Promise<Requirement[]> {
  const response = await apiClient.get<{ success: boolean; data: Requirement[] }>(
    `/api/v1/projects/${projectId}/requirements`
  );
  return response.data.data;
}

export async function createRequirement(
  projectId: string,
  data: CreateRequirementInput
): Promise<Requirement> {
  const response = await apiClient.post<{ success: boolean; data: Requirement }>(
    `/api/v1/projects/${projectId}/requirements`,
    data
  );
  return response.data.data;
}

export async function updateRequirement(
  projectId: string,
  requirementId: string,
  data: UpdateRequirementInput
): Promise<Requirement> {
  const response = await apiClient.patch<{ success: boolean; data: Requirement }>(
    `/api/v1/projects/${projectId}/requirements/${requirementId}`,
    data
  );
  return response.data.data;
}

export async function deleteRequirement(
  projectId: string,
  requirementId: string
): Promise<void> {
  await apiClient.delete(`/api/v1/projects/${projectId}/requirements/${requirementId}`);
}

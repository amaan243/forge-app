import apiClient from "./client";

export type ExportType =
  | "architecture"
  | "documentation"
  | "project_story"
  | "dependency_graph"
  | "drift_report"
  | "version_comparison"
  | "full_project_report";

export type ExportFormat = "json" | "markdown" | "pdf" | "svg" | "png";

export type ExportStatus = "queued" | "running" | "completed" | "failed";

export interface ProjectExport {
  id: string;
  project_id: string;
  type: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  file_path: string | null;
  storage_path: string | null;
  download_url?: string;
  metadata: {
    bytes?: number;
    error?: string;
    [key: string]: unknown;
  };
  requested_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface CreateExportInput {
  type: ExportType;
  format: ExportFormat;
}

export async function getProjectExports(projectId: string): Promise<ProjectExport[]> {
  const response = await apiClient.get<{ success: boolean; data: ProjectExport[] }>(
    `/api/v1/projects/${projectId}/exports`
  );
  return response.data.data;
}

export async function createProjectExport(
  projectId: string,
  input: CreateExportInput
): Promise<ProjectExport> {
  const response = await apiClient.post<{ success: boolean; data: ProjectExport }>(
    `/api/v1/projects/${projectId}/exports`,
    input
  );
  return response.data.data;
}

export async function getExport(projectId: string, exportId: string): Promise<ProjectExport> {
  const response = await apiClient.get<{ success: boolean; data: ProjectExport }>(
    `/api/v1/projects/${projectId}/exports/${exportId}`
  );
  return response.data.data;
}

export async function getProjectExportData(projectId: string): Promise<unknown> {
  const response = await apiClient.get<{ success: boolean; data: unknown }>(
    `/api/v1/projects/${projectId}/export-data`
  );
  return response.data.data;
}

export interface AuditEvent {
  id: string;
  workspace_id: string;
  project_id: string | null;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getProjectAuditEvents(projectId: string): Promise<AuditEvent[]> {
  const response = await apiClient.get<{ success: boolean; data: AuditEvent[] }>(
    `/api/v1/projects/${projectId}/audit`
  );
  return response.data.data;
}

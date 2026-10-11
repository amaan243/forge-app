import apiClient from "./client";

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

export type DocumentationFormat =
  | "markdown"
  | "html"
  | "mermaid"
  | "openapi_json"
  | "openapi_yaml";

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
  generation_metadata?: {
    hasArchitectureSource?: boolean;
    hasRepositorySource?: boolean;
    generatedAt?: string;
    [key: string]: unknown;
  } | null;
  generated_by: string;
  status: "up_to_date" | "outdated";
  manually_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentationStalenessItem {
  id: string;
  title: string;
  type: DocumentationType;
  status: "up_to_date" | "outdated";
  manually_edited: boolean;
  source_version_id?: string | null;
  source_repository_analysis_id?: string | null;
  source_commit_sha?: string | null;
  latest_analysis_id?: string | null;
  latest_commit_sha?: string | null;
  is_analysis_stale: boolean;
  updated_at: string;
}

export interface GenerateDocumentationInput {
  type: DocumentationType;
  title: string;
  format: DocumentationFormat;
  version_id?: string | null;
  repository_analysis_id?: string | null;
  repository_id?: string | null;
  snapshot_branch?: string | null;
  custom_prompt?: string;
  force_overwrite?: boolean;
}

export interface UpdateDocumentationInput {
  title?: string;
  content?: string;
  format?: DocumentationFormat;
}

export interface RegenerateDocumentationInput {
  section?: string;
  force_overwrite?: boolean;
}

export async function getDocumentations(
  projectId: string
): Promise<DocumentationDocument[]> {
  const response = await apiClient.get<{ success: boolean; data: DocumentationDocument[] }>(
    `/api/v1/projects/${projectId}/documentation`
  );
  return response.data.data;
}

export async function getDocumentationStaleness(
  projectId: string
): Promise<DocumentationStalenessItem[]> {
  const response = await apiClient.get<{ success: boolean; data: DocumentationStalenessItem[] }>(
    `/api/v1/projects/${projectId}/documentation/staleness`
  );
  return response.data.data;
}

export async function getDocumentation(
  projectId: string,
  documentId: string
): Promise<DocumentationDocument> {
  const response = await apiClient.get<{ success: boolean; data: DocumentationDocument }>(
    `/api/v1/projects/${projectId}/documentation/${documentId}`
  );
  return response.data.data;
}

export async function generateDocumentation(
  projectId: string,
  input: GenerateDocumentationInput
): Promise<DocumentationDocument> {
  const response = await apiClient.post<{ success: boolean; data: DocumentationDocument }>(
    `/api/v1/projects/${projectId}/documentation/generate`,
    input
  );
  return response.data.data;
}

export async function updateDocumentation(
  projectId: string,
  documentId: string,
  input: UpdateDocumentationInput
): Promise<DocumentationDocument> {
  const response = await apiClient.patch<{ success: boolean; data: DocumentationDocument }>(
    `/api/v1/projects/${projectId}/documentation/${documentId}`,
    input
  );
  return response.data.data;
}

export async function deleteDocumentation(
  projectId: string,
  documentId: string
): Promise<void> {
  await apiClient.delete(`/api/v1/projects/${projectId}/documentation/${documentId}`);
}

export async function regenerateDocumentation(
  projectId: string,
  documentId: string,
  input?: RegenerateDocumentationInput
): Promise<DocumentationDocument> {
  const response = await apiClient.post<{ success: boolean; data: DocumentationDocument }>(
    `/api/v1/projects/${projectId}/documentation/${documentId}/regenerate`,
    input ?? { section: "all", force_overwrite: false }
  );
  return response.data.data;
}

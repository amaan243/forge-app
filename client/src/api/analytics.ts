import apiClient from "./client";

export interface AnalyticsMetrics {
  architectureVersions: number;
  architectureNodes: number;
  architectureEdges: number;
  repositoryDependencies: number;
  repositoryHealth: Record<string, unknown>;
  driftScore: number | null;
  documentationCoverage: number;
  simulationCount: number;
  architectureComplexity: number;
  [key: string]: unknown;
}

export interface AnalyticsSnapshot {
  id?: string;
  project_id: string;
  snapshot_date: string;
  metrics: AnalyticsMetrics;
  created_at?: string;
}

export type ProjectAnalytics = AnalyticsSnapshot;

export interface ProjectInsights {
  architectureVersions: number;
  architectureComplexity: number;
  repositoryHealth: {
    id?: string;
    commit_sha?: string;
    status?: string;
    metrics?: Record<string, unknown>;
    created_at?: string;
    [key: string]: unknown;
  } | null;
  driftStatus: {
    id?: string;
    match_score?: number;
    status?: string;
    summary?: string;
    counts?: Record<string, unknown>;
    created_at?: string;
    [key: string]: unknown;
  } | null;
  documentationStatus: Record<string, number>;
  recentActivity: Array<Record<string, unknown>>;
  simulationCount: number;
  storyAvailable: boolean;
  quality_gate?: {
    status?: string;
    score?: number;
    passed?: boolean;
    [key: string]: unknown;
  };
  recommendations?: Array<{
    title?: string;
    action?: string;
    impact?: string;
    type?: string;
    [key: string]: unknown;
  }>;
  findings?: Array<{
    id?: string;
    title?: string;
    severity?: string;
    description?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface AnalyticsQueryParams {
  from?: string;
  to?: string;
  metric?: string;
}

export async function getProjectAnalytics(
  projectId: string,
  params?: AnalyticsQueryParams
): Promise<AnalyticsSnapshot | AnalyticsSnapshot[]> {
  const response = await apiClient.get<{
    success: boolean;
    data: AnalyticsSnapshot | AnalyticsSnapshot[];
  }>(`/api/v1/projects/${projectId}/analytics`, { params });
  return response.data.data;
}

export async function getProjectInsights(projectId: string): Promise<ProjectInsights> {
  const response = await apiClient.get<{ success: boolean; data: ProjectInsights }>(
    `/api/v1/projects/${projectId}/insights`
  );
  return response.data.data;
}

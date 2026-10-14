import apiClient from "./client";

export interface ProjectStoryContent {
  problem: string;
  requirements: string[];
  architecture: string[];
  importantDecisions: string[];
  technologyChoices: string[];
  dataFlow: Array<{ source_node_id?: string; target_node_id?: string; [key: string]: unknown }>;
  security: string[];
  scalability: string[];
  tradeOffs: string[];
  evolution: string[];
  currentState: string;
  [key: string]: unknown;
}

export interface ProjectStory {
  id?: string;
  project_id: string;
  content: ProjectStoryContent;
  generated_by?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getProjectStory(projectId: string): Promise<ProjectStory | null> {
  const response = await apiClient.get<{ success: boolean; data: ProjectStory | null }>(
    `/api/v1/projects/${projectId}/story`
  );
  return response.data.data;
}

export async function generateProjectStory(projectId: string): Promise<ProjectStory> {
  const response = await apiClient.post<{ success: boolean; data: ProjectStory }>(
    `/api/v1/projects/${projectId}/story/generate`,
    {}
  );
  return response.data.data;
}

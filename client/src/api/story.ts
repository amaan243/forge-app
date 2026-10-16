import apiClient from "./client";

export interface ImportantDecisionItem {
  decision: string;
  rationale?: string;
  tradeOff?: string;
  [key: string]: unknown;
}

export interface TechnologyChoiceItem {
  name: string;
  category?: string;
  reason?: string;
  [key: string]: unknown;
}

export interface ProjectStoryContent {
  problem?: string;
  requirements?: Array<string | { id?: string; title?: string; description?: string; [key: string]: unknown }>;
  architecture?: Array<string | { name?: string; type?: string; [key: string]: unknown }>;
  importantDecisions?: Array<string | ImportantDecisionItem>;
  technologyChoices?: Array<string | TechnologyChoiceItem>;
  dataFlow?: Array<string | { source_node_id?: string; target_node_id?: string; relationship?: string; protocol?: string; [key: string]: unknown }>;
  security?: Array<string | unknown>;
  scalability?: Array<string | unknown>;
  tradeOffs?: Array<string | unknown>;
  evolution?: Array<string | unknown>;
  currentState?: string;
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

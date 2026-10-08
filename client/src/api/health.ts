import apiClient from "./client";

export interface HealthResponse {
  success: boolean;
  status: string;
  database?: "ok" | "unavailable";
  redis?: "ok" | "unavailable";
  timestamp?: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>("/health");
  return response.data;
}

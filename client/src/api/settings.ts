import apiClient from "./client";
import type { User } from "./auth";

export interface UserSettings {
  user_id: string;
  theme: string;
  default_workspace: string | null;
  notifications: Record<string, boolean>;
  ai_preferences: Record<string, unknown>;
  editor_preferences: Record<string, unknown>;
  updated_at: string;
}

export interface UpdateSettingsInput {
  theme?: string;
  default_workspace?: string | null;
  notifications?: Record<string, unknown>;
  ai_preferences?: Record<string, unknown>;
  editor_preferences?: Record<string, unknown>;
}

export interface UpdateProfileInput {
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  company?: string;
  role?: string;
}

export async function getUserSettings(): Promise<UserSettings> {
  const response = await apiClient.get<{ success: boolean; data: UserSettings }>(
    "/api/v1/settings"
  );
  return response.data.data;
}

export async function updateUserSettings(input: UpdateSettingsInput): Promise<UserSettings> {
  const response = await apiClient.patch<{ success: boolean; data: UserSettings }>(
    "/api/v1/settings",
    input
  );
  return response.data.data;
}

export async function getUserProfile(): Promise<User> {
  const response = await apiClient.get<{ success: boolean; data: User }>(
    "/api/v1/me"
  );
  return response.data.data;
}

export async function updateUserProfile(input: UpdateProfileInput): Promise<User> {
  const response = await apiClient.patch<{ success: boolean; data: User }>(
    "/api/v1/me",
    input
  );
  return response.data.data;
}

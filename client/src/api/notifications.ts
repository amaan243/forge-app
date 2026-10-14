import apiClient from "./client";

export interface AppNotification {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id: string | null;
  type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getNotifications(): Promise<AppNotification[]> {
  const response = await apiClient.get<{ success: boolean; data: AppNotification[] }>(
    "/api/v1/notifications"
  );
  return response.data.data;
}

export async function markNotificationRead(notificationId: string): Promise<AppNotification> {
  const response = await apiClient.patch<{ success: boolean; data: AppNotification }>(
    `/api/v1/notifications/${notificationId}/read`
  );
  return response.data.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.post<{ success: boolean; message: string }>("/api/v1/notifications/read-all");
}

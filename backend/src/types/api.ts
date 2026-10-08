export interface ApiMeta { page?: number; limit?: number; total?: number }
export interface ApiError { code: string; details?: unknown }
export interface ApiResponse<T> { success: boolean; message: string; data?: T; error?: ApiError; meta?: ApiMeta }

export interface AuthenticatedUser { id: string; email?: string; role?: string; userMetadata: Record<string, unknown> }
export interface AuthenticatedRequest extends Express.Request { user: AuthenticatedUser; userId: string; requestId: string }

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type ProjectStatus = "active" | "archived" | "deleted";
export type ProjectVisibility = "private" | "workspace";
export interface Profile { id: string; full_name: string | null; avatar_url: string | null; username: string | null; bio: string | null; created_at: string; updated_at: string }
export interface Workspace { id: string; name: string; slug: string; description: string | null; owner_id: string; created_at: string; updated_at: string }
export interface WorkspaceMember { id: string; workspace_id: string; user_id: string; role: WorkspaceRole; created_at: string }
export interface Project { id: string; workspace_id: string; name: string; slug: string; description: string | null; status: ProjectStatus; visibility: ProjectVisibility; created_by: string; created_at: string; updated_at: string }
export interface Requirement { id: string; project_id: string; content: string; version: number; created_by: string; created_at: string; updated_at: string }
import { supabaseAdmin } from "../lib/supabase.js";
import type { Workspace, WorkspaceMember } from "../types/api.js";

export const workspaceRepository = {
  async findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const { data, error } = await supabaseAdmin.from("workspace_members").select("*").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
    if (error) throw error; return data as WorkspaceMember | null;
  },
  async create(input: { name: string; slug: string; description?: string; owner_id: string }): Promise<Workspace> {
    const { data, error } = await supabaseAdmin.from("workspaces").insert(input).select().single();
    if (error) throw error; return data as Workspace;
  },
  async listForUser(userId: string): Promise<Workspace[]> {
    const { data, error } = await supabaseAdmin.from("workspaces").select("*, workspace_members!inner(user_id)").eq("workspace_members.user_id", userId).order("created_at", { ascending: false });
    if (error) throw error; return data as Workspace[];
  },
  async findById(id: string): Promise<Workspace | null> { const { data, error } = await supabaseAdmin.from("workspaces").select().eq("id", id).maybeSingle(); if (error) throw error; return data as Workspace | null; },
  async update(id: string, input: Record<string, unknown>): Promise<Workspace> { const { data, error } = await supabaseAdmin.from("workspaces").update(input).eq("id", id).select().single(); if (error) throw error; return data as Workspace; },
  async remove(id: string): Promise<void> { const { error } = await supabaseAdmin.from("workspaces").delete().eq("id", id); if (error) throw error; },
  async members(workspaceId: string): Promise<WorkspaceMember[]> { const { data, error } = await supabaseAdmin.from("workspace_members").select().eq("workspace_id", workspaceId); if (error) throw error; return data as WorkspaceMember[]; },
  async addMember(input: { workspace_id: string; user_id: string; role: string }): Promise<WorkspaceMember> { const { data, error } = await supabaseAdmin.from("workspace_members").insert(input).select().single(); if (error) throw error; return data as WorkspaceMember; },
  async updateMember(id: string, input: { role: string }): Promise<WorkspaceMember> { const { data, error } = await supabaseAdmin.from("workspace_members").update(input).eq("id", id).select().single(); if (error) throw error; return data as WorkspaceMember; },
  async removeMember(id: string): Promise<void> { const { error } = await supabaseAdmin.from("workspace_members").delete().eq("id", id); if (error) throw error; },
};
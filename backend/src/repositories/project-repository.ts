import { supabaseAdmin } from "../lib/supabase.js";
import type { Project, Requirement } from "../types/api.js";
import { ConflictError } from "../errors/app-error.js";

export const projectRepository = {
  async create(input: Record<string, unknown>): Promise<Project> {
    let finalSlug = String(input.slug);
    let data: any = null;
    let attempts = 0;
    while (attempts < 3) {
      const res = await supabaseAdmin.from("projects").insert({ ...input, slug: finalSlug }).select().single();
      if (!res.error) {
        data = res.data;
        break;
      }
      if (res.error.code === "23505") {
        attempts++;
        finalSlug = `${input.slug}-${Math.random().toString(36).substring(2, 6)}`;
      } else {
        throw res.error;
      }
    }
    if (!data) throw new ConflictError("A project with this slug already exists in this workspace");
    return data as Project;
  },
  async list(workspaceId: string): Promise<Project[]> {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select()
      .eq("workspace_id", workspaceId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Project[];
  },
  async listForUser(userId: string): Promise<Project[]> {
    const { data: members, error: memErr } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId);
    if (memErr) throw memErr;
    const workspaceIds = (members || []).map((m: any) => m.workspace_id);
    if (workspaceIds.length === 0) return [];
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select()
      .in("workspace_id", workspaceIds)
      .neq("status", "deleted")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data as Project[];
  },
  async findById(id: string): Promise<Project | null> {
    const { data, error } = await supabaseAdmin
      .from("projects")
      .select()
      .eq("id", id)
      .neq("status", "deleted")
      .maybeSingle();
    if (error) throw error;
    return data as Project | null;
  },
  async update(id: string, input: Record<string, unknown>): Promise<Project> {
    const { data, error } = await supabaseAdmin.from("projects").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data as Project;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from("projects").update({ status: "deleted" }).eq("id", id);
    if (error) throw error;
  },
  async requirements(projectId: string): Promise<Requirement[]> {
    const { data, error } = await supabaseAdmin.from("project_requirements").select().eq("project_id", projectId).order("version", { ascending: false });
    if (error) throw error;
    return data as Requirement[];
  },
  async findRequirement(id: string): Promise<Requirement | null> {
    const { data, error } = await supabaseAdmin.from("project_requirements").select().eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Requirement | null;
  },
  async createRequirement(input: Record<string, unknown>): Promise<Requirement> {
    const { data, error } = await supabaseAdmin.from("project_requirements").insert(input).select().single();
    if (error) throw error;
    return data as Requirement;
  },
  async updateRequirement(id: string, input: Record<string, unknown>): Promise<Requirement> {
    const { data, error } = await supabaseAdmin.from("project_requirements").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data as Requirement;
  },
  async removeRequirement(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from("project_requirements").delete().eq("id", id);
    if (error) throw error;
  },
};
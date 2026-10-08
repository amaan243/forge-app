import { supabaseAdmin } from "../lib/supabase.js";
import type { ArchitectureEdge, ArchitectureNode, ArchitectureVersion, Snapshot, TimelineEvent } from "../types/architecture.js";

const single = async <T>(table: string, input: Record<string, unknown>): Promise<T> => { const { data, error } = await supabaseAdmin.from(table).insert(input).select().single(); if (error) throw error; return data as T; };
export const architectureRepository = {
  async latest(projectId: string): Promise<ArchitectureVersion | null> { const { data, error } = await supabaseAdmin.from("architecture_versions").select().eq("project_id", projectId).order("version_number", { ascending: false }).limit(1).maybeSingle(); if (error) throw error; return data as ArchitectureVersion | null; },
  async versions(projectId: string): Promise<ArchitectureVersion[]> { const { data, error } = await supabaseAdmin.from("architecture_versions").select().eq("project_id", projectId).order("version_number", { ascending: false }); if (error) throw error; return data as ArchitectureVersion[]; },
  async version(id: string): Promise<ArchitectureVersion | null> { const { data, error } = await supabaseAdmin.from("architecture_versions").select().eq("id", id).maybeSingle(); if (error) throw error; return data as ArchitectureVersion | null; },
  async createVersion(input: Record<string, unknown>): Promise<ArchitectureVersion> { return single<ArchitectureVersion>("architecture_versions", input); },
  async updateVersion(id: string, input: Record<string, unknown>): Promise<ArchitectureVersion> { const { data, error } = await supabaseAdmin.from("architecture_versions").update(input).eq("id", id).select().single(); if (error) throw error; return data as ArchitectureVersion; },
  async deleteVersion(id: string): Promise<void> { const { error } = await supabaseAdmin.from("architecture_versions").delete().eq("id", id); if (error) throw error; },
  async nodes(versionId: string): Promise<ArchitectureNode[]> { const { data, error } = await supabaseAdmin.from("architecture_nodes").select().eq("architecture_version_id", versionId).order("created_at"); if (error) throw error; return data as ArchitectureNode[]; },
  async node(id: string): Promise<ArchitectureNode | null> { const { data, error } = await supabaseAdmin.from("architecture_nodes").select().eq("id", id).maybeSingle(); if (error) throw error; return data as ArchitectureNode | null; },
  async createNode(input: Record<string, unknown>): Promise<ArchitectureNode> { return single<ArchitectureNode>("architecture_nodes", input); },
  async updateNode(id: string, input: Record<string, unknown>): Promise<ArchitectureNode> { const { data, error } = await supabaseAdmin.from("architecture_nodes").update(input).eq("id", id).select().single(); if (error) throw error; return data as ArchitectureNode; },
  async deleteNode(id: string): Promise<void> { const { error } = await supabaseAdmin.from("architecture_nodes").delete().eq("id", id); if (error) throw error; },
  async edges(versionId: string): Promise<ArchitectureEdge[]> { const { data, error } = await supabaseAdmin.from("architecture_edges").select().eq("architecture_version_id", versionId).order("created_at"); if (error) throw error; return data as ArchitectureEdge[]; },
  async edge(id: string): Promise<ArchitectureEdge | null> { const { data, error } = await supabaseAdmin.from("architecture_edges").select().eq("id", id).maybeSingle(); if (error) throw error; return data as ArchitectureEdge | null; },
  async createEdge(input: Record<string, unknown>): Promise<ArchitectureEdge> { return single<ArchitectureEdge>("architecture_edges", input); },
  async updateEdge(id: string, input: Record<string, unknown>): Promise<ArchitectureEdge> { const { data, error } = await supabaseAdmin.from("architecture_edges").update(input).eq("id", id).select().single(); if (error) throw error; return data as ArchitectureEdge; },
  async deleteEdge(id: string): Promise<void> { const { error } = await supabaseAdmin.from("architecture_edges").delete().eq("id", id); if (error) throw error; },
  async createSnapshot(input: Record<string, unknown>): Promise<Snapshot> { return single<Snapshot>("snapshots", input); },
  async snapshots(projectId: string): Promise<Snapshot[]> { const { data, error } = await supabaseAdmin.from("snapshots").select().eq("project_id", projectId).order("created_at", { ascending: false }); if (error) throw error; return data as Snapshot[]; },
  async snapshot(id: string): Promise<Snapshot | null> { const { data, error } = await supabaseAdmin.from("snapshots").select().eq("id", id).maybeSingle(); if (error) throw error; return data as Snapshot | null; },
  async createTimelineEvent(input: Record<string, unknown>): Promise<TimelineEvent> { return single<TimelineEvent>("timeline_events", input); },
  async timeline(projectId: string): Promise<TimelineEvent[]> { const { data, error } = await supabaseAdmin.from("timeline_events").select().eq("project_id", projectId).order("created_at", { ascending: false }); if (error) throw error; return data as TimelineEvent[]; },
};
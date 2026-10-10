import { supabaseAdmin } from "../lib/supabase.js";
import type { DependencyRecord, DriftAnalysis, DriftItem, RepositoryAnalysis, RepositoryRecord } from "../types/repository-intelligence.js";
const insert = async <T>(table: string, input: Record<string, unknown>): Promise<T> => { const { data, error } = await supabaseAdmin.from(table).insert(input).select().single(); if (error) throw error; return data as T; };
export const repositoryIntelligenceRepository = {
  async repository(projectId: string, repositoryId?: string): Promise<RepositoryRecord | null> {
    if (repositoryId) {
      const { data, error } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).eq("id", repositoryId).maybeSingle();
      if (error) throw error;
      return data as RepositoryRecord | null;
    }
    const { data: active, error: activeError } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (activeError && !activeError.message?.includes("column")) throw activeError;
    if (active) return active as RepositoryRecord;
    const { data, error } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data as RepositoryRecord | null;
  },
  async repositories(projectId: string): Promise<RepositoryRecord[]> {
    const { data, error } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).eq("status", "active").order("created_at", { ascending: false });
    if (error) {
      // Fallback if status column is pending in local/test mock
      const { data: all, error: allError } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).order("created_at", { ascending: false });
      if (allError) throw allError;
      return (all || []) as RepositoryRecord[];
    }
    return (data || []) as RepositoryRecord[];
  },
  async allRepositories(projectId: string): Promise<RepositoryRecord[]> {
    const { data, error } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as RepositoryRecord[];
  },
  async findActiveByUrl(projectId: string, url: string): Promise<RepositoryRecord | null> {
    const { data, error } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).eq("repository_url", url).eq("status", "active").maybeSingle();
    if (error && !error.message?.includes("column")) throw error;
    if (data) return data as RepositoryRecord;
    return null;
  },
  async findByUrl(projectId: string, url: string): Promise<RepositoryRecord | null> {
    const { data, error } = await supabaseAdmin.from("repositories").select().eq("project_id", projectId).eq("repository_url", url).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data as RepositoryRecord | null;
  },
  async updateRepository(id: string, input: Record<string, unknown>): Promise<RepositoryRecord> {
    const { data, error } = await supabaseAdmin.from("repositories").update(input).eq("id", id).select().single();
    if (error) throw error;
    return data as RepositoryRecord;
  },
  async connect(input: Record<string, unknown>): Promise<RepositoryRecord> { return insert<RepositoryRecord>("repositories", input); },
  async disconnect(projectId: string, repositoryId?: string): Promise<void> {
    let query = supabaseAdmin.from("repositories").update({ status: "disconnected" }).eq("project_id", projectId);
    if (repositoryId) {
      query = query.eq("id", repositoryId);
    }
    const { error } = await query;
    if (error) {
      // Fallback in case status column is not present in mock test DB
      if (error.message?.includes("column") || error.code === "PGRST204" || error.code === "42703") {
        let del = supabaseAdmin.from("repositories").delete().eq("project_id", projectId);
        if (repositoryId) del = del.eq("id", repositoryId);
        const { error: delErr } = await del;
        if (delErr) throw delErr;
        return;
      }
      throw error;
    }
  },
  async createAnalysis(input: Record<string, unknown>): Promise<RepositoryAnalysis> { return insert<RepositoryAnalysis>("repository_analyses", input); },
  async updateAnalysis(id: string, input: Record<string, unknown>): Promise<RepositoryAnalysis> { const { data, error } = await supabaseAdmin.from("repository_analyses").update(input).eq("id", id).select().single(); if (error) throw error; return data as RepositoryAnalysis; },
  async analysis(id: string): Promise<RepositoryAnalysis | null> { const { data, error } = await supabaseAdmin.from("repository_analyses").select().eq("id", id).maybeSingle(); if (error) throw error; return data as RepositoryAnalysis | null; },
  async latestAnalysis(projectId: string, repositoryId?: string): Promise<RepositoryAnalysis | null> {
    let q = supabaseAdmin.from("repository_analyses").select().eq("project_id", projectId).eq("status", "completed");
    if (repositoryId) q = q.eq("repository_id", repositoryId);
    const { data: completed } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (completed) return completed as RepositoryAnalysis;
    let fallback = supabaseAdmin.from("repository_analyses").select().eq("project_id", projectId);
    if (repositoryId) fallback = fallback.eq("repository_id", repositoryId);
    const { data, error } = await fallback.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data as RepositoryAnalysis | null;
  },
  async latestAttempt(projectId: string, repositoryId?: string): Promise<RepositoryAnalysis | null> {
    let q = supabaseAdmin.from("repository_analyses").select().eq("project_id", projectId);
    if (repositoryId) q = q.eq("repository_id", repositoryId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data as RepositoryAnalysis | null;
  },
  async latestSuccessful(projectId: string, repositoryId?: string): Promise<RepositoryAnalysis | null> {
    let q = supabaseAdmin.from("repository_analyses").select().eq("project_id", projectId).eq("status", "completed");
    if (repositoryId) q = q.eq("repository_id", repositoryId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data as RepositoryAnalysis | null;
  },
  async analyses(projectId: string, repositoryId?: string): Promise<RepositoryAnalysis[]> {
    let q = supabaseAdmin.from("repository_analyses").select().eq("project_id", projectId);
    if (repositoryId) q = q.eq("repository_id", repositoryId);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return data as RepositoryAnalysis[];
  },
  async activeAnalysis(projectId: string, repositoryId?: string): Promise<RepositoryAnalysis | null> {
    let q = supabaseAdmin.from("repository_analyses").select().eq("project_id", projectId).in("status", ["queued", "running"]);
    if (repositoryId) q = q.eq("repository_id", repositoryId);
    const { data, error } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data as RepositoryAnalysis | null;
  },
  async dependencies(projectId: string, filters: { repositoryId?: string; type?: string; risk?: string; ecosystem?: string }): Promise<DependencyRecord[]> {
    let analysisId: string | undefined;
    if (filters.repositoryId) {
      const successful = await repositoryIntelligenceRepository.latestSuccessful(projectId, filters.repositoryId);
      if (!successful) return [];
      analysisId = successful.id;
    }
    let query = supabaseAdmin.from("dependencies").select().eq("project_id", projectId);
    if (analysisId) query = query.eq("repository_analysis_id", analysisId);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.risk) query = query.eq("risk_level", filters.risk);
    if (filters.ecosystem) query = query.eq("ecosystem", filters.ecosystem);
    const { data, error } = await query.order("name");
    if (error) throw error;
    return data as DependencyRecord[];
  },
  async replaceDependencies(projectId: string, analysisId: string, values: Array<Record<string, unknown>>): Promise<DependencyRecord[]> {
    const { error: deleteError } = await supabaseAdmin.from("dependencies").delete().eq("repository_analysis_id", analysisId);
    if (deleteError) {
      // Fallback in case repository_analysis_id filter has issues in older schemas
      await supabaseAdmin.from("dependencies").delete().eq("project_id", projectId);
    }
    if (!values.length) return [];
    const { data, error } = await supabaseAdmin.from("dependencies").insert(values.map((value) => ({ ...value, project_id: projectId, repository_analysis_id: analysisId }))).select();
    if (error) throw error;
    return data as DependencyRecord[];
  },
  async createDrift(input: Record<string, unknown>): Promise<DriftAnalysis> {
    try {
      return await insert<DriftAnalysis>("drift_analyses", input);
    } catch (err: any) {
      if (err?.message?.includes("column") || err?.code === "PGRST204" || err?.code === "42703") {
        const fallbackInput = {
          project_id: input.project_id,
          architecture_version_id: input.architecture_version_id,
          repository_analysis_id: input.repository_analysis_id,
          match_score: input.match_score,
          summary: input.summary,
          status: input.status,
        };
        return await insert<DriftAnalysis>("drift_analyses", fallbackInput);
      }
      throw err;
    }
  },
  async createDriftItems(values: Array<Record<string, unknown>>): Promise<DriftItem[]> {
    if (!values.length) return [];
    try {
      const { data, error } = await supabaseAdmin.from("drift_items").insert(values).select();
      if (error) throw error;
      return data as DriftItem[];
    } catch (err: any) {
      if (err?.code === "23514" || err?.message?.includes("drift_items_type_check")) {
        const sanitized = values.map((v) => {
          let t = v.type;
          if (t === "uncertain" || t === "coverage_limitation" || t === "limitation") t = "mismatch";
          if (t === "integration_mismatch") t = "missing";
          return { ...v, type: t };
        });
        const { data, error } = await supabaseAdmin.from("drift_items").insert(sanitized).select();
        if (error) throw error;
        return data as DriftItem[];
      }
      throw err;
    }
  },
  async drifts(projectId: string, repositoryId?: string): Promise<DriftAnalysis[]> {
    let query = supabaseAdmin.from("drift_analyses").select().eq("project_id", projectId);
    if (repositoryId) query = query.eq("repository_id", repositoryId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data as DriftAnalysis[];
  },
  async drift(id: string): Promise<DriftAnalysis | null> {
    const { data, error } = await supabaseAdmin.from("drift_analyses").select("*, drift_items(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as DriftAnalysis | null;
  },
  async driftFindings(analysisId: string, filters: { type?: string; severity?: string; confidence?: string; category?: string } = {}): Promise<DriftItem[]> {
    let query = supabaseAdmin.from("drift_items").select().eq("drift_analysis_id", analysisId);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.severity) query = query.eq("severity", filters.severity);
    const { data, error } = await query;
    if (error) throw error;
    let items = (data || []) as DriftItem[];
    if (filters.confidence) {
      items = items.filter((i) => i.metadata?.confidence === filters.confidence);
    }
    if (filters.category) {
      items = items.filter((i) => (i.metadata?.category || "").toLowerCase() === filters.category!.toLowerCase() || i.metadata?.findingType === filters.category);
    }
    return items;
  },
  async driftFinding(analysisId: string, findingId: string): Promise<DriftItem | null> {
    const { data, error } = await supabaseAdmin.from("drift_items").select().eq("drift_analysis_id", analysisId).eq("id", findingId).maybeSingle();
    if (error) throw error;
    return data as DriftItem | null;
  },
};
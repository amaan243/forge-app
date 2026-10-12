import { supabaseAdmin } from "../lib/supabase.js";
import type { ImpactReport } from "../types/engineering-impact.js";

function mapRowToReport(row: Record<string, unknown>): ImpactReport {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    architectureVersionId: String(row.architecture_version_id),
    repositoryId: row.repository_id ? String(row.repository_id) : null,
    repositoryAnalysisId: row.repository_analysis_id ? String(row.repository_analysis_id) : null,
    targetEntity: row.target_entity as ImpactReport["targetEntity"],
    proposedChange: row.proposed_change as ImpactReport["proposedChange"],
    sourceContext: row.source_context as ImpactReport["sourceContext"],
    mappingSummary: row.mapping_summary as ImpactReport["mappingSummary"],
    dependencyGraph: row.dependency_graph as ImpactReport["dependencyGraph"],
    impactSummary: row.impact_summary as ImpactReport["impactSummary"],
    riskAssessment: row.risk_assessment as ImpactReport["riskAssessment"],
    changePlan: row.change_plan as ImpactReport["changePlan"],
    driftCorrelations: (row.drift_correlations as ImpactReport["driftCorrelations"]) || [],
    playgroundBridge: (row.playground_bridge as ImpactReport["playgroundBridge"]) || {
      supported: false,
      simulationCandidateChanges: [],
      evaluableMetrics: [],
      unevaluableMetrics: [],
      explanation: "",
    },
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

export const engineeringImpactRepository = {
  async createReport(input: Omit<ImpactReport, "id" | "createdAt">): Promise<ImpactReport> {
    const { data, error } = await supabaseAdmin
      .from("impact_reports")
      .insert({
        project_id: input.projectId,
        workspace_id: input.workspaceId,
        architecture_version_id: input.architectureVersionId,
        repository_id: input.repositoryId || null,
        repository_analysis_id: input.repositoryAnalysisId || null,
        target_entity: input.targetEntity,
        proposed_change: input.proposedChange,
        source_context: input.sourceContext,
        mapping_summary: input.mappingSummary,
        dependency_graph: input.dependencyGraph,
        impact_summary: input.impactSummary,
        risk_assessment: input.riskAssessment,
        change_plan: input.changePlan,
        drift_correlations: input.driftCorrelations,
        playground_bridge: input.playgroundBridge,
        created_by: input.createdBy,
      })
      .select()
      .single();

    if (error) throw error;
    return mapRowToReport(data as Record<string, unknown>);
  },

  async listReports(projectId: string): Promise<ImpactReport[]> {
    const { data, error } = await supabaseAdmin
      .from("impact_reports")
      .select()
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return ((data || []) as Record<string, unknown>[]).map(mapRowToReport);
  },

  async getReport(projectId: string, id: string): Promise<ImpactReport | null> {
    const { data, error } = await supabaseAdmin
      .from("impact_reports")
      .select()
      .eq("project_id", projectId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapRowToReport(data as Record<string, unknown>);
  },

  async deleteReport(projectId: string, id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("impact_reports")
      .delete()
      .eq("project_id", projectId)
      .eq("id", id);

    if (error) throw error;
  },
};

import { supabaseAdmin } from "../lib/supabase.js";
import type { WorkflowRun, WorkflowStageKey, WorkflowStageResult } from "../types/workflow-orchestration.js";

function mapRowToRun(row: Record<string, unknown>): WorkflowRun {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    architectureVersionId: row.architecture_version_id ? String(row.architecture_version_id) : null,
    repositoryId: row.repository_id ? String(row.repository_id) : null,
    repositoryAnalysisId: row.repository_analysis_id ? String(row.repository_analysis_id) : null,
    branch: row.branch ? String(row.branch) : null,
    commitSha: row.commit_sha ? String(row.commit_sha) : null,
    status: (row.status as WorkflowRun["status"]) || "completed",
    stages: (row.stages as Record<WorkflowStageKey, WorkflowStageResult>) || ({} as Record<WorkflowStageKey, WorkflowStageResult>),
    readinessGate: (row.readiness_gate as WorkflowRun["readinessGate"]) || {
      decision: "not_evaluated",
      summary: "Not evaluated",
      checks: [],
      blockers: [],
      warnings: [],
      nextSteps: [],
      evaluatedAt: new Date().toISOString(),
    },
    summary: (row.summary as WorkflowRun["summary"]) || {
      totalStages: 7,
      completedStages: 0,
      failedStages: 0,
      stagesNeedingAttention: 0,
      reusedStages: 0,
      staleStages: 0,
      overallVerdict: "not_evaluated",
      primaryNextStep: "",
    },
    sourceContext: (row.source_context as WorkflowRun["sourceContext"]) || {},
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export const workflowOrchestrationRepository = {
  async createRun(input: Omit<WorkflowRun, "id" | "createdAt">): Promise<WorkflowRun> {
    const { data, error } = await supabaseAdmin
      .from("workflow_runs")
      .insert({
        project_id: input.projectId,
        workspace_id: input.workspaceId,
        architecture_version_id: input.architectureVersionId || null,
        repository_id: input.repositoryId || null,
        repository_analysis_id: input.repositoryAnalysisId || null,
        branch: input.branch || null,
        commit_sha: input.commitSha || null,
        status: input.status,
        stages: input.stages,
        readiness_gate: input.readinessGate,
        summary: input.summary,
        source_context: input.sourceContext,
        created_by: input.createdBy,
        completed_at: input.completedAt || new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return mapRowToRun(data as Record<string, unknown>);
  },

  async updateRun(
    id: string,
    updates: Partial<Pick<WorkflowRun, "status" | "stages" | "readinessGate" | "summary" | "completedAt">>
  ): Promise<WorkflowRun> {
    const payload: Record<string, unknown> = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.stages !== undefined) payload.stages = updates.stages;
    if (updates.readinessGate !== undefined) payload.readiness_gate = updates.readinessGate;
    if (updates.summary !== undefined) payload.summary = updates.summary;
    if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;

    const { data, error } = await supabaseAdmin
      .from("workflow_runs")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return mapRowToRun(data as Record<string, unknown>);
  },

  async listRuns(projectId: string): Promise<WorkflowRun[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("workflow_runs")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[workflowOrchestrationRepository] listRuns warning:", error.message);
        return [];
      }
      return ((data || []) as Record<string, unknown>[]).map(mapRowToRun);
    } catch (err) {
      console.warn("[workflowOrchestrationRepository] listRuns caught error:", err);
      return [];
    }
  },

  async getRun(projectId: string, id: string): Promise<WorkflowRun | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("workflow_runs")
        .select()
        .eq("project_id", projectId)
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.warn("[workflowOrchestrationRepository] getRun warning:", error.message);
        return null;
      }
      if (!data) return null;
      return mapRowToRun(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[workflowOrchestrationRepository] getRun caught error:", err);
      return null;
    }
  },

  async latestRun(projectId: string): Promise<WorkflowRun | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("workflow_runs")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[workflowOrchestrationRepository] latestRun warning:", error.message);
        return null;
      }
      if (!data) return null;
      return mapRowToRun(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[workflowOrchestrationRepository] latestRun caught error:", err);
      return null;
    }
  },
};

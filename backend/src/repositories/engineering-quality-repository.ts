import { supabaseAdmin } from "../lib/supabase.js";
import type {
  QualityReport,
  QualityPolicyDefinition,
  VerificationEvidenceRecord,
} from "../types/engineering-quality.js";

function mapRowToReport(row: Record<string, unknown>): QualityReport {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    workspaceId: String(row.workspace_id),
    architectureVersionId: row.architecture_version_id ? String(row.architecture_version_id) : null,
    repositoryId: row.repository_id ? String(row.repository_id) : null,
    repositoryAnalysisId: row.repository_analysis_id ? String(row.repository_analysis_id) : null,
    baselineArchitectureVersionId: row.baseline_architecture_version_id ? String(row.baseline_architecture_version_id) : null,
    baselineRepositoryAnalysisId: row.baseline_repository_analysis_id ? String(row.baseline_repository_analysis_id) : null,
    baselineQualityReportId: row.baseline_quality_report_id ? String(row.baseline_quality_report_id) : null,
    policyId: String(row.policy_id),
    policyName: String(row.policy_name),
    policyVersion: String(row.policy_version || "1.0.0"),
    readinessVerdict: row.readiness_verdict as QualityReport["readinessVerdict"],
    summary: String(row.summary),
    checks: (row.checks as QualityReport["checks"]) || [],
    categorySummaries: (row.category_summaries as QualityReport["categorySummaries"]) || ({} as QualityReport["categorySummaries"]),
    metrics: (row.metrics as QualityReport["metrics"]) || {
      totalChecks: 0,
      passed: 0,
      failed: 0,
      warning: 0,
      blocked: 0,
      notEvaluated: 0,
      mandatoryChecks: 0,
      mandatoryPassed: 0,
      mandatoryFailed: 0,
    },
    blockers: (row.blockers as string[]) || [],
    warnings: (row.warnings as string[]) || [],
    requiredActions: (row.required_actions as QualityReport["requiredActions"]) || [],
    baselineComparison: (row.baseline_comparison as QualityReport["baselineComparison"]) || null,
    sourceContext: (row.source_context as QualityReport["sourceContext"]) || {},
    evidenceSources: (row.evidence_sources as Record<string, unknown>) || {},
    createdBy: row.created_by ? String(row.created_by) : null,
    createdAt: String(row.created_at),
  };
}

function mapRowToEvidence(row: Record<string, unknown>): VerificationEvidenceRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    repositoryId: row.repository_id ? String(row.repository_id) : null,
    commitSha: String(row.commit_sha),
    branch: row.branch ? String(row.branch) : null,
    buildStatus: row.build_status as VerificationEvidenceRecord["buildStatus"],
    buildCommand: row.build_command ? String(row.build_command) : null,
    buildDurationMs: row.build_duration_ms ? Number(row.build_duration_ms) : null,
    buildOutput: row.build_output ? String(row.build_output) : null,
    testStatus: row.test_status as VerificationEvidenceRecord["testStatus"],
    testFramework: row.test_framework ? String(row.test_framework) : null,
    testsTotal: Number(row.tests_total || 0),
    testsPassed: Number(row.tests_passed || 0),
    testsFailed: Number(row.tests_failed || 0),
    testsSkipped: Number(row.tests_skipped || 0),
    testDurationMs: row.test_duration_ms ? Number(row.test_duration_ms) : null,
    coveragePercent: row.coverage_percent !== null && row.coverage_percent !== undefined ? Number(row.coverage_percent) : null,
    errorSummary: row.error_summary ? String(row.error_summary) : null,
    securityScanStatus: (row.security_scan_status as VerificationEvidenceRecord["securityScanStatus"]) || null,
    securityScannerName: row.security_scanner_name ? String(row.security_scanner_name) : null,
    securityAdvisoriesCount: Number(row.security_advisories_count || 0),
    executedBy: String(row.executed_by || "manual"),
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.created_at),
  };
}

export const engineeringQualityRepository = {
  async createReport(input: Omit<QualityReport, "id" | "createdAt">): Promise<QualityReport> {
    const { data, error } = await supabaseAdmin
      .from("quality_reports")
      .insert({
        project_id: input.projectId,
        workspace_id: input.workspaceId,
        architecture_version_id: input.architectureVersionId || null,
        repository_id: input.repositoryId || null,
        repository_analysis_id: input.repositoryAnalysisId || null,
        baseline_architecture_version_id: input.baselineArchitectureVersionId || null,
        baseline_repository_analysis_id: input.baselineRepositoryAnalysisId || null,
        baseline_quality_report_id: input.baselineQualityReportId || null,
        policy_id: input.policyId,
        policy_name: input.policyName,
        policy_version: input.policyVersion || "1.0.0",
        readiness_verdict: input.readinessVerdict,
        summary: input.summary,
        checks: input.checks,
        category_summaries: input.categorySummaries,
        metrics: input.metrics,
        blockers: input.blockers,
        warnings: input.warnings,
        required_actions: input.requiredActions,
        baseline_comparison: input.baselineComparison || null,
        source_context: input.sourceContext,
        evidence_sources: input.evidenceSources,
        created_by: input.createdBy || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapRowToReport(data as Record<string, unknown>);
  },

  async listReports(projectId: string): Promise<QualityReport[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("quality_reports")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[engineeringQualityRepository] listReports warning:", error.message);
        return [];
      }
      return ((data || []) as Record<string, unknown>[]).map(mapRowToReport);
    } catch (err) {
      console.warn("[engineeringQualityRepository] listReports caught error:", err);
      return [];
    }
  },

  async getReport(projectId: string, reportId: string): Promise<QualityReport | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("quality_reports")
        .select()
        .eq("project_id", projectId)
        .eq("id", reportId)
        .maybeSingle();

      if (error) {
        console.warn("[engineeringQualityRepository] getReport warning:", error.message);
        return null;
      }
      if (!data) return null;
      return mapRowToReport(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[engineeringQualityRepository] getReport caught error:", err);
      return null;
    }
  },

  async latestReport(projectId: string): Promise<QualityReport | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("quality_reports")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[engineeringQualityRepository] latestReport warning:", error.message);
        return null;
      }
      if (!data) return null;
      return mapRowToReport(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[engineeringQualityRepository] latestReport caught error:", err);
      return null;
    }
  },

  async createEvidence(input: Omit<VerificationEvidenceRecord, "id" | "createdAt"> & { createdBy?: string | null }): Promise<VerificationEvidenceRecord> {
    const { data, error } = await supabaseAdmin
      .from("quality_verification_evidence")
      .insert({
        project_id: input.projectId,
        repository_id: input.repositoryId || null,
        commit_sha: input.commitSha,
        branch: input.branch || null,
        build_status: input.buildStatus,
        build_command: input.buildCommand || null,
        build_duration_ms: input.buildDurationMs || null,
        build_output: input.buildOutput || null,
        test_status: input.testStatus,
        test_framework: input.testFramework || null,
        tests_total: input.testsTotal,
        tests_passed: input.testsPassed,
        tests_failed: input.testsFailed,
        tests_skipped: input.testsSkipped,
        test_duration_ms: input.testDurationMs || null,
        coverage_percent: input.coveragePercent || null,
        error_summary: input.errorSummary || null,
        security_scan_status: input.securityScanStatus || null,
        security_scanner_name: input.securityScannerName || null,
        security_advisories_count: input.securityAdvisoriesCount,
        executed_by: input.executedBy || "manual",
        metadata: input.metadata || {},
        created_by: input.createdBy || null,
      })
      .select()
      .single();

    if (error) throw error;
    return mapRowToEvidence(data as Record<string, unknown>);
  },

  async latestEvidence(projectId: string, commitSha?: string | null): Promise<VerificationEvidenceRecord | null> {
    try {
      let query = supabaseAdmin
        .from("quality_verification_evidence")
        .select()
        .eq("project_id", projectId);

      if (commitSha) {
        query = query.eq("commit_sha", commitSha);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("[engineeringQualityRepository] latestEvidence warning:", error.message);
        return null;
      }
      if (!data) return null;
      return mapRowToEvidence(data as Record<string, unknown>);
    } catch (err) {
      console.warn("[engineeringQualityRepository] latestEvidence caught error:", err);
      return null;
    }
  },

  async listEvidence(projectId: string): Promise<VerificationEvidenceRecord[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("quality_verification_evidence")
        .select()
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[engineeringQualityRepository] listEvidence warning:", error.message);
        return [];
      }
      return ((data || []) as Record<string, unknown>[]).map(mapRowToEvidence);
    } catch (err) {
      console.warn("[engineeringQualityRepository] listEvidence caught error:", err);
      return [];
    }
  },

  async getCustomPolicies(projectId: string): Promise<QualityPolicyDefinition[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("quality_policies")
        .select()
        .eq("project_id", projectId);

      if (error) {
        console.warn("[engineeringQualityRepository] getCustomPolicies warning:", error.message);
        return [];
      }

      return ((data || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        projectId: String(row.project_id),
        name: String(row.name),
        description: String(row.description),
        mandatoryCheckIds: (row.mandatory_check_ids as string[]) || [],
        severityThresholds: (row.severity_thresholds as QualityPolicyDefinition["severityThresholds"]) || { maxCritical: 0, maxHigh: 0 },
        isCustom: Boolean(row.is_custom),
      }));
    } catch (err) {
      console.warn("[engineeringQualityRepository] getCustomPolicies caught error:", err);
      return [];
    }
  },

  async upsertPolicy(projectId: string, policy: QualityPolicyDefinition): Promise<QualityPolicyDefinition> {
    const { data, error } = await supabaseAdmin
      .from("quality_policies")
      .upsert({
        project_id: projectId,
        id: policy.id,
        name: policy.name,
        description: policy.description,
        mandatory_check_ids: policy.mandatoryCheckIds,
        severity_thresholds: policy.severityThresholds,
        is_custom: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      name: String(row.name),
      description: String(row.description),
      mandatoryCheckIds: (row.mandatory_check_ids as string[]) || [],
      severityThresholds: (row.severity_thresholds as QualityPolicyDefinition["severityThresholds"]) || { maxCritical: 0, maxHigh: 0 },
      isCustom: Boolean(row.is_custom),
    };
  },
};

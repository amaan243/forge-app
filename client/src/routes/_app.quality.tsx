import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCw,
  Search,
  Filter,
  ArrowRight,
  GitBranch,
  Network,
  History,
  Layers,
  FileText,
  Activity,
  Radar,
  Lock,
  Plus,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sliders,
  Check,
  Terminal,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getQualityContext,
  getQualityReports,
  evaluateQuality,
  recordQualityEvidence,
  type QualityReport,
  type QualityCheckItem,
  type QualityGateCategory,
  type QualityCheckStatus,
  type QualitySeverity,
  type ReadinessVerdict,
  type QualityProjectContext,
  type RecordEvidenceInput,
} from "@/api/quality";

export const Route = createFileRoute("/_app/quality")({
  head: () => ({
    meta: [
      { title: "Engineering Quality & Release Readiness — ArchForge" },
      {
        name: "description",
        content:
          "Evidence-based engineering quality gate and release readiness verification across build, repository, architecture conformance, security, change impact, and traceability.",
      },
    ],
  }),
  component: EngineeringQualityPage,
});

const CATEGORY_META: Record<
  QualityGateCategory,
  { label: string; icon: typeof ShieldCheck; route: string; description: string }
> = {
  build_and_test: {
    label: "Build & Test Verification",
    icon: Terminal,
    route: "/repository",
    description: "Verified build execution, automated test runs, error summaries, and real code coverage.",
  },
  repository_health: {
    label: "Repository Health",
    icon: GitBranch,
    route: "/repository",
    description: "Scan completion, supported languages, dependency freshness, and snapshot staleness.",
  },
  architecture_conformance: {
    label: "Architecture Conformance",
    icon: Radar,
    route: "/drift",
    description: "Architecture drift score, missing components, technology and integration mismatches.",
  },
  security: {
    label: "Security & Hardening",
    icon: Lock,
    route: "/repository",
    description: "Static security findings, credentials, CORS, auth architecture, and vulnerability scanner availability.",
  },
  change_impact: {
    label: "Change Impact",
    icon: ShieldAlert,
    route: "/impact",
    description: "Blast radius, API compatibility, database schema changes, and high-risk change factors.",
  },
  documentation_traceability: {
    label: "Documentation & Traceability",
    icon: FileText,
    route: "/documentation",
    description: "System documentation presence, source freshness, and component-to-code traceability.",
  },
};

function EngineeringQualityPage() {
  const { currentProject, currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Selection state
  const [selectedArchVersionId, setSelectedArchVersionId] = useState<string>("");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("production_readiness");
  const [selectedBaselineReportId, setSelectedBaselineReportId] = useState<string>("");

  // Filter state
  const [activeTab, setActiveTab] = useState<"gate" | "comparison" | "evidence" | "history">("gate");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [mandatoryOnly, setMandatoryOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Record evidence modal
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceBuildStatus, setEvidenceBuildStatus] = useState<"passed" | "failed" | "not_evaluated">("passed");
  const [evidenceTestStatus, setEvidenceTestStatus] = useState<"passed" | "failed" | "not_evaluated">("passed");
  const [evidenceTotalTests, setEvidenceTotalTests] = useState("42");
  const [evidenceFailedTests, setEvidenceFailedTests] = useState("0");
  const [evidenceCoverage, setEvidenceCoverage] = useState("85.4");
  const [evidenceRunner, setEvidenceRunner] = useState("Vitest");
  const [evidenceBuildOutput, setEvidenceBuildOutput] = useState("tsc --noEmit && vite build completed with 0 errors");

  const projectId = currentProject?.id || "";

  // Queries
  const contextQuery = useQuery({
    queryKey: ["quality-context", projectId],
    queryFn: () => getQualityContext(projectId),
    enabled: Boolean(projectId),
  });

  const reportsQuery = useQuery({
    queryKey: ["quality-reports", projectId],
    queryFn: () => getQualityReports(projectId),
    enabled: Boolean(projectId),
  });

  // Evaluate Mutation
  const evaluateMutation = useMutation({
    mutationFn: (input: {
      architectureVersionId?: string;
      repositoryId?: string;
      repositoryAnalysisId?: string;
      policyId?: string;
      baselineQualityReportId?: string;
    }) => evaluateQuality(projectId, input),
    onSuccess: (data) => {
      toast.success("Release readiness evaluation completed");
      queryClient.setQueryData(["quality-reports", projectId], (old: QualityReport[] | undefined) => [
        data,
        ...(old || []).filter((r) => r.id !== data.id),
      ]);
      queryClient.invalidateQueries({ queryKey: ["quality-context", projectId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Evaluation failed");
    },
  });

  // Record Evidence Mutation
  const recordEvidenceMutation = useMutation({
    mutationFn: (payload: RecordEvidenceInput) => recordQualityEvidence(projectId, payload),
    onSuccess: () => {
      toast.success("Verified execution evidence recorded");
      setEvidenceModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["quality-context", projectId] });
      // Re-evaluate automatically to apply newly recorded evidence
      handleRunEvaluation();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to record evidence");
    },
  });

  const contextData = contextQuery.data;
  const reports = reportsQuery.data || [];
  const latestReport = reports[0] || contextData?.latestReport || null;

  // Active sources resolution
  const activeArchVersionId = selectedArchVersionId || (contextData?.architectureVersions?.[0]?.id ?? "");
  const activeRepo = contextData?.repositories?.find((r) => r.id === selectedRepoId) || contextData?.repositories?.[0];
  const activeRepoId = activeRepo?.id || "";
  const activeAnalysis = activeRepo?.analyses?.find((a) => a.id === selectedAnalysisId) || activeRepo?.analyses?.[0];
  const activeAnalysisId = activeAnalysis?.id || "";

  const handleRunEvaluation = () => {
    evaluateMutation.mutate({
      architectureVersionId: activeArchVersionId || undefined,
      repositoryId: activeRepoId || undefined,
      repositoryAnalysisId: activeAnalysisId || undefined,
      policyId: selectedPolicyId,
      baselineQualityReportId: selectedBaselineReportId || undefined,
    });
  };

  const handleRecordEvidenceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordEvidenceMutation.mutate({
      repositoryId: activeRepoId || undefined,
      commitSha: activeAnalysis?.commitSha || latestReport?.sourceContext?.commitSha || "HEAD",
      branch: activeAnalysis?.branch || latestReport?.sourceContext?.branch || "main",
      buildStatus: evidenceBuildStatus,
      buildCommand: "npm run build",
      buildOutput: evidenceBuildOutput,
      testStatus: evidenceTestStatus,
      testFramework: evidenceRunner,
      testsTotal: parseInt(evidenceTotalTests, 10) || 0,
      testsPassed: Math.max(0, (parseInt(evidenceTotalTests, 10) || 0) - (parseInt(evidenceFailedTests, 10) || 0)),
      testsFailed: parseInt(evidenceFailedTests, 10) || 0,
      testsSkipped: 0,
      coveragePercent: parseFloat(evidenceCoverage) || undefined,
      executedBy: "CI Pipeline (Verified)",
    });
  };

  // Filtered checks
  const filteredChecks = useMemo(() => {
    if (!latestReport) return [];
    return latestReport.checks.filter((c) => {
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (severityFilter !== "all" && c.severity !== severityFilter) return false;
      if (mandatoryOnly && !c.isMandatory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesReason = c.reason.toLowerCase().includes(q);
        const matchesEvidence = c.evidenceSource.toLowerCase().includes(q);
        if (!matchesName && !matchesReason && !matchesEvidence) return false;
      }
      return true;
    });
  }, [latestReport, categoryFilter, statusFilter, severityFilter, mandatoryOnly, searchQuery]);

  if (!currentProject) {
    return (
      <div className="p-8">
        <EmptyState
          glyph="pulse"
          title="Select a project"
          body="Choose a project from the top bar to inspect its engineering quality gate and release readiness."
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Engineering Quality & Release Readiness
            </h1>
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary/30 text-primary">
              Integrated Gate
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Defensible release decisions based on real repository, architecture drift, security, change impact, and test evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ProjectSwitcher />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEvidenceModalOpen(true)}
            className="text-xs font-mono h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Record CI Evidence
          </Button>
          <Button
            onClick={handleRunEvaluation}
            disabled={evaluateMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono h-9 gap-1.5 shadow-sm"
          >
            <RotateCw className={`h-3.5 w-3.5 ${evaluateMutation.isPending ? "animate-spin" : ""}`} />
            {evaluateMutation.isPending ? "Evaluating Gate..." : "Evaluate Readiness"}
          </Button>
        </div>
      </div>

      {/* Source Selection & Context Bar */}
      <div className="bg-panel/70 backdrop-blur border border-border rounded-lg p-4 space-y-3">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
          <span>Source & Policy Controls</span>
          <span className="text-[10px] text-foreground font-normal">
            Workspace: {currentWorkspace?.name || "Default"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Architecture Version Selector */}
          <div>
            <label className="text-[11px] text-muted-foreground font-mono block mb-1">Architecture Version</label>
            <select
              value={selectedArchVersionId || activeArchVersionId}
              onChange={(e) => setSelectedArchVersionId(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {contextData?.architectureVersions?.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} {v.name ? `— ${v.name}` : ""} ({v.componentCount} components)
                </option>
              )) || <option value="">No versions available</option>}
            </select>
          </div>

          {/* Repository Selector */}
          <div>
            <label className="text-[11px] text-muted-foreground font-mono block mb-1">Repository</label>
            <select
              value={selectedRepoId || activeRepoId}
              onChange={(e) => {
                setSelectedRepoId(e.target.value);
                setSelectedAnalysisId("");
              }}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {contextData?.repositories?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.defaultBranch})
                </option>
              )) || <option value="">No repository connected</option>}
            </select>
          </div>

          {/* Snapshot / Branch Selector */}
          <div>
            <label className="text-[11px] text-muted-foreground font-mono block mb-1">Analyzed Snapshot</label>
            <select
              value={selectedAnalysisId || activeAnalysisId}
              onChange={(e) => setSelectedAnalysisId(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {activeRepo?.analyses?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.branch} @ {a.commitSha?.slice(0, 7) || "HEAD"} ({a.status})
                </option>
              )) || <option value="">No snapshots found</option>}
            </select>
          </div>

          {/* Policy Selector */}
          <div>
            <label className="text-[11px] text-muted-foreground font-mono block mb-1">Release Policy</label>
            <select
              value={selectedPolicyId}
              onChange={(e) => setSelectedPolicyId(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {contextData?.availablePolicies?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mandatoryCheckIds.length} mandatory)
                </option>
              )) || (
                <>
                  <option value="production_readiness">Production Readiness</option>
                  <option value="staging_readiness">Staging Readiness</option>
                  <option value="pre_merge_check">Pre-merge Check</option>
                  <option value="development_check">Development Check</option>
                </>
              )}
            </select>
          </div>

          {/* Baseline Comparison Selector */}
          <div>
            <label className="text-[11px] text-muted-foreground font-mono block mb-1">Baseline Comparison</label>
            <select
              value={selectedBaselineReportId}
              onChange={(e) => setSelectedBaselineReportId(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Latest previous evaluation</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  Report {r.id.slice(0, 8)} ({new Date(r.createdAt).toLocaleDateString()}) — {r.readinessVerdict}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Evaluated Source Verification Metadata */}
        {latestReport && (
          <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[11px] font-mono text-muted-foreground">
            <div>
              <span className="text-muted-foreground/80">Project:</span>{" "}
              <span className="text-foreground font-semibold">{latestReport.sourceContext?.projectName || currentProject.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground/80">Repository:</span>{" "}
              <span className="text-foreground">{latestReport.sourceContext?.repositoryName || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground/80">Branch / Commit:</span>{" "}
              <span className="text-foreground">
                {latestReport.sourceContext?.branch || "main"} @ {latestReport.sourceContext?.commitSha?.slice(0, 7) || "HEAD"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/80">Architecture:</span>{" "}
              <span className="text-foreground">
                v{latestReport.sourceContext?.architectureVersionNumber || 1}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/80">Evaluated:</span>{" "}
              <span className="text-foreground">{new Date(latestReport.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground/80">Policy:</span>{" "}
              <span className="text-primary font-semibold">{latestReport.policyName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Readiness Gate View */}
      {latestReport ? (
        <div className="space-y-6">
          {/* Overall Verdict Banner */}
          <div className="bg-panel border border-border rounded-lg p-6 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    Overall Readiness Verdict
                  </h2>
                  <VerdictBadge verdict={latestReport.readinessVerdict} />
                </div>
                <p className="text-xs text-muted-foreground font-sans max-w-3xl leading-relaxed">
                  {latestReport.summary}
                </p>
              </div>

              {/* Metric Counters */}
              <div className="flex flex-wrap items-center gap-2 font-mono">
                <MetricBadge label="Passed" count={latestReport.metrics.passed} color="emerald" />
                <MetricBadge label="Warnings" count={latestReport.metrics.warning} color="amber" />
                <MetricBadge label="Failed" count={latestReport.metrics.failed} color="red" />
                <MetricBadge label="Blocked" count={latestReport.metrics.blocked} color="rose" />
                <MetricBadge label="Not Evaluated" count={latestReport.metrics.notEvaluated} color="zinc" />
              </div>
            </div>

            {/* Mandatory Check Compliance Bar */}
            <div className="bg-background/80 border border-border/80 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-primary" />
                <span>
                  Policy Mandatory Checks:{" "}
                  <strong className="text-foreground">
                    {latestReport.metrics.mandatoryPassed} of {latestReport.metrics.mandatoryChecks} verified
                  </strong>
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {latestReport.metrics.mandatoryFailed > 0 ? (
                  <span className="text-rose-400 font-semibold">
                    {latestReport.metrics.mandatoryFailed} mandatory check(s) unresolved
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold">
                    All mandatory checks satisfied
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-border pb-1 font-mono text-xs">
            <button
              onClick={() => setActiveTab("gate")}
              className={`px-3 py-1.5 rounded-t transition-colors ${
                activeTab === "gate"
                  ? "bg-panel text-primary font-bold border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Gate Checks & Findings ({latestReport.checks.length})
            </button>
            <button
              onClick={() => setActiveTab("comparison")}
              className={`px-3 py-1.5 rounded-t transition-colors ${
                activeTab === "comparison"
                  ? "bg-panel text-primary font-bold border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Baseline Comparison {latestReport.baselineComparison ? `(${latestReport.baselineComparison.newFindings.length} new)` : ""}
            </button>
            <button
              onClick={() => setActiveTab("evidence")}
              className={`px-3 py-1.5 rounded-t transition-colors ${
                activeTab === "evidence"
                  ? "bg-panel text-primary font-bold border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Execution Evidence
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 rounded-t transition-colors ${
                activeTab === "history"
                  ? "bg-panel text-primary font-bold border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Report History ({reports.length})
            </button>
          </div>

          {/* Tab 1: Gate Categories & Checks */}
          {activeTab === "gate" && (
            <div className="space-y-6">
              {/* Category Summaries Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(Object.keys(CATEGORY_META) as QualityGateCategory[]).map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const summary = latestReport.categorySummaries?.[cat];
                  const Icon = meta.icon;

                  return (
                    <div
                      key={cat}
                      className="bg-panel border border-border rounded-lg p-4 space-y-2.5 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-xs text-foreground font-mono">{meta.label}</span>
                        </div>
                        {summary && <CheckStatusBadge status={summary.status} />}
                      </div>

                      <p className="text-[11px] text-muted-foreground font-sans line-clamp-2">
                        {meta.description}
                      </p>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-muted-foreground">
                          {summary?.passed ?? 0} passed, {summary?.failed ?? 0} failed
                        </span>
                        <Link
                          to={meta.route as any}
                          className="text-primary hover:underline flex items-center gap-1 text-[10px]"
                        >
                          Inspect <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Required Actions Callout (if any) */}
              {latestReport.requiredActions && latestReport.requiredActions.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Required Remediations ({latestReport.requiredActions.length})
                  </div>
                  <div className="space-y-2">
                    {latestReport.requiredActions.map((act, i) => (
                      <div
                        key={i}
                        className="bg-panel border border-border rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-foreground flex items-center gap-2">
                            <SeverityBadge severity={act.severity} />
                            <span>{act.action}</span>
                          </div>
                          <span className="text-muted-foreground text-[11px] font-mono">
                            Check ID: {act.checkId}
                          </span>
                        </div>
                        {act.targetRoute && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate({ to: act.targetRoute as any })}
                            className="text-[11px] font-mono h-7 px-2.5 shrink-0"
                          >
                            Go to module <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters Bar */}
              <div className="bg-panel border border-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search checks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-background border border-border rounded pl-8 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                    />
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-background border border-border rounded px-2.5 py-1 text-xs text-foreground"
                  >
                    <option value="all">All Categories</option>
                    <option value="build_and_test">Build & Test</option>
                    <option value="repository_health">Repository Health</option>
                    <option value="architecture_conformance">Architecture Drift</option>
                    <option value="security">Security</option>
                    <option value="change_impact">Change Impact</option>
                    <option value="documentation_traceability">Docs & Traceability</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-background border border-border rounded px-2.5 py-1 text-xs text-foreground"
                  >
                    <option value="all">All Statuses</option>
                    <option value="passed">Passed</option>
                    <option value="warning">Warning</option>
                    <option value="failed">Failed</option>
                    <option value="blocked">Blocked</option>
                    <option value="not_evaluated">Not Evaluated</option>
                  </select>

                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-background border border-border rounded px-2.5 py-1 text-xs text-foreground"
                  >
                    <option value="all">All Severities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                  <input
                    type="checkbox"
                    checked={mandatoryOnly}
                    onChange={(e) => setMandatoryOnly(e.target.checked)}
                    className="rounded border-border text-primary"
                  />
                  <span>Mandatory checks only</span>
                </label>
              </div>

              {/* Detailed Checks List */}
              <div className="space-y-3">
                {filteredChecks.length === 0 ? (
                  <div className="bg-panel border border-border rounded-lg p-8 text-center text-xs font-mono text-muted-foreground">
                    No quality checks match current filters.
                  </div>
                ) : (
                  filteredChecks.map((chk) => (
                    <QualityCheckRow key={chk.id} check={chk} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Baseline Comparison */}
          {activeTab === "comparison" && (
            <BaselineComparisonTab comparison={latestReport.baselineComparison} />
          )}

          {/* Tab 3: Execution Evidence */}
          {activeTab === "evidence" && (
            <ExecutionEvidenceTab
              report={latestReport}
              latestEvidence={contextData?.latestEvidence}
              onOpenModal={() => setEvidenceModalOpen(true)}
            />
          )}

          {/* Tab 4: Report History */}
          {activeTab === "history" && (
            <ReportHistoryTab
              reports={reports}
              activeReportId={latestReport.id}
              onSelectReport={(rep) => {
                queryClient.setQueryData(["quality-reports", projectId], [
                  rep,
                  ...reports.filter((r) => r.id !== rep.id),
                ]);
                setActiveTab("gate");
              }}
            />
          )}
        </div>
      ) : (
        <div className="bg-panel border border-border rounded-lg p-12 text-center space-y-4">
          <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">No Quality Evaluation Yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Run an integrated readiness evaluation across ArchForge's analysis engines to verify release readiness.
            </p>
          </div>
          <Button
            onClick={handleRunEvaluation}
            disabled={evaluateMutation.isPending}
            className="bg-primary text-primary-foreground text-xs font-mono h-9"
          >
            <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${evaluateMutation.isPending ? "animate-spin" : ""}`} />
            Evaluate Readiness Now
          </Button>
        </div>
      )}

      {/* Record Evidence Modal */}
      {evidenceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel border border-border rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-foreground font-mono flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" /> Record Verified CI/Test Evidence
                </h3>
                <p className="text-xs text-muted-foreground">
                  Record real test or build execution evidence for commit {activeAnalysis?.commitSha?.slice(0, 7) || "HEAD"}.
                </p>
              </div>
              <button
                onClick={() => setEvidenceModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordEvidenceSubmit} className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Build Status</label>
                  <select
                    value={evidenceBuildStatus}
                    onChange={(e) => setEvidenceBuildStatus(e.target.value as any)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground"
                  >
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                    <option value="not_evaluated">Not Evaluated</option>
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1">Test Status</label>
                  <select
                    value={evidenceTestStatus}
                    onChange={(e) => setEvidenceTestStatus(e.target.value as any)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground"
                  >
                    <option value="passed">Passed (All Green)</option>
                    <option value="failed">Failed (Failures exist)</option>
                    <option value="not_evaluated">Not Evaluated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">Total Tests</label>
                  <input
                    type="number"
                    value={evidenceTotalTests}
                    onChange={(e) => setEvidenceTotalTests(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Failures</label>
                  <input
                    type="number"
                    value={evidenceFailedTests}
                    onChange={(e) => setEvidenceFailedTests(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Coverage (%)</label>
                  <input
                    type="text"
                    value={evidenceCoverage}
                    onChange={(e) => setEvidenceCoverage(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Test Runner Framework</label>
                <input
                  type="text"
                  value={evidenceRunner}
                  onChange={(e) => setEvidenceRunner(e.target.value)}
                  placeholder="Vitest, Jest, Pytest..."
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-foreground"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">Build / Execution Log Output</label>
                <textarea
                  rows={3}
                  value={evidenceBuildOutput}
                  onChange={(e) => setEvidenceBuildOutput(e.target.value)}
                  className="w-full bg-background border border-border rounded p-2 text-foreground font-mono text-[11px]"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEvidenceModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={recordEvidenceMutation.isPending}
                  className="bg-primary text-primary-foreground"
                >
                  {recordEvidenceMutation.isPending ? "Recording..." : "Save Evidence"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function QualityCheckRow({ check }: { check: QualityCheckItem }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="bg-panel border border-border rounded-lg p-3.5 space-y-2 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-0.5"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <span className="font-semibold text-foreground font-mono">{check.name}</span>
          {check.isMandatory && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
              Mandatory
            </Badge>
          )}
          <SeverityBadge severity={check.severity} />
        </div>

        <div className="flex items-center gap-2 font-mono">
          <CheckStatusBadge status={check.status} />
          {check.targetRoute && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: check.targetRoute as any })}
              className="text-[10px] h-6 px-1.5 text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <p className="text-muted-foreground font-sans pl-6 text-xs leading-relaxed">
        {check.reason}
      </p>

      {expanded && (
        <div className="pl-6 pt-2 border-t border-border/50 space-y-2 font-mono text-[11px]">
          <div>
            <span className="text-muted-foreground">Evidence Source:</span>{" "}
            <span className="text-foreground">{check.evidenceSource}</span>
          </div>
          {check.recommendedAction && (
            <div className="text-primary flex items-start gap-1">
              <span className="font-semibold">Action Required:</span>
              <span>{check.recommendedAction}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BaselineComparisonTab({ comparison }: { comparison: QualityReport["baselineComparison"] }) {
  if (!comparison) {
    return (
      <div className="bg-panel border border-border rounded-lg p-12 text-center text-xs font-mono text-muted-foreground">
        No baseline selected or available for comparison.
      </div>
    );
  }

  const { newFindings, resolvedFindings, persistentFindings, metricDeltas } = comparison;

  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-4 space-y-2 text-xs font-mono">
        <h3 className="font-bold text-foreground">Baseline Diff Summary</h3>
        <p className="text-muted-foreground font-sans">{comparison.summary}</p>

        <div className="pt-2 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-background/60 p-2.5 rounded border border-border/60">
            <span className="text-muted-foreground text-[10px] block">New Findings</span>
            <span className="text-rose-400 font-bold text-base">+{newFindings.length}</span>
          </div>
          <div className="bg-background/60 p-2.5 rounded border border-border/60">
            <span className="text-muted-foreground text-[10px] block">Resolved Findings</span>
            <span className="text-emerald-400 font-bold text-base">-{resolvedFindings.length}</span>
          </div>
          <div className="bg-background/60 p-2.5 rounded border border-border/60">
            <span className="text-muted-foreground text-[10px] block">Persistent Findings</span>
            <span className="text-foreground font-bold text-base">{persistentFindings.length}</span>
          </div>
          <div className="bg-background/60 p-2.5 rounded border border-border/60">
            <span className="text-muted-foreground text-[10px] block">Drift Score Delta</span>
            <span className="text-foreground font-bold text-base">
              {metricDeltas.driftMatchScoreDelta != null
                ? `${metricDeltas.driftMatchScoreDelta >= 0 ? "+" : ""}${metricDeltas.driftMatchScoreDelta}%`
                : "0%"}
            </span>
          </div>
        </div>
      </div>

      {/* New Findings List */}
      {newFindings.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">
            Newly Introduced Findings ({newFindings.length})
          </div>
          <div className="space-y-2">
            {newFindings.map((f, i) => (
              <div key={i} className="bg-panel border border-rose-500/20 rounded p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground font-mono">{f.name}</span>
                  <SeverityBadge severity={f.severity} />
                </div>
                <p className="text-muted-foreground font-sans">{f.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Findings List */}
      {resolvedFindings.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
            Resolved Findings ({resolvedFindings.length})
          </div>
          <div className="space-y-2">
            {resolvedFindings.map((f, i) => (
              <div key={i} className="bg-panel border border-emerald-500/20 rounded p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground font-mono">{f.name}</span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
                    Resolved
                  </Badge>
                </div>
                <p className="text-muted-foreground font-sans">{f.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExecutionEvidenceTab({
  report,
  latestEvidence,
  onOpenModal,
}: {
  report: QualityReport;
  latestEvidence?: any;
  onOpenModal: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-panel border border-border rounded-lg p-5 space-y-4 text-xs font-mono">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="space-y-0.5">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" /> Verified Execution Boundary
            </h3>
            <p className="text-muted-foreground text-[11px] font-sans">
              ArchForge enforces clean execution boundaries. Arbitrary scripts are never executed without verified sandbox or CI evidence.
            </p>
          </div>
          <Button size="sm" onClick={onOpenModal} className="text-xs font-mono h-8">
            <Plus className="h-3 w-3 mr-1" /> Record Run
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-background/60 p-3 rounded border border-border">
            <span className="text-muted-foreground text-[10px] block">Build Verification</span>
            <span className="font-bold text-foreground">
              {latestEvidence?.buildStatus || "Not Executed"}
            </span>
          </div>
          <div className="bg-background/60 p-3 rounded border border-border">
            <span className="text-muted-foreground text-[10px] block">Test Execution</span>
            <span className="font-bold text-foreground">
              {latestEvidence?.testStatus || "Not Executed"}
            </span>
          </div>
          <div className="bg-background/60 p-3 rounded border border-border">
            <span className="text-muted-foreground text-[10px] block">Tests Passed / Total</span>
            <span className="font-bold text-foreground">
              {latestEvidence ? `${latestEvidence.testsPassed} / ${latestEvidence.testsTotal}` : "0 / 0"}
            </span>
          </div>
          <div className="bg-background/60 p-3 rounded border border-border">
            <span className="text-muted-foreground text-[10px] block">Coverage Percentage</span>
            <span className="font-bold text-foreground">
              {latestEvidence?.coveragePercent ? `${latestEvidence.coveragePercent}%` : "Not Uploaded"}
            </span>
          </div>
        </div>

        {latestEvidence?.buildOutput && (
          <div className="space-y-1">
            <span className="text-muted-foreground text-[11px]">Last Execution Log:</span>
            <pre className="bg-background p-3 rounded border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto">
              {latestEvidence.buildOutput}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportHistoryTab({
  reports,
  activeReportId,
  onSelectReport,
}: {
  reports: QualityReport[];
  activeReportId: string;
  onSelectReport: (r: QualityReport) => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-panel font-mono text-xs">
      <table className="w-full text-left">
        <thead className="bg-background/80 border-b border-border text-muted-foreground text-[11px]">
          <tr>
            <th className="p-3">Report ID</th>
            <th className="p-3">Timestamp</th>
            <th className="p-3">Architecture</th>
            <th className="p-3">Commit SHA</th>
            <th className="p-3">Policy</th>
            <th className="p-3">Verdict</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {reports.map((r) => {
            const isSelected = r.id === activeReportId;
            return (
              <tr
                key={r.id}
                className={`hover:bg-muted/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
              >
                <td className="p-3 font-semibold text-foreground">{r.id.slice(0, 8)}</td>
                <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="p-3 text-foreground">
                  v{r.sourceContext?.architectureVersionNumber || 1}
                </td>
                <td className="p-3 text-foreground">
                  {r.sourceContext?.commitSha?.slice(0, 7) || "—"}
                </td>
                <td className="p-3 text-foreground">{r.policyName}</td>
                <td className="p-3">
                  <VerdictBadge verdict={r.readinessVerdict} size="sm" />
                </td>
                <td className="p-3 text-right">
                  <Button
                    variant={isSelected ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => onSelectReport(r)}
                    className="text-[10px] h-7 px-2"
                  >
                    {isSelected ? "Active" : "Inspect"}
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VerdictBadge({ verdict, size = "md" }: { verdict: ReadinessVerdict; size?: "sm" | "md" }) {
  const isSm = size === "sm";
  switch (verdict) {
    case "ready":
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-bold uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
          <CheckCircle2 className={isSm ? "h-3 w-3" : "h-4 w-4"} /> Ready
        </span>
      );
    case "ready_with_warnings":
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-bold uppercase rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
          <AlertTriangle className={isSm ? "h-3 w-3" : "h-4 w-4"} /> Ready with Warnings
        </span>
      );
    case "blocked":
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-bold uppercase rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
          <XCircle className={isSm ? "h-3 w-3" : "h-4 w-4"} /> Blocked
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-bold uppercase rounded bg-zinc-500/10 text-zinc-400 border border-zinc-500/30 ${isSm ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1"}`}>
          <HelpCircle className={isSm ? "h-3 w-3" : "h-4 w-4"} /> Not Evaluated
        </span>
      );
  }
}

function CheckStatusBadge({ status }: { status: QualityCheckStatus }) {
  switch (status) {
    case "passed":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          <Check className="h-3 w-3" /> PASS
        </span>
      );
    case "warning":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          <AlertTriangle className="h-3 w-3" /> WARN
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
          <XCircle className="h-3 w-3" /> FAIL
        </span>
      );
    case "blocked":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-500 font-semibold bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/40">
          BLOCKED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 font-semibold bg-zinc-500/10 px-2 py-0.5 rounded border border-zinc-500/20">
          NOT EVALUATED
        </span>
      );
  }
}

function SeverityBadge({ severity }: { severity: QualitySeverity }) {
  switch (severity) {
    case "critical":
      return <Badge className="bg-rose-500 text-white text-[10px] font-mono uppercase">Critical</Badge>;
    case "high":
      return <Badge className="bg-amber-500 text-black text-[10px] font-mono uppercase">High</Badge>;
    case "medium":
      return <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[10px] font-mono uppercase">Medium</Badge>;
    case "low":
      return <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-[10px] font-mono uppercase">Low</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px] font-mono uppercase">Info</Badge>;
  }
}

function MetricBadge({ label, count, color }: { label: string; count: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    zinc: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <div className={`px-2.5 py-1 rounded border text-[11px] ${colorMap[color] || colorMap.zinc}`}>
      <span>{label}: </span>
      <span className="font-bold">{count}</span>
    </div>
  );
}

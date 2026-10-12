import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  GitBranch,
  History,
  Layers,
  Loader2,
  Network,
  Play,
  Radar,
  RefreshCw,
  RotateCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
  XCircle,
  HelpCircle,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getWorkflowContext,
  getWorkflowRuns,
  runWorkflow,
  retryWorkflowStage,
  type WorkflowProjectContext,
  type WorkflowRun,
  type WorkflowStageKey,
  type WorkflowStageResult,
  type ReadinessGateResult,
  type ReadinessCheckItem,
  type ReadinessGateDecision,
} from "@/api/workflow";

export const Route = createFileRoute("/_app/workflow")({
  head: () => ({
    meta: [
      { title: "Workflow Orchestrator — ArchForge" },
      {
        name: "description",
        content:
          "Engineering Workflow Orchestration: Traceable end-to-end pipeline from architecture design to repository intelligence and engineering readiness.",
      },
    ],
  }),
  component: WorkflowOrchestrationPage,
});

const STAGE_CONFIG: Record<
  WorkflowStageKey,
  {
    letter: "A" | "B" | "C" | "D" | "E" | "F" | "G";
    title: string;
    icon: typeof Network;
    route: string;
  }
> = {
  stage_a_architecture: {
    letter: "A",
    title: "Stage A — Architecture Baseline",
    icon: Network,
    route: "/workspace",
  },
  stage_b_repository: {
    letter: "B",
    title: "Stage B — Repository Intelligence",
    icon: GitBranch,
    route: "/repository",
  },
  stage_c_drift: {
    letter: "C",
    title: "Stage C — Architecture Drift",
    icon: Radar,
    route: "/drift",
  },
  stage_d_impact: {
    letter: "D",
    title: "Stage D — Engineering Impact Analysis",
    icon: ShieldAlert,
    route: "/impact",
  },
  stage_e_playground: {
    letter: "E",
    title: "Stage E — Engineering Playground",
    icon: FlaskConical,
    route: "/playground",
  },
  stage_f_documentation: {
    letter: "F",
    title: "Stage F — Documentation Freshness",
    icon: FileText,
    route: "/documentation",
  },
  stage_g_verification: {
    letter: "G",
    title: "Stage G — Verification & Readiness",
    icon: Activity,
    route: "/repository",
  },
};

function WorkflowOrchestrationPage() {
  const { currentProject, currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>("");
  const [forceRerun, setForceRerun] = useState<boolean>(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({
    stage_a_architecture: true,
    stage_b_repository: true,
    stage_c_drift: true,
  });
  const [activeTab, setActiveTab] = useState<"pipeline" | "readiness" | "history">("pipeline");

  // Clear selections when switching projects to guarantee project isolation
  useEffect(() => {
    setSelectedVersionId("");
    setSelectedRepoId("");
    setSelectedAnalysisId("");
    setActiveRunId(null);
  }, [currentProject?.id]);

  const {
    data: context,
    isLoading: contextLoading,
    refetch: refetchContext,
  } = useQuery<WorkflowProjectContext>({
    queryKey: ["workflow-context", currentProject?.id],
    queryFn: () => getWorkflowContext(currentProject!.id),
    enabled: Boolean(currentProject?.id),
  });

  const { data: runs = [], refetch: refetchRuns } = useQuery<WorkflowRun[]>({
    queryKey: ["workflow-runs", currentProject?.id],
    queryFn: () => getWorkflowRuns(currentProject!.id),
    enabled: Boolean(currentProject?.id),
  });

  // Selected active run (either specifically chosen or the latest run)
  const currentRun = useMemo(() => {
    if (activeRunId) {
      const found = runs.find((r) => r.id === activeRunId);
      if (found) return found;
    }
    return context?.latestRun || runs[0] || null;
  }, [activeRunId, runs, context?.latestRun]);

  // Available repositories for this project only
  const availableRepos = useMemo(() => context?.repositories || [], [context?.repositories]);

  // Selected repository's available snapshots
  const currentRepo = useMemo(() => {
    if (!selectedRepoId) return availableRepos[0] || null;
    return availableRepos.find((r) => r.id === selectedRepoId) || null;
  }, [availableRepos, selectedRepoId]);

  const availableAnalyses = useMemo(() => currentRepo?.analyses || [], [currentRepo]);

  // Run Workflow Mutation
  const runMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject) throw new Error("No active project");
      return runWorkflow(currentProject.id, {
        architectureVersionId: selectedVersionId || undefined,
        repositoryId: selectedRepoId || undefined,
        repositoryAnalysisId: selectedAnalysisId || undefined,
        forceRerun,
      });
    },
    onSuccess: (newRun) => {
      toast.success("Workflow executed successfully");
      setActiveRunId(newRun.id);
      queryClient.invalidateQueries({ queryKey: ["workflow-context", currentProject?.id] });
      queryClient.invalidateQueries({ queryKey: ["workflow-runs", currentProject?.id] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || "Workflow execution failed";
      toast.error(msg);
    },
  });

  // Retry Stage Mutation
  const retryMutation = useMutation({
    mutationFn: async (stageKey: WorkflowStageKey) => {
      if (!currentProject || !currentRun) throw new Error("No active run");
      return retryWorkflowStage(currentProject.id, currentRun.id, stageKey);
    },
    onSuccess: (updatedRun) => {
      toast.success("Stage retried successfully");
      queryClient.invalidateQueries({ queryKey: ["workflow-context", currentProject?.id] });
      queryClient.invalidateQueries({ queryKey: ["workflow-runs", currentProject?.id] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || "Failed to retry stage");
    },
  });

  const toggleStageExpand = (stageKey: string) => {
    setExpandedStages((prev) => ({
      ...prev,
      [stageKey]: !prev[stageKey],
    }));
  };

  if (!currentProject) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center p-6">
        <EmptyState
          icon={Workflow}
          title="No Project Selected"
          description="Select an engineering project from the workstation switcher to run and inspect the workflow orchestration."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)] bg-background">
      {/* ─── Top Control Header ─── */}
      <header className="border-b border-border bg-panel px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              <span>{currentWorkspace?.name || "Workspace"}</span>
              <span>/</span>
              <span className="text-foreground font-semibold">{currentProject.name}</span>
              <span>/</span>
              <span className="text-primary">Workflow Orchestrator</span>
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground flex items-center gap-2.5">
              <Workflow className="h-6 w-6 text-primary" />
              Engineering Workflow Orchestration
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Coordinated traceability from architecture baselines to repository snapshots, drift analysis, impact evaluation, and readiness gates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchContext();
                refetchRuns();
                toast.info("Context refreshed");
              }}
              disabled={contextLoading}
              className="text-xs font-mono"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${contextLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              variant={activeTab === "history" ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveTab(activeTab === "history" ? "pipeline" : "history")}
              className="text-xs font-mono"
            >
              <History className="h-3.5 w-3.5 mr-1.5" />
              Run History ({runs.length})
            </Button>

            <Button
              size="sm"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono"
            >
              {runMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Orchestrating...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                  Run Workflow
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ─── Source Context Selector Bar ─── */}
        <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-mono text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Source Context:</span>
          </div>

          {/* Architecture Version Selector */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Version:</span>
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Latest Architecture ({context?.architectureVersions?.[0]?.name || "None"})</option>
              {context?.architectureVersions?.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} · {v.name} ({v.nodeCount} nodes)
                </option>
              ))}
            </select>
          </div>

          {/* Repository Selector */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Repo:</span>
            <select
              value={selectedRepoId}
              onChange={(e) => {
                setSelectedRepoId(e.target.value);
                setSelectedAnalysisId("");
              }}
              className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {availableRepos.length === 0 ? (
                <option value="">No Repositories Connected</option>
              ) : (
                availableRepos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.provider})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Repository Snapshot Selector */}
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Snapshot:</span>
            <select
              value={selectedAnalysisId}
              onChange={(e) => setSelectedAnalysisId(e.target.value)}
              disabled={availableAnalyses.length === 0}
              className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            >
              <option value="">Latest Completed Snapshot</option>
              {availableAnalyses.map((a) => (
                <option key={a.id} value={a.id}>
                  commit {a.commitSha ? a.commitSha.slice(0, 7) : "HEAD"} · {a.branch || "default"} ({a.status})
                </option>
              ))}
            </select>
          </div>

          {/* Force Re-run Checkbox */}
          <label className="flex items-center gap-1.5 cursor-pointer ml-auto text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={forceRerun}
              onChange={(e) => setForceRerun(e.target.checked)}
              className="rounded border-border text-primary focus:ring-0"
            />
            <span>Bypass cached drift analysis</span>
          </label>

          {(selectedVersionId || selectedRepoId || selectedAnalysisId) && (
            <button
              onClick={() => {
                setSelectedVersionId("");
                setSelectedRepoId("");
                setSelectedAnalysisId("");
              }}
              className="text-xs text-muted-foreground hover:text-destructive underline ml-2"
            >
              Reset selections
            </button>
          )}
        </div>
      </header>

      {/* ─── Main Content Tabs ─── */}
      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("pipeline")}
            className={`px-4 py-2 text-xs font-mono border-b-2 font-medium transition-colors ${
              activeTab === "pipeline"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Workflow Pipeline & Stages
          </button>
          <button
            onClick={() => setActiveTab("readiness")}
            className={`px-4 py-2 text-xs font-mono border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === "readiness"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Readiness Gate Verification
            {currentRun?.readinessGate?.decision && (
              <ReadinessBadge decision={currentRun.readinessGate.decision} size="sm" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs font-mono border-b-2 font-medium transition-colors ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Run History ({runs.length})
          </button>
        </div>

        {/* ─── Active Run Context Banner ─── */}
        {currentRun ? (
          <div className="bg-panel border border-border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Inspecting Run:</span>
              <span className="font-semibold text-foreground">{currentRun.id.slice(0, 8)}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{new Date(currentRun.createdAt).toLocaleString()}</span>
              <span className="text-muted-foreground">·</span>
              <Badge variant="outline" className="text-[10px]">
                {currentRun.stages ? Object.values(currentRun.stages).filter((s) => s.status === "completed").length : 0}/7 Completed
              </Badge>
              {currentRun.sourceContext?.commitSha && (
                <Badge variant="secondary" className="text-[10px]">
                  commit: {currentRun.sourceContext.commitSha.slice(0, 7)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Gate Status:</span>
              <ReadinessBadge decision={currentRun.readinessGate?.decision || "not_evaluated"} />
            </div>
          </div>
        ) : (
          <div className="bg-panel/50 border border-dashed border-border rounded-lg p-8 text-center space-y-3">
            <Workflow className="h-8 w-8 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-semibold text-foreground">No Workflow Run Recorded Yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Click &quot;Run Workflow&quot; above to execute the multi-stage orchestration for this project.
            </p>
            <Button
              size="sm"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="text-xs font-mono"
            >
              <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
              Execute Initial Run
            </Button>
          </div>
        )}

        {/* ─── Tab Content ─── */}
        {activeTab === "pipeline" && currentRun && (
          <div className="space-y-6">
            {/* Readiness Summary Bar */}
            <ReadinessSummaryCard
              gate={currentRun.readinessGate}
              summary={currentRun.summary}
              onNavigateReadiness={() => setActiveTab("readiness")}
            />

            {/* Stages Pipeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="uppercase tracking-wider">Engineering Stages (A through G)</span>
                <span>Click stage to expand detailed findings and evidence</span>
              </div>

              {Object.keys(STAGE_CONFIG).map((stageKey) => {
                const key = stageKey as WorkflowStageKey;
                const config = STAGE_CONFIG[key];
                const stageResult = currentRun.stages?.[key];
                const isExpanded = Boolean(expandedStages[key]);

                return (
                  <StageCard
                    key={key}
                    stageKey={key}
                    config={config}
                    stageResult={stageResult}
                    isExpanded={isExpanded}
                    onToggle={() => toggleStageExpand(key)}
                    onRetry={() => retryMutation.mutate(key)}
                    isRetrying={retryMutation.isPending && (retryMutation.variables as string) === key}
                  />
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "readiness" && currentRun && (
          <ReadinessGateView gate={currentRun.readinessGate} run={currentRun} />
        )}

        {activeTab === "history" && (
          <RunHistoryView
            runs={runs}
            activeRunId={currentRun?.id || null}
            onSelectRun={(runId) => {
              setActiveRunId(runId);
              setActiveTab("pipeline");
              toast.info(`Viewing workflow run ${runId.slice(0, 8)}`);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────────

function ReadinessBadge({ decision, size = "md" }: { decision: ReadinessGateDecision; size?: "sm" | "md" }) {
  const textSize = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2.5 py-1";
  switch (decision) {
    case "ready":
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-medium rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 ${textSize}`}>
          <ShieldCheck className="h-3 w-3" />
          Ready
        </span>
      );
    case "ready_with_warnings":
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-medium rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 ${textSize}`}>
          <AlertTriangle className="h-3 w-3" />
          Ready with Warnings
        </span>
      );
    case "blocked":
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-medium rounded-full bg-red-500/15 text-red-500 border border-red-500/30 ${textSize}`}>
          <ShieldAlert className="h-3 w-3" />
          Blocked
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 font-mono font-medium rounded-full bg-zinc-500/15 text-zinc-400 border border-zinc-500/30 ${textSize}`}>
          <HelpCircle className="h-3 w-3" />
          Not Evaluated
        </span>
      );
  }
}

function StageStatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="border-emerald-500/40 text-emerald-500 bg-emerald-500/10 text-[10px] font-mono">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "needs_attention":
      return (
        <Badge variant="outline" className="border-amber-500/40 text-amber-500 bg-amber-500/10 text-[10px] font-mono">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Needs Attention
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="border-red-500/40 text-red-500 bg-red-500/10 text-[10px] font-mono">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 text-[10px] font-mono">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      );
    case "ready":
      return (
        <Badge variant="outline" className="border-blue-500/40 text-blue-500 bg-blue-500/10 text-[10px] font-mono">
          <Clock className="h-3 w-3 mr-1" />
          Ready
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="border-zinc-500/40 text-zinc-400 bg-zinc-500/10 text-[10px] font-mono">
          Not Started
        </Badge>
      );
  }
}

function ReadinessSummaryCard({
  gate,
  summary,
  onNavigateReadiness,
}: {
  gate: ReadinessGateResult;
  summary: WorkflowRun["summary"];
  onNavigateReadiness: () => void;
}) {
  return (
    <div className="bg-panel border border-border rounded-lg p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Readiness Summary Gate</span>
            <ReadinessBadge decision={gate.decision} />
          </div>
          <p className="text-sm font-medium text-foreground">{gate.summary}</p>
        </div>

        <Button variant="outline" size="sm" onClick={onNavigateReadiness} className="text-xs font-mono shrink-0">
          Inspect Gate Evidence <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      {gate.blockers.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-3 text-xs text-red-400 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" />
            Blocking Issues:
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {gate.blockers.map((b, idx) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {gate.warnings.length > 0 && gate.blockers.length === 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded p-3 text-xs text-amber-400 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Active Warnings:
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1">
            {gate.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.primaryNextStep && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono pt-1 border-t border-border/50">
          <span className="text-foreground font-medium">Recommended Next Step:</span>
          <span>{summary.primaryNextStep}</span>
        </div>
      )}
    </div>
  );
}

function StageCard({
  stageKey,
  config,
  stageResult,
  isExpanded,
  onToggle,
  onRetry,
  isRetrying,
}: {
  stageKey: WorkflowStageKey;
  config: (typeof STAGE_CONFIG)[WorkflowStageKey];
  stageResult?: WorkflowStageResult;
  isExpanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  const navigate = useNavigate();
  const Icon = config.icon;
  const status = stageResult?.status || "not_started";
  const isArchitectureStage = stageKey === "stage_a_architecture";
  const targetRoute = isArchitectureStage
    ? "/workspace"
    : stageResult?.recommendedNextAction?.targetRoute || config.route;

  const handleNavigate = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isArchitectureStage) {
      navigate({ to: "/workspace" });
    } else {
      navigate({ to: targetRoute as any });
    }
  };

  return (
    <div className="bg-panel border border-border rounded-lg overflow-hidden transition-all duration-150">
      {/* Header */}
      <div
        onClick={onToggle}
        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="font-mono font-bold text-xs text-primary">{config.letter}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground truncate">{config.title}</h3>
              <StageStatusBadge status={status} />
              {stageResult?.reused && (
                <Badge variant="outline" className="text-[10px] font-mono border-blue-500/30 text-blue-400 bg-blue-500/5">
                  Reused
                </Badge>
              )}
              {stageResult?.isStale && (
                <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400 bg-amber-500/5">
                  Stale
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {stageResult?.findingsSummary || "Stage not yet evaluated."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          <button
            type="button"
            onClick={handleNavigate}
            className="text-xs font-mono text-muted-foreground hover:text-primary flex items-center gap-1 p-1 transition-colors"
          >
            Open <ExternalLink className="h-3 w-3" />
          </button>

          {(status === "failed" || status === "needs_attention") && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              disabled={isRetrying}
              className="text-[10px] font-mono h-7 px-2"
            >
              <RotateCw className={`h-3 w-3 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
              Retry
            </Button>
          )}

          <div className="text-muted-foreground pl-1">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Content Drawer */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 bg-background/50 space-y-4 text-xs font-mono">
          {/* Source Context Metadata */}
          {stageResult?.sourceVersion && (
            <div className="bg-panel/70 border border-border rounded p-3 space-y-1 text-muted-foreground">
              <div className="text-[10px] uppercase tracking-wider text-foreground font-semibold">Exact Source Context:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] pt-1">
                {stageResult.sourceVersion.versionNumber && (
                  <div>
                    <span className="text-muted-foreground">Architecture:</span>{" "}
                    <span className="text-foreground">v{stageResult.sourceVersion.versionNumber} ({stageResult.sourceVersion.versionName})</span>
                  </div>
                )}
                {stageResult.sourceVersion.repositoryName && (
                  <div>
                    <span className="text-muted-foreground">Repository:</span>{" "}
                    <span className="text-foreground">{stageResult.sourceVersion.repositoryName}</span>
                  </div>
                )}
                {stageResult.sourceVersion.commitSha && (
                  <div>
                    <span className="text-muted-foreground">Commit SHA:</span>{" "}
                    <span className="text-foreground">{stageResult.sourceVersion.commitSha.slice(0, 7)} ({stageResult.sourceVersion.branch || "default"})</span>
                  </div>
                )}
                {stageResult.sourceVersion.driftAnalysisId && (
                  <div>
                    <span className="text-muted-foreground">Drift ID:</span>{" "}
                    <span className="text-foreground">{stageResult.sourceVersion.driftAnalysisId.slice(0, 8)}</span>
                  </div>
                )}
                {stageResult.sourceVersion.impactReportId && (
                  <div>
                    <span className="text-muted-foreground">Impact Report:</span>{" "}
                    <span className="text-foreground">{stageResult.sourceVersion.impactReportId.slice(0, 8)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Findings List */}
          {stageResult?.findings && stageResult.findings.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Findings ({stageResult.findings.length}):
              </div>
              <div className="space-y-2">
                {stageResult.findings.map((f, idx) => (
                  <div key={idx} className="border border-border/80 rounded bg-panel p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-foreground text-xs">{f.title}</span>
                      <FindingSeverityBadge severity={f.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground font-sans">{f.description}</p>
                    {f.recommendation && (
                      <div className="text-[11px] text-primary/90 flex items-start gap-1 pt-1 border-t border-border/40 font-sans">
                        <span className="font-semibold font-mono">Action:</span>
                        <span>{f.recommendation}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground italic">No unresolved findings in this stage.</div>
          )}

          {/* Recommended Next Action */}
          {stageResult?.recommendedNextAction && (
            <div className="bg-primary/5 border border-primary/20 rounded p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="font-semibold text-foreground text-xs">{stageResult.recommendedNextAction.action}</div>
                <div className="text-muted-foreground font-sans text-xs">{stageResult.recommendedNextAction.description}</div>
              </div>
              <Button
                size="sm"
                onClick={handleNavigate}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono h-8 px-3 shrink-0"
              >
                {isArchitectureStage
                  ? "Go to Architecture Canvas"
                  : `Go to ${config.title.split("—")[1]?.trim() || "Feature"}`}
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FindingSeverityBadge({ severity }: { severity: string }) {
  switch (severity) {
    case "critical":
      return <Badge className="bg-red-500 text-white text-[10px] font-mono uppercase">Critical</Badge>;
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

function ReadinessGateView({ gate, run }: { gate: ReadinessGateResult; run: WorkflowRun }) {
  return (
    <div className="space-y-6">
      <div className="bg-panel border border-border rounded-lg p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Evidence-Based Readiness Gate
            </h2>
            <p className="text-xs text-muted-foreground">
              Evaluated across 7 engineering dimensions without fabricated scores or premature completion claims.
            </p>
          </div>
          <ReadinessBadge decision={gate.decision} />
        </div>

        <div className="p-4 bg-background border border-border rounded text-sm font-sans text-foreground">
          {gate.summary}
        </div>
      </div>

      {/* Evaluated Checks Checklist */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
          Readiness Checks ({gate.checks.length})
        </h3>
        <div className="space-y-2">
          {gate.checks.map((chk) => (
            <div key={chk.id} className="bg-panel border border-border rounded-lg p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground font-mono">{chk.name}</span>
                <CheckStatusBadge status={chk.status} />
              </div>
              <p className="text-muted-foreground font-mono text-[11px] bg-background/50 p-2 rounded border border-border/50">
                Evidence: {typeof chk.evidence === "string" ? chk.evidence : JSON.stringify(chk.evidence)}
              </p>
              {chk.actionRequired && (
                <div className="text-primary text-[11px] flex items-center gap-1 font-mono">
                  <span className="font-semibold">Action Required:</span>
                  <span>{chk.actionRequired}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckStatusBadge({ status }: { status: ReadinessCheckItem["status"] }) {
  switch (status) {
    case "pass":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          <Check className="h-3 w-3" /> PASS
        </span>
      );
    case "warn":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          <AlertTriangle className="h-3 w-3" /> WARNING
        </span>
      );
    case "fail":
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-red-500 font-semibold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
          <XCircle className="h-3 w-3" /> FAILED
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 font-semibold bg-zinc-500/10 px-2 py-0.5 rounded border border-zinc-500/20">
          NOT EXECUTED
        </span>
      );
  }
}

function RunHistoryView({
  runs,
  activeRunId,
  onSelectRun,
}: {
  runs: WorkflowRun[];
  activeRunId: string | null;
  onSelectRun: (id: string) => void;
}) {
  if (runs.length === 0) {
    return (
      <div className="bg-panel border border-border rounded-lg p-12 text-center text-xs font-mono text-muted-foreground">
        No workflow run history recorded for this project yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-mono text-muted-foreground">
        Historical workflow execution snapshots for this project (immutable audit log):
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-panel">
        <table className="w-full text-xs font-mono text-left">
          <thead className="bg-background/80 border-b border-border text-muted-foreground text-[11px]">
            <tr>
              <th className="p-3">Run ID</th>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Architecture</th>
              <th className="p-3">Commit SHA</th>
              <th className="p-3">Readiness Verdict</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {runs.map((r) => {
              const isSelected = r.id === activeRunId;
              return (
                <tr
                  key={r.id}
                  className={`hover:bg-muted/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                >
                  <td className="p-3 font-semibold text-foreground">{r.id.slice(0, 8)}</td>
                  <td className="p-3 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-foreground">
                    {r.sourceContext?.architectureVersionNumber
                      ? `v${r.sourceContext.architectureVersionNumber}`
                      : "—"}
                  </td>
                  <td className="p-3 text-foreground">
                    {r.sourceContext?.commitSha ? r.sourceContext.commitSha.slice(0, 7) : "—"}
                  </td>
                  <td className="p-3">
                    <ReadinessBadge decision={r.readinessGate?.decision || "not_evaluated"} size="sm" />
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant={isSelected ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => onSelectRun(r.id)}
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
    </div>
  );
}

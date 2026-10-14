import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  Activity,
  ShieldAlert,
  Package,
  Database,
  FileText,
  Layers,
  PieChart,
  RotateCw,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getProjectAnalytics,
  getProjectInsights,
  type AnalyticsSnapshot,
  type ProjectInsights,
} from "@/api";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ArchForge" },
      {
        name: "description",
        content: "Track generation throughput, architecture scores, and pipeline health over time.",
      },
      { property: "og:title", content: "Analytics — ArchForge" },
      { property: "og:description", content: "Generation throughput, architecture scores, and pipeline health." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { currentProject } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSnapshot | AnalyticsSnapshot[] | null>(null);
  const [insights, setInsights] = useState<ProjectInsights | null>(null);

  const fetchAnalytics = useCallback(async () => {
    if (!currentProject) {
      setAnalyticsData(null);
      setInsights(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [analyticsRes, insightsRes] = await Promise.all([
        getProjectAnalytics(currentProject.id),
        getProjectInsights(currentProject.id),
      ]);
      setAnalyticsData(analyticsRes);
      setInsights(insightsRes);
    } catch (err: any) {
      console.error("Failed to load project analytics:", err);
      setError(err.response?.data?.message || err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const currentSnapshot: AnalyticsSnapshot | null = useMemo(() => {
    if (!analyticsData) return null;
    if (Array.isArray(analyticsData)) {
      return analyticsData[0] || null;
    }
    return analyticsData;
  }, [analyticsData]);

  const historicalSnapshots: AnalyticsSnapshot[] = useMemo(() => {
    if (!analyticsData) return [];
    if (Array.isArray(analyticsData)) return analyticsData;
    return [analyticsData];
  }, [analyticsData]);

  const metrics = currentSnapshot?.metrics;

  const docCoveragePct = metrics?.documentationCoverage !== undefined
    ? Math.round(Number(metrics.documentationCoverage) * 100)
    : null;

  const driftScore = metrics?.driftScore !== null && metrics?.driftScore !== undefined
    ? Number(metrics.driftScore)
    : null;

  const complexity = metrics?.architectureComplexity ?? (insights?.architectureComplexity ?? null);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Project: {currentProject ? currentProject.name : "Select Project"}
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Analytics & Insights</h1>
          <p className="text-sm text-muted-foreground">
            Objective verification signals calculated across architecture, repository scans, and documentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectSwitcher variant="inline" />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading || !currentProject}
            title="Refresh analytics data"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {!currentProject ? (
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-semibold">No Project Selected</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Select a project from the workspace switcher above to view verified analytics.
          </p>
        </div>
      ) : loading ? (
        <div className="surface-panel p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-mono">Aggregating project verification signals…</span>
        </div>
      ) : error ? (
        <div className="surface-panel p-6 border-destructive/30 bg-destructive/5 space-y-3">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            <span>Failed to load project analytics</span>
          </div>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchAnalytics}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Key Objective Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="surface-panel p-3.5 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" /> Complexity
                </span>
                <span className="text-[10px] text-muted-foreground">Nodes + Edges</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-semibold tabular-nums">
                  {complexity !== null ? complexity : "—"}
                </span>
                <span className="text-xs font-mono text-muted-foreground">elements</span>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {metrics?.architectureNodes ?? 0} nodes · {metrics?.architectureEdges ?? 0} edges
              </div>
            </div>

            <div className="surface-panel p-3.5 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-info" /> Drift Score
                </span>
                <span className="text-[10px] text-muted-foreground">Spec vs Code</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-semibold tabular-nums">
                  {driftScore !== null ? `${driftScore}%` : "—"}
                </span>
                {driftScore !== null && (
                  <span
                    className={`text-xs font-mono ${
                      driftScore >= 80 ? "text-success" : driftScore >= 60 ? "text-primary" : "text-warning"
                    }`}
                  >
                    {driftScore >= 80 ? "Aligned" : "Drifting"}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {driftScore !== null ? "Calculated from drift analysis" : "No drift scan run yet"}
              </div>
            </div>

            <div className="surface-panel p-3.5 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-success" /> Documentation
                </span>
                <span className="text-[10px] text-muted-foreground">Coverage</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-semibold tabular-nums">
                  {docCoveragePct !== null ? `${docCoveragePct}%` : "—"}
                </span>
                <span className="text-xs font-mono text-muted-foreground">up-to-date</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {insights?.documentationStatus?.up_to_date ?? 0} valid docs in registry
              </div>
            </div>

            <div className="surface-panel p-3.5 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-warning" /> Dependencies
                </span>
                <span className="text-[10px] text-muted-foreground">Parsed</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-semibold tabular-nums">
                  {metrics?.repositoryDependencies ?? 0}
                </span>
                <span className="text-xs font-mono text-muted-foreground">packages</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                {insights?.repositoryHealth ? "Verified in repository scan" : "Connect repo to scan"}
              </div>
            </div>
          </div>

          {/* Detailed Structural Factor Breakdown */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Architecture Composition Panel */}
            <div className="surface-panel">
              <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
                <Layers className="h-3.5 w-3.5" /> Architecture Baseline Composition
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded border border-border bg-surface/40">
                    <div className="text-xl font-display font-semibold">
                      {insights?.architectureVersions ?? metrics?.architectureVersions ?? 0}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">
                      Saved Versions
                    </div>
                  </div>
                  <div className="p-3 rounded border border-border bg-surface/40">
                    <div className="text-xl font-display font-semibold">
                      {metrics?.architectureNodes ?? 0}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">
                      Active Nodes
                    </div>
                  </div>
                  <div className="p-3 rounded border border-border bg-surface/40">
                    <div className="text-xl font-display font-semibold">
                      {metrics?.architectureEdges ?? 0}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">
                      Active Edges
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <Info className="h-3.5 w-3.5 text-primary" /> Calculation Source
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Evaluated from persisted architecture versions and canvas elements for{" "}
                    <span className="text-foreground font-mono">{currentProject.name}</span>. Version immutability
                    guarantees historical integrity across releases.
                  </p>
                </div>
              </div>
            </div>

            {/* Repository Scan Status Panel */}
            <div className="surface-panel">
              <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
                <Database className="h-3.5 w-3.5" /> Repository Analysis Verification
              </div>
              <div className="p-4 space-y-3">
                {insights?.repositoryHealth ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">Status:</span>
                      <span className="text-success font-mono font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Completed Scan
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">Commit SHA:</span>
                      <span className="font-mono text-foreground">
                        {insights.repositoryHealth.commit_sha
                          ? String(insights.repositoryHealth.commit_sha).slice(0, 8)
                          : "latest"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">Dependencies Tracked:</span>
                      <span className="font-mono text-foreground">
                        {metrics?.repositoryDependencies ?? 0} packages
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-mono">Last Scanned:</span>
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {insights.repositoryHealth.created_at
                          ? new Date(insights.repositoryHealth.created_at).toLocaleString()
                          : "Recent"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                    <p>No repository analysis recorded for this project yet.</p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Navigate to the Repository tab to connect a Git repository and run a scan.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Documentation Breakdown Panel */}
            <div className="surface-panel">
              <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
                <FileText className="h-3.5 w-3.5" /> Documentation Health Distribution
              </div>
              <div className="p-4 space-y-3">
                {insights?.documentationStatus && Object.keys(insights.documentationStatus).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(insights.documentationStatus).map(([statusKey, count]) => (
                      <div key={statusKey} className="flex items-center justify-between text-xs">
                        <span className="font-mono capitalize text-muted-foreground">
                          {statusKey.replace(/_/g, " ")}:
                        </span>
                        <span className="font-mono font-semibold text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No documentation records generated yet.
                  </div>
                )}
              </div>
            </div>

            {/* Simulation & Story Readiness */}
            <div className="surface-panel">
              <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Intelligence & Simulation Activity
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">Playground Simulations:</span>
                  <span className="font-mono font-semibold text-foreground">
                    {insights?.simulationCount ?? metrics?.simulationCount ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">Story Mode Generated:</span>
                  <span className={`font-mono font-medium ${insights?.storyAvailable ? "text-success" : "text-muted-foreground"}`}>
                    {insights?.storyAvailable ? "Ready" : "Not yet generated"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">Snapshot Date:</span>
                  <span className="font-mono text-muted-foreground text-[11px]">
                    {currentSnapshot?.snapshot_date || "Current"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
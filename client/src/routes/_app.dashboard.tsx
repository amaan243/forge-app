import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
  FolderGit2,
  GitBranch,
  History,
  Layers,
  Loader2,
  Lock,
  Network,
  Package,
  Plus,
  Radar,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
  XCircle,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { useWorkspace } from "@/lib/workspace-context";
import { useQuery } from "@tanstack/react-query";
import { getProjectAnalytics, getProjectInsights } from "@/api/analytics";
import { getProjectAuditEvents, type AuditEvent } from "@/api/exports";
import { getArchitectureVersions } from "@/api/architecture";
import { getNotifications, type AppNotification } from "@/api/notifications";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ArchForge" },
      {
        name: "description",
        content:
          "ArchForge engineering dashboard: architecture telemetry, repository status, drift analysis, release readiness, and recent audit activity.",
      },
      { property: "og:title", content: "Dashboard — ArchForge" },
      {
        property: "og:description",
        content:
          "High-density engineering workstation overview for software architecture, codebase intelligence, and release quality gates.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { currentProject, currentWorkspace, projects, setIsNewProjectOpen, setIsNewWorkspaceOpen } = useWorkspace();
  const navigate = useNavigate();

  const { data: rawAnalytics, isLoading: loadingAnalytics } = useQuery({
    queryKey: ["project-analytics", currentProject?.id],
    queryFn: () => getProjectAnalytics(currentProject!.id),
    enabled: Boolean(currentProject),
    staleTime: 30000,
  });
  const analytics: any = Array.isArray(rawAnalytics) ? rawAnalytics[0] : rawAnalytics;

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["project-insights", currentProject?.id],
    queryFn: () => getProjectInsights(currentProject!.id),
    enabled: Boolean(currentProject),
    staleTime: 30000,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["project-versions", currentProject?.id],
    queryFn: () => getArchitectureVersions(currentProject!.id),
    enabled: Boolean(currentProject),
    staleTime: 30000,
  });

  const { data: auditEvents = [], isLoading: loadingAudit } = useQuery({
    queryKey: ["project-audit", currentProject?.id],
    queryFn: () => getProjectAuditEvents(currentProject!.id),
    enabled: Boolean(currentProject),
    staleTime: 30000,
  });

  const loading = loadingAnalytics || loadingInsights;

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-semibold tracking-tight">Engineering Workstation</h1>
            <p className="text-xs font-mono text-muted-foreground">
              Select an active system from the project switcher above to view telemetry.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsNewProjectOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New Project
            </Button>
            <Button size="sm" onClick={() => setIsNewWorkspaceOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> New Workspace
            </Button>
          </div>
        </div>

        <div className="surface-panel overflow-hidden">
          <EmptyState
            glyph="cube"
            eyebrow="PROJECT SELECTION REQUIRED"
            title={currentWorkspace ? `No active project in ${currentWorkspace.name}` : "No workspace selected"}
            body="ArchForge tracks architecture topology, codebase dependencies, drift discrepancies, and release gates per project. Choose or create a project to load the dashboard."
            actions={
              <Button size="sm" onClick={() => setIsNewProjectOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Project
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  const metrics = analytics?.metrics;
  const qg = insights?.quality_gate;
  const factors = (qg as any)?.factors;

  const score = qg?.score ?? metrics?.driftScore ?? 100;
  const driftScore = metrics?.driftScore ?? insights?.driftStatus?.match_score ?? 100;
  const nodeCount = metrics?.architectureNodes ?? 0;
  const edgeCount = metrics?.architectureEdges ?? 0;
  const repoHealth = insights?.repositoryHealth;
  const repoStatus = repoHealth?.status || "configured";
  const commitSha = repoHealth?.commit_sha ? repoHealth.commit_sha.slice(0, 7) : "HEAD";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Project Hero Header & Quick Actions */}
      <section className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>{currentWorkspace?.name || "Workspace"}</span>
            <span>·</span>
            <span className="text-primary font-semibold">Active Project</span>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-display font-semibold tracking-tight truncate">{currentProject.name}</h1>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {currentProject.visibility}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] bg-success/10 text-success border-success/30">
              {currentProject.status || "active"}
            </Badge>
          </div>
          {currentProject.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 max-w-2xl">{currentProject.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Button size="sm" onClick={() => navigate({ to: "/workspace" })} className="text-xs gap-1.5">
            <Workflow className="h-3.5 w-3.5" /> Studio Workspace
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/repository" })} className="text-xs gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> Repository
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/quality" })} className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Release Gate
          </Button>
        </div>
      </section>

      {/* Telemetry Row - Compact 4 Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TelemetryCard
          icon={ShieldCheck}
          label="Release Quality"
          value={loading ? "..." : `${score}/100`}
          hint={String(qg?.rating || (score >= 80 ? "Release Ready" : "Review Recommended"))}
          tone={score >= 80 ? "success" : "warning"}
          to="/quality"
        />
        <TelemetryCard
          icon={GitBranch}
          label="Repository Sync"
          value={loading ? "..." : repoStatus === "completed" ? "Synchronized" : repoStatus}
          hint={`Commit ${commitSha}`}
          tone={repoStatus === "failed" ? "destructive" : "info"}
          to="/repository"
        />
        <TelemetryCard
          icon={Radar}
          label="Drift Alignment"
          value={loading ? "..." : `${driftScore}%`}
          hint={driftScore >= 90 ? "Spec matches codebase" : "Discrepancies flagged"}
          tone={driftScore >= 90 ? "success" : "warning"}
          to="/drift"
        />
        <TelemetryCard
          icon={Network}
          label="System Topology"
          value={loading ? "..." : `${nodeCount} Nodes`}
          hint={`${edgeCount} links · ${versions.length} versions`}
          tone="info"
          to="/architecture"
        />
      </section>

      {/* Main 2-Column Summary Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Column: Quality & Drift */}
        <div className="space-y-4">
          {/* Release Readiness Summary */}
          <div className="surface-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Quality Gate & Release Readiness</h3>
              </div>
              <Badge variant="outline" className={`font-mono text-[10px] ${score >= 80 ? "text-success border-success/40 bg-success/10" : "text-warning border-warning/40 bg-warning/10"}`}>
                {String(qg?.rating || (score >= 80 ? "PASSED" : "CONDITIONAL"))}
              </Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-muted-foreground font-mono">
                <span>Architecture Alignment:</span>
                <span className="text-foreground font-semibold">{factors?.drift_alignment ?? driftScore}%</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground font-mono">
                <span>CI Test Evidence:</span>
                <span className="text-foreground font-semibold">{factors?.test_evidence ?? 100}% verified</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground font-mono">
                <span>Security Controls:</span>
                <span className="text-foreground font-semibold">{factors?.security_evaluations ?? 100}% verified</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground font-mono">
                <span>Doc Traceability:</span>
                <span className="text-foreground font-semibold">{factors?.documentation_freshness ?? 100}%</span>
              </div>
            </div>

            <div className="pt-2 border-t border-border flex justify-end">
              <Link to="/quality" className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                Evaluate release readiness <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Architecture Drift & Discrepancies */}
          <div className="surface-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-warning" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Architecture Drift Status</h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{driftScore}% Match</span>
            </div>

            {insights?.findings && (insights.findings as any[]).length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Detected {(insights.findings as any[]).length} architecture discrepancies requiring review:
                </p>
                <div className="space-y-1.5">
                  {(insights.findings as any[]).slice(0, 3).map((f: any, idx: number) => (
                    <div key={idx} className="p-2 rounded bg-surface/60 border border-border flex items-center justify-between text-xs font-mono">
                      <span className="truncate max-w-[280px]">{f.title || f.type || "Component drift"}</span>
                      <span className="text-[10px] text-warning uppercase">{f.severity || "discrepancy"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded bg-surface/30 border border-border text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs text-success font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>No critical drift detected</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Architecture model and analyzed codebase are synchronized.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-border flex justify-end">
              <Link to="/drift" className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                Inspect drift findings <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Workflows, Activity & Shortcuts */}
        <div className="space-y-4">
          {/* Architecture Versions & System Workflows */}
          <div className="surface-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Architecture Versions</h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{versions.length} active</span>
            </div>

            {versions.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 text-center">
                No architecture versions saved yet. Model your system in Workspace Studio.
              </div>
            ) : (
              <div className="space-y-1.5">
                {versions.slice(0, 3).map((v) => (
                  <div key={v.id} className="p-2 rounded bg-surface/50 border border-border flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{v.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        v{v.version_number} · {v.description || "Synthesized architecture baseline"}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-border flex justify-between items-center text-xs font-mono">
              <Link to="/workflow" className="text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Workflow className="h-3 w-3" /> Run Workflow
              </Link>
              <Link to="/versions" className="text-primary hover:underline flex items-center gap-1">
                All versions <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Recent Activity & Audit Trail */}
          <div className="surface-panel p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold">Recent Audit Trail</h3>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">persisted events</span>
            </div>

            {loadingAudit ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Loading audit trail...
              </div>
            ) : auditEvents.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 text-center">
                No recent system audit events recorded for this project.
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {auditEvents.slice(0, 4).map((a) => (
                  <div key={a.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="font-mono text-[11px] capitalize text-foreground truncate">
                        {a.action.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-border flex justify-end">
              <Link to="/timeline" className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
                View project timeline <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Launch Station Grid */}
      <section className="border-t border-border pt-4">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Quick Workstation Shortcuts
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ShortcutButton
            to="/workspace"
            title="Studio Workspace"
            desc="Author requirements & generate architecture"
            icon={Workflow}
          />
          <ShortcutButton
            to="/impact"
            title="Impact Analysis"
            desc="Simulate blast radius of node modifications"
            icon={ShieldAlert}
          />
          <ShortcutButton
            to="/knowledge-graph"
            title="Knowledge Graph"
            desc="Unified graph linking code, specs & tests"
            icon={Compass}
          />
          <ShortcutButton
            to="/exports"
            title="Artifacts & Exports"
            desc="Download PDF, JSON, & OpenAPI manifests"
            icon={FileText}
          />
        </div>
      </section>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function TelemetryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  to,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
  hint: string;
  tone: "success" | "warning" | "destructive" | "info";
  to: string;
}) {
  const toneCls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
      ? "text-warning"
      : tone === "destructive"
      ? "text-destructive"
      : "text-primary";

  return (
    <Link
      to={to}
      className="surface-panel p-3.5 space-y-1.5 hover:border-primary/50 transition-colors block group"
    >
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${toneCls}`} />
          <span>{label}</span>
        </div>
        <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
      </div>
      <div className="text-xl font-display font-semibold tracking-tight text-foreground truncate">{value}</div>
      <div className="text-[10px] font-mono text-muted-foreground truncate">{hint}</div>
    </Link>
  );
}

function ShortcutButton({
  to,
  title,
  desc,
  icon: Icon,
}: {
  to: string;
  title: string;
  desc: string;
  icon: typeof Workflow;
}) {
  return (
    <Link
      to={to}
      className="surface-panel p-3 rounded border border-border bg-surface/40 hover:bg-surface hover:border-primary/40 transition-colors block group space-y-1"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
            {title}
          </span>
        </div>
        <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-[10px] text-muted-foreground line-clamp-1">{desc}</p>
    </Link>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Box,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  Network,
  Plus,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { Radar, GaugeCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { useWorkspace } from "@/lib/workspace-context";
import type { Project } from "@/api";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ArchForge" },
      {
        name: "description",
        content:
          "ArchForge dashboard: architecture scores, repository health, documentation coverage, and generation activity for your software systems.",
      },
      { property: "og:title", content: "Dashboard — ArchForge" },
      {
        property: "og:description",
        content:
          "Track architecture scores, generation queues, and repository health across every ArchForge workspace.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] min-h-[calc(100vh-3rem)]">
      <div className="min-w-0 p-6 lg:p-8 space-y-8 border-r border-border">
        <TopBanner />
        <QuickStats />
        <WorkspaceInsights />
        <RecentProjects />
        <SmartDocs />
        <RecentActivity />
      </div>
      <RightSidebar />
    </div>
  );
}

function TopBanner() {
  const { workspaces, projects, setIsNewWorkspaceOpen, setIsNewProjectOpen } = useWorkspace();
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Workstation · Active Session
        </div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Continue building your software architecture. {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"} active with {projects.length} project{projects.length === 1 ? "" : "s"} in the registry.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setIsNewProjectOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New Project
        </Button>
        <Button size="sm" onClick={() => setIsNewWorkspaceOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> New Workspace
        </Button>
      </div>
    </section>
  );
}

/* ---------- quick stats ---------- */

const STATS = [
  { icon: Shield, label: "Architecture Score", value: "92", delta: "+4", up: true, hint: "vs last generation" },
  { icon: Activity, label: "Repository Health", value: "88%", delta: "+2%", up: true, hint: "24 checks passing" },
  { icon: FileText, label: "Documentation Coverage", value: "76%", delta: "+11%", up: true, hint: "128 modules" },
  { icon: ShieldAlert, label: "Security Score", value: "A-", delta: "0", up: true, hint: "2 low findings" },
  { icon: Wrench, label: "Maintainability", value: "B+", delta: "-1", up: false, hint: "3 hot modules" },
  { icon: Zap, label: "Complexity", value: "14.2", delta: "-0.4", up: true, hint: "avg cyclomatic" },
  { icon: Database, label: "Database Tables", value: "38", delta: "+3", up: true, hint: "3 pending migration" },
  { icon: Network, label: "API Endpoints", value: "126", delta: "+8", up: true, hint: "12 deprecated" },
  { icon: Layers, label: "Estimated Services", value: "14", delta: "+2", up: true, hint: "microservice split" },
];

function QuickStats() {
  return (
    <section>
      <SectionHeader eyebrow="01" title="Quick stats" hint="last 7 days" />
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3">
        {STATS.map((s) => {
          const Icon = s.icon;
          const ToneIcon = s.up ? ArrowUpRight : ArrowDownRight;
          const toneClass = s.up ? "text-success" : "text-destructive";
          return (
            <div key={s.label} className="surface-panel p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{s.label}</span>
                </div>
                <span className={"inline-flex items-center gap-0.5 text-[11px] font-mono " + toneClass}>
                  <ToneIcon className="h-3 w-3" />
                  {s.delta}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-semibold tracking-tight tabular-nums">
                  {s.value}
                </span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">{s.hint}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- recent projects ---------- */

function RecentProjects() {
  const {
    projects,
    loadingProjects,
    currentWorkspace,
    selectProject,
    deleteProject,
    setIsNewProjectOpen,
  } = useWorkspace();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleOpenProject = (project: Project) => {
    selectProject(project);
    navigate({ to: "/workspace" });
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete project "${name}"?`)) {
      setDeletingId(id);
      try {
        await deleteProject(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <section>
      <div className="flex items-end justify-between border-b border-border pb-3 mb-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">02</span>
          <h2 className="text-base font-display font-semibold">Projects</h2>
          <span className="text-[11px] font-mono text-muted-foreground">
            {currentWorkspace ? `in ${currentWorkspace.name}` : `${projects.length} total`}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setIsNewProjectOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" /> New Project
        </Button>
      </div>

      {loadingProjects ? (
        <div className="surface-panel p-8 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading workspace projects...
        </div>
      ) : projects.length === 0 ? (
        <div className="surface-panel overflow-hidden">
          <EmptyState
            glyph="cube"
            eyebrow="WORKSPACE REGISTRY"
            title={currentWorkspace ? "No projects in this workspace" : "No workspace selected"}
            body={
              currentWorkspace
                ? `The workspace "${currentWorkspace.name}" has no registered systems yet. Create your first project to model architecture.`
                : "Create or select a workspace to start managing your architecture projects."
            }
            actions={
              <Button size="sm" onClick={() => setIsNewProjectOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create First Project
              </Button>
            }
          />
        </div>
      ) : (
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="px-4 text-[11px] font-mono uppercase tracking-wider">Project</TableHead>
                <TableHead className="text-[11px] font-mono uppercase tracking-wider">Visibility</TableHead>
                <TableHead className="text-[11px] font-mono uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[11px] font-mono uppercase tracking-wider">Created</TableHead>
                <TableHead className="text-right px-4 text-[11px] font-mono uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.id} className="border-border">
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded border border-border bg-surface grid place-items-center">
                        <Box className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">{p.name}</div>
                        {p.description && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">{p.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground uppercase">{p.visibility}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[10px] bg-success/10 text-success border-success/30">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right px-4">
                    <div className="inline-flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleOpenProject(p)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
                        disabled={deletingId === p.id}
                        onClick={() => handleDeleteProject(p.id, p.name)}
                        title="Delete project"
                      >
                        {deletingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

/* ---------- recent activity ---------- */

const ACTIVITY = [
  { icon: Network, label: "Generated Architecture", meta: "Payment Gateway · 14 nodes · 92 score", time: "12m", tone: "primary" },
  { icon: GitBranch, label: "Imported Repository", meta: "github.com/acme/erp-monorepo", time: "38m", tone: "info" },
  { icon: FileText, label: "Generated Documentation", meta: "Social Network · 128 modules", time: "1h", tone: "info" },
  { icon: CheckCircle2, label: "Exported PDF", meta: "architecture-v3.pdf · 4.2 MB", time: "2h", tone: "success" },
  { icon: Activity, label: "Repository Analysis Finished", meta: "Logistics Platform · 1.2k files", time: "yesterday", tone: "success" },
];

function RecentActivity() {
  return (
    <section>
      <SectionHeader eyebrow="03" title="Recent activity" hint="live · UTC" />
      <div className="surface-panel divide-y divide-border">
        {ACTIVITY.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-8 w-8 rounded border border-border bg-surface grid place-items-center text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{a.label}</div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">{a.meta}</div>
              </div>
              <div className="ml-auto text-[11px] font-mono text-muted-foreground">{a.time}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- right sidebar ---------- */

function RightSidebar() {
  return (
    <aside className="hidden xl:flex flex-col bg-panel/50">
      <SideSection eyebrow="AI" title="Pinned suggestions" icon={Sparkles}>
        <SuggestionCard
          title="Split UserService"
          body="Auth and profile responsibilities are coupled. Extract AuthService for clearer boundaries."
        />
        <SuggestionCard
          title="Add Redis cache in front of Orders"
          body="p95 latency on /orders exceeds 180ms. A 60s cache would relieve DB pressure."
        />
      </SideSection>

      <SideSection title="Notifications" icon={Bell}>
        <NotifRow tone="info" label="ERP System generation queued" time="2m" />
        <NotifRow tone="success" label="Payment Gateway architecture ready" time="12m" />
        <NotifRow tone="warning" label="3 pending migrations in Logistics" time="1h" />
      </SideSection>

      <SideSection title="Generation queue" icon={Loader2}>
        <QueueRow name="ERP System" stage="Designing services" pct={62} />
        <QueueRow name="Analytics API" stage="Queued" pct={0} />
      </SideSection>

      <SideSection title="Dependency warnings" icon={Wrench}>
        <DepRow pkg="express@4.18.2" note="1 high CVE · upgrade to 4.21.x" tone="warning" />
        <DepRow pkg="axios@0.27.2" note="2 medium CVEs" tone="warning" />
        <DepRow pkg="lodash@4.17.20" note="Prototype pollution" tone="destructive" />
      </SideSection>

      <SideSection title="Security alerts" icon={ShieldAlert}>
        <DepRow pkg="Auth Service" note="Missing rate limit on /login" tone="destructive" />
        <DepRow pkg="Object Storage" note="Bucket policy is world-readable" tone="warning" />
      </SideSection>
    </aside>
  );
}

function SideSection({
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  eyebrow?: string;
  title: string;
  icon: typeof Sparkles;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <div className="h-9 px-4 flex items-center gap-2 border-b border-border">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {eyebrow && (
          <Badge variant="outline" className="ml-auto h-5 px-1.5 text-[10px] font-mono">
            {eyebrow}
          </Badge>
        )}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </section>
  );
}

function SuggestionCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-border bg-background p-3 space-y-1.5 hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="text-xs font-medium">{title}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{body}</p>
      <div className="flex gap-2 pt-1">
        <button className="text-[11px] font-mono text-primary hover:underline">Apply</button>
        <button className="text-[11px] font-mono text-muted-foreground hover:text-foreground">Dismiss</button>
      </div>
    </div>
  );
}

function NotifRow({ tone, label, time }: { tone: "info" | "success" | "warning"; label: string; time: string }) {
  const cls = tone === "info" ? "bg-info" : tone === "success" ? "bg-success" : "bg-warning";
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className={"h-1.5 w-1.5 rounded-full shrink-0 " + cls} />
      <span className="min-w-0 truncate">{label}</span>
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">{time}</span>
    </div>
  );
}

function QueueRow({ name, stage, pct }: { name: string; stage: string; pct: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{name}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{stage}</span>
      </div>
      <div className="h-1 rounded-full bg-surface overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DepRow({ pkg, note, tone }: { pkg: string; note: string; tone: "warning" | "destructive" }) {
  const cls = tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="flex items-start gap-2 text-xs">
      <ShieldAlert className={"h-3.5 w-3.5 mt-0.5 shrink-0 " + cls} />
      <div className="min-w-0">
        <div className="font-mono text-[11px]">{pkg}</div>
        <div className="text-[11px] text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */

function SectionHeader({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div className="flex items-end justify-between border-b border-border pb-3 mb-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-primary">{eyebrow}</span>
        <h2 className="text-base font-display font-semibold">{title}</h2>
        {hint && <span className="text-[11px] font-mono text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

/* ---------- workspace insights ---------- */

const INSIGHTS = [
  { icon: Radar, label: "Architecture drift", value: 8, unit: "%", tone: "warning" as const, hint: "3 missing, 2 extra" },
  { icon: Wrench, label: "Technical debt", value: 14, unit: "d", tone: "warning" as const, hint: "engineer-days est." },
  { icon: ShieldAlert, label: "Dependency risks", value: 5, unit: "", tone: "destructive" as const, hint: "1 high · 4 medium" },
  { icon: Sparkles, label: "Open recommendations", value: 12, unit: "", tone: "info" as const, hint: "6 pinned" },
  { icon: GaugeCircle, label: "Architecture complexity", value: 62, unit: "/100", tone: "info" as const, hint: "moderate" },
  { icon: Shield, label: "Security posture", value: 88, unit: "/100", tone: "success" as const, hint: "stable 30d" },
];

function WorkspaceInsights() {
  return (
    <section>
      <SectionHeader eyebrow="02" title="Workspace insights" hint="rolling · 24h" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {INSIGHTS.map((w) => {
          const Icon = w.icon;
          const tone = w.tone === "success" ? "text-success"
            : w.tone === "warning" ? "text-warning"
            : w.tone === "destructive" ? "text-destructive"
            : "text-info";
          return (
            <div key={w.label} className="surface-panel p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <Icon className={"h-3.5 w-3.5 " + tone} />
                {w.label}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-display font-semibold tabular-nums">{w.value}</span>
                <span className="text-xs font-mono text-muted-foreground">{w.unit}</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">{w.hint}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- smart documentation status ---------- */

type DocStatus = "up-to-date" | "outdated" | "updating";
const DOCS: { name: string; status: DocStatus; updated: string }[] = [
  { name: "README.md", status: "up-to-date", updated: "12m ago" },
  { name: "Architecture Overview", status: "up-to-date", updated: "12m ago" },
  { name: "API Reference", status: "updating", updated: "just now" },
  { name: "Database Schema", status: "outdated", updated: "2d ago" },
  { name: "Deployment Guide", status: "up-to-date", updated: "1h ago" },
  { name: "Security Model", status: "outdated", updated: "4d ago" },
  { name: "Version Notes v12", status: "updating", updated: "just now" },
];

function docBadge(s: DocStatus) {
  const map = {
    "up-to-date": { label: "Up-to-date", cls: "bg-success/10 text-success border-success/30", Icon: CheckCircle2 },
    outdated: { label: "Outdated", cls: "bg-warning/10 text-warning border-warning/30", Icon: ShieldAlert },
    updating: { label: "Updating", cls: "bg-info/10 text-info border-info/30", Icon: RefreshCw },
  } as const;
  const m = map[s];
  const Icon = m.Icon;
  return (
    <span className={"inline-flex items-center gap-1.5 h-6 px-2 rounded border text-[11px] font-mono " + m.cls}>
      <Icon className={"h-3 w-3 " + (s === "updating" ? "animate-spin" : "")} />
      {m.label}
    </span>
  );
}

function SmartDocs() {
  return (
    <section>
      <SectionHeader eyebrow="04" title="Smart documentation" hint="auto-sync with architecture" />
      <div className="surface-panel divide-y divide-border">
        {DOCS.map((d) => (
          <div key={d.name} className="flex items-center gap-3 p-3">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{d.name}</span>
            <span className="ml-auto font-mono text-[11px] text-muted-foreground">{d.updated}</span>
            {docBadge(d.status)}
          </div>
        ))}
      </div>
    </section>
  );
}

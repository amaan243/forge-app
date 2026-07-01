import { createFileRoute, Link } from "@tanstack/react-router";
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
  Wrench,
  Zap,
} from "lucide-react";
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
        <RecentProjects />
        <RecentActivity />
      </div>
      <RightSidebar />
    </div>
  );
}

function TopBanner() {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Session · Wed 01 Jul 2026
        </div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Continue building your software architecture. 3 workspaces are active and 1 generation is
          queued.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" asChild>
          <Link to="/repository">
            <GitBranch /> Import Repository
          </Link>
        </Button>
        <Button asChild>
          <Link to="/workspace">
            <Plus /> New Workspace
          </Link>
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

type ProjectStatus = "healthy" | "review" | "generating" | "failing";

const PROJECTS: {
  name: string;
  stack: string;
  status: ProjectStatus;
  updated: string;
  score: number;
}[] = [
  { name: "Payment Gateway", stack: "Node + React", status: "healthy", updated: "12m ago", score: 92 },
  { name: "Social Network", stack: "React + Spring", status: "review", updated: "1h ago", score: 84 },
  { name: "ERP System", stack: "MERN", status: "generating", updated: "just now", score: 89 },
  { name: "Logistics Platform", stack: "Next + Go", status: "healthy", updated: "3h ago", score: 91 },
  { name: "Telemetry Ingestion", stack: "Rust + Kafka", status: "failing", updated: "yesterday", score: 61 },
];

function statusBadge(status: ProjectStatus) {
  const map = {
    healthy: { label: "Healthy", cls: "bg-success/10 text-success border-success/30" },
    review: { label: "Needs Review", cls: "bg-warning/10 text-warning border-warning/30" },
    generating: { label: "Generating", cls: "bg-info/10 text-info border-info/30" },
    failing: { label: "Failing", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  } as const;
  const s = map[status];
  return (
    <span className={"inline-flex items-center gap-1.5 h-6 px-2 rounded border text-[11px] font-mono " + s.cls}>
      {status === "generating" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {s.label}
    </span>
  );
}

function RecentProjects() {
  return (
    <section>
      <SectionHeader eyebrow="02" title="Recent projects" hint={`${PROJECTS.length} workspaces`} />
      <div className="surface-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="px-4 text-[11px] font-mono uppercase tracking-wider">Project</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Stack</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Last Updated</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Score</TableHead>
              <TableHead className="text-right px-4 text-[11px] font-mono uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PROJECTS.map((p) => (
              <TableRow key={p.name} className="border-border">
                <TableCell className="px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded border border-border bg-surface grid place-items-center">
                      <Box className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="font-medium text-sm">{p.name}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{p.stack}</span>
                </TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell>
                  <span className="font-mono text-xs text-muted-foreground">{p.updated}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-16 rounded-full bg-surface overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${p.score}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums">{p.score}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right px-4">
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                      Open
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                      Report
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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

import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Box,
  CheckCircle2,
  ChevronRight,
  Database,
  FileCode2,
  GitBranch,
  Layers,
  Loader2,
  Search,
  Settings,
  Shield,
  Terminal,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "ArchForge — Design System" },
      {
        name: "description",
        content:
          "ArchForge design system: engineering-grade tokens, components, and patterns for the architecture workstation.",
      },
      { property: "og:title", content: "ArchForge — Design System" },
      {
        property: "og:description",
        content:
          "Engineering-grade design tokens and components powering the ArchForge architecture workstation.",
      },
    ],
  }),
  component: DesignSystem,
});

/* ============================================================================
 * ArchForge — Phase 1: Design System
 * Engineering workstation aesthetic. No SaaS gradients, no glassmorphism.
 * ==========================================================================*/

function DesignSystem() {
  return (
    <div className="min-h-screen text-foreground">
      <TopBar />
      <div className="mx-auto max-w-[1280px] px-8 py-10 space-y-12">
        <Header />
        <Section id="01" title="Foundations" subtitle="Color, typography, spacing, radius">
          <Colors />
          <Typography />
          <SpacingRadius />
        </Section>

        <Section id="02" title="Controls" subtitle="Buttons, inputs, badges">
          <Buttons />
          <Inputs />
          <Badges />
        </Section>

        <Section id="03" title="Surfaces" subtitle="Cards, panels, tables, navigation">
          <Cards />
          <NavigationSample />
          <TableSample />
        </Section>

        <Section id="04" title="Feedback" subtitle="Progress, status, loaders, toasts, empty states">
          <ProgressStates />
          <Toasts />
          <EmptyAndLoading />
        </Section>

        <Section id="05" title="Data" subtitle="Charts, metrics, console">
          <Metrics />
          <BarChart />
          <ConsoleSample />
        </Section>

        <Section id="06" title="Iconography" subtitle="Lucide, 16/20px, currentColor">
          <IconGrid />
        </Section>

        <footer className="border-t border-border pt-6 pb-12">
          <p className="text-xs text-muted-foreground font-mono">
            ArchForge · Design System v0.1 · Phase 1 of 5
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ---------- shell ---------- */

function TopBar() {
  return (
    <div className="sticky top-0 z-30 border-b border-border bg-panel/95 backdrop-blur-sm">
      <div className="mx-auto max-w-[1280px] flex items-center h-12 px-8 gap-6">
        <Logo />
        <nav className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <NavLink active>Design System</NavLink>
          <NavLink>Workspace</NavLink>
          <NavLink>Repository</NavLink>
          <NavLink>Docs</NavLink>
          <NavLink>Analytics</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 px-2 h-7 rounded border border-border bg-background text-xs text-muted-foreground font-mono">
            <Search className="h-3 w-3" />
            <span>search</span>
            <kbd className="ml-2 px-1 py-px text-[10px] border border-border rounded bg-surface">⌘K</kbd>
          </div>
          <button className="h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
            <Settings className="h-3.5 w-3.5" />
          </button>
          <div className="h-7 px-2 grid place-items-center rounded border border-border bg-surface text-[11px] font-mono text-muted-foreground">
            v0.1.0
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <a
      className={
        "px-2.5 h-7 inline-flex items-center rounded transition-colors " +
        (active
          ? "text-foreground border border-border bg-surface"
          : "hover:text-foreground hover:bg-surface")
      }
    >
      {children}
    </a>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="15.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="2.5" y="15.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="15.5" y="15.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-primary" fill="currentColor" fillOpacity="0.15" />
        <path d="M8.5 5.5h7M5.5 8.5v7M18.5 8.5v7M8.5 18.5h7" stroke="currentColor" strokeWidth="1.25" className="text-border" />
      </svg>
      <span className="font-display font-semibold text-sm tracking-tight">
        Arch<span className="text-primary">Forge</span>
      </span>
    </div>
  );
}

function Header() {
  return (
    <header className="space-y-3 pt-2">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <span>archforge</span>
        <ChevronRight className="h-3 w-3" />
        <span>design-system</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">phase-01</span>
      </div>
      <h1 className="text-3xl font-display font-semibold tracking-tight">
        Design System
      </h1>
      <p className="text-sm text-muted-foreground max-w-2xl">
        The component vocabulary that powers the ArchForge workstation. Built for
        software architects — flat surfaces, thin borders, monospaced data, amber
        accent reserved for state and intent.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        <SpecChip label="bg" value="#0F172A" />
        <SpecChip label="panel" value="#111827" />
        <SpecChip label="surface" value="#1E293B" />
        <SpecChip label="accent" value="#F59E0B" />
        <SpecChip label="radius" value="6px" />
        <SpecChip label="font" value="Geist · Inter · JetBrains Mono" />
      </div>
    </header>
  );
}

function SpecChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 h-7 px-2.5 rounded border border-border bg-panel text-xs font-mono">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between border-b border-border pb-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-primary">{id}</span>
          <h2 className="text-lg font-display font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"surface-panel " + className}>
      {title && (
        <div className="flex items-center justify-between h-9 px-3 border-b border-border">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {hint && <span className="text-[11px] font-mono text-muted-foreground">{hint}</span>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ---------- 01 Foundations ---------- */

const SWATCHES = [
  { name: "background", value: "#0F172A", token: "--background" },
  { name: "panel", value: "#111827", token: "--panel" },
  { name: "surface", value: "#1E293B", token: "--surface" },
  { name: "border", value: "rgba(255,255,255,0.08)", token: "--border" },
  { name: "foreground", value: "#F8FAFC", token: "--foreground" },
  { name: "muted-foreground", value: "#94A3B8", token: "--muted-foreground" },
  { name: "accent", value: "#F59E0B", token: "--primary" },
  { name: "success", value: "oklch(0.72 0.16 155)", token: "--success" },
  { name: "warning", value: "oklch(0.82 0.16 85)", token: "--warning" },
  { name: "destructive", value: "oklch(0.65 0.22 25)", token: "--destructive" },
  { name: "info", value: "oklch(0.7 0.13 230)", token: "--info" },
];

function Colors() {
  return (
    <Panel title="Color tokens" hint="11 semantic">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {SWATCHES.map((s) => (
          <div key={s.name} className="border border-border rounded-md overflow-hidden bg-background">
            <div
              className="h-14 border-b border-border"
              style={{ backgroundColor: s.value.startsWith("#") || s.value.startsWith("rgba") ? s.value : `var(${s.token})` }}
            />
            <div className="p-2 space-y-0.5">
              <div className="text-xs font-medium">{s.name}</div>
              <div className="text-[10px] font-mono text-muted-foreground truncate">{s.value}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Typography() {
  return (
    <Panel title="Typography" hint="Geist · Inter · JetBrains Mono">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <TypeRow label="Display / 32" className="text-3xl font-display font-semibold tracking-tight">
            From Requirements to Production
          </TypeRow>
          <TypeRow label="H1 / 24" className="text-2xl font-display font-semibold tracking-tight">
            Architecture Generator
          </TypeRow>
          <TypeRow label="H2 / 18" className="text-lg font-display font-semibold">
            Repository Health
          </TypeRow>
          <TypeRow label="Body / 14" className="text-sm">
            Engineered for software architects, tech leads, and teams shipping production systems.
          </TypeRow>
          <TypeRow label="Caption / 12" className="text-xs text-muted-foreground">
            Last generated 12 minutes ago · commit a91f3c2
          </TypeRow>
        </div>
        <div className="space-y-3">
          <TypeRow label="Mono / 13" className="text-[13px] font-mono">
            $ archforge generate --spec ./requirements.md
          </TypeRow>
          <TypeRow label="Mono / 12 muted" className="text-xs font-mono text-muted-foreground">
            packages/core/src/architecture/graph.ts:42
          </TypeRow>
          <div className="rounded border border-border bg-background p-3 font-mono text-xs leading-relaxed">
            <span className="text-muted-foreground">// architecture.ts</span>{"\n"}
            <span className="text-primary">export</span>{" "}
            <span className="text-primary">interface</span> ServiceNode {"{"}{"\n"}
            {"  "}id: <span className="text-foreground">string</span>;{"\n"}
            {"  "}kind: <span className="text-foreground">'api' | 'worker' | 'db'</span>;{"\n"}
            {"  "}depends_on: <span className="text-foreground">string[]</span>;{"\n"}
            {"}"}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function TypeRow({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4 border-b border-border/60 pb-3">
      <span className="w-28 shrink-0 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className={className}>{children}</div>
    </div>
  );
}

function SpacingRadius() {
  const steps = [4, 8, 12, 16, 24, 32, 48];
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Panel title="Spacing scale" hint="4px base">
        <div className="space-y-2">
          {steps.map((s) => (
            <div key={s} className="flex items-center gap-3 text-xs font-mono">
              <span className="w-10 text-muted-foreground">{s}px</span>
              <div className="h-3 bg-primary/70" style={{ width: s * 4 }} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Radius" hint="2 / 4 / 6 / 10">
        <div className="flex gap-4 items-end">
          {[
            { r: 2, l: "xs" },
            { r: 4, l: "sm" },
            { r: 6, l: "md (default)" },
            { r: 10, l: "lg" },
          ].map((x) => (
            <div key={x.l} className="flex flex-col items-center gap-2">
              <div
                className="w-16 h-16 bg-surface border border-border"
                style={{ borderRadius: x.r }}
              />
              <span className="text-[11px] font-mono text-muted-foreground">{x.l}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

/* ---------- 02 Controls ---------- */

function Buttons() {
  return (
    <Panel title="Buttons" hint="flat · medium height · hover bg only">
      <div className="flex flex-wrap gap-3 items-center">
        <Button>Generate Architecture</Button>
        <Button variant="secondary">Open Project</Button>
        <Button variant="outline">
          <GitBranch /> main
        </Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="destructive">Delete</Button>
        <Button size="sm" variant="outline">
          sm
        </Button>
        <Button size="lg">Run Pipeline</Button>
        <Button size="icon" variant="outline">
          <Settings />
        </Button>
        <Button disabled>
          <Loader2 className="animate-spin" /> Generating
        </Button>
      </div>
    </Panel>
  );
}

function Inputs() {
  return (
    <Panel title="Inputs" hint="developer-tool feel">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Project name
          </label>
          <Input placeholder="payments-platform" defaultValue="payments-platform" />
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Search files
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input className="pl-8 font-mono text-xs" placeholder="src/architecture/**" />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Requirements
          </label>
          <textarea
            className="w-full min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            defaultValue={`# Goal\nMulti-tenant payments API with idempotent webhooks.\n\n## Non-functional\n- p95 < 120ms\n- 99.95% SLA`}
          />
        </div>
      </div>
    </Panel>
  );
}

function Badges() {
  return (
    <Panel title="Status badges">
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone="success">Passing</StatusBadge>
        <StatusBadge tone="warning">Degraded</StatusBadge>
        <StatusBadge tone="danger">Failing</StatusBadge>
        <StatusBadge tone="info">Queued</StatusBadge>
        <StatusBadge tone="neutral">Draft</StatusBadge>
        <Badge variant="outline" className="font-mono">v0.1.0</Badge>
        <Badge variant="outline" className="font-mono">node 20.11</Badge>
        <Badge variant="outline" className="font-mono">postgres 16</Badge>
      </div>
    </Panel>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger" | "info" | "neutral";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    success: "bg-success/10 text-success border-success/30",
    warning: "bg-warning/10 text-warning border-warning/30",
    danger: "bg-destructive/10 text-destructive border-destructive/30",
    info: "bg-info/10 text-info border-info/30",
    neutral: "bg-surface text-muted-foreground border-border",
  };
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 h-6 px-2 rounded border text-[11px] font-mono " +
        map[tone]
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

/* ---------- 03 Surfaces ---------- */

function Cards() {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <MetricCard
        icon={<Layers className="h-4 w-4" />}
        label="Services"
        value="14"
        delta="+2 this week"
        deltaTone="success"
      />
      <MetricCard
        icon={<Database className="h-4 w-4" />}
        label="Database tables"
        value="38"
        delta="3 pending migration"
        deltaTone="warning"
      />
      <MetricCard
        icon={<Shield className="h-4 w-4" />}
        label="Architecture score"
        value="86"
        delta="+4 vs last gen"
        deltaTone="success"
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  delta,
  deltaTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  deltaTone: "success" | "warning" | "danger";
}) {
  const toneClass =
    deltaTone === "success"
      ? "text-success"
      : deltaTone === "warning"
        ? "text-warning"
        : "text-destructive";
  return (
    <div className="surface-panel p-4 space-y-3">
      <div className="flex items-center justify-between text-muted-foreground">
        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
          {icon}
          {label}
        </div>
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
      <div className="text-3xl font-display font-semibold tabular-nums">{value}</div>
      <div className={"text-[11px] font-mono " + toneClass}>{delta}</div>
    </div>
  );
}

function NavigationSample() {
  return (
    <Panel title="Navigation" hint="sidebar · breadcrumbs · tabs">
      <div className="grid md:grid-cols-[200px_1fr] gap-4">
        <div className="border border-border rounded-md bg-background overflow-hidden">
          <SideItem icon={<Box className="h-3.5 w-3.5" />} active>
            Overview
          </SideItem>
          <SideItem icon={<FileCode2 className="h-3.5 w-3.5" />}>Requirements</SideItem>
          <SideItem icon={<Layers className="h-3.5 w-3.5" />}>Architecture</SideItem>
          <SideItem icon={<Database className="h-3.5 w-3.5" />}>Database</SideItem>
          <SideItem icon={<GitBranch className="h-3.5 w-3.5" />}>Repository</SideItem>
          <SideItem icon={<Activity className="h-3.5 w-3.5" />}>Analytics</SideItem>
        </div>
        <div className="border border-border rounded-md bg-background">
          <div className="flex items-center h-9 px-3 border-b border-border text-xs font-mono text-muted-foreground gap-2">
            <span>payments-platform</span>
            <ChevronRight className="h-3 w-3" />
            <span>architecture</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">graph</span>
          </div>
          <div className="flex items-center border-b border-border text-xs">
            <TabItem active>Overview</TabItem>
            <TabItem>Services</TabItem>
            <TabItem>Data flow</TabItem>
            <TabItem>Issues · 3</TabItem>
          </div>
          <div className="p-6 grid-bg min-h-32 text-[11px] font-mono text-muted-foreground">
            // canvas surface
          </div>
        </div>
      </div>
    </Panel>
  );
}

function SideItem({
  icon,
  active,
  children,
}: {
  icon: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className={
        "w-full flex items-center gap-2 h-8 px-3 text-xs text-left border-l-2 transition-colors " +
        (active
          ? "border-primary bg-surface text-foreground"
          : "border-transparent text-muted-foreground hover:bg-surface hover:text-foreground")
      }
    >
      {icon}
      {children}
    </button>
  );
}

function TabItem({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <button
      className={
        "h-9 px-4 border-b-2 -mb-px transition-colors " +
        (active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function TableSample() {
  const rows = [
    { svc: "api-gateway", kind: "edge", lang: "TypeScript", status: "Passing", cov: 92 },
    { svc: "billing-worker", kind: "worker", lang: "Go", status: "Degraded", cov: 71 },
    { svc: "ledger-db", kind: "datastore", lang: "PostgreSQL", status: "Passing", cov: 100 },
    { svc: "notifications", kind: "service", lang: "Node", status: "Failing", cov: 48 },
  ];
  return (
    <Panel title="Tables" hint="github-style · sticky header">
      <div className="border border-border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface/60 hover:bg-surface/60">
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Service</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Kind</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Stack</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-[11px] font-mono uppercase tracking-wider text-right">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={r.svc} className={i % 2 ? "bg-background" : "bg-panel"}>
                <TableCell className="font-mono text-xs">{r.svc}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.kind}</TableCell>
                <TableCell className="text-xs">{r.lang}</TableCell>
                <TableCell>
                  <StatusBadge
                    tone={
                      r.status === "Passing"
                        ? "success"
                        : r.status === "Degraded"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {r.status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">{r.cov}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Panel>
  );
}

/* ---------- 04 Feedback ---------- */

function ProgressStates() {
  return (
    <Panel title="Progress" hint="engineering steps · not 'AI thinking'">
      <div className="space-y-4">
        {[
          { label: "Parsing requirements", v: 100, done: true },
          { label: "Generating architecture", v: 100, done: true },
          { label: "Designing database", v: 64, done: false, active: true },
          { label: "Generating APIs", v: 0, done: false },
          { label: "Building folder structure", v: 0, done: false },
        ].map((s) => (
          <div key={s.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="flex items-center gap-2">
                {s.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                ) : s.active ? (
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-border" />
                )}
                <span className={s.done || s.active ? "text-foreground" : "text-muted-foreground"}>
                  {s.label}
                </span>
              </span>
              <span className="text-muted-foreground tabular-nums">{s.v}%</span>
            </div>
            <Progress value={s.v} className="h-1" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Toasts() {
  return (
    <Panel title="Toasts">
      <div className="grid md:grid-cols-2 gap-3">
        <Toast icon={<CheckCircle2 className="h-4 w-4 text-success" />} title="Architecture generated" body="14 services · 38 tables · 3 warnings" />
        <Toast icon={<TriangleAlert className="h-4 w-4 text-warning" />} title="Dependency risk" body="lodash@4.17.20 has 2 known advisories" />
        <Toast icon={<XCircle className="h-4 w-4 text-destructive" />} title="Pipeline failed" body="step 'generate-api' exited with code 1" />
        <Toast icon={<Loader2 className="h-4 w-4 text-primary animate-spin" />} title="Generating documentation" body="building markdown for 14 services…" />
      </div>
    </Panel>
  );
}

function Toast({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 border border-border rounded-md bg-background p-3">
      <div className="mt-0.5">{icon}</div>
      <div className="space-y-0.5 min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground font-mono truncate">{body}</div>
      </div>
    </div>
  );
}

function EmptyAndLoading() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Panel title="Empty state">
        <div className="border border-dashed border-border rounded-md p-8 text-center space-y-3">
          <div className="mx-auto h-10 w-10 grid place-items-center border border-border rounded bg-surface">
            <FileCode2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium">No requirements yet</div>
            <div className="text-xs text-muted-foreground">
              Import a spec or paste your requirements to generate the first architecture.
            </div>
          </div>
          <div className="flex justify-center gap-2">
            <Button size="sm">Import spec</Button>
            <Button size="sm" variant="outline">Paste requirements</Button>
          </div>
        </div>
      </Panel>
      <Panel title="Loading state">
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground pt-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            Generating architecture · step 3 of 8
          </div>
        </div>
      </Panel>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded border border-border bg-surface animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 rounded bg-surface animate-pulse w-1/3" />
        <div className="h-2 rounded bg-surface animate-pulse w-2/3" />
      </div>
    </div>
  );
}

/* ---------- 05 Data ---------- */

function Metrics() {
  return (
    <div className="grid md:grid-cols-4 gap-4">
      {[
        { l: "Maintainability", v: "A", s: 92 },
        { l: "Documentation", v: "B+", s: 81 },
        { l: "Security", v: "A-", s: 88 },
        { l: "Performance", v: "B", s: 74 },
      ].map((m) => (
        <div key={m.l} className="surface-panel p-4 space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {m.l}
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-display font-semibold">{m.v}</div>
            <div className="text-xs font-mono text-muted-foreground tabular-nums">{m.s}/100</div>
          </div>
          <Progress value={m.s} className="h-1" />
        </div>
      ))}
    </div>
  );
}

function BarChart() {
  const data = [38, 52, 41, 67, 59, 74, 81, 70, 88, 92, 84, 96];
  const max = Math.max(...data);
  return (
    <Panel title="Architecture score · 12 generations" hint="trend">
      <div className="flex items-end gap-2 h-40">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={
                "w-full transition-colors " +
                (i === data.length - 1 ? "bg-primary" : "bg-surface hover:bg-primary/40")
              }
              style={{ height: `${(v / max) * 100}%` }}
            />
            <div className="text-[10px] font-mono text-muted-foreground">{i + 1}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ConsoleSample() {
  return (
    <Panel title="Console" hint="bottom dock">
      <div className="rounded border border-border bg-background font-mono text-xs">
        <div className="flex items-center gap-2 h-8 px-3 border-b border-border text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          <span>archforge · generate</span>
          <span className="ml-auto">exit 0 · 4.2s</span>
        </div>
        <div className="p-3 space-y-1 leading-relaxed">
          <Line tag="info">parsing requirements (12 sections)…</Line>
          <Line tag="ok">generated service graph · 14 nodes / 22 edges</Line>
          <Line tag="ok">designed schema · 38 tables / 64 indexes</Line>
          <Line tag="warn">notifications: missing retry policy</Line>
          <Line tag="ok">built folder structure · 312 files</Line>
          <Line tag="ok">documentation rendered · 41 pages</Line>
          <div className="text-success">✔ completed successfully</div>
        </div>
      </div>
    </Panel>
  );
}

function Line({ tag, children }: { tag: "info" | "ok" | "warn" | "err"; children: React.ReactNode }) {
  const map = {
    info: "text-info",
    ok: "text-success",
    warn: "text-warning",
    err: "text-destructive",
  } as const;
  const label = { info: "info", ok: "ok  ", warn: "warn", err: "err " }[tag];
  return (
    <div className="flex gap-3">
      <span className={map[tag]}>[{label}]</span>
      <span className="text-foreground/90">{children}</span>
    </div>
  );
}

/* ---------- 06 Icons ---------- */

function IconGrid() {
  const icons = [
    { I: Box, n: "Box" },
    { I: Layers, n: "Layers" },
    { I: Database, n: "Database" },
    { I: GitBranch, n: "GitBranch" },
    { I: FileCode2, n: "FileCode2" },
    { I: Terminal, n: "Terminal" },
    { I: Activity, n: "Activity" },
    { I: Shield, n: "Shield" },
    { I: Settings, n: "Settings" },
    { I: Search, n: "Search" },
    { I: CheckCircle2, n: "CheckCircle2" },
    { I: TriangleAlert, n: "TriangleAlert" },
  ];
  return (
    <Panel title="Icons" hint="lucide · 16px · currentColor">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {icons.map(({ I, n }) => (
          <div
            key={n}
            className="flex items-center gap-2 border border-border rounded bg-background px-3 h-10 text-xs"
          >
            <I className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono truncate">{n}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

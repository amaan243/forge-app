import { createFileRoute } from "@tanstack/react-router";
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  FileCode2,
  ShieldAlert,
  Folder,
  FolderOpen,
  File as FileIcon,
  Package,
  Layers,
  AlertTriangle,
  BookOpen,
  Activity,
  Copy,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/repository")({
  head: () => ({
    meta: [
      { title: "Repository — ArchForge" },
      { name: "description", content: "Import and analyze source repositories: file trees, hotspots, and dependency graphs." },
      { property: "og:title", content: "Repository — ArchForge" },
      { property: "og:description", content: "Analyze repositories, hotspots, and dependency graphs." },
    ],
  }),
  component: RepositoryPage,
});

const TREE = [
  { name: "src", type: "dir", depth: 0, children: 6 },
  { name: "services", type: "dir", depth: 1, children: 4 },
  { name: "auth", type: "dir", depth: 2, children: 8 },
  { name: "payments", type: "dir", depth: 2, children: 14 },
  { name: "notifications", type: "dir", depth: 2, children: 6 },
  { name: "lib", type: "dir", depth: 1, children: 12 },
  { name: "index.ts", type: "file", depth: 1 },
  { name: "tests", type: "dir", depth: 0, children: 42 },
  { name: "docs", type: "dir", depth: 0, children: 18 },
  { name: "package.json", type: "file", depth: 0 },
  { name: "tsconfig.json", type: "file", depth: 0 },
  { name: "README.md", type: "file", depth: 0 },
];

const LANGS = [
  { name: "TypeScript", pct: 68, loc: "82,410" },
  { name: "SQL", pct: 12, loc: "14,220" },
  { name: "Shell", pct: 8, loc: "9,180" },
  { name: "YAML", pct: 7, loc: "8,240" },
  { name: "Markdown", pct: 5, loc: "5,610" },
];

const FRAMEWORKS = ["Node 20", "Express 5", "React 19", "Postgres 16", "Redis 7", "RabbitMQ 3", "Docker", "Kubernetes"];

const HOTSPOTS = [
  { path: "src/services/payments/router.ts", lines: 2380, cx: 24, hot: true },
  { path: "src/services/auth/index.ts", lines: 1240, cx: 18, hot: true },
  { path: "src/lib/db/index.ts", lines: 820, cx: 12, hot: false },
  { path: "src/api/gateway/router.ts", lines: 940, cx: 14, hot: false },
  { path: "src/services/notifications/fanout.ts", lines: 610, cx: 9, hot: false },
];

const DUPES = [
  { a: "src/services/auth/hash.ts", b: "src/lib/crypto/hash.ts", pct: 92 },
  { a: "src/services/payments/util.ts", b: "src/services/billing/util.ts", pct: 78 },
];

const UNUSED = ["moment", "lodash.get", "left-pad", "request", "underscore"];

const DEPS = [
  { from: "gateway", to: "auth" },
  { from: "gateway", to: "user" },
  { from: "gateway", to: "notif" },
  { from: "auth", to: "redis" },
  { from: "user", to: "mongo" },
  { from: "notif", to: "mq" },
];

const SECURITY = [
  { sev: "high", title: "SQL injection risk in payments/router.ts", cwe: "CWE-89" },
  { sev: "med", title: "Weak crypto in tokens/legacy.ts", cwe: "CWE-327" },
  { sev: "low", title: "Missing rate limit on /login", cwe: "CWE-770" },
];

function RepositoryPage() {
  const [tab, setTab] = useState<"overview" | "graph" | "quality" | "security">("overview");
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">github.com / acme / payments-platform</div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Repository</h1>
          <p className="text-sm text-muted-foreground">Static analysis of the imported source tree.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input defaultValue="main" className="pl-8 font-mono text-xs h-8 w-40" />
          </div>
          <Button>Analyze</Button>
        </div>
      </header>

      <HealthScoreBar />

      <div className="grid md:grid-cols-4 gap-3">
        <Stat icon={FileCode2} label="Files" value="1,284" />
        <Stat icon={GitCommit} label="Commits" value="6,412" />
        <Stat icon={GitPullRequest} label="Open PRs" value="14" />
        <Stat icon={ShieldAlert} label="Findings" value="9" tone="warning" />
      </div>

      <div className="border-b border-border flex gap-1">
        {(["overview", "graph", "quality", "security"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "h-8 px-3 text-[11px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors " +
              (tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "graph" && <DependencyGraph />}
      {tab === "quality" && <QualityTab />}
      {tab === "security" && <SecurityTab />}
    </div>
  );
}

function HealthScoreBar() {
  return (
    <div className="surface-panel p-4 flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16">
          <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-surface" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray={`${(87 * 94.2) / 100} 94.2`} className="text-primary" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 grid place-items-center font-display font-semibold tabular-nums">87</div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Repository health</div>
          <div className="text-sm">Good · improved 4 points this week</div>
        </div>
      </div>
      <div className="ml-auto grid grid-cols-4 gap-4 text-center">
        <MiniScore label="Complexity" value="A" />
        <MiniScore label="Docs" value="72%" />
        <MiniScore label="Coverage" value="81%" />
        <MiniScore label="Security" value="B+" />
      </div>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-display font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
      <div className="surface-panel">
        <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          <Folder className="h-3.5 w-3.5" /> Folder structure
        </div>
        <div className="p-2 space-y-0.5">
          {TREE.map((n, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 h-6 px-1 rounded text-xs font-mono hover:bg-surface/60 transition-colors"
              style={{ paddingLeft: 8 + n.depth * 14 }}
            >
              {n.type === "dir" ? (
                n.depth === 0 ? <FolderOpen className="h-3.5 w-3.5 text-primary" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span>{n.name}</span>
              {n.type === "dir" && (
                <span className="ml-auto text-[10px] text-muted-foreground">{n.children}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="surface-panel">
          <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <Layers className="h-3.5 w-3.5" /> Programming languages
          </div>
          <div className="p-4 space-y-2">
            <div className="h-2 rounded-full bg-surface overflow-hidden flex">
              {LANGS.map((l, i) => (
                <div
                  key={l.name}
                  className={
                    i === 0 ? "bg-primary" : i === 1 ? "bg-info" : i === 2 ? "bg-success" : i === 3 ? "bg-warning" : "bg-muted-foreground/60"
                  }
                  style={{ width: `${l.pct}%` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2">
              {LANGS.map((l, i) => (
                <div key={l.name} className="flex items-center gap-2 text-xs">
                  <span
                    className={
                      "h-2 w-2 rounded-sm " +
                      (i === 0 ? "bg-primary" : i === 1 ? "bg-info" : i === 2 ? "bg-success" : i === 3 ? "bg-warning" : "bg-muted-foreground/60")
                    }
                  />
                  <div className="min-w-0">
                    <div className="truncate">{l.name}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{l.pct}% · {l.loc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="surface-panel">
          <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" /> Detected frameworks & runtime
          </div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {FRAMEWORKS.map((f) => (
              <span key={f} className="h-6 px-2 rounded border border-border bg-background text-[11px] font-mono flex items-center">
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="surface-panel">
            <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Package statistics
            </div>
            <div className="p-3 space-y-1.5 text-xs">
              <StatRow label="Total dependencies" value="142" />
              <StatRow label="Direct" value="38" />
              <StatRow label="Transitive" value="104" />
              <StatRow label="Outdated (major)" value="5" tone="warning" />
              <StatRow label="Bundle size" value="612 KB" />
            </div>
          </div>
          <div className="surface-panel">
            <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> Documentation coverage
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-display font-semibold tabular-nums">72%</span>
                <span className="text-xs text-muted-foreground">of public API documented</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div className="h-full bg-primary/80" style={{ width: "72%" }} />
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">312 / 434 symbols</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={"font-mono " + (tone === "warning" ? "text-warning" : "")}>{value}</span>
    </div>
  );
}

function DependencyGraph() {
  const nodes = [
    { id: "gateway", x: 200, y: 60 },
    { id: "auth", x: 60, y: 160 },
    { id: "user", x: 200, y: 160 },
    { id: "notif", x: 340, y: 160 },
    { id: "redis", x: 60, y: 260 },
    { id: "mongo", x: 200, y: 260 },
    { id: "mq", x: 340, y: 260 },
  ];
  const pos = (id: string) => nodes.find((n) => n.id === id)!;
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Activity className="h-3.5 w-3.5" /> Dependency graph
      </div>
      <div className="relative grid-bg" style={{ height: 340 }}>
        <svg width="100%" height="340">
          {DEPS.map((d, i) => {
            const a = pos(d.from);
            const b = pos(d.to);
            return <line key={i} x1={a.x + 40} y1={a.y + 12} x2={b.x + 40} y2={b.y} stroke="currentColor" strokeWidth="1" className="text-primary/50" />;
          })}
          {nodes.map((n) => (
            <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
              <rect width="80" height="24" rx="4" className="fill-panel stroke-border" stroke="currentColor" />
              <text x="40" y="16" textAnchor="middle" className="fill-foreground text-[11px] font-mono">{n.id}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function QualityTab() {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="surface-panel">
        <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          <Zap className="h-3.5 w-3.5" /> Largest / most complex files
        </div>
        <div className="divide-y divide-border">
          {HOTSPOTS.map((f) => (
            <div key={f.path} className="grid grid-cols-[minmax(0,1fr)_auto_auto_100px] items-center gap-3 px-3 py-2 text-xs">
              <span className="font-mono truncate">{f.path}</span>
              <span className="font-mono text-muted-foreground">{f.lines.toLocaleString()} loc</span>
              <span className="font-mono text-muted-foreground">cx {f.cx}</span>
              <div className="h-1 rounded-full bg-surface overflow-hidden">
                <div className={"h-full " + (f.hot ? "bg-destructive" : "bg-primary")} style={{ width: `${(f.cx / 30) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="surface-panel">
          <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <Copy className="h-3.5 w-3.5" /> Duplicate files
          </div>
          <div className="divide-y divide-border text-xs">
            {DUPES.map((d, i) => (
              <div key={i} className="p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono truncate">{d.a}</span>
                  <span className="text-muted-foreground">≈</span>
                  <span className="font-mono truncate">{d.b}</span>
                </div>
                <div className="text-[10px] font-mono text-warning">{d.pct}% similarity</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel">
          <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" /> Unused dependencies
          </div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {UNUSED.map((u) => (
              <span key={u} className="h-6 px-2 rounded border border-warning/40 bg-warning/10 text-[11px] font-mono text-warning flex items-center">
                {u}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center gap-2 border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5" /> Security issues
      </div>
      <div className="divide-y divide-border text-xs">
        {SECURITY.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <span
              className={
                "h-5 px-1.5 rounded text-[10px] font-mono uppercase " +
                (s.sev === "high"
                  ? "bg-destructive/15 text-destructive border border-destructive/30"
                  : s.sev === "med"
                    ? "bg-warning/15 text-warning border border-warning/30"
                    : "bg-muted text-muted-foreground border border-border")
              }
            >
              {s.sev}
            </span>
            <span className="flex-1 truncate">{s.title}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{s.cwe}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof GitBranch; label: string; value: string; tone?: "warning" }) {
  return (
    <div className="surface-panel p-3.5 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={"text-2xl font-display font-semibold tabular-nums " + (tone === "warning" ? "text-warning" : "")}>{value}</div>
    </div>
  );
}
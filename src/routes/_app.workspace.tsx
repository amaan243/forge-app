import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  Database,
  Download,
  FileCode2,
  FileUp,
  Lock,
  Maximize2,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  Sparkles,
  Terminal,
  TriangleAlert,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export const Route = createFileRoute("/_app/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — ArchForge" },
      {
        name: "description",
        content:
          "The ArchForge workspace: author requirements, generate architecture diagrams, and watch the engineering pipeline in real time.",
      },
      { property: "og:title", content: "Workspace — ArchForge" },
      {
        property: "og:description",
        content:
          "Author software requirements and generate production-ready architecture from a single engineering workstation.",
      },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <ProjectTimeline />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup direction="vertical">
          <ResizablePanel defaultSize={72} minSize={40}>
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={28} minSize={18}>
                <RequirementEditor />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={48} minSize={30}>
                <ArchitectureCanvas />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={24} minSize={18}>
                <AIRecommendations />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={28} minSize={14}>
            <GenerationConsole />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

/* ---------- project timeline ---------- */

const STAGES = [
  "Requirements",
  "Architecture",
  "Database",
  "API",
  "Folder Structure",
  "Documentation",
  "Export",
];

function ProjectTimeline() {
  const currentIdx = 2;
  return (
    <div className="h-11 border-b border-border bg-panel/60 flex items-center gap-2 px-4 overflow-x-auto">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
        Pipeline
      </span>
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={stage} className="flex items-center gap-1">
              <div
                className={
                  "flex items-center gap-1.5 h-7 px-2.5 rounded border text-[11px] font-mono transition-colors " +
                  (active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : done
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-border bg-surface text-muted-foreground")
                }
              >
                {done ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : active ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                )}
                <span>{stage}</span>
              </div>
              {i < STAGES.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- requirement editor ---------- */

const SECTIONS = [
  { key: "func", label: "Functional Requirements", icon: FileCode2, count: 12 },
  { key: "nfr", label: "Non-Functional Requirements", icon: Server, count: 8 },
  { key: "auth", label: "Authentication", icon: Lock, count: 4 },
  { key: "db", label: "Database", icon: Database, count: 6 },
  { key: "cache", label: "Caching", icon: RefreshCw, count: 2 },
  { key: "deploy", label: "Deployment", icon: Cloud, count: 3 },
  { key: "perf", label: "Performance", icon: Sparkles, count: 5 },
  { key: "sec", label: "Security", icon: Lock, count: 7 },
  { key: "mon", label: "Monitoring", icon: Terminal, count: 3 },
];

const SAMPLE_MD = `# Payments Platform

## Functional Requirements
- Users can create and confirm payments via card, wallet, and bank transfer.
- Multi-tenant merchants with isolated ledgers and settlement schedules.
- Idempotent webhook delivery with signed payloads and replay protection.

## Non-Functional Requirements
- **Latency**: p95 < 120ms for /charges
- **Availability**: 99.95% monthly SLA
- **Throughput**: 4,000 rps sustained, 12,000 rps burst

## Authentication
- OAuth 2.1 + PKCE for merchant dashboards
- HMAC-signed API keys for server-to-server
- Short-lived JWTs (5m) with refresh rotation

## Database
- Postgres 16, logical replicas per region
- Event store on append-only ledger table
- Partitioning by tenant_id / month

## Caching
- Redis Cluster for session and rate-limit state
- Read-through cache on merchant configuration
`;

function RequirementEditor() {
  const [active, setActive] = useState("func");
  return (
    <div className="h-full flex flex-col bg-panel/40">
      <PanelHeader
        label="requirements.md"
        badge="draft"
        actions={
          <>
            <IconGhost title="Import Markdown"><FileUp className="h-3.5 w-3.5" /></IconGhost>
            <IconGhost title="Export"><Download className="h-3.5 w-3.5" /></IconGhost>
            <IconGhost title="Save"><Save className="h-3.5 w-3.5" /></IconGhost>
            <Button size="sm" className="h-7 px-2.5 text-xs">
              <Play /> Generate Architecture
            </Button>
          </>
        }
      />
      <div className="flex-1 min-h-0 grid grid-cols-[180px_minmax(0,1fr)]">
        <div className="border-r border-border p-2 space-y-0.5 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Outline
          </div>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const on = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className={
                  "w-full flex items-center gap-2 h-7 px-2 rounded text-xs text-left transition-colors " +
                  (on
                    ? "bg-surface text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent")
                }
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{s.label}</span>
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">{s.count}</span>
              </button>
            );
          })}
        </div>
        <div className="min-h-0 overflow-hidden flex flex-col">
          <textarea
            defaultValue={SAMPLE_MD}
            spellCheck={false}
            className="flex-1 w-full resize-none bg-background border-0 border-b border-border px-4 py-3 text-[13px] font-mono leading-relaxed focus-visible:outline-none"
          />
          <div className="h-7 px-3 flex items-center gap-3 text-[11px] font-mono text-muted-foreground">
            <span>Ln 24, Col 42</span>
            <span>Markdown</span>
            <span className="ml-auto text-success">● saved</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- architecture canvas ---------- */

type Node = { id: string; label: string; kind: string; x: number; y: number };
type Edge = { from: string; to: string };

const NODES: Node[] = [
  { id: "fe", label: "Frontend", kind: "web", x: 80, y: 40 },
  { id: "gw", label: "API Gateway", kind: "gateway", x: 80, y: 130 },
  { id: "auth", label: "Auth Service", kind: "service", x: 80, y: 230 },
  { id: "user", label: "User Service", kind: "service", x: 260, y: 230 },
  { id: "notif", label: "Notification Service", kind: "service", x: 440, y: 230 },
  { id: "redis", label: "Redis", kind: "cache", x: 80, y: 340 },
  { id: "mq", label: "RabbitMQ", kind: "queue", x: 260, y: 340 },
  { id: "mongo", label: "MongoDB", kind: "db", x: 440, y: 340 },
  { id: "s3", label: "Object Storage", kind: "storage", x: 620, y: 340 },
];

const EDGES: Edge[] = [
  { from: "fe", to: "gw" },
  { from: "gw", to: "auth" },
  { from: "gw", to: "user" },
  { from: "gw", to: "notif" },
  { from: "auth", to: "redis" },
  { from: "user", to: "mongo" },
  { from: "user", to: "mq" },
  { from: "notif", to: "mq" },
  { from: "notif", to: "s3" },
];

function ArchitectureCanvas() {
  const [zoom, setZoom] = useState(1);
  const width = 760;
  const height = 420;

  function nodePos(id: string) {
    return NODES.find((n) => n.id === id)!;
  }

  return (
    <div className="h-full flex flex-col bg-panel/30">
      <PanelHeader
        label="architecture.canvas"
        badge="live"
        actions={
          <>
            <IconGhost title="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </IconGhost>
            <div className="h-7 px-2 grid place-items-center rounded border border-border bg-surface text-[11px] font-mono text-muted-foreground w-14 text-center">
              {Math.round(zoom * 100)}%
            </div>
            <IconGhost title="Zoom in" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </IconGhost>
            <div className="h-4 w-px bg-border mx-1" />
            <IconGhost title="Auto layout"><RefreshCw className="h-3.5 w-3.5" /></IconGhost>
            <IconGhost title="Fit"><Maximize2 className="h-3.5 w-3.5" /></IconGhost>
            <IconGhost title="Export PNG"><Download className="h-3.5 w-3.5" /></IconGhost>
          </>
        }
      />
      <div className="flex-1 min-h-0 relative overflow-hidden grid-bg bg-background">
        <div
          className="absolute inset-0 origin-top-left transition-transform"
          style={{ transform: `scale(${zoom})` }}
        >
          <svg width={width} height={height} className="absolute top-6 left-6 overflow-visible">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" className="text-primary/70" />
              </marker>
            </defs>
            {EDGES.map((e, i) => {
              const a = nodePos(e.from);
              const b = nodePos(e.to);
              const x1 = a.x + 70;
              const y1 = a.y + 26;
              const x2 = b.x + 70;
              const y2 = b.y;
              const mid = (y1 + y2) / 2;
              const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
              return (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  strokeWidth="1.25"
                  className="text-primary/60"
                  stroke="currentColor"
                  strokeDasharray="140"
                  strokeDashoffset="0"
                  markerEnd="url(#arrow)"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from="140"
                    to="0"
                    dur="1.8s"
                    begin={`${i * 0.15}s`}
                    fill="freeze"
                  />
                </path>
              );
            })}
          </svg>
          {NODES.map((n) => (
            <CanvasNode key={n.id} node={n} />
          ))}
        </div>
        <MiniMap />
      </div>
    </div>
  );
}

function CanvasNode({ node }: { node: Node }) {
  const kindMap: Record<string, string> = {
    web: "border-info/40",
    gateway: "border-primary/50",
    service: "border-border",
    cache: "border-warning/40",
    queue: "border-warning/40",
    db: "border-success/40",
    storage: "border-success/40",
  };
  return (
    <div
      className={
        "absolute w-[140px] rounded border bg-panel shadow-sm select-none cursor-grab active:cursor-grabbing " +
        kindMap[node.kind]
      }
      style={{ left: node.x, top: node.y }}
    >
      <div className="flex items-center gap-1.5 h-6 px-2 border-b border-border">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {node.kind}
        </span>
      </div>
      <div className="px-2 py-2 text-xs font-medium">{node.label}</div>
    </div>
  );
}

function MiniMap() {
  return (
    <div className="absolute bottom-3 right-3 w-40 h-24 rounded border border-border bg-panel/80 backdrop-blur-sm overflow-hidden">
      <div className="h-5 px-2 flex items-center justify-between border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Minimap</span>
        <div className="flex gap-0.5">
          <button className="h-3 w-3 grid place-items-center rounded border border-border text-muted-foreground">
            <Plus className="h-2 w-2" />
          </button>
          <button className="h-3 w-3 grid place-items-center rounded border border-border text-muted-foreground">
            <Minus className="h-2 w-2" />
          </button>
        </div>
      </div>
      <div className="relative h-[calc(100%-1.25rem)] grid-bg">
        {NODES.map((n) => (
          <div
            key={n.id}
            className="absolute h-1.5 w-3 bg-primary/60 rounded-sm"
            style={{ left: n.x / 8, top: (n.y / 8) + 4 }}
          />
        ))}
        <div className="absolute inset-2 border border-primary/50 rounded-sm" />
      </div>
    </div>
  );
}

/* ---------- AI recommendations ---------- */

const RECS = [
  { key: "auth", title: "Authentication", body: "Add refresh-token rotation and enforce PKCE on all OAuth flows." },
  { key: "perf", title: "Performance", body: "Introduce a read replica for the Orders service; p95 currently 210ms." },
  { key: "cache", title: "Caching", body: "Cache merchant configuration in Redis (60s TTL) to reduce DB QPS by 35%." },
  { key: "scale", title: "Scalability", body: "Move notification fan-out to a queue-based worker pool." },
  { key: "sec", title: "Security", body: "Missing rate limit on /login. Consider 10 req/min per IP with WAF fallback." },
  { key: "deploy", title: "Deployment", body: "Blue/green deploys for Payment Service to minimize customer-facing incidents." },
  { key: "mon", title: "Monitoring", body: "Instrument RED metrics on the API Gateway and route them to Prometheus." },
  { key: "test", title: "Testing", body: "Contract tests between Auth and User services would catch 78% of past incidents." },
];

function AIRecommendations() {
  const [open, setOpen] = useState<string | null>("auth");
  return (
    <div className="h-full flex flex-col bg-panel/40">
      <PanelHeader
        label="ai.recommendations"
        badge={`${RECS.length}`}
        actions={<IconGhost title="Re-analyze"><RefreshCw className="h-3.5 w-3.5" /></IconGhost>}
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {RECS.map((r) => {
          const isOpen = open === r.key;
          return (
            <div key={r.key} className="rounded border border-border bg-background overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : r.key)}
                className="w-full flex items-center gap-2 h-8 px-2.5 text-left hover:bg-surface/60 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-xs font-medium">{r.title}</span>
                <ChevronDown
                  className={"h-3.5 w-3.5 ml-auto text-muted-foreground transition-transform " + (isOpen ? "rotate-180" : "")}
                />
              </button>
              {isOpen && (
                <div className="border-t border-border p-2.5 space-y-2">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{r.body}</p>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]">
                      <Check className="h-3 w-3" /> Apply
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
                      Details
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- console ---------- */

const LOGS: { tone: "ok" | "warn" | "err"; text: string; time: string }[] = [
  { tone: "ok", text: "Parsing Requirements", time: "12:04:22" },
  { tone: "ok", text: "Detecting Entities (37)", time: "12:04:23" },
  { tone: "ok", text: "Designing Database schema", time: "12:04:25" },
  { tone: "ok", text: "Creating APIs (126 endpoints)", time: "12:04:28" },
  { tone: "ok", text: "Generating Architecture (14 services)", time: "12:04:31" },
  { tone: "warn", text: "Notification Service exceeds recommended fan-out (12 > 8)", time: "12:04:33" },
  { tone: "ok", text: "Building Folder Structure", time: "12:04:34" },
  { tone: "ok", text: "Writing Documentation (128 modules)", time: "12:04:41" },
  { tone: "ok", text: "Completed Successfully — score 92", time: "12:04:44" },
];

function GenerationConsole() {
  return (
    <div className="h-full flex flex-col bg-background">
      <PanelHeader
        label="console"
        badge="live"
        actions={
          <>
            <span className="text-[11px] font-mono text-muted-foreground pr-2">9 events · 1 warning</span>
            <IconGhost title="Clear"><XCircle className="h-3.5 w-3.5" /></IconGhost>
          </>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed space-y-0.5">
        {LOGS.map((l, i) => {
          const Icon = l.tone === "ok" ? CheckCircle2 : l.tone === "warn" ? TriangleAlert : XCircle;
          const cls = l.tone === "ok" ? "text-success" : l.tone === "warn" ? "text-warning" : "text-destructive";
          return (
            <div key={i} className="flex items-start gap-2">
              <span className="text-muted-foreground w-20 shrink-0">{l.time}</span>
              <Icon className={"h-3.5 w-3.5 mt-0.5 shrink-0 " + cls} />
              <span>{l.text}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-2 text-muted-foreground">
          <span className="text-primary">archforge</span>
          <span>$</span>
          <span className="h-3 w-1.5 bg-primary animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */

function PanelHeader({
  label,
  badge,
  actions,
}: {
  label: string;
  badge?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="h-9 shrink-0 border-b border-border flex items-center gap-2 px-3">
      <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {badge && (
        <span className="h-5 px-1.5 rounded border border-border bg-surface text-[10px] font-mono text-muted-foreground">
          {badge}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </div>
  );
}

function IconGhost({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
    >
      {children}
    </button>
  );
}
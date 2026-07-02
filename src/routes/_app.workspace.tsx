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
  X,
  Activity,
  ShieldAlert,
  Layers,
  ArrowRight,
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
  const [selected, setSelected] = useState<string | null>("user");
  const [rightTab, setRightTab] = useState<"inspector" | "ai">("inspector");
  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <ProjectTimeline />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={72} minSize={40}>
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize={28} minSize={18}>
                <RequirementEditor />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={48} minSize={30}>
                <ArchitectureCanvas
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    setRightTab("inspector");
                  }}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={24} minSize={18}>
                <RightPane
                  tab={rightTab}
                  onTab={setRightTab}
                  selected={selected}
                  onClose={() => setSelected(null)}
                />
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

function ArchitectureCanvas({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
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
            <CanvasNode
              key={n.id}
              node={n}
              selected={selected === n.id}
              onClick={() => onSelect(n.id)}
            />
          ))}
        </div>
        <MiniMap selected={selected} />
      </div>
    </div>
  );
}

function CanvasNode({
  node,
  selected,
  onClick,
}: {
  node: Node;
  selected: boolean;
  onClick: () => void;
}) {
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
    <button
      className={
        "absolute w-[140px] rounded border bg-panel shadow-sm select-none text-left transition-all " +
        (selected ? "border-primary ring-1 ring-primary/40 shadow-md" : kindMap[node.kind] + " hover:border-primary/50")
      }
      style={{ left: node.x, top: node.y }}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 h-6 px-2 border-b border-border">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {node.kind}
        </span>
      </div>
      <div className="px-2 py-2 text-xs font-medium">{node.label}</div>
    </button>
  );
}

function MiniMap({ selected }: { selected: string | null }) {
  return (
    <div className="absolute bottom-3 right-3 w-48 h-32 rounded border border-border bg-panel/90 backdrop-blur-sm overflow-hidden shadow-lg">
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
      <div className="relative h-[calc(100%-1.25rem)] grid-bg cursor-pointer">
        {NODES.map((n) => (
          <div
            key={n.id}
            className={
              "absolute h-1.5 w-3 rounded-sm " +
              (selected === n.id ? "bg-primary ring-1 ring-primary/60" : "bg-primary/50")
            }
            style={{ left: n.x / 6.5, top: (n.y / 6.5) + 4 }}
          />
        ))}
        <div className="absolute inset-2 border border-primary/60 rounded-sm pointer-events-none" />
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

/* ---------- right pane (inspector + AI) ---------- */

type Inspector = {
  id: string;
  name: string;
  kind: string;
  description: string;
  responsibilities: string[];
  dependencies: string[];
  connected: string[];
  database: string;
  endpoints: { method: string; path: string }[];
  complexity: "Low" | "Medium" | "High";
  latency: string;
  security: string[];
  cache: string;
  suggestions: string[];
};

const INSPECTOR: Record<string, Inspector> = {
  fe: {
    id: "fe",
    name: "Frontend",
    kind: "web",
    description: "React SPA served via CDN; entry point for all merchant dashboards.",
    responsibilities: ["Render dashboards", "OAuth login flows", "Client-side routing"],
    dependencies: ["API Gateway"],
    connected: ["gw"],
    database: "—",
    endpoints: [{ method: "GET", path: "/" }, { method: "GET", path: "/dashboard" }],
    complexity: "Medium",
    latency: "60ms p95",
    security: ["CSP strict-dynamic", "SRI on chunks"],
    cache: "CDN edge cache, 30s stale-while-revalidate",
    suggestions: ["Preload critical fonts", "Ship route-level code splits"],
  },
  gw: {
    id: "gw",
    name: "API Gateway",
    kind: "gateway",
    description: "Terminates TLS, authenticates requests, and routes to downstream services.",
    responsibilities: ["JWT validation", "Rate limiting", "Request tracing"],
    dependencies: ["Auth Service", "User Service", "Notification Service"],
    connected: ["auth", "user", "notif"],
    database: "—",
    endpoints: [
      { method: "POST", path: "/v1/auth" },
      { method: "GET", path: "/v1/users/:id" },
      { method: "POST", path: "/v1/notify" },
    ],
    complexity: "High",
    latency: "12ms p95",
    security: ["mTLS to services", "OWASP rules on WAF"],
    cache: "None (auth-sensitive)",
    suggestions: ["Add global 429 backoff hint", "Emit RED metrics per route"],
  },
  auth: {
    id: "auth",
    name: "Auth Service",
    kind: "service",
    description: "Issues short-lived JWTs, rotates refresh tokens, and enforces MFA.",
    responsibilities: ["Login / logout", "Refresh rotation", "MFA challenges"],
    dependencies: ["Redis"],
    connected: ["redis", "gw"],
    database: "Redis (session store)",
    endpoints: [
      { method: "POST", path: "/login" },
      { method: "POST", path: "/refresh" },
      { method: "POST", path: "/logout" },
    ],
    complexity: "High",
    latency: "38ms p95",
    security: ["PKCE required", "Rate limit /login 10/min/IP"],
    cache: "Refresh tokens in Redis with 5m TTL",
    suggestions: ["Enforce refresh-token rotation", "Add step-up auth for admin scopes"],
  },
  user: {
    id: "user",
    name: "User Service",
    kind: "service",
    description: "Canonical profile store; publishes user.updated events downstream.",
    responsibilities: ["Profile CRUD", "Tenant membership", "Role assignment"],
    dependencies: ["MongoDB", "RabbitMQ"],
    connected: ["mongo", "mq", "gw"],
    database: "MongoDB (users, tenants)",
    endpoints: [
      { method: "GET", path: "/v1/users/:id" },
      { method: "POST", path: "/v1/users" },
      { method: "PATCH", path: "/v1/users/:id" },
    ],
    complexity: "Medium",
    latency: "48ms p95",
    security: ["Field-level encryption on PII"],
    cache: "60s LRU on hot profiles",
    suggestions: ["Add read replica for reporting", "Denormalize tenant lookups"],
  },
  notif: {
    id: "notif",
    name: "Notification Service",
    kind: "service",
    description: "Fan-out delivery over email, SMS, and push via queue-backed workers.",
    responsibilities: ["Templating", "Delivery routing", "Bounce handling"],
    dependencies: ["RabbitMQ", "Object Storage"],
    connected: ["mq", "s3", "gw"],
    database: "S3 (rendered assets)",
    endpoints: [
      { method: "POST", path: "/v1/notify" },
      { method: "GET", path: "/v1/deliveries/:id" },
    ],
    complexity: "High",
    latency: "120ms p95",
    security: ["Signed webhook callbacks"],
    cache: "Compiled templates in-process",
    suggestions: ["Split fan-out to worker pool", "Retry with jittered backoff"],
  },
  redis: {
    id: "redis",
    name: "Redis",
    kind: "cache",
    description: "Session store and rate-limit counters. Redis 7 with 3-node cluster.",
    responsibilities: ["Session store", "Rate limit counters", "Ephemeral cache"],
    dependencies: [],
    connected: ["auth"],
    database: "In-memory",
    endpoints: [],
    complexity: "Low",
    latency: "0.6ms p95",
    security: ["ACL per service", "TLS in transit"],
    cache: "—",
    suggestions: ["Enable RDB snapshots hourly"],
  },
  mq: {
    id: "mq",
    name: "RabbitMQ",
    kind: "queue",
    description: "Durable message broker for async fan-out between services.",
    responsibilities: ["Queue durability", "Fan-out exchanges", "DLQ handling"],
    dependencies: [],
    connected: ["user", "notif"],
    database: "—",
    endpoints: [],
    complexity: "Medium",
    latency: "3ms p95",
    security: ["vhost isolation per tenant"],
    cache: "—",
    suggestions: ["Add quorum queues for reliability"],
  },
  mongo: {
    id: "mongo",
    name: "MongoDB",
    kind: "db",
    description: "Document store for user, tenant, and configuration data.",
    responsibilities: ["Persist users, tenants", "Secondary indexes"],
    dependencies: [],
    connected: ["user"],
    database: "MongoDB 7",
    endpoints: [],
    complexity: "Medium",
    latency: "9ms p95",
    security: ["Encryption at rest", "IAM auth"],
    cache: "WiredTiger cache 8 GB",
    suggestions: ["Add TTL indexes for sessions"],
  },
  s3: {
    id: "s3",
    name: "Object Storage",
    kind: "storage",
    description: "Rendered notification assets and export bundles.",
    responsibilities: ["Blob storage", "Lifecycle rules"],
    dependencies: [],
    connected: ["notif"],
    database: "S3",
    endpoints: [],
    complexity: "Low",
    latency: "24ms p95",
    security: ["Bucket policy: private, signed URLs"],
    cache: "—",
    suggestions: ["Move cold exports to Glacier after 30d"],
  },
};

function RightPane({
  tab,
  onTab,
  selected,
  onClose,
}: {
  tab: "inspector" | "ai";
  onTab: (t: "inspector" | "ai") => void;
  selected: string | null;
  onClose: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-panel/40">
      <div className="h-9 shrink-0 border-b border-border flex items-center px-1">
        <button
          onClick={() => onTab("inspector")}
          className={
            "h-8 px-2.5 text-[11px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors " +
            (tab === "inspector"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          Inspector
        </button>
        <button
          onClick={() => onTab("ai")}
          className={
            "h-8 px-2.5 text-[11px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors " +
            (tab === "ai"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          AI ({RECS.length})
        </button>
        {tab === "inspector" && selected && (
          <button
            onClick={onClose}
            className="ml-auto h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground"
            title="Deselect"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "ai" && <AIRecommendationsList />}
        {tab === "inspector" && (selected ? <InspectorView data={INSPECTOR[selected]} /> : <InspectorEmpty />)}
      </div>
    </div>
  );
}

function AIRecommendationsList() {
  return <AIRecommendations />;
}

function InspectorEmpty() {
  return (
    <div className="h-full grid place-items-center p-6 text-center">
      <div className="space-y-3 max-w-[220px]">
        <div className="mx-auto h-10 w-10 grid place-items-center rounded border border-border bg-surface">
          <Layers className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-xs text-muted-foreground">
          Select a service on the canvas to inspect its responsibilities, endpoints, and AI suggestions.
        </div>
      </div>
    </div>
  );
}

function InspectorView({ data }: { data: Inspector | undefined }) {
  if (!data) return <InspectorEmpty />;
  const cxTone =
    data.complexity === "High"
      ? "text-destructive"
      : data.complexity === "Medium"
        ? "text-warning"
        : "text-success";
  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {data.kind}
        </div>
        <div className="text-base font-display font-semibold tracking-tight">{data.name}</div>
        <p className="text-muted-foreground leading-relaxed">{data.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetaChip label="Complexity" value={data.complexity} tone={cxTone} />
        <MetaChip label="Latency" value={data.latency} icon={Activity} />
      </div>

      <InspectorSection title="Responsibilities">
        <ul className="space-y-1">
          {data.responsibilities.map((r) => (
            <li key={r} className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </InspectorSection>

      {data.dependencies.length > 0 && (
        <InspectorSection title="Dependencies">
          <div className="flex flex-wrap gap-1.5">
            {data.dependencies.map((d) => (
              <span key={d} className="h-6 px-2 rounded border border-border bg-surface text-[11px] font-mono flex items-center">
                {d}
              </span>
            ))}
          </div>
        </InspectorSection>
      )}

      {data.connected.length > 0 && (
        <InspectorSection title="Connected services">
          <div className="space-y-1">
            {data.connected.map((id) => {
              const target = INSPECTOR[id];
              if (!target) return null;
              return (
                <div key={id} className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                  <ArrowRight className="h-3 w-3" />
                  <span>{target.name}</span>
                </div>
              );
            })}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Database">
        <span className="font-mono text-[11px]">{data.database}</span>
      </InspectorSection>

      {data.endpoints.length > 0 && (
        <InspectorSection title={`API endpoints (${data.endpoints.length})`}>
          <div className="rounded border border-border overflow-hidden divide-y divide-border">
            {data.endpoints.map((e) => (
              <div key={e.method + e.path} className="flex items-center gap-2 h-7 px-2 bg-background">
                <span
                  className={
                    "h-4 px-1 rounded text-[9px] font-mono uppercase " +
                    (e.method === "GET"
                      ? "bg-info/15 text-info"
                      : e.method === "POST"
                        ? "bg-success/15 text-success"
                        : e.method === "PATCH"
                          ? "bg-warning/15 text-warning"
                          : "bg-destructive/15 text-destructive")
                  }
                >
                  {e.method}
                </span>
                <span className="font-mono text-[11px] truncate">{e.path}</span>
              </div>
            ))}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Caching strategy">
        <p className="text-[11px] text-muted-foreground">{data.cache}</p>
      </InspectorSection>

      <InspectorSection title="Security" icon={ShieldAlert}>
        <ul className="space-y-1">
          {data.security.map((s) => (
            <li key={s} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <span className="mt-1 h-1 w-1 rounded-full bg-warning shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </InspectorSection>

      <InspectorSection title="AI suggestions" icon={Sparkles}>
        <div className="space-y-1.5">
          {data.suggestions.map((s) => (
            <div key={s} className="rounded border border-border bg-background p-2 text-[11px]">
              {s}
            </div>
          ))}
        </div>
      </InspectorSection>
    </div>
  );
}

function MetaChip({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={"mt-0.5 text-[13px] font-mono " + (tone ?? "")}>{value}</div>
    </div>
  );
}

function InspectorSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {title}
      </div>
      {children}
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
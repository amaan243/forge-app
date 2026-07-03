import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Share2, Shield, ShieldAlert, ArrowRight, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/dependencies")({
  head: () => ({
    meta: [
      { title: "Dependency Visualizer — ArchForge" },
      { name: "description", content: "Interactive graph of services, databases, caches, queues, and external APIs with security context." },
    ],
  }),
  component: DepsPage,
});

type Node = {
  id: string;
  label: string;
  kind: "frontend" | "backend" | "service" | "database" | "cache" | "queue" | "external";
  x: number;
  y: number;
  version: string;
  risk: "low" | "med" | "high";
};

const NODES: Node[] = [
  { id: "web", label: "Web App", kind: "frontend", x: 100, y: 90, version: "2.14.0", risk: "low" },
  { id: "mobile", label: "Mobile", kind: "frontend", x: 100, y: 260, version: "1.9.2", risk: "low" },
  { id: "gw", label: "Gateway", kind: "backend", x: 320, y: 175, version: "3.1.0", risk: "low" },
  { id: "auth", label: "AuthService", kind: "service", x: 540, y: 70, version: "1.4.0", risk: "med" },
  { id: "orders", label: "OrdersService", kind: "service", x: 540, y: 180, version: "2.7.1", risk: "low" },
  { id: "notif", label: "Notifications", kind: "service", x: 540, y: 300, version: "1.1.3", risk: "high" },
  { id: "pg", label: "Postgres", kind: "database", x: 780, y: 120, version: "15.4", risk: "low" },
  { id: "redis", label: "Redis", kind: "cache", x: 780, y: 220, version: "7.2", risk: "low" },
  { id: "kafka", label: "Kafka", kind: "queue", x: 780, y: 320, version: "3.6", risk: "med" },
  { id: "stripe", label: "Stripe", kind: "external", x: 1000, y: 170, version: "2024-11", risk: "low" },
  { id: "sendgrid", label: "SendGrid", kind: "external", x: 1000, y: 300, version: "v3", risk: "med" },
];

const EDGES: [string, string][] = [
  ["web", "gw"], ["mobile", "gw"],
  ["gw", "auth"], ["gw", "orders"], ["gw", "notif"],
  ["auth", "pg"], ["auth", "redis"],
  ["orders", "pg"], ["orders", "redis"], ["orders", "kafka"], ["orders", "stripe"],
  ["notif", "kafka"], ["notif", "sendgrid"],
];

const KIND_COLORS: Record<Node["kind"], string> = {
  frontend: "text-info",
  backend: "text-primary",
  service: "text-primary",
  database: "text-success",
  cache: "text-warning",
  queue: "text-warning",
  external: "text-muted-foreground",
};

function DepsPage() {
  const [selectedId, setSelectedId] = useState<string>("orders");
  const selected = NODES.find((n) => n.id === selectedId)!;
  const dependencies = EDGES.filter(([a]) => a === selectedId).map(([, b]) => NODES.find(n => n.id === b)!);
  const dependents = EDGES.filter(([, b]) => b === selectedId).map(([a]) => NODES.find(n => n.id === a)!);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] min-h-[calc(100vh-3rem)]">
      <div className="p-6 lg:p-8 space-y-4 border-r border-border min-w-0">
        <header className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Share2 className="h-3.5 w-3.5" /> Dependency visualizer
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Service topology</h1>
        </header>

        <div className="surface-panel p-4 overflow-auto">
          <svg viewBox="0 0 1120 400" className="w-full h-[440px] font-mono">
            <defs>
              <pattern id="grid-deps" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" className="text-border" strokeWidth="0.5" />
              </pattern>
              <marker id="arrow-deps" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
              </marker>
            </defs>
            <rect width="1120" height="400" fill="url(#grid-deps)" />
            {EDGES.map(([a, b], i) => {
              const na = NODES.find((n) => n.id === a)!;
              const nb = NODES.find((n) => n.id === b)!;
              const active = a === selectedId || b === selectedId;
              return (
                <line
                  key={i}
                  x1={na.x + 60} y1={na.y + 20}
                  x2={nb.x} y2={nb.y + 20}
                  className={active ? "stroke-primary" : "stroke-border"}
                  strokeWidth={active ? 1.5 : 1}
                  strokeDasharray="4 3"
                  markerEnd="url(#arrow-deps)"
                >
                  {active && (
                    <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite" />
                  )}
                </line>
              );
            })}
            {NODES.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={() => setSelectedId(n.id)}
                className="cursor-pointer"
              >
                <rect width="120" height="44" rx="4"
                  className={
                    (n.id === selectedId ? "fill-primary/15 stroke-primary" : "fill-panel stroke-border") +
                    " hover:stroke-primary/60"
                  }
                  strokeWidth="1" />
                <circle cx="10" cy="14" r="3" className={"fill-current " + KIND_COLORS[n.kind]} />
                <text x="20" y="18" className="fill-foreground" fontSize="11" fontWeight="600">{n.label}</text>
                <text x="10" y="34" className="fill-muted-foreground" fontSize="9">{n.kind} · {n.version}</text>
              </g>
            ))}
          </svg>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
          {(Object.keys(KIND_COLORS) as Node["kind"][]).map((k) => (
            <div key={k} className="flex items-center gap-2 surface-panel px-3 py-2">
              <span className={"h-1.5 w-1.5 rounded-full bg-current " + KIND_COLORS[k]} />
              <span className="capitalize">{k}</span>
              <span className="ml-auto text-muted-foreground">{NODES.filter(n => n.kind === k).length}</span>
            </div>
          ))}
        </div>
      </div>

      <aside className="p-4 bg-panel/50 space-y-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Inspecting</div>
          <div className="text-xl font-display font-semibold mt-1">{selected.label}</div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {selected.kind} · v{selected.version}
          </div>
        </div>

        <div className="surface-panel p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground">Risk level</span>
            <RiskPill risk={selected.risk} />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground">Documentation</span>
            <span className="text-success flex items-center gap-1"><Shield className="h-3 w-3" /> up-to-date</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-muted-foreground">Open CVEs</span>
            <span className={selected.risk === "high" ? "text-destructive" : selected.risk === "med" ? "text-warning" : "text-success"}>
              {selected.risk === "high" ? 3 : selected.risk === "med" ? 1 : 0}
            </span>
          </div>
        </div>

        <DepList title="Depends on" nodes={dependencies} empty="No downstream dependencies" />
        <DepList title="Depended on by" nodes={dependents} empty="No upstream consumers" />

        <a className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1">
          Open service documentation <ExternalLink className="h-3 w-3" />
        </a>
      </aside>
    </div>
  );
}

function RiskPill({ risk }: { risk: "low" | "med" | "high" }) {
  const map = {
    low: "bg-success/10 text-success border-success/30",
    med: "bg-warning/10 text-warning border-warning/30",
    high: "bg-destructive/10 text-destructive border-destructive/30",
  } as const;
  return (
    <span className={"inline-flex items-center gap-1 h-5 px-2 rounded border text-[10px] uppercase " + map[risk]}>
      <ShieldAlert className="h-3 w-3" />
      {risk}
    </span>
  );
}

function DepList({ title, nodes, empty }: { title: string; nodes: Node[]; empty: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <div className="surface-panel divide-y divide-border">
        {nodes.length === 0 ? (
          <div className="p-3 text-[11px] font-mono text-muted-foreground">{empty}</div>
        ) : (
          nodes.map((n) => (
            <div key={n.id} className="p-2.5 flex items-center gap-2">
              <span className={"h-1.5 w-1.5 rounded-full bg-current " + KIND_COLORS[n.kind]} />
              <span className="text-xs font-medium">{n.label}</span>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">v{n.version}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  FlaskConical, Plus, X, ArrowRight, ArrowUpRight, ArrowDownRight, Sparkles, RotateCcw, Check, Zap,
  Clock, DollarSign, GitBranch, Shield, FileText, Database as DBIcon, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/playground")({
  head: () => ({
    meta: [
      { title: "Engineering Playground — ArchForge" },
      { name: "description", content: "Simulate architecture changes and measure performance, cost, complexity and risk before applying." },
    ],
  }),
  component: PlaygroundPage,
});

type ChangeOp =
  | { id: string; op: "add"; kind: "service"; label: string }
  | { id: string; op: "remove"; kind: "service"; label: string }
  | { id: string; op: "modify"; kind: "service"; label: string };

const AVAILABLE: { label: string; kind: ChangeOp["kind"]; hint: string }[] = [
  { label: "Redis cache", kind: "service", hint: "In-memory cache in front of Orders" },
  { label: "Read replica (Postgres)", kind: "service", hint: "Offload read-heavy queries" },
  { label: "Kafka event bus", kind: "service", hint: "Async fanout for Notifications" },
  { label: "CDN edge", kind: "service", hint: "Cache static + SSR responses" },
  { label: "Rate limiter", kind: "service", hint: "Front /auth and /orders" },
];

function PlaygroundPage() {
  const [ops, setOps] = useState<ChangeOp[]>([
    { id: "1", op: "add", kind: "service", label: "Redis cache" },
  ]);

  const impact = useMemo(() => simulate(ops), [ops]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5" /> Engineering playground
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Simulate before you ship</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Stage architectural changes and preview their impact on performance, cost, complexity, security, and delivery time.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setOps([])}><RotateCcw /> Discard</Button>
          <Button variant="outline"><Sparkles /> Generate alternative</Button>
          <Button><Check /> Apply changes</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4">
        <aside className="space-y-4">
          <div className="surface-panel">
            <div className="h-9 px-3 border-b border-border flex items-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Staged changes</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">{ops.length}</span>
            </div>
            <div className="p-2 space-y-1.5">
              {ops.length === 0 && <div className="text-[11px] font-mono text-muted-foreground px-2 py-3">No changes staged.</div>}
              {ops.map((o) => (
                <div key={o.id} className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5">
                  <span className={"h-1.5 w-1.5 rounded-full " + (o.op === "add" ? "bg-success" : o.op === "remove" ? "bg-destructive" : "bg-warning")} />
                  <span className="text-xs font-medium truncate">{o.label}</span>
                  <span className="ml-auto text-[10px] font-mono uppercase text-muted-foreground">{o.op}</span>
                  <button onClick={() => setOps(ops.filter((x) => x.id !== o.id))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-panel">
            <div className="h-9 px-3 border-b border-border flex items-center">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Add change</span>
            </div>
            <div className="p-2 space-y-1">
              {AVAILABLE.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setOps([...ops, { id: crypto.randomUUID(), op: "add", kind: a.kind, label: a.label }])}
                  className="w-full text-left rounded border border-transparent hover:border-border hover:bg-surface/60 px-2 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium">{a.label}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground pl-5">{a.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SimStat icon={Zap} label="Performance" delta={impact.perf} unit="%" positive />
            <SimStat icon={Clock} label="Latency p95" delta={impact.latency} unit="%" positive={impact.latency < 0} inverse />
            <SimStat icon={DollarSign} label="Monthly cost" delta={impact.cost} unit="%" positive={impact.cost < 0} inverse />
            <SimStat icon={GitBranch} label="Complexity" delta={impact.complexity} unit="pts" positive={impact.complexity < 0} inverse />
            <SimStat icon={Shield} label="Security" delta={impact.security} unit="pts" positive />
            <SimStat icon={Clock} label="Dev effort" delta={impact.effort} unit="d" positive={impact.effort < 0} inverse />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TopologyCard title="Before" services={impact.before} />
            <TopologyCard title="After" services={impact.after} highlight />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SideEffect icon={FileText} label="Documentation" note="Will update: README, arch.md, api.md" tone="warning" />
            <SideEffect icon={GitBranch} label="Deployment" note="Adds Redis Helm chart, updates OrdersService env" tone="warning" />
            <SideEffect icon={DBIcon} label="Database" note="No schema changes required" tone="success" />
            <SideEffect icon={Shield} label="Security" note="Improved: reduces DB exposure surface" tone="success" />
          </div>

          <div className="surface-panel p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">AI change impact analysis</span>
              <span className={"ml-auto h-5 px-2 rounded text-[10px] font-mono uppercase border " + riskBadge(impact.risk)}>
                Risk: {impact.risk}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <ImpactBucket label="Affected services" items={["OrdersService", "Gateway"]} />
              <ImpactBucket label="Affected APIs" items={["GET /orders", "GET /orders/:id"]} />
              <ImpactBucket label="DB tables" items={["— none —"]} />
              <ImpactBucket label="Deployments" items={["orders", "cache (new)"]} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function simulate(ops: ChangeOp[]) {
  let perf = 0, latency = 0, cost = 0, complexity = 0, security = 0, effort = 0;
  const after = ["Gateway", "AuthService", "UserService", "OrdersService", "Notifications"];
  ops.forEach((o) => {
    const l = o.label.toLowerCase();
    if (l.includes("redis")) { perf += 35; latency -= 20; cost += 5; complexity += 8; security += 5; effort += 2; after.push("Redis cache"); }
    else if (l.includes("replica")) { perf += 22; latency -= 12; cost += 12; complexity += 6; security += 0; effort += 3; after.push("Postgres replica"); }
    else if (l.includes("kafka")) { perf += 15; latency -= 5; cost += 18; complexity += 14; security += 2; effort += 5; after.push("Kafka bus"); }
    else if (l.includes("cdn")) { perf += 28; latency -= 34; cost += 4; complexity += 3; security += 4; effort += 1; after.push("CDN edge"); }
    else if (l.includes("rate")) { perf += 4; latency += 2; cost += 1; complexity += 4; security += 18; effort += 1; after.push("Rate limiter"); }
  });
  const risk: "low" | "med" | "high" = complexity > 20 ? "high" : complexity > 10 ? "med" : "low";
  return {
    perf, latency, cost, complexity, security, effort,
    before: ["Gateway", "AuthService", "UserService", "OrdersService", "Notifications"],
    after, risk,
  };
}

function riskBadge(r: "low" | "med" | "high") {
  return r === "high" ? "bg-destructive/10 text-destructive border-destructive/30"
    : r === "med" ? "bg-warning/10 text-warning border-warning/30"
    : "bg-success/10 text-success border-success/30";
}

function SimStat({
  icon: Icon, label, delta, unit, positive, inverse,
}: { icon: typeof Zap; label: string; delta: number; unit: string; positive?: boolean; inverse?: boolean }) {
  const isGood = positive;
  const Arrow = delta === 0 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const shown = (delta > 0 ? "+" : "") + delta + unit;
  const cls = delta === 0 ? "text-muted-foreground" : isGood ? "text-success" : "text-destructive";
  return (
    <div className="surface-panel p-3.5">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span className={"text-2xl font-display font-semibold tabular-nums " + cls}>{shown}</span>
        <Arrow className={"h-4 w-4 " + cls} />
      </div>
      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
        {inverse ? "lower is better" : "higher is better"}
      </div>
    </div>
  );
}

function TopologyCard({ title, services, highlight }: { title: string; services: string[]; highlight?: boolean }) {
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 border-b border-border flex items-center">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">{services.length} services</span>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2">
        {services.map((s, i) => {
          const isNew = highlight && !["Gateway", "AuthService", "UserService", "OrdersService", "Notifications"].includes(s);
          return (
            <div key={i} className={
              "flex items-center gap-2 px-2.5 py-2 rounded border font-mono text-xs " +
              (isNew ? "bg-success/10 border-success/30 text-success" : "bg-background border-border")
            }>
              <span className={"h-1.5 w-1.5 rounded-full " + (isNew ? "bg-success" : "bg-muted-foreground")} />
              {s}
              {isNew && <span className="ml-auto text-[10px] uppercase">new</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SideEffect({ icon: Icon, label, note, tone }: { icon: typeof FileText; label: string; note: string; tone: "success" | "warning" }) {
  const cls = tone === "success" ? "text-success" : "text-warning";
  return (
    <div className="surface-panel p-3 flex items-start gap-3">
      <Icon className={"h-4 w-4 mt-0.5 " + cls} />
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}

function ImpactBucket({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">{label}</div>
      <div className="space-y-1">
        {items.map((i) => (
          <div key={i} className="font-mono text-[11px] px-2 py-1 rounded bg-background border border-border">{i}</div>
        ))}
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp, Activity, ShieldAlert, Package, Database, FileText, Layers, PieChart } from "lucide-react";

export const Route = createFileRoute("/_app/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ArchForge" },
      { name: "description", content: "Track generation throughput, architecture scores, and pipeline health over time." },
      { property: "og:title", content: "Analytics — ArchForge" },
      { property: "og:description", content: "Generation throughput, architecture scores, and pipeline health." },
    ],
  }),
  component: AnalyticsPage,
});

const SCORE = [42, 55, 48, 63, 71, 68, 82, 79, 88, 92, 87, 94];
const GROWTH = [12, 18, 22, 30, 34, 41, 52, 58, 63, 71, 78, 84];
const DOCS = [40, 45, 48, 52, 60, 63, 66, 68, 70, 72, 72, 74];
const SEC = [55, 60, 62, 65, 63, 68, 70, 72, 74, 78, 80, 82];
const DEP_HEALTH = [80, 78, 82, 84, 81, 85, 87, 86, 88, 89, 91, 90];

const LANGS = [
  { name: "TypeScript", pct: 68, color: "bg-primary" },
  { name: "SQL", pct: 12, color: "bg-info" },
  { name: "Shell", pct: 8, color: "bg-success" },
  { name: "YAML", pct: 7, color: "bg-warning" },
  { name: "Other", pct: 5, color: "bg-muted-foreground/50" },
];

const SERVICES = [
  { name: "Payments", pct: 28 },
  { name: "Auth", pct: 20 },
  { name: "User", pct: 18 },
  { name: "Notifications", pct: 14 },
  { name: "Gateway", pct: 12 },
  { name: "Workers", pct: 8 },
];

function AnalyticsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Rolling 12 weeks</div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Objective signals across architecture, documentation, and code health.</p>
      </header>

      <div className="grid md:grid-cols-4 gap-3">
        {[
          { icon: TrendingUp, label: "Generations", value: "312", delta: "+18%" },
          { icon: Activity, label: "Avg score", value: "87.4", delta: "+3.2" },
          { icon: ShieldAlert, label: "Security posture", value: "B+", delta: "+1" },
          { icon: Package, label: "Dep health", value: "91%", delta: "+4" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="surface-panel p-3.5 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Icon className="h-3.5 w-3.5" /> {s.label}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-display font-semibold tabular-nums">{s.value}</span>
                <span className="text-xs font-mono text-success">{s.delta}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard icon={BarChart3} title="Architecture complexity score" data={SCORE} format={(v) => v.toString()} />
        <LineCard icon={TrendingUp} title="Repository growth (loc, k)" data={GROWTH} />
        <LineCard icon={FileText} title="Documentation coverage (%)" data={DOCS} />
        <LineCard icon={ShieldAlert} title="Security score" data={SEC} />
        <LineCard icon={Package} title="Dependency health (%)" data={DEP_HEALTH} />
        <HealthTimeline />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <DonutCard icon={Layers} title="Language distribution" items={LANGS} />
        <BarCategoriesCard icon={PieChart} title="Service distribution" items={SERVICES} />
        <MetricsList />
      </div>
    </div>
  );
}

function ChartCard({ icon: Icon, title, data, format }: { icon: typeof BarChart3; title: string; data: number[]; format?: (v: number) => string }) {
  const max = Math.max(...data);
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="p-6 h-56 flex items-end gap-2">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
            <div className="w-full bg-primary/70 group-hover:bg-primary transition-colors rounded-sm relative" style={{ height: `${(v / max) * 100}%` }}>
              <div className="opacity-0 group-hover:opacity-100 absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono bg-panel border border-border rounded px-1 whitespace-nowrap">
                {format ? format(v) : v}
              </div>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">w{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineCard({ icon: Icon, title, data }: { icon: typeof BarChart3; title: string; data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const w = 400;
  const h = 140;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * h;
    return `${x},${y}`;
  });
  const path = "M " + points.join(" L ");
  const area = `${path} L ${w},${h} L 0,${h} Z`;
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" y1={h * f} x2={w} y2={h * f} stroke="currentColor" strokeWidth="0.5" className="text-border" />
          ))}
          <path d={area} className="fill-primary/10" />
          <path d={path} className="stroke-primary" fill="none" strokeWidth="1.5" />
          {data.map((_, i) => {
            const [x, y] = points[i].split(",");
            return <circle key={i} cx={x} cy={y} r="1.75" className="fill-primary" />;
          })}
        </svg>
        <div className="flex justify-between mt-2 text-[10px] font-mono text-muted-foreground">
          <span>12w ago</span>
          <span>latest · {data[data.length - 1]}</span>
        </div>
      </div>
    </div>
  );
}

function HealthTimeline() {
  const events = [
    { w: "w03", label: "Auth refactor", tone: "primary" },
    { w: "w05", label: "Vuln patched", tone: "success" },
    { w: "w07", label: "Perf regression", tone: "warning" },
    { w: "w09", label: "New microservice", tone: "primary" },
    { w: "w11", label: "Docs sprint", tone: "success" },
  ];
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
        <Activity className="h-3.5 w-3.5" /> Health timeline
      </div>
      <div className="p-4 space-y-2 text-xs">
        {events.map((e) => (
          <div key={e.w} className="flex items-center gap-3">
            <span className="w-10 font-mono text-[10px] text-muted-foreground">{e.w}</span>
            <span className={"h-2 w-2 rounded-full " + (e.tone === "success" ? "bg-success" : e.tone === "warning" ? "bg-warning" : "bg-primary")} />
            <span className="flex-1">{e.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutCard({ icon: Icon, title, items }: { icon: typeof BarChart3; title: string; items: { name: string; pct: number; color: string }[] }) {
  let cumulative = 0;
  const segments = items.map((it) => {
    const start = cumulative;
    cumulative += it.pct;
    return { ...it, start, end: cumulative };
  });
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="p-4 flex items-center gap-4">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90">
          {segments.map((s, i) => {
            const dash = (s.pct / 100) * C;
            const offset = -(s.start / 100) * C;
            return (
              <circle
                key={i}
                cx="40"
                cy="40"
                r={R}
                fill="none"
                strokeWidth="12"
                stroke="currentColor"
                className={s.color.replace("bg-", "text-")}
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </svg>
        <div className="flex-1 space-y-1 text-xs">
          {items.map((it) => (
            <div key={it.name} className="flex items-center gap-2">
              <span className={"h-2 w-2 rounded-sm " + it.color} />
              <span className="flex-1 truncate">{it.name}</span>
              <span className="font-mono text-muted-foreground">{it.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BarCategoriesCard({ icon: Icon, title, items }: { icon: typeof BarChart3; title: string; items: { name: string; pct: number }[] }) {
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      <div className="p-4 space-y-2 text-xs">
        {items.map((it) => (
          <div key={it.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <span>{it.name}</span>
              <span className="font-mono text-muted-foreground">{it.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <div className="h-full bg-primary/70" style={{ width: `${it.pct * 3}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricsList() {
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
        <Database className="h-3.5 w-3.5" /> Data metrics
      </div>
      <div className="p-4 space-y-2 text-xs">
        {[
          ["Database tables", "42"],
          ["Relationships", "78"],
          ["Indexes", "126"],
          ["API endpoints", "126"],
          ["Webhooks", "18"],
          ["Background jobs", "22"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-mono">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
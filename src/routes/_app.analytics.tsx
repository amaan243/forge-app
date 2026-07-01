import { createFileRoute } from "@tanstack/react-router";
import { BarChart3, TrendingUp } from "lucide-react";

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

const SERIES = [42, 55, 48, 63, 71, 68, 82, 79, 88, 92, 87, 94];

function AnalyticsPage() {
  const max = Math.max(...SERIES);
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Rolling 12 weeks</div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">Analytics</h1>
      </header>
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { label: "Generations", value: "312", delta: "+18%" },
          { label: "Avg architecture score", value: "87.4", delta: "+3.2" },
          { label: "Avg time to generate", value: "42s", delta: "-11%" },
        ].map((s) => (
          <div key={s.label} className="surface-panel p-3.5 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> {s.label}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-display font-semibold tabular-nums">{s.value}</span>
              <span className="text-xs font-mono text-success">{s.delta}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="surface-panel">
        <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground gap-2">
          <BarChart3 className="h-3.5 w-3.5" /> Architecture score · weekly
        </div>
        <div className="p-6 h-64 flex items-end gap-3">
          {SERIES.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full bg-primary/70 hover:bg-primary transition-colors rounded-sm" style={{ height: `${(v / max) * 100}%` }} />
              <span className="text-[10px] font-mono text-muted-foreground">w{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
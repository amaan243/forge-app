import { createFileRoute } from "@tanstack/react-router";
import { Camera, RotateCcw, Download, Trash2, Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/snapshots")({
  head: () => ({
    meta: [
      { title: "Snapshots — ArchForge" },
      { name: "description", content: "Milestone snapshots preserving architecture, repository, docs and analytics for later restore." },
    ],
  }),
  component: SnapshotsPage,
});

const SNAPSHOTS = [
  { name: "Production", tag: "prod", ts: "2026-07-01", size: "18 MB", arch: 92, health: 88, docs: 76, note: "Frozen for release 3.0" },
  { name: "Beta", tag: "beta", ts: "2026-06-24", size: "16 MB", arch: 86, health: 84, docs: 68, note: "Public beta topology" },
  { name: "Sprint 3", tag: "sprint", ts: "2026-06-18", size: "15 MB", arch: 83, health: 80, docs: 64, note: "End-of-sprint checkpoint" },
  { name: "Sprint 2", tag: "sprint", ts: "2026-06-04", size: "13 MB", arch: 78, health: 74, docs: 55, note: "Baseline for event bus adoption" },
  { name: "Sprint 1", tag: "sprint", ts: "2026-05-20", size: "10 MB", arch: 71, health: 68, docs: 42, note: "Initial monolith split proposal" },
];

function SnapshotsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Camera className="h-3.5 w-3.5" /> Project snapshots
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Milestones you can restore</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Each snapshot preserves the architecture, repository analysis, documentation, analytics and settings at that point in time.
          </p>
        </div>
        <Button><Plus /> New snapshot</Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {SNAPSHOTS.map((s) => (
          <div key={s.name} className="surface-panel p-4 space-y-3 hover:border-primary/40 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span className="font-display font-semibold">{s.name}</span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-1">{s.ts} · {s.size}</div>
              </div>
              <span className={"h-5 px-1.5 rounded text-[10px] font-mono uppercase border " +
                (s.tag === "prod" ? "bg-success/10 text-success border-success/30"
                  : s.tag === "beta" ? "bg-warning/10 text-warning border-warning/30"
                  : "bg-info/10 text-info border-info/30")}>
                {s.tag}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{s.note}</p>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
              <Metric label="Arch" value={s.arch} />
              <Metric label="Health" value={s.health} />
              <Metric label="Docs" value={s.docs} />
            </div>
            <div className="flex gap-1 pt-1">
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs flex-1"><RotateCcw /> Restore</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Download /></Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"><Trash2 /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-display font-semibold tabular-nums">{value}</div>
      <div className="h-1 rounded-full bg-surface overflow-hidden mt-1">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
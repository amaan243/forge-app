import { createFileRoute, Link } from "@tanstack/react-router";
import { History, GitCompare, Copy, RotateCcw, Trash2, Pencil, Eye, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/versions")({
  head: () => ({
    meta: [
      { title: "Versions — ArchForge" },
      { name: "description", content: "Full history of generated architectures. Compare, restore, duplicate, or annotate any version." },
      { property: "og:title", content: "Architecture Versions — ArchForge" },
      { property: "og:description", content: "Every architecture generation creates an immutable version." },
    ],
  }),
  component: VersionsPage,
});

type Version = {
  n: number;
  ts: string;
  author: string;
  model: string;
  score: number;
  health: number;
  docs: number;
  note: string;
  tag?: "current" | "milestone";
};

const VERSIONS: Version[] = [
  { n: 12, ts: "2026-07-03 14:22", author: "Alex Rios", model: "gen-4", score: 92, health: 88, docs: 76, note: "Split UserService into Auth + Profile", tag: "current" },
  { n: 11, ts: "2026-07-02 09:18", author: "Alex Rios", model: "gen-4", score: 88, health: 85, docs: 71, note: "Introduced Redis cache in front of Orders" },
  { n: 10, ts: "2026-06-30 16:04", author: "Priya Shah", model: "gen-4", score: 86, health: 84, docs: 68, note: "Beta milestone — event bus adoption", tag: "milestone" },
  { n: 9, ts: "2026-06-27 11:41", author: "Priya Shah", model: "gen-3.5", score: 83, health: 80, docs: 64, note: "Refactored Notifications fanout" },
  { n: 8, ts: "2026-06-22 18:07", author: "Alex Rios", model: "gen-3.5", score: 81, health: 78, docs: 61, note: "Split payments into billing + settlement" },
  { n: 7, ts: "2026-06-19 08:33", author: "Marco Diaz", model: "gen-3.5", score: 79, health: 74, docs: 58, note: "Initial multi-region topology" },
  { n: 6, ts: "2026-06-16 20:12", author: "Marco Diaz", model: "gen-3.5", score: 76, health: 72, docs: 55, note: "Added Kafka event bus" },
  { n: 5, ts: "2026-06-13 12:44", author: "Alex Rios", model: "gen-3", score: 74, health: 70, docs: 52, note: "Sprint 2 baseline", tag: "milestone" },
];

function VersionsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <History className="h-3.5 w-3.5" /> Architecture evolution
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Version history</h1>
          <p className="text-sm text-muted-foreground">
            Every generation is preserved as an immutable version. Nothing is ever overwritten.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/compare"><GitCompare /> Compare two versions</Link></Button>
          <Button asChild><Link to="/workspace"><Sparkles /> Generate v13</Link></Button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-3">
        <SummaryStat label="Total versions" value="12" />
        <SummaryStat label="Milestones" value="2" />
        <SummaryStat label="Avg score" value="82.5" />
        <SummaryStat label="Retained storage" value="42 MB" />
      </div>

      <div className="relative">
        <div className="absolute left-[15px] top-1 bottom-1 w-px bg-border" aria-hidden />
        <div className="space-y-3">
          {VERSIONS.map((v) => (
            <VersionRow key={v.n} v={v} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel p-3.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function VersionRow({ v }: { v: Version }) {
  const isCurrent = v.tag === "current";
  return (
    <div className="relative pl-9">
      <div
        className={
          "absolute left-[8px] top-4 h-4 w-4 rounded-full border-2 " +
          (isCurrent ? "bg-primary border-primary" : v.tag === "milestone" ? "bg-panel border-warning" : "bg-panel border-border")
        }
      />
      <div className="surface-panel p-4 hover:border-border/80 transition-colors">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">v{v.n}</span>
              <span className="font-display font-semibold text-sm">{v.note}</span>
              {isCurrent && <span className="h-5 px-1.5 rounded text-[10px] font-mono uppercase bg-primary/15 text-primary border border-primary/30">Current</span>}
              {v.tag === "milestone" && <span className="h-5 px-1.5 rounded text-[10px] font-mono uppercase bg-warning/15 text-warning border border-warning/30">Milestone</span>}
            </div>
            <div className="mt-1 text-[11px] font-mono text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>{v.ts}</span>
              <span>by {v.author}</span>
              <span>model {v.model}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 min-w-[280px]">
            <MiniMetric label="Score" value={v.score} accent="primary" />
            <MiniMetric label="Health" value={v.health} accent="success" />
            <MiniMetric label="Docs" value={v.docs} accent="info" />
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Eye /> Open</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Pencil /> Rename</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><Copy /> Duplicate</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"><RotateCcw /> Restore</Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild><Link to="/compare"><GitCompare /> Compare</Link></Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"><Trash2 /> Delete</Button>
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, accent }: { label: string; value: number; accent: "primary" | "success" | "info" }) {
  const cls = accent === "primary" ? "bg-primary" : accent === "success" ? "bg-success" : "bg-info";
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-lg font-display font-semibold tabular-nums">{value}</span>
        <div className="flex-1 h-1 rounded-full bg-surface overflow-hidden">
          <div className={"h-full " + cls} style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  );
}
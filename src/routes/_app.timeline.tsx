import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity, Search, GitBranch, Network, Database, FileText, Download,
  History, Plus, Minus, Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/timeline")({
  head: () => ({
    meta: [
      { title: "Engineering Timeline — ArchForge" },
      { name: "description", content: "Full audit log of every engineering event across your workspaces." },
    ],
  }),
  component: TimelinePage,
});

type EventKind = "repo" | "arch" | "db" | "docs" | "svc-add" | "svc-remove" | "export" | "restore";

const EVENTS: { kind: EventKind; title: string; meta: string; time: string; day: string }[] = [
  { kind: "arch", title: "Architecture v12 generated", meta: "gen-4 · 14 nodes · score 92", time: "14:22", day: "Today" },
  { kind: "svc-add", title: "Service added: CacheLayer (Redis)", meta: "OrdersService dependency", time: "14:22", day: "Today" },
  { kind: "db", title: "Migration applied", meta: "20260703_add_refresh_tokens.sql", time: "13:04", day: "Today" },
  { kind: "docs", title: "Documentation regenerated", meta: "README, arch.md, api.md", time: "13:05", day: "Today" },
  { kind: "export", title: "PDF export completed", meta: "architecture-v12.pdf · 4.6MB", time: "12:41", day: "Today" },
  { kind: "repo", title: "Repository re-scanned", meta: "acme/erp-monorepo@main", time: "09:14", day: "Today" },
  { kind: "arch", title: "Architecture v11 generated", meta: "gen-4 · 13 nodes · score 88", time: "09:18", day: "Yesterday" },
  { kind: "svc-remove", title: "Service removed: LegacySessionStore", meta: "Superseded by AuthService", time: "09:18", day: "Yesterday" },
  { kind: "restore", title: "Restored snapshot", meta: "Sprint 2 baseline", time: "17:22", day: "2 days ago" },
  { kind: "repo", title: "Repository imported", meta: "github.com/acme/erp-monorepo", time: "10:02", day: "2 days ago" },
];

const KIND_META: Record<EventKind, { Icon: typeof Activity; label: string; cls: string }> = {
  repo: { Icon: GitBranch, label: "Repository", cls: "text-info" },
  arch: { Icon: Network, label: "Architecture", cls: "text-primary" },
  db: { Icon: Database, label: "Database", cls: "text-success" },
  docs: { Icon: FileText, label: "Documentation", cls: "text-info" },
  "svc-add": { Icon: Plus, label: "Service added", cls: "text-success" },
  "svc-remove": { Icon: Minus, label: "Service removed", cls: "text-destructive" },
  export: { Icon: Download, label: "Export", cls: "text-muted-foreground" },
  restore: { Icon: History, label: "Restore", cls: "text-warning" },
};

function TimelinePage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const filtered = EVENTS.filter(
    (e) =>
      (filter === "all" || e.kind === filter) &&
      (q === "" || (e.title + e.meta).toLowerCase().includes(q.toLowerCase()))
  );
  const grouped = filtered.reduce<Record<string, typeof EVENTS>>((acc, e) => {
    (acc[e.day] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" /> Engineering timeline
        </div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">Every event, every workspace</h1>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events…" className="pl-8 h-9" />
        </div>
        <div className="flex items-center gap-1 surface-panel p-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mx-1" />
          {(["all", "arch", "repo", "db", "docs", "export", "restore"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={
                "px-2 h-7 rounded text-[11px] font-mono uppercase tracking-wider " +
                (filter === k ? "bg-surface text-foreground border border-border" : "text-muted-foreground hover:text-foreground")
              }
            >
              {k}
            </button>
          ))}
        </div>
        <Button variant="outline" className="h-9">Date range</Button>
      </div>

      {Object.entries(grouped).map(([day, events]) => (
        <section key={day}>
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-3">{day}</div>
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            <div className="space-y-2">
              {events.map((e, i) => {
                const meta = KIND_META[e.kind];
                const Icon = meta.Icon;
                return (
                  <div key={i} className="relative">
                    <span className={"absolute -left-4 top-3 h-2 w-2 rounded-full bg-current " + meta.cls} />
                    <div className="surface-panel p-3 flex items-center gap-3">
                      <span className="h-7 w-7 rounded border border-border bg-surface grid place-items-center">
                        <Icon className={"h-3.5 w-3.5 " + meta.cls} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.title}</div>
                        <div className="text-[11px] font-mono text-muted-foreground truncate">{e.meta}</div>
                      </div>
                      <span className={"text-[10px] font-mono uppercase tracking-wider " + meta.cls}>{meta.label}</span>
                      <span className="text-[11px] font-mono text-muted-foreground w-14 text-right">{e.time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="surface-panel p-8 text-center text-sm text-muted-foreground">No events match your filters.</div>
      )}
    </div>
  );
}
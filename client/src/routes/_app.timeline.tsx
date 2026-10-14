import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  Search,
  GitBranch,
  Network,
  Database,
  FileText,
  Download,
  History,
  Plus,
  Minus,
  Filter,
  FolderOpen,
  Loader2,
  Radar,
  Camera,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import { getTimelineEvents, type TimelineEvent } from "@/api/architecture";

export const Route = createFileRoute("/_app/timeline")({
  head: () => ({
    meta: [
      { title: "Engineering Timeline — ArchForge" },
      { name: "description", content: "Full audit log of every engineering event across your workspaces." },
    ],
  }),
  component: TimelinePage,
});

type EventKind = "repo" | "arch" | "db" | "docs" | "svc-add" | "svc-remove" | "export" | "restore" | "drift";

const KIND_META: Record<string, { Icon: typeof Activity; label: string; cls: string }> = {
  repo: { Icon: GitBranch, label: "Repository", cls: "text-info" },
  arch: { Icon: Network, label: "Architecture", cls: "text-primary" },
  architecture_generated: { Icon: Network, label: "Architecture", cls: "text-primary" },
  architecture_modified: { Icon: Network, label: "Architecture", cls: "text-primary" },
  version_created: { Icon: Network, label: "Version Created", cls: "text-primary" },
  version_published: { Icon: Network, label: "Published", cls: "text-success" },
  version_restored: { Icon: History, label: "Restored", cls: "text-warning" },
  snapshot_created: { Icon: Camera, label: "Snapshot", cls: "text-info" },
  snapshot_restored: { Icon: History, label: "Snapshot Restored", cls: "text-warning" },
  drift_analysis_completed: { Icon: Radar, label: "Drift Analysis", cls: "text-warning" },
  project_created: { Icon: Activity, label: "Project", cls: "text-success" },
  requirements_updated: { Icon: FileText, label: "Requirements", cls: "text-info" },
  db: { Icon: Database, label: "Database", cls: "text-success" },
  docs: { Icon: FileText, label: "Documentation", cls: "text-info" },
  "svc-add": { Icon: Plus, label: "Service added", cls: "text-success" },
  "svc-remove": { Icon: Minus, label: "Service removed", cls: "text-destructive" },
  export: { Icon: Download, label: "Export", cls: "text-muted-foreground" },
  restore: { Icon: History, label: "Restore", cls: "text-warning" },
};

function formatEventKind(event: TimelineEvent): { kind: string; title: string; meta: string; time: string; day: string } {
  const d = new Date(event.created_at);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const day = isToday ? "Today" : d.toLocaleDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let title = event.event_type.replace(/_/g, " ");
  let meta = `${event.entity_type}${event.entity_id ? ` · ${event.entity_id.slice(0, 8)}` : ""}`;

  if (event.event_type === "drift_analysis_completed") {
    title = "Drift Analysis Completed";
    meta = `Score: ${(event.metadata as any)?.match_score ?? "N/A"}`;
  } else if (event.event_type === "architecture_generated") {
    title = "Architecture generated";
    meta = "Deterministic generation pipeline";
  } else if (event.event_type === "version_created") {
    title = "Architecture version saved";
  }

  return {
    kind: event.event_type,
    title,
    meta,
    time,
    day,
  };
}

function TimelinePage() {
  const { currentProject } = useWorkspace();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    setEvents([]);
    if (!currentProject) {
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    const loadTimeline = async () => {
      try {
        const data = await getTimelineEvents(currentProject.id);
        if (!isCurrent) return;
        setEvents(data);
      } catch {
        if (isCurrent) setEvents([]);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadTimeline();

    return () => {
      isCurrent = false;
    };
  }, [currentProject?.id]);

  const formattedEvents = useMemo(() => {
    return events.map(formatEventKind);
  }, [events]);

  const filtered = formattedEvents.filter(
    (e) =>
      (filter === "all" || e.kind === filter) &&
      (q === "" || (e.title + e.meta).toLowerCase().includes(q.toLowerCase()))
  );

  const grouped = filtered.reduce<Record<string, typeof formattedEvents>>((acc, e) => {
    (acc[e.day] ||= []).push(e);
    return acc;
  }, {});

  if (!currentProject) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Engineering Timeline</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to view audit events.</p>
          <div className="pt-2 flex justify-center">
            <ProjectSwitcher variant="inline" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" /> Engineering timeline
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Audit Log & Timeline</h1>
          <p className="text-xs font-mono text-muted-foreground">
            Project: <span className="text-foreground">{currentProject.name}</span>
          </p>
        </div>
        <ProjectSwitcher variant="inline" />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-0 sm:min-w-[240px] w-full sm:w-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search project events…" className="pl-8 h-9 text-xs font-mono" />
        </div>
      </div>

      {loading ? (
        <div className="surface-panel p-8 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading project timeline events…
        </div>
      ) : events.length === 0 ? (
        <div className="surface-panel p-12 text-center space-y-3 border border-border rounded-lg max-w-lg mx-auto">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No events recorded yet</h3>
          <p className="text-xs text-muted-foreground">
            Generate an architecture version, analyze a repository, or run Architecture Drift to see engineering events appear in this project's timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayEvents]) => (
            <div key={day} className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                {day}
              </div>
              <div className="surface-panel divide-y divide-border border border-border rounded-lg overflow-hidden">
                {dayEvents.map((e, idx) => {
                  const meta = KIND_META[e.kind] || { Icon: Activity, label: e.kind, cls: "text-primary" };
                  const Icon = meta.Icon;
                  return (
                    <div key={idx} className="p-3 flex items-start gap-3 hover:bg-surface/50 transition-colors">
                      <div className="h-6 w-6 rounded border border-border flex items-center justify-center shrink-0 mt-0.5 bg-surface">
                        <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-mono font-medium text-foreground">{e.title}</div>
                        <div className="text-[11px] text-muted-foreground">{e.meta}</div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">{e.time}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
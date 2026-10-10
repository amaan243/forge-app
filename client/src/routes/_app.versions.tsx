import { createFileRoute, Link } from "@tanstack/react-router";
import { History, GitCompare, Copy, RotateCcw, Trash2, Eye, Loader2, Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getArchitectureVersions,
  deleteArchitectureVersion,
  duplicateArchitectureVersion,
  restoreArchitectureVersion,
  type ArchitectureVersion,
} from "@/api/architecture";
import { toast } from "sonner";

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

function VersionsPage() {
  const { currentProject } = useWorkspace();
  const [versions, setVersions] = useState<ArchitectureVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    setVersions([]);
    if (!currentProject) {
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    const loadVersions = async () => {
      try {
        const data = await getArchitectureVersions(currentProject.id);
        if (!isCurrent) return;
        setVersions(data);
      } catch {
        // handled
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadVersions();

    return () => {
      isCurrent = false;
    };
  }, [currentProject?.id]);

  const fetchVersions = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await getArchitectureVersions(currentProject.id);
      setVersions(data);
    } catch {
      // handled by global interceptor
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  const handleDuplicate = async (v: ArchitectureVersion) => {
    if (!currentProject) return;
    setActionId(v.id);
    try {
      const graph = await duplicateArchitectureVersion(currentProject.id, v.id, {
        name: `${v.name} (copy)`,
      });
      toast.success(`Duplicated as v${graph.version?.version_number}`);
      await fetchVersions();
    } catch {
      // handled
    } finally {
      setActionId(null);
    }
  };

  const handleRestore = async (v: ArchitectureVersion) => {
    if (!currentProject) return;
    setActionId(v.id + "_restore");
    try {
      const graph = await restoreArchitectureVersion(currentProject.id, v.id);
      toast.success(`Restored as v${graph.version?.version_number} — original v${v.version_number} unchanged`);
      await fetchVersions();
    } catch {
      // handled
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (v: ArchitectureVersion) => {
    if (!currentProject) return;
    if (!window.confirm(`Delete version "${v.name}" (v${v.version_number})? This cannot be undone.`)) return;
    setActionId(v.id + "_delete");
    try {
      await deleteArchitectureVersion(currentProject.id, v.id);
      setVersions((prev) => prev.filter((ver) => ver.id !== v.id));
      toast.success(`Version ${v.version_number} deleted`);
    } catch {
      // handled
    } finally {
      setActionId(null);
    }
  };

  const totalVersions = versions.length;
  const publishedCount = versions.filter((v) => v.status === "published").length;
  const latestVersion = versions[0];

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 grid place-items-center min-h-[50vh]">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-base font-display font-semibold">No project selected</h2>
          <p className="text-sm text-muted-foreground">Select a project from the dashboard to view its architecture versions.</p>
          <Button asChild variant="outline" size="sm"><Link to="/">Go to Dashboard</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <History className="h-3.5 w-3.5" /> Architecture evolution
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Version history</h1>
          <p className="text-sm text-muted-foreground">
            Every version is immutable. Restore or duplicate creates a new version — the original is preserved.
          </p>
          <div className="pt-1">
            <ProjectSwitcher variant="inline" />
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Button variant="outline" asChild><Link to="/compare"><GitCompare /> Compare two versions</Link></Button>
          <Button asChild><Link to="/workspace"><Plus /> New Version</Link></Button>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-3">
        <SummaryStat label="Total versions" value={loading ? "…" : String(totalVersions)} />
        <SummaryStat label="Published" value={loading ? "…" : String(publishedCount)} />
        <SummaryStat label="Latest" value={loading ? "…" : latestVersion ? `v${latestVersion.version_number}` : "—"} />
        <SummaryStat label="Project" value={currentProject.name.slice(0, 12)} />
      </div>

      {loading ? (
        <div className="surface-panel p-12 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading architecture versions…
        </div>
      ) : versions.length === 0 ? (
        <div className="surface-panel p-12 text-center space-y-4">
          <History className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-2">
            <h3 className="text-base font-display font-semibold">No architecture versions yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Open the Workspace, design your architecture on the canvas, then click "Save Version" to create the first immutable snapshot.
            </p>
          </div>
          <Button asChild size="sm"><Link to="/workspace">Open Workspace</Link></Button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[15px] top-1 bottom-1 w-px bg-border" aria-hidden />
          <div className="space-y-3">
            {versions.map((v, idx) => (
              <VersionRow
                key={v.id}
                v={v}
                isCurrent={idx === 0}
                actionId={actionId}
                onDuplicate={() => handleDuplicate(v)}
                onRestore={() => handleRestore(v)}
                onDelete={() => handleDelete(v)}
              />
            ))}
          </div>
        </div>
      )}
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

function VersionRow({
  v,
  isCurrent,
  actionId,
  onDuplicate,
  onRestore,
  onDelete,
}: {
  v: ArchitectureVersion;
  isCurrent: boolean;
  actionId: string | null;
  onDuplicate: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const statusColor =
    v.status === "published"
      ? "bg-panel border-primary"
      : v.status === "archived"
        ? "bg-panel border-border opacity-50"
        : "bg-panel border-border";

  return (
    <div className="relative pl-9">
      <div
        className={
          "absolute left-[8px] top-4 h-4 w-4 rounded-full border-2 " +
          (isCurrent ? "bg-primary border-primary" : v.status === "published" ? "bg-panel border-success" : "bg-panel border-border")
        }
      />
      <div className={`surface-panel p-4 hover:border-border/80 transition-colors ${v.status === "archived" ? "opacity-60" : ""}`}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-muted-foreground">v{v.version_number}</span>
              <span className="font-display font-semibold text-sm">{v.name}</span>
              {isCurrent && (
                <span className="h-5 px-1.5 rounded text-[10px] font-mono uppercase bg-primary/15 text-primary border border-primary/30">
                  Latest
                </span>
              )}
              {v.status === "published" && (
                <span className="h-5 px-1.5 rounded text-[10px] font-mono uppercase bg-success/15 text-success border border-success/30">
                  Published
                </span>
              )}
              {v.status === "archived" && (
                <span className="h-5 px-1.5 rounded text-[10px] font-mono uppercase bg-muted/30 text-muted-foreground border border-border">
                  Archived
                </span>
              )}
            </div>
            {v.description && (
              <p className="mt-1 text-xs text-muted-foreground">{v.description}</p>
            )}
            <div className="mt-1 text-[11px] font-mono text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
              <span>{new Date(v.created_at).toLocaleString()}</span>
              <span>status: {v.status}</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
            <Link to="/workspace"><Eye /> Open</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={onDuplicate}
            disabled={actionId === v.id}
          >
            {actionId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy />}
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={onRestore}
            disabled={actionId === v.id + "_restore"}
          >
            {actionId === v.id + "_restore" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw />}
            Restore
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
            <Link to="/compare"><GitCompare /> Compare</Link>
          </Button>
          {v.status !== "published" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={actionId === v.id + "_delete"}
            >
              {actionId === v.id + "_delete" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
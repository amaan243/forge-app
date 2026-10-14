import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GitCompare,
  Plus,
  Minus,
  Pencil,
  ArrowRight,
  FolderOpen,
  Loader2,
  AlertCircle,
  Network,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getArchitectureVersions,
  compareArchitectureVersions,
  type ArchitectureVersion,
  type ArchitectureComparison,
  type ArchitectureNode,
} from "@/api/architecture";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/compare")({
  head: () => ({
    meta: [
      { title: "Compare Versions — ArchForge" },
      { name: "description", content: "Side-by-side diff of any two architecture versions with change summary." },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { currentProject } = useWorkspace();
  const [versions, setVersions] = useState<ArchitectureVersion[]>([]);
  const [baseVersionId, setBaseVersionId] = useState<string>("");
  const [headVersionId, setHeadVersionId] = useState<string>("");
  const [comparison, setComparison] = useState<ArchitectureComparison | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [comparing, setComparing] = useState(false);

  // 1. Reset & Fetch versions when project changes
  useEffect(() => {
    setVersions([]);
    setBaseVersionId("");
    setHeadVersionId("");
    setComparison(null);

    if (!currentProject) {
      setLoadingVersions(false);
      return;
    }

    let isCurrent = true;
    setLoadingVersions(true);

    const loadVersions = async () => {
      try {
        const vers = await getArchitectureVersions(currentProject.id);
        if (!isCurrent) return;
        setVersions(vers);

        if (vers.length >= 2) {
          // Default: compare the second newest (base) with the newest (head)
          setBaseVersionId(vers[1].id);
          setHeadVersionId(vers[0].id);
        } else if (vers.length === 1) {
          setBaseVersionId(vers[0].id);
          setHeadVersionId(vers[0].id);
        }
      } catch {
        // Global interceptor notifies
      } finally {
        if (isCurrent) {
          setLoadingVersions(false);
        }
      }
    };

    loadVersions();

    return () => {
      isCurrent = false;
    };
  }, [currentProject?.id]);

  // 2. Run comparison when base or head version changes
  useEffect(() => {
    if (!currentProject || !baseVersionId || !headVersionId) {
      setComparison(null);
      return;
    }

    let isCurrent = true;
    setComparing(true);

    const runCompare = async () => {
      try {
        const result = await compareArchitectureVersions(currentProject.id, baseVersionId, headVersionId);
        if (!isCurrent) return;
        setComparison(result);
      } catch {
        if (isCurrent) setComparison(null);
      } finally {
        if (isCurrent) setComparing(false);
      }
    };

    runCompare();

    return () => {
      isCurrent = false;
    };
  }, [currentProject?.id, baseVersionId, headVersionId]);

  const baseVersion = useMemo(() => versions.find((v) => v.id === baseVersionId), [versions, baseVersionId]);
  const headVersion = useMemo(() => versions.find((v) => v.id === headVersionId), [versions, headVersionId]);

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Compare Architectures</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to compare architecture versions.</p>
          <div className="pt-2 flex justify-center">
            <ProjectSwitcher variant="inline" />
          </div>
        </div>
      </div>
    );
  }

  if (loadingVersions) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading architecture versions…
        </div>
      </div>
    );
  }

  if (versions.length < 2) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <GitCompare className="h-3.5 w-3.5" /> Version comparison
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Compare architectures</h1>
          </div>
          <ProjectSwitcher variant="inline" />
        </header>

        <div className="surface-panel p-8 text-center space-y-3 border border-border rounded-lg max-w-xl mx-auto my-12">
          <Network className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">At least 2 versions required</h2>
          <p className="text-sm text-muted-foreground">
            Project <span className="font-mono text-foreground font-semibold">{currentProject.name}</span> currently has {versions.length} saved architecture version{versions.length === 1 ? "" : "s"}. Save or generate another version to view side-by-side architectural diffs.
          </p>
          <div className="pt-3 flex justify-center gap-3">
            <Link to="/workspace">
              <Button size="sm">Open Architecture Workspace</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const addedCount = comparison?.summary.addedNodes ?? 0;
  const removedCount = comparison?.summary.removedNodes ?? 0;
  const modifiedCount = comparison?.summary.modifiedNodes ?? 0;
  const totalChanges = addedCount + removedCount + modifiedCount;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <GitCompare className="h-3.5 w-3.5" /> Version comparison
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Compare architectures</h1>
          <p className="text-sm text-muted-foreground">
            Side-by-side component diff between saved versions for{" "}
            <span className="font-mono text-foreground font-semibold">{currentProject.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ProjectSwitcher variant="inline" />
        </div>
      </header>

      {/* Version Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Base Version */}
        <div className="surface-panel p-4 space-y-2 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Base (Before)
            </span>
            <select
              value={baseVersionId}
              onChange={(e) => setBaseVersionId(e.target.value)}
              className="h-7 rounded border border-border bg-background px-2 text-xs font-mono"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} — {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-semibold">
              v{baseVersion?.version_number ?? "?"}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {baseVersion?.name} · {baseVersion?.created_at ? new Date(baseVersion.created_at).toLocaleDateString() : ""}
            </span>
          </div>
        </div>

        {/* Head Version */}
        <div className="surface-panel p-4 space-y-2 border border-border rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Head (After)
            </span>
            <select
              value={headVersionId}
              onChange={(e) => setHeadVersionId(e.target.value)}
              className="h-7 rounded border border-border bg-background px-2 text-xs font-mono"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} — {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-display font-semibold text-primary">
              v{headVersion?.version_number ?? "?"}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              {headVersion?.name} · {headVersion?.created_at ? new Date(headVersion.created_at).toLocaleDateString() : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="surface-panel p-4 flex flex-wrap items-center gap-6 border border-border rounded-lg">
        {comparing ? (
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground py-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Computing architectural diff…
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display font-semibold tabular-nums">{totalChanges}</span>
              <span className="text-xs text-muted-foreground">component changes detected</span>
            </div>
            <ChangeLegend count={addedCount} label="Added" tone="success" />
            <ChangeLegend count={removedCount} label="Removed" tone="destructive" />
            <ChangeLegend count={modifiedCount} label="Modified" tone="warning" />
            <div className="ml-auto text-[11px] font-mono text-muted-foreground">
              Edge changes: <span className="text-foreground">+{comparison?.summary.addedEdges ?? 0}</span> /{" "}
              <span className="text-destructive">-{comparison?.summary.removedEdges ?? 0}</span>
            </div>
          </>
        )}
      </div>

      {/* Detailed Change Log */}
      <section>
        <h2 className="text-sm font-display font-semibold mb-3">Detailed Component Changes</h2>
        <div className="surface-panel divide-y divide-border border border-border rounded-lg overflow-hidden">
          {totalChanges === 0 && !comparing ? (
            <div className="p-8 text-center text-xs font-mono text-muted-foreground">
              No component differences between v{baseVersion?.version_number} and v{headVersion?.version_number}.
            </div>
          ) : (
            <>
              {comparison?.added.map((node) => (
                <ComponentChangeRow key={node.id} kind="added" node={node} />
              ))}
              {comparison?.removed.map((node) => (
                <ComponentChangeRow key={node.id} kind="removed" node={node} />
              ))}
              {comparison?.modified.map((node) => (
                <ComponentChangeRow key={node.id} kind="modified" node={node} />
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ChangeLegend({ count, label, tone }: { count: number; label: string; tone: "success" | "destructive" | "warning" }) {
  const cls = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-warning";
  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <span className={"font-semibold " + cls}>{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ComponentChangeRow({ kind, node }: { kind: "added" | "removed" | "modified"; node: ArchitectureNode }) {
  const Icon = kind === "added" ? Plus : kind === "removed" ? Minus : Pencil;
  const tone = kind === "added" ? "text-success bg-success/10 border-success/30" : kind === "removed" ? "text-destructive bg-destructive/10 border-destructive/30" : "text-warning bg-warning/10 border-warning/30";

  return (
    <div className="p-3.5 flex items-start gap-3 hover:bg-surface/50 transition-colors">
      <div className={`h-6 w-6 rounded border flex items-center justify-center shrink-0 mt-0.5 ${tone}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold text-foreground">{node.name}</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-border bg-surface text-muted-foreground">
            {node.type}
          </span>
          {node.technology && (
            <span className="text-[11px] font-mono text-primary">
              {node.technology}
            </span>
          )}
        </div>
        {node.description && (
          <p className="text-xs text-muted-foreground mt-1">{node.description}</p>
        )}
      </div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
        {kind}
      </div>
    </div>
  );
}
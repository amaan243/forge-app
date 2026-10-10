import { createFileRoute } from "@tanstack/react-router";
import { Camera, RotateCcw, Plus, Layers, FolderOpen, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getArchitectureSnapshots,
  restoreArchitectureSnapshot,
  getArchitectureVersions,
  createArchitectureSnapshot,
  type ArchitectureSnapshot,
  type ArchitectureVersion,
} from "@/api/architecture";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/snapshots")({
  head: () => ({
    meta: [
      { title: "Snapshots — ArchForge" },
      { name: "description", content: "Milestone snapshots preserving architecture versions for later restore." },
    ],
  }),
  component: SnapshotsPage,
});

function SnapshotsPage() {
  const { currentProject } = useWorkspace();
  const [snapshots, setSnapshots] = useState<ArchitectureSnapshot[]>([]);
  const [versions, setVersions] = useState<ArchitectureVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // New snapshot modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setSnapshots([]);
    setVersions([]);
    if (!currentProject) {
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const [snaps, vers] = await Promise.all([
          getArchitectureSnapshots(currentProject.id),
          getArchitectureVersions(currentProject.id),
        ]);
        if (!isCurrent) return;
        setSnapshots(snaps);
        setVersions(vers);
        if (vers.length > 0) setSelectedVersionId(vers[0].id);
      } catch {
        if (isCurrent) {
          setSnapshots([]);
          setVersions([]);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadData();

    return () => {
      isCurrent = false;
    };
  }, [currentProject?.id]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject || !snapshotName.trim() || !selectedVersionId) return;

    setCreating(true);
    try {
      const snap = await createArchitectureSnapshot(currentProject.id, {
        name: snapshotName.trim(),
        version_id: selectedVersionId,
      });
      setSnapshots((prev) => [snap, ...prev]);
      setIsModalOpen(false);
      setSnapshotName("");
      toast.success(`Snapshot "${snap.name}" created`);
    } catch {
      toast.error("Failed to create snapshot");
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (snap: ArchitectureSnapshot) => {
    if (!currentProject) return;
    if (!window.confirm(`Restore architecture snapshot "${snap.name}"? This will create an active architecture version from this snapshot.`)) return;

    setRestoringId(snap.id);
    try {
      await restoreArchitectureSnapshot(currentProject.id, snap.id);
      toast.success(`Snapshot "${snap.name}" restored successfully!`);
    } catch {
      toast.error("Failed to restore snapshot");
    } finally {
      setRestoringId(null);
    }
  };

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Project Snapshots</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to view milestones and snapshots.</p>
          <div className="pt-2 flex justify-center">
            <ProjectSwitcher variant="inline" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Camera className="h-3.5 w-3.5" /> Project snapshots
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Milestones you can restore</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Each milestone snapshot captures saved architecture versions for{" "}
            <span className="font-mono text-foreground font-semibold">{currentProject.name}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ProjectSwitcher variant="inline" />
          <Button onClick={() => setIsModalOpen(true)} disabled={versions.length === 0} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> New snapshot
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="surface-panel p-8 text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading project snapshots…
        </div>
      ) : snapshots.length === 0 ? (
        <div className="surface-panel p-12 text-center space-y-3 border border-border rounded-lg max-w-md mx-auto">
          <Camera className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-semibold text-foreground">No snapshots yet</h3>
          <p className="text-xs text-muted-foreground">
            Create milestone checkpoints of your architecture versions to easily reference or restore in the future.
          </p>
          {versions.length > 0 && (
            <Button size="sm" onClick={() => setIsModalOpen(true)}>Create Snapshot</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {snapshots.map((s) => (
            <div key={s.id} className="surface-panel p-4 space-y-3 border border-border rounded-lg hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="font-display font-semibold text-foreground">{s.name}</span>
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    {new Date(s.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {s.description && (
                <p className="text-xs text-muted-foreground">{s.description}</p>
              )}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRestore(s)}
                  disabled={restoringId === s.id}
                  className="h-7 px-2.5 text-xs flex-1 font-mono"
                >
                  {restoringId === s.id ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RotateCcw className="h-3 w-3 mr-1" />
                  )}
                  Restore Version
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Snapshot Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Milestone Snapshot</DialogTitle>
            <DialogDescription>
              Capture the current state of a saved architecture version for {currentProject.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSnapshot} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-muted-foreground">Snapshot Name</label>
              <Input
                placeholder="e.g. Release 1.0 Milestone"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                required
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase text-muted-foreground">Architecture Version</label>
              <select
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-mono"
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} — {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={creating || !snapshotName.trim()}>
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Create Snapshot
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
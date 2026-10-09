import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export function ProjectModal() {
  const {
    isNewProjectOpen,
    setIsNewProjectOpen,
    workspaces,
    currentWorkspace,
    selectWorkspace,
    createProject,
    setIsNewWorkspaceOpen,
  } = useWorkspace();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"workspace" | "private">("workspace");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    if (!currentWorkspace) {
      setError("Please create or select a workspace first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
      });
      setName("");
      setDescription("");
      setVisibility("workspace");
      setIsNewProjectOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
      <DialogContent className="sm:max-w-md bg-panel border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-display text-lg">Create New Project</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Define a system or service to architect, model, and analyze.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-2.5 rounded border border-destructive/30 bg-destructive/10 text-destructive text-xs font-mono">
                {error}
              </div>
            )}

            {workspaces.length === 0 ? (
              <div className="p-3 rounded border border-warning/30 bg-warning/10 text-warning text-xs space-y-2">
                <div>No workspace found. You must create a workspace before adding projects.</div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsNewProjectOpen(false);
                    setIsNewWorkspaceOpen(true);
                  }}
                >
                  Create Workspace First
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="proj-ws" className="text-xs font-mono">Target Workspace</Label>
                <Select
                  value={currentWorkspace?.id}
                  onValueChange={(val) => {
                    const ws = workspaces.find((w) => w.id === val);
                    if (ws) selectWorkspace(ws);
                  }}
                >
                  <SelectTrigger id="proj-ws" className="h-8 text-xs font-mono">
                    <SelectValue placeholder="Select workspace" />
                  </SelectTrigger>
                  <SelectContent className="bg-panel border-border">
                    {workspaces.map((w) => (
                      <SelectItem key={w.id} value={w.id} className="text-xs font-mono">
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="proj-name" className="text-xs font-mono">Project Name *</Label>
              <Input
                id="proj-name"
                placeholder="e.g. Payments Gateway, Order Service"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading || workspaces.length === 0}
                required
                autoFocus
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proj-desc" className="text-xs font-mono">Description (Optional)</Label>
              <Textarea
                id="proj-desc"
                placeholder="Architecture goals, capabilities, and system scope..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading || workspaces.length === 0}
                rows={3}
                className="text-xs font-mono resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="proj-vis" className="text-xs font-mono">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(val: "workspace" | "private") => setVisibility(val)}
                disabled={loading}
              >
                <SelectTrigger id="proj-vis" className="h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-panel border-border">
                  <SelectItem value="workspace" className="text-xs font-mono">
                    Workspace (All team members)
                  </SelectItem>
                  <SelectItem value="private" className="text-xs font-mono">
                    Private (Creator only)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewProjectOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !name.trim() || workspaces.length === 0}
            >
              {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

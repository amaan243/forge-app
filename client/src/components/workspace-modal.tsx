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
import { Loader2 } from "lucide-react";

export function WorkspaceModal() {
  const { isNewWorkspaceOpen, setIsNewWorkspaceOpen, createWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setIsNewWorkspaceOpen(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isNewWorkspaceOpen} onOpenChange={setIsNewWorkspaceOpen}>
      <DialogContent className="sm:max-w-md bg-panel border-border">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-display text-lg">Create New Workspace</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Workspaces isolate system architectures, projects, and team members.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <div className="p-2.5 rounded border border-destructive/30 bg-destructive/10 text-destructive text-xs font-mono">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ws-name" className="text-xs font-mono">Workspace Name *</Label>
              <Input
                id="ws-name"
                placeholder="e.g. Core Engineering Platform"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
                autoFocus
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ws-desc" className="text-xs font-mono">Description (Optional)</Label>
              <Textarea
                id="ws-desc"
                placeholder="Brief summary of systems housed within this workspace..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
                rows={3}
                className="text-xs font-mono resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewWorkspaceOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

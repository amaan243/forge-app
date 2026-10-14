import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Terminal,
  TriangleAlert,
  XCircle,
  ZoomIn,
  ZoomOut,
  X,
  Activity,
  ShieldAlert,
  Layers,
  ArrowRight,
  Loader2,
  Trash2,
  Pencil,
  FileCode2,
  Sparkles,
  Boxes,
  LayoutGrid,
  Move,
  FolderGit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  type Requirement,
} from "@/api/requirements";
import {
  getArchitecture,
  generateArchitecture,
  saveArchitectureVersion,
  updateArchitectureEdge,
  explainArchitectureNode,
  runDesignReview,
  type ArchitectureNode,
  type ArchitectureVersion,
  type ArchitectureNodeType,
  type ArchitecturePreview,
  type ArchitectureExplanation,
  type DesignReviewFinding,
} from "@/api/architecture";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/workspace")({
  head: () => ({
    meta: [
      { title: "Workspace — ArchForge" },
      {
        name: "description",
        content:
          "The ArchForge workspace: author requirements, generate architecture diagrams, and watch the engineering pipeline in real time.",
      },
      { property: "og:title", content: "Workspace — ArchForge" },
      {
        property: "og:description",
        content:
          "Author software requirements and generate production-ready architecture from a single engineering workstation.",
      },
    ],
  }),
  component: WorkspacePage,
});

export type CanvasNodeData = {
  id: string;
  backendId?: string;
  label: string;
  kind: string;
  x: number;
  y: number;
  description?: string;
  technology?: string;
  metadata?: Record<string, unknown>;
};

export type CanvasEdgeData = {
  id?: string;
  from: string;
  to: string;
  relationship?: string;
  protocol?: string;
  description?: string;
};

export type ConsoleLogItem = {
  tone: "ok" | "warn" | "err";
  text: string;
  time: string;
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 58;

function formatTime(date: Date = new Date()): string {
  return date.toTimeString().split(" ")[0];
}

function archNodeToCanvas(n: ArchitectureNode): CanvasNodeData {
  return {
    id: n.node_key,
    backendId: n.id,
    label: n.name,
    kind: n.type,
    x: n.position_x,
    y: n.position_y,
    description: n.description ?? undefined,
    technology: n.technology ?? undefined,
    metadata: n.metadata,
  };
}

function WorkspacePage() {
  const { currentProject } = useWorkspace();

  // Requirements state
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [reqsLoading, setReqsLoading] = useState(false);

  // Architecture state
  const [currentVersion, setCurrentVersion] = useState<ArchitectureVersion | null>(null);
  const [canvasNodes, setCanvasNodes] = useState<CanvasNodeData[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdgeData[]>([]);
  const [previewArchitecture, setPreviewArchitecture] = useState<ArchitecturePreview | null>(null);
  const [archLoading, setArchLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Selection & UI state
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"inspector" | "ai">("inspector");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogItem[]>([]);

  // Log helper
  const addLog = useCallback((text: string, tone: "ok" | "warn" | "err" = "ok") => {
    setConsoleLogs((prev) => [...prev, { text, tone, time: formatTime() }]);
  }, []);

  // Update node position during dragging
  const handleUpdateNodePos = useCallback((id: string, x: number, y: number) => {
    setCanvasNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
  }, []);

  // Fetch requirements
  const fetchRequirements = useCallback(async () => {
    if (!currentProject) return;
    setReqsLoading(true);
    try {
      const data = await getRequirements(currentProject.id);
      setRequirements(data);
    } catch {
      // Handled by global interceptor
    } finally {
      setReqsLoading(false);
    }
  }, [currentProject]);

  // Fetch saved architecture from backend
  const fetchArchitecture = useCallback(async () => {
    if (!currentProject) return;
    setArchLoading(true);
    try {
      const graph = await getArchitecture(currentProject.id);
      if (graph.version) {
        setCurrentVersion(graph.version);
        setPreviewArchitecture(null);
        if (graph.nodes.length > 0) {
          const mappedNodes = graph.nodes.map(archNodeToCanvas);
          setCanvasNodes(mappedNodes);
          setSelected((prev) => (mappedNodes.some((n) => n.id === prev) ? prev : mappedNodes[0]?.id ?? null));
        } else {
          setCanvasNodes([]);
          setSelected(null);
        }

        if (graph.edges.length > 0) {
          const nodeKeyMap = new Map(graph.nodes.map((n) => [n.id, n.node_key]));
          setCanvasEdges(
            graph.edges
              .map((e) => ({
                id: e.id,
                from: nodeKeyMap.get(e.source_node_id) ?? "",
                to: nodeKeyMap.get(e.target_node_id) ?? "",
                relationship: e.relationship,
                protocol: e.protocol ?? undefined,
                description: e.description ?? undefined,
              }))
              .filter((e) => e.from && e.to)
          );
        } else {
          setCanvasEdges([]);
        }
      } else {
        // No saved version: canvas empty state
        setCurrentVersion(null);
        setPreviewArchitecture(null);
        setCanvasNodes([]);
        setCanvasEdges([]);
        setSelected(null);
      }
    } catch {
      // Handled by global interceptor
    } finally {
      setArchLoading(false);
    }
  }, [currentProject]);

  // Initial load when currentProject changes
  useEffect(() => {
    // 1. Immediately wipe previous project state to avoid cross-project data leakage
    setRequirements([]);
    setCurrentVersion(null);
    setCanvasNodes([]);
    setCanvasEdges([]);
    setPreviewArchitecture(null);
    setSelected(null);
    setSelectedEdge(null);
    setConsoleLogs([]);

    if (!currentProject) {
      setReqsLoading(false);
      setArchLoading(false);
      return;
    }

    let isCurrent = true;
    setReqsLoading(true);
    setArchLoading(true);

    const loadData = async () => {
      try {
        const [reqs, graph] = await Promise.all([
          getRequirements(currentProject.id),
          getArchitecture(currentProject.id),
        ]);

        if (!isCurrent) return; // Stale response guard

        setRequirements(reqs);

        if (graph.version) {
          setCurrentVersion(graph.version);
          setPreviewArchitecture(null);
          if (graph.nodes.length > 0) {
            const mappedNodes = graph.nodes.map(archNodeToCanvas);
            setCanvasNodes(mappedNodes);
            setSelected(mappedNodes[0]?.id ?? null);
          } else {
            setCanvasNodes([]);
            setSelected(null);
          }

          if (graph.edges.length > 0) {
            const nodeKeyMap = new Map(graph.nodes.map((n) => [n.id, n.node_key]));
            setCanvasEdges(
              graph.edges
                .map((e) => ({
                  from: nodeKeyMap.get(e.source_node_id) ?? "",
                  to: nodeKeyMap.get(e.target_node_id) ?? "",
                  relationship: e.relationship,
                  protocol: e.protocol ?? undefined,
                  description: e.description ?? undefined,
                }))
                .filter((e) => e.from && e.to)
            );
          } else {
            setCanvasEdges([]);
          }
        } else {
          setCurrentVersion(null);
          setPreviewArchitecture(null);
          setCanvasNodes([]);
          setCanvasEdges([]);
          setSelected(null);
        }
      } catch {
        // Handled by global interceptor
      } finally {
        if (isCurrent) {
          setReqsLoading(false);
          setArchLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCurrent = false; // Prevents stale response overwrite
    };
  }, [currentProject?.id]);

  // Generate architecture preview
  const handleGenerateArchitecture = async () => {
    if (!currentProject) return;
    if (requirements.length === 0) {
      toast.error("Please add at least one requirement before generating an architecture.");
      return;
    }

    setGenerating(true);
    setConsoleLogs([
      { tone: "ok", text: `Parsing Requirements (${requirements.length} active requirement${requirements.length === 1 ? "" : "s"})`, time: formatTime() },
      { tone: "ok", text: "Analyzing Requirements: normalizing semantic tokens & entities", time: formatTime() },
      { tone: "ok", text: "Detecting Capabilities: mapping keywords to architecture components", time: formatTime() },
    ]);

    try {
      const response = await generateArchitecture(currentProject.id);
      const preview = response.architecture;

      const detectedCaps = preview.nodes.map((n) => n.name).join(", ");

      setConsoleLogs((prev) => [
        ...prev,
        {
          tone: "ok",
          text: `Building Components: [${detectedCaps}]`,
          time: formatTime(),
        },
        {
          tone: "ok",
          text: `Connecting Components: established ${preview.edges.length} architectural relationships`,
          time: formatTime(),
        },
        { tone: "ok", text: "Validating Architecture schema contracts with Zod", time: formatTime() },
        { tone: "ok", text: "Generating Layout: calculated hierarchical tier coordinates", time: formatTime() },
        { tone: "ok", text: "Architecture Preview Ready (unsaved draft)", time: formatTime() },
      ]);

      setPreviewArchitecture(preview);

      const mappedNodes: CanvasNodeData[] = preview.nodes.map((n) => ({
        id: n.node_key,
        label: n.name,
        kind: n.type,
        x: n.position_x,
        y: n.position_y,
        description: n.description ?? undefined,
        technology: n.technology ?? undefined,
        metadata: n.metadata,
      }));

      const mappedEdges: CanvasEdgeData[] = preview.edges.map((e) => ({
        from: e.source_node_key,
        to: e.target_node_key,
        relationship: e.relationship,
        protocol: e.protocol ?? undefined,
        description: e.description ?? undefined,
      }));

      setCanvasNodes(mappedNodes);
      setCanvasEdges(mappedEdges);
      setSelected(mappedNodes[0]?.id ?? null);
      toast.success("Architecture preview generated from requirements");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to generate architecture";
      addLog(`Generation error: ${msg}`, "err");
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  // Save current preview to database as an immutable version
  const handleSaveVersion = async () => {
    if (!currentProject || canvasNodes.length === 0) return;
    setSaving(true);
    addLog("Saving Architecture Version to PostgreSQL database...", "ok");

    try {
      const nextVersionNum = (currentVersion?.version_number ?? 0) + 1;
      const savedGraph = await saveArchitectureVersion(currentProject.id, {
        name: previewArchitecture?.name || `Architecture v${nextVersionNum}`,
        description: previewArchitecture?.summary || `Generated from ${requirements.length} requirements`,
        nodes: canvasNodes.map((n) => ({
          node_key: n.id,
          name: n.label,
          type: n.kind as ArchitectureNodeType,
          technology: n.technology ?? null,
          description: n.description ?? null,
          metadata: n.metadata ?? {},
          position_x: n.x,
          position_y: n.y,
        })),
        edges: canvasEdges.map((e) => ({
          source_node_key: e.from,
          target_node_key: e.to,
          relationship: "calls",
          protocol: e.protocol ?? null,
          description: e.description ?? null,
        })),
      });

      if (savedGraph.version) {
        setCurrentVersion(savedGraph.version);
        setPreviewArchitecture(null);
        if (savedGraph.nodes.length > 0) {
          setCanvasNodes(savedGraph.nodes.map(archNodeToCanvas));
        }
        addLog(
          `Architecture Version v${savedGraph.version.version_number} persisted successfully`,
          "ok"
        );
        toast.success(`Architecture Version v${savedGraph.version.version_number} saved`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to save architecture version";
      addLog(`Failed to save version: ${msg}`, "err");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Discard preview and revert to saved version
  const handleDiscardPreview = () => {
    fetchArchitecture();
    addLog("Discarded temporary preview", "warn");
    toast.info("Preview discarded");
  };

  if (!currentProject) {
    return (
      <div className="h-[calc(100vh-3rem)] flex flex-col">
        <ProjectTimeline />
        <div className="flex-1 flex items-center justify-center p-8 bg-background">
          <div className="max-w-md w-full surface-panel p-8 text-center space-y-4 border border-border rounded-lg shadow-lg">
            <div className="h-12 w-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-primary">
              <FolderGit2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-display font-semibold text-foreground">No Project Selected</h2>
              <p className="text-xs text-muted-foreground">
                Select an existing project in your workspace or create a new project to author requirements and generate architecture.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <ProjectSwitcher variant="inline" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex flex-col">
      <ProjectTimeline
        currentVersionNumber={currentVersion?.version_number}
        isPreview={Boolean(previewArchitecture)}
      />
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize={72} minSize={40}>
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize={28} minSize={18}>
                <RequirementEditor
                  requirements={requirements}
                  loading={reqsLoading}
                  onRefresh={fetchRequirements}
                  onRequirementChanged={fetchRequirements}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={48} minSize={30}>
                <ArchitectureCanvas
                  canvasNodes={canvasNodes}
                  canvasEdges={canvasEdges}
                  currentVersion={currentVersion}
                  previewArchitecture={previewArchitecture}
                  requirementsCount={requirements.length}
                  loading={archLoading}
                  generating={generating}
                  saving={saving}
                  selected={selected}
                  selectedEdge={selectedEdge}
                  onSelect={(id) => {
                    setSelected(id);
                    setSelectedEdge(null);
                    setRightTab("inspector");
                  }}
                  onSelectEdge={(key) => {
                    setSelectedEdge(key);
                    setSelected(null);
                    setRightTab("inspector");
                  }}
                  onUpdateNodePos={handleUpdateNodePos}
                  onGenerate={handleGenerateArchitecture}
                  onSaveVersion={handleSaveVersion}
                  onDiscardPreview={handleDiscardPreview}
                  onReload={fetchArchitecture}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={24} minSize={18}>
                <RightPane
                  tab={rightTab}
                  onTab={setRightTab}
                  selected={selected}
                  selectedEdge={selectedEdge}
                  canvasNodes={canvasNodes}
                  canvasEdges={canvasEdges}
                  currentProject={currentProject}
                  currentVersion={currentVersion}
                  onClose={() => {
                    setSelected(null);
                    setSelectedEdge(null);
                  }}
                  onSelectNode={(nodeKey) => {
                    setSelected(nodeKey);
                    setSelectedEdge(null);
                    setRightTab("inspector");
                  }}
                  onReload={fetchArchitecture}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={28} minSize={14}>
            <GenerationConsole
              logs={consoleLogs}
              isGenerating={generating}
              onClear={() => setConsoleLogs([])}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

/* ---------- project timeline ---------- */

const STAGES = [
  "Requirements",
  "Architecture",
  "Database",
  "API",
  "Folder Structure",
  "Documentation",
  "Export",
];

function ProjectTimeline({
  currentVersionNumber,
  isPreview,
}: {
  currentVersionNumber?: number;
  isPreview?: boolean;
}) {
  const { currentProject } = useWorkspace();
  const currentIdx = currentVersionNumber || isPreview ? 1 : 0;

  return (
    <div className="h-11 border-b border-border bg-panel/60 flex items-center justify-between gap-2 px-4 relative z-20">
      <div className="flex items-center gap-2 overflow-x-auto min-w-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
          Pipeline
        </span>
        <div className="flex items-center gap-1">
          {STAGES.map((stage, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={stage} className="flex items-center gap-1">
                <div
                  className={
                    "flex items-center gap-1.5 h-7 px-2.5 rounded border text-[11px] font-mono transition-colors " +
                    (active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : done
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-border bg-surface text-muted-foreground")
                  }
                >
                  {done ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : active ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  )}
                  <span>{stage}</span>
                </div>
                {i < STAGES.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ProjectSwitcher variant="toolbar" />
        {currentVersionNumber && (
          <span className="h-5 px-1.5 rounded text-[10px] font-mono border border-success/40 bg-success/10 text-success">
            v{currentVersionNumber}
          </span>
        )}
        {isPreview && (
          <span className="h-5 px-1.5 rounded text-[10px] font-mono border border-warning/40 bg-warning/10 text-warning">
            preview
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- requirement editor ---------- */

function RequirementEditor({
  requirements,
  loading,
  onRefresh,
  onRequirementChanged,
}: {
  requirements: Requirement[];
  loading: boolean;
  onRefresh: () => void;
  onRequirementChanged: () => void;
}) {
  const { currentProject } = useWorkspace();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [newContent, setNewContent] = useState("");
  const [showNew, setShowNew] = useState(false);

  const handleCreate = async () => {
    if (!currentProject || !newContent.trim()) return;
    setSaving(true);
    try {
      await createRequirement(currentProject.id, { content: newContent.trim() });
      setNewContent("");
      setShowNew(false);
      onRequirementChanged();
      toast.success("Requirement created");
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (req: Requirement) => {
    setEditingId(req.id);
    setEditingContent(req.content);
  };

  const handleSaveEdit = async () => {
    if (!currentProject || !editingId) return;
    setSaving(true);
    try {
      await updateRequirement(currentProject.id, editingId, { content: editingContent });
      setEditingId(null);
      onRequirementChanged();
      toast.success("Requirement updated");
    } catch {
      // handled
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentProject) return;
    try {
      await deleteRequirement(currentProject.id, id);
      if (editingId === id) setEditingId(null);
      onRequirementChanged();
      toast.success("Requirement deleted");
    } catch {
      // handled
    }
  };

  return (
    <div className="h-full flex flex-col bg-panel/40">
      <PanelHeader
        label="requirements.md"
        badge={requirements.length > 0 ? String(requirements.length) : "0"}
        actions={
          <>
            <IconGhost title="Refresh" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5" /></IconGhost>
            {editingId && (
              <IconGhost title="Save changes" onClick={handleSaveEdit}><Save className="h-3.5 w-3.5" /></IconGhost>
            )}
            <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => setShowNew(true)} disabled={!currentProject}>
              <Plus /> Add Requirement
            </Button>
          </>
        }
      />

      {!currentProject ? (
        <div className="flex-1 grid place-items-center">
          <div className="text-center space-y-2">
            <Layers className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground">Select a project to view requirements</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 grid place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
          {showNew && (
            <div className="rounded border border-primary/40 bg-background p-2 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">New Requirement</div>
              <textarea
                autoFocus
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Describe requirement (e.g. User auth, PostgreSQL database, Semantic search with PDF upload)..."
                rows={3}
                className="w-full resize-none bg-surface rounded border border-border px-2 py-1.5 text-xs font-mono focus-visible:outline-none focus-visible:border-primary/60"
              />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-6 px-2 text-[11px]" onClick={handleCreate} disabled={saving || !newContent.trim()}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => { setShowNew(false); setNewContent(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {requirements.length === 0 && !showNew && (
            <div className="py-12 text-center space-y-3">
              <FileCode2 className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">No requirements yet. Add your first requirement to get started.</p>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowNew(true)}>
                <Plus className="h-3 w-3 mr-1" /> Add First Requirement
              </Button>
            </div>
          )}

          {requirements.map((req, i) => {
            const isEditing = editingId === req.id;
            return (
              <div
                key={req.id}
                className={
                  "rounded border bg-background p-2 transition-colors " +
                  (isEditing ? "border-primary" : "border-border hover:border-primary/40")
                }
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground">#{i + 1}</span>
                    <span className="text-[10px] font-mono text-primary font-semibold">v{req.version}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconGhost title="Edit" onClick={() => handleStartEdit(req)}>
                      <Pencil className="h-3 w-3" />
                    </IconGhost>
                    <IconGhost title="Delete" onClick={() => handleDelete(req.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </IconGhost>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      rows={3}
                      className="w-full resize-none bg-surface rounded border border-border px-2 py-1 text-xs font-mono focus-visible:outline-none focus-visible:border-primary"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" className="h-6 px-2 text-[11px]" onClick={handleSaveEdit} disabled={saving}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {req.content}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- edge path calculation with connection handles ---------- */

function getEdgePathAndHandles(
  source: { x: number; y: number },
  target: { x: number; y: number },
  w = NODE_WIDTH,
  h = NODE_HEIGHT
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  let sx: number;
  let sy: number;
  let tx: number;
  let ty: number;
  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  if (dy > 35) {
    // Target is clearly below source -> bottom handle to top handle
    sx = source.x + w / 2;
    sy = source.y + h;
    tx = target.x + w / 2;
    ty = target.y;
    const curvature = Math.max(30, (ty - sy) * 0.45);
    c1x = sx;
    c1y = sy + curvature;
    c2x = tx;
    c2y = ty - curvature;
  } else if (dy < -35) {
    // Target is clearly above source -> top handle to bottom handle
    sx = source.x + w / 2;
    sy = source.y;
    tx = target.x + w / 2;
    ty = target.y + h;
    const curvature = Math.max(30, (sy - ty) * 0.45);
    c1x = sx;
    c1y = sy - curvature;
    c2x = tx;
    c2y = ty + curvature;
  } else if (dx >= 0) {
    // Target is to the right -> right handle to left handle
    sx = source.x + w;
    sy = source.y + h / 2;
    tx = target.x;
    ty = target.y + h / 2;
    const curvature = Math.max(30, (tx - sx) * 0.45);
    c1x = sx + curvature;
    c1y = sy;
    c2x = tx - curvature;
    c2y = ty;
  } else {
    // Target is to the left -> left handle to right handle
    sx = source.x;
    sy = source.y + h / 2;
    tx = target.x + w;
    ty = target.y + h / 2;
    const curvature = Math.max(30, (sx - tx) * 0.45);
    c1x = sx - curvature;
    c1y = sy;
    c2x = tx + curvature;
    c2y = ty;
  }

  const d = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  const midX = 0.5 * (sx + tx);
  const midY = 0.5 * (sy + ty);

  return { d, sx, sy, tx, ty, midX, midY };
}

/* ---------- architecture canvas with pan, zoom & drag ---------- */

function ArchitectureCanvas({
  canvasNodes,
  canvasEdges,
  currentVersion,
  previewArchitecture,
  requirementsCount,
  loading,
  generating,
  saving,
  selected,
  selectedEdge,
  onSelect,
  onSelectEdge,
  onUpdateNodePos,
  onGenerate,
  onSaveVersion,
  onDiscardPreview,
  onReload,
}: {
  canvasNodes: CanvasNodeData[];
  canvasEdges: CanvasEdgeData[];
  currentVersion: ArchitectureVersion | null;
  previewArchitecture: ArchitecturePreview | null;
  requirementsCount: number;
  loading: boolean;
  generating: boolean;
  saving: boolean;
  selected: string | null;
  selectedEdge: string | null;
  onSelect: (id: string) => void;
  onSelectEdge: (key: string) => void;
  onUpdateNodePos: (id: string, x: number, y: number) => void;
  onGenerate: () => void;
  onSaveVersion: () => void;
  onDiscardPreview: () => void;
  onReload: () => void;
}) {
  const { currentProject } = useWorkspace();

  // Canvas Viewport transform state
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 60, y: 30 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Dragging state
  const [draggingNode, setDraggingNode] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  function nodePos(id: string) {
    return canvasNodes.find((n) => n.id === id);
  }

  // Pan event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Don't pan if clicking directly on a node card
    if ((e.target as HTMLElement).closest(".canvas-node-card")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode) {
      const newX = Math.round((e.clientX - pan.x) / zoom - draggingNode.offsetX);
      const newY = Math.round((e.clientY - pan.y) / zoom - draggingNode.offsetY);
      onUpdateNodePos(draggingNode.id, newX, newY);
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNode(null);
  };

  // Zoom via mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.min(2.0, Math.max(0.4, zoom * factor));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    } else {
      setZoom(newZoom);
    }
  };

  // Node mouse down initiates drag
  const handleNodeMouseDown = (e: React.MouseEvent, node: CanvasNodeData) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(node.id);
    const mouseCanvasX = (e.clientX - pan.x) / zoom;
    const mouseCanvasY = (e.clientY - pan.y) / zoom;
    setDraggingNode({
      id: node.id,
      offsetX: mouseCanvasX - node.x,
      offsetY: mouseCanvasY - node.y,
    });
  };

  // Fit View
  const handleFitView = useCallback(() => {
    if (canvasNodes.length === 0 || !containerRef.current) {
      setPan({ x: 60, y: 30 });
      setZoom(1.0);
      return;
    }
    const xs = canvasNodes.map((n) => n.x);
    const ys = canvasNodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + NODE_WIDTH;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + NODE_HEIGHT;

    const rect = containerRef.current.getBoundingClientRect();
    const pad = 50;
    const availW = Math.max(100, rect.width - pad * 2);
    const availH = Math.max(100, rect.height - pad * 2);
    const graphW = Math.max(100, maxX - minX);
    const graphH = Math.max(100, maxY - minY);

    const fitZoom = Math.min(1.1, Math.max(0.5, Math.min(availW / graphW, availH / graphH)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(fitZoom);
    setPan({
      x: Math.round(rect.width / 2 - centerX * fitZoom),
      y: Math.round(rect.height / 2 - centerY * fitZoom),
    });
  }, [canvasNodes]);

  // Auto Layout
  const handleAutoLayout = useCallback(() => {
    if (canvasNodes.length === 0) return;
    const tierMap: Record<string, number> = {
      frontend: 0,
      gateway: 1,
      api: 1,
      auth: 2,
      service: 2,
      worker: 2,
      monitoring: 2,
      database: 3,
      storage: 3,
      cache: 3,
      queue: 3,
      external_service: 3,
      infrastructure: 3,
    };

    const tiers: Map<number, CanvasNodeData[]> = new Map();
    for (const node of canvasNodes) {
      const tier = tierMap[node.kind] ?? 2;
      if (!tiers.has(tier)) tiers.set(tier, []);
      tiers.get(tier)!.push(node);
    }

    const tierY = [40, 160, 290, 430];
    const spacing = 190;

    for (let t = 0; t <= 3; t++) {
      const inTier = tiers.get(t) || [];
      if (inTier.length > 0) {
        const totalW = (inTier.length - 1) * spacing;
        const startX = Math.max(60, 400 - totalW / 2);
        inTier.forEach((node, i) => {
          onUpdateNodePos(node.id, Math.round(startX + i * spacing), tierY[t]);
        });
      }
    }

    toast.info("Auto-layout applied");
    setTimeout(handleFitView, 50);
  }, [canvasNodes, onUpdateNodePos, handleFitView]);

  const badgeText = previewArchitecture
    ? "preview (unsaved)"
    : currentVersion
      ? `v${currentVersion.version_number} · ${currentVersion.status}`
      : "no version";

  const badgeColor = previewArchitecture
    ? "border-warning/50 bg-warning/15 text-warning"
    : currentVersion
      ? "border-success/40 bg-success/10 text-success"
      : "border-border bg-surface text-muted-foreground";

  return (
    <div className="h-full flex flex-col bg-panel/30">
      <PanelHeader
        label="architecture.canvas"
        badge={badgeText}
        badgeClass={badgeColor}
        actions={
          <>
            {(loading || generating) && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            <IconGhost title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </IconGhost>
            <button
              onClick={() => { setZoom(1.0); }}
              title="Click to reset zoom to 100%"
              className="h-7 px-2 grid place-items-center rounded border border-border bg-surface text-[11px] font-mono text-muted-foreground hover:text-foreground w-14 text-center transition-colors"
            >
              {Math.round(zoom * 100)}%
            </button>
            <IconGhost title="Zoom in" onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(2))))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </IconGhost>
            <IconGhost title="Fit view" onClick={handleFitView}>
              <Maximize2 className="h-3.5 w-3.5" />
            </IconGhost>
            <IconGhost title="Auto layout" onClick={handleAutoLayout}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </IconGhost>
            <div className="h-4 w-px bg-border mx-1" />
            <IconGhost title="Reload saved version" onClick={onReload}>
              <RefreshCw className="h-3.5 w-3.5" />
            </IconGhost>

            {previewArchitecture ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={onDiscardPreview}
                  disabled={saving}
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 shadow-sm"
                  onClick={onSaveVersion}
                  disabled={saving || !currentProject}
                  title="Persist this preview as a new immutable architecture version"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save Version
                </Button>
              </>
            ) : canvasNodes.length > 0 ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={onGenerate}
                disabled={generating || requirementsCount === 0 || !currentProject}
                title="Regenerate architecture from updated requirements"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Regenerate
              </Button>
            ) : null}
          </>
        }
      />

      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className={
          "flex-1 min-h-0 relative overflow-hidden grid-bg bg-background select-none " +
          (isPanning ? "cursor-grabbing" : draggingNode ? "cursor-grabbing" : "cursor-grab")
        }
      >
        {canvasNodes.length === 0 ? (
          /* Empty state when 0 architecture versions exist */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
            <div className="max-w-sm space-y-4">
              <div className="mx-auto h-12 w-12 rounded-xl border border-border bg-panel flex items-center justify-center shadow-sm">
                <Boxes className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-display font-semibold tracking-tight text-foreground">
                  No architecture generated yet
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {requirementsCount === 0
                    ? "Add requirements in the left panel to begin, then generate an architecture."
                    : "Add requirements and generate an architecture."}
                </p>
              </div>

              <div className="pt-1 flex flex-col items-center gap-2">
                <Button
                  onClick={onGenerate}
                  disabled={generating || requirementsCount === 0 || !currentProject}
                  className="h-8 px-4 text-xs font-medium gap-1.5"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating Architecture…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate Architecture
                    </>
                  )}
                </Button>
                {requirementsCount === 0 && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    (Requires at least 1 requirement)
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Real Architecture Viewport with Pan, Zoom & Drag */
          <>
            <div
              className="absolute inset-0 origin-top-left pointer-events-none"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              {/* SVG Edges Layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                <defs>
                  <marker
                    id="edge-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" className="text-primary/75" />
                  </marker>
                  <marker
                    id="edge-arrow-active"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 9 5 L 0 9 z" fill="currentColor" className="text-primary" />
                  </marker>
                </defs>

                {canvasEdges.map((e, i) => {
                  const srcNode = nodePos(e.from);
                  const tgtNode = nodePos(e.to);
                  if (!srcNode || !tgtNode) return null;

                  const { d, midX, midY } = getEdgePathAndHandles(srcNode, tgtNode);
                  const isEdgeActive =
                    selected === e.from || selected === e.to || selectedEdge === `${e.from}->${e.to}`;

                  const label =
                    e.protocol ||
                    (e.relationship === "authenticates"
                      ? "AUTH"
                      : e.relationship === "reads" || e.relationship === "writes"
                        ? "DATABASE"
                        : e.relationship === "publishes" || e.relationship === "subscribes"
                          ? "QUEUE"
                          : "HTTP");

                  return (
                    <g
                      key={`${e.from}->${e.to}-${i}`}
                      className="group cursor-pointer pointer-events-auto"
                      onClick={(evt) => {
                        evt.stopPropagation();
                        onSelectEdge(`${e.from}->${e.to}`);
                      }}
                    >
                      {/* Transparent wider hit zone */}
                      <path d={d} fill="none" stroke="transparent" strokeWidth="16" />

                      {/* Static guide path */}
                      <path
                        d={d}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={isEdgeActive ? "2.2" : "1.25"}
                        className={
                          isEdgeActive
                            ? "text-primary/80 transition-colors"
                            : "text-border/80 group-hover:text-primary/50 transition-colors"
                        }
                      />

                      {/* Animated engineering flow line */}
                      <path
                        d={d}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={isEdgeActive ? "2" : "1.2"}
                        strokeDasharray="6 6"
                        className={
                          isEdgeActive
                            ? "text-primary transition-colors"
                            : "text-primary/70 group-hover:text-primary transition-colors"
                        }
                        markerEnd={isEdgeActive ? "url(#edge-arrow-active)" : "url(#edge-arrow)"}
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="24"
                          to="0"
                          dur={isEdgeActive ? "0.9s" : "1.5s"}
                          repeatCount="indefinite"
                        />
                      </path>

                      {/* Relationship/Protocol Pill on wire */}
                      <foreignObject
                        x={midX - 35}
                        y={midY - 10}
                        width="70"
                        height="20"
                        className="overflow-visible pointer-events-none"
                      >
                        <div className="flex justify-center items-center w-full h-full">
                          <span
                            className={
                              "px-1.5 py-0.5 rounded text-[8.5px] font-mono tracking-wider uppercase border shadow-xs select-none transition-all " +
                              (isEdgeActive
                                ? "border-primary bg-panel text-primary font-semibold ring-1 ring-primary/40"
                                : "border-border/80 bg-background/90 text-muted-foreground group-hover:border-primary/40 group-hover:text-foreground")
                            }
                          >
                            {label}
                          </span>
                        </div>
                      </foreignObject>
                    </g>
                  );
                })}
              </svg>

              {/* HTML Nodes Layer */}
              {canvasNodes.map((n) => (
                <CanvasNode
                  key={n.id}
                  node={n}
                  selected={selected === n.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, n)}
                  onClick={() => onSelect(n.id)}
                />
              ))}
            </div>

            {/* Minimap */}
            <LiveMiniMap
              nodes={canvasNodes}
              selected={selected}
              pan={pan}
              zoom={zoom}
              onNavigate={(targetX, targetY) => {
                if (containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  setPan({
                    x: Math.round(rect.width / 2 - targetX * zoom),
                    y: Math.round(rect.height / 2 - targetY * zoom),
                  });
                }
              }}
            />

            {/* Status Pill in Canvas */}
            <div className="absolute top-3 left-3 flex items-center gap-2 select-none pointer-events-none">
              {previewArchitecture ? (
                <div className="flex items-center gap-2 px-2.5 py-1 rounded border border-warning/40 bg-warning/10 text-[11px] font-mono text-warning backdrop-blur-sm shadow-sm pointer-events-auto">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                  <span>Architecture Preview (unsaved) — click "Save Version" to persist</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2 py-0.5 rounded border border-border/60 bg-panel/70 text-[10px] font-mono text-muted-foreground backdrop-blur-xs">
                  <span>Hold & drag canvas to pan · drag nodes to move</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CanvasNode({
  node,
  selected,
  onMouseDown,
  onClick,
}: {
  node: CanvasNodeData;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const kindMap: Record<string, string> = {
    frontend: "border-info/40",
    gateway: "border-primary/50",
    service: "border-border",
    backend: "border-border",
    cache: "border-warning/40",
    queue: "border-warning/40",
    database: "border-success/40",
    storage: "border-success/40",
    auth: "border-primary/40",
    worker: "border-border",
    api: "border-border",
    monitoring: "border-info/30",
    infrastructure: "border-border",
    external_service: "border-muted-foreground/30",
  };

  return (
    <div
      className={
        "canvas-node-card absolute w-[160px] h-[58px] rounded border bg-panel shadow-sm select-none text-left transition-shadow pointer-events-auto cursor-grab active:cursor-grabbing group " +
        (selected
          ? "border-primary ring-1 ring-primary/60 shadow-md z-10"
          : (kindMap[node.kind] ?? "border-border") + " hover:border-primary/50 z-1")
      }
      style={{ left: node.x, top: node.y }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {/* Visual Port Connection Handles on Node Borders */}
      <span className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full border border-primary/50 bg-background group-hover:scale-125 transition-transform pointer-events-none" />
      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full border border-primary/50 bg-background group-hover:scale-125 transition-transform pointer-events-none" />
      <span className="absolute top-1/2 -left-1 -translate-y-1/2 h-2 w-2 rounded-full border border-primary/50 bg-background group-hover:scale-125 transition-transform pointer-events-none" />
      <span className="absolute top-1/2 -right-1 -translate-y-1/2 h-2 w-2 rounded-full border border-primary/50 bg-background group-hover:scale-125 transition-transform pointer-events-none" />

      {/* Node Header */}
      <div className="flex items-center justify-between h-[22px] px-2 border-b border-border bg-surface/50 rounded-t">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/80 shrink-0" />
          <span className="text-[9.5px] font-mono uppercase tracking-wider text-muted-foreground truncate">
            {node.kind}
          </span>
        </div>
        <Move className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
      </div>

      {/* Node Body */}
      <div className="px-2 py-1 flex flex-col justify-center h-[34px]">
        <div className="text-xs font-medium truncate leading-tight" title={node.label}>
          {node.label}
        </div>
        {node.technology && (
          <div className="text-[9.5px] font-mono text-muted-foreground truncate leading-tight mt-0.5">
            {node.technology}
          </div>
        )}
      </div>
    </div>
  );
}

function LiveMiniMap({
  nodes,
  selected,
  pan,
  zoom,
  onNavigate,
}: {
  nodes: CanvasNodeData[];
  selected: string | null;
  pan: { x: number; y: number };
  zoom: number;
  onNavigate: (x: number, y: number) => void;
}) {
  if (nodes.length === 0) return null;

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 600) + NODE_WIDTH;
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 450) + NODE_HEIGHT;

  const width = Math.max(200, maxX - minX);
  const height = Math.max(150, maxY - minY);

  const scaleX = 180 / width;
  const scaleY = 110 / height;
  const mapScale = Math.min(scaleX, scaleY);

  const handleMiniMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetCanvasX = minX + clickX / mapScale;
    const targetCanvasY = minY + clickY / mapScale;
    onNavigate(targetCanvasX, targetCanvasY);
  };

  return (
    <div className="absolute bottom-3 right-3 w-48 h-32 rounded border border-border bg-panel/90 backdrop-blur-sm overflow-hidden shadow-lg select-none">
      <div className="h-5 px-2 flex items-center justify-between border-b border-border bg-surface/50">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Minimap</span>
        <span className="text-[9px] font-mono text-muted-foreground">{nodes.length} nodes</span>
      </div>
      <div
        className="relative h-[calc(100%-1.25rem)] grid-bg cursor-pointer"
        onClick={handleMiniMapClick}
      >
        {nodes.map((n) => (
          <div
            key={n.id}
            className={
              "absolute rounded-xs transition-colors " +
              (selected === n.id ? "bg-primary ring-1 ring-primary/80" : "bg-primary/50")
            }
            style={{
              left: Math.max(2, (n.x - minX) * mapScale),
              top: Math.max(2, (n.y - minY) * mapScale),
              width: Math.max(6, NODE_WIDTH * mapScale),
              height: Math.max(4, NODE_HEIGHT * mapScale),
            }}
          />
        ))}

        {/* Viewport Indicator */}
        <div
          className="absolute border border-primary/60 bg-primary/10 rounded-xs pointer-events-none"
          style={{
            left: Math.max(0, (-pan.x / zoom - minX) * mapScale),
            top: Math.max(0, (-pan.y / zoom - minY) * mapScale),
            width: Math.max(12, (500 / zoom) * mapScale),
            height: Math.max(10, (300 / zoom) * mapScale),
          }}
        />
      </div>
    </div>
  );
}

/* ---------- dynamic right pane (inspector + architecture insights) ---------- */

type DynamicInspector = {
  id: string;
  backendId?: string;
  name: string;
  kind: string;
  description: string;
  responsibilities: string[];
  dependencies: string[];
  connected: string[];
  database: string;
  endpoints: { method: string; path: string }[];
  complexity: "Low" | "Medium" | "High";
  latency: string;
  security: string[];
  cache: string;
  suggestions: string[];
};

function buildDynamicInspectorData(
  selectedId: string | null,
  nodes: CanvasNodeData[],
  edges: CanvasEdgeData[]
): DynamicInspector | null {
  if (!selectedId) return null;
  const node = nodes.find((n) => n.id === selectedId);
  if (!node) return null;

  const outgoing = edges.filter((e) => e.from === node.id).map((e) => e.to);
  const incoming = edges.filter((e) => e.to === node.id).map((e) => e.from);
  const connectedKeys = Array.from(new Set([...outgoing, ...incoming]));
  const connectedLabels = connectedKeys.map((k) => nodes.find((n) => n.id === k)?.label || k);

  const isAuth = node.kind === "auth";
  const isGateway = node.kind === "gateway" || node.kind === "api";
  const isDb = node.kind === "database";
  const isCache = node.kind === "cache";
  const isQueue = node.kind === "queue";
  const isStorage = node.kind === "storage";
  const isFrontend = node.kind === "frontend" || node.kind === "web";
  const isVector = node.id.includes("vector") || node.id.includes("embedding");

  const totalConnections = outgoing.length + incoming.length;
  const complexity = totalConnections > 3 ? "High" : totalConnections > 1 ? "Medium" : "Low";

  const responsibilities: string[] = [];
  if (node.description) responsibilities.push(node.description);
  if (isFrontend) responsibilities.push("Render user interface components", "Client route navigation", "API interaction");
  else if (isGateway) responsibilities.push("API request routing & TLS termination", "Rate limiting protection", "Ingress validation boundary");
  else if (isAuth) responsibilities.push("User identity authentication", "JWT token generation", "Role-based authorization");
  else if (isVector) responsibilities.push("Vector embedding calculation", "Dense similarity index", "kNN vector queries");
  else if (isDb) responsibilities.push("Relational entity storage", "ACID transactional consistency", "Index maintenance");
  else if (isCache) responsibilities.push("In-memory cache retrieval", "Session key storage", "Rate limit counters");
  else if (isQueue) responsibilities.push("Asynchronous event queue", "Message distribution", "Worker task dispatch");
  else if (isStorage) responsibilities.push("Asset and document storage", "Presigned upload URLs", "Blob lifecycle");
  else responsibilities.push("Domain business logic execution", "Service-to-service communication", "Entity mutations");

  const security: string[] = [];
  if (isAuth) security.push("Argon2 / bcrypt password hashing", "Short-lived JWT tokens", "RBAC policy enforcement");
  else if (isGateway) security.push("OWASP WAF rules", "Rate limiting per client IP", "Strict TLS in transit");
  else if (isDb) security.push("Encryption at rest (AES-256)", "Least privilege database roles", "Parameterized queries");
  else if (isFrontend) security.push("Content Security Policy (CSP)", "XSS protection", "HttpOnly session cookies");
  else if (isStorage) security.push("Bucket policies: private by default", "Time-limited presigned URLs");
  else security.push("Internal network boundary", "Service-to-service token validation");

  const suggestions: string[] = [];
  if (isDb) suggestions.push("Configure connection pooling (PgBouncer)", "Schedule automated nightly backups");
  else if (isVector) suggestions.push("Tune HNSW indexing parameters (m, ef_construction)", "Batch embedding requests");
  else if (isGateway) suggestions.push("Add global 429 backoff headers", "Export Prometheus RED latency metrics");
  else if (isAuth) suggestions.push("Enforce MFA / 2FA for administrative roles", "Add token refresh rotation");
  else if (isCache) suggestions.push("Set eviction policy to volatile-lru", "Monitor memory fragmentation");
  else if (isQueue) suggestions.push("Configure Dead Letter Queue (DLQ) for failed messages", "Monitor consumer group lag");
  else suggestions.push("Implement health check endpoints (/health, /ready)", "Add structured OpenTelemetry tracing");

  const endpoints = isGateway
    ? [
        { method: "POST", path: "/api/v1/auth" },
        { method: "GET", path: "/api/v1/projects" },
        { method: "POST", path: "/api/v1/projects" },
      ]
    : isAuth
      ? [
          { method: "POST", path: "/auth/login" },
          { method: "POST", path: "/auth/register" },
          { method: "POST", path: "/auth/refresh" },
        ]
      : isFrontend
        ? [
            { method: "GET", path: "/" },
            { method: "GET", path: "/dashboard" },
          ]
        : [
            { method: "GET", path: "/api/health" },
            { method: "GET", path: "/api/entities" },
          ];

  return {
    id: node.id,
    backendId: node.backendId,
    name: node.label,
    kind: node.kind,
    description: node.description || `${node.label} component derived from project requirements`,
    responsibilities: responsibilities.slice(0, 3),
    dependencies: incoming.map((id) => nodes.find((n) => n.id === id)?.label || id),
    connected: connectedLabels,
    database: isDb ? "PostgreSQL / Dedicated" : nodes.find((n) => n.kind === "database")?.label || "None",
    endpoints: isDb || isCache || isQueue || isStorage ? [] : endpoints,
    complexity,
    latency: isDb ? "4ms p95" : isCache ? "1ms p95" : isFrontend ? "45ms p95" : "12ms p95",
    security,
    cache: isCache ? "Redis" : nodes.find((n) => n.kind === "cache")?.label || "None",
    suggestions,
  };
}

function RightPane({
  tab,
  onTab,
  selected,
  selectedEdge,
  canvasNodes,
  canvasEdges,
  currentProject,
  currentVersion,
  onClose,
  onSelectNode,
  onReload,
}: {
  tab: "inspector" | "ai";
  onTab: (t: "inspector" | "ai") => void;
  selected: string | null;
  selectedEdge: string | null;
  canvasNodes: CanvasNodeData[];
  canvasEdges: CanvasEdgeData[];
  currentProject: any;
  currentVersion: ArchitectureVersion | null;
  onClose: () => void;
  onSelectNode: (key: string) => void;
  onReload: () => void;
}) {
  const inspectorData = buildDynamicInspectorData(selected, canvasNodes, canvasEdges);
  const activeEdge = selectedEdge
    ? canvasEdges.find((e) => `${e.from}->${e.to}` === selectedEdge)
    : null;

  return (
    <div className="h-full flex flex-col bg-panel/40">
      <div className="h-9 shrink-0 border-b border-border flex items-center px-1">
        <button
          onClick={() => onTab("inspector")}
          className={
            "h-8 px-2.5 text-[11px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors " +
            (tab === "inspector"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          {selectedEdge ? "Edge Inspector" : "Inspector"}
        </button>
        <button
          onClick={() => onTab("ai")}
          className={
            "h-8 px-2.5 text-[11px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors " +
            (tab === "ai"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground")
          }
        >
          Design Review & Insights
        </button>
        {tab === "inspector" && (selected || selectedEdge) && (
          <button
            onClick={onClose}
            className="ml-auto h-7 w-7 grid place-items-center text-muted-foreground hover:text-foreground"
            title="Deselect"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === "ai" && (
          <ArchitectureInsights
            nodes={canvasNodes}
            currentProject={currentProject}
            onSelectNode={onSelectNode}
          />
        )}
        {tab === "inspector" &&
          (activeEdge ? (
            <EdgeInspectorView
              edge={activeEdge}
              canvasNodes={canvasNodes}
              currentProject={currentProject}
              currentVersion={currentVersion}
              onReload={onReload}
            />
          ) : inspectorData ? (
            <InspectorView data={inspectorData} currentProject={currentProject} />
          ) : (
            <InspectorEmpty />
          ))}
      </div>
    </div>
  );
}

function EdgeInspectorView({
  edge,
  canvasNodes,
  currentProject,
  currentVersion,
  onReload,
}: {
  edge: CanvasEdgeData;
  canvasNodes: CanvasNodeData[];
  currentProject: any;
  currentVersion: ArchitectureVersion | null;
  onReload: () => void;
}) {
  const [relationship, setRelationship] = useState(edge.relationship || "calls");
  const [protocol, setProtocol] = useState(edge.protocol || "HTTP/REST");
  const [description, setDescription] = useState(edge.description || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRelationship(edge.relationship || "calls");
    setProtocol(edge.protocol || "HTTP/REST");
    setDescription(edge.description || "");
  }, [edge]);

  const fromNode = canvasNodes.find((n) => n.id === edge.from);
  const toNode = canvasNodes.find((n) => n.id === edge.to);

  const handleSaveEdge = async () => {
    if (!currentProject || !currentVersion?.id || !edge.id) {
      toast.info("Edge updated in local preview.");
      return;
    }
    setSaving(true);
    try {
      await updateArchitectureEdge(currentProject.id, currentVersion.id, edge.id, {
        relationship: relationship as any,
        protocol: protocol || undefined,
        description: description || undefined,
      });
      toast.success("Architecture edge updated successfully.");
      onReload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to update edge");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 space-y-4 text-xs">
      <div className="space-y-1">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Architecture Edge
        </div>
        <div className="text-sm font-display font-semibold flex items-center gap-1.5">
          <span>{fromNode?.label || edge.from}</span>
          <ArrowRight className="h-3 w-3 text-primary" />
          <span>{toNode?.label || edge.to}</span>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          {edge.id ? `ID: ${edge.id.slice(0, 8)}` : "Preview edge"}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Relationship
          </label>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono"
          >
            <option value="calls">calls (service invocation)</option>
            <option value="reads">reads (data store query)</option>
            <option value="writes">writes (data persistence)</option>
            <option value="publishes">publishes (event stream)</option>
            <option value="subscribes">subscribes (event consumption)</option>
            <option value="authenticates">authenticates (identity token check)</option>
            <option value="streams">streams (duplex socket)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Protocol / Transport
          </label>
          <Input
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            placeholder="e.g. gRPC, HTTP/REST, WebSocket, TCP"
            className="text-xs font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Synchronous query with retry & backoff"
            className="text-xs"
          />
        </div>

        <Button
          onClick={handleSaveEdge}
          disabled={saving}
          className="w-full text-xs font-semibold gap-1.5"
          size="sm"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save Edge Updates
        </Button>
      </div>
    </div>
  );
}

function ArchitectureInsights({
  nodes,
  currentProject,
  onSelectNode,
}: {
  nodes: CanvasNodeData[];
  currentProject: any;
  onSelectNode: (key: string) => void;
}) {
  const [findings, setFindings] = useState<DesignReviewFinding[] | null>(null);
  const [isRunningReview, setIsRunningReview] = useState(false);

  const handleRunDesignReview = async () => {
    if (!currentProject) return;
    setIsRunningReview(true);
    try {
      const res = await runDesignReview(currentProject.id);
      setFindings(res);
      toast.success(`Design review completed: ${res.length} findings`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to run design review");
    } finally {
      setIsRunningReview(false);
    }
  };

  const hasDb = nodes.some((n) => n.kind === "database");
  const hasCache = nodes.some((n) => n.kind === "cache");
  const hasAuth = nodes.some((n) => n.kind === "auth");
  const hasQueue = nodes.some((n) => n.kind === "queue");
  const hasVector = nodes.some((n) => n.id.includes("vector") || n.id.includes("embedding"));

  const insights = [
    {
      title: "Security & Perimeter",
      body: hasAuth
        ? "Dedicated authentication service isolates user session verification from downstream domain logic."
        : "No dedicated authentication service detected. System relies on external or gateway identity handling.",
    },
    {
      title: "Data Persistence",
      body: hasVector
        ? "Hybrid storage topology: Vector index handles high-dimensional similarity while relational stores maintain domain records."
        : hasDb
          ? "Relational database tier provides ACID transactions for core business state."
          : "No persistent database node detected. Add persistence requirements if required.",
    },
    {
      title: "Performance & Caching",
      body: hasCache
        ? "In-memory cache store offloads hot reads from the database tier."
        : "Direct data access detected. Consider Redis caching if low latency reads are required.",
    },
    {
      title: "Asynchronous Workloads",
      body: hasQueue
        ? "Message queue decouples heavy processing from user-facing request cycles."
        : "Workloads are currently synchronous. Consider background queueing for long tasks.",
    },
  ];

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="surface-panel p-3 space-y-2 border border-primary/30 bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-primary" />
            <span>Design Review Engine</span>
          </div>
          <Button
            size="sm"
            onClick={handleRunDesignReview}
            disabled={isRunningReview || !currentProject}
            className="h-7 px-2 text-[11px]"
          >
            {isRunningReview ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            Run Review
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Audits topology for coupling hotspots, unlinked components, and reliability risks.
        </p>
      </div>

      {findings && (
        <div className="space-y-2">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Review Findings</span>
            <span>{findings.length} findings</span>
          </div>
          {findings.length === 0 ? (
            <div className="p-3 rounded border border-success/30 bg-success/10 text-success text-[11px]">
              No architecture design issues identified! Topology conforms to best practices.
            </div>
          ) : (
            findings.map((f, idx) => {
              const isHigh = f.severity === "high";
              const isMed = f.severity === "medium";
              return (
                <div
                  key={idx}
                  className={`p-2.5 rounded border space-y-1.5 ${
                    isHigh
                      ? "border-destructive/40 bg-destructive/10"
                      : isMed
                        ? "border-warning/40 bg-warning/10"
                        : "border-info/40 bg-info/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-semibold text-foreground text-xs">{f.finding}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold shrink-0 ${
                        isHigh
                          ? "bg-destructive text-destructive-foreground"
                          : isMed
                            ? "bg-warning text-black"
                            : "bg-info text-info-foreground"
                      }`}
                    >
                      {f.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {f.explanation}
                  </p>
                  <div className="text-[11px] text-foreground font-medium bg-background/60 p-1.5 rounded">
                    Rec: {f.recommendation}
                  </div>
                  {f.component_ids && f.component_ids.length > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      <span className="text-[10px] font-mono text-muted-foreground">Affected:</span>
                      {f.component_ids.map((cid) => {
                        const matched = nodes.find((n) => n.backendId === cid || n.id === cid);
                        return (
                          <button
                            key={cid}
                            type="button"
                            onClick={() => onSelectNode(matched ? matched.id : cid)}
                            className="px-1.5 py-0.5 rounded border border-border bg-surface text-[10px] font-mono hover:border-primary transition-colors text-primary"
                          >
                            {matched ? matched.label : cid.slice(0, 8)} →
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      <div className="pt-2 border-t border-border space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Architecture Analysis ({nodes.length} components)
        </div>
        {insights.map((item, i) => (
          <div key={i} className="rounded border border-border bg-background p-2.5 space-y-1">
            <div className="font-semibold text-foreground text-xs">{item.title}</div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InspectorEmpty() {
  return (
    <div className="h-full grid place-items-center p-6 text-center">
      <div className="space-y-3 max-w-[220px]">
        <div className="mx-auto h-10 w-10 grid place-items-center rounded border border-border bg-surface">
          <Layers className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-xs text-muted-foreground">
          Select a component or connection wire on the canvas to inspect or edit details.
        </div>
      </div>
    </div>
  );
}

function InspectorView({
  data,
  currentProject,
}: {
  data: DynamicInspector;
  currentProject: any;
}) {
  const [explanation, setExplanation] = useState<ArchitectureExplanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const cxTone =
    data.complexity === "High"
      ? "text-destructive"
      : data.complexity === "Medium"
        ? "text-warning"
        : "text-success";

  const handleExplainNode = async () => {
    if (!currentProject || !data.backendId) {
      toast.error("Component node backend record not loaded.");
      return;
    }
    setIsExplaining(true);
    try {
      const res = await explainArchitectureNode(currentProject.id, data.backendId);
      setExplanation(res);
      toast.success("Architecture explanation generated.");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to generate explanation");
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {data.kind}
          </div>
          {data.backendId && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExplainNode}
              disabled={isExplaining}
              className="h-6 px-2 text-[10px] font-mono gap-1"
            >
              {isExplaining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-primary" />}
              Explain Component
            </Button>
          )}
        </div>
        <div className="text-base font-display font-semibold tracking-tight">{data.name}</div>
        <p className="text-muted-foreground leading-relaxed">{data.description}</p>
      </div>

      {explanation && (
        <div className="p-2.5 rounded border border-primary/40 bg-primary/5 space-y-1.5">
          <div className="font-semibold text-xs text-primary flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Architecture Explanation</span>
          </div>
          <p className="text-[11px] text-foreground leading-relaxed">{explanation.purpose || explanation.responsibility}</p>
          {explanation.securityConsiderations && explanation.securityConsiderations.length > 0 && (
            <div className="pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Security:</span>
              <ul className="list-disc list-inside text-[10px] text-muted-foreground mt-0.5">
                {explanation.securityConsiderations.map((sc: string, i: number) => (
                  <li key={i}>{sc}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <MetaChip label="Complexity" value={data.complexity} tone={cxTone} />
        <MetaChip label="Latency" value={data.latency} icon={Activity} />
      </div>

      <InspectorSection title="Responsibilities">
        <ul className="space-y-1">
          {data.responsibilities.map((r) => (
            <li key={r} className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </InspectorSection>

      {data.dependencies.length > 0 && (
        <InspectorSection title="Incoming Dependencies">
          <div className="flex flex-wrap gap-1.5">
            {data.dependencies.map((d) => (
              <span key={d} className="h-6 px-2 rounded border border-border bg-surface text-[11px] font-mono flex items-center">
                {d}
              </span>
            ))}
          </div>
        </InspectorSection>
      )}

      {data.connected.length > 0 && (
        <InspectorSection title="Connected Services">
          <div className="space-y-1">
            {data.connected.map((name) => (
              <div key={name} className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Data Layer">
        <span className="font-mono text-[11px]">{data.database}</span>
      </InspectorSection>

      {data.endpoints.length > 0 && (
        <InspectorSection title={`API Endpoints (${data.endpoints.length})`}>
          <div className="rounded border border-border overflow-hidden divide-y divide-border">
            {data.endpoints.map((e) => (
              <div key={e.method + e.path} className="flex items-center gap-2 h-7 px-2 bg-background">
                <span
                  className={
                    "h-4 px-1 rounded text-[9px] font-mono uppercase " +
                    (e.method === "GET"
                      ? "bg-info/15 text-info"
                      : e.method === "POST"
                        ? "bg-success/15 text-success"
                        : e.method === "PATCH"
                          ? "bg-warning/15 text-warning"
                          : "bg-destructive/15 text-destructive")
                  }
                >
                  {e.method}
                </span>
                <span className="font-mono text-[11px] truncate">{e.path}</span>
              </div>
            ))}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Caching Strategy">
        <p className="text-[11px] text-muted-foreground">{data.cache}</p>
      </InspectorSection>

      <InspectorSection title="Security" icon={ShieldAlert}>
        <ul className="space-y-1">
          {data.security.map((s) => (
            <li key={s} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <span className="mt-1 h-1 w-1 rounded-full bg-warning shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </InspectorSection>

      <InspectorSection title="Recommendations" icon={Sparkles}>
        <div className="space-y-1.5">
          {data.suggestions.map((s) => (
            <div key={s} className="rounded border border-border bg-background p-2 text-[11px]">
              {s}
            </div>
          ))}
        </div>
      </InspectorSection>
    </div>
  );
}

function MetaChip({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: string;
  icon?: typeof Activity;
}) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={"mt-0.5 text-[13px] font-mono " + (tone ?? "")}>{value}</div>
    </div>
  );
}

function InspectorSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {title}
      </div>
      {children}
    </div>
  );
}

/* ---------- real generation console ---------- */

function GenerationConsole({
  logs,
  isGenerating,
  onClear,
}: {
  logs: ConsoleLogItem[];
  isGenerating: boolean;
  onClear: () => void;
}) {
  return (
    <div className="h-full flex flex-col bg-background">
      <PanelHeader
        label="console"
        badge={isGenerating ? "running" : logs.length > 0 ? "live" : "ready"}
        actions={
          <>
            <span className="text-[11px] font-mono text-muted-foreground pr-2">
              {logs.length} event{logs.length === 1 ? "" : "s"}
            </span>
            <IconGhost title="Clear console" onClick={onClear}>
              <XCircle className="h-3.5 w-3.5" />
            </IconGhost>
          </>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed space-y-0.5">
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center p-4">
            <div className="text-xs text-muted-foreground font-mono space-y-1">
              <p>System ready. Add requirements and click "Generate Architecture" to run the pipeline.</p>
            </div>
          </div>
        ) : (
          logs.map((l, i) => {
            const Icon = l.tone === "ok" ? CheckCircle2 : l.tone === "warn" ? TriangleAlert : XCircle;
            const cls = l.tone === "ok" ? "text-success" : l.tone === "warn" ? "text-warning" : "text-destructive";
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground w-20 shrink-0">{l.time}</span>
                <Icon className={"h-3.5 w-3.5 mt-0.5 shrink-0 " + cls} />
                <span>{l.text}</span>
              </div>
            );
          })
        )}
        <div className="flex items-center gap-2 pt-2 text-muted-foreground">
          <span className="text-primary">archforge</span>
          <span>$</span>
          {isGenerating ? (
            <span className="text-xs text-primary animate-pulse">generating architecture...</span>
          ) : (
            <span className="h-3 w-1.5 bg-primary animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- shared helpers ---------- */

function PanelHeader({
  label,
  badge,
  badgeClass,
  actions,
}: {
  label: string;
  badge?: string;
  badgeClass?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="h-9 shrink-0 border-b border-border flex items-center gap-2 px-3">
      <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {badge && (
        <span
          className={
            "h-5 px-1.5 rounded border text-[10px] font-mono flex items-center " +
            (badgeClass ?? "border-border bg-surface text-muted-foreground")
          }
        >
          {badge}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">{actions}</div>
    </div>
  );
}

function IconGhost({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
    >
      {children}
    </button>
  );
}
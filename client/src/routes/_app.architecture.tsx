import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Network,
  Boxes,
  Workflow,
  Plus,
  RefreshCw,
  Search,
  Layers,
  ArrowRight,
  ExternalLink,
  Shield,
  Clock,
  Sparkles,
  GitCompare,
  Copy,
  Trash2,
  CheckCircle2,
  Eye,
  Activity,
  FolderGit2,
  Filter,
  Server,
  Database,
  Cpu,
  Globe,
  Radio,
  FileCode2,
  MoreVertical,
  Loader2,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getArchitectureVersions,
  getArchitectureVersion,
  publishArchitectureVersion,
  duplicateArchitectureVersion,
  deleteArchitectureVersion,
  type ArchitectureVersion,
  type ArchitectureGraph,
  type ArchitectureNodeType,
} from "@/api/architecture";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture Library — ArchForge" },
      {
        name: "description",
        content:
          "Browse, inspect, and manage system architecture baselines across all workspace projects.",
      },
      { property: "og:title", content: "Architecture Library — ArchForge" },
      {
        property: "og:description",
        content: "Central architecture repository and topology baselines for your workspace.",
      },
    ],
  }),
  component: ArchitectureLibraryPage,
});

interface EnrichedArchitectureItem extends ArchitectureVersion {
  projectName: string;
}

function getNodeTypeIcon(type: ArchitectureNodeType) {
  switch (type) {
    case "database":
    case "storage":
      return <Database className="h-3.5 w-3.5 text-rose-400" />;
    case "gateway":
    case "api":
      return <Globe className="h-3.5 w-3.5 text-cyan-400" />;
    case "cache":
      return <Cpu className="h-3.5 w-3.5 text-amber-400" />;
    case "queue":
      return <Radio className="h-3.5 w-3.5 text-purple-400" />;
    case "frontend":
      return <Boxes className="h-3.5 w-3.5 text-emerald-400" />;
    default:
      return <Server className="h-3.5 w-3.5 text-blue-400" />;
  }
}

function ArchitectureLibraryPage() {
  const { currentWorkspace, projects, currentProject, selectProject } = useWorkspace();
  const navigate = useNavigate();

  const [architectures, setArchitectures] = useState<EnrichedArchitectureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"latest" | "version" | "components">("latest");

  // Preview Modal
  const [previewItem, setPreviewItem] = useState<EnrichedArchitectureItem | null>(null);
  const [previewGraph, setPreviewGraph] = useState<ArchitectureGraph | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Sync selected project filter when current project changes initially
  useEffect(() => {
    if (currentProject?.id && selectedProjectId === "all") {
      // Default to "all" so user sees everything across the workspace, but projects switcher is respected
    }
  }, [currentProject?.id]);

  // Load all architecture versions across projects in active workspace
  const loadArchitectures = useCallback(
    async (showRefreshIndicator = false) => {
      if (!projects || projects.length === 0) {
        setArchitectures([]);
        setLoading(false);
        return;
      }

      if (showRefreshIndicator) setIsRefreshing(true);
      else setLoading(true);

      try {
        const results = await Promise.all(
          projects.map(async (project) => {
            try {
              const versions = await getArchitectureVersions(project.id);
              return versions.map((v) => ({
                ...v,
                projectName: project.name,
              }));
            } catch {
              return [];
            }
          })
        );

        const flattened = results.flat();
        // Sort descending by created_at by default
        flattened.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setArchitectures(flattened);
      } catch (err: any) {
        toast.error("Failed to load architectures");
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [projects]
  );

  useEffect(() => {
    loadArchitectures();
  }, [loadArchitectures]);

  // Quick Preview Modal fetch
  const handleOpenPreview = async (item: EnrichedArchitectureItem) => {
    setPreviewItem(item);
    setPreviewLoading(true);
    setPreviewGraph(null);
    try {
      const graph = await getArchitectureVersion(item.project_id, item.id);
      setPreviewGraph(graph);
    } catch {
      toast.error("Failed to load preview details");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Open directly in interactive Canvas (/workspace)
  const handleOpenInCanvas = (item: EnrichedArchitectureItem) => {
    const targetProject = projects.find((p) => p.id === item.project_id);
    if (targetProject && targetProject.id !== currentProject?.id) {
      selectProject(targetProject);
    }
    navigate({ to: "/workspace" });
  };

  // Open in Workflow Orchestrator (/workflow)
  const handleOpenWorkflow = (item: EnrichedArchitectureItem) => {
    const targetProject = projects.find((p) => p.id === item.project_id);
    if (targetProject && targetProject.id !== currentProject?.id) {
      selectProject(targetProject);
    }
    navigate({ to: "/workflow" });
  };

  // Actions: Duplicate, Publish, Delete
  const handleDuplicate = async (item: EnrichedArchitectureItem) => {
    try {
      const duplicated = await duplicateArchitectureVersion(item.project_id, item.id, {
        name: `${item.name} (copy)`,
      });
      toast.success(`Duplicated as v${duplicated.version?.version_number}`);
      await loadArchitectures(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to duplicate architecture");
    }
  };

  const handlePublish = async (item: EnrichedArchitectureItem) => {
    try {
      await publishArchitectureVersion(item.project_id, item.id);
      toast.success(`Published v${item.version_number} as official architecture baseline`);
      await loadArchitectures(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to publish architecture");
    }
  };

  const handleDelete = async (item: EnrichedArchitectureItem) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${item.name}" (v${item.version_number})? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteArchitectureVersion(item.project_id, item.id);
      toast.success(`Architecture v${item.version_number} deleted`);
      setArchitectures((prev) => prev.filter((a) => a.id !== item.id));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete architecture");
    }
  };

  // Metrics calculation
  const totalCount = architectures.length;
  const publishedCount = architectures.filter((a) => a.status === "published").length;
  const draftCount = architectures.filter((a) => a.status === "draft").length;
  const totalComponents = architectures.reduce((sum, a) => sum + (a.node_count || 0), 0);

  // Filtered and Sorted items
  const filteredItems = useMemo(() => {
    return architectures
      .filter((item) => {
        // Project filter
        if (selectedProjectId !== "all" && item.project_id !== selectedProjectId) {
          return false;
        }
        // Status filter
        if (statusFilter !== "all" && item.status !== statusFilter) {
          return false;
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.name.toLowerCase().includes(q);
          const matchProject = item.projectName.toLowerCase().includes(q);
          const matchVersion = `v${item.version_number}`.toLowerCase().includes(q);
          const matchTech = (item.technologies || []).some((t) => t.toLowerCase().includes(q));
          const matchNodes = (item.sample_nodes || []).some((n) =>
            n.name.toLowerCase().includes(q)
          );
          if (!matchName && !matchProject && !matchVersion && !matchTech && !matchNodes) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "version") {
          return b.version_number - a.version_number;
        }
        if (sortBy === "components") {
          return (b.node_count || 0) - (a.node_count || 0);
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [architectures, selectedProjectId, statusFilter, searchQuery, sortBy]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)] bg-background">
      {/* ─── Header Banner ─── */}
      <header className="border-b border-border bg-panel px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              <span>{currentWorkspace?.name || "Workspace"}</span>
              <span>/</span>
              <span className="text-primary font-semibold">Architecture Library</span>
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground flex items-center gap-2.5">
              <Network className="h-6 w-6 text-primary" />
              Architecture Baselines & Topology
            </h1>
            <p className="text-xs text-muted-foreground max-w-2xl font-sans">
              Central catalog of all architecture models generated across this workspace. Inspect
              component topologies, open canvases, and verify engineering readiness.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadArchitectures(true)}
              disabled={isRefreshing || loading}
              className="text-xs font-mono"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing || loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs font-mono">
              <Link to="/compare">
                <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                Compare
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs font-mono">
              <Link to="/workflow">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Workflow
              </Link>
            </Button>

            <Button
              asChild
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono"
            >
              <Link to="/workspace">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Open Canvas
              </Link>
            </Button>
          </div>
        </div>

        {/* ─── Metric Cards ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-background/80 border border-border/80 rounded p-3 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" /> Total Baselines
            </div>
            <div className="text-xl font-mono font-bold text-foreground">{totalCount}</div>
            <div className="text-[11px] text-muted-foreground">across all workspace projects</div>
          </div>

          <div className="bg-background/80 border border-border/80 rounded p-3 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Published
            </div>
            <div className="text-xl font-mono font-bold text-emerald-400">{publishedCount}</div>
            <div className="text-[11px] text-muted-foreground">production baselines</div>
          </div>

          <div className="bg-background/80 border border-border/80 rounded p-3 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" /> Drafts & Iterations
            </div>
            <div className="text-xl font-mono font-bold text-amber-400">{draftCount}</div>
            <div className="text-[11px] text-muted-foreground">in active design</div>
          </div>

          <div className="bg-background/80 border border-border/80 rounded p-3 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5 text-cyan-400" /> System Components
            </div>
            <div className="text-xl font-mono font-bold text-foreground">{totalComponents}</div>
            <div className="text-[11px] text-muted-foreground">services, dbs, & gateways</div>
          </div>
        </div>
      </header>

      {/* ─── Search, Filters & Content ─── */}
      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-7xl w-full mx-auto">
        {/* Filter Bar */}
        <div className="bg-panel border border-border rounded-lg p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="relative flex-1 max-w-md">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by architecture title, version (e.g. v9), tech (Express)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs font-mono bg-background"
              />
            </div>

            {/* Project Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
                Project:
              </span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-8 rounded border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Projects ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 border border-border/70 rounded p-0.5 bg-background">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                  statusFilter === "all"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("published")}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                  statusFilter === "published"
                    ? "bg-emerald-600 text-white font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Published
              </button>
              <button
                onClick={() => setStatusFilter("draft")}
                className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors ${
                  statusFilter === "draft"
                    ? "bg-amber-600 text-white font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Drafts
              </button>
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 self-end md:self-auto">
            <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-8 rounded border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="latest">Latest Created</option>
              <option value="version">Version Number</option>
              <option value="components">Component Count</option>
            </select>
          </div>
        </div>

        {/* ─── Architecture Grid / Empty State ─── */}
        {loading ? (
          <div className="grid place-items-center py-20 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
            <div className="text-xs font-mono text-muted-foreground">
              Loading workspace architecture library...
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="border border-border/80 rounded-xl bg-panel/70 p-12 text-center max-w-lg mx-auto space-y-5 my-8">
            <div className="mx-auto grid grid-cols-3 gap-1.5 w-20">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-5 w-5 border border-border/80 ${
                    i === 4
                      ? "bg-primary/40 border-primary"
                      : i % 2
                      ? "bg-surface"
                      : "bg-background"
                  }`}
                />
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {searchQuery || selectedProjectId !== "all" || statusFilter !== "all"
                  ? "No matching architectures found"
                  : "Start your first Architecture Workspace"}
              </h3>
              <p className="text-xs text-muted-foreground font-sans">
                {searchQuery || selectedProjectId !== "all" || statusFilter !== "all"
                  ? "Try resetting your search query or filters to view other architecture baselines in this workspace."
                  : "Generated architectures for every workspace project will appear here. Open the canvas to design and save a baseline."}
              </p>
            </div>

            <div className="flex justify-center gap-2.5 pt-2">
              {searchQuery || selectedProjectId !== "all" || statusFilter !== "all" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedProjectId("all");
                    setStatusFilter("all");
                  }}
                  className="text-xs font-mono"
                >
                  Clear Filters
                </Button>
              ) : (
                <>
                  <Button asChild size="sm" className="text-xs font-mono">
                    <Link to="/workspace">
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Open Workspace Canvas
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="text-xs font-mono">
                    <Link to="/repository">
                      <FolderGit2 className="h-3.5 w-3.5 mr-1.5" /> Import Repository
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const nodeCount = item.node_count ?? 0;
              const edgeCount = item.edge_count ?? 0;
              const isPublished = item.status === "published";
              const isCurrentProj = item.project_id === currentProject?.id;

              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-5 flex flex-col justify-between transition-all duration-150 bg-panel hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 ${
                    isCurrentProj ? "border-primary/30" : "border-border"
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Project & Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-mono text-foreground bg-background truncate max-w-[140px]"
                        >
                          {item.projectName}
                        </Badge>
                        <Badge
                          className={`text-[10px] font-mono font-bold ${
                            isPublished
                              ? "bg-emerald-500 text-white"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          v{item.version_number}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            isPublished ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {item.status}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs font-mono">
                            <DropdownMenuItem onClick={() => handleOpenPreview(item)}>
                              <Eye className="h-3.5 w-3.5 mr-2" /> Quick Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate Version
                            </DropdownMenuItem>
                            {!isPublished && (
                              <DropdownMenuItem onClick={() => handlePublish(item)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-400" />
                                Publish as Baseline
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(item)}
                              className="text-red-400 focus:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Version
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3
                        onClick={() => handleOpenInCanvas(item)}
                        className="font-semibold text-foreground text-sm leading-snug hover:text-primary cursor-pointer line-clamp-2"
                      >
                        {item.name}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground font-sans line-clamp-2 mt-1">
                          {item.description}
                        </p>
                      )}
                    </div>

                    {/* Topology Stats */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-background/60 rounded border border-border/50 text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Boxes className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>
                          <strong className="text-foreground">{nodeCount}</strong> components
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Network className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                        <span>
                          <strong className="text-foreground">{edgeCount}</strong> connections
                        </span>
                      </div>
                    </div>

                    {/* Sample Components / Technologies */}
                    {item.technologies && item.technologies.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          Stack Detected:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.technologies.slice(0, 4).map((tech, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono text-muted-foreground"
                            >
                              {tech}
                            </span>
                          ))}
                          {item.technologies.length > 4 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground">
                              +{item.technologies.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Actions */}
                  <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenPreview(item)}
                        className="text-[11px] font-mono h-7 px-2"
                      >
                        <Eye className="h-3 w-3 mr-1" /> Preview
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => handleOpenInCanvas(item)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 text-[11px] font-mono h-7 px-2.5"
                      >
                        Canvas <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Quick Preview Dialog ─── */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-2xl bg-panel border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Network className="h-5 w-5 text-primary" />
              {previewItem?.name} (v{previewItem?.version_number})
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              Project: {previewItem?.projectName} • Status: {previewItem?.status} • Created:{" "}
              {previewItem?.created_at && new Date(previewItem.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
              <div className="text-xs font-mono text-muted-foreground">
                Loading architecture topology...
              </div>
            </div>
          ) : previewGraph ? (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Components List */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-semibold uppercase text-muted-foreground">
                  Components ({previewGraph.nodes.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {previewGraph.nodes.map((node) => (
                    <div
                      key={node.id}
                      className="border border-border/80 bg-background/80 rounded p-2.5 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          {getNodeTypeIcon(node.type)}
                          {node.name}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase bg-muted/30 px-1 rounded">
                          {node.type}
                        </span>
                      </div>
                      {node.technology && (
                        <div className="text-[11px] font-mono text-primary/80">
                          {node.technology}
                        </div>
                      )}
                      {node.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {node.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Connections List */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="text-xs font-mono font-semibold uppercase text-muted-foreground">
                  Connections & Data Flows ({previewGraph.edges.length})
                </div>
                <div className="space-y-1.5 text-xs font-mono">
                  {previewGraph.edges.map((edge) => {
                    const src = previewGraph.nodes.find((n) => n.id === edge.source_node_id);
                    const tgt = previewGraph.nodes.find((n) => n.id === edge.target_node_id);
                    return (
                      <div
                        key={edge.id}
                        className="bg-background/60 border border-border/50 rounded p-2 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-foreground">
                            {src?.name || "Source"}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-semibold text-foreground">
                            {tgt?.name || "Target"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
                          {edge.protocol && (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px]">
                              {edge.protocol}
                            </span>
                          )}
                          <span className="text-[10px] uppercase">{edge.relationship}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA to open interactive canvas */}
              <div className="pt-3 border-t border-border/60 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewItem(null)}
                  className="text-xs font-mono"
                >
                  Close
                </Button>
                {previewItem && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setPreviewItem(null);
                      handleOpenInCanvas(previewItem);
                    }}
                    className="text-xs font-mono bg-primary text-primary-foreground"
                  >
                    Open in Interactive Canvas <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground font-mono">
              No topology details found for this version.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
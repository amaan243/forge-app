import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  ExternalLink,
  FileCode,
  FileText,
  Filter,
  FlaskConical,
  GitBranch,
  Globe,
  History,
  Layers,
  Loader2,
  Maximize2,
  Network,
  Package,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Table as TableIcon,
  Workflow,
  X,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getKnowledgeGraphContext,
  getKnowledgeGraph,
  getKnowledgeGraphNeighborhood,
  getKnowledgeGraphTraceability,
  analyzeGraphNodeImpact,
  type KnowledgeGraphContext,
  type KnowledgeGraphEntityNode,
  type KnowledgeGraphRelationship,
  type KnowledgeGraphEntityType,
  type KnowledgeGraphRelationType,
  type KnowledgeGraphScope,
  type TraceabilityReport,
  type KnowledgeGraphNeighborhood,
} from "@/api/knowledge-graph";

export const Route = createFileRoute("/_app/knowledge-graph")({
  head: () => ({
    meta: [
      { title: "Knowledge Graph & Traceability — ArchForge" },
      {
        name: "description",
        content:
          "Unified Engineering Knowledge Graph connecting requirements, architecture, code, APIs, data models, tests, documentation, and engineering risks.",
      },
    ],
  }),
  component: KnowledgeGraphPage,
});

const ENTITY_CONFIG: Record<
  KnowledgeGraphEntityType,
  { label: string; color: string; bg: string; border: string; icon: typeof Network }
> = {
  requirement: {
    label: "Requirement",
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.12)",
    border: "#a855f7",
    icon: FileText,
  },
  architecture_component: {
    label: "Component",
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.12)",
    border: "#06b6d4",
    icon: Workflow,
  },
  architecture_connection: {
    label: "Connection",
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "#3b82f6",
    icon: Network,
  },
  repository_module: {
    label: "Module",
    color: "#60a5fa",
    bg: "rgba(96, 165, 250, 0.12)",
    border: "#60a5fa",
    icon: FileCode,
  },
  api_route: {
    label: "API Route",
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "#10b981",
    icon: Globe,
  },
  database_model: {
    label: "Database Model",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "#f59e0b",
    icon: Database,
  },
  dependency: {
    label: "Dependency",
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "#94a3b8",
    icon: Package,
  },
  test: {
    label: "Test",
    color: "#14b8a6",
    bg: "rgba(20, 184, 166, 0.12)",
    border: "#14b8a6",
    icon: FlaskConical,
  },
  documentation: {
    label: "Documentation",
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.12)",
    border: "#ec4899",
    icon: BookOpen,
  },
  drift_finding: {
    label: "Drift Finding",
    color: "#f43f5e",
    bg: "rgba(244, 63, 94, 0.12)",
    border: "#f43f5e",
    icon: Radar,
  },
  impact_finding: {
    label: "Impact Finding",
    color: "#fb923c",
    bg: "rgba(251, 146, 60, 0.12)",
    border: "#fb923c",
    icon: ShieldAlert,
  },
  architecture_version: {
    label: "Arch Version",
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
    border: "#8b5cf6",
    icon: History,
  },
};

function KnowledgeGraphPage() {
  const { currentWorkspace, currentProject } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filters & State
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>("");
  const [graphScope, setGraphScope] = useState<KnowledgeGraphScope>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTypes, setSelectedTypes] = useState<KnowledgeGraphEntityType[]>([]);
  const [viewMode, setViewMode] = useState<"graph" | "traceability" | "table">("graph");

  // Selection & Inspector
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [neighborhoodDepth, setNeighborhoodDepth] = useState<number>(1);
  const [traceabilityRootId, setTraceabilityRootId] = useState<string | null>(null);

  // SVG Pan & Zoom Canvas State
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Clear selections when switching projects for isolation
  useEffect(() => {
    setSelectedVersionId("");
    setSelectedRepoId("");
    setSelectedAnalysisId("");
    setGraphScope("all");
    setSelectedEntityId(null);
    setTraceabilityRootId(null);
  }, [currentProject?.id]);

  // Context Query
  const {
    data: context,
    isLoading: contextLoading,
    refetch: refetchContext,
  } = useQuery<KnowledgeGraphContext>({
    queryKey: ["knowledge-graph-context", currentProject?.id],
    queryFn: () => getKnowledgeGraphContext(currentProject!.id),
    enabled: Boolean(currentProject?.id),
  });

  // Repositories & Snapshots
  const availableRepos = useMemo(() => context?.repositories || [], [context?.repositories]);
  const currentRepo = useMemo(() => {
    if (!selectedRepoId) return availableRepos[0] || null;
    return availableRepos.find((r) => r.id === selectedRepoId) || null;
  }, [availableRepos, selectedRepoId]);

  const availableAnalyses = useMemo(() => currentRepo?.analyses || [], [currentRepo]);

  // Knowledge Graph Data Query
  const {
    data: graphData,
    isLoading: graphLoading,
    isFetching: graphFetching,
    error: graphError,
    refetch: refetchGraph,
  } = useQuery({
    queryKey: [
      "knowledge-graph-data",
      currentProject?.id,
      selectedVersionId,
      selectedRepoId,
      selectedAnalysisId,
      graphScope,
      selectedTypes,
      searchQuery,
    ],
    queryFn: () =>
      getKnowledgeGraph(currentProject!.id, {
        architectureVersionId: selectedVersionId || undefined,
        repositoryId: selectedRepoId || undefined,
        repositoryAnalysisId: selectedAnalysisId || undefined,
        scope: graphScope,
        entityTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
        search: searchQuery || undefined,
        limit: 200,
      }),
    enabled: Boolean(currentProject?.id),
    retry: 1,
  });

  // Selected Entity Record
  const selectedEntity = useMemo(() => {
    if (!selectedEntityId || !graphData) return null;
    return graphData.snapshot.entities.find((e) => e.id === selectedEntityId) || null;
  }, [selectedEntityId, graphData]);

  // Connected Relationships for Selected Entity
  const selectedEntityRelationships = useMemo(() => {
    if (!selectedEntityId || !graphData) return [];
    return graphData.snapshot.relationships.filter(
      (r) => r.sourceId === selectedEntityId || r.targetId === selectedEntityId
    );
  }, [selectedEntityId, graphData]);

  // Traceability Query
  const effectiveTraceabilityRoot = useMemo(() => {
    if (traceabilityRootId) return traceabilityRootId;
    if (selectedEntityId) return selectedEntityId;
    if (graphData && graphData.filteredEntities.length > 0) {
      const req = graphData.filteredEntities.find((e) => e.type === "requirement");
      if (req) return req.id;
      const comp = graphData.filteredEntities.find((e) => e.type === "architecture_component");
      if (comp) return comp.id;
      return graphData.filteredEntities[0].id;
    }
    return null;
  }, [traceabilityRootId, selectedEntityId, graphData]);

  const { data: traceabilityData, isLoading: traceabilityLoading } = useQuery<TraceabilityReport>({
    queryKey: ["knowledge-graph-traceability", currentProject?.id, effectiveTraceabilityRoot],
    queryFn: () => getKnowledgeGraphTraceability(currentProject!.id, effectiveTraceabilityRoot!),
    enabled: Boolean(currentProject?.id && effectiveTraceabilityRoot && viewMode === "traceability"),
  });

  // Impact Analysis Mutation
  const impactMutation = useMutation({
    mutationFn: async (entityId: string) => {
      return analyzeGraphNodeImpact(currentProject!.id, entityId, "modified");
    },
    onSuccess: (res) => {
      toast.success("Impact analysis generated", {
        description: `Target: ${res.entity.name}. Direct dependents: ${res.impactSummary.directlyAffected ? (res.impactSummary.directlyAffected as any[]).length : 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ["knowledge-graph-data", currentProject?.id] });
    },
    onError: (err: any) => {
      toast.error("Failed to run impact analysis", {
        description: err?.response?.data?.message || err?.message || "Unknown error",
      });
    },
  });

  // Column Headers by Scope
  const columnHeaders = useMemo(() => {
    if (graphScope === "architecture") {
      return [
        { col: 0, label: "ARCH BASELINE" },
        { col: 1, label: "REQUIREMENTS" },
        { col: 2, label: "COMPONENTS" },
        { col: 3, label: "DRIFT & IMPACT" },
      ];
    } else if (graphScope === "repository") {
      return [
        { col: 0, label: "MODULES & FILES" },
        { col: 1, label: "API ENDPOINTS" },
        { col: 2, label: "DATABASE MODELS" },
        { col: 3, label: "PACKAGES & TESTS" },
      ];
    } else {
      return [
        { col: 0, label: "BASELINE" },
        { col: 1, label: "REQUIREMENTS" },
        { col: 2, label: "COMPONENTS" },
        { col: 3, label: "CODE MODULES" },
        { col: 4, label: "APIS & DATA" },
        { col: 5, label: "DEPENDENCIES" },
      ];
    }
  }, [graphScope]);

  // Canvas Layout Coordinates Computation (Layered Hierarchy tailored to Scope)
  const renderedNodes = useMemo(() => {
    if (!graphData) return [];
    const entities = graphData.filteredEntities;

    // Define columns by entity type depending on graph scope
    let columns: Record<KnowledgeGraphEntityType, number>;
    let totalCols = 6;

    if (graphScope === "architecture") {
      columns = {
        architecture_version: 0,
        requirement: 1,
        architecture_component: 2,
        architecture_connection: 2,
        drift_finding: 3,
        impact_finding: 3,
        documentation: 3,
        repository_module: 3,
        api_route: 3,
        database_model: 3,
        dependency: 3,
        test: 3,
      };
      totalCols = 4;
    } else if (graphScope === "repository") {
      columns = {
        repository_module: 0,
        api_route: 1,
        database_model: 2,
        dependency: 3,
        test: 3,
        architecture_version: 0,
        requirement: 0,
        architecture_component: 0,
        architecture_connection: 0,
        documentation: 0,
        drift_finding: 0,
        impact_finding: 0,
      };
      totalCols = 4;
    } else {
      columns = {
        architecture_version: 0,
        requirement: 1,
        architecture_component: 2,
        architecture_connection: 2,
        drift_finding: 2,
        repository_module: 3,
        documentation: 3,
        impact_finding: 3,
        api_route: 4,
        database_model: 4,
        dependency: 5,
        test: 5,
      };
      totalCols = 6;
    }

    const colGroups: Record<number, KnowledgeGraphEntityNode[]> = {};
    for (let i = 0; i < totalCols; i++) colGroups[i] = [];

    entities.forEach((entity) => {
      const colIdx = columns[entity.type] ?? 0;
      if (colGroups[colIdx]) {
        colGroups[colIdx].push(entity);
      }
    });

    const colWidth = 270;
    const rowHeight = 88;
    const paddingX = 60;
    const paddingY = 74; // clearance for column headers

    const positioned: Array<{
      node: KnowledgeGraphEntityNode;
      x: number;
      y: number;
    }> = [];

    Object.entries(colGroups).forEach(([colStr, nodes]) => {
      const c = Number(colStr);
      nodes.forEach((node, rowIdx) => {
        positioned.push({
          node,
          x: paddingX + c * colWidth,
          y: paddingY + rowIdx * rowHeight,
        });
      });
    });

    return positioned;
  }, [graphData, graphScope]);

  const nodePosMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    renderedNodes.forEach((rn) => {
      map.set(rn.node.id, { x: rn.x, y: rn.y });
    });
    return map;
  }, [renderedNodes]);

  const renderedEdges = useMemo(() => {
    if (!graphData) return [];
    return graphData.filteredRelationships.map((rel) => {
      const p1 = nodePosMap.get(rel.sourceId);
      const p2 = nodePosMap.get(rel.targetId);
      return {
        rel,
        p1,
        p2,
      };
    }).filter((edge) => Boolean(edge.p1 && edge.p2));
  }, [graphData, nodePosMap]);

  // Non-passive wheel zoom listener for smooth mouse wheel zooming centered on cursor
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Wheel up = zoom in (factor > 1), Wheel down = zoom out (factor < 1)
      const factor = e.deltaY < 0 ? 1.15 : 0.87;

      setZoomLevel((prevZoom) => {
        const newZoom = Math.max(0.15, Math.min(3.5, Number((prevZoom * factor).toFixed(3))));
        const scaleRatio = newZoom / prevZoom;

        setPanOffset((prevPan) => ({
          x: mouseX - (mouseX - prevPan.x) * scaleRatio,
          y: mouseY - (mouseY - prevPan.y) * scaleRatio,
        }));

        return newZoom;
      });
    };

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Global window listeners for drag panning
  useEffect(() => {
    if (!isDragging) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleWindowMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging, dragStart]);

  // Pan and drag initiation
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("select") || target.closest("input")) return;

    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(0.2, Math.min(3.5, Number((prev + delta).toFixed(2)))));
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 40, y: 40 });
  };

  const toggleEntityType = (type: KnowledgeGraphEntityType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const visibleEntityTypes = useMemo(() => {
    const allTypes = Object.keys(ENTITY_CONFIG) as KnowledgeGraphEntityType[];
    const archTypes = new Set<KnowledgeGraphEntityType>([
      "architecture_version",
      "requirement",
      "architecture_component",
      "architecture_connection",
      "drift_finding",
      "impact_finding",
      "documentation",
    ]);
    const repoTypes = new Set<KnowledgeGraphEntityType>([
      "repository_module",
      "api_route",
      "database_model",
      "dependency",
      "test",
    ]);

    if (graphScope === "architecture") {
      return allTypes.filter((t) => archTypes.has(t));
    }
    if (graphScope === "repository") {
      return allTypes.filter((t) => repoTypes.has(t));
    }
    return allTypes;
  }, [graphScope]);

  if (!currentProject) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center p-6 bg-background">
        <EmptyState
          glyph="graph"
          title="No Project Selected"
          body="Select an engineering project from the workstation switcher to inspect its Knowledge Graph and traceability."
          actions={<ProjectSwitcher />}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)] bg-background">
      {/* ─── Top Control Header (ArchForge UI Theme) ─── */}
      <header className="border-b border-border bg-panel px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              <span>{currentWorkspace?.name || "Workspace"}</span>
              <span>/</span>
              <span className="text-foreground font-semibold">{currentProject.name}</span>
              <span>/</span>
              <span className="text-primary">Knowledge Graph</span>
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-tight text-foreground flex items-center gap-2.5">
              <Share2 className="h-6 w-6 text-primary" />
              Engineering Knowledge Graph & Traceability
              <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary bg-primary/10">
                Traceability Engine
              </Badge>
              {graphFetching && (
                <span className="flex items-center gap-1 text-xs text-primary animate-pulse ml-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Synchronizing...
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground max-w-3xl">
              Unified evidence-backed view connecting requirements, architecture, code modules, APIs, data models, tests, documentation, drift findings, and change impacts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchContext();
                refetchGraph();
                toast.info("Knowledge Graph refreshed");
              }}
              disabled={contextLoading || graphLoading}
              className="text-xs font-mono"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${contextLoading || graphLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs font-mono">
              <Link to="/workspace">
                <Workflow className="h-3.5 w-3.5 mr-1.5" />
                Canvas
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs font-mono">
              <Link to="/workflow">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Workflow
              </Link>
            </Button>

            <Button asChild variant="outline" size="sm" className="text-xs font-mono">
              <Link to="/drift">
                <Radar className="h-3.5 w-3.5 mr-1.5" />
                Drift
              </Link>
            </Button>

            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono">
              <Link to="/impact">
                <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                Impact
              </Link>
            </Button>
          </div>
        </div>

        {/* Hierarchy Context Selector Bar */}
        <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Architecture Version Selector */}
            <div className="flex items-center bg-card border border-border rounded-md px-2.5 py-1 text-xs gap-1.5 shadow-sm">
              <History className="w-3.5 h-3.5 text-purple-400" />
              <select
                className="bg-transparent text-foreground focus:outline-none cursor-pointer text-xs"
                value={selectedVersionId}
                onChange={(e) => setSelectedVersionId(e.target.value)}
                aria-label="Architecture Baseline"
              >
                <option value="" className="bg-panel text-foreground">Latest Published Baseline</option>
                {context?.architectureVersions?.map((v) => (
                  <option key={v.id} value={v.id} className="bg-panel text-foreground">
                    v{v.versionNumber}: {v.name} ({v.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Repository Selector */}
            <div className="flex items-center bg-card border border-border rounded-md px-2.5 py-1 text-xs gap-1.5 shadow-sm">
              <GitBranch className="w-3.5 h-3.5 text-blue-400" />
              <select
                className="bg-transparent text-foreground focus:outline-none cursor-pointer text-xs"
                value={selectedRepoId}
                onChange={(e) => {
                  setSelectedRepoId(e.target.value);
                  setSelectedAnalysisId("");
                }}
                aria-label="Repository"
              >
                {availableRepos.length === 0 ? (
                  <option value="" className="bg-panel text-foreground">No Repositories</option>
                ) : (
                  availableRepos.map((r) => (
                    <option key={r.id} value={r.id} className="bg-panel text-foreground">
                      {r.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Analysis Snapshot Selector */}
            {availableAnalyses.length > 0 && (
              <div className="flex items-center bg-card border border-border rounded-md px-2.5 py-1 text-xs gap-1.5 shadow-sm">
                <Workflow className="w-3.5 h-3.5 text-emerald-400" />
                <select
                  className="bg-transparent text-foreground focus:outline-none cursor-pointer text-xs"
                  value={selectedAnalysisId}
                  onChange={(e) => setSelectedAnalysisId(e.target.value)}
                  aria-label="Analysis Snapshot"
                >
                  <option value="" className="bg-panel text-foreground">Latest Analyzed Snapshot</option>
                  {availableAnalyses.map((a) => (
                    <option key={a.id} value={a.id} className="bg-panel text-foreground">
                      {a.branch} ({a.commitSha?.slice(0, 7) || "HEAD"})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* 3-Way Graph Dependency Scope Switcher */}
            <div className="flex items-center bg-card border border-border p-1 rounded-lg gap-1 shadow-sm">
              <Button
                variant={graphScope === "all" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setGraphScope("all");
                  setSelectedTypes([]);
                  setPanOffset({ x: 40, y: 40 });
                }}
                className={`h-7 px-2.5 text-xs font-mono transition-all ${
                  graphScope === "all"
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Both Combined: Full end-to-end architecture & repository dependencies"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                Both Combined
              </Button>

              <Button
                variant={graphScope === "architecture" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setGraphScope("architecture");
                  setSelectedTypes([]);
                  setPanOffset({ x: 40, y: 40 });
                }}
                className={`h-7 px-2.5 text-xs font-mono transition-all ${
                  graphScope === "architecture"
                    ? "bg-purple-600 text-white font-semibold shadow-sm hover:bg-purple-700"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Architecture Only: Requirements, components, baseline & architecture dependencies"
              >
                <Workflow className="w-3.5 h-3.5 mr-1.5 text-purple-200" />
                Architecture Only
              </Button>

              <Button
                variant={graphScope === "repository" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setGraphScope("repository");
                  setSelectedTypes([]);
                  setPanOffset({ x: 40, y: 40 });
                }}
                className={`h-7 px-2.5 text-xs font-mono transition-all ${
                  graphScope === "repository"
                    ? "bg-blue-600 text-white font-semibold shadow-sm hover:bg-blue-700"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Repository Only: Code modules, API routes, data models & package dependencies"
              >
                <GitBranch className="w-3.5 h-3.5 mr-1.5 text-blue-200" />
                Repository Only
              </Button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border gap-1">
              <Button
                variant={viewMode === "graph" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("graph")}
                className={`h-7 px-3 text-xs font-mono ${viewMode === "graph" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Share2 className="w-3.5 h-3.5 mr-1 text-primary" /> Interactive Graph
              </Button>
              <Button
                variant={viewMode === "traceability" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("traceability")}
                className={`h-7 px-3 text-xs font-mono ${viewMode === "traceability" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Workflow className="w-3.5 h-3.5 mr-1 text-purple-400" /> Traceability Explorer
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className={`h-7 px-3 text-xs font-mono ${viewMode === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <TableIcon className="w-3.5 h-3.5 mr-1 text-blue-400" /> Entity Table
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Metrics Ribbon ─── */}
      {graphData && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-3 border-b border-border bg-card/40">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Total Entities</span>
            <div className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
              {graphData.totalEntities}
              <span className="text-[11px] font-sans font-normal text-muted-foreground">
                ({Object.keys(graphData.snapshot.summary.entityTypeCounts).length} types)
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Relationships</span>
            <div className="text-xl font-display font-semibold text-foreground flex items-center gap-2">
              {graphData.totalRelationships}
              <span className="text-[11px] font-sans font-normal text-emerald-400">
                {graphData.snapshot.summary.verifiedRelationsCount} verified
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Traceability Coverage</span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-display font-semibold text-primary">
                {graphData.snapshot.coverage.overallCoveragePercentage}%
              </span>
              <div className="w-20 bg-muted/60 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{ width: `${graphData.snapshot.coverage.overallCoveragePercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Identified Gaps & Risks</span>
            <div className="text-xl font-display font-semibold text-amber-400 flex items-center gap-2">
              {graphData.snapshot.coverage.gaps.requirementsWithoutArchitecture.length +
                graphData.snapshot.coverage.gaps.componentsWithoutRepository.length +
                graphData.snapshot.coverage.gaps.routesWithoutTests.length}
              <span className="text-[11px] font-sans font-normal text-muted-foreground">
                traceability gaps
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ─── Search & Type Filter Bar ─── */}
      <section className="px-6 py-2.5 border-b border-border bg-panel flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search entities by name or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 pr-7 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Entity Type Filter Badges */}
        <div className="flex items-center flex-wrap gap-1.5">
          {visibleEntityTypes.map((type) => {
            const cfg = ENTITY_CONFIG[type];
            const isSelected = selectedTypes.includes(type);
            const count = graphData?.snapshot.summary.entityTypeCounts[type] || 0;
            if (count === 0 && !isSelected) return null;

            return (
              <button
                key={type}
                onClick={() => toggleEntityType(type)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 border ${
                  isSelected
                    ? "border-primary text-primary bg-primary/10 shadow-sm font-semibold"
                    : "border-border text-muted-foreground bg-card hover:border-border/80 hover:text-foreground"
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                {cfg.label}
                <span className="text-[10px] opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Error State (Graceful fallback) ─── */}
      {graphError && (
        <div className="p-8">
          <div className="max-w-xl mx-auto p-6 rounded-xl border border-destructive/40 bg-destructive/10 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
            <h3 className="text-base font-semibold text-foreground">Failed to Load Knowledge Graph</h3>
            <p className="text-xs text-muted-foreground font-mono">
              {(graphError as any)?.response?.data?.message || (graphError as any)?.message || "Internal server error"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchGraph()}
              className="text-xs font-mono border-destructive/40 hover:bg-destructive/20"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        </div>
      )}

      {/* ─── Main Graph Body & Views ─── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* VIEW 1: INTERACTIVE GRAPH CANVAS */}
        {viewMode === "graph" && !graphError && (
          <div
            ref={containerRef}
            className="flex-1 relative overflow-hidden bg-background select-none cursor-grab active:cursor-grabbing h-[calc(100vh-14rem)]"
            onMouseDown={handleMouseDown}
            onDoubleClick={handleResetView}
          >
            {/* Canvas Floating Controls */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-panel/95 border border-border rounded-lg p-1.5 backdrop-blur-md shadow-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleZoom(0.2)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Zoom In (+20%)"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleZoom(-0.2)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Zoom Out (-20%)"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetView}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Reset View (100% Center)"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
              <div className="h-4 w-px bg-border mx-1" />
              <span className="text-[11px] text-muted-foreground font-mono px-1 font-medium">
                {Math.round(zoomLevel * 100)}%
              </span>
              <div className="h-4 w-px bg-border mx-1" />
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase opacity-75">Scope:</span>
                <select
                  value={graphScope}
                  onChange={(e) => {
                    setGraphScope(e.target.value as KnowledgeGraphScope);
                    setSelectedTypes([]);
                    setPanOffset({ x: 40, y: 40 });
                  }}
                  className="bg-card border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-foreground focus:outline-none cursor-pointer"
                  aria-label="Filter Graph Scope"
                >
                  <option value="all">Both Combined</option>
                  <option value="architecture">Architecture Only</option>
                  <option value="repository">Repository Only</option>
                </select>
              </div>
            </div>

            {/* Canvas Helper Pill */}
            <div className="absolute bottom-4 right-4 z-20 hidden md:flex items-center gap-2 bg-panel/85 border border-border rounded-md px-2.5 py-1 text-[11px] font-mono text-muted-foreground backdrop-blur-sm pointer-events-none shadow-sm">
              <span>Mouse wheel to zoom</span>
              <span>•</span>
              <span>Click & drag to pan</span>
              <span>•</span>
              <span>Double click to center</span>
            </div>

            {/* SVG Canvas */}
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{
                background: "radial-gradient(circle at center, rgba(39, 39, 42, 0.25) 0%, rgba(9, 9, 11, 0.95) 100%)",
              }}
            >
              <defs>
                <style>{`
                  @keyframes edgeDashFlow {
                    from {
                      stroke-dashoffset: 24;
                    }
                    to {
                      stroke-dashoffset: 0;
                    }
                  }
                  @keyframes edgeDashFlowFast {
                    from {
                      stroke-dashoffset: 24;
                    }
                    to {
                      stroke-dashoffset: 0;
                    }
                  }
                  .edge-flow-anim {
                    animation: edgeDashFlow 1.6s linear infinite;
                  }
                  .edge-flow-anim-fast {
                    animation: edgeDashFlowFast 0.8s linear infinite;
                  }
                `}</style>

                <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="20" cy="20" r="0.75" fill="currentColor" className="text-border" />
                </pattern>
                <marker
                  id="arrow-verified"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#06b6d4" />
                </marker>
                <marker
                  id="arrow-inferred"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f59e0b" />
                </marker>
                <marker
                  id="arrow-selected"
                  viewBox="0 0 10 10"
                  refX="10"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
                </marker>
              </defs>

              <rect width="100%" height="100%" fill="url(#grid-pattern)" />

              {/* Transformable Canvas Group */}
              <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                {/* Column Headers by Layer */}
                {columnHeaders.map((hdr) => (
                  <g key={hdr.col} transform={`translate(${60 + hdr.col * 270}, 24)`}>
                    <rect
                      width="240"
                      height="26"
                      rx="4"
                      fill="rgba(24, 24, 27, 0.75)"
                      stroke="rgba(63, 63, 70, 0.5)"
                    />
                    <text
                      x="120"
                      y="17"
                      fill="#a1a1aa"
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="monospace"
                      textAnchor="middle"
                      letterSpacing="1"
                    >
                      {hdr.label}
                    </text>
                  </g>
                ))}
                {/* Edges */}
                {renderedEdges.map(({ rel, p1, p2 }) => {
                  if (!p1 || !p2) return null;
                  const isVerified = rel.confidence === "verified";
                  const strokeColor = isVerified ? "#06b6d4" : "#f59e0b";
                  const isSelectedEdge =
                    selectedEntityId === rel.sourceId || selectedEntityId === rel.targetId;

                  // Connect output port (right of p1, width 220, y center 22) to input port (left of p2)
                  const startX = p1.x + 220;
                  const startY = p1.y + 22;
                  const endX = p2.x;
                  const endY = p2.y + 22;

                  let curvePath: string;
                  if (endX > startX) {
                    const spanX = endX - startX;
                    const cpOffset = Math.max(35, spanX * 0.45);
                    curvePath = `M ${startX} ${startY} C ${startX + cpOffset} ${startY}, ${endX - cpOffset} ${endY}, ${endX} ${endY}`;
                  } else {
                    // Loopback or backwards curve
                    curvePath = `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`;
                  }

                  const midX = (startX + endX) / 2;
                  const midY = (startY + endY) / 2;

                  return (
                    <g key={rel.id} className="transition-opacity">
                      {/* Underlying base path */}
                      <path
                        d={curvePath}
                        fill="none"
                        stroke={isSelectedEdge ? "#38bdf8" : strokeColor}
                        strokeWidth={isSelectedEdge ? 3 : 1.5}
                        opacity={isSelectedEdge ? 0.35 : 0.2}
                        strokeLinecap="round"
                      />

                      {/* Animated flowing dashed path */}
                      <path
                        d={curvePath}
                        fill="none"
                        stroke={isSelectedEdge ? "#38bdf8" : strokeColor}
                        strokeWidth={isSelectedEdge ? 2.5 : 1.6}
                        strokeDasharray={isVerified ? "6,6" : "3,5"}
                        className={isSelectedEdge ? "edge-flow-anim-fast" : "edge-flow-anim"}
                        opacity={isSelectedEdge ? 1 : 0.75}
                        markerEnd={isSelectedEdge ? "url(#arrow-selected)" : isVerified ? "url(#arrow-verified)" : "url(#arrow-inferred)"}
                        style={{
                          filter: isSelectedEdge ? "url(#edge-glow)" : undefined,
                        }}
                      />

                      {/* Animated flying packet pulse */}
                      <circle
                        r={isSelectedEdge ? 3.5 : 2.5}
                        fill={isSelectedEdge ? "#7dd3fc" : isVerified ? "#67e8f9" : "#fde047"}
                        opacity={isSelectedEdge ? 1 : 0.75}
                      >
                        <animateMotion
                          path={curvePath}
                          dur={isSelectedEdge ? "1.4s" : "2.6s"}
                          repeatCount="indefinite"
                        />
                      </circle>

                      {/* Edge Label Pill */}
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x="-34"
                          y="-8"
                          width="68"
                          height="16"
                          rx="4"
                          fill="#18181b"
                          stroke={isSelectedEdge ? "#38bdf8" : strokeColor}
                          strokeWidth={isSelectedEdge ? 1 : 0.5}
                          opacity="0.92"
                        />
                        <text
                          x="0"
                          y="3.5"
                          fill={isSelectedEdge ? "#7dd3fc" : "#a1a1aa"}
                          className="select-none font-mono font-medium"
                          fontSize="8.5"
                          textAnchor="middle"
                        >
                          {rel.type}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* Nodes */}
                {renderedNodes.map(({ node, x, y }) => {
                  const cfg = ENTITY_CONFIG[node.type] || ENTITY_CONFIG.architecture_component;
                  const isSelected = selectedEntityId === node.id;
                  const isFresh = node.freshness === "fresh";

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${x}, ${y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEntityId(node.id);
                      }}
                      className="cursor-pointer group"
                    >
                      {/* Node Box */}
                      <rect
                        width="220"
                        height="44"
                        rx="8"
                        fill="#121215"
                        stroke={isSelected ? cfg.color : "#27272a"}
                        strokeWidth={isSelected ? 2 : 1}
                        className="transition-all duration-150 group-hover:stroke-primary/70"
                        style={{
                          filter: isSelected ? `drop-shadow(0 0 12px ${cfg.color}50)` : "none",
                        }}
                      />

                      {/* Type Icon Pill */}
                      <rect
                        x="6"
                        y="6"
                        width="32"
                        height="32"
                        rx="6"
                        fill={cfg.bg}
                        stroke={cfg.border}
                        strokeWidth="0.5"
                      />

                      {/* Freshness Dot */}
                      <circle
                        cx="36"
                        cy="10"
                        r="3.5"
                        fill={isFresh ? "#10b981" : "#f59e0b"}
                        stroke="#121215"
                        strokeWidth="1.5"
                      />

                      {/* Node Title */}
                      <text
                        x="46"
                        y="22"
                        fill="#f4f4f5"
                        fontSize="12"
                        fontWeight="600"
                        className="select-none font-medium truncate"
                      >
                        {node.name.length > 21 ? `${node.name.slice(0, 20)}…` : node.name}
                      </text>

                      {/* Subtitle / Type */}
                      <text
                        x="46"
                        y="34"
                        fill={cfg.color}
                        fontSize="9"
                        fontWeight="500"
                        className="select-none font-mono tracking-wider uppercase opacity-90"
                      >
                        {cfg.label}
                      </text>

                      {/* Evidence Status Pill */}
                      <rect
                        x="160"
                        y="12"
                        width="52"
                        height="18"
                        rx="4"
                        fill={node.evidenceStatus === "verified" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)"}
                      />
                      <text
                        x="186"
                        y="24"
                        fill={node.evidenceStatus === "verified" ? "#34d399" : "#fbbf24"}
                        fontSize="9"
                        textAnchor="middle"
                        fontWeight="500"
                        className="select-none font-mono"
                      >
                        {node.evidenceStatus}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        )}

        {/* VIEW 2: TRACEABILITY EXPLORER */}
        {viewMode === "traceability" && !graphError && (
          <div className="flex-1 overflow-y-auto p-8 bg-background">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="p-6 rounded-xl bg-panel border border-border shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                      <Workflow className="w-5 h-5 text-primary" />
                      7-Stage Engineering Traceability Chain
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Traverse defensible evidence from requirements down through architecture, implementation, routes, models, tests, and documentation.
                    </p>
                  </div>
                  {traceabilityData && (
                    <div>
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono ${
                          traceabilityData.complete
                            ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                            : "bg-amber-950/60 text-amber-400 border-amber-800"
                        }`}
                      >
                        {traceabilityData.complete ? "Chain Complete (100%)" : `${traceabilityData.unresolvedGaps.length} Gaps Detected`}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Root Selector */}
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
                  <label className="text-xs font-mono text-muted-foreground">Trace Root Entity:</label>
                  <select
                    className="bg-background border border-border rounded px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                    value={effectiveTraceabilityRoot || ""}
                    onChange={(e) => setTraceabilityRootId(e.target.value)}
                  >
                    {graphData?.filteredEntities.map((ent) => (
                      <option key={ent.id} value={ent.id} className="bg-panel text-foreground">
                        [{ent.type}] {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stepper Chain */}
              {traceabilityLoading ? (
                <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2 font-mono text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" /> Resolving evidence-backed chain...
                </div>
              ) : traceabilityData ? (
                <div className="space-y-3">
                  {traceabilityData.chain.map((step, idx) => {
                    const isPassed = step.status === "verified";
                    const isInferred = step.status === "inferred" || step.status === "partial";

                    return (
                      <div
                        key={step.stage}
                        className={`p-4 rounded-xl border transition-all ${
                          isPassed
                            ? "bg-panel border-border"
                            : isInferred
                            ? "bg-amber-950/10 border-amber-800/40"
                            : "bg-destructive/10 border-destructive/40"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                                isPassed
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : isInferred
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-destructive/20 text-destructive border border-destructive/30"
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                                  {step.stageLabel}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-mono ${
                                    isPassed
                                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                                      : isInferred
                                      ? "bg-amber-950/40 text-amber-400 border-amber-800"
                                      : "bg-destructive/20 text-destructive border-destructive/40"
                                  }`}
                                >
                                  {step.status.replace("_", " ")}
                                </Badge>
                              </div>
                              <h3 className="text-sm font-semibold text-foreground mt-1">
                                {step.entity ? step.entity.name : `Missing ${step.stageLabel}`}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1">{step.notes}</p>
                            </div>
                          </div>

                          {step.entity?.url && (
                            <Link
                              to={step.entity.url as any}
                              className="text-xs text-primary hover:underline flex items-center gap-1 font-mono"
                            >
                              Inspect Source <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="p-4 rounded-xl bg-card border border-border text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span>{traceabilityData.summary}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (traceabilityData.rootEntityId) {
                          impactMutation.mutate(traceabilityData.rootEntityId);
                        }
                      }}
                      disabled={impactMutation.isPending}
                      className="text-xs font-mono border-border"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 mr-1 text-orange-400" />
                      {impactMutation.isPending ? "Analyzing..." : "Analyze Chain Impact"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* VIEW 3: TABLE / LIST VIEW */}
        {viewMode === "table" && !graphError && (
          <div className="flex-1 overflow-y-auto p-8 bg-background">
            <div className="max-w-6xl mx-auto rounded-xl border border-border bg-panel overflow-hidden shadow-md">
              <table className="w-full text-left text-xs text-muted-foreground">
                <thead className="bg-muted/30 border-b border-border uppercase font-mono text-[10px] text-foreground">
                  <tr>
                    <th className="px-4 py-3">Entity Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Source Reference</th>
                    <th className="px-4 py-3">Evidence Status</th>
                    <th className="px-4 py-3">Freshness</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {graphData?.filteredEntities.map((ent) => {
                    const cfg = ENTITY_CONFIG[ent.type] || ENTITY_CONFIG.architecture_component;
                    return (
                      <tr key={ent.id} className="hover:bg-card/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full flex-none"
                            style={{ backgroundColor: cfg.color }}
                          />
                          {ent.name}
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{cfg.label}</td>
                        <td className="px-4 py-3 text-muted-foreground font-mono text-[11px] truncate max-w-xs">
                          {ent.sourceReference}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-mono ${
                              ent.evidenceStatus === "verified"
                                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                                : "bg-amber-950/40 text-amber-400 border-amber-800"
                            }`}
                          >
                            {ent.evidenceStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] ${
                              ent.freshness === "fresh" ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {ent.freshness}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEntityId(ent.id);
                              setViewMode("graph");
                            }}
                            className="h-7 text-xs font-mono text-primary hover:bg-muted/40"
                          >
                            Focus
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTraceabilityRootId(ent.id);
                              setViewMode("traceability");
                            }}
                            className="h-7 text-xs font-mono text-purple-400 hover:bg-muted/40"
                          >
                            Trace
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Evidence Inspector Sidebar ─── */}
        {selectedEntity && (
          <aside className="w-96 flex-none border-l border-border bg-panel p-5 overflow-y-auto flex flex-col justify-between shadow-2xl">
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold"
                      style={{
                        backgroundColor: ENTITY_CONFIG[selectedEntity.type]?.bg,
                        color: ENTITY_CONFIG[selectedEntity.type]?.color,
                      }}
                    >
                      {ENTITY_CONFIG[selectedEntity.type]?.label || selectedEntity.type}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono ${
                        selectedEntity.evidenceStatus === "verified"
                          ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                          : "bg-amber-950/40 text-amber-400 border-amber-800"
                      }`}
                    >
                      {selectedEntity.evidenceStatus}
                    </Badge>
                  </div>
                  <h3 className="text-base font-semibold text-foreground mt-2">{selectedEntity.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedEntityId(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Source Reference & Metadata */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Source Reference
                  </label>
                  <div className="mt-1 p-2 bg-background rounded font-mono text-foreground break-all border border-border">
                    {selectedEntity.sourceReference}
                  </div>
                </div>

                {selectedEntity.sourceVersion?.commitSha && (
                  <div>
                    <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                      Source Commit
                    </label>
                    <div className="mt-1 font-mono text-foreground">
                      {selectedEntity.sourceVersion.commitSha.slice(0, 10)} (
                      {selectedEntity.sourceVersion.branch || "main"})
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Freshness
                  </label>
                  <div className="mt-1 flex items-center gap-1.5 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedEntity.freshness === "fresh" ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="capitalize text-foreground">{selectedEntity.freshness}</span>
                  </div>
                </div>
              </div>

              {/* Connected Relationships with Evidence */}
              <div>
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2.5">
                  <Network className="w-3.5 h-3.5 text-primary" /> Connected Evidence (
                  {selectedEntityRelationships.length})
                </h4>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {selectedEntityRelationships.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No direct connections recorded.</p>
                  ) : (
                    selectedEntityRelationships.map((rel) => {
                      const isSource = rel.sourceId === selectedEntity.id;
                      const otherId = isSource ? rel.targetId : rel.sourceId;
                      const otherNode = graphData?.snapshot.entities.find((e) => e.id === otherId);

                      return (
                        <div
                          key={rel.id}
                          className="p-2.5 rounded bg-background border border-border text-xs space-y-1.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-primary uppercase">
                              {isSource ? `&rarr; ${rel.type}` : `&larr; ${rel.type}`}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] font-mono ${
                                rel.confidence === "verified"
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-800"
                                  : "bg-amber-950/40 text-amber-400 border-amber-800"
                              }`}
                            >
                              {rel.confidence}
                            </Badge>
                          </div>
                          <p className="font-medium text-foreground">
                            {otherNode ? otherNode.name : otherId}
                          </p>
                          <p className="text-[11px] text-muted-foreground italic">{rel.evidence}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div className="pt-4 border-t border-border space-y-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setTraceabilityRootId(selectedEntity.id);
                  setViewMode("traceability");
                }}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-mono"
              >
                <Workflow className="w-3.5 h-3.5 mr-1.5" /> Inspect Traceability Chain
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => impactMutation.mutate(selectedEntity.id)}
                disabled={impactMutation.isPending}
                className="w-full border-orange-500/40 text-orange-400 hover:bg-orange-500/10 text-xs font-mono"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                {impactMutation.isPending ? "Analyzing..." : "Analyze Impact"}
              </Button>

              {selectedEntity.url && (
                <Link
                  to={selectedEntity.url as any}
                  className="block text-center text-xs text-muted-foreground hover:text-foreground pt-1 font-mono"
                >
                  Open in module view &rarr;
                </Link>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

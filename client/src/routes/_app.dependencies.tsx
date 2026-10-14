import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Share2,
  ShieldAlert,
  ArrowRight,
  Loader2,
  AlertTriangle,
  FolderOpen,
  Filter,
  RefreshCw,
  Info,
  Package,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getDependencies,
  type DependencyNode,
  type DependencyEdge,
  type DependencyGraphResponse,
} from "@/api/repository";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dependencies")({
  head: () => ({
    meta: [
      { title: "Dependency Visualizer — ArchForge" },
      { name: "description", content: "Interactive graph of services, dependencies, and imports." },
    ],
  }),
  component: DepsPage,
});

type VisualNode = Omit<DependencyNode, "kind"> & {
  x: number;
  y: number;
  kind: "frontend" | "backend" | "service" | "database" | "cache" | "package" | "external";
};

const KIND_COLORS: Record<VisualNode["kind"], string> = {
  frontend: "text-info",
  backend: "text-primary",
  service: "text-primary",
  database: "text-success",
  cache: "text-warning",
  package: "text-muted-foreground",
  external: "text-muted-foreground",
};

function inferKind(node: DependencyNode): VisualNode["kind"] {
  const name = node.name.toLowerCase();
  if (name.includes("react") || name.includes("vue") || name.includes("client") || name.includes("app")) return "frontend";
  if (name.includes("postgres") || name.includes("mysql") || name.includes("mongo") || name.includes("prisma")) return "database";
  if (name.includes("redis") || name.includes("cache")) return "cache";
  if (node.ecosystem === "internal") return "service";
  if (name.includes("express") || name.includes("fastify") || name.includes("server") || name.includes("api")) return "backend";
  return "package";
}

function DepsPage() {
  const { currentProject } = useWorkspace();
  const [data, setData] = useState<DependencyGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterEcosystem, setFilterEcosystem] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    setData(null);
    setSelectedId(null);

    if (!currentProject) {
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    const loadData = async () => {
      try {
        const graphData = await getDependencies(currentProject.id);
        if (!isCurrent) return;
        setData(graphData);
        if (graphData.nodes.length > 0) {
          setSelectedId(graphData.nodes[0].id);
        }
      } catch {
        // Global error handler
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadData();

    return () => {
      isCurrent = false;
    };
  }, [currentProject?.id]);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const graphData = await getDependencies(currentProject.id);
      setData(graphData);
      if (graphData.nodes.length > 0 && !selectedId) {
        setSelectedId(graphData.nodes[0].id);
      }
    } catch {
      // Global error handler
    } finally {
      setLoading(false);
    }
  }, [currentProject, selectedId]);

  // Compute visual layout for nodes
  const visualNodes: VisualNode[] = useMemo(() => {
    if (!data || !data.nodes.length) return [];

    let filtered = data.nodes;
    if (filterEcosystem !== "all") {
      filtered = filtered.filter((n) => n.ecosystem === filterEcosystem);
    }
    if (filterType !== "all") {
      filtered = filtered.filter((n) => n.type === filterType);
    }

    // Sort nodes into columns based on depth and kind
    const columns: Record<number, DependencyNode[]> = { 0: [], 1: [], 2: [], 3: [] };
    filtered.forEach((n) => {
      const col = Math.min(3, Math.max(0, n.depth || 0));
      columns[col].push(n);
    });

    const result: VisualNode[] = [];
    Object.entries(columns).forEach(([colStr, colNodes]) => {
      const col = parseInt(colStr, 10);
      colNodes.forEach((n, row) => {
        result.push({
          ...n,
          kind: inferKind(n),
          x: 40 + col * 260,
          y: 40 + row * 64,
        });
      });
    });

    return result;
  }, [data, filterEcosystem, filterType]);

  const activeNodeIds = useMemo(() => new Set(visualNodes.map((n) => n.id)), [visualNodes]);

  const visualEdges = useMemo(() => {
    if (!data) return [];
    return data.edges.filter((e) => activeNodeIds.has(e.source) && activeNodeIds.has(e.target));
  }, [data, activeNodeIds]);

  const selected = useMemo(() => {
    return visualNodes.find((n) => n.id === selectedId) || visualNodes[0] || null;
  }, [visualNodes, selectedId]);

  const downstreamDeps = useMemo(() => {
    if (!selected || !data) return [];
    const targets = new Set(data.edges.filter((e) => e.source === selected.id).map((e) => e.target));
    return visualNodes.filter((n) => targets.has(n.id));
  }, [selected, data, visualNodes]);

  const upstreamConsumers = useMemo(() => {
    if (!selected || !data) return [];
    const sources = new Set(data.edges.filter((e) => e.target === selected.id).map((e) => e.source));
    return visualNodes.filter((n) => sources.has(n.id));
  }, [selected, data, visualNodes]);

  const svgHeight = useMemo(() => {
    const maxY = visualNodes.reduce((max, n) => Math.max(max, n.y), 400);
    return Math.max(480, maxY + 100);
  }, [visualNodes]);

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Dependency Visualizer</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to inspect dependencies.</p>
          <div className="pt-2 flex justify-center">
            <ProjectSwitcher variant="inline" />
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dependency graph...
        </div>
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5" /> Dependency visualizer
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Service topology</h1>
          </div>
          <ProjectSwitcher variant="inline" />
        </header>

        <div className="surface-panel p-8 text-center space-y-4 max-w-xl mx-auto">
          <Package className="h-10 w-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-medium">No dependencies analyzed yet</h2>
            <p className="text-sm text-muted-foreground">
              Connect and analyze your repository on the Repository page to generate a live dependency graph.
            </p>
          </div>
          <Button asChild>
            <Link to="/repository">Go to Repository Page</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] min-h-[calc(100vh-3rem)]">
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 border-r border-border min-w-0">
        <header className="flex items-end justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5" /> Dependency visualizer
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Dependency topology</h1>
            <p className="text-xs text-muted-foreground">
              {visualNodes.length} components · {visualEdges.length} connections detected from repository manifests and imports.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ProjectSwitcher variant="inline" />
            <select
              value={filterEcosystem}
              onChange={(e) => setFilterEcosystem(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-xs font-mono"
            >
              <option value="all">All Ecosystems</option>
              <option value="npm">npm</option>
              <option value="pip">Python / pip</option>
              <option value="maven">Maven</option>
              <option value="internal">Internal Modules</option>
            </select>

            <Button variant="outline" size="sm" onClick={fetchData} title="Refresh dependency graph">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </header>

        {/* Circular Candidates Alert */}
        {data.circularCandidates && data.circularCandidates.length > 0 && (
          <div className="p-3 rounded border border-warning/30 bg-warning/5 text-xs text-warning flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">Potential circular dependency detected:</span>
              <div className="font-mono text-[11px]">
                {data.circularCandidates.map((c, i) => (
                  <div key={i}>{c.join(" ➔ ")}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Graph Canvas */}
        <div className="surface-panel p-2 sm:p-4 overflow-x-auto touch-pan-x">
          <svg viewBox={`0 0 1100 ${svgHeight}`} className="w-full min-w-[700px] font-mono" style={{ minHeight: "420px" }}>
            <defs>
              <pattern id="grid-deps" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" className="text-border" strokeWidth="0.5" />
              </pattern>
              <marker id="arrow-deps" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
              </marker>
            </defs>
            <rect width="1100" height={svgHeight} fill="url(#grid-deps)" />

            {/* Edges */}
            {visualEdges.map((e, i) => {
              const na = visualNodes.find((n) => n.id === e.source);
              const nb = visualNodes.find((n) => n.id === e.target);
              if (!na || !nb) return null;
              const active = selected && (e.source === selected.id || e.target === selected.id);

              return (
                <line
                  key={i}
                  x1={na.x + 130}
                  y1={na.y + 22}
                  x2={nb.x}
                  y2={nb.y + 22}
                  className={active ? "stroke-primary" : "stroke-border"}
                  strokeWidth={active ? 1.5 : 1}
                  strokeDasharray="4 3"
                  markerEnd="url(#arrow-deps)"
                >
                  {active && (
                    <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1s" repeatCount="indefinite" />
                  )}
                </line>
              );
            })}

            {/* Nodes */}
            {visualNodes.map((n) => {
              const isSelected = selected?.id === n.id;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={() => setSelectedId(n.id)}
                  className="cursor-pointer"
                >
                  <rect
                    width="140"
                    height="44"
                    rx="4"
                    className={
                      (isSelected ? "fill-primary/15 stroke-primary" : "fill-panel stroke-border") +
                      " hover:stroke-primary/60 transition-colors"
                    }
                    strokeWidth="1"
                  />
                  <circle cx="12" cy="14" r="3" className={"fill-current " + KIND_COLORS[n.kind]} />
                  <text x="22" y="18" className="fill-foreground text-[11px] font-semibold truncate max-w-[110px]">
                    {n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name}
                  </text>
                  <text x="12" y="34" className="fill-muted-foreground text-[9px]">
                    {n.ecosystem} · {n.version}
                  </text>
                  {n.isUnused && (
                    <circle cx="128" cy="12" r="3" className="fill-warning">
                      <title>Unused dependency candidate</title>
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Categories Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
          {(["frontend", "backend", "service", "database", "cache", "package"] as VisualNode["kind"][]).map((k) => (
            <div key={k} className="flex items-center gap-2 surface-panel px-3 py-2">
              <span className={"h-1.5 w-1.5 rounded-full bg-current " + KIND_COLORS[k]} />
              <span className="capitalize">{k}</span>
              <span className="ml-auto text-muted-foreground">
                {visualNodes.filter((n) => n.kind === k).length}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Aside */}
      <aside className="p-4 bg-panel/50 space-y-4">
        {selected ? (
          <>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Inspecting Component</div>
              <div className="text-xl font-display font-semibold mt-1 break-all">{selected.name}</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {selected.ecosystem} · v{selected.version} {selected.type ? `(${selected.type})` : ""}
              </div>
            </div>

            <div className="surface-panel p-3 space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ecosystem</span>
                <span>{selected.ecosystem}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fan-in (consumers)</span>
                <span>{selected.fanIn}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Fan-out (dependencies)</span>
                <span>{selected.fanOut}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Graph Depth</span>
                <span>{selected.depth}</span>
              </div>
              {selected.isUnused && (
                <div className="flex items-center justify-between text-warning">
                  <span>Usage status</span>
                  <span>Unused candidate</span>
                </div>
              )}
            </div>

            {/* Vulnerability notice without fake CVEs */}
            <div className="surface-panel p-3 space-y-2 text-[11px]">
              <div className="flex items-center gap-2 text-muted-foreground font-mono uppercase text-[10px]">
                <ShieldAlert className="h-3.5 w-3.5" /> Vulnerability Status
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Vulnerability scanning not configured. Connect GitHub Dependabot or Snyk for verified security advisories.
              </p>
            </div>

            <DepList title="Depends on" nodes={downstreamDeps} empty="No downstream dependencies" />
            <DepList title="Depended on by" nodes={upstreamConsumers} empty="No upstream consumers" />
          </>
        ) : (
          <div className="p-4 text-center text-xs text-muted-foreground">Select a node in the graph to inspect details.</div>
        )}
      </aside>
    </div>
  );
}

function DepList({ title, nodes, empty }: { title: string; nodes: VisualNode[]; empty: string }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{title}</div>
      <div className="surface-panel divide-y divide-border">
        {nodes.length === 0 ? (
          <div className="p-3 text-[11px] font-mono text-muted-foreground">{empty}</div>
        ) : (
          nodes.map((n) => (
            <div key={n.id} className="p-2.5 flex items-center gap-2">
              <span className={"h-1.5 w-1.5 rounded-full bg-current " + KIND_COLORS[n.kind]} />
              <span className="text-xs font-medium truncate flex-1">{n.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{n.version}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
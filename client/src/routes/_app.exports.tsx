import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Download,
  FileText,
  FileImage,
  FileCode2,
  Package,
  FileJson,
  FileArchive,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Clock,
  RotateCw,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getProjectExports,
  createProjectExport,
  getExport,
  getProjectExportData,
  type ProjectExport,
  type ExportType,
  type ExportFormat,
} from "@/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/exports")({
  head: () => ({
    meta: [
      { title: "Exports — ArchForge" },
      {
        name: "description",
        content: "Export architecture diagrams, engineering reports, OpenAPI specs, and starter code.",
      },
      { property: "og:title", content: "Exports — ArchForge" },
      { property: "og:description", content: "Export diagrams, reports, OpenAPI specs, and starter code." },
    ],
  }),
  component: ExportsPage,
});

interface ExportOption {
  type: ExportType;
  format: ExportFormat;
  name: string;
  desc: string;
  category: "Diagram" | "Docs" | "Data" | "Code";
  icon: typeof FileText;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    type: "architecture",
    format: "svg",
    name: "Architecture Diagram (SVG)",
    desc: "Vector diagram export of the current canvas components and edges.",
    category: "Diagram",
    icon: FileImage,
  },
  {
    type: "dependency_graph",
    format: "svg",
    name: "Dependency Graph (SVG)",
    desc: "Visual topology of package dependencies and service boundaries.",
    category: "Diagram",
    icon: FileCode2,
  },
  {
    type: "full_project_report",
    format: "pdf",
    name: "Full Platform Report (PDF)",
    desc: "Consolidated architecture, drift, security, and quality gate audit report.",
    category: "Docs",
    icon: FileText,
  },
  {
    type: "documentation",
    format: "markdown",
    name: "Engineering Documentation (MD)",
    desc: "Reconciled markdown documentation with architecture and source insights.",
    category: "Docs",
    icon: FileText,
  },
  {
    type: "project_story",
    format: "markdown",
    name: "Project Story Mode (MD)",
    desc: "Interview and demo-ready technical overview of architectural decisions.",
    category: "Docs",
    icon: FileText,
  },
  {
    type: "architecture",
    format: "json",
    name: "Architecture Definition (JSON)",
    desc: "Full machine-readable specification of all nodes, edges, and metadata.",
    category: "Data",
    icon: FileJson,
  },
  {
    type: "drift_report",
    format: "json",
    name: "Drift Analysis Findings (JSON)",
    desc: "Complete divergence findings between intended architecture and repository.",
    category: "Data",
    icon: FileJson,
  },
  {
    type: "version_comparison",
    format: "json",
    name: "Version Delta (JSON)",
    desc: "Topology diff between architecture baseline snapshots.",
    category: "Data",
    icon: FileCode2,
  },
  {
    type: "full_project_report",
    format: "json",
    name: "Complete Project Bundle (JSON)",
    desc: "Raw platform operations, requirements, and multi-repo verification payload.",
    category: "Code",
    icon: FileArchive,
  },
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ExportsPage() {
  const { currentProject } = useWorkspace();
  const [history, setHistory] = useState<ProjectExport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchHistory = useCallback(async (showLoading = true) => {
    if (!currentProject) {
      setHistory([]);
      return;
    }
    if (showLoading) setLoadingHistory(true);
    try {
      const data = await getProjectExports(currentProject.id);
      setHistory(data);
    } catch (err) {
      console.error("Failed to load project export history:", err);
    } finally {
      if (showLoading) setLoadingHistory(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchHistory(true);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchHistory]);

  // Poll while any export is pending/running
  useEffect(() => {
    const hasPending = history.some((h) => h.status === "queued" || h.status === "running");
    if (hasPending && !pollingRef.current && currentProject) {
      pollingRef.current = setInterval(async () => {
        try {
          const updated = await getProjectExports(currentProject.id);
          setHistory(updated);
          const stillPending = updated.some((h) => h.status === "queued" || h.status === "running");
          if (!stillPending && pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        } catch {
          // Keep polling or let timeout handle
        }
      }, 2000);
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, [history, currentProject]);

  const handleCreateExport = async (option: ExportOption) => {
    if (!currentProject) {
      toast.error("Please select a project before creating an export.");
      return;
    }

    const key = `${option.type}-${option.format}`;
    setGeneratingKey(key);
    try {
      const created = await createProjectExport(currentProject.id, {
        type: option.type,
        format: option.format,
      });
      toast.success(`Export job queued: ${option.name}`);
      setHistory((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      // Trigger background poll check
      setTimeout(() => fetchHistory(false), 800);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to create export";
      toast.error(msg);
    } finally {
      setGeneratingKey(null);
    }
  };

  const handleDownload = async (item: ProjectExport) => {
    if (item.status !== "completed") return;

    if (item.download_url) {
      window.open(item.download_url, "_blank");
      return;
    }

    // Direct client fallback download using real architecture/export data
    try {
      toast.info("Preparing artifact download...");
      const data = await getProjectExportData(item.project_id);
      const isJson = item.format === "json";
      const filename = `${currentProject?.slug || "project"}-${item.type}.${item.format}`;
      const content = isJson
        ? JSON.stringify(data, null, 2)
        : `# ARCHFORGE EXPORT: ${item.type.toUpperCase()}\n\nGenerated: ${item.created_at}\nProject: ${currentProject?.name}\n\n${JSON.stringify(data, null, 2)}`;
      const blob = new Blob([content], {
        type: isJson ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error("Failed to generate download artifact.");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Project: {currentProject ? currentProject.name : "Select Project"}
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Export Center</h1>
          <p className="text-sm text-muted-foreground">
            Ship your architecture in genuine, machine-readable, and document formats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ProjectSwitcher variant="inline" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHistory(true)}
            disabled={loadingHistory || !currentProject}
            title="Refresh history"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {!currentProject ? (
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-semibold">No Project Selected</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Select a project from the workspace selector above to view and generate exports.
          </p>
        </div>
      ) : (
        <>
          {(["Diagram", "Docs", "Data", "Code"] as const).map((cat) => {
            const options = EXPORT_OPTIONS.filter((f) => f.category === cat);
            if (options.length === 0) return null;
            return (
              <section key={cat} className="space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{cat}</div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {options.map((opt) => {
                    const Icon = opt.icon;
                    const key = `${opt.type}-${opt.format}`;
                    const isGenerating = generatingKey === key;
                    return (
                      <div
                        key={key}
                        className="surface-panel p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded border border-border bg-surface grid place-items-center">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{opt.name}</div>
                            <div className="text-[11px] font-mono text-muted-foreground uppercase">
                              .{opt.format}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed flex-1">{opt.desc}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-auto h-8 gap-2"
                          disabled={isGenerating || !currentProject}
                          onClick={() => handleCreateExport(opt)}
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              <span>Queueing…</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-3.5 w-3.5" />
                              <span>Export .{opt.format}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <section className="space-y-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Export History ({history.length})
              </div>
              {history.some((h) => h.status === "queued" || h.status === "running") && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Processing export job…</span>
                </div>
              )}
            </div>

            <div className="surface-panel overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_100px_110px_130px_90px] items-center gap-3 h-9 px-3 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                <span>Name / Type</span>
                <span>Size</span>
                <span>When</span>
                <span>Status</span>
                <span className="text-right">Action</span>
              </div>

              {loadingHistory ? (
                <div className="p-8 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading export history…</span>
                </div>
              ) : history.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                  <p>No exports generated yet for this project.</p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Click any export button above to generate a real system artifact.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {history.map((h) => {
                    const filename = `${currentProject?.slug || "project"}-${h.type}.${h.format}`;
                    return (
                      <div
                        key={h.id}
                        className="grid grid-cols-[minmax(0,1fr)_100px_110px_130px_90px] items-center gap-3 h-11 px-3 text-xs hover:bg-surface/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-medium truncate block">{filename}</span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">
                            {h.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {formatBytes(h.metadata?.bytes)}
                        </span>
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {formatRelativeTime(h.created_at)}
                        </span>
                        <div>
                          {h.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 text-success text-[11px] font-mono">
                              <CheckCircle2 className="h-3 w-3" /> ready
                            </span>
                          ) : h.status === "running" ? (
                            <span className="inline-flex items-center gap-1 text-primary text-[11px] font-mono">
                              <Loader2 className="h-3 w-3 animate-spin" /> running
                            </span>
                          ) : h.status === "queued" ? (
                            <span className="inline-flex items-center gap-1 text-warning text-[11px] font-mono">
                              <Clock className="h-3 w-3" /> queued
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-destructive text-[11px] font-mono"
                              title={h.metadata?.error || "Export generation failed"}
                            >
                              <AlertTriangle className="h-3 w-3" /> failed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-end">
                          {h.status === "completed" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs font-mono text-primary hover:text-primary gap-1"
                              onClick={() => handleDownload(h)}
                            >
                              <Download className="h-3 w-3" /> Get
                            </Button>
                          ) : h.status === "failed" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs font-mono text-muted-foreground hover:text-foreground gap-1"
                              onClick={() =>
                                handleCreateExport({
                                  type: h.type,
                                  format: h.format,
                                  name: h.type,
                                  desc: "",
                                  category: "Data",
                                  icon: FileText,
                                })
                              }
                            >
                              <RotateCw className="h-3 w-3" /> Retry
                            </Button>
                          ) : (
                            <span className="text-[10px] font-mono text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
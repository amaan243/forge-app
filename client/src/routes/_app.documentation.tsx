import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  BookOpen,
  Network,
  Database,
  CloudUpload,
  Shield,
  FolderOpen,
  Search,
  Copy,
  Check,
  Download,
  Sparkles,
  RefreshCw,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Eye,
  Code2,
  Plus,
  FileCode2,
  GitCommit,
  Clock,
  ChevronDown,
  ChevronRight,
  Loader2,
  X,
  History,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getDocumentations,
  getDocumentationStaleness,
  generateDocumentation,
  updateDocumentation,
  deleteDocumentation,
  regenerateDocumentation,
  type DocumentationDocument,
  type DocumentationType,
  type DocumentationFormat,
  type DocumentationStalenessItem,
  type DocumentationSourceMode,
} from "@/api/documentation";
import { getArchitectureVersions, type ArchitectureVersion } from "@/api/architecture";
import { getRepositoryAnalyses, getRepositories, type RepositoryAnalysis, type RepositorySummaryItem } from "@/api/repository";

export const Route = createFileRoute("/_app/documentation")({
  head: () => ({
    meta: [
      { title: "Documentation Intelligence — ArchForge" },
      {
        name: "description",
        content:
          "Reliable engineering documentation generated from architecture versions, repository code scans, and database models.",
      },
      { property: "og:title", content: "Documentation Intelligence — ArchForge" },
      {
        property: "og:description",
        content:
          "Reliable engineering documentation generated from architecture versions, repository code scans, and database models.",
      },
    ],
  }),
  component: DocumentationPage,
});

const DOC_TYPES: Array<{
  key: DocumentationType;
  label: string;
  icon: typeof FileText;
  description: string;
}> = [
  {
    key: "architecture_overview",
    label: "Architecture Overview",
    icon: Network,
    description: "System topologies, services, dependencies, and communication protocols",
  },
  {
    key: "system_design",
    label: "System Design",
    icon: Layers,
    description: "Component responsibilities, architectural trade-offs, and quality attributes",
  },
  {
    key: "api_documentation",
    label: "API Reference",
    icon: FileCode2,
    description: "HTTP REST routes, endpoints, schemas, parameters, and OpenAPI definitions",
  },
  {
    key: "database_documentation",
    label: "Database & Models",
    icon: Database,
    description: "Data entities, relational tables, columns, constraints, and indices",
  },
  {
    key: "deployment",
    label: "Deployment & Runbook",
    icon: CloudUpload,
    description: "Infrastructure configs, deployment instructions, environment variables, and ops runbook",
  },
  {
    key: "security",
    label: "Security & RBAC",
    icon: Shield,
    description: "Security architecture, authentication boundaries, encryption, and threat surfaces",
  },
  {
    key: "repository_overview",
    label: "Repository Intelligence",
    icon: BookOpen,
    description: "Repository code analysis, directory structure, module breakdown, and commit info",
  },
  {
    key: "getting_started",
    label: "Developer Setup",
    icon: Sparkles,
    description: "Developer onboarding, prerequisites, environment setup, and test execution",
  },
];

function getDocIcon(type: DocumentationType) {
  const match = DOC_TYPES.find((t) => t.key === type);
  return match ? match.icon : FileText;
}

function getDocLabel(type: DocumentationType) {
  const match = DOC_TYPES.find((t) => t.key === type);
  return match ? match.label : type.replace(/_/g, " ");
}

function extractTOC(content: string) {
  const lines = content.split("\n");
  const toc: { id: string; label: string; level: number }[] = [];
  lines.forEach((line) => {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const label = match[2].trim().replace(/\*\*/g, "").replace(/`/g, "");
      const id = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      toc.push({ id, label, level });
    }
  });
  return toc;
}

function downloadFile(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function DocumentationPage() {
  const { currentProject } = useWorkspace();

  const [documents, setDocuments] = useState<DocumentationDocument[]>([]);
  const [stalenessList, setStalenessList] = useState<DocumentationStalenessItem[]>([]);
  const [archVersions, setArchVersions] = useState<ArchitectureVersion[]>([]);
  const [repoAnalyses, setRepoAnalyses] = useState<RepositoryAnalysis[]>([]);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // View / Edit state
  const [viewMode, setViewMode] = useState<"formatted" | "raw" | "edit">("formatted");
  const [editTitle, setEditTitle] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Load project documents
  const loadData = useCallback(async () => {
    if (!currentProject) return;
    try {
      setLoading(true);
      const [docs, stale, versions, analyses] = await Promise.all([
        getDocumentations(currentProject.id),
        getDocumentationStaleness(currentProject.id).catch(() => []),
        getArchitectureVersions(currentProject.id).catch(() => []),
        getRepositoryAnalyses(currentProject.id).catch(() => []),
      ]);
      setDocuments(docs);
      setStalenessList(stale);
      setArchVersions(versions);
      setRepoAnalyses(analyses);

      if (docs.length > 0) {
        setSelectedDocId((prev) => (prev && docs.some((d) => d.id === prev) ? prev : docs[0].id));
      } else {
        setSelectedDocId(null);
      }
    } catch (err) {
      toast.error("Failed to load documentation data");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selected document
  const activeDoc = useMemo(
    () => documents.find((d) => d.id === selectedDocId) || documents[0] || null,
    [documents, selectedDocId]
  );

  const activeStaleness = useMemo(
    () => stalenessList.find((s) => s.id === activeDoc?.id) || null,
    [stalenessList, activeDoc]
  );

  useEffect(() => {
    if (activeDoc) {
      setEditTitle(activeDoc.title);
      setEditContent(activeDoc.content);
      setViewMode("formatted");
    }
  }, [activeDoc]);

  // Table of Contents
  const toc = useMemo(() => {
    if (!activeDoc) return [];
    return extractTOC(activeDoc.content);
  }, [activeDoc]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || doc.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, filterType]);

  // Stats
  const upToDateCount = documents.filter((d) => d.status === "up_to_date").length;
  const outdatedCount = documents.filter((d) => d.status === "outdated" || stalenessList.some((s) => s.id === d.id && s.is_analysis_stale)).length;

  // Actions
  const handleSaveEdit = async () => {
    if (!currentProject || !activeDoc) return;
    try {
      setIsSaving(true);
      const updated = await updateDocumentation(currentProject.id, activeDoc.id, {
        title: editTitle.trim(),
        content: editContent,
      });
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setViewMode("formatted");
      toast.success("Documentation updated and saved");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async (forceOverwrite = false) => {
    if (!currentProject || !activeDoc) return;

    if (activeDoc.manually_edited && !forceOverwrite) {
      setShowRegenerateConfirm(true);
      return;
    }

    try {
      setIsRegenerating(true);
      const updated = await regenerateDocumentation(currentProject.id, activeDoc.id, {
        section: "all",
        force_overwrite: true,
      });
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setShowRegenerateConfirm(false);
      toast.success("Documentation re-synced with latest architecture and repo");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to regenerate documentation");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!currentProject || !activeDoc) return;
    try {
      await deleteDocumentation(currentProject.id, activeDoc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== activeDoc.id));
      setShowDeleteConfirm(false);
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleCopy = () => {
    if (!activeDoc) return;
    navigator.clipboard?.writeText(activeDoc.content);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format: "markdown" | "html" | "json") => {
    if (!activeDoc) return;
    const cleanTitle = activeDoc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (format === "markdown") {
      downloadFile(`${cleanTitle}.md`, activeDoc.content, "text/markdown");
    } else if (format === "html") {
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activeDoc.title}</title><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#1e293b;}</style></head><body><h1>${activeDoc.title}</h1><pre>${activeDoc.content}</pre></body></html>`;
      downloadFile(`${cleanTitle}.html`, htmlDoc, "text/html");
    } else if (format === "json") {
      downloadFile(`${cleanTitle}.json`, JSON.stringify(activeDoc, null, 2), "application/json");
    }
  };

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Documentation Intelligence</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to access and generate engineering documentation.</p>
          <div className="pt-2 flex justify-center">
            <ProjectSwitcher variant="inline" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Top Banner / Breadcrumb & Status */}
      <div className="h-12 border-b border-border bg-panel/60 px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Documentation Intelligence</span>
            <span>/</span>
            <span className="truncate max-w-[200px] text-foreground">{currentProject.name}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-muted-foreground">
              {documents.length} docs
            </span>
            {outdatedCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {outdatedCount} outdated
              </span>
            )}
            {upToDateCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {upToDateCount} up to date
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProjectSwitcher variant="toolbar" />
          <Button
            size="sm"
            onClick={() => setShowGenerateModal(true)}
            className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Generate Doc
          </Button>
        </div>
      </div>

      {/* Main 3-column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_240px] flex-1">
        {/* Left Sidebar: Document List & Search */}
        <aside className="border-b lg:border-b-0 lg:border-r border-border bg-panel/40 flex flex-col min-h-0 max-h-60 lg:max-h-none overflow-y-auto">
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation…"
                className="w-full h-8 pl-8 pr-3 rounded border border-border bg-background text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-mono scrollbar-none">
              <button
                onClick={() => setFilterType("all")}
                className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                  filterType === "all" ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({documents.length})
              </button>
              {DOC_TYPES.map((t) => {
                const count = documents.filter((d) => d.type === t.key).length;
                if (count === 0) return null;
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilterType(t.key)}
                    className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                      filterType === t.key ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label.split(" ")[0]} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-2 space-y-1 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center space-y-2">
                <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-mono">Loading documentation…</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-6 text-center space-y-3">
                <FileText className="h-6 w-6 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">
                  {documents.length === 0 ? "No documentation generated yet." : "No documents match search."}
                </p>
                {documents.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowGenerateModal(true)}
                    className="h-7 text-xs"
                  >
                    Generate First Doc
                  </Button>
                )}
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const Icon = getDocIcon(doc.type);
                const isSelected = doc.id === activeDoc?.id;
                const isStale = doc.status === "outdated" || stalenessList.some((s) => s.id === doc.id && s.is_analysis_stale);

                return (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDocId(doc.id)}
                    className={`w-full text-left p-2.5 rounded border transition-all text-xs group ${
                      isSelected
                        ? "bg-surface border-primary/40 shadow-sm"
                        : "border-transparent hover:bg-surface/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium text-foreground truncate">{doc.title}</div>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono text-muted-foreground">
                          <span>{doc.format.toUpperCase()}</span>
                          <span>•</span>
                          <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-col items-end gap-1">
                        {isStale ? (
                          <span
                            title="Outdated: Architecture or repository has newer changes"
                            className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"
                          />
                        ) : (
                          <span title="Up to date" className="h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                        {doc.manually_edited && (
                          <span className="text-[9px] font-mono px-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            EDITED
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Info Footer */}
          <div className="p-3 border-t border-border bg-panel/60 text-[11px] text-muted-foreground font-mono space-y-1">
            <div className="flex items-center justify-between">
              <span>Pipeline Sync</span>
              <span className="text-emerald-400">Live</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Repository</span>
              <span className="truncate max-w-[120px]">{(repoAnalyses[0] as any)?.branch || (repoAnalyses[0] as any)?.analysis_data?.branch || "connected"}</span>
            </div>
          </div>
        </aside>

        {/* Center Pane: Document Viewer / Editor */}
        <main className="min-w-0 flex flex-col min-h-0 bg-background/50">
          {activeDoc ? (
            <>
              {/* Document Header Controls */}
              <div className="min-h-12 border-b border-border px-4 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4 bg-panel/30 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 rounded bg-surface border border-border">
                    {activeDoc.format}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">{activeDoc.title}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Mode Selector */}
                  <div className="flex items-center bg-surface rounded border border-border p-0.5 mr-2">
                    <button
                      onClick={() => setViewMode("formatted")}
                      className={`h-6 px-2 text-[11px] font-mono rounded flex items-center gap-1 transition-colors ${
                        viewMode === "formatted" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                    <button
                      onClick={() => setViewMode("raw")}
                      className={`h-6 px-2 text-[11px] font-mono rounded flex items-center gap-1 transition-colors ${
                        viewMode === "raw" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Code2 className="h-3 w-3" /> Raw
                    </button>
                    <button
                      onClick={() => setViewMode("edit")}
                      className={`h-6 px-2 text-[11px] font-mono rounded flex items-center gap-1 transition-colors ${
                        viewMode === "edit" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                  </div>

                  {/* Actions */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerate()}
                    disabled={isRegenerating}
                    title="Regenerate from current architecture & code analysis"
                    className="h-7 text-xs font-mono gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`} />
                    Regenerate
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="h-7 text-xs font-mono gap-1"
                  >
                    {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>

                  <div className="relative group">
                    <Button size="sm" variant="outline" className="h-7 text-xs font-mono gap-1">
                      <Download className="h-3 w-3" /> Export
                    </Button>
                    <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-surface border border-border rounded shadow-lg p-1 z-10 min-w-[120px] text-xs font-mono">
                      <button
                        onClick={() => handleExport("markdown")}
                        className="px-2 py-1 text-left rounded hover:bg-panel text-muted-foreground hover:text-foreground"
                      >
                        Markdown (.md)
                      </button>
                      <button
                        onClick={() => handleExport("html")}
                        className="px-2 py-1 text-left rounded hover:bg-panel text-muted-foreground hover:text-foreground"
                      >
                        HTML (.html)
                      </button>
                      <button
                        onClick={() => handleExport("json")}
                        className="px-2 py-1 text-left rounded hover:bg-panel text-muted-foreground hover:text-foreground"
                      >
                        JSON (.json)
                      </button>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-500"
                    title="Delete document"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Freshness / Staleness Alert Banner */}
              {(activeDoc.status === "outdated" || activeStaleness?.is_analysis_stale) && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between text-xs text-amber-500">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>Documentation is outdated:</strong> Newer architecture or repository code changes exist
                      since this document was generated.
                      {activeStaleness?.latest_commit_sha && (
                        <span className="font-mono ml-1">
                          (Latest commit: {activeStaleness.latest_commit_sha.slice(0, 7)})
                        </span>
                      )}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleRegenerate()}
                    disabled={isRegenerating}
                    className="h-6 text-[11px] font-mono bg-amber-500 text-black hover:bg-amber-400 gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRegenerating ? "animate-spin" : ""}`} />
                    Update Now
                  </Button>
                </div>
              )}

              {/* Document Content View */}
              <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {viewMode === "edit" ? (
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground uppercase">Document Title</label>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full h-9 px-3 rounded border border-border bg-background text-sm font-medium focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-muted-foreground uppercase">
                        Markdown Content ({editContent.length} chars)
                      </label>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={25}
                        className="w-full p-4 rounded border border-border bg-background text-xs font-mono leading-relaxed focus:outline-none focus:border-primary/50 resize-y"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditTitle(activeDoc.title);
                          setEditContent(activeDoc.content);
                          setViewMode("formatted");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="gap-1 bg-primary text-primary-foreground"
                      >
                        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : viewMode === "raw" ? (
                  <div className="max-w-4xl mx-auto rounded border border-border bg-surface/50 overflow-hidden">
                    <div className="p-3 border-b border-border bg-panel flex items-center justify-between text-xs font-mono text-muted-foreground">
                      <span>Source code ({activeDoc.content.split("\n").length} lines)</span>
                      <button onClick={handleCopy} className="hover:text-foreground flex items-center gap-1">
                        <Copy className="h-3 w-3" /> Copy Raw
                      </button>
                    </div>
                    <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap text-foreground/90">
                      {activeDoc.content}
                    </pre>
                  </div>
                ) : (
                  <article className="max-w-3xl mx-auto space-y-6">
                    {/* Lineage metadata card */}
                    <div className="rounded-lg border border-border bg-surface/40 p-4 space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>Generated by ArchForge Documentation Intelligence</span>
                        </div>
                        <span>v{activeDoc.updated_at ? new Date(activeDoc.updated_at).toLocaleTimeString() : ""}</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono uppercase text-muted-foreground">Source Architecture</span>
                          <div className="font-mono text-foreground truncate">
                            {activeDoc.source_version_id
                              ? `Version ID: ${activeDoc.source_version_id.slice(0, 8)}`
                              : "Active Version"}
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono uppercase text-muted-foreground">Repository Source</span>
                          <div className="font-mono text-foreground flex items-center gap-1">
                            <GitCommit className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {activeDoc.source_commit_sha
                                ? activeDoc.source_commit_sha.slice(0, 7)
                                : activeDoc.source_branch || "HEAD"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono uppercase text-muted-foreground">Freshness Status</span>
                          <div>
                            {activeDoc.status === "up_to_date" ? (
                              <span className="text-emerald-400 font-mono flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Synchronized
                              </span>
                            ) : (
                              <span className="text-amber-400 font-mono flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Update Available
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rendered Markdown Body */}
                    <MarkdownRenderer content={activeDoc.content} />
                  </article>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-display font-semibold">No Document Selected</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Select an engineering document from the left sidebar or generate a comprehensive software spec from your
                current architecture and repository.
              </p>
              <Button onClick={() => setShowGenerateModal(true)} className="gap-2 bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" /> Generate Documentation
              </Button>
            </div>
          )}
        </main>

        {/* Right Sidebar: Table of Contents & Stats */}
        <aside className="border-l border-border bg-panel/30 p-4 space-y-6 hidden lg:block overflow-y-auto">
          {activeDoc ? (
            <>
              {/* TOC */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> On This Page
                </div>
                {toc.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No section headings found.</p>
                ) : (
                  <nav className="space-y-1">
                    {toc.map((item, idx) => (
                      <a
                        key={`${item.id}-${idx}`}
                        href={`#${item.id}`}
                        className={`block text-xs text-muted-foreground hover:text-foreground transition-colors truncate py-0.5 ${
                          item.level === 1
                            ? "font-medium text-foreground"
                            : item.level === 2
                              ? "pl-2"
                              : "pl-4 text-[11px]"
                        }`}
                      >
                        {item.label}
                      </a>
                    ))}
                  </nav>
                )}
              </div>

              {/* Document Metadata Panel */}
              <div className="border-t border-border pt-4 space-y-3">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Document Stats
                </div>
                <div className="space-y-2 text-xs font-mono text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Type</span>
                    <span className="text-foreground">{getDocLabel(activeDoc.type)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Format</span>
                    <span className="text-foreground uppercase">{activeDoc.format}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Words</span>
                    <span className="text-foreground">{activeDoc.content.split(/\s+/).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Reading Time</span>
                    <span className="text-foreground">
                      {Math.ceil(activeDoc.content.split(/\s+/).length / 200)} min
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Manual Edits</span>
                    <span className={activeDoc.manually_edited ? "text-purple-400" : "text-foreground"}>
                      {activeDoc.manually_edited ? "Yes (Protected)" : "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Context Summary */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Architecture Baseline
                </div>
                <div className="p-2.5 rounded border border-border bg-surface text-xs space-y-1">
                  <div className="font-medium text-foreground truncate">{currentProject.name}</div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    {currentProject.description || "No project description provided."}
                  </p>
                  <div className="text-[10px] font-mono text-primary pt-1">
                    {archVersions.length} saved architecture versions
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground text-center pt-8">
              Select a document to inspect table of contents and metadata.
            </div>
          )}
        </aside>
      </div>

      {/* Generate Document Modal */}
      {showGenerateModal && (
        <GenerateModal
          projectId={currentProject.id}
          projectName={currentProject.name}
          archVersions={archVersions}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(newDoc) => {
            setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
            setSelectedDocId(newDoc.id);
            setShowGenerateModal(false);
            toast.success(`Generated ${newDoc.title}`);
          }}
        />
      )}

      {/* Confirmation: Overwrite Manual Edits on Regenerate */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-panel max-w-md w-full p-6 space-y-4 border border-border shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Overwrite Manual Edits?</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This document was previously edited manually. Re-generating it will replace your custom modifications
                  with freshly generated content from the latest architecture and repository models.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowRegenerateConfirm(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleRegenerate(true)}
                disabled={isRegenerating}
                className="gap-1.5"
              >
                {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Regenerate & Overwrite
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation: Delete Document */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-panel max-w-md w-full p-6 space-y-4 border border-border shadow-xl">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">Delete Documentation</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to delete <strong>{activeDoc?.title}</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                Delete Document
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Documentation Type Source Rules and Modes
const DOC_TYPE_SOURCE_RULES: Record<
  DocumentationType,
  {
    allowedModes: DocumentationSourceMode[];
    defaultMode: DocumentationSourceMode;
    description: string;
  }
> = {
  architecture_overview: {
    allowedModes: ["architecture", "combined"],
    defaultMode: "architecture",
    description: "Requires a saved architecture baseline. Repository code scan is optional in Combined mode.",
  },
  system_design: {
    allowedModes: ["architecture", "combined"],
    defaultMode: "architecture",
    description: "Requires a saved architecture baseline. Repository code scan is optional in Combined mode.",
  },
  api_documentation: {
    allowedModes: ["repository", "combined"],
    defaultMode: "repository",
    description: "Requires repository code analysis with detected routes. Architecture is optional in Combined mode.",
  },
  database_documentation: {
    allowedModes: ["repository", "architecture", "combined"],
    defaultMode: "repository",
    description: "Uses actual database schema as primary source. Requires architecture when documenting intended design.",
  },
  deployment: {
    allowedModes: ["repository", "combined"],
    defaultMode: "repository",
    description: "Requires repository files, Docker, K8s, and deployment configs. Architecture optional.",
  },
  security: {
    allowedModes: ["repository", "combined"],
    defaultMode: "repository",
    description: "Requires repository security findings, auth, and test evidence. Architecture optional.",
  },
  repository_overview: {
    allowedModes: ["repository"],
    defaultMode: "repository",
    description: "Requires a completed repository scan only. Architecture is decoupled.",
  },
  getting_started: {
    allowedModes: ["repository"],
    defaultMode: "repository",
    description: "Requires repository source code and configuration evidence only.",
  },
  testing_security: {
    allowedModes: ["repository", "combined"],
    defaultMode: "repository",
    description: "Requires repository test evidence and static security findings.",
  },
  custom: {
    allowedModes: ["architecture", "repository", "combined"],
    defaultMode: "combined",
    description: "Custom documentation synthesizing selected baseline or repository sources.",
  },
};

// Generate Documentation Modal Component
function GenerateModal({
  projectId,
  projectName,
  archVersions,
  onClose,
  onGenerated,
}: {
  projectId: string;
  projectName: string;
  archVersions: ArchitectureVersion[];
  onClose: () => void;
  onGenerated: (doc: DocumentationDocument) => void;
}) {
  const [selectedType, setSelectedType] = useState<DocumentationType>("architecture_overview");
  const [sourceMode, setSourceMode] = useState<DocumentationSourceMode>("architecture");
  const [title, setTitle] = useState("Architecture Overview Specification");
  const [format, setFormat] = useState<DocumentationFormat>("markdown");
  const [versionId, setVersionId] = useState<string>(archVersions[0]?.id || "");
  const [repositories, setRepositories] = useState<RepositorySummaryItem[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [analyses, setAnalyses] = useState<RepositoryAnalysis[]>([]);
  const [analysisId, setAnalysisId] = useState<string>("");
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [loadingAnalyses, setLoadingAnalyses] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [forceOverwrite, setForceOverwrite] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Clear incompatible selections and fetch repositories when projectId changes
  useEffect(() => {
    let isMounted = true;
    setVersionId(archVersions[0]?.id || "");
    setSelectedRepoId("");
    setAnalysisId("");
    setAnalyses([]);

    const loadRepos = async () => {
      try {
        setLoadingRepos(true);
        const repoList = await getRepositories(projectId);
        if (!isMounted) return;
        setRepositories(repoList);
        if (repoList.length > 0) {
          const firstRepoId = repoList[0].repository.id;
          setSelectedRepoId(firstRepoId);
        }
      } catch (err) {
        if (isMounted) setRepositories([]);
      } finally {
        if (isMounted) setLoadingRepos(false);
      }
    };

    loadRepos();
    return () => {
      isMounted = false;
    };
  }, [projectId, archVersions]);

  // Load analyses when selectedRepoId changes
  useEffect(() => {
    let isMounted = true;
    if (!selectedRepoId) {
      setAnalyses([]);
      setAnalysisId("");
      return;
    }

    const loadAnalyses = async () => {
      try {
        setLoadingAnalyses(true);
        const analysisList = await getRepositoryAnalyses(projectId, selectedRepoId);
        if (!isMounted) return;
        const completed = analysisList.filter((a) => a.status === "completed");
        setAnalyses(completed);
        if (completed.length > 0) {
          setAnalysisId(completed[0].id);
        } else {
          setAnalysisId("");
        }
      } catch (err) {
        if (isMounted) {
          setAnalyses([]);
          setAnalysisId("");
        }
      } finally {
        if (isMounted) setLoadingAnalyses(false);
      }
    };

    loadAnalyses();
    return () => {
      isMounted = false;
    };
  }, [projectId, selectedRepoId]);

  // Auto-update title and reconcile mode when type changes
  const handleTypeSelect = (t: DocumentationType) => {
    setSelectedType(t);
    const label = getDocLabel(t);
    setTitle(`${label} Specification`);
    const rules = DOC_TYPE_SOURCE_RULES[t];
    if (!rules.allowedModes.includes(sourceMode)) {
      setSourceMode(rules.defaultMode);
    }
  };

  const currentRules = DOC_TYPE_SOURCE_RULES[selectedType];
  const requiresArch = sourceMode === "architecture" || sourceMode === "combined";
  const requiresRepo = sourceMode === "repository" || sourceMode === "combined";

  const hasValidArch = !requiresArch || (!!versionId && archVersions.some((v) => v.id === versionId));
  const hasValidRepo = !requiresRepo || (!!analysisId && analyses.some((a) => a.id === analysisId));
  const canGenerate = title.trim().length > 0 && hasValidArch && hasValidRepo && !submitting;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canGenerate) return;
    try {
      setSubmitting(true);
      const selectedAnalysis = analyses.find((a) => a.id === analysisId);
      const selectedRepo = repositories.find((r) => r.repository.id === selectedRepoId)?.repository;
      const branch =
        (selectedAnalysis?.analysis_data?.branch as string) ||
        selectedRepo?.default_branch ||
        null;

      const result = await generateDocumentation(projectId, {
        type: selectedType,
        title: title.trim(),
        format,
        source_mode: sourceMode,
        version_id: requiresArch ? versionId : null,
        repository_id: requiresRepo ? selectedRepoId : null,
        repository_analysis_id: requiresRepo ? analysisId : null,
        snapshot_branch: requiresRepo ? branch : null,
        custom_prompt: customPrompt.trim() || undefined,
        force_overwrite: forceOverwrite,
      });
      onGenerated(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to generate documentation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="surface-panel max-w-2xl w-full border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-panel/60">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Generate Software Documentation</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleGenerate} className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Active Project Banner */}
          <div className="flex items-center justify-between px-3 py-2 rounded bg-surface/50 border border-border text-xs">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground font-mono">Active Project:</span>
              <span className="font-semibold text-foreground">{projectName}</span>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">
              {archVersions.length} baseline(s) · {repositories.length} repo(s)
            </span>
          </div>

          {/* Document Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-muted-foreground">Select Documentation Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DOC_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = selectedType === t.key;
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => handleTypeSelect(t.key)}
                    className={`p-2.5 rounded border text-left transition-all text-xs flex items-start gap-2.5 ${
                      isSelected
                        ? "bg-primary/10 border-primary text-foreground shadow-sm"
                        : "border-border hover:bg-surface/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground">{t.label}</div>
                      <div className="text-[11px] text-muted-foreground leading-tight">{t.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source Mode Switcher (only shown when type supports multiple modes) */}
          {currentRules.allowedModes.length > 1 ? (
            <div className="space-y-2 p-3 rounded border border-border bg-panel/40">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono uppercase text-muted-foreground">Source Mode</label>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {currentRules.description}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentRules.allowedModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSourceMode(mode)}
                    className={`px-3 py-1.5 rounded border text-xs font-medium transition-colors ${
                      sourceMode === mode
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border hover:bg-surface text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "architecture"
                      ? selectedType === "database_documentation"
                        ? "Architecture (Intended Design)"
                        : "Architecture Baseline Only"
                      : mode === "repository"
                      ? selectedType === "database_documentation"
                        ? "Repository (Actual Schema & Models)"
                        : "Repository Implementation Only"
                      : "Combined (Architecture + Repository)"}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded border border-border/70 bg-surface/40 text-[11px] text-muted-foreground flex items-center justify-between font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" /> Source Mode: <strong>Repository Only</strong>
              </span>
              <span>{currentRules.description}</span>
            </div>
          )}

          {/* Dynamic Source Selectors */}
          <div className="space-y-4">
            {/* Architecture Baseline Selector (visible only when architecture is included) */}
            {requiresArch && (
              <div className="space-y-1.5 p-3 rounded border border-border/80 bg-surface/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase text-foreground font-medium flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 text-primary" />
                    <span>Architecture Baseline</span>
                    <span className="text-primary font-bold">*</span>
                  </label>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Required
                  </span>
                </div>

                {archVersions.length === 0 ? (
                  <div className="p-2.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">No Saved Architecture Versions</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Project &apos;{projectName}&apos; has no saved architecture versions. Create an architecture version first to generate this documentation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <select
                    value={versionId}
                    onChange={(e) => setVersionId(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono focus:outline-none focus:border-primary/50"
                  >
                    {archVersions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} (v{v.version_number}) — {v.status}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Repository Implementation Evidence Selector (visible only when repository is included) */}
            {requiresRepo && (
              <div className="space-y-2.5 p-3 rounded border border-border/80 bg-surface/30">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono uppercase text-foreground font-medium flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span>Repository Implementation Evidence</span>
                    <span className="text-primary font-bold">*</span>
                  </label>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Required
                  </span>
                </div>

                {loadingRepos ? (
                  <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading connected repositories…
                  </div>
                ) : repositories.length === 0 ? (
                  <div className="p-2.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">No Repositories Connected</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Project &apos;{projectName}&apos; has no connected repositories. Connect a repository and run an analysis scan to generate repository documentation.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground font-mono">Select Repository</label>
                      <select
                        value={selectedRepoId}
                        onChange={(e) => setSelectedRepoId(e.target.value)}
                        className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono focus:outline-none focus:border-primary/50"
                      >
                        {repositories.map((r) => (
                          <option key={r.repository.id} value={r.repository.id}>
                            {r.repository.repository_name} ({r.repository.default_branch})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-muted-foreground font-mono">Completed Analysis Snapshot</label>
                      {loadingAnalyses ? (
                        <div className="h-8 px-2 flex items-center text-xs text-muted-foreground border border-border rounded">
                          <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> Loading scans…
                        </div>
                      ) : analyses.length === 0 ? (
                        <div className="h-8 px-2 flex items-center text-[11px] text-amber-500 border border-amber-500/30 bg-amber-500/5 rounded font-mono truncate">
                          No completed scans for this repository
                        </div>
                      ) : (
                        <select
                          value={analysisId}
                          onChange={(e) => setAnalysisId(e.target.value)}
                          className="w-full h-8 px-2 rounded border border-border bg-background text-xs font-mono focus:outline-none focus:border-primary/50"
                        >
                          {analyses.map((a) => {
                            const branch = (a.analysis_data?.branch as string) || "main";
                            const sha = a.commit_sha ? a.commit_sha.slice(0, 7) : "snapshot";
                            const date = a.completed_at || a.created_at ? new Date(a.completed_at || a.created_at).toLocaleDateString() : "";
                            return (
                              <option key={a.id} value={a.id}>
                                {sha} ({branch}) — {date}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-muted-foreground">Document Title</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-8 px-3 rounded border border-border bg-background text-xs font-medium focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Output Format */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-muted-foreground">Output Format</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { key: "markdown", label: "Markdown" },
                { key: "html", label: "HTML" },
                { key: "mermaid", label: "Mermaid" },
                { key: "openapi_json", label: "OpenAPI JSON" },
                { key: "openapi_yaml", label: "OpenAPI YAML" },
              ].map((fmt) => (
                <button
                  type="button"
                  key={fmt.key}
                  onClick={() => setFormat(fmt.key as DocumentationFormat)}
                  className={`h-8 rounded border text-xs font-mono transition-colors ${
                    format === fmt.key
                      ? "bg-primary text-primary-foreground border-primary font-medium"
                      : "border-border hover:bg-surface text-muted-foreground"
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase text-muted-foreground">
              Custom Prompt or Specific Focus (Optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Focus on external payment gateway integrations, compliance requirements, or rate limiting policies..."
              rows={3}
              className="w-full p-2.5 rounded border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>

          {/* Force Overwrite Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              id="force_overwrite"
              checked={forceOverwrite}
              onChange={(e) => setForceOverwrite(e.target.checked)}
              className="rounded border-border text-primary focus:ring-0"
            />
            <label htmlFor="force_overwrite" className="text-muted-foreground">
              Replace existing document of the same type if one already exists
            </label>
          </div>

          {/* Validation Error Notices */}
          {!hasValidArch && requiresArch && (
            <p className="text-xs text-amber-500 font-mono">
              ⚠️ Cannot generate: A saved architecture baseline is required for {getDocLabel(selectedType)}.
            </p>
          )}
          {!hasValidRepo && requiresRepo && (
            <p className="text-xs text-amber-500 font-mono">
              ⚠️ Cannot generate: A completed repository analysis scan is required for {getDocLabel(selectedType)}.
            </p>
          )}

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!canGenerate}
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {submitting ? "Synthesizing Documentation…" : "Generate Document"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Markdown Renderer Component
function MarkdownRenderer({ content }: { content: string }) {
  // Parse content into sections or blocks
  const blocks = useMemo(() => {
    return parseMarkdownBlocks(content);
  }, [content]);

  return <div className="space-y-4 text-foreground/90 leading-relaxed text-sm">{blocks}</div>;
}

function parseMarkdownBlocks(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuffer: string[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCode) {
        // Close code
        const rawCode = codeBuffer.join("\n");
        nodes.push(
          <CodeBlockView key={`code-${i}`} lang={codeLang || "code"} code={rawCode} />
        );
        inCode = false;
        codeBuffer = [];
      } else {
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Tables
    if (line.includes("|") && line.trim().startsWith("|") && line.trim().endsWith("|")) {
      inTable = true;
      tableBuffer.push(line);
      continue;
    } else if (inTable) {
      nodes.push(<TableView key={`table-${i}`} rows={tableBuffer} />);
      inTable = false;
      tableBuffer = [];
    }

    // Headings
    if (line.startsWith("# ")) {
      const title = line.slice(2).replace(/\*\*/g, "");
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      nodes.push(
        <h1 key={`h1-${i}`} id={id} className="text-2xl font-display font-semibold tracking-tight text-foreground pt-4 pb-1 border-b border-border/40">
          {title}
        </h1>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      const title = line.slice(3).replace(/\*\*/g, "");
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      nodes.push(
        <h2 key={`h2-${i}`} id={id} className="text-lg font-display font-semibold tracking-tight text-foreground pt-4 flex items-center gap-2 group">
          <span>{title}</span>
          <a href={`#${id}`} className="text-muted-foreground opacity-0 group-hover:opacity-100 text-xs font-mono">#</a>
        </h2>
      );
      continue;
    }

    if (line.startsWith("### ")) {
      const title = line.slice(4).replace(/\*\*/g, "");
      const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      nodes.push(
        <h3 key={`h3-${i}`} id={id} className="text-sm font-semibold tracking-tight text-foreground pt-2">
          {title}
        </h3>
      );
      continue;
    }

    // Blockquotes
    if (line.startsWith("> ")) {
      const quote = line.slice(2);
      nodes.push(
        <div key={`bq-${i}`} className="border-l-2 border-primary/40 bg-surface/30 px-3 py-1.5 rounded-r text-xs text-muted-foreground font-mono">
          {renderInlineFormatting(quote)}
        </div>
      );
      continue;
    }

    // Lists
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const item = line.trim().slice(2);
      nodes.push(
        <div key={`li-${i}`} className="flex items-start gap-2 pl-2 text-sm text-muted-foreground">
          <span className="text-primary font-bold mt-1 text-xs">•</span>
          <span>{renderInlineFormatting(item)}</span>
        </div>
      );
      continue;
    }

    // Paragraph
    if (line.trim().length > 0) {
      nodes.push(
        <p key={`p-${i}`} className="text-sm text-muted-foreground leading-relaxed">
          {renderInlineFormatting(line)}
        </p>
      );
    }
  }

  if (inTable && tableBuffer.length > 0) {
    nodes.push(<TableView key="table-end" rows={tableBuffer} />);
  }

  return nodes;
}

function renderInlineFormatting(text: string): React.ReactNode {
  // Support bold **text** and inline `code`
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={key++} className="font-mono text-primary text-[11px] px-1 py-0.5 rounded bg-surface border border-border/60">{token.slice(1, -1)}</code>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

function TableView({ rows }: { rows: string[] }) {
  if (rows.length < 2) return null;
  const parseRow = (r: string) =>
    r
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());

  const headers = parseRow(rows[0]);
  const bodyRows = rows.slice(2).map(parseRow);

  return (
    <div className="rounded border border-border overflow-x-auto my-3">
      <table className="w-full text-xs font-mono">
        <thead className="bg-surface/70">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 border-b border-border font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {bodyRows.map((r, ri) => (
            <tr key={ri} className="hover:bg-surface/30">
              {r.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CodeBlockView({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded border border-border bg-panel/70 overflow-hidden my-3">
      <div className="h-8 px-3 flex items-center justify-between border-b border-border bg-surface/50">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span>copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre text-foreground/90">
        {code}
      </pre>
    </div>
  );
}
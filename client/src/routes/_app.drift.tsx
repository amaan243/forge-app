import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Radar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  Sparkles,
  Loader2,
  FolderOpen,
  ArrowRight,
  Info,
  RefreshCw,
  History,
  Filter,
  Search,
  FileCode,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Database,
  Layers,
  HelpCircle,
  Shield,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getArchitectureVersions,
  type ArchitectureVersion,
} from "@/api/architecture";
import {
  getRepositoryStatus,
  getRepositoryAnalyses,
  getDriftAnalyses,
  getDriftAnalysis,
  getDriftFinding,
  runDriftAnalysis,
  type DriftAnalysis,
  type DriftItem,
  type DriftScoreBreakdown,
  type RepositoryStatusResponse,
  type RepositoryAnalysis,
  type RepositoryRecord,
} from "@/api/repository";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/drift")({
  head: () => ({
    meta: [
      { title: "Architecture Drift — ArchForge" },
      { name: "description", content: "Detect drift between the generated architecture and the actual repository." },
    ],
  }),
  component: DriftPage,
});

function DriftPage() {
  const { currentProject } = useWorkspace();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Repositories, Versions and Snapshots
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [versions, setVersions] = useState<ArchitectureVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [repoStatus, setRepoStatus] = useState<RepositoryStatusResponse | null>(null);
  const [snapshots, setSnapshots] = useState<RepositoryAnalysis[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");

  // Drift Analysis & History
  const [driftHistory, setDriftHistory] = useState<DriftAnalysis[]>([]);
  const [selectedDriftId, setSelectedDriftId] = useState<string>("");
  const [activeDrift, setActiveDrift] = useState<(DriftAnalysis & { items?: DriftItem[] }) | null>(null);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Finding detail inspection state
  const [inspectingFindingId, setInspectingFindingId] = useState<string | null>(null);
  const [inspectingFinding, setInspectingFinding] = useState<DriftItem | null>(null);
  const [inspectingLoading, setInspectingLoading] = useState(false);

  const handleInspectFinding = async (findingId: string) => {
    if (!currentProject || !activeDrift?.id) return;
    setInspectingFindingId(findingId);
    setInspectingLoading(true);
    try {
      const data = await getDriftFinding(currentProject.id, activeDrift.id, findingId);
      setInspectingFinding(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || "Failed to load drift finding details");
    } finally {
      setInspectingLoading(false);
    }
  };

  // Project change reset & stale request cancellation
  useEffect(() => {
    // 1. Immediately wipe all state for previous project
    setVersions([]);
    setSelectedVersionId("");
    setRepositories([]);
    setSelectedRepoId("");
    setRepoStatus(null);
    setSnapshots([]);
    setSelectedSnapshotId("");
    setDriftHistory([]);
    setSelectedDriftId("");
    setActiveDrift(null);

    if (!currentProject) {
      setLoading(false);
      return;
    }

    let isCurrent = true;
    setLoading(true);

    const loadInitial = async () => {
      try {
        const [vers, status] = await Promise.all([
          getArchitectureVersions(currentProject.id),
          getRepositoryStatus(currentProject.id),
        ]);

        if (!isCurrent) return;

        setVersions(vers);
        const firstVersionId = vers.length > 0 ? vers[0].id : "";
        setSelectedVersionId(firstVersionId);

        setRepoStatus(status);
        const activeRepos = (status.repositories || []).filter((r) => r.status !== "disconnected");
        setRepositories(activeRepos);

        const primaryRepoId = status.repository?.id || activeRepos[0]?.id || "";
        setSelectedRepoId(primaryRepoId);

        if (primaryRepoId) {
          const [analysesList, drifts] = await Promise.all([
            getRepositoryAnalyses(currentProject.id, primaryRepoId),
            getDriftAnalyses(currentProject.id, primaryRepoId),
          ]);

          if (!isCurrent) return;

          const completedList = analysesList.filter((a) => a.status === "completed");
          setSnapshots(completedList);
          setSelectedSnapshotId(completedList.length > 0 ? completedList[0].id : "");

          setDriftHistory(drifts);
          if (drifts.length > 0) {
            setSelectedDriftId(drifts[0].id);
            const full = await getDriftAnalysis(currentProject.id, drifts[0].id);
            if (!isCurrent) return;
            setActiveDrift(full);
          } else {
            setActiveDrift(null);
            setSelectedDriftId("");
          }
        } else {
          setSnapshots([]);
          setSelectedSnapshotId("");
          setDriftHistory([]);
          setSelectedDriftId("");
          setActiveDrift(null);
        }
      } catch {
        // Handled by global interceptor
      } finally {
        if (isCurrent) {
          setLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      isCurrent = false;
    };
  }, [currentProject?.id]);

  // Handle architecture version change
  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    if (activeDrift && activeDrift.architecture_version_id !== versionId) {
      setActiveDrift(null);
    }
  };

  const handleRefresh = async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const [vers, status] = await Promise.all([
        getArchitectureVersions(currentProject.id),
        getRepositoryStatus(currentProject.id),
      ]);
      setVersions(vers);
      setRepoStatus(status);
      const activeRepos = (status.repositories || []).filter((r) => r.status !== "disconnected");
      setRepositories(activeRepos);
      const targetRepoId = selectedRepoId || status.repository?.id || activeRepos[0]?.id || "";
      if (targetRepoId) {
        const [analysesList, drifts] = await Promise.all([
          getRepositoryAnalyses(currentProject.id, targetRepoId),
          getDriftAnalyses(currentProject.id, targetRepoId),
        ]);
        const completedList = analysesList.filter((a) => a.status === "completed");
        setSnapshots(completedList);
        setDriftHistory(drifts);
      }
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  // Handle repository change
  const handleSelectRepository = async (repoId: string) => {
    if (!currentProject) return;
    setSelectedRepoId(repoId);
    setSelectedSnapshotId("");
    setActiveDrift(null);
    setLoading(true);
    try {
      const analysesList = await getRepositoryAnalyses(currentProject.id, repoId);
      const completedList = analysesList.filter((a) => a.status === "completed");
      setSnapshots(completedList);
      const nextSnapshotId = completedList.length > 0 ? completedList[0].id : "";
      setSelectedSnapshotId(nextSnapshotId);

      const drifts = await getDriftAnalyses(currentProject.id, repoId);
      setDriftHistory(drifts);
      if (drifts.length > 0) {
        setSelectedDriftId(drifts[0].id);
        const full = await getDriftAnalysis(currentProject.id, drifts[0].id);
        setActiveDrift(full);
      } else {
        setSelectedDriftId("");
        setActiveDrift(null);
      }
    } catch {
      toast.error("Failed to load snapshots for selected repository");
    } finally {
      setLoading(false);
    }
  };

  // Load selected historical drift analysis
  const handleSelectHistory = async (driftId: string) => {
    if (!currentProject) return;
    setSelectedDriftId(driftId);
    setLoading(true);
    try {
      const full = await getDriftAnalysis(currentProject.id, driftId);
      setActiveDrift(full);
      if (full.repository_id) {
        setSelectedRepoId(full.repository_id);
        const analysesList = await getRepositoryAnalyses(currentProject.id, full.repository_id);
        const completedList = analysesList.filter((a) => a.status === "completed");
        setSnapshots(completedList);
      }
      if (full.architecture_version_id) setSelectedVersionId(full.architecture_version_id);
      if (full.repository_analysis_id) setSelectedSnapshotId(full.repository_analysis_id);
    } catch {
      toast.error("Failed to load historical drift analysis");
    } finally {
      setLoading(false);
    }
  };

  const handleRunDrift = async () => {
    if (!currentProject) return;
    const effectiveSnapshotId = selectedSnapshotId || snapshots[0]?.id;
    if (!effectiveSnapshotId) {
      toast.error("Completed repository analysis snapshot required before running drift detection");
      return;
    }
    const effectiveVersionId = selectedVersionId || versions[0]?.id;
    if (!effectiveVersionId && versions.length === 0) {
      toast.error("Please create or save an architecture version first");
      return;
    }

    setAnalyzing(true);
    try {
      const result = await runDriftAnalysis(currentProject.id, {
        architecture_version_id: effectiveVersionId,
        repository_id: selectedRepoId || undefined,
        repository_analysis_id: effectiveSnapshotId,
      });
      setActiveDrift(result);
      setSelectedDriftId(result.id);
      setDriftHistory((prev) => [result, ...prev.filter((d) => d.id !== result.id)]);
      toast.success("Architecture drift analysis completed!");
    } catch {
      // Handled by client interceptor
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedRepository = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId) || repoStatus?.repository || null;
  }, [repositories, selectedRepoId, repoStatus]);

  const selectedVersion = useMemo(() => {
    return versions.find((v) => v.id === selectedVersionId) || versions[0] || null;
  }, [versions, selectedVersionId]);

  const selectedSnapshot = useMemo(() => {
    return snapshots.find((s) => s.id === selectedSnapshotId) || snapshots[0] || null;
  }, [snapshots, selectedSnapshotId]);

  const items = useMemo(() => {
    return activeDrift?.drift_items || activeDrift?.items || [];
  }, [activeDrift]);

  // Derived counts
  const categoryCounts = useMemo(() => {
    return {
      missing: items.filter((i) => i.type === "missing" || i.metadata?.findingType === "missing_component").length,
      extra: items.filter((i) => i.type === "extra" || i.metadata?.findingType === "extra_module").length,
      technology_mismatch: items.filter(
        (i) => i.metadata?.findingType === "technology_mismatch" || (i.type === "mismatch" && i.metadata?.category === "Technology")
      ).length,
      integration_mismatch: items.filter(
        (i) => i.metadata?.findingType === "integration_mismatch" || i.type === "integration_mismatch"
      ).length,
      uncertain_match: items.filter(
        (i) => i.metadata?.findingType === "uncertain_match" || i.type === "uncertain"
      ).length,
      coverage_limitation: items.filter(
        (i) => i.metadata?.findingType === "coverage_limitation" || i.type === "limitation"
      ).length,
    };
  }, [items]);

  const severityCounts = useMemo(() => {
    return {
      critical: items.filter((i) => i.severity === "critical").length,
      high: items.filter((i) => i.severity === "high").length,
      medium: items.filter((i) => i.severity === "medium").length,
      low: items.filter((i) => i.severity === "low").length,
    };
  }, [items]);

  // Filtered items list
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (categoryFilter !== "all") {
        if (categoryFilter === "missing" && item.type !== "missing" && item.metadata?.findingType !== "missing_component") return false;
        if (categoryFilter === "extra" && item.type !== "extra" && item.metadata?.findingType !== "extra_module") return false;
        if (categoryFilter === "technology_mismatch" && item.metadata?.findingType !== "technology_mismatch") return false;
        if (categoryFilter === "integration_mismatch" && item.metadata?.findingType !== "integration_mismatch" && item.type !== "integration_mismatch") return false;
        if (categoryFilter === "uncertain_match" && item.metadata?.findingType !== "uncertain_match" && item.type !== "uncertain") return false;
        if (categoryFilter === "coverage_limitation" && item.metadata?.findingType !== "coverage_limitation" && item.type !== "limitation") return false;
      }
      // Severity filter
      if (severityFilter !== "all" && item.severity !== severityFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const comp = (item.metadata?.affectedComponent || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        const rec = (item.recommendation || "").toLowerCase();
        const title = (item.metadata?.title || "").toLowerCase();
        if (!comp.includes(q) && !desc.includes(q) && !rec.includes(q) && !title.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, categoryFilter, severityFilter, searchQuery]);

  const score = activeDrift ? Number(activeDrift.match_score ?? 100) : 100;
  const isRepoAnalyzed = Boolean(snapshots.length > 0 || repoStatus?.latestAnalysis?.status === "completed");

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Architecture Drift</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to detect architecture drift.</p>
          <div className="pt-2 flex justify-center">
            <ProjectSwitcher variant="inline" />
          </div>
        </div>
      </div>
    );
  }

  if (loading && !activeDrift && !repoStatus) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading drift analysis intelligence...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Radar className="h-3.5 w-3.5" /> Architecture Drift Intelligence
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Generated vs Actual</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic comparison between saved architecture{" "}
            <span className="font-mono text-foreground">
              {selectedVersion ? `v${selectedVersion.version_number} (${selectedVersion.name})` : "none"}
            </span>{" "}
            and snapshot{" "}
            <span className="font-mono text-foreground">
              {selectedSnapshot ? `${selectedSnapshot.commit_sha?.substring(0, 7) || "latest"}` : "none"}
            </span>{" "}
            from{" "}
            <span className="font-mono text-foreground">
              {selectedRepository ? `${selectedRepository.owner}/${selectedRepository.repository_name}` : "unconnected"}
            </span>.
          </p>
        </div>

        {/* Action Controls & Selectors Hierarchy */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Project Selector */}
          <ProjectSwitcher variant="inline" />

          {/* Architecture Version Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Version:</span>
            <select
              value={selectedVersionId}
              onChange={(e) => handleSelectVersion(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-xs font-mono"
            >
              {versions.length > 0 ? (
                versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.version_number} · {v.name} ({v.status})
                  </option>
                ))
              ) : (
                <option value="">No versions</option>
              )}
            </select>
          </div>

          {/* Repository Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Repo:</span>
            <select
              value={selectedRepoId}
              onChange={(e) => handleSelectRepository(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-xs font-mono font-medium"
            >
              {repositories.length > 0 ? (
                repositories.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.owner}/{r.repository_name}
                  </option>
                ))
              ) : (
                <option value="">No repositories</option>
              )}
            </select>
          </div>

          {/* Repository Snapshot Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-muted-foreground">Snapshot:</span>
            <select
              value={selectedSnapshotId}
              onChange={(e) => setSelectedSnapshotId(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-xs font-mono"
            >
              {snapshots.length > 0 ? (
                snapshots.map((s) => (
                  <option key={s.id} value={s.id}>
                    sha:{s.commit_sha?.substring(0, 7) || "HEAD"} · {new Date(s.created_at).toLocaleDateString()}
                  </option>
                ))
              ) : (
                <option value="">No snapshots</option>
              )}
            </select>
          </div>

          <Button
            onClick={handleRunDrift}
            disabled={analyzing || !isRepoAnalyzed || versions.length === 0}
            size="sm"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Comparing...
              </>
            ) : (
              <>
                <GitBranch className="h-3.5 w-3.5 mr-1.5" /> Run Drift Analysis
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Refresh analysis data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Warning: Repository Not Analyzed */}
      {!isRepoAnalyzed && (
        <div className="surface-panel p-6 border-warning/30 bg-warning/5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-warning">Repository Analysis Required</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drift detection requires a completed repository snapshot. Connect your GitHub repository and trigger an analysis on the Repository page to compare architecture components with repository code.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/repository">Connect & Analyze Repository</Link>
          </Button>
        </div>
      )}

      {/* Warning: No Architecture Versions */}
      {versions.length === 0 && (
        <div className="surface-panel p-6 border-warning/30 bg-warning/5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-warning">No Architecture Version Found</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Create and save an architecture version first to establish the baseline for drift comparison.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/workspace">Open Architecture Workspace</Link>
          </Button>
        </div>
      )}

      {/* Results Section */}
      {activeDrift ? (
        <>
          {/* Top Score & Category Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <ScoreCard
              score={score}
              timestamp={activeDrift.created_at}
              status={activeDrift.status}
              hasFindings={items.length > 0}
              breakdown={activeDrift.counts?.scoreBreakdown}
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              <CategoryStatCard
                icon={AlertTriangle}
                tone="warning"
                label="Missing"
                value={categoryCounts.missing}
                active={categoryFilter === "missing"}
                onClick={() => setCategoryFilter(categoryFilter === "missing" ? "all" : "missing")}
              />
              <CategoryStatCard
                icon={XCircle}
                tone="destructive"
                label="Extra"
                value={categoryCounts.extra}
                active={categoryFilter === "extra"}
                onClick={() => setCategoryFilter(categoryFilter === "extra" ? "all" : "extra")}
              />
              <CategoryStatCard
                icon={Layers}
                tone="warning"
                label="Tech Mismatch"
                value={categoryCounts.technology_mismatch}
                active={categoryFilter === "technology_mismatch"}
                onClick={() => setCategoryFilter(categoryFilter === "technology_mismatch" ? "all" : "technology_mismatch")}
              />
              <CategoryStatCard
                icon={GitBranch}
                tone="warning"
                label="Integration"
                value={categoryCounts.integration_mismatch}
                active={categoryFilter === "integration_mismatch"}
                onClick={() => setCategoryFilter(categoryFilter === "integration_mismatch" ? "all" : "integration_mismatch")}
              />
              <CategoryStatCard
                icon={HelpCircle}
                tone="neutral"
                label="Uncertain"
                value={categoryCounts.uncertain_match}
                active={categoryFilter === "uncertain_match"}
                onClick={() => setCategoryFilter(categoryFilter === "uncertain_match" ? "all" : "uncertain_match")}
              />
              <CategoryStatCard
                icon={Info}
                tone="neutral"
                label="Limitations"
                value={categoryCounts.coverage_limitation}
                active={categoryFilter === "coverage_limitation"}
                onClick={() => setCategoryFilter(categoryFilter === "coverage_limitation" ? "all" : "coverage_limitation")}
              />
            </div>
          </div>

          {/* Severities Bar */}
          <div className="surface-panel p-3 flex items-center justify-between gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">Severity Breakdown:</span>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-destructive font-semibold">Critical: {severityCounts.critical}</span>
              <span className="text-warning font-semibold">High: {severityCounts.high}</span>
              <span className="text-foreground">Medium: {severityCounts.medium}</span>
              <span className="text-muted-foreground">Low: {severityCounts.low}</span>
            </div>
          </div>

          {/* Reconciliation Report & Filter Bar */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-display font-semibold">Reconciliation Findings</h2>
                <span className="text-xs text-muted-foreground font-mono">
                  ({filteredItems.length} of {items.length} shown)
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search findings..."
                    className="h-8 rounded border border-input bg-background pl-8 pr-3 text-xs w-44"
                  />
                </div>

                {/* Severity select */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="h-8 rounded border border-input bg-background px-2 text-xs font-mono"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>

                {/* Reset Filters */}
                {(categoryFilter !== "all" || severityFilter !== "all" || searchQuery) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => {
                      setCategoryFilter("all");
                      setSeverityFilter("all");
                      setSearchQuery("");
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>

            {/* Findings List */}
            {items.length > 0 ? (
              filteredItems.length > 0 ? (
                <div className="surface-panel divide-y divide-border">
                  {filteredItems.map((item, idx) => {
                    const itemId = item.id || `item-${idx}`;
                    const isExpanded = expandedItemId === itemId;
                    return (
                      <DriftItemRow
                        key={itemId}
                        item={item}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedItemId(isExpanded ? null : itemId)}
                        onInspect={() => handleInspectFinding(item.id || itemId)}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="surface-panel p-6 text-center text-xs text-muted-foreground">
                  No findings match current filters.
                </div>
              )
            ) : (
              /* Honest 0-findings state: explicit scope explanation */
              <div className="surface-panel p-8 text-center space-y-3">
                <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
                <h3 className="text-base font-semibold">No drift findings detected in the inspected scope</h3>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                  All {((selectedVersion as any)?.nodes?.length ?? (selectedVersion?.architecture_data?.nodes as any[])?.length) ?? 0} architecture components and declared technologies were verified against detected repository modules, dependencies, and frameworks.
                </p>
                <div className="text-[11px] font-mono text-muted-foreground/80 bg-surface/50 p-2.5 rounded max-w-md mx-auto">
                  Inspected static scope: {selectedSnapshot?.analysis_data?.filesAnalyzed ?? 0} files. Note: Static analysis verifies code structure and dependencies, not dynamic runtime behavior.
                </div>
              </div>
            )}
          </section>

          {/* Actionable Remediation Plan */}
          {items.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-display font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Remediation Recommendations
              </div>
              <div className="surface-panel p-4 space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-xs">
                    <span className="h-5 w-5 rounded border border-primary/40 bg-primary/10 text-primary grid place-items-center font-mono text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-0.5">
                      <div className="font-medium text-foreground">{item.recommendation}</div>
                      <div className="text-[11px] text-muted-foreground">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Drift Run History Section */}
          {driftHistory.length > 0 && (
            <section className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-display font-semibold">
                  <History className="h-4 w-4 text-muted-foreground" /> Drift Run History
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {driftHistory.length} recorded run(s)
                </span>
              </div>

              <div className="surface-panel divide-y divide-border">
                {driftHistory.map((h) => {
                  const isCurrent = h.id === activeDrift?.id;
                  return (
                    <div
                      key={h.id}
                      onClick={() => handleSelectHistory(h.id)}
                      className={`p-3 flex items-center justify-between gap-4 text-xs cursor-pointer transition-colors ${
                        isCurrent ? "bg-primary/5 font-medium" : "hover:bg-surface/50"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-foreground">
                            Score: {Number(h.match_score ?? 100)}%
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            · {new Date(h.created_at).toLocaleString()}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[10px] font-mono uppercase">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-xl">
                          {h.summary}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Status: {h.status}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      ) : (
        isRepoAnalyzed &&
        versions.length > 0 && (
          <div className="surface-panel p-8 text-center space-y-3">
            <Radar className="h-8 w-8 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-medium">Ready for Drift Detection</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Your repository snapshot and architecture version are ready. Click "Run Drift Analysis" above to compare repository code against architecture version v{selectedVersion?.version_number}.
            </p>
          </div>
        )
      )}

      {/* Drift Finding Detail Modal */}
      <Dialog
        open={Boolean(inspectingFindingId)}
        onOpenChange={(open) => {
          if (!open) {
            setInspectingFindingId(null);
            setInspectingFinding(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="h-5 w-5 text-primary" />
              <span>Drift Finding Evidence & Remediation</span>
            </DialogTitle>
            <DialogDescription>
              Detailed comparison evidence between repository code and architecture specification.
            </DialogDescription>
          </DialogHeader>

          {inspectingLoading ? (
            <div className="p-10 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading finding detail record…
            </div>
          ) : inspectingFinding ? (
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded border border-border bg-surface/50 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">Type: {inspectingFinding.type}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-primary/10 text-primary font-bold">
                    {inspectingFinding.severity}
                  </span>
                </div>
                <div className="font-semibold text-sm text-foreground">{inspectingFinding.description}</div>
              </div>

              {inspectingFinding.recommendation && (
                <div className="p-3 rounded border border-primary/30 bg-primary/5 space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                    Recommended Remediation:
                  </div>
                  <div className="text-xs text-foreground">{inspectingFinding.recommendation}</div>
                </div>
              )}

              {inspectingFinding.metadata?.evidence && inspectingFinding.metadata.evidence.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Direct Code Evidence:
                  </div>
                  <div className="p-3 rounded border border-border bg-background font-mono text-[11px] space-y-1">
                    {inspectingFinding.metadata.evidence.map((ev, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <span className="text-primary">•</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspectingFinding.metadata?.sourceFilePaths && inspectingFinding.metadata.sourceFilePaths.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Affected Source Files:
                  </div>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                    {inspectingFinding.metadata.sourceFilePaths.map((fp, i) => (
                      <span key={i} className="px-2 py-1 rounded border border-border bg-surface">
                        {fp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {inspectingFinding.metadata?.confidenceReason && (
                <div className="text-[11px] text-muted-foreground bg-surface/40 p-2.5 rounded border border-border/50">
                  <span className="font-semibold text-foreground">Confidence Rationale: </span>
                  {inspectingFinding.metadata.confidenceReason}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Finding details could not be loaded.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScoreCard({
  score,
  timestamp,
  status,
  hasFindings,
  breakdown,
}: {
  score: number;
  timestamp?: string;
  status: string;
  hasFindings: boolean;
  breakdown?: DriftScoreBreakdown;
}) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = c * (score / 100);

  const confidenceBadge = breakdown?.analysisConfidence === "high"
    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
    : breakdown?.analysisConfidence === "medium"
    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
    : "bg-muted text-muted-foreground border-border";

  return (
    <div className="surface-panel p-4 flex flex-col items-center justify-between">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Architecture Conformance
      </div>
      <div className="relative mt-2">
        <svg width="110" height="110" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth="6" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="6"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={c / 4}
            transform="rotate(-90 60 60)"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-3xl font-display font-semibold tabular-nums">{score}%</div>
            <div className="text-[10px] font-mono text-muted-foreground">
              {hasFindings ? "conformance" : "aligned"}
            </div>
          </div>
        </div>
      </div>

      {breakdown && (
        <div className="w-full mt-3 pt-3 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-muted-foreground">Scanner Confidence:</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase ${confidenceBadge}`}>
              {breakdown.analysisConfidence} ({breakdown.confidencePercentage}%)
            </span>
          </div>

          <div className="space-y-1.5 pt-1 text-[11px] font-mono">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Component (40%):</span>
              <span className="text-foreground font-semibold">
                {breakdown.componentCoverageScore}% ({breakdown.matchedComponents}/{breakdown.expectedComponents})
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Connection (25%):</span>
              <span className="text-foreground font-semibold">
                {breakdown.connectionCoverageScore}% ({breakdown.verifiedConnections}/{breakdown.expectedConnections})
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Tech Match (20%):</span>
              <span className="text-foreground font-semibold">{breakdown.technologyCompatibilityScore}%</span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Integration (15%):</span>
              <span className="text-foreground font-semibold">
                {breakdown.integrationCoverageScore}% ({breakdown.verifiedIntegrations}/{breakdown.expectedIntegrations})
              </span>
            </div>
            {breakdown.extraModulesCount > 0 && (
              <div className="flex justify-between items-center text-destructive">
                <span>Extra Modules ({breakdown.extraModulesCount}):</span>
                <span className="font-semibold">-{breakdown.extraModulesPenalty}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 text-center border-t border-border/30 pt-2 w-full">
        <div className="text-[10px] font-mono text-muted-foreground">
          Status: {status}
        </div>
        {timestamp && (
          <div className="text-[10px] font-mono text-muted-foreground/80">
            {new Date(timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryStatCard({
  icon: Icon,
  tone,
  label,
  value,
  active,
  onClick,
}: {
  icon: typeof Radar;
  tone: "warning" | "destructive" | "neutral";
  label: string;
  value: number;
  active?: boolean;
  onClick: () => void;
}) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <button
      onClick={onClick}
      className={`surface-panel p-3 text-left transition-all cursor-pointer ${
        active ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-muted-foreground truncate">
        <Icon className={"h-3 w-3 shrink-0 " + cls} />
        <span className="truncate">{label}</span>
      </div>
      <div className="text-xl font-display font-semibold tabular-nums mt-1">{value}</div>
    </button>
  );
}

function DriftItemRow({
  item,
  isExpanded,
  onToggle,
  onInspect,
}: {
  item: DriftItem;
  isExpanded: boolean;
  onToggle: () => void;
  onInspect?: () => void;
}) {
  const badgeMap: Record<string, { cls: string; label: string }> = {
    missing: { cls: "bg-warning/15 text-warning border-warning/30", label: "Missing" },
    extra: { cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Extra" },
    mismatch: { cls: "bg-warning/15 text-warning border-warning/30", label: "Mismatch" },
    uncertain: { cls: "bg-surface text-muted-foreground border-border", label: "Uncertain" },
    limitation: { cls: "bg-surface text-muted-foreground border-border", label: "Coverage" },
    coverage_limitation: { cls: "bg-surface text-muted-foreground border-border", label: "Coverage" },
    integration_mismatch: { cls: "bg-warning/15 text-warning border-warning/30", label: "Integration" },
  };

  const b = badgeMap[item.type] || badgeMap[item.metadata?.findingType || ""] || {
    cls: "bg-muted text-muted-foreground border-border",
    label: item.type,
  };

  const title = item.metadata?.title || item.metadata?.affectedComponent || item.description;

  return (
    <div className="p-3.5 space-y-2">
      <div
        onClick={onToggle}
        className="flex items-center justify-between gap-2 flex-wrap cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className={"px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase " + b.cls}>
            {b.label}
          </span>
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {item.metadata?.category && (
            <span className="text-[10px] font-mono uppercase text-muted-foreground">
              · {item.metadata.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-muted-foreground">Severity: {item.severity}</span>
          <span className="text-muted-foreground">· Confidence: {item.metadata?.confidence || "medium"}</span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground pl-6">{item.description}</div>

      {/* Expanded Evidence & Remediation Details */}
      {isExpanded && (
        <div className="pl-6 pt-1 space-y-2.5">
          {/* Transparent Confidence Reason */}
          {item.metadata?.confidenceReason && (
            <div className="text-[11px] text-muted-foreground/90 bg-surface/50 p-2.5 rounded border border-border/50">
              <span className="font-semibold text-foreground">Confidence basis:</span>{" "}
              {item.metadata.confidenceReason}
            </div>
          )}

          {/* Evidence List */}
          {item.metadata?.evidence && item.metadata.evidence.length > 0 && (
            <div className="text-[11px] font-mono text-muted-foreground bg-surface/60 p-2.5 rounded border border-border/60 space-y-1">
              <div className="font-semibold text-foreground text-[10px] uppercase tracking-wider">
                Supporting Evidence:
              </div>
              <ul className="list-disc list-inside space-y-0.5">
                {item.metadata.evidence.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Source File Paths */}
          {item.metadata?.sourceFilePaths && item.metadata.sourceFilePaths.length > 0 && (
            <div className="text-[11px] font-mono text-muted-foreground bg-surface/40 p-2 rounded flex items-center gap-1.5 flex-wrap">
              <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground">Source Files:</span>
              {item.metadata.sourceFilePaths.map((fp, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-foreground">
                  {fp}
                </span>
              ))}
            </div>
          )}

          {/* Related API Routes */}
          {item.metadata?.relatedApiRoutes && item.metadata.relatedApiRoutes.length > 0 && (
            <div className="text-[11px] font-mono text-muted-foreground bg-surface/40 p-2 rounded space-y-1">
              <span className="font-semibold text-foreground">Related Routes:</span>
              <div className="flex gap-1.5 flex-wrap">
                {item.metadata.relatedApiRoutes.map((rt, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-foreground">
                    {rt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Related Dependencies */}
          {item.metadata?.relatedDependencies && item.metadata.relatedDependencies.length > 0 && (
            <div className="text-[11px] font-mono text-muted-foreground bg-surface/40 p-2 rounded flex items-center gap-1.5 flex-wrap">
              <Database className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground">Dependencies:</span>
              {item.metadata.relatedDependencies.map((dp, i) => (
                <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-foreground">
                  {dp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommended Next Step & Inspect Action */}
      <div className="flex items-center justify-between pt-1 pl-6">
        <div className="text-xs text-primary font-medium flex items-center gap-1.5">
          <ArrowRight className="h-3 w-3 shrink-0" /> {item.recommendation}
        </div>
        {item.id && onInspect && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] font-mono gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
          >
            <Search className="h-3 w-3" />
            Inspect Finding
          </Button>
        )}
      </div>
    </div>
  );
}
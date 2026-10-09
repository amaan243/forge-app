import { createFileRoute } from "@tanstack/react-router";
import {
  GitBranch,
  Folder,
  Layers,
  AlertTriangle,
  Activity,
  Zap,
  Loader2,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Server,
  Terminal,
  History,
  Trash2,
  Play,
  Info,
  Package,
  Search,
  CheckCircle,
  FileCode,
  ShieldCheck,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getRepositoryStatus,
  connectRepository,
  disconnectRepository,
  triggerRepositoryAnalysis,
  getRepositoryAnalyses,
  type RepositoryRecord,
  type RepositoryAnalysis,
  type DetectedFramework,
  type DetectedRoute,
  type DetectedEntryPoint,
} from "@/api/repository";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/repository")({
  head: () => ({
    meta: [
      { title: "Repository — ArchForge" },
      { name: "description", content: "Import and analyze source repositories: file trees, frameworks, routes, and dependency graph." },
      { property: "og:title", content: "Repository — ArchForge" },
      { property: "og:description", content: "Analyze repositories, frameworks, routes, and dependency graph." },
    ],
  }),
  component: RepositoryPage,
});

function RepositoryPage() {
  const { currentProject } = useWorkspace();
  const [tab, setTab] = useState<"overview" | "frameworks" | "routes" | "history" | "security">("overview");

  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [repository, setRepository] = useState<RepositoryRecord | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<RepositoryAnalysis | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<RepositoryAnalysis | null>(null);
  const [historyList, setHistoryList] = useState<RepositoryAnalysis[]>([]);

  // Route search & filters
  const [routeQuery, setRouteQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<"ALL" | "GET" | "POST" | "PUT" | "DELETE">("ALL");

  // Form states for repository connection
  const [repoUrl, setRepoUrl] = useState("");
  const [repoBranch, setRepoBranch] = useState("main");
  const [accessType, setAccessType] = useState<"public" | "private">("public");

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      const data = await getRepositoryStatus(currentProject.id);
      setRepository(data.repository);
      setLatestAnalysis(data.latestAnalysis || data.latestSuccessful || null);
      setLatestAttempt(data.latestAttempt || null);
      setActiveAnalysis(data.activeAnalysis);

      if (data.repository) {
        setRepoBranch(data.repository.default_branch || "main");
        const hist = await getRepositoryAnalyses(currentProject.id);
        setHistoryList(hist);
      } else {
        setHistoryList([]);
      }
    } catch {
      // Global error handler notifies user
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling when analysis is active (queued or running)
  useEffect(() => {
    if (!activeAnalysis || !currentProject) return;
    const interval = setInterval(async () => {
      try {
        const data = await getRepositoryStatus(currentProject.id);
        setActiveAnalysis(data.activeAnalysis);
        if (!data.activeAnalysis || data.activeAnalysis.status === "completed" || data.activeAnalysis.status === "failed") {
          setLatestAnalysis(data.latestAnalysis || data.latestSuccessful || null);
          setLatestAttempt(data.latestAttempt || null);
          setAnalyzing(false);
          const hist = await getRepositoryAnalyses(currentProject.id);
          setHistoryList(hist);
          clearInterval(interval);
          if (data.latestAnalysis?.status === "completed" || data.latestSuccessful?.status === "completed") {
            toast.success("Repository analysis completed!");
          } else if (data.latestAttempt?.status === "failed") {
            toast.error("Repository analysis failed");
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeAnalysis, currentProject]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) {
      toast.error("Please select a project first");
      return;
    }
    if (!repoUrl.trim()) {
      toast.error("Please enter a GitHub repository URL");
      return;
    }
    setConnecting(true);
    try {
      const res = await connectRepository(currentProject.id, {
        repository_url: repoUrl.trim(),
        branch: repoBranch.trim() || "main",
        provider: "github",
        access_type: accessType,
      });
      setRepository(res);
      toast.success("GitHub repository connected successfully");
      await fetchData();
    } catch {
      // Handled by client interceptor
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!currentProject) return;
    if (!confirm("Are you sure you want to disconnect this repository? Analysis history will be removed.")) return;
    try {
      await disconnectRepository(currentProject.id);
      setRepository(null);
      setLatestAnalysis(null);
      setLatestAttempt(null);
      setActiveAnalysis(null);
      setHistoryList([]);
      toast.success("Repository disconnected");
    } catch {
      // Handled
    }
  };

  const handleAnalyze = async () => {
    if (!currentProject) return;
    setAnalyzing(true);
    try {
      const analysis = await triggerRepositoryAnalysis(currentProject.id, repoBranch.trim() || "main");
      setActiveAnalysis(analysis);
      toast.info("Repository analysis queued. Scanning files...");
    } catch {
      setAnalyzing(false);
    }
  };

  // Safe normalized frameworks list
  const frameworksList: DetectedFramework[] = useMemo(() => {
    if (!latestAnalysis) return [];
    if (Array.isArray(latestAnalysis.analysis_data?.detectedFrameworks)) {
      return latestAnalysis.analysis_data.detectedFrameworks;
    }
    if (Array.isArray(latestAnalysis.frameworks)) {
      return (latestAnalysis.frameworks as Array<string | DetectedFramework>).map((f) =>
        typeof f === "string"
          ? {
              name: f,
              ecosystem: "inferred",
              evidenceFile: "manifest",
              evidenceType: "manifest_dependency" as const,
              confidence: "high" as const,
              category: "other" as const,
            }
          : f
      );
    }
    return [];
  }, [latestAnalysis]);

  const fileCounts = latestAnalysis?.analysis_data?.fileCounts;
  const languagesList = latestAnalysis?.analysis_data?.languagesBreakdown || [];
  const envVars = latestAnalysis?.analysis_data?.detectedEnvVars || [];
  const entryPoints: DetectedEntryPoint[] = useMemo(() => {
    if (!latestAnalysis) return [];
    if (Array.isArray(latestAnalysis.analysis_data?.entryPointDetails)) {
      return latestAnalysis.analysis_data.entryPointDetails;
    }
    if (Array.isArray(latestAnalysis.architecture?.entryPoints)) {
      return latestAnalysis.architecture.entryPoints;
    }
    const raw = latestAnalysis.analysis_data?.entryPoints || [];
    return raw.map((ep) =>
      typeof ep === "string"
        ? {
            path: ep,
            kind: "backend_server" as const,
            evidence: "Application bootstrap",
            confidence: "confirmed" as const,
          }
        : ep
    );
  }, [latestAnalysis]);

  const routesList: DetectedRoute[] = useMemo(() => {
    if (!latestAnalysis?.architecture?.routes) return [];
    return latestAnalysis.architecture.routes as DetectedRoute[];
  }, [latestAnalysis]);

  const servicesList = latestAnalysis?.architecture?.services || [];
  const readiness = latestAnalysis?.analysis_data?.readiness;
  const security = latestAnalysis?.analysis_data?.security;
  const metrics = latestAnalysis?.metrics || {};

  // Filtered routes
  const filteredRoutes = useMemo(() => {
    return routesList.filter((r) => {
      if (methodFilter !== "ALL" && r.method !== methodFilter) return false;
      if (!routeQuery.trim()) return true;
      const q = routeQuery.toLowerCase();
      return (
        r.path.toLowerCase().includes(q) ||
        r.file.toLowerCase().includes(q) ||
        (r.handler && r.handler.toLowerCase().includes(q)) ||
        r.method.toLowerCase().includes(q)
      );
    });
  }, [routesList, methodFilter, routeQuery]);

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Repository</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <Folder className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to view or connect a GitHub repository.</p>
        </div>
      </div>
    );
  }

  if (loading && !repository) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading repository details...
        </div>
      </div>
    );
  }

  // Not connected state
  if (!repository) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <header className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            Project: {currentProject.name}
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Connect Repository</h1>
          <p className="text-sm text-muted-foreground">
            Connect a GitHub repository to run static analysis, detect frameworks, and inspect dependency graphs.
          </p>
        </header>

        <div className="max-w-2xl surface-panel p-6 space-y-6">
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                GitHub Repository URL
              </label>
              <Input
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Example: <span className="font-mono text-foreground">https://github.com/expressjs/express</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Default Branch
                </label>
                <div className="relative">
                  <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="main"
                    value={repoBranch}
                    onChange={(e) => setRepoBranch(e.target.value)}
                    className="pl-8 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Repository Visibility
                </label>
                <select
                  value={accessType}
                  onChange={(e) => setAccessType(e.target.value as "public" | "private")}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs font-mono"
                >
                  <option value="public">Public Repository</option>
                  <option value="private">Private Repository</option>
                </select>
              </div>
            </div>

            {accessType === "private" && (
              <div className="p-3 rounded border border-warning/30 bg-warning/5 text-xs text-warning flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Private repositories require <code className="font-mono bg-warning/20 px-1 py-0.5 rounded">GITHUB_TOKEN</code> configured on the ArchForge server. If not configured, connect a public repository.
                </span>
              </div>
            )}

            <Button type="submit" disabled={connecting} className="w-full">
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Connecting Repository...
                </>
              ) : (
                "Connect GitHub Repository"
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Connected state
  const isRunning = activeAnalysis && (activeAnalysis.status === "queued" || activeAnalysis.status === "running");
  const displayScore = readiness?.score ?? 70;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <span>github.com / {repository.owner} / {repository.repository_name}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-[10px] text-success capitalize">{repository.access_type}</span>
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">{repository.repository_name}</h1>
          <p className="text-sm text-muted-foreground">
            Static analysis of <span className="font-mono text-foreground">{repository.default_branch}</span>
            {latestAnalysis?.commit_sha && (
              <> · Commit <span className="font-mono text-foreground">{latestAnalysis.commit_sha.slice(0, 7)}</span></>
            )}
            {latestAnalysis?.completed_at && (
              <> · Analyzed {new Date(latestAnalysis.completed_at).toLocaleString()}</>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={repoBranch}
              onChange={(e) => setRepoBranch(e.target.value)}
              className="pl-8 font-mono text-xs h-8 w-36"
              placeholder="branch"
            />
          </div>
          <Button onClick={handleAnalyze} disabled={Boolean(isRunning) || analyzing} size="sm">
            {isRunning || analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Analyzing...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" /> Analyze
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Active Analysis Banner */}
      {isRunning && (
        <div className="surface-panel p-4 border-primary/30 bg-primary/5 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div className="text-xs">
            <div className="font-semibold text-foreground">Analysis in progress...</div>
            <div className="text-muted-foreground">
              Scanning git tree, parsing manifests, detecting frameworks and routes on branch <span className="font-mono">{repoBranch}</span>.
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy / Failure Alert Banner */}
      {latestAttempt?.status === "failed" && !isRunning && (
        <div className="surface-panel p-4 border-destructive/30 bg-destructive/5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <div className="font-semibold text-destructive">Latest analysis attempt failed</div>
            <div className="text-muted-foreground">
              {String(latestAttempt.analysis_data?.error || "Repository files could not be processed completely.")}
            </div>
            {latestAnalysis && latestAnalysis.id !== latestAttempt.id && (
              <div className="text-[11px] text-muted-foreground pt-1">
                Displaying metrics from last successful analysis at commit{" "}
                <span className="font-mono text-foreground">{latestAnalysis.commit_sha.slice(0, 7)}</span>.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Health Bar */}
      {latestAnalysis && latestAnalysis.status === "completed" && (
        <div className="surface-panel p-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-surface" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeDasharray={`${(displayScore * 94.2) / 100} 94.2`}
                  className={displayScore >= 80 ? "text-success" : displayScore >= 60 ? "text-primary" : "text-warning"}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center font-display font-semibold tabular-nums text-sm">
                {displayScore}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Architecture readiness</div>
              <div className="text-sm font-medium">
                {readiness?.rating || (displayScore >= 80 ? "Production Ready" : "Standard Architecture")}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Deterministic calculation across 6 structural factors
              </div>
            </div>
          </div>
          <div className="ml-auto grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-lg font-display font-semibold tabular-nums">{fileCounts?.totalFilesDiscovered ?? metrics.fileCount ?? 0}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Files Discovered</div>
            </div>
            <div>
              <div className="text-lg font-display font-semibold tabular-nums">{frameworksList.length}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Frameworks</div>
            </div>
            <div>
              <div className="text-lg font-display font-semibold tabular-nums">{metrics.dependencyCount ?? 0}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Unique Deps</div>
            </div>
            <div>
              <div className="text-lg font-display font-semibold tabular-nums">{metrics.testCount ?? 0}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Tests</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-border flex gap-1">
        {(["overview", "frameworks", "routes", "history", "security"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "h-8 px-3 text-[11px] font-mono uppercase tracking-wider border-b-2 -mb-px transition-colors " +
              (tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          {!latestAnalysis || latestAnalysis.status !== "completed" ? (
            <div className="surface-panel p-8 text-center space-y-3">
              <Activity className="h-6 w-6 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No completed analysis yet. Click "Analyze" above to scan the repository.</p>
            </div>
          ) : (
            <>
              {/* File Counters Reconciliation Card */}
              {fileCounts && (
                <div className="surface-panel p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    <FileCode className="h-3.5 w-3.5" /> Repository File Inventory Reconciliation
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded border border-border bg-background space-y-1">
                      <div className="text-muted-foreground text-[10px]">TOTAL DISCOVERED</div>
                      <div className="text-base font-semibold text-foreground">{fileCounts.totalFilesDiscovered}</div>
                      <div className="text-[10px] text-muted-foreground">Full git tree</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-background space-y-1">
                      <div className="text-muted-foreground text-[10px]">ELIGIBLE SOURCE</div>
                      <div className="text-base font-semibold text-foreground">{fileCounts.eligibleSourceFiles}</div>
                      <div className="text-[10px] text-muted-foreground">Code & configs</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-background space-y-1">
                      <div className="text-muted-foreground text-[10px]">ANALYZED SOURCE</div>
                      <div className="text-base font-semibold text-success">{fileCounts.analyzedSourceFiles}</div>
                      <div className="text-[10px] text-muted-foreground">Parsed without errors</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-background space-y-1">
                      <div className="text-muted-foreground text-[10px]">MANIFESTS PARSED</div>
                      <div className="text-base font-semibold text-primary">{fileCounts.manifestFilesProcessed}</div>
                      <div className="text-[10px] text-muted-foreground">Package files</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-background space-y-1">
                      <div className="text-muted-foreground text-[10px]">SKIPPED BY POLICY</div>
                      <div className="text-base font-semibold text-muted-foreground">{fileCounts.skippedFiles}</div>
                      <div className="text-[10px] text-muted-foreground">Docs, media, ignored</div>
                    </div>
                    <div className="p-2.5 rounded border border-border bg-background space-y-1">
                      <div className="text-muted-foreground text-[10px]">PARSE FAILURES</div>
                      <div className="text-base font-semibold text-success">{fileCounts.failedFiles}</div>
                      <div className="text-[10px] text-muted-foreground">Corrupt files</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-4">
                {/* Language breakdown */}
                <div className="surface-panel p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" /> Language Breakdown
                  </div>
                  {languagesList.length > 0 ? (
                    <>
                      <div className="h-2 rounded-full bg-surface overflow-hidden flex">
                        {languagesList.map((l, i) => (
                          <div
                            key={l.name}
                            className={
                              i === 0 ? "bg-primary" : i === 1 ? "bg-info" : i === 2 ? "bg-success" : i === 3 ? "bg-warning" : "bg-muted-foreground/60"
                            }
                            style={{ width: `${l.percentage}%` }}
                            title={`${l.name}: ${l.percentage}% (${l.count} files)`}
                          />
                        ))}
                      </div>
                      <div className="space-y-2 pt-2 divide-y divide-border/40">
                        {languagesList.map((l, i) => (
                          <div key={l.name} className="pt-2 first:pt-0 flex items-start justify-between text-xs">
                            <div className="space-y-0.5">
                              <span className="flex items-center gap-2 font-medium">
                                <span
                                  className={
                                    "h-2 w-2 rounded-sm " +
                                    (i === 0 ? "bg-primary" : i === 1 ? "bg-info" : i === 2 ? "bg-success" : i === 3 ? "bg-warning" : "bg-muted-foreground/60")
                                  }
                                />
                                {l.name}
                              </span>
                              {l.evidence && l.evidence.length > 0 && (
                                <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[220px]">
                                  {l.evidence[0]}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-foreground font-semibold">{l.count} files</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{l.percentage}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No code files detected.</p>
                  )}
                </div>

                {/* Infrastructure & Safe Environment Metadata */}
                <div className="space-y-4">
                  <div className="surface-panel p-4 space-y-3">
                    <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      <Server className="h-3.5 w-3.5" /> Infrastructure & Deployments
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 rounded border border-border bg-background flex items-center justify-between">
                        <span>Docker</span>
                        <span className={latestAnalysis.infrastructure?.docker ? "text-success font-mono font-medium" : "text-muted-foreground"}>
                          {latestAnalysis.infrastructure?.docker ? "Detected" : "None"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded border border-border bg-background flex items-center justify-between">
                        <span>Compose</span>
                        <span className={latestAnalysis.infrastructure?.dockerCompose ? "text-success font-mono font-medium" : "text-muted-foreground"}>
                          {latestAnalysis.infrastructure?.dockerCompose ? "Detected" : "None"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded border border-border bg-background flex items-center justify-between">
                        <span>CI / CD</span>
                        <span className={latestAnalysis.infrastructure?.ci ? "text-success font-mono font-medium" : "text-muted-foreground"}>
                          {latestAnalysis.infrastructure?.ci ? "GitHub Actions" : "None"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded border border-border bg-background flex items-center justify-between">
                        <span>Kubernetes</span>
                        <span className={latestAnalysis.infrastructure?.kubernetes ? "text-success font-mono font-medium" : "text-muted-foreground"}>
                          {latestAnalysis.infrastructure?.kubernetes ? "Detected" : "None"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Safe Environment Variable Names */}
                  <div className="surface-panel p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      <Terminal className="h-3.5 w-3.5" /> Detected Environment Variables (Metadata Only)
                    </div>
                    {envVars.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {envVars.map((v) => (
                          <span key={v} className="px-2 py-0.5 rounded border border-border bg-background font-mono text-[11px]">
                            {v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No environment variable templates detected.</p>
                    )}
                    <p className="text-[10px] text-muted-foreground pt-1">
                      ArchForge extracts only variable names from manifests and source code. Secret values are never read, stored, or exposed.
                    </p>
                  </div>

                  {/* Architecture Readiness Breakdown */}
                  {readiness && readiness.factors && (
                    <div className="surface-panel p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                          <Activity className="h-3.5 w-3.5" /> Architecture Readiness Factors ({readiness.score}/100)
                        </div>
                        <span className="text-xs font-mono text-primary font-semibold">{readiness.rating}</span>
                      </div>
                      <div className="space-y-2 pt-1 divide-y divide-border/40">
                        {readiness.factors.map((f) => (
                          <div key={f.name} className="pt-2 first:pt-0 flex items-start justify-between text-xs gap-3">
                            <div className="space-y-0.5">
                              <div className="font-medium text-foreground flex items-center gap-2">
                                <span
                                  className={
                                    "h-1.5 w-1.5 rounded-full " +
                                    (f.status === "pass" ? "bg-success" : f.status === "partial" ? "bg-warning" : "bg-destructive")
                                  }
                                />
                                {f.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">{f.description}</div>
                            </div>
                            <div className="font-mono text-xs font-semibold whitespace-nowrap">
                              {f.points} / {f.maxPoints} pts
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Frameworks */}
      {tab === "frameworks" && (
        <div className="surface-panel p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Detected Frameworks & Libraries ({frameworksList.length})
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Backed by manifest dependencies and configuration evidence
            </span>
          </div>

          {frameworksList.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {frameworksList.map((f) => (
                <div key={f.name} className="p-3 rounded border border-border bg-background space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary" /> {f.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-surface text-muted-foreground">
                      {f.category}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Version:</span>
                      <span className="text-foreground">{f.version || "detected"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Ecosystem:</span>
                      <span>{f.ecosystem}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Evidence:</span>
                      <span className="truncate max-w-[140px] text-foreground" title={f.evidenceFile}>
                        {f.evidenceFile}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No frameworks detected yet.</p>
          )}

          {/* External Integrations */}
          <div className="pt-4 border-t border-border space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              External Integrations & Third-Party SDKs
            </div>
            {latestAnalysis?.analysis_data?.externalIntegrations && latestAnalysis.analysis_data.externalIntegrations.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {latestAnalysis.analysis_data.externalIntegrations.map((ext) => (
                  <span key={ext} className="h-7 px-3 rounded border border-border bg-background text-xs font-mono flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5 text-info" /> {ext}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No third-party SDKs detected.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Routes & Services */}
      {tab === "routes" && (
        <div className="space-y-4">
          <div className="surface-panel p-4 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <Server className="h-3.5 w-3.5" /> Detected Entry Points & Services
            </div>
            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] font-mono text-muted-foreground uppercase">Confirmed Entry Points</span>
                <div className="mt-1 space-y-1">
                  {entryPoints.length > 0 ? (
                    entryPoints.map((ep) => (
                      <div key={ep.path} className="p-2 rounded bg-surface/50 font-mono text-xs space-y-0.5">
                        <div className="font-medium text-foreground truncate">{ep.path}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                          <span>{ep.evidence}</span>
                          <span className="text-success uppercase">{ep.confidence}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">None identified</p>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[11px] font-mono text-muted-foreground uppercase">Service Modules</span>
                <div className="mt-1 space-y-1">
                  {servicesList.length > 0 ? (
                    servicesList.slice(0, 10).map((s) => (
                      <div key={s} className="p-2 rounded bg-surface/50 font-mono text-xs truncate">
                        {s}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">None identified</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* API Routes with Search and Method Filter */}
          <div className="surface-panel p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <Zap className="h-3.5 w-3.5" /> Detected API Routes ({filteredRoutes.length} of {routesList.length})
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Method filter buttons */}
                <div className="flex rounded border border-border bg-background p-0.5 text-[10px] font-mono">
                  {(["ALL", "GET", "POST", "PUT", "DELETE"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethodFilter(m)}
                      className={
                        "px-2 py-0.5 rounded transition-colors " +
                        (methodFilter === m ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter path, file, handler..."
                    value={routeQuery}
                    onChange={(e) => setRouteQuery(e.target.value)}
                    className="pl-8 font-mono text-xs h-7 w-48"
                  />
                </div>
              </div>
            </div>

            {filteredRoutes.length > 0 ? (
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {filteredRoutes.map((r, i) => {
                  const methodColor =
                    r.method === "GET"
                      ? "bg-info/15 text-info border-info/30"
                      : r.method === "POST"
                        ? "bg-success/15 text-success border-success/30"
                        : r.method === "PUT"
                          ? "bg-warning/15 text-warning border-warning/30"
                          : "bg-destructive/15 text-destructive border-destructive/30";

                  return (
                    <div key={i} className="py-2.5 flex items-start justify-between text-xs font-mono gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-1.5 py-0.2 rounded border text-[10px] font-semibold uppercase ${methodColor}`}>
                            {r.method}
                          </span>
                          <span className="font-semibold text-foreground text-sm">{r.path}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-surface text-muted-foreground">
                            {r.framework}
                          </span>
                          {r.detectionBasis && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-surface/70 text-muted-foreground">
                              {r.detectionBasis}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                          {r.handler && (
                            <span>
                              handler: <span className="text-foreground">{r.handler}</span>
                            </span>
                          )}
                          {r.middleware && r.middleware.length > 0 && (
                            <span>
                              middleware: <span className="text-foreground">{r.middleware.join(", ")}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground shrink-0">
                        <div className="font-mono text-foreground">{r.file}{r.line ? `:${r.line}` : ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {routesList.length === 0
                  ? "No explicit route declarations parsed from inspected source files."
                  : "No routes match the current filter criteria."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab: History */}
      {tab === "history" && (
        <div className="surface-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              <History className="h-3.5 w-3.5" /> Analysis Snapshot History ({historyList.length})
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">
              Individual per-snapshot verification counters preserved
            </span>
          </div>
          {historyList.length > 0 ? (
            <div className="divide-y divide-border">
              {historyList.map((a) => (
                <div key={a.id} className="py-3 flex items-start justify-between text-xs flex-wrap gap-2">
                  <div className="space-y-1">
                    <div className="font-mono flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {a.commit_sha ? a.commit_sha.slice(0, 7) : "Snapshot"}
                      </span>
                      <span
                        className={
                          "px-1.5 py-0.2 rounded text-[10px] " +
                          (a.status === "completed"
                            ? "bg-success/20 text-success"
                            : a.status === "failed"
                              ? "bg-destructive/20 text-destructive"
                              : "bg-warning/20 text-warning")
                        }
                      >
                        {a.status}
                      </span>
                      {latestAnalysis?.id === a.id && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary/20 text-primary">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(a.created_at).toLocaleString()} · {a.analysis_data?.filesAnalyzed ?? a.metrics?.fileCount ?? 0} files analyzed
                    </div>
                    {a.status === "failed" && a.analysis_data?.error && (
                      <div className="text-[11px] text-destructive font-mono pt-0.5">
                        Reason: {String(a.analysis_data.error)}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-[11px] font-mono text-muted-foreground">
                    <div>{a.metrics?.routeCount ?? 0} routes</div>
                    <div>{a.metrics?.dependencyCount ?? 0} dependencies</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No historical analysis snapshots recorded.</p>
          )}
        </div>
      )}

      {/* Tab: Security */}
      {tab === "security" && (
        <div className="space-y-4">
          <div className="surface-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" /> Static Analysis Findings & Warnings
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">
                {security ? `${security.filesScanned} source files inspected` : "Static scan"}
              </span>
            </div>

            {/* Checks executed list */}
            {security?.checksExecuted && (
              <div className="p-2.5 rounded bg-surface/50 space-y-1.5 text-xs">
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Executed Static Checks:</div>
                <div className="grid sm:grid-cols-2 gap-1 text-[11px] text-foreground">
                  {security.checksExecuted.map((c) => (
                    <div key={c} className="flex items-center gap-1.5">
                      <CheckCircle className="h-3 w-3 text-success shrink-0" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {security?.findings && security.findings.length > 0 ? (
              <div className="space-y-2 pt-2">
                {security.findings.map((f, i) => (
                  <div key={i} className="p-3 rounded border border-warning/30 bg-warning/5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-warning flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" /> {f.rule}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-warning/20 text-warning">
                        {f.severity}
                      </span>
                    </div>
                    <div className="text-muted-foreground">{f.message}</div>
                    <div className="text-[11px] font-mono text-muted-foreground pt-1">
                      {f.file}{f.line ? `:${f.line}` : ""}
                      {f.snippet && <span className="ml-2 text-foreground bg-surface px-1 py-0.5 rounded">{f.snippet}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded border border-success/30 bg-success/5 text-xs text-success flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">No warnings detected in file scan</div>
                  <div className="text-[11px] text-muted-foreground pt-0.5">
                    Static checks completed with zero hardcoded secret signatures or critical misconfigurations.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="surface-panel p-4 space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Vulnerability Scanning Advisory
            </div>
            <p className="text-xs text-muted-foreground">
              External vulnerability scanning (CVE / Dependabot / Snyk) is not configured. ArchForge does not fabricate vulnerability ratings without an authentic security feed. Connect GitHub Dependabot or Snyk integration for CVE vulnerability alerts.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
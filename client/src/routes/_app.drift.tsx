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
  ShieldAlert,
  Info,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getArchitectureVersions,
  type ArchitectureVersion,
} from "@/api/architecture";
import {
  getRepositoryStatus,
  getDriftAnalyses,
  getDriftAnalysis,
  runDriftAnalysis,
  type DriftAnalysis,
  type DriftItem,
  type RepositoryStatusResponse,
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

  const [versions, setVersions] = useState<ArchitectureVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [repoStatus, setRepoStatus] = useState<RepositoryStatusResponse | null>(null);
  const [latestDrift, setLatestDrift] = useState<(DriftAnalysis & { items?: DriftItem[] }) | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentProject) return;
    setLoading(true);
    try {
      // 1. Fetch architecture versions
      const vers = await getArchitectureVersions(currentProject.id);
      setVersions(vers);
      if (vers.length > 0 && !selectedVersionId) {
        setSelectedVersionId(vers[0].id);
      }

      // 2. Fetch repository status
      const status = await getRepositoryStatus(currentProject.id);
      setRepoStatus(status);

      // 3. Fetch drift analyses
      const drifts = await getDriftAnalyses(currentProject.id);
      if (drifts.length > 0) {
        const full = await getDriftAnalysis(currentProject.id, drifts[0].id);
        setLatestDrift(full);
      } else {
        setLatestDrift(null);
      }
    } catch {
      // Handled by global client interceptor
    } finally {
      setLoading(false);
    }
  }, [currentProject, selectedVersionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunDrift = async () => {
    if (!currentProject) return;
    if (!repoStatus?.latestAnalysis || repoStatus.latestAnalysis.status !== "completed") {
      toast.error("Repository analysis required before running drift detection");
      return;
    }
    if (!selectedVersionId && versions.length === 0) {
      toast.error("Please create an architecture version first");
      return;
    }

    setAnalyzing(true);
    try {
      const result = await runDriftAnalysis(currentProject.id, {
        architecture_version_id: selectedVersionId || versions[0]?.id,
      });
      setLatestDrift(result);
      toast.success("Architecture drift analysis completed!");
    } catch {
      // Handled
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedVersion = useMemo(() => {
    return versions.find((v) => v.id === selectedVersionId) || versions[0] || null;
  }, [versions, selectedVersionId]);

  const items = useMemo(() => {
    return latestDrift?.drift_items || latestDrift?.items || [];
  }, [latestDrift]);

  const missingItems = useMemo(() => items.filter((i) => i.type === "missing"), [items]);
  const extraItems = useMemo(() => items.filter((i) => i.type === "extra"), [items]);
  const mismatchItems = useMemo(() => items.filter((i) => i.type === "mismatch"), [items]);

  // Derive matches count from total expected elements minus differences
  const score = latestDrift ? Number(latestDrift.match_score ?? 100) : 100;

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <h1 className="text-2xl font-display font-semibold tracking-tight">Architecture Drift</h1>
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-medium">No Project Selected</h2>
          <p className="text-sm text-muted-foreground">Select an active workspace project to detect architecture drift.</p>
        </div>
      </div>
    );
  }

  if (loading && !latestDrift && !repoStatus) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading drift analysis...
        </div>
      </div>
    );
  }

  // Repository not connected or not analyzed state
  const isRepoAnalyzed = repoStatus?.latestAnalysis?.status === "completed";

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Radar className="h-3.5 w-3.5" /> Drift detection
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Generated vs Actual</h1>
          <p className="text-sm text-muted-foreground">
            Reconciliation between saved architecture{" "}
            <span className="font-mono text-foreground">
              {selectedVersion ? `v${selectedVersion.version_number} (${selectedVersion.name})` : "none"}
            </span>{" "}
            and repository{" "}
            <span className="font-mono text-foreground">
              {repoStatus?.repository ? `${repoStatus.repository.owner}/${repoStatus.repository.repository_name}` : "unconnected"}
            </span>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Version Selector */}
          {versions.length > 0 && (
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="h-8 rounded border border-input bg-background px-2 text-xs font-mono"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_number} · {v.name} ({v.status})
                </option>
              ))}
            </select>
          )}

          <Button
            onClick={handleRunDrift}
            disabled={analyzing || !isRepoAnalyzed || versions.length === 0}
            size="sm"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Detecting Drift...
              </>
            ) : (
              <>
                <GitBranch className="h-3.5 w-3.5 mr-1.5" /> Run Drift Analysis
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Warning if repository not analyzed */}
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

      {/* Warning if no architecture versions */}
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

      {/* If drift analysis results exist */}
      {latestDrift ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
            <ScoreCard score={score} timestamp={latestDrift.created_at} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DriftStat icon={AlertTriangle} tone="warning" label="Missing" value={missingItems.length} />
              <DriftStat icon={XCircle} tone="destructive" label="Extra" value={extraItems.length} />
              <DriftStat icon={AlertTriangle} tone="warning" label="Mismatch" value={mismatchItems.length} />
              <DriftStat
                icon={CheckCircle2}
                tone="success"
                label="Compliance"
                value={`${score}%`}
              />
            </div>
          </div>

          {/* Reconciliation Report */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-display font-semibold">Reconciliation Report</h2>
              <span className="text-xs text-muted-foreground font-mono">
                {items.length} difference{items.length === 1 ? "" : "s"} detected
              </span>
            </div>

            {items.length > 0 ? (
              <div className="surface-panel divide-y divide-border">
                {items.map((item, idx) => (
                  <DriftItemRow key={item.id || idx} item={item} />
                ))}
              </div>
            ) : (
              <div className="surface-panel p-8 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-success mx-auto" />
                <h3 className="text-sm font-medium">100% Architecture Compliance</h3>
                <p className="text-xs text-muted-foreground">
                  All expected architecture components, services, and databases were confirmed in the repository.
                </p>
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
        </>
      ) : (
        isRepoAnalyzed &&
        versions.length > 0 && (
          <div className="surface-panel p-8 text-center space-y-3">
            <Radar className="h-8 w-8 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-medium">Ready for Drift Detection</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Your repository and architecture version are ready. Click "Run Drift Analysis" above to compare repository code against architecture version v{selectedVersion?.version_number}.
            </p>
          </div>
        )
      )}
    </div>
  );
}

function ScoreCard({ score, timestamp }: { score: number; timestamp?: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = c * (score / 100);

  return (
    <div className="surface-panel p-4 flex flex-col items-center justify-center">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Architecture Drift Score
      </div>
      <div className="relative mt-3">
        <svg width="120" height="120" viewBox="0 0 120 120">
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
            <div className="text-[10px] font-mono text-muted-foreground">match</div>
          </div>
        </div>
      </div>
      {timestamp && (
        <div className="mt-3 text-[11px] font-mono text-muted-foreground">
          Scan: {new Date(timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function DriftStat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof Radar;
  tone: "success" | "warning" | "destructive";
  label: string;
  value: number | string;
}) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="surface-panel p-3.5">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className={"h-3.5 w-3.5 " + cls} />
        {label}
      </div>
      <div className="text-2xl font-display font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function DriftItemRow({ item }: { item: DriftItem }) {
  const badgeMap = {
    missing: { cls: "bg-warning/15 text-warning border-warning/30", label: "Missing" },
    extra: { cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Extra" },
    mismatch: { cls: "bg-warning/15 text-warning border-warning/30", label: "Mismatch" },
  } as const;

  const b = badgeMap[item.type] || { cls: "bg-muted text-muted-foreground border-border", label: item.type };

  return (
    <div className="p-3.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={"px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase " + b.cls}>
            {b.label}
          </span>
          <span className="text-xs font-semibold text-foreground">
            {item.metadata?.affectedComponent || item.description}
          </span>
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

      <div className="text-xs text-muted-foreground">{item.description}</div>

      {item.metadata?.evidence && item.metadata.evidence.length > 0 && (
        <div className="text-[11px] font-mono text-muted-foreground/80 bg-surface/40 p-2 rounded">
          Evidence: {item.metadata.evidence.join(" · ")}
        </div>
      )}

      <div className="text-xs text-primary font-medium flex items-center gap-1.5 pt-0.5">
        <ArrowRight className="h-3 w-3 shrink-0" /> {item.recommendation}
      </div>
    </div>
  );
}
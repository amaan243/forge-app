import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  GitBranch,
  Sparkles,
  Loader2,
  ArrowRight,
  Info,
  RefreshCw,
  History,
  Filter,
  Search,
  FileCode,
  ChevronDown,
  ChevronRight,
  Database,
  Layers,
  HelpCircle,
  Workflow,
  FlaskConical,
  BookOpen,
  Copy,
  ExternalLink,
  Radar,
  Network,
  Share2,
  Trash2,
  Zap,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getArchitectureVersions,
  type ArchitectureVersion,
  type ArchitectureNode,
} from "@/api/architecture";
import {
  getRepositoryStatus,
  getRepositoryAnalyses,
  type RepositoryStatusResponse,
  type RepositoryAnalysis,
  type RepositoryRecord,
} from "@/api/repository";
import {
  analyzeImpact,
  getImpactReports,
  getImpactReport,
  deleteImpactReport,
  convertImpactToSimulation,
  type ImpactReport,
  type ImpactTargetEntityType,
  type ProposedChangeType,
  type ArchitectureCodeMappingState,
} from "@/api/impact";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/impact")({
  head: () => ({
    meta: [
      { title: "Engineering Impact Analysis — ArchForge" },
      {
        name: "description",
        content:
          "Audit direct and indirect blast radius across architecture, modules, APIs, database objects, tests, and documentation before shipping engineering changes.",
      },
    ],
  }),
  component: ImpactPage,
});

const PRESET_CHANGE_TEMPLATES: Array<{
  label: string;
  changeType: ProposedChangeType;
  entityType: ImpactTargetEntityType;
  description: string;
}> = [
  {
    label: "Modify API Contract / Response Model",
    changeType: "modify_api_contract",
    entityType: "api_route",
    description: "Update endpoint JSON payload schema and add deprecation headers for legacy clients",
  },
  {
    label: "Replace Database Technology / Migrate Store",
    changeType: "replace_database",
    entityType: "database_object",
    description: "Migrate relational data store to managed high-availability PostgreSQL with read replicas",
  },
  {
    label: "Deprecate / Remove Architecture Component",
    changeType: "remove_service",
    entityType: "architecture_component",
    description: "Decommission legacy microservice and evaluate severed caller connections",
  },
  {
    label: "Update Authentication & Trust Boundary",
    changeType: "change_auth",
    entityType: "architecture_component",
    description: "Transition from session cookies to stateless OAuth2/JWT verification tokens",
  },
  {
    label: "Introduce Distributed Caching Layer",
    changeType: "introduce_cache",
    entityType: "architecture_component",
    description: "Deploy Redis cluster in front of primary query endpoints to reduce database load",
  },
  {
    label: "Reroute Service Communication Connection",
    changeType: "change_connection",
    entityType: "architecture_connection",
    description: "Switch synchronous HTTP REST dependency to asynchronous event streaming",
  },
];

function ImpactPage() {
  const { currentProject } = useWorkspace();
  const navigate = useNavigate();

  // Loading & Action State
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Hierarchy Selectors State
  const [versions, setVersions] = useState<ArchitectureVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [snapshots, setSnapshots] = useState<RepositoryAnalysis[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");

  // Target Entity & Proposed Change Configuration State
  const [targetType, setTargetType] = useState<ImpactTargetEntityType>("architecture_component");
  const [targetId, setTargetId] = useState<string>("");
  const [targetName, setTargetName] = useState<string>("");
  const [changeType, setChangeType] = useState<ProposedChangeType>("modify_api_contract");
  const [changeDescription, setChangeDescription] = useState<string>("");

  // Analysis Reports & History
  const [reportsHistory, setReportsHistory] = useState<ImpactReport[]>([]);
  const [currentReport, setCurrentReport] = useState<ImpactReport | null>(null);

  // Results View Tabs & Filtering
  const [activeTab, setActiveTab] = useState<
    "topology" | "mapping" | "subsystems" | "risks" | "change_plan" | "integrations"
  >("topology");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);

  // Reset state whenever current project changes
  useEffect(() => {
    setVersions([]);
    setSelectedVersionId("");
    setRepositories([]);
    setSelectedRepoId("");
    setSnapshots([]);
    setSelectedSnapshotId("");
    setReportsHistory([]);
    setCurrentReport(null);
    setTargetId("");
    setTargetName("");
    setChangeDescription("");

    if (!currentProject) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadProjectContext() {
      setLoading(true);
      try {
        const [vers, statusRes, reports] = await Promise.all([
          getArchitectureVersions(currentProject!.id).catch(() => []),
          getRepositoryStatus(currentProject!.id).catch(() => null),
          getImpactReports(currentProject!.id).catch(() => []),
        ]);

        if (!isMounted) return;

        setVersions(vers);
        if (vers.length > 0) {
          const published = vers.find((v) => v.status === "published") || vers[0];
          setSelectedVersionId(published.id);
        }

        if (statusRes?.connected && statusRes.repositories?.length) {
          setRepositories(statusRes.repositories);
          const firstRepo = statusRes.repositories[0];
          setSelectedRepoId(firstRepo.id);

          const snps = await getRepositoryAnalyses(currentProject!.id, firstRepo.id).catch(() => []);
          if (isMounted) {
            setSnapshots(snps);
            const completed = snps.find((s) => s.status === "completed") || snps[0];
            if (completed) setSelectedSnapshotId(completed.id);
          }
        }

        setReportsHistory(reports);
        if (reports.length > 0) {
          setCurrentReport(reports[0]);
        }
      } catch (err: any) {
        toast.error("Failed to load project context: " + (err.message || "Unknown error"));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProjectContext();
    return () => {
      isMounted = false;
    };
  }, [currentProject?.id]);

  // Handle repository selection change
  const handleRepoChange = async (repoId: string) => {
    setSelectedRepoId(repoId);
    setSelectedSnapshotId("");
    if (!currentProject || !repoId) {
      setSnapshots([]);
      return;
    }

    try {
      const snps = await getRepositoryAnalyses(currentProject.id, repoId);
      setSnapshots(snps);
      const completed = snps.find((s) => s.status === "completed") || snps[0];
      if (completed) setSelectedSnapshotId(completed.id);
    } catch {
      setSnapshots([]);
    }
  };

  // Derive active version and nodes for target selection
  const activeVersion = useMemo(() => {
    return versions.find((v) => v.id === selectedVersionId);
  }, [versions, selectedVersionId]);

  const activeSnapshot = useMemo(() => {
    return snapshots.find((s) => s.id === selectedSnapshotId);
  }, [snapshots, selectedSnapshotId]);

  // Extract available targets based on targetType
  const availableTargets = useMemo(() => {
    if (!activeVersion) return [];

    const nodes = (activeVersion.architecture_data?.nodes as ArchitectureNode[]) || [];
    const archRoutes = ((activeSnapshot?.architecture as any)?.routes || []) as Array<{
      method: string;
      path: string;
      file?: string;
    }>;
    const archDatabases = ((activeSnapshot?.architecture as any)?.databases || []) as string[];
    const archIntegrations = ((activeSnapshot?.architecture as any)?.externalIntegrations || []) as string[];

    switch (targetType) {
      case "architecture_component":
        return nodes.map((n) => ({ id: n.id, name: n.name, subtext: `${n.type} • ${n.technology || "No tech"}` }));

      case "api_route":
        if (archRoutes.length > 0) {
          return archRoutes.map((r) => ({
            id: `${r.method}_${r.path}`,
            name: `${r.method} ${r.path}`,
            subtext: r.file || "Route Handler",
          }));
        }
        return [
          { id: "route_users", name: "GET /api/v1/users", subtext: "Inferred API Endpoint" },
          { id: "route_auth", name: "POST /api/v1/auth/login", subtext: "Inferred Authentication Route" },
          { id: "route_checkout", name: "POST /api/v1/checkout", subtext: "Inferred Payment Route" },
        ];

      case "database_object":
        const dbNodes = nodes.filter((n) => ["database", "storage", "cache"].includes(n.type));
        if (dbNodes.length > 0) {
          return dbNodes.map((n) => ({ id: n.id, name: n.name, subtext: n.technology || "Data Store" }));
        }
        if (archDatabases.length > 0) {
          return archDatabases.map((db) => ({ id: db, name: db, subtext: "Repository Detected Database" }));
        }
        return [{ id: "db_primary", name: "Primary Database", subtext: "Default Relational Store" }];

      case "external_integration":
        if (archIntegrations.length > 0) {
          return archIntegrations.map((i) => ({ id: i, name: i, subtext: "External SaaS Integration" }));
        }
        return [
          { id: "integ_stripe", name: "Stripe API", subtext: "Payment Gateway Integration" },
          { id: "integ_sendgrid", name: "SendGrid Email", subtext: "Transactional Mailer" },
        ];

      case "service_module":
        const services = ((activeSnapshot?.architecture as any)?.services || []) as string[];
        if (services.length > 0) {
          return services.map((s) => ({ id: s, name: s.split("/").pop() || s, subtext: s }));
        }
        return nodes.map((n) => ({ id: n.id, name: n.name, subtext: "Architecture Service Module" }));

      case "architecture_connection":
        const edges = (activeVersion.architecture_data?.edges as any[]) || [];
        return edges.map((e) => {
          const src = nodes.find((n) => n.id === e.source_node_id)?.name || e.source_node_id;
          const tgt = nodes.find((n) => n.id === e.target_node_id)?.name || e.target_node_id;
          return { id: e.id, name: `${src} -> ${tgt}`, subtext: e.relationship || "calls" };
        });

      default:
        return nodes.map((n) => ({ id: n.id, name: n.name, subtext: n.type }));
    }
  }, [activeVersion, activeSnapshot, targetType]);

  // Set default target when available targets change
  useEffect(() => {
    if (availableTargets.length > 0 && (!targetId || !availableTargets.some((t) => t.id === targetId))) {
      setTargetId(availableTargets[0].id);
      setTargetName(availableTargets[0].name);
    }
  }, [availableTargets, targetId]);

  // Apply template
  const applyTemplate = (tmpl: (typeof PRESET_CHANGE_TEMPLATES)[0]) => {
    setChangeType(tmpl.changeType);
    setTargetType(tmpl.entityType);
    setChangeDescription(tmpl.description);
    toast.success(`Loaded template: ${tmpl.label}`);
  };

  // Run Impact Analysis
  const handleAnalyze = async () => {
    if (!currentProject) return;
    if (!selectedVersionId) {
      toast.error("Please select an architecture version baseline");
      return;
    }
    if (!targetId || !targetName) {
      toast.error("Please select a target entity to analyze");
      return;
    }
    if (!changeDescription.trim()) {
      toast.error("Please provide a description of the proposed change");
      return;
    }

    setAnalyzing(true);
    try {
      const report = await analyzeImpact(currentProject.id, {
        architectureVersionId: selectedVersionId,
        repositoryId: selectedRepoId || undefined,
        repositoryAnalysisId: selectedSnapshotId || undefined,
        targetEntity: {
          type: targetType,
          id: targetId,
          name: targetName,
        },
        proposedChange: {
          changeType,
          description: changeDescription.trim(),
        },
      });

      setCurrentReport(report);
      setReportsHistory((prev) => [report, ...prev]);
      toast.success("Engineering impact analysis completed successfully!");
    } catch (err: any) {
      toast.error("Impact analysis failed: " + (err.message || "Unknown error"));
    } finally {
      setAnalyzing(false);
    }
  };

  // Bridge to Playground Simulation
  const handleSimulateInPlayground = async () => {
    if (!currentProject || !currentReport) return;
    setConverting(true);
    try {
      const simulation = await convertImpactToSimulation(currentProject.id, currentReport.id, {
        name: `Simulate: ${currentReport.targetEntity.name} (${currentReport.proposedChange.changeType})`,
        description: currentReport.proposedChange.description,
      });

      toast.success("Simulation instantiated in Engineering Playground!");
      navigate({ to: "/playground" });
    } catch (err: any) {
      toast.error("Failed to bridge simulation: " + (err.message || "Unknown error"));
    } finally {
      setConverting(false);
    }
  };

  // Delete historical report
  const handleDeleteReport = async (reportId: string) => {
    if (!currentProject) return;
    try {
      await deleteImpactReport(currentProject.id, reportId);
      setReportsHistory((prev) => prev.filter((r) => r.id !== reportId));
      if (currentReport?.id === reportId) {
        const remaining = reportsHistory.filter((r) => r.id !== reportId);
        setCurrentReport(remaining[0] || null);
      }
      toast.success("Impact report deleted");
    } catch (err: any) {
      toast.error("Failed to delete report: " + (err.message || "Unknown error"));
    }
  };

  // Copy Change Plan
  const handleCopyPlan = () => {
    if (!currentReport?.changePlan) return;
    const plan = currentReport.changePlan;
    const text = `# Engineering Change Plan: ${currentReport.targetEntity.name}
**Summary**: ${plan.summary}

## 1. Pre-Change Checks
${plan.preChangeChecks.map((c) => `- [ ] ${c}`).join("\n")}

## 2. Implementation Tasks
${plan.implementationTasks.map((t) => `${t.stepNumber}. **${t.title}** (${t.requirementLevel})\n   ${t.description}`).join("\n")}

## 3. Database Considerations
${plan.databaseConsiderations.map((d) => `- ${d}`).join("\n")}

## 4. API Compatibility Considerations
${plan.apiCompatibilityConsiderations.map((a) => `- ${a}`).join("\n")}

## 5. Tests to Update or Create
${plan.testsToUpdateOrCreate.map((t) => `- [${t.type.toUpperCase()}] ${t.description}`).join("\n")}

## 6. Verification Steps
${plan.verificationSteps.map((v) => `- [ ] ${v}`).join("\n")}

## 7. Rollback Considerations
${plan.rollbackConsiderations.map((r) => `- ${r}`).join("\n")}
`;
    navigator.clipboard.writeText(text);
    toast.success("Change plan copied to clipboard as markdown!");
  };

  // Severity styling helper
  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-destructive/15 text-destructive border-destructive/30";
      case "high":
        return "bg-warning/15 text-warning border-warning/30";
      case "medium":
        return "bg-amber-500/15 text-amber-500 border-amber-500/30";
      case "low":
        return "bg-success/15 text-success border-success/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getMappingBadgeClass = (state: ArchitectureCodeMappingState) => {
    switch (state) {
      case "verified":
        return "bg-success/15 text-success border-success/30";
      case "partial":
        return "bg-amber-500/15 text-amber-500 border-amber-500/30";
      case "uncertain":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30";
      case "unmapped_repository":
        return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <div className="surface-panel p-8 max-w-md text-center space-y-4">
          <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">No Project Selected</h2>
          <p className="text-xs text-muted-foreground">
            Please select an active project in the workspace to audit engineering impact and blast radius.
          </p>
          <ProjectSwitcher variant="inline" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-border pb-4">
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5" /> Engineering Impact Analysis Integration
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Audit Impact Before You Ship</h1>
          <p className="text-sm text-muted-foreground max-w-3xl">
            Evaluate blast radius across architecture components, repository code modules, APIs, database objects,
            tests, and documentation before committing changes. Runs deterministically with evidence verification.
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <ProjectSwitcher variant="inline" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="border border-border font-mono text-xs"
          >
            <History className="h-3.5 w-3.5 mr-1 text-primary" />
            History ({reportsHistory.length})
          </Button>

          {currentReport?.playgroundBridge?.supported && (
            <Button
              size="sm"
              variant="outline"
              disabled={converting}
              onClick={handleSimulateInPlayground}
              className="border-primary/50 text-primary hover:bg-primary/10 font-mono text-xs"
            >
              {converting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
              )}
              Simulate in Playground
            </Button>
          )}
        </div>
      </header>

      {/* Hierarchy & Context Selectors Bar */}
      <div className="surface-panel p-3.5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Baseline Version Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-primary" /> Architecture Version Baseline
          </label>
          <select
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version_number}: {v.name} ({v.status})
              </option>
            ))}
          </select>
          {activeVersion && (
            <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
              <span>{activeVersion.architecture_data?.nodes?.length || 0} components</span>
              <span>•</span>
              <span>{activeVersion.architecture_data?.edges?.length || 0} connections</span>
            </div>
          )}
        </div>

        {/* Repository & Snapshot Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitBranch className="h-3 w-3 text-primary" /> Repository Code Evidence Snapshot
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedRepoId}
              onChange={(e) => handleRepoChange(e.target.value)}
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— No Repo —</option>
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.repository_name}
                </option>
              ))}
            </select>
            <select
              value={selectedSnapshotId}
              onChange={(e) => setSelectedSnapshotId(e.target.value)}
              className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— Architecture Only —</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  Commit {s.commit_sha ? s.commit_sha.slice(0, 7) : "HEAD"} ({new Date(s.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          <div className="text-[10px] font-mono">
            {selectedSnapshotId ? (
              <span className="text-success flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 inline" /> Code correlation active
              </span>
            ) : (
              <span className="text-muted-foreground">Architecture-only simulation mode</span>
            )}
          </div>
        </div>

        {/* Stale Warning & Execution CTA */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Analysis Engine Status
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-surface text-primary border-border">
              {currentReport ? "Report Generated" : "Ready"}
            </span>
          </div>

          {currentReport?.sourceContext?.isSnapshotStale && (
            <div className="text-[11px] text-warning bg-warning/10 border border-warning/20 p-1.5 rounded flex items-center gap-1.5 mt-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Snapshot is older than latest commit.</span>
            </div>
          )}

          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzing || !selectedVersionId || !changeDescription}
            className="w-full mt-2 font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Evaluating Blast Radius...
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Audit Impact
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Column: Target Selector & Proposed Change Builder */}
        <aside className="space-y-4">
          {/* Preset Engineering Templates */}
          <div className="surface-panel p-3 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" /> Quick Change Scenarios
            </span>
            <div className="space-y-1.5">
              {PRESET_CHANGE_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  onClick={() => applyTemplate(tmpl)}
                  className="w-full text-left p-2 rounded border border-border/60 hover:border-primary/50 hover:bg-surface/80 transition-colors text-xs space-y-0.5"
                >
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-primary" /> {tmpl.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground pl-4.5">{tmpl.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Target & Change Form */}
          <div className="surface-panel p-4 space-y-3.5 text-xs">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <span className="font-mono font-semibold uppercase text-primary flex items-center gap-1.5">
                <Workflow className="h-3.5 w-3.5" /> Change Target & Scope
              </span>
            </div>

            {/* Target Type Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Target Entity Type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as ImpactTargetEntityType)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
              >
                <option value="architecture_component">Architecture Component</option>
                <option value="api_route">API Route / Controller</option>
                <option value="database_object">Database Table / Store</option>
                <option value="external_integration">External SaaS Integration</option>
                <option value="service_module">Service / Source Module</option>
                <option value="architecture_connection">Architecture Connection</option>
              </select>
            </div>

            {/* Target Entity Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Target Component / Object</label>
              <select
                value={targetId}
                onChange={(e) => {
                  const sel = availableTargets.find((t) => t.id === e.target.value);
                  setTargetId(e.target.value);
                  if (sel) setTargetName(sel.name);
                }}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
              >
                {availableTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.subtext})
                  </option>
                ))}
              </select>
            </div>

            {/* Proposed Change Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Proposed Change Operation</label>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value as ProposedChangeType)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
              >
                <option value="modify_api_contract">Modify API Contract / Response Model</option>
                <option value="replace_database">Replace Database Technology / Migrate Store</option>
                <option value="remove_service">Deprecate / Remove Architecture Component</option>
                <option value="change_auth">Update Authentication / Security Mechanism</option>
                <option value="introduce_cache">Introduce Caching Layer (e.g. Redis)</option>
                <option value="change_connection">Change Service Connection / Reroute</option>
                <option value="update_external_integration">Update / Switch External Integration</option>
                <option value="modify_schema">Modify Database Table / Schema</option>
                <option value="refactor_service">Internal Module Refactor</option>
                <option value="custom">Custom Engineering Change</option>
              </select>
            </div>

            {/* Change Description */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">
                Proposed Change Description
              </label>
              <textarea
                rows={3}
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
                placeholder="e.g. Update user profile payload to return UUID v4 and deprecate integer IDs"
                className="w-full bg-background border border-border rounded p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing || !selectedVersionId || !changeDescription}
              className="w-full font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Evaluating Blast Radius...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Audit Impact
                </>
              )}
            </Button>
          </div>
        </aside>

        {/* Right Column: Change Impact Explorer Results */}
        <main className="space-y-4">
          {!currentReport ? (
            <div className="surface-panel p-12 text-center space-y-4 border-dashed border-border">
              <ShieldAlert className="h-12 w-12 text-muted-foreground/60 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold">No Impact Report Generated Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Select a target component or code object, specify your proposed engineering change, and click "Audit
                  Impact" to evaluate blast radius and generate an actionable change plan.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Executive Impact Banner */}
              <div className="surface-panel p-4 space-y-3 border-l-4 border-primary">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Target Entity:
                      </span>
                      <span className="font-mono font-semibold text-foreground text-sm">
                        {currentReport.targetEntity.name}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border uppercase">
                        {currentReport.targetEntity.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{currentReport.proposedChange.description}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] font-mono uppercase text-muted-foreground">Overall Risk Level</div>
                      <span
                        className={
                          "inline-block text-xs font-mono font-bold uppercase px-2.5 py-1 rounded border mt-0.5 " +
                          getSeverityBadgeClass(currentReport.riskAssessment.overallSeverity)
                        }
                      >
                        {currentReport.riskAssessment.overallSeverity} RISK
                      </span>
                    </div>
                  </div>
                </div>

                {/* Blast Radius KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-border/60 text-xs font-mono">
                  <div className="p-2 rounded bg-background border border-border space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Directly Affected</div>
                    <div className="text-base font-bold text-foreground">
                      {currentReport.impactSummary.directlyAffected.length}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-background border border-border space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Downstream Nodes</div>
                    <div className="text-base font-bold text-foreground">
                      {currentReport.impactSummary.downstreamComponents.length}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-background border border-border space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Impacted Routes</div>
                    <div className="text-base font-bold text-foreground">
                      {currentReport.impactSummary.relatedApis.length}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-background border border-border space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Relevant Tests</div>
                    <div
                      className={
                        "text-base font-bold " +
                        (currentReport.impactSummary.relevantTests.length > 0 ? "text-success" : "text-warning")
                      }
                    >
                      {currentReport.impactSummary.relevantTests.length}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-background border border-border space-y-0.5">
                    <div className="text-[10px] text-muted-foreground uppercase">Docs to Update</div>
                    <div className="text-base font-bold text-primary">
                      {currentReport.impactSummary.docSectionsNeedingUpdate.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-border text-xs gap-4 font-mono overflow-x-auto">
                <button
                  onClick={() => setActiveTab("topology")}
                  className={
                    "pb-2 font-medium transition-colors whitespace-nowrap " +
                    (activeTab === "topology"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Blast Radius & Topology ({currentReport.dependencyGraph.nodes.length})
                </button>
                <button
                  onClick={() => setActiveTab("mapping")}
                  className={
                    "pb-2 font-medium transition-colors whitespace-nowrap " +
                    (activeTab === "mapping"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Architecture-to-Code Mapping ({currentReport.mappingSummary.verifiedCount} verified)
                </button>
                <button
                  onClick={() => setActiveTab("subsystems")}
                  className={
                    "pb-2 font-medium transition-colors whitespace-nowrap " +
                    (activeTab === "subsystems"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  APIs, Data Stores & Tests
                </button>
                <button
                  onClick={() => setActiveTab("risks")}
                  className={
                    "pb-2 font-medium transition-colors whitespace-nowrap " +
                    (activeTab === "risks"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Risk Classification ({currentReport.riskAssessment.findings.length})
                </button>
                <button
                  onClick={() => setActiveTab("change_plan")}
                  className={
                    "pb-2 font-medium transition-colors whitespace-nowrap " +
                    (activeTab === "change_plan"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  10-Step Change Plan
                </button>
                <button
                  onClick={() => setActiveTab("integrations")}
                  className={
                    "pb-2 font-medium transition-colors whitespace-nowrap " +
                    (activeTab === "integrations"
                      ? "border-b-2 border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Playground & Drift Bridges
                </button>
              </div>

              {/* Tab 1: Topology & Blast Radius */}
              {activeTab === "topology" && (
                <div className="space-y-4">
                  {/* Severed Connections Alert if present */}
                  {currentReport.impactSummary.brokenConnections.length > 0 && (
                    <div className="surface-panel p-3.5 border-destructive/40 bg-destructive/5 space-y-2">
                      <div className="flex items-center gap-2 text-destructive font-semibold text-xs font-mono">
                        <AlertTriangle className="h-4 w-4" /> Severed / Broken Connections Detected
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {currentReport.impactSummary.brokenConnections.map((bc, idx) => (
                          <div
                            key={idx}
                            className="p-2 rounded bg-background border border-destructive/20 flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold">{bc.source}</span>
                              <span className="text-muted-foreground font-mono mx-1.5">--[{bc.relationship}]--&gt;</span>
                              <span className="font-semibold">{bc.target}</span>
                            </div>
                            <span className="text-[11px] text-destructive">{bc.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upstream vs Downstream Columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    {/* Upstream Callers */}
                    <div className="surface-panel">
                      <div className="h-9 px-3 border-b border-border flex items-center justify-between bg-surface/50">
                        <span className="uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-primary rotate-180" /> Upstream Callers & Consumers
                        </span>
                        <span className="text-muted-foreground">
                          {currentReport.dependencyGraph.directUpstream.length} direct •{" "}
                          {currentReport.dependencyGraph.indirectUpstream.length} indirect
                        </span>
                      </div>
                      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                        {currentReport.dependencyGraph.directUpstream.length === 0 &&
                        currentReport.dependencyGraph.indirectUpstream.length === 0 ? (
                          <div className="text-muted-foreground py-4 text-center">
                            No upstream architecture callers detected.
                          </div>
                        ) : (
                          <>
                            {currentReport.dependencyGraph.directUpstream.map((name) => (
                              <div
                                key={name}
                                className="p-2 rounded border border-border bg-background flex items-center justify-between"
                              >
                                <span className="font-semibold">{name}</span>
                                <span className="text-[10px] text-primary px-1.5 py-0.5 rounded border border-primary/30">
                                  Direct (1-hop)
                                </span>
                              </div>
                            ))}
                            {currentReport.dependencyGraph.indirectUpstream.map((name) => (
                              <div
                                key={name}
                                className="p-2 rounded border border-border/60 bg-background/50 flex items-center justify-between text-muted-foreground"
                              >
                                <span>{name}</span>
                                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                                  Indirect (2+ hops)
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Downstream Dependencies */}
                    <div className="surface-panel">
                      <div className="h-9 px-3 border-b border-border flex items-center justify-between bg-surface/50">
                        <span className="uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-primary" /> Downstream Subsystems
                        </span>
                        <span className="text-muted-foreground">
                          {currentReport.dependencyGraph.directDownstream.length} direct •{" "}
                          {currentReport.dependencyGraph.indirectDownstream.length} indirect
                        </span>
                      </div>
                      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                        {currentReport.dependencyGraph.directDownstream.length === 0 &&
                        currentReport.dependencyGraph.indirectDownstream.length === 0 ? (
                          <div className="text-muted-foreground py-4 text-center">
                            No downstream components or data stores detected.
                          </div>
                        ) : (
                          <>
                            {currentReport.dependencyGraph.directDownstream.map((name) => (
                              <div
                                key={name}
                                className="p-2 rounded border border-border bg-background flex items-center justify-between"
                              >
                                <span className="font-semibold">{name}</span>
                                <span className="text-[10px] text-primary px-1.5 py-0.5 rounded border border-primary/30">
                                  Direct (1-hop)
                                </span>
                              </div>
                            ))}
                            {currentReport.dependencyGraph.indirectDownstream.map((name) => (
                              <div
                                key={name}
                                className="p-2 rounded border border-border/60 bg-background/50 flex items-center justify-between text-muted-foreground"
                              >
                                <span>{name}</span>
                                <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border">
                                  Indirect (2+ hops)
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Connected Graph Edges Table */}
                  <div className="surface-panel">
                    <div className="h-9 px-3 border-b border-border flex items-center justify-between text-xs font-mono">
                      <span className="uppercase text-muted-foreground font-semibold">
                        Architecture Relationship Connections ({currentReport.dependencyGraph.edges.length})
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5 text-xs font-mono max-h-60 overflow-y-auto">
                      {currentReport.dependencyGraph.edges.map((e) => {
                        const srcNode = currentReport.dependencyGraph.nodes.find((n) => n.id === e.source);
                        const tgtNode = currentReport.dependencyGraph.nodes.find((n) => n.id === e.target);
                        return (
                          <div
                            key={e.id}
                            className="p-2 rounded bg-background border border-border flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{srcNode?.name || e.source}</span>
                              <span className="text-muted-foreground">--[{e.relationship}]--&gt;</span>
                              <span className="font-semibold">{tgtNode?.name || e.target}</span>
                            </div>
                            <span
                              className={
                                "text-[10px] px-2 py-0.5 rounded border " +
                                (e.status === "verified"
                                  ? "bg-success/10 text-success border-success/30"
                                  : "bg-muted text-muted-foreground border-border")
                              }
                            >
                              {e.status.toUpperCase()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Architecture-to-Code Mapping */}
              {activeTab === "mapping" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-success/10 border border-success/30 text-success text-center">
                      <div className="text-[10px] uppercase">Verified</div>
                      <div className="text-base font-bold">{currentReport.mappingSummary.verifiedCount}</div>
                    </div>
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-500 text-center">
                      <div className="text-[10px] uppercase">Partial</div>
                      <div className="text-base font-bold">{currentReport.mappingSummary.partialCount}</div>
                    </div>
                    <div className="p-2 rounded bg-muted border border-border text-muted-foreground text-center">
                      <div className="text-[10px] uppercase">Unmapped Arch</div>
                      <div className="text-base font-bold">{currentReport.mappingSummary.unmappedArchCount}</div>
                    </div>
                    <div className="p-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-center">
                      <div className="text-[10px] uppercase">Unmapped Repo</div>
                      <div className="text-base font-bold">{currentReport.mappingSummary.unmappedRepoCount}</div>
                    </div>
                    <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 text-center">
                      <div className="text-[10px] uppercase">Uncertain</div>
                      <div className="text-base font-bold">{currentReport.mappingSummary.uncertainCount}</div>
                    </div>
                  </div>

                  <div className="surface-panel p-3 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2 text-xs font-mono">
                      <span className="uppercase text-muted-foreground font-semibold">
                        Component Implementation Evidence
                      </span>
                    </div>

                    <div className="space-y-2">
                      {currentReport.mappingSummary.mappings.map((m) => (
                        <div
                          key={m.componentName}
                          onClick={() => setSelectedMapping(selectedMapping === m.componentName ? null : m.componentName)}
                          className="p-3 rounded border border-border bg-background hover:border-primary/40 transition-colors cursor-pointer text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-foreground">{m.componentName}</span>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-border">
                                {m.componentType}
                              </span>
                            </div>
                            <span
                              className={
                                "text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-medium " +
                                getMappingBadgeClass(m.state)
                              }
                            >
                              {m.state.replace(/_/g, " ")}
                            </span>
                          </div>

                          <div className="text-[11px] text-muted-foreground">
                            {m.evidenceNotes.join(" • ")}
                          </div>

                          {selectedMapping === m.componentName && (
                            <div className="pt-2 border-t border-border/60 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono bg-surface/30 p-2 rounded">
                              <div>
                                <span className="text-muted-foreground uppercase text-[10px]">Matched Routes:</span>
                                {m.matchedRoutes.length === 0 ? (
                                  <div className="text-muted-foreground">None</div>
                                ) : (
                                  m.matchedRoutes.map((r, idx) => (
                                    <div key={idx} className="text-foreground">
                                      {r.method} {r.path} {r.file && `(${r.file})`}
                                    </div>
                                  ))
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground uppercase text-[10px]">Source Files:</span>
                                {m.matchedFiles.length === 0 ? (
                                  <div className="text-muted-foreground">None</div>
                                ) : (
                                  m.matchedFiles.map((f, idx) => (
                                    <div key={idx} className="text-foreground">
                                      {f}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Subsystems (APIs, Data Stores, Tests) */}
              {activeTab === "subsystems" && (
                <div className="space-y-4">
                  {/* Related APIs */}
                  <div className="surface-panel p-3 space-y-2 text-xs">
                    <div className="h-8 flex items-center justify-between border-b border-border pb-1 font-mono">
                      <span className="uppercase text-primary font-semibold flex items-center gap-1.5">
                        <FileCode className="h-3.5 w-3.5" /> Impacted API Endpoints & Routes (
                        {currentReport.impactSummary.relatedApis.length})
                      </span>
                    </div>
                    {currentReport.impactSummary.relatedApis.length === 0 ? (
                      <div className="text-muted-foreground py-2 text-center">No API routes directly impacted.</div>
                    ) : (
                      <div className="space-y-1 font-mono">
                        {currentReport.impactSummary.relatedApis.map((a) => (
                          <div
                            key={a.id}
                            className="p-2 rounded bg-background border border-border flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-foreground">{a.name}</span>
                              {a.evidence.sourceFiles?.[0] && (
                                <span className="text-muted-foreground text-[10px] ml-2">
                                  ({a.evidence.sourceFiles[0]})
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-primary px-1.5 py-0.5 rounded border border-primary/30">
                              {a.relationship}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Related Database Objects */}
                  <div className="surface-panel p-3 space-y-2 text-xs">
                    <div className="h-8 flex items-center justify-between border-b border-border pb-1 font-mono">
                      <span className="uppercase text-primary font-semibold flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5" /> Related Database Objects & Data Stores (
                        {currentReport.impactSummary.relatedDatabaseObjects.length})
                      </span>
                    </div>
                    {currentReport.impactSummary.relatedDatabaseObjects.length === 0 ? (
                      <div className="text-muted-foreground py-2 text-center">No data store dependencies within blast radius.</div>
                    ) : (
                      <div className="space-y-1 font-mono">
                        {currentReport.impactSummary.relatedDatabaseObjects.map((d) => (
                          <div
                            key={d.id}
                            className="p-2 rounded bg-background border border-border flex items-center justify-between"
                          >
                            <div>
                              <span className="font-semibold text-foreground">{d.name}</span>
                              <span className="text-[11px] text-muted-foreground block">{d.evidence.note}</span>
                            </div>
                            <span className="text-[10px] text-primary px-1.5 py-0.5 rounded border border-primary/30">
                              Data Store
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Discovered Tests */}
                  <div className="surface-panel p-3 space-y-2 text-xs">
                    <div className="h-8 flex items-center justify-between border-b border-border pb-1 font-mono">
                      <span className="uppercase text-primary font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Relevant Automated Tests (
                        {currentReport.impactSummary.relevantTests.length})
                      </span>
                    </div>
                    {currentReport.impactSummary.relevantTests.length === 0 ? (
                      <div className="p-3 rounded bg-warning/10 border border-warning/30 text-warning flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>No automated test files detected matching target. Regression coverage recommended.</span>
                      </div>
                    ) : (
                      <div className="space-y-1 font-mono">
                        {currentReport.impactSummary.relevantTests.map((t) => (
                          <div
                            key={t.id}
                            className="p-2 rounded bg-background border border-border flex items-center justify-between text-success"
                          >
                            <span>{t.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-success/30">
                              Passing Pattern
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Risk Classification */}
              {activeTab === "risks" && (
                <div className="space-y-3">
                  {currentReport.riskAssessment.findings.map((risk) => (
                    <div
                      key={risk.id}
                      className="surface-panel p-3.5 space-y-2 text-xs border-l-4 border-l-primary"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" /> {risk.title}
                        </div>
                        <span
                          className={
                            "text-[10px] font-mono uppercase px-2 py-0.5 rounded border font-bold " +
                            getSeverityBadgeClass(risk.severity)
                          }
                        >
                          {risk.severity} SEVERITY
                        </span>
                      </div>

                      <p className="text-muted-foreground">{risk.description}</p>

                      <div className="p-2.5 rounded bg-surface border border-border space-y-1 font-mono text-[11px]">
                        <div className="text-muted-foreground uppercase text-[10px]">Evidence & Rationale:</div>
                        <div className="text-foreground">{risk.rationale}</div>
                        <ul className="list-disc list-inside text-muted-foreground pl-1">
                          {risk.evidence.map((ev, idx) => (
                            <li key={idx}>{ev}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-[11px] text-primary flex items-center gap-1.5">
                        <span className="font-semibold uppercase text-[10px]">Mitigation:</span> {risk.mitigation}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 5: 10-Step Change Plan */}
              {activeTab === "change_plan" && (
                <div className="surface-panel p-4 space-y-4 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <span className="font-mono font-semibold uppercase text-primary text-sm">
                        Actionable Engineering Change Plan
                      </span>
                      <p className="text-muted-foreground text-xs mt-0.5">{currentReport.changePlan.summary}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={handleCopyPlan} className="font-mono text-xs">
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy Plan (MD)
                    </Button>
                  </div>

                  {/* Pre-Change Checks */}
                  <div className="space-y-1.5">
                    <span className="font-mono font-semibold uppercase text-muted-foreground text-[11px]">
                      1. Pre-Change Verification Checks
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      {currentReport.changePlan.preChangeChecks.map((chk, idx) => (
                        <div key={idx} className="p-2 rounded bg-background border border-border flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span>{chk}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Implementation Tasks */}
                  <div className="space-y-1.5">
                    <span className="font-mono font-semibold uppercase text-muted-foreground text-[11px]">
                      2. Implementation Tasks (Topological Order)
                    </span>
                    <div className="space-y-2">
                      {currentReport.changePlan.implementationTasks.map((task) => (
                        <div
                          key={task.stepNumber}
                          className="p-2.5 rounded bg-background border border-border flex items-start gap-3 text-xs"
                        >
                          <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            {task.stepNumber}
                          </span>
                          <div className="space-y-0.5 flex-1">
                            <div className="font-semibold text-foreground flex items-center justify-between">
                              <span>{task.title}</span>
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border border-border">
                                {task.requirementLevel}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-[11px]">{task.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Database Considerations */}
                  <div className="space-y-1.5">
                    <span className="font-mono font-semibold uppercase text-muted-foreground text-[11px]">
                      3. Database & Migration Considerations
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] font-mono bg-background p-2.5 rounded border border-border">
                      {currentReport.changePlan.databaseConsiderations.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* API Compatibility Considerations */}
                  <div className="space-y-1.5">
                    <span className="font-mono font-semibold uppercase text-muted-foreground text-[11px]">
                      4. API Compatibility & Deprecation
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] font-mono bg-background p-2.5 rounded border border-border">
                      {currentReport.changePlan.apiCompatibilityConsiderations.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Rollback Considerations */}
                  <div className="space-y-1.5">
                    <span className="font-mono font-semibold uppercase text-muted-foreground text-[11px]">
                      5. Rollback Runbook & Safety Toggles
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px] font-mono bg-background p-2.5 rounded border border-border">
                      {currentReport.changePlan.rollbackConsiderations.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Tab 6: Platform Integrations */}
              {activeTab === "integrations" && (
                <div className="space-y-4 text-xs font-mono">
                  {/* Engineering Playground Bridge */}
                  <div className="surface-panel p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-semibold uppercase text-primary flex items-center gap-1.5">
                        <FlaskConical className="h-4 w-4" /> Engineering Playground Simulation Bridge
                      </span>
                      <Button
                        size="sm"
                        disabled={converting}
                        onClick={handleSimulateInPlayground}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                      >
                        {converting ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <FlaskConical className="h-3.5 w-3.5 mr-1" />
                        )}
                        Simulate in Playground
                      </Button>
                    </div>

                    <p className="text-muted-foreground text-[11px]">
                      {currentReport.playgroundBridge.explanation}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                      <div className="p-2.5 rounded bg-background border border-border space-y-1">
                        <span className="text-success uppercase text-[10px] font-bold">Metrics Evaluable:</span>
                        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                          {currentReport.playgroundBridge.evaluableMetrics.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-2.5 rounded bg-background border border-border space-y-1">
                        <span className="text-warning uppercase text-[10px] font-bold">
                          Requires Production Observation:
                        </span>
                        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                          {currentReport.playgroundBridge.unevaluableMetrics.map((m, idx) => (
                            <li key={idx}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Architecture Drift Correlations */}
                  <div className="surface-panel p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-semibold uppercase text-primary flex items-center gap-1.5">
                        <Radar className="h-4 w-4" /> Architecture Drift Intelligence
                      </span>
                      <Link to="/drift">
                        <Button variant="ghost" size="sm" className="text-xs">
                          Inspect Drift Engine <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>

                    {currentReport.driftCorrelations.length === 0 ? (
                      <div className="text-success p-2 rounded bg-success/10 border border-success/30 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> No pre-existing architectural drift detected for this target.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {currentReport.driftCorrelations.map((dc, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded bg-warning/10 border border-warning/30 text-warning flex items-start justify-between"
                          >
                            <span>{dc.description}</span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-warning/40">
                              {dc.severity}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Documentation Links */}
                  <div className="surface-panel p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-semibold uppercase text-primary flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" /> Affected Project Documentation Sections
                      </span>
                      <Link to="/documentation">
                        <Button variant="ghost" size="sm" className="text-xs">
                          Open Documentation <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    </div>

                    <div className="space-y-1.5">
                      {currentReport.impactSummary.docSectionsNeedingUpdate.map((sec, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded bg-background border border-border flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-foreground">{sec.section}</span>
                            {sec.documentTitle && (
                              <span className="text-muted-foreground text-[10px] ml-2">
                                (Document: {sec.documentTitle})
                              </span>
                            )}
                          </div>
                          {sec.documentId ? (
                            <Link to="/documentation">
                              <span className="text-primary text-[10px] flex items-center gap-1 hover:underline">
                                View Document <ExternalLink className="h-2.5 w-2.5" />
                              </span>
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">Needs Generation</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* History Modal / Drawer */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="surface-panel p-6 max-w-xl w-full max-h-[80vh] flex flex-col space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-semibold text-sm flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Historical Impact Reports ({reportsHistory.length})
              </div>
              <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-2 overflow-y-auto flex-1 text-xs font-mono">
              {reportsHistory.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">No historical impact reports saved yet.</div>
              ) : (
                reportsHistory.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 rounded border border-border bg-background hover:border-primary/50 transition-colors flex items-center justify-between"
                  >
                    <div
                      className="cursor-pointer space-y-0.5 flex-1"
                      onClick={() => {
                        setCurrentReport(rep);
                        setHistoryOpen(false);
                      }}
                    >
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <span>{rep.targetEntity.name}</span>
                        <span
                          className={
                            "text-[10px] px-1.5 py-0.5 rounded border " +
                            getSeverityBadgeClass(rep.riskAssessment.overallSeverity)
                          }
                        >
                          {rep.riskAssessment.overallSeverity}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">
                        {rep.proposedChange.description}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(rep.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteReport(rep.id)}
                      className="text-muted-foreground hover:text-destructive ml-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

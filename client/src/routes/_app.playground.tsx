import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  FlaskConical,
  Plus,
  X,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RotateCcw,
  Check,
  Zap,
  Clock,
  DollarSign,
  GitBranch,
  Shield,
  FileText,
  Database as DBIcon,
  AlertTriangle,
  Loader2,
  FolderOpen,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  History,
  Layers,
  Network,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Cpu,
  Server,
  Workflow,
  Split,
  Eye,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getArchitectureVersions,
  getArchitectureVersion,
  type ArchitectureVersion,
  type ArchitectureNode,
  type ArchitectureEdge,
} from "@/api/architecture";
import {
  getRepositoryStatus,
  getRepositoryAnalyses,
  type RepositoryRecord,
  type RepositoryAnalysis,
} from "@/api/repository";
import {
  createSimulation,
  runSimulation,
  getSimulations,
  applySimulation,
  discardSimulation,
  createAlternativeSimulation,
  type PlaygroundSimulation,
  type SimulationChange,
  type SimulationChangeType,
  type SimulationMetricsRecord,
  type MetricValue,
  type BrokenConnection,
} from "@/api/playground";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/playground")({
  head: () => ({
    meta: [
      { title: "Engineering Playground — ArchForge" },
      {
        name: "description",
        content:
          "Deterministic architecture simulation engine: propose engineering changes, evaluate performance, cost, complexity, and security deltas, and preview impacts before shipping.",
      },
    ],
  }),
  component: PlaygroundPage,
});

const CHANGE_TYPES: Array<{
  value: SimulationChangeType;
  label: string;
  category: "component" | "connection" | "data" | "messaging" | "infra";
  description: string;
}> = [
  { value: "add_service", label: "Add Service / Component", category: "component", description: "Introduce a new microservice, backend, or worker component" },
  { value: "remove_service", label: "Remove Service / Component", category: "component", description: "Decommission an existing service and detect severed connections" },
  { value: "replace_technology", label: "Change Component Technology", category: "component", description: "Replace programming framework or runtime (e.g. Node to Go)" },
  { value: "add_connection", label: "Add Service Connection", category: "connection", description: "Create a new communication edge between two services" },
  { value: "remove_connection", label: "Remove Service Connection", category: "connection", description: "Sever an existing network connection between services" },
  { value: "change_database_technology", label: "Change Database Technology", category: "data", description: "Migrate database engine (e.g. PostgreSQL to MongoDB or MySQL)" },
  { value: "introduce_cache", label: "Introduce Caching Layer", category: "data", description: "Add in-memory cache (Redis/Memcached) in front of service or database" },
  { value: "introduce_queue", label: "Introduce Message Queue", category: "messaging", description: "Add asynchronous message broker (Kafka/RabbitMQ/SQS) for decoupling" },
  { value: "change_communication", label: "Change Sync to Async Communication", category: "messaging", description: "Convert synchronous RPC/HTTP calls to event-driven pub/sub" },
  { value: "add_external_integration", label: "Add External Integration", category: "infra", description: "Integrate third-party SaaS API (Stripe, Twilio, SendGrid, etc.)" },
  { value: "modify_scaling", label: "Modify Deployment / Scaling", category: "infra", description: "Adjust replica counts, horizontal autoscaling, or deployment mode" },
];

const PRESET_TEMPLATES: Array<{
  label: string;
  description: string;
  generateChanges: (nodes: ArchitectureNode[]) => SimulationChange[];
}> = [
  {
    label: "Add Redis Cache Layer",
    description: "In-memory read caching in front of primary data store or service",
    generateChanges: (nodes) => {
      const target = nodes.find((n) => n.type === "service" || n.type === "backend")?.name || nodes[0]?.name;
      return [
        {
          type: "introduce_cache",
          name: "Redis Cache Cluster",
          technology: "Redis 7.2",
          target,
          responsibility: "Read-through caching layer to reduce primary database query load",
        },
      ];
    },
  },
  {
    label: "Decouple via Kafka Event Bus",
    description: "Replace synchronous call chains with asynchronous event streaming",
    generateChanges: (nodes) => {
      const services = nodes.filter((n) => n.type === "service" || n.type === "backend" || n.type === "worker");
      const producer = services[0]?.name || "Backend";
      const consumer = services[1]?.name || "Worker";
      return [
        {
          type: "introduce_queue",
          name: "Kafka Event Stream",
          technology: "Apache Kafka",
          source: producer,
          target_component: consumer,
          responsibility: "Asynchronous pub/sub event pipeline to decouple request processing",
        },
      ];
    },
  },
  {
    label: "Migrate Database to Managed PostgreSQL",
    description: "Transition existing data store to high-availability PostgreSQL with replication",
    generateChanges: (nodes) => {
      const db = nodes.find((n) => n.type === "database")?.name || "Database";
      return [
        {
          type: "change_database_technology",
          target: db,
          technology: "PostgreSQL 16 HA",
          responsibility: "Multi-AZ managed relational database with read replicas",
        },
      ];
    },
  },
  {
    label: "Add Stripe Payment Gateway",
    description: "External payment processing integration with webhook callbacks",
    generateChanges: (nodes) => {
      const caller = nodes.find((n) => n.type === "service" || n.type === "backend")?.name || nodes[0]?.name;
      return [
        {
          type: "add_external_integration",
          name: "Stripe API Integration",
          technology: "Stripe REST API / Webhooks",
          target: caller,
          protocol: "HTTPS/REST",
          responsibility: "Third-party payment checkout, subscription billing, and webhooks",
        },
      ];
    },
  },
];

function PlaygroundPage() {
  const { currentProject } = useWorkspace();

  // Baseline architecture selection
  const [versions, setVersions] = useState<ArchitectureVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [baselineGraph, setBaselineGraph] = useState<{ nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Repository and snapshots selection
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [snapshots, setSnapshots] = useState<RepositoryAnalysis[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("");

  // Staged changes & Simulation form
  const [stagedChanges, setStagedChanges] = useState<SimulationChange[]>([]);
  const [simulationName, setSimulationName] = useState("Proposed Architecture Simulation");
  const [simulationDescription, setSimulationDescription] = useState("");

  // Builder form state
  const [selectedChangeType, setSelectedChangeType] = useState<SimulationChangeType>("add_service");
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formTargetComponent, setFormTargetComponent] = useState("");
  const [formTechnology, setFormTechnology] = useState("");
  const [formNodeType, setFormNodeType] = useState("service");
  const [formRelationship, setFormRelationship] = useState("calls");
  const [formProtocol, setFormProtocol] = useState("HTTP/REST");
  const [formResponsibility, setFormResponsibility] = useState("");

  // Simulation execution state
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentSimulation, setCurrentSimulation] = useState<PlaygroundSimulation | null>(null);

  // Simulation history
  const [simulationsHistory, setSimulationsHistory] = useState<PlaygroundSimulation[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Confirmation dialog for Apply (Create New Version)
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Inspection modal
  const [inspectMetric, setInspectMetric] = useState<{ title: string; rationale: string; details?: unknown } | null>(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"topology" | "impact" | "repository" | "remediation">("topology");

  // 1. Fetch versions & repos when project changes
  useEffect(() => {
    // Invalidate stale simulation results when project switches
    setVersions([]);
    setSelectedVersionId("");
    setBaselineGraph(null);
    setRepositories([]);
    setSelectedRepoId("");
    setSnapshots([]);
    setSelectedSnapshotId("");
    setStagedChanges([]);
    setCurrentSimulation(null);

    if (!currentProject) return;

    let isSubscribed = true;
    setLoadingVersions(true);

    const loadData = async () => {
      try {
        const [vList, repoStatus, analyses, simHistory] = await Promise.all([
          getArchitectureVersions(currentProject.id),
          getRepositoryStatus(currentProject.id).catch(() => ({ repository: null, repositories: [] })),
          getRepositoryAnalyses(currentProject.id).catch(() => []),
          getSimulations(currentProject.id).catch(() => []),
        ]);

        if (!isSubscribed) return;

        setVersions(vList);
        if (vList.length > 0) {
          // Select newest version by default
          setSelectedVersionId(vList[0].id);
        }

        const repoList = repoStatus.repositories || (repoStatus.repository ? [repoStatus.repository] : []);
        setRepositories(repoList);
        if (repoList.length > 0) {
          setSelectedRepoId(repoList[0].id);
        }

        const completedSnapshots = (analyses || []).filter((a) => a.status === "completed");
        setSnapshots(completedSnapshots);
        if (completedSnapshots.length > 0) {
          setSelectedSnapshotId(completedSnapshots[0].id);
        }

        setSimulationsHistory(simHistory || []);
      } catch (err) {
        console.error("Failed to load playground project data", err);
        toast.error("Failed to load project architecture versions");
      } finally {
        if (isSubscribed) setLoadingVersions(false);
      }
    };

    loadData();

    return () => {
      isSubscribed = false;
    };
  }, [currentProject?.id]);

  // 2. Fetch baseline graph when selected version changes
  useEffect(() => {
    if (!currentProject || !selectedVersionId) {
      setBaselineGraph(null);
      return;
    }

    let isSubscribed = true;
    const fetchVersionGraph = async () => {
      try {
        const graph = await getArchitectureVersion(currentProject.id, selectedVersionId);
        if (isSubscribed) {
          setBaselineGraph({ nodes: graph.nodes, edges: graph.edges });
          // Invalidate completed simulation when baseline version changes
          setCurrentSimulation(null);
        }
      } catch (err) {
        console.error("Failed to fetch baseline architecture graph", err);
      }
    };

    fetchVersionGraph();
    return () => {
      isSubscribed = false;
    };
  }, [currentProject?.id, selectedVersionId]);

  // Handle stage change from form
  const handleStageChange = () => {
    let newChange: SimulationChange;

    switch (selectedChangeType) {
      case "add_service":
      case "add_component":
        if (!formName.trim()) {
          toast.error("Component name is required");
          return;
        }
        newChange = {
          type: selectedChangeType,
          name: formName.trim(),
          node_type: formNodeType,
          technology: formTechnology.trim() || undefined,
          responsibility: formResponsibility.trim() || undefined,
          target_component: formTarget || undefined,
        };
        break;

      case "remove_service":
      case "remove_component":
        if (!formTarget) {
          toast.error("Select component to remove");
          return;
        }
        newChange = {
          type: selectedChangeType,
          target: formTarget,
          responsibility: `Remove ${formTarget} from active architecture topology`,
        };
        break;

      case "replace_technology":
      case "change_technology":
        if (!formTarget) {
          toast.error("Select target component");
          return;
        }
        if (!formTechnology.trim()) {
          toast.error("Specify new technology");
          return;
        }
        newChange = {
          type: selectedChangeType,
          target: formTarget,
          technology: formTechnology.trim(),
          responsibility: formResponsibility.trim() || `Migrate ${formTarget} to ${formTechnology.trim()}`,
        };
        break;

      case "change_database_technology":
        newChange = {
          type: selectedChangeType,
          target: formTarget || undefined,
          technology: formTechnology.trim() || "PostgreSQL",
          responsibility: formResponsibility.trim() || `Migrate database to ${formTechnology.trim() || "PostgreSQL"}`,
        };
        break;

      case "introduce_cache":
        newChange = {
          type: selectedChangeType,
          name: formName.trim() || `${formTechnology.trim() || "Redis"} Cache`,
          technology: formTechnology.trim() || "Redis",
          target: formTarget || undefined,
          responsibility: formResponsibility.trim() || "Read-through caching layer",
        };
        break;

      case "introduce_queue":
        newChange = {
          type: selectedChangeType,
          name: formName.trim() || `${formTechnology.trim() || "Kafka"} Event Bus`,
          technology: formTechnology.trim() || "Kafka",
          source: formSource || undefined,
          target_component: formTargetComponent || undefined,
          responsibility: formResponsibility.trim() || "Asynchronous event stream",
        };
        break;

      case "change_communication":
        if (!formSource || !formTargetComponent) {
          toast.error("Both source caller and target receiver are required");
          return;
        }
        newChange = {
          type: selectedChangeType,
          source: formSource,
          target_component: formTargetComponent,
          relationship: "publishes",
          protocol: formProtocol.trim() || "AMQP",
          responsibility: "Convert synchronous RPC/HTTP connection to asynchronous event publishing",
        };
        break;

      case "add_connection":
        if (!formSource || !formTargetComponent) {
          toast.error("Both source and target components are required");
          return;
        }
        newChange = {
          type: selectedChangeType,
          source: formSource,
          target_component: formTargetComponent,
          relationship: formRelationship,
          protocol: formProtocol.trim() || "HTTP/REST",
          responsibility: formResponsibility.trim() || `Connect ${formSource} -> ${formTargetComponent}`,
        };
        break;

      case "remove_connection":
        if (!formSource || !formTargetComponent) {
          toast.error("Select source and target of connection to remove");
          return;
        }
        newChange = {
          type: selectedChangeType,
          source: formSource,
          target_component: formTargetComponent,
          responsibility: `Sever communication edge between ${formSource} and ${formTargetComponent}`,
        };
        break;

      case "add_external_integration":
        if (!formName.trim()) {
          toast.error("External integration name is required");
          return;
        }
        newChange = {
          type: selectedChangeType,
          name: formName.trim(),
          technology: formTechnology.trim() || "Third-Party SaaS",
          target: formTarget || undefined,
          protocol: formProtocol.trim() || "HTTPS/REST",
          responsibility: formResponsibility.trim() || "Third-party external service integration",
        };
        break;

      case "modify_scaling":
        newChange = {
          type: selectedChangeType,
          target: formTarget || undefined,
          responsibility: "Adjust autoscaling parameters and compute capacity",
          details: { scaling: { minReplicas: 2, maxReplicas: 10, autoscaling: true } },
        };
        break;

      default:
        newChange = {
          type: selectedChangeType,
          name: formName || undefined,
          target: formTarget || undefined,
          technology: formTechnology || undefined,
          responsibility: formResponsibility || undefined,
        };
    }

    setStagedChanges((prev) => [...prev, newChange]);
    toast.success("Change staged for simulation");

    // Reset inputs
    setFormName("");
    setFormTechnology("");
    setFormResponsibility("");
  };

  // Run simulation against backend
  const handleRunSimulation = async () => {
    if (!currentProject || !selectedVersionId) {
      toast.error("Please select a project and baseline architecture version");
      return;
    }
    if (stagedChanges.length === 0) {
      toast.error("Stage at least one engineering change to simulate");
      return;
    }

    setIsSimulating(true);
    try {
      // 1. Create simulation record
      const draft = await createSimulation(currentProject.id, {
        base_version_id: selectedVersionId,
        repository_id: selectedRepoId || undefined,
        snapshot_id: selectedSnapshotId || undefined,
        name: simulationName || "Proposed Architecture Simulation",
        description: simulationDescription || undefined,
        proposed_changes: stagedChanges,
      });

      // 2. Execute deterministic simulation engine
      const completed = await runSimulation(currentProject.id, draft.id);
      setCurrentSimulation(completed);

      // Refresh history
      const updatedHistory = await getSimulations(currentProject.id).catch(() => []);
      setSimulationsHistory(updatedHistory);

      toast.success("Architecture simulation completed successfully");
    } catch (err: unknown) {
      console.error("Simulation failed", err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Simulation failed";
      toast.error(msg);
    } finally {
      setIsSimulating(false);
    }
  };

  // Apply changes to create a new architecture version
  const handleApplyChanges = async () => {
    if (!currentProject || !currentSimulation) return;
    setIsApplying(true);
    try {
      const newVersion = await applySimulation(currentProject.id, currentSimulation.id);
      toast.success(`New architecture version '${newVersion.name}' created successfully`);
      setApplyDialogOpen(false);

      // Refresh versions list and set new version as selected
      const updatedVersions = await getArchitectureVersions(currentProject.id);
      setVersions(updatedVersions);
      setSelectedVersionId(newVersion.id);

      // Refresh history
      const updatedHistory = await getSimulations(currentProject.id).catch(() => []);
      setSimulationsHistory(updatedHistory);
    } catch (err: unknown) {
      console.error("Failed to apply simulation", err);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to apply simulation";
      toast.error(msg);
    } finally {
      setIsApplying(false);
    }
  };

  // Discard simulation
  const handleDiscard = async () => {
    if (currentSimulation && currentProject) {
      try {
        await discardSimulation(currentProject.id, currentSimulation.id);
        const updatedHistory = await getSimulations(currentProject.id).catch(() => []);
        setSimulationsHistory(updatedHistory);
      } catch {
        // ignore
      }
    }
    setStagedChanges([]);
    setCurrentSimulation(null);
    toast.info("Simulation staged changes cleared");
  };

  // Alternative proposal
  const handleAlternative = async () => {
    if (!currentProject || !currentSimulation) return;
    try {
      const alt = await createAlternativeSimulation(currentProject.id, currentSimulation.id);
      setCurrentSimulation(alt);
      const updatedHistory = await getSimulations(currentProject.id).catch(() => []);
      setSimulationsHistory(updatedHistory);
      toast.success("Alternative simulation created as draft");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create alternative simulation");
    }
  };

  // Selected version details
  const activeVersion = useMemo(() => {
    return versions.find((v) => v.id === selectedVersionId);
  }, [versions, selectedVersionId]);

  // Selected repository details
  const activeRepo = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId);
  }, [repositories, selectedRepoId]);

  // Selected snapshot details
  const activeSnapshot = useMemo(() => {
    return snapshots.find((s) => s.id === selectedSnapshotId);
  }, [snapshots, selectedSnapshotId]);

  // Empty state: No project
  if (!currentProject) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <div className="surface-panel p-8 text-center space-y-4">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold">Select a Project to Simulate</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Choose an existing project from the workspace switcher above to load its architecture baseline and simulate proposed engineering changes.
          </p>
          <div className="pt-2 flex justify-center">
            <ProjectSwitcher />
          </div>
        </div>
      </div>
    );
  }

  // Empty state: Project has no architecture versions
  if (!loadingVersions && versions.length === 0) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-2">
              <FlaskConical className="h-3.5 w-3.5" /> Engineering playground
            </div>
            <h1 className="text-2xl font-display font-semibold tracking-tight">Simulate Architecture Changes</h1>
          </div>
          <ProjectSwitcher variant="inline" />
        </header>

        <div className="surface-panel p-10 text-center space-y-4 max-w-2xl mx-auto my-8">
          <div className="h-12 w-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">No Saved Architecture Version Found</h2>
          <p className="text-sm text-muted-foreground">
            Project <span className="font-semibold text-foreground">{currentProject.name}</span> does not have any saved architecture versions yet. A baseline architecture is required to perform deterministic impact simulations.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Button asChild>
              <Link to="/architecture">
                <Sparkles className="h-4 w-4 mr-1.5" /> Go to Architecture Designer
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const metrics = currentSimulation?.metrics as SimulationMetricsRecord | undefined;
  const impact = currentSimulation?.impact_analysis;
  const proposedNodes = (currentSimulation?.after_architecture?.nodes as ArchitectureNode[]) || baselineGraph?.nodes || [];
  const proposedEdges = (currentSimulation?.after_architecture?.edges as ArchitectureEdge[]) || baselineGraph?.edges || [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap border-b border-border pb-4">
        <div className="space-y-1.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5" /> Architecture Simulation Engine
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Simulate Before You Ship</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Evaluate proposed engineering changes against <span className="text-foreground font-medium">{currentProject.name}</span>'s saved architecture. Calculate deterministic performance, cost, complexity, and security deltas without mutating production state.
          </p>
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <ProjectSwitcher variant="inline" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHistoryOpen(!historyOpen)}
            className="border border-border"
          >
            <History className="h-3.5 w-3.5 mr-1" />
            History ({simulationsHistory.length})
          </Button>

          {currentSimulation && currentSimulation.status === "completed" && (
            <>
              <Button variant="outline" size="sm" onClick={handleAlternative}>
                <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" /> Alternative
              </Button>
              <Button
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setApplyDialogOpen(true)}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Create Version
              </Button>
            </>
          )}

          <Button variant="ghost" size="sm" onClick={handleDiscard}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>
      </header>

      {/* Baseline Context & Selectors Bar */}
      <div className="surface-panel p-3.5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Baseline Version Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-primary" /> Baseline Architecture Version
          </label>
          <div className="flex items-center gap-2">
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
          </div>
          {baselineGraph && (
            <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
              <span>{baselineGraph.nodes.length} nodes</span>
              <span>•</span>
              <span>{baselineGraph.edges.length} edges</span>
            </div>
          )}
        </div>

        {/* Repository & Snapshot Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <GitBranch className="h-3 w-3 text-primary" /> Repository Evidence Snapshot (Optional)
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedSnapshotId}
              onChange={(e) => setSelectedSnapshotId(e.target.value)}
              className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— None (Architecture-Only Mode) —</option>
              {snapshots.map((s) => (
                <option key={s.id} value={s.id}>
                  Commit {s.commit_sha ? s.commit_sha.slice(0, 7) : "HEAD"} ({new Date(s.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {selectedSnapshotId ? (
              <span className="text-success flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 inline" /> Code correlation active
              </span>
            ) : (
              <span>Architecture-only simulation</span>
            )}
          </div>
        </div>

        {/* Staged Changes & Execution CTA */}
        <div className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Simulation Status
            </span>
            <span
              className={
                "text-[10px] font-mono uppercase px-2 py-0.5 rounded border " +
                (currentSimulation?.status === "completed"
                  ? "bg-success/10 text-success border-success/30"
                  : currentSimulation?.status === "applied"
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted text-muted-foreground border-border")
              }
            >
              {currentSimulation?.status || "Draft"}
            </span>
          </div>

          <Button
            size="sm"
            onClick={handleRunSimulation}
            disabled={isSimulating || stagedChanges.length === 0}
            className="w-full mt-2 font-mono text-xs"
          >
            {isSimulating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Evaluating Simulation...
              </>
            ) : (
              <>
                <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
                Run Simulation ({stagedChanges.length} staged)
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Column: Change Builder & Staged Operations */}
        <aside className="space-y-4">
          {/* Preset Templates Dropdown */}
          <div className="surface-panel p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" /> Quick Engineering Templates
              </span>
            </div>
            <div className="space-y-1.5">
              {PRESET_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.label}
                  onClick={() => {
                    if (baselineGraph) {
                      const newOps = tmpl.generateChanges(baselineGraph.nodes);
                      setStagedChanges((prev) => [...prev, ...newOps]);
                      toast.success(`Staged template: ${tmpl.label}`);
                    }
                  }}
                  className="w-full text-left p-2 rounded border border-border/60 hover:border-primary/50 hover:bg-surface/80 transition-colors text-xs space-y-0.5"
                >
                  <div className="font-medium text-foreground flex items-center gap-1.5">
                    <Plus className="h-3 w-3 text-primary" /> {tmpl.label}
                  </div>
                  <div className="text-[11px] text-muted-foreground pl-4.5">{tmpl.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Staged Changes List */}
          <div className="surface-panel">
            <div className="h-9 px-3 border-b border-border flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Workflow className="h-3.5 w-3.5 text-primary" /> Staged Changes
              </span>
              <span className="text-[10px] font-mono bg-surface px-1.5 py-0.5 rounded border border-border">
                {stagedChanges.length}
              </span>
            </div>

            <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
              {stagedChanges.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground space-y-1">
                  <Sliders className="h-6 w-6 mx-auto opacity-40" />
                  <div className="text-xs font-mono">No changes staged yet.</div>
                  <div className="text-[11px]">Configure a change below or select a template.</div>
                </div>
              ) : (
                stagedChanges.map((change, idx) => {
                  const isAdd = change.type.startsWith("add_") || change.type.startsWith("introduce_");
                  const isRemove = change.type.startsWith("remove_");
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded border border-border bg-background/60 space-y-1 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            "h-2 w-2 rounded-full " +
                            (isAdd ? "bg-success" : isRemove ? "bg-destructive" : "bg-warning")
                          }
                        />
                        <span className="font-medium truncate">
                          {change.name || change.target || change.type.replace(/_/g, " ")}
                        </span>
                        <span className="ml-auto text-[9px] font-mono uppercase text-muted-foreground border border-border px-1 rounded">
                          {change.type.split("_")[0]}
                        </span>
                        <button
                          onClick={() => setStagedChanges(stagedChanges.filter((_, i) => i !== idx))}
                          className="text-muted-foreground hover:text-destructive p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      {change.technology && (
                        <div className="text-[10px] font-mono text-muted-foreground">
                          Tech: <span className="text-foreground">{change.technology}</span>
                        </div>
                      )}
                      {change.responsibility && (
                        <div className="text-[11px] text-muted-foreground line-clamp-1">
                          {change.responsibility}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Structured Change Builder Form */}
          <div className="surface-panel p-3.5 space-y-3">
            <div className="border-b border-border pb-2 flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5 text-primary" /> Propose New Change
              </span>
            </div>

            {/* Change Type Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Change Type</label>
              <select
                value={selectedChangeType}
                onChange={(e) => setSelectedChangeType(e.target.value as SimulationChangeType)}
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CHANGE_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Inputs based on change type */}
            {(selectedChangeType === "add_service" || selectedChangeType === "add_component") && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Component Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. NotificationWorker"
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Type</label>
                    <select
                      value={formNodeType}
                      onChange={(e) => setFormNodeType(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                    >
                      <option value="service">service</option>
                      <option value="worker">worker</option>
                      <option value="backend">backend</option>
                      <option value="gateway">gateway</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Technology</label>
                    <input
                      type="text"
                      value={formTechnology}
                      onChange={(e) => setFormTechnology(e.target.value)}
                      placeholder="e.g. Node.js, Go"
                      className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Connect To Existing Node</label>
                  <select
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                  >
                    <option value="">— None —</option>
                    {baselineGraph?.nodes.map((n) => (
                      <option key={n.id} value={n.name}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {(selectedChangeType === "remove_service" || selectedChangeType === "remove_component") && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase text-muted-foreground">Component to Remove</label>
                <select
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                >
                  <option value="">— Select component —</option>
                  {baselineGraph?.nodes.map((n) => (
                    <option key={n.id} value={n.name}>
                      {n.name} ({n.type})
                    </option>
                  ))}
                </select>
                <div className="text-[10px] text-destructive pt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Will cascade removal to all connected edges.
                </div>
              </div>
            )}

            {(selectedChangeType === "replace_technology" || selectedChangeType === "change_technology") && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Target Component</label>
                  <select
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  >
                    <option value="">— Select component —</option>
                    {baselineGraph?.nodes.map((n) => (
                      <option key={n.id} value={n.name}>
                        {n.name} ({n.technology || "No tech specified"})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">New Technology</label>
                  <input
                    type="text"
                    value={formTechnology}
                    onChange={(e) => setFormTechnology(e.target.value)}
                    placeholder="e.g. Go 1.22, Rust, FastAPI"
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </>
            )}

            {selectedChangeType === "change_database_technology" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Target Database</label>
                  <select
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  >
                    <option value="">— Default Primary DB —</option>
                    {baselineGraph?.nodes
                      .filter((n) => n.type === "database")
                      .map((n) => (
                        <option key={n.id} value={n.name}>
                          {n.name} ({n.technology || "DB"})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">New Database Technology</label>
                  <input
                    type="text"
                    value={formTechnology}
                    onChange={(e) => setFormTechnology(e.target.value)}
                    placeholder="e.g. MongoDB, PostgreSQL 16, DynamoDB"
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </>
            )}

            {selectedChangeType === "introduce_cache" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Service to Cache For</label>
                  <select
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  >
                    <option value="">— Auto-select primary backend —</option>
                    {baselineGraph?.nodes.map((n) => (
                      <option key={n.id} value={n.name}>
                        {n.name} ({n.type})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Cache Technology</label>
                  <input
                    type="text"
                    value={formTechnology}
                    onChange={(e) => setFormTechnology(e.target.value)}
                    placeholder="e.g. Redis, Memcached, Dragonfly"
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </>
            )}

            {selectedChangeType === "introduce_queue" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Producer</label>
                    <select
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                    >
                      <option value="">— Select —</option>
                      {baselineGraph?.nodes.map((n) => (
                        <option key={n.id} value={n.name}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Consumer</label>
                    <select
                      value={formTargetComponent}
                      onChange={(e) => setFormTargetComponent(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                    >
                      <option value="">— Select —</option>
                      {baselineGraph?.nodes.map((n) => (
                        <option key={n.id} value={n.name}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Broker Technology</label>
                  <input
                    type="text"
                    value={formTechnology}
                    onChange={(e) => setFormTechnology(e.target.value)}
                    placeholder="e.g. Kafka, RabbitMQ, AWS SQS"
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </>
            )}

            {(selectedChangeType === "add_connection" ||
              selectedChangeType === "remove_connection" ||
              selectedChangeType === "change_communication") && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Source</label>
                  <select
                    value={formSource}
                    onChange={(e) => setFormSource(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                  >
                    <option value="">— Select Source —</option>
                    {baselineGraph?.nodes.map((n) => (
                      <option key={n.id} value={n.name}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Target</label>
                  <select
                    value={formTargetComponent}
                    onChange={(e) => setFormTargetComponent(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono"
                  >
                    <option value="">— Select Target —</option>
                    {baselineGraph?.nodes.map((n) => (
                      <option key={n.id} value={n.name}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedChangeType === "add_external_integration" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Integration Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Stripe API, SendGrid, Twilio"
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Calling Component</label>
                  <select
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
                  >
                    <option value="">— Select Caller —</option>
                    {baselineGraph?.nodes.map((n) => (
                      <option key={n.id} value={n.name}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-muted-foreground">Engineering Rationale</label>
              <input
                type="text"
                value={formResponsibility}
                onChange={(e) => setFormResponsibility(e.target.value)}
                placeholder="Optional notes / architectural justification"
                className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs font-mono"
              />
            </div>

            <Button size="sm" variant="outline" className="w-full font-mono text-xs" onClick={handleStageChange}>
              <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Stage Change
            </Button>
          </div>
        </aside>

        {/* Right Column: Simulation Dashboard & Results */}
        <div className="space-y-6 min-w-0">
          {/* History Drawer if toggled */}
          {historyOpen && (
            <div className="surface-panel p-4 space-y-3 border-primary/30">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="text-xs font-mono uppercase tracking-wider font-semibold text-primary flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" /> Project Simulation History
                </span>
                <button onClick={() => setHistoryOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                {simulationsHistory.length === 0 ? (
                  <div className="text-xs font-mono text-muted-foreground py-3">No recorded simulations yet.</div>
                ) : (
                  simulationsHistory.map((sim) => (
                    <div
                      key={sim.id}
                      onClick={() => {
                        setCurrentSimulation(sim);
                        setStagedChanges(sim.proposed_changes || []);
                        setHistoryOpen(false);
                        toast.success(`Loaded simulation: ${sim.name}`);
                      }}
                      className="p-2.5 rounded border border-border hover:border-primary bg-background/50 cursor-pointer space-y-1 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate">{sim.name}</span>
                        <span className="text-[9px] font-mono uppercase px-1 rounded border border-border">
                          {sim.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                        <span>{new Date(sim.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{sim.proposed_changes?.length || 0} change(s)</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Not Simulated Yet State */}
          {!currentSimulation && (
            <div className="surface-panel p-8 text-center space-y-4">
              <FlaskConical className="h-10 w-10 text-primary mx-auto opacity-70" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold">Ready to Simulate Architecture Changes</h3>
                <p className="text-xs text-muted-foreground max-w-lg mx-auto">
                  {stagedChanges.length > 0
                    ? `You have ${stagedChanges.length} change(s) staged. Click 'Run Simulation' to execute the deterministic evaluation engine.`
                    : "Stage changes on the left or click one of the quick engineering templates to begin simulation."}
                </p>
              </div>
              {stagedChanges.length > 0 && (
                <Button size="sm" onClick={handleRunSimulation} disabled={isSimulating} className="font-mono text-xs">
                  {isSimulating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                  Execute Simulation Now
                </Button>
              )}
            </div>
          )}

          {/* Completed Simulation Dashboard */}
          {currentSimulation && metrics && (
            <div className="space-y-6">
              {/* Executive Summary Bar */}
              <div className="surface-panel p-4 flex items-center justify-between gap-4 flex-wrap border-l-4 border-l-primary">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{currentSimulation.name}</span>
                    <span
                      className={
                        "text-[10px] font-mono uppercase px-2 py-0.5 rounded border " +
                        (metrics.overallRisk === "high"
                          ? "bg-destructive/10 text-destructive border-destructive/30"
                          : metrics.overallRisk === "medium"
                            ? "bg-warning/10 text-warning border-warning/30"
                            : "bg-success/10 text-success border-success/30")
                      }
                    >
                      Overall Risk: {metrics.overallRisk}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground border border-border px-1.5 py-0.5 rounded">
                      Confidence: {metrics.evaluationConfidence}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Evaluated against baseline version{" "}
                    <span className="font-mono font-medium text-foreground">
                      {activeVersion ? `v${activeVersion.version_number} (${activeVersion.name})` : "Baseline"}
                    </span>
                    {activeSnapshot && (
                      <span className="ml-2 text-success">
                        • Correlated with repo commit {activeSnapshot.commit_sha?.slice(0, 7)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground font-mono text-xs"
                    onClick={() => setApplyDialogOpen(true)}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" /> Create Version
                  </Button>
                </div>
              </div>

              {/* Assumptions & Warnings Banner */}
              {metrics.warnings?.length > 0 && (
                <div className="p-3 rounded border border-warning/30 bg-warning/5 space-y-1 text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" /> Architectural Warnings
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-muted-foreground pl-1">
                    {metrics.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Impact Metrics Grid (6 Categories) */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* 1. Performance */}
                <MetricCard
                  icon={Zap}
                  title="Performance & Latency"
                  mainValue={metrics.performance.latencyScore.proposed}
                  delta={metrics.performance.latencyScore.delta}
                  status={metrics.performance.latencyScore.status}
                  subNote={`Sync call chain: ${metrics.performance.maxSyncHops.proposed} hops (${Number(metrics.performance.maxSyncHops.delta || 0) > 0 ? "+" : ""}${metrics.performance.maxSyncHops.delta ?? 0})`}
                  onInspect={() =>
                    setInspectMetric({
                      title: "Performance & Latency Breakdown",
                      rationale: metrics.performance.latencyScore.rationale,
                      details: {
                        syncHopsBaseline: metrics.performance.maxSyncHops.baseline,
                        syncHopsProposed: metrics.performance.maxSyncHops.proposed,
                        potentialBottlenecks: metrics.performance.potentialBottlenecks,
                        communicationChanges: metrics.performance.communicationChanges,
                      },
                    })
                  }
                />

                {/* 2. Scalability & SPOFs */}
                <MetricCard
                  icon={Server}
                  title="Scalability & SPOFs"
                  mainValue={`${metrics.scalability.spofCount.proposed} Single Point(s) of Failure`}
                  delta={`${Number(metrics.scalability.spofCount.delta || 0) > 0 ? "+" : ""}${metrics.scalability.spofCount.delta ?? 0}`}
                  status={metrics.scalability.spofCount.status}
                  subNote={`Identified bottlenecks: ${metrics.scalability.potentialBottlenecks.length}`}
                  onInspect={() =>
                    setInspectMetric({
                      title: "Scalability & Resilience Evaluation",
                      rationale: metrics.scalability.spofCount.rationale,
                      details: {
                        identifiedSpofs: metrics.scalability.identifiedSpofs,
                        scalingLimitations: metrics.scalability.scalingLimitations,
                        bottlenecks: metrics.scalability.potentialBottlenecks,
                      },
                    })
                  }
                />

                {/* 3. Cost */}
                <MetricCard
                  icon={DollarSign}
                  title="Relative Cost Index"
                  mainValue={`${metrics.cost.relativeCostIndex.proposed} compute units`}
                  delta={`${Number(metrics.cost.relativeCostIndex.delta || 0) > 0 ? "+" : ""}${metrics.cost.relativeCostIndex.delta ?? 0}`}
                  status={metrics.cost.relativeCostIndex.status}
                  subNote={`${metrics.cost.introducedServices.length} infrastructure service(s) added`}
                  onInspect={() =>
                    setInspectMetric({
                      title: "Infrastructure Cost Breakdown",
                      rationale: metrics.cost.relativeCostIndex.rationale,
                      details: {
                        baselineIndex: metrics.cost.relativeCostIndex.baseline,
                        proposedIndex: metrics.cost.relativeCostIndex.proposed,
                        introducedServices: metrics.cost.introducedServices,
                        assumptions: metrics.cost.assumptions,
                      },
                    })
                  }
                />

                {/* 4. Complexity */}
                <MetricCard
                  icon={GitBranch}
                  title="Architectural Complexity"
                  mainValue={`${metrics.complexity.componentCount.proposed} components, ${metrics.complexity.connectionCount.proposed} edges`}
                  delta={`${metrics.complexity.couplingIndex.proposed} edges/node`}
                  status={metrics.complexity.couplingIndex.status}
                  subNote={`Delta: ${Number(metrics.complexity.componentCount.delta || 0) > 0 ? "+" : ""}${metrics.complexity.componentCount.delta ?? 0} nodes, ${Number(metrics.complexity.connectionCount.delta || 0) > 0 ? "+" : ""}${metrics.complexity.connectionCount.delta ?? 0} edges`}
                  onInspect={() =>
                    setInspectMetric({
                      title: "Coupling & Complexity Indicators",
                      rationale: metrics.complexity.couplingIndex.rationale,
                      details: {
                        componentCount: metrics.complexity.componentCount,
                        connectionCount: metrics.complexity.connectionCount,
                        couplingDensity: metrics.complexity.couplingIndex,
                        newDependencies: metrics.complexity.additionalDependencies,
                      },
                    })
                  }
                />

                {/* 5. Security */}
                <MetricCard
                  icon={Shield}
                  title="Security & Attack Surfaces"
                  mainValue={`${metrics.security.attackSurfacesCount.proposed} Ingress Surface(s)`}
                  delta={`${Number(metrics.security.attackSurfacesCount.delta || 0) > 0 ? "+" : ""}${metrics.security.attackSurfacesCount.delta ?? 0}`}
                  status={metrics.security.attackSurfacesCount.status}
                  subNote={metrics.security.evidenceNote || "Architecture metadata audit"}
                  onInspect={() =>
                    setInspectMetric({
                      title: "Security & Trust Boundary Inspection",
                      rationale: metrics.security.attackSurfacesCount.rationale,
                      details: {
                        authGaps: metrics.security.authGaps,
                        trustBoundaryChanges: metrics.security.trustBoundaryChanges,
                        evidenceNote: metrics.security.evidenceNote,
                      },
                    })
                  }
                />

                {/* 6. Development Effort */}
                <MetricCard
                  icon={Clock}
                  title="Development Effort"
                  mainValue={`${metrics.developmentEffort.estimatedDaysMin} – ${metrics.developmentEffort.estimatedDaysMax} dev days`}
                  delta={`~${metrics.developmentEffort.storyPointsEstimate} pts`}
                  status="neutral"
                  subNote={`Confidence: ${metrics.developmentEffort.confidence.toUpperCase()}`}
                  onInspect={() =>
                    setInspectMetric({
                      title: "Implementation Effort Heuristics",
                      rationale: "Defensible story point and day estimates aggregated from staged change scopes.",
                      details: {
                        minDays: metrics.developmentEffort.estimatedDaysMin,
                        maxDays: metrics.developmentEffort.estimatedDaysMax,
                        storyPoints: metrics.developmentEffort.storyPointsEstimate,
                        assumptions: metrics.developmentEffort.assumptions,
                      },
                    })
                  }
                />
              </div>

              {/* Deep Dive Navigation Tabs */}
              <div className="space-y-4">
                <div className="flex border-b border-border text-xs gap-4 font-mono">
                  <button
                    onClick={() => setActiveTab("topology")}
                    className={
                      "pb-2 font-medium transition-colors " +
                      (activeTab === "topology"
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    Topology Comparison ({proposedNodes.length} nodes)
                  </button>
                  <button
                    onClick={() => setActiveTab("impact")}
                    className={
                      "pb-2 font-medium transition-colors " +
                      (activeTab === "impact"
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    Downstream Impact ({impact?.affectedComponents?.length || 0})
                  </button>
                  <button
                    onClick={() => setActiveTab("repository")}
                    className={
                      "pb-2 font-medium transition-colors " +
                      (activeTab === "repository"
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    Repository & Drift Intelligence
                  </button>
                  <button
                    onClick={() => setActiveTab("remediation")}
                    className={
                      "pb-2 font-medium transition-colors " +
                      (activeTab === "remediation"
                        ? "border-b-2 border-primary text-foreground"
                        : "text-muted-foreground hover:text-foreground")
                    }
                  >
                    Documentation & Remediation
                  </button>
                </div>

                {/* Tab 1: Topology Comparison */}
                {activeTab === "topology" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Before Architecture */}
                    <div className="surface-panel">
                      <div className="h-9 px-3 border-b border-border flex items-center justify-between text-xs font-mono">
                        <span className="uppercase text-muted-foreground font-semibold">
                          Baseline: {activeVersion ? `v${activeVersion.version_number}` : "Before"}
                        </span>
                        <span className="text-muted-foreground">
                          {baselineGraph?.nodes.length || 0} nodes • {baselineGraph?.edges.length || 0} edges
                        </span>
                      </div>
                      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                        {baselineGraph?.nodes.map((node) => (
                          <div
                            key={node.id}
                            className="flex items-center gap-2 p-2 rounded border border-border bg-background/50 font-mono text-xs"
                          >
                            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                            <span className="font-medium text-foreground">{node.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-auto uppercase border border-border px-1 rounded">
                              {node.type}
                            </span>
                            {node.technology && (
                              <span className="text-[10px] text-primary">{node.technology}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* After Architecture */}
                    <div className="surface-panel border-primary/40">
                      <div className="h-9 px-3 border-b border-border flex items-center justify-between text-xs font-mono bg-primary/5">
                        <span className="uppercase text-primary font-semibold flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3" /> Proposed State (After)
                        </span>
                        <span className="text-muted-foreground">
                          {proposedNodes.length} nodes • {proposedEdges.length} edges
                        </span>
                      </div>
                      <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                        {proposedNodes.map((node) => {
                          const isNew = !baselineGraph?.nodes.some((bn) => bn.name === node.name || bn.id === node.id);
                          const isModified = baselineGraph?.nodes.some(
                            (bn) => (bn.name === node.name || bn.id === node.id) && bn.technology !== node.technology
                          );

                          return (
                            <div
                              key={node.id}
                              className={
                                "flex items-center gap-2 p-2 rounded border font-mono text-xs " +
                                (isNew
                                  ? "bg-success/10 border-success/30 text-success"
                                  : isModified
                                    ? "bg-warning/10 border-warning/30 text-warning"
                                    : "bg-background/50 border-border")
                              }
                            >
                              <span
                                className={
                                  "h-2 w-2 rounded-full " +
                                  (isNew ? "bg-success" : isModified ? "bg-warning" : "bg-muted-foreground")
                                }
                              />
                              <span className="font-medium text-foreground">{node.name}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto uppercase border border-border px-1 rounded">
                                {node.type}
                              </span>
                              {node.technology && (
                                <span className={isModified ? "text-warning font-semibold" : "text-primary"}>
                                  {node.technology}
                                </span>
                              )}
                              {isNew && <span className="text-[9px] uppercase px-1 rounded bg-success/20 font-bold">NEW</span>}
                              {isModified && <span className="text-[9px] uppercase px-1 rounded bg-warning/20 font-bold">MODIFIED</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Downstream & Impact Analysis */}
                {activeTab === "impact" && impact && (
                  <div className="space-y-4">
                    {/* Severed / Broken Connections Warning */}
                    {impact.brokenConnections && impact.brokenConnections.length > 0 && (
                      <div className="surface-panel p-3.5 border-destructive/40 bg-destructive/5 space-y-2">
                        <div className="flex items-center gap-2 text-destructive font-semibold text-xs font-mono">
                          <AlertTriangle className="h-4 w-4" /> Severed / Broken Connections Detected
                        </div>
                        <div className="space-y-1.5 text-xs">
                          {impact.brokenConnections.map((bc, idx) => (
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

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="surface-panel p-3 space-y-1.5">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Directly Changed</div>
                        <div className="space-y-1">
                          {impact.directlyChangedComponents?.map((c) => (
                            <div key={c} className="font-mono text-[11px] px-2 py-1 rounded bg-background border border-border">
                              {c}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="surface-panel p-3 space-y-1.5">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Connected Downstream</div>
                        <div className="space-y-1">
                          {impact.connectedComponents?.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground">None</div>
                          ) : (
                            impact.connectedComponents?.map((c) => (
                              <div key={c} className="font-mono text-[11px] px-2 py-1 rounded bg-background border border-border">
                                {c}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="surface-panel p-3 space-y-1.5">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Affected Data Stores</div>
                        <div className="space-y-1">
                          {impact.affectedDataStores?.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground">None</div>
                          ) : (
                            impact.affectedDataStores?.map((c) => (
                              <div key={c} className="font-mono text-[11px] px-2 py-1 rounded bg-background border border-border text-primary">
                                {c}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="surface-panel p-3 space-y-1.5">
                        <div className="text-[10px] font-mono uppercase text-muted-foreground">Affected Infrastructure</div>
                        <div className="space-y-1">
                          {impact.affectedInfrastructure?.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground">None</div>
                          ) : (
                            impact.affectedInfrastructure?.map((c) => (
                              <div key={c} className="font-mono text-[11px] px-2 py-1 rounded bg-background border border-border">
                                {c}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Repository & Drift Intelligence */}
                {activeTab === "repository" && (
                  <div className="surface-panel p-4 space-y-4 text-xs">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-mono font-semibold uppercase text-primary flex items-center gap-1.5">
                        <GitBranch className="h-4 w-4" /> Codebase Evidence & Architecture Drift Audit
                      </span>
                    </div>

                    {impact?.repositoryEvidence?.hasEvidence ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded bg-success/10 border border-success/30 text-success space-y-1">
                          <div className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" /> Repository Evidence Verified
                          </div>
                          <div className="text-[11px]">{impact.repositoryEvidence.statusNote}</div>
                        </div>

                        {impact.repositoryEvidence.matchedModules?.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-mono uppercase text-muted-foreground">Matched Code Modules</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {impact.repositoryEvidence.matchedModules.map((m) => (
                                <div key={m} className="p-1.5 rounded bg-background border border-border font-mono text-[11px]">
                                  {m}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {impact.potentialDrift?.hasDriftRisk && (
                          <div className="p-3 rounded bg-warning/10 border border-warning/30 space-y-2">
                            <div className="font-semibold text-warning flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4" /> Anticipated Architecture Drift
                            </div>
                            <div className="text-[11px] text-muted-foreground">{impact.potentialDrift.note}</div>
                            <ul className="list-disc list-inside space-y-1 text-[11px] text-foreground pl-1">
                              {impact.potentialDrift.items.map((item, idx) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 text-center space-y-3 max-w-md mx-auto">
                        <Info className="h-8 w-8 text-muted-foreground mx-auto" />
                        <div className="space-y-1">
                          <div className="font-medium text-foreground">Architecture-Only Simulation Active</div>
                          <div className="text-muted-foreground text-[11px]">
                            No repository snapshot was selected for this simulation. To correlate proposed components with actual source files, scanned API routes, and code-level drift warnings, select a completed snapshot from the selector above.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 4: Documentation & Remediation */}
                {activeTab === "remediation" && impact && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="surface-panel p-4 space-y-3">
                      <div className="font-mono font-semibold uppercase text-primary flex items-center gap-1.5">
                        <FileText className="h-4 w-4" /> Documentation Sections Needing Updates
                      </div>
                      <div className="space-y-1.5">
                        {impact.docSectionsNeedingUpdate?.map((sec) => (
                          <div key={sec} className="p-2 rounded bg-background border border-border flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-warning" />
                            <span className="font-medium">{sec}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="surface-panel p-4 space-y-3">
                      <div className="font-mono font-semibold uppercase text-primary flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" /> Recommended Engineering Actions
                      </div>
                      <div className="space-y-1.5">
                        {impact.recommendedActions?.map((action, idx) => (
                          <div key={idx} className="p-2 rounded bg-background border border-border flex items-start gap-2">
                            <ChevronRight className="h-3.5 w-3.5 text-primary mt-0.5" />
                            <span>{action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for "Create New Architecture Version" */}
      {applyDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface-panel max-w-lg w-full p-6 space-y-4 border border-border shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Create New Architecture Version</h3>
                <p className="text-xs text-muted-foreground">Derive and persist a new version from simulation proposal</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                This action will create a new architecture version derived from the simulated proposal.
              </p>
              <div className="p-3 rounded bg-surface border border-border font-mono text-[11px] space-y-1 text-foreground">
                <div>• Baseline: v{activeVersion?.version_number} ({activeVersion?.name}) — preserved unchanged</div>
                <div>• New Version: v{Number(activeVersion?.version_number || 1) + 1} ({currentSimulation?.name})</div>
                <div>• Nodes: {proposedNodes.length} active components</div>
                <div>• Edges: {proposedEdges.length} active relationships</div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Original historical versions and GitHub repository code are never overwritten.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setApplyDialogOpen(false)} disabled={isApplying}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApplyChanges} disabled={isApplying} className="font-mono text-xs">
                {isApplying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating Version...
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1.5" /> Confirm & Create Version
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inspection Modal for Metric Details */}
      {inspectMetric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="surface-panel max-w-md w-full p-5 space-y-3 border border-border shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                <Info className="h-4 w-4 text-primary" /> {inspectMetric.title}
              </h3>
              <button onClick={() => setInspectMetric(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="font-medium text-muted-foreground">Evaluation Rationale:</div>
              <p className="p-2.5 rounded bg-surface border border-border text-foreground font-mono text-[11px]">
                {inspectMetric.rationale}
              </p>

              {Boolean(inspectMetric.details) && (
                <div className="space-y-1 pt-1">
                  <div className="font-medium text-muted-foreground">Detailed Indicators:</div>
                  <pre className="p-2.5 rounded bg-background border border-border text-[10px] font-mono overflow-x-auto max-h-48 text-muted-foreground">
                    {JSON.stringify(inspectMetric.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setInspectMetric(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Metric Card with Delta and Inspection
function MetricCard({
  icon: Icon,
  title,
  mainValue,
  delta,
  status,
  subNote,
  onInspect,
}: {
  icon: typeof Zap;
  title: string;
  mainValue: string;
  delta: string | number | null;
  status?: "improved" | "degraded" | "neutral" | "unknown";
  subNote?: string;
  onInspect: () => void;
}) {
  const isPositive = status === "improved";
  const isNegative = status === "degraded";

  return (
    <div className="surface-panel p-3.5 flex flex-col justify-between space-y-2 relative group hover:border-primary/50 transition-colors">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-primary" /> {title}
        </span>
        <button
          onClick={onInspect}
          className="text-muted-foreground hover:text-primary p-0.5 rounded hover:bg-surface transition-colors"
          title="Inspect metric evaluation"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <div className="text-sm font-semibold tracking-tight text-foreground line-clamp-2">{mainValue}</div>
        {delta !== null && delta !== undefined && (
          <div
            className={
              "text-[11px] font-mono font-medium flex items-center gap-1 " +
              (isPositive ? "text-success" : isNegative ? "text-destructive" : "text-muted-foreground")
            }
          >
            {isPositive ? <ArrowDownRight className="h-3 w-3" /> : isNegative ? <ArrowUpRight className="h-3 w-3" /> : null}
            <span>Delta: {delta}</span>
          </div>
        )}
      </div>

      {subNote && <div className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50 truncate">{subNote}</div>}
    </div>
  );
}
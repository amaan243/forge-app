import { NotFoundError, AppError } from "../errors/app-error.js";
import { architectureService } from "./architecture-service.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import { engineeringImpactRepository } from "../repositories/engineering-impact-repository.js";
import { engineeringRepository } from "../repositories/engineering-intelligence-repository.js";
import { architectureSimulationService } from "./architecture-simulation-service.js";
import type {
  ImpactAnalysisInput,
  ImpactReport,
  ImpactTargetEntity,
  ProposedChange,
  ArchitectureCodeMapping,
  ArchitectureCodeMappingState,
  ImpactedEntityFinding,
  RiskFinding,
  RiskSeverity,
  ChangePlan,
  ChangePlanTask,
  ImpactDependencyGraph,
  ImpactSummary,
  RiskAssessment,
  DriftCorrelationFinding,
  PlaygroundSimulationBridge,
} from "../types/engineering-impact.js";
import type { ArchitectureNode, ArchitectureEdge } from "../types/architecture.js";
import type { RepositoryAnalysis } from "../types/repository-intelligence.js";
import type { SimulationChange } from "../types/engineering-intelligence.js";
import { supabaseAdmin } from "../lib/supabase.js";

export class EngineeringImpactService {
  async analyze(projectId: string, userId: string, input: ImpactAnalysisInput): Promise<ImpactReport> {
    // 1. Validate Project Hierarchy & Fetch Architecture Version
    const versionData = await architectureService.getVersion(input.architectureVersionId);
    if (!versionData.version || versionData.version.project_id !== projectId) {
      throw new NotFoundError("Architecture version not found for this project");
    }

    const { nodes = [], edges = [], version } = versionData;

    // 2. Resolve Workspace ID
    const { data: projectRow, error: projectError } = await supabaseAdmin
      .from("projects")
      .select("workspace_id")
      .eq("id", projectId)
      .single();

    if (projectError || !projectRow) {
      throw new NotFoundError("Project not found");
    }
    const workspaceId = projectRow.workspace_id;

    // 3. Resolve Repository Context & Check Snapshot Freshness
    let repository: any = null;
    let repositoryAnalysis: RepositoryAnalysis | null = null;
    let isSnapshotStale = false;
    let stalenessWarning: string | undefined = undefined;

    if (input.repositoryId) {
      repository = await repositoryIntelligenceRepository.repository(projectId, input.repositoryId);
      if (!repository || repository.project_id !== projectId) {
        throw new NotFoundError("Repository not found for this project");
      }
    }

    if (input.repositoryAnalysisId) {
      repositoryAnalysis = await repositoryIntelligenceRepository.analysis(input.repositoryAnalysisId);
      if (!repositoryAnalysis || repositoryAnalysis.project_id !== projectId) {
        throw new NotFoundError("Repository analysis snapshot not found for this project");
      }
      if (input.repositoryId && repositoryAnalysis.repository_id !== input.repositoryId) {
        throw new AppError(
          "Repository analysis snapshot does not belong to the selected repository",
          400,
          "INVALID_SOURCE_COMBINATION"
        );
      }

      // Check if snapshot is stale compared to latest completed snapshot
      const latestSnapshot = await repositoryIntelligenceRepository.latestSuccessful(
        projectId,
        repositoryAnalysis.repository_id || undefined
      );
      if (latestSnapshot && latestSnapshot.id !== repositoryAnalysis.id) {
        isSnapshotStale = true;
        stalenessWarning = `Snapshot commit ${repositoryAnalysis.commit_sha?.slice(0, 7) || "selected"} is older than latest analyzed commit ${latestSnapshot.commit_sha?.slice(0, 7) || "HEAD"}. Consider analyzing the latest snapshot for up-to-date evidence.`;
      }
    } else if (input.repositoryId) {
      // Auto-resolve latest successful snapshot for selected repo if not explicitly passed
      const latestSnapshot = await repositoryIntelligenceRepository.latestSuccessful(projectId, input.repositoryId);
      if (latestSnapshot) {
        repositoryAnalysis = latestSnapshot;
      }
    }

    if (!repository && repositoryAnalysis?.repository_id) {
      repository = await repositoryIntelligenceRepository.repository(projectId, repositoryAnalysis.repository_id);
    }

    // 4. Fetch Existing Project Documentation for Deep Linking
    const projectDocs = await engineeringRepository.documents(projectId);

    // 5. Fetch Existing Drift Findings for Drift Correlation
    let existingDriftItems: Array<{ id: string; type: string; description: string; severity: string }> = [];
    try {
      const { data: driftData } = await supabaseAdmin
        .from("drift_analyses")
        .select("id, status, drift_items(id, type, description, severity)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (driftData && Array.isArray((driftData as any).drift_items)) {
        existingDriftItems = (driftData as any).drift_items;
      }
    } catch {
      // Drift items query non-critical fallback
    }

    // 6. Perform Architecture-to-Code Mapping
    const mappingResult = this.computeArchitectureToCodeMapping(nodes, repositoryAnalysis);

    // 7. Resolve Target Entity in Graph
    const resolvedTarget = this.resolveTargetEntity(input.targetEntity, nodes, edges, repositoryAnalysis);

    // 8. Dependency Graph Traversal (Direct & Transitive Upstream & Downstream)
    const graphTraversal = this.traverseDependencyGraph(resolvedTarget, nodes, edges, mappingResult);

    // 9. Synthesize Impact Findings & Affected Subsystems
    const impactSummary = this.synthesizeImpactSummary(
      resolvedTarget,
      input.proposedChange,
      nodes,
      edges,
      graphTraversal,
      mappingResult,
      repositoryAnalysis,
      projectDocs
    );

    // 10. Drift Correlations
    const driftCorrelations = this.correlateDrift(
      resolvedTarget,
      input.proposedChange,
      mappingResult,
      existingDriftItems,
      repositoryAnalysis
    );

    // 11. Risk Classification
    const riskAssessment = this.evaluateRiskAssessment(
      resolvedTarget,
      input.proposedChange,
      graphTraversal,
      impactSummary,
      driftCorrelations,
      mappingResult,
      repositoryAnalysis
    );

    // 12. Change Plan Generation (10 Actionable Steps)
    const changePlan = this.generateChangePlan(
      resolvedTarget,
      input.proposedChange,
      graphTraversal,
      impactSummary,
      riskAssessment,
      mappingResult,
      projectDocs
    );

    // 13. Engineering Playground Bridge Formulation
    const playgroundBridge = this.formulatePlaygroundBridge(
      resolvedTarget,
      input.proposedChange,
      nodes,
      impactSummary
    );

    // 14. Build Source Context Record
    const sourceContext = {
      versionNumber: version.version_number,
      versionName: version.name,
      repositoryId: repository?.id || null,
      repositoryName: repository?.repository_name || undefined,
      repositoryUrl: repository?.repository_url || undefined,
      repositoryAnalysisId: repositoryAnalysis?.id || null,
      commitSha: repositoryAnalysis?.commit_sha || undefined,
      branch: (repositoryAnalysis?.analysis_data as any)?.branch || repository?.default_branch || "main",
      snapshotDate: repositoryAnalysis?.created_at || undefined,
      isSnapshotStale,
      stalenessWarning,
    };

    // 15. Persist the Impact Report
    const reportRecord = await engineeringImpactRepository.createReport({
      projectId,
      workspaceId,
      architectureVersionId: input.architectureVersionId,
      repositoryId: repository?.id || null,
      repositoryAnalysisId: repositoryAnalysis?.id || null,
      targetEntity: input.targetEntity,
      proposedChange: input.proposedChange,
      sourceContext,
      mappingSummary: mappingResult.summary,
      dependencyGraph: graphTraversal.graphData,
      impactSummary,
      riskAssessment,
      changePlan,
      driftCorrelations,
      playgroundBridge,
      createdBy: userId,
    });

    return reportRecord;
  }

  async list(projectId: string): Promise<ImpactReport[]> {
    return engineeringImpactRepository.listReports(projectId);
  }

  async get(projectId: string, id: string): Promise<ImpactReport> {
    const report = await engineeringImpactRepository.getReport(projectId, id);
    if (!report) {
      throw new NotFoundError("Impact report not found");
    }
    return report;
  }

  async delete(projectId: string, id: string): Promise<void> {
    await this.get(projectId, id);
    await engineeringImpactRepository.deleteReport(projectId, id);
  }

  async convertToPlaygroundSimulation(
    projectId: string,
    userId: string,
    reportId: string,
    simulationInput?: { name?: string; description?: string }
  ) {
    const report = await this.get(projectId, reportId);
    if (!report.playgroundBridge.supported || report.playgroundBridge.simulationCandidateChanges.length === 0) {
      throw new AppError(
        "Proposed change cannot be converted to a simulation without supported playground operations",
        400,
        "PLAYGROUND_BRIDGE_UNSUPPORTED"
      );
    }

    const simName =
      simulationInput?.name ||
      `Simulate: ${report.targetEntity.name} - ${report.proposedChange.changeType.replace(/_/g, " ")}`;

    const simDescription =
      simulationInput?.description ||
      `Playground simulation generated from Impact Report #${report.id.slice(0, 8)}. Proposed change: ${report.proposedChange.description}`;

    const simulation = await architectureSimulationService.create(projectId, userId, {
      base_version_id: report.architectureVersionId,
      repository_id: report.repositoryId,
      snapshot_id: report.repositoryAnalysisId,
      name: simName,
      description: simDescription,
      proposed_changes: report.playgroundBridge.simulationCandidateChanges as SimulationChange[],
    });

    // Run simulation evaluation immediately to populate deltas
    return architectureSimulationService.simulate(projectId, simulation.id);
  }

  // ==========================================
  // Core Analysis Engine Methods
  // ==========================================

  computeArchitectureToCodeMapping(
    nodes: ArchitectureNode[],
    analysis: RepositoryAnalysis | null
  ): {
    mappings: ArchitectureCodeMapping[];
    summary: {
      mappings: ArchitectureCodeMapping[];
      verifiedCount: number;
      partialCount: number;
      unmappedArchCount: number;
      unmappedRepoCount: number;
      uncertainCount: number;
    };
    unmappedRepoModules: Array<{ name: string; file: string; type: string }>;
  } {
    if (!analysis || analysis.status !== "completed") {
      const mappings: ArchitectureCodeMapping[] = nodes.map((node) => ({
        componentId: node.id,
        componentName: node.name,
        componentType: node.type,
        state: "unmapped_architecture" as ArchitectureCodeMappingState,
        matchedFiles: [],
        matchedRoutes: [],
        matchedDependencies: [],
        matchedDatabases: [],
        confidence: "low",
        evidenceNotes: ["No completed repository analysis snapshot linked to verify implementation."],
      }));

      return {
        mappings,
        summary: {
          mappings,
          verifiedCount: 0,
          partialCount: 0,
          unmappedArchCount: nodes.length,
          unmappedRepoCount: 0,
          uncertainCount: 0,
        },
        unmappedRepoModules: [],
      };
    }

    const arch = (analysis.architecture ?? {}) as {
      services?: string[];
      technologies?: string[];
      databases?: string[];
      apis?: string[];
      routes?: Array<{ method: string; path: string; file?: string; line?: number; handler?: string }>;
      entryPoints?: Array<{ path: string; kind: string; evidence: string }>;
    };

    const routes = Array.isArray(arch.routes) ? arch.routes : [];
    const entryPoints = Array.isArray(arch.entryPoints) ? arch.entryPoints : [];
    const services = (arch.services || []).map((s: any) =>
      typeof s === "string" ? s : s?.path || s?.name || String(s)
    );
    const frameworks = Array.isArray(analysis.frameworks)
      ? analysis.frameworks.map((f: any) => (typeof f === "string" ? f : f?.name || ""))
      : [];
    const dependencies = Array.isArray(analysis.dependencies)
      ? (analysis.dependencies as Array<{ name: string }>)
      : [];
    const databases = arch.databases || [];

    const mappedRepoFiles = new Set<string>();
    const mappings: ArchitectureCodeMapping[] = [];

    for (const node of nodes) {
      const nodeNameLower = node.name.toLowerCase();
      const nodeKeyLower = (node.node_key || "").toLowerCase();
      const nodeTechLower = (node.technology || "").toLowerCase();
      const baseName = node.name
        .toLowerCase()
        .replace(/[-_ ]*(service|app|gateway|worker|api|controller|db|database|cluster)$/i, "")
        .trim();

      const nameMatch = (val: string | undefined) => {
        if (!val) return false;
        const v = val.toLowerCase();
        return (
          v.includes(nodeNameLower) ||
          (nodeKeyLower && v.includes(nodeKeyLower)) ||
          (baseName.length >= 3 && v.includes(baseName))
        );
      };

      const matchedFiles: string[] = [];
      const matchedRoutes: Array<{ method: string; path: string; file?: string; line?: number }> = [];
      const matchedDependencies: string[] = [];
      const matchedDatabases: string[] = [];
      const evidenceNotes: string[] = [];

      // 1. Check matching routes
      for (const r of routes) {
        const pathMatch = nameMatch(r.path);
        const fileMatch = nameMatch(r.file);
        const handlerMatch = nameMatch(r.handler);

        if (pathMatch || fileMatch || handlerMatch) {
          matchedRoutes.push({
            method: r.method,
            path: r.path,
            file: r.file,
            line: r.line,
          });
          if (r.file && !matchedFiles.includes(r.file)) {
            matchedFiles.push(r.file);
            mappedRepoFiles.add(r.file);
          }
        }
      }

      // 2. Check entry points & services
      for (const ep of entryPoints) {
        if (nameMatch(ep.path) || ep.kind.toLowerCase().includes(node.type.toLowerCase())) {
          if (!matchedFiles.includes(ep.path)) {
            matchedFiles.push(ep.path);
            mappedRepoFiles.add(ep.path);
          }
          evidenceNotes.push(`Confirmed application entry point at '${ep.path}' (${ep.evidence})`);
        }
      }

      for (const s of services) {
        if (nameMatch(s)) {
          if (!matchedFiles.includes(s)) {
            matchedFiles.push(s);
            mappedRepoFiles.add(s);
          }
        }
      }

      // 3. Database matching
      if (node.type === "database" || node.type === "storage" || node.type === "cache") {
        for (const db of databases) {
          if (db.toLowerCase().includes(nodeNameLower) || (nodeTechLower && db.toLowerCase().includes(nodeTechLower))) {
            matchedDatabases.push(db);
          }
        }
        for (const dep of dependencies) {
          if (
            /postgres|mysql|sqlite|redis|mongodb|prisma|mongoose|typeorm|sequelize/i.test(dep.name) &&
            (dep.name.toLowerCase().includes(nodeNameLower) ||
              (nodeTechLower && dep.name.toLowerCase().includes(nodeTechLower)))
          ) {
            matchedDependencies.push(dep.name);
          }
        }
      }

      // 4. Framework / tech matching
      if (node.technology) {
        for (const fw of frameworks) {
          if (fw.toLowerCase().includes(nodeTechLower) || nodeTechLower.includes(fw.toLowerCase())) {
            if (!matchedDependencies.includes(fw)) {
              matchedDependencies.push(fw);
            }
          }
        }
      }

      // Determine Mapping State
      let state: ArchitectureCodeMappingState = "unmapped_architecture";
      let confidence: "high" | "medium" | "low" = "low";

      if (matchedRoutes.length > 0 || matchedFiles.length > 0) {
        if (matchedRoutes.length >= 2 || (matchedFiles.length > 0 && matchedDependencies.length > 0)) {
          state = "verified";
          confidence = "high";
          evidenceNotes.push(
            `Verified implementation with ${matchedRoutes.length} route(s) and ${matchedFiles.length} source file(s).`
          );
        } else {
          state = "partial";
          confidence = "medium";
          evidenceNotes.push(
            `Partial correlation found with ${matchedRoutes.length} route(s) and ${matchedFiles.length} file(s).`
          );
        }
      } else if (matchedDatabases.length > 0 || matchedDependencies.length > 0) {
        state = "partial";
        confidence = "medium";
        evidenceNotes.push(
          `Correlated via declared library dependencies: ${[...matchedDatabases, ...matchedDependencies].join(", ")}.`
        );
      } else if (node.technology && frameworks.some((f) => f.toLowerCase().includes(nodeTechLower))) {
        state = "uncertain";
        confidence = "low";
        evidenceNotes.push(`Technology '${node.technology}' matches repo frameworks but no distinct module isolated.`);
      } else {
        state = "unmapped_architecture";
        confidence = "low";
        evidenceNotes.push("No corresponding routes, entrypoints, or specific source files found in repo scan.");
      }

      mappings.push({
        componentId: node.id,
        componentName: node.name,
        componentType: node.type,
        state,
        matchedFiles,
        matchedRoutes,
        matchedDependencies,
        matchedDatabases,
        confidence,
        evidenceNotes,
      });
    }

    // Detect unmapped repository modules
    const unmappedRepoModules: Array<{ name: string; file: string; type: string }> = [];
    for (const r of routes) {
      if (r.file && !mappedRepoFiles.has(r.file)) {
        unmappedRepoModules.push({
          name: `${r.method} ${r.path}`,
          file: r.file,
          type: "unmapped_route",
        });
      }
    }
    for (const s of services) {
      if (!mappedRepoFiles.has(s)) {
        unmappedRepoModules.push({
          name: s.split("/").pop() || s,
          file: s,
          type: "unmapped_service",
        });
      }
    }

    const verifiedCount = mappings.filter((m) => m.state === "verified").length;
    const partialCount = mappings.filter((m) => m.state === "partial").length;
    const unmappedArchCount = mappings.filter((m) => m.state === "unmapped_architecture").length;
    const uncertainCount = mappings.filter((m) => m.state === "uncertain").length;
    const unmappedRepoCount = unmappedRepoModules.length;

    return {
      mappings,
      summary: {
        mappings,
        verifiedCount,
        partialCount,
        unmappedArchCount,
        unmappedRepoCount,
        uncertainCount,
      },
      unmappedRepoModules,
    };
  }

  resolveTargetEntity(
    target: ImpactTargetEntity,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    _analysis: RepositoryAnalysis | null
  ): {
    target: ImpactTargetEntity;
    matchedNode?: ArchitectureNode;
    matchedEdge?: ArchitectureEdge;
    sourceNode?: ArchitectureNode;
    targetNode?: ArchitectureNode;
  } {
    // 1. If target is architecture component or service
    if (target.type === "architecture_component" || target.type === "service_module") {
      const matched = nodes.find(
        (n) =>
          n.id === target.id ||
          n.node_key === target.nodeKey ||
          n.node_key === target.id ||
          n.name.toLowerCase() === target.name.toLowerCase()
      );
      return { target, matchedNode: matched };
    }

    // 2. If target is architecture connection
    if (target.type === "architecture_connection") {
      const matchedEdge = edges.find((e) => e.id === target.id);
      if (matchedEdge) {
        const sourceNode = nodes.find((n) => n.id === matchedEdge.source_node_id);
        const targetNode = nodes.find((n) => n.id === matchedEdge.target_node_id);
        return { target, matchedEdge, sourceNode, targetNode };
      }
    }

    // 3. If target is API route
    if (target.type === "api_route") {
      const targetPath = (target.path || target.name).toLowerCase();
      // Find component containing this route
      const matchedNode = nodes.find((n) => {
        const nameLower = n.name.toLowerCase();
        return targetPath.includes(nameLower) || (n.node_key && targetPath.includes(n.node_key.toLowerCase()));
      });
      return { target, matchedNode };
    }

    // 4. If target is database object
    if (target.type === "database_object") {
      const matchedNode = nodes.find(
        (n) =>
          (n.type === "database" || n.type === "storage") &&
          (n.name.toLowerCase() === target.name.toLowerCase() ||
            n.id === target.id ||
            n.name.toLowerCase().includes(target.name.toLowerCase()))
      );
      return { target, matchedNode };
    }

    // 5. If target is external integration or dependency
    const matchedNode = nodes.find((n) => n.name.toLowerCase() === target.name.toLowerCase() || n.id === target.id);
    return { target, matchedNode };
  }

  traverseDependencyGraph(
    resolvedTarget: {
      target: ImpactTargetEntity;
      matchedNode?: ArchitectureNode;
      matchedEdge?: ArchitectureEdge;
      sourceNode?: ArchitectureNode;
      targetNode?: ArchitectureNode;
    },
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    mappingResult: ReturnType<typeof this.computeArchitectureToCodeMapping>
  ): {
    directUpstreamIds: Set<string>;
    directDownstreamIds: Set<string>;
    indirectUpstreamIds: Set<string>;
    indirectDownstreamIds: Set<string>;
    affectedEdgeIds: Set<string>;
    graphData: ImpactDependencyGraph;
  } {
    const targetNodeId = resolvedTarget.matchedNode?.id;

    // Adjacency lists: forward (downstream) and backward (upstream)
    const forwardAdj = new Map<string, Array<{ targetId: string; edge: ArchitectureEdge }>>();
    const backwardAdj = new Map<string, Array<{ sourceId: string; edge: ArchitectureEdge }>>();

    for (const edge of edges) {
      if (!forwardAdj.has(edge.source_node_id)) forwardAdj.set(edge.source_node_id, []);
      forwardAdj.get(edge.source_node_id)!.push({ targetId: edge.target_node_id, edge });

      if (!backwardAdj.has(edge.target_node_id)) backwardAdj.set(edge.target_node_id, []);
      backwardAdj.get(edge.target_node_id)!.push({ sourceId: edge.source_node_id, edge });
    }

    const directUpstreamIds = new Set<string>();
    const directDownstreamIds = new Set<string>();
    const indirectUpstreamIds = new Set<string>();
    const indirectDownstreamIds = new Set<string>();
    const affectedEdgeIds = new Set<string>();

    if (targetNodeId) {
      // 1. Direct downstream: nodes that target calls/depends on
      for (const out of forwardAdj.get(targetNodeId) || []) {
        directDownstreamIds.add(out.targetId);
        affectedEdgeIds.add(out.edge.id);
      }

      // 2. Direct upstream: nodes that call/depend on target
      for (const inc of backwardAdj.get(targetNodeId) || []) {
        directUpstreamIds.add(inc.sourceId);
        affectedEdgeIds.add(inc.edge.id);
      }

      // 3. Indirect downstream (BFS 2+ hops)
      const downstreamQueue: Array<{ id: string; depth: number }> = Array.from(directDownstreamIds).map((id) => ({
        id,
        depth: 1,
      }));
      const visitedDownstream = new Set<string>([targetNodeId, ...Array.from(directDownstreamIds)]);

      while (downstreamQueue.length > 0) {
        const current = downstreamQueue.shift()!;
        for (const out of forwardAdj.get(current.id) || []) {
          if (!visitedDownstream.has(out.targetId)) {
            visitedDownstream.add(out.targetId);
            indirectDownstreamIds.add(out.targetId);
            affectedEdgeIds.add(out.edge.id);
            downstreamQueue.push({ id: out.targetId, depth: current.depth + 1 });
          }
        }
      }

      // 4. Indirect upstream (BFS 2+ hops)
      const upstreamQueue: Array<{ id: string; depth: number }> = Array.from(directUpstreamIds).map((id) => ({
        id,
        depth: 1,
      }));
      const visitedUpstream = new Set<string>([targetNodeId, ...Array.from(directUpstreamIds)]);

      while (upstreamQueue.length > 0) {
        const current = upstreamQueue.shift()!;
        for (const inc of backwardAdj.get(current.id) || []) {
          if (!visitedUpstream.has(inc.sourceId)) {
            visitedUpstream.add(inc.sourceId);
            indirectUpstreamIds.add(inc.sourceId);
            affectedEdgeIds.add(inc.edge.id);
            upstreamQueue.push({ id: inc.sourceId, depth: current.depth + 1 });
          }
        }
      }
    } else if (resolvedTarget.matchedEdge) {
      // If target is an edge
      affectedEdgeIds.add(resolvedTarget.matchedEdge.id);
      if (resolvedTarget.sourceNode) directUpstreamIds.add(resolvedTarget.sourceNode.id);
      if (resolvedTarget.targetNode) directDownstreamIds.add(resolvedTarget.targetNode.id);
    }

    const mappingMap = new Map(mappingResult.mappings.map((m) => [m.componentId, m]));

    // Construct Graph Visualization payload
    const graphNodes = nodes.map((n) => {
      const isTarget = n.id === targetNodeId;
      const mapping = mappingMap.get(n.id);
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        isTarget,
        mappingState: mapping?.state || "unmapped_architecture",
      };
    });

    const graphEdges = edges.map((e) => {
      let status: "verified" | "inferred" | "unknown" = "inferred";
      const srcMapping = mappingMap.get(e.source_node_id);
      const tgtMapping = mappingMap.get(e.target_node_id);

      if (srcMapping?.state === "verified" && tgtMapping?.state === "verified") {
        status = "verified";
      } else if (srcMapping?.state === "unmapped_architecture" || tgtMapping?.state === "unmapped_architecture") {
        status = "unknown";
      }

      let direction: "upstream" | "downstream" | "bidirectional" | "internal" = "downstream";
      if (e.source_node_id === targetNodeId) direction = "downstream";
      else if (e.target_node_id === targetNodeId) direction = "upstream";

      return {
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        relationship: e.relationship,
        status,
        direction,
      };
    });

    const nodeNameById = (id: string) => nodes.find((n) => n.id === id)?.name || id;

    return {
      directUpstreamIds,
      directDownstreamIds,
      indirectUpstreamIds,
      indirectDownstreamIds,
      affectedEdgeIds,
      graphData: {
        nodes: graphNodes,
        edges: graphEdges,
        directUpstream: Array.from(directUpstreamIds).map(nodeNameById),
        directDownstream: Array.from(directDownstreamIds).map(nodeNameById),
        indirectUpstream: Array.from(indirectUpstreamIds).map(nodeNameById),
        indirectDownstream: Array.from(indirectDownstreamIds).map(nodeNameById),
      },
    };
  }

  synthesizeImpactSummary(
    resolvedTarget: {
      target: ImpactTargetEntity;
      matchedNode?: ArchitectureNode;
      matchedEdge?: ArchitectureEdge;
      sourceNode?: ArchitectureNode;
      targetNode?: ArchitectureNode;
    },
    change: ProposedChange,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    traversal: ReturnType<typeof this.traverseDependencyGraph>,
    mappingResult: ReturnType<typeof this.computeArchitectureToCodeMapping>,
    analysis: RepositoryAnalysis | null,
    projectDocs: any[]
  ): ImpactSummary {
    const directlyAffected: ImpactedEntityFinding[] = [];
    const downstreamComponents: ImpactedEntityFinding[] = [];
    const relatedApis: ImpactedEntityFinding[] = [];
    const relatedDatabaseObjects: ImpactedEntityFinding[] = [];
    const affectedIntegrations: ImpactedEntityFinding[] = [];
    const relevantTests: ImpactedEntityFinding[] = [];
    const brokenConnections: ImpactSummary["brokenConnections"] = [];
    const unknownsAndAssumptions: string[] = [];

    const mappingMap = new Map(mappingResult.mappings.map((m) => [m.componentId, m]));

    // 1. Direct Target Component Finding
    if (resolvedTarget.matchedNode) {
      const node = resolvedTarget.matchedNode;
      const mapping = mappingMap.get(node.id);
      directlyAffected.push({
        id: node.id,
        name: node.name,
        entityKind: "component",
        direction: "internal",
        hopDistance: 0,
        relationship: "target_of_change",
        relationshipStatus: mapping?.state === "verified" ? "verified" : "inferred",
        evidence: {
          sourceFiles: mapping?.matchedFiles,
          routes: mapping?.matchedRoutes.map((r) => `${r.method} ${r.path}`),
          note: `Primary target of proposed change: ${change.description}`,
        },
      });
    } else {
      directlyAffected.push({
        id: resolvedTarget.target.id,
        name: resolvedTarget.target.name,
        entityKind: "module",
        direction: "internal",
        hopDistance: 0,
        relationship: "target_of_change",
        relationshipStatus: "inferred",
        evidence: {
          note: `Target '${resolvedTarget.target.name}' resolved as unmapped entity; blast-radius inferred from naming and heuristics.`,
        },
      });
      unknownsAndAssumptions.push(
        `Target entity '${resolvedTarget.target.name}' is not formally mapped to an active architecture node.`
      );
    }

    // 2. Direct & Indirect Downstream Components
    for (const id of traversal.directDownstreamIds) {
      const node = nodes.find((n) => n.id === id);
      if (!node) continue;
      const mapping = mappingMap.get(node.id);
      downstreamComponents.push({
        id: node.id,
        name: node.name,
        entityKind: "component",
        direction: "downstream",
        hopDistance: 1,
        relationship: "direct_dependency",
        relationshipStatus: mapping?.state === "verified" ? "verified" : "inferred",
        evidence: {
          sourceFiles: mapping?.matchedFiles,
          note: "Direct downstream recipient of calls, messages, or shared data.",
        },
      });
    }

    for (const id of traversal.indirectDownstreamIds) {
      const node = nodes.find((n) => n.id === id);
      if (!node) continue;
      const mapping = mappingMap.get(node.id);
      downstreamComponents.push({
        id: node.id,
        name: node.name,
        entityKind: "component",
        direction: "downstream",
        hopDistance: 2,
        relationship: "transitive_dependency",
        relationshipStatus: mapping?.state === "verified" ? "verified" : "inferred",
        evidence: {
          sourceFiles: mapping?.matchedFiles,
          note: "Transitive downstream subsystem reachable in 2+ hops.",
        },
      });
    }

    // 3. Related APIs
    const targetAndDownstreamIds = new Set([
      ...(resolvedTarget.matchedNode ? [resolvedTarget.matchedNode.id] : []),
      ...Array.from(traversal.directDownstreamIds),
      ...Array.from(traversal.directUpstreamIds),
    ]);

    for (const nodeId of targetAndDownstreamIds) {
      const mapping = mappingMap.get(nodeId);
      if (mapping && mapping.matchedRoutes.length > 0) {
        for (const r of mapping.matchedRoutes) {
          relatedApis.push({
            id: `${r.method}_${r.path}`,
            name: `${r.method} ${r.path}`,
            entityKind: "route",
            direction: nodeId === resolvedTarget.matchedNode?.id ? "internal" : "downstream",
            hopDistance: nodeId === resolvedTarget.matchedNode?.id ? 0 : 1,
            relationship: "served_route",
            relationshipStatus: "verified",
            evidence: {
              routes: [`${r.method} ${r.path}`],
              sourceFiles: r.file ? [r.file] : [],
              note: r.line ? `Defined at line ${r.line}` : undefined,
            },
          });
        }
      }
    }

    // 4. Related Database Objects
    for (const node of nodes) {
      if (["database", "storage", "cache"].includes(node.type)) {
        const isDirect =
          traversal.directDownstreamIds.has(node.id) ||
          traversal.directUpstreamIds.has(node.id) ||
          node.id === resolvedTarget.matchedNode?.id;
        const isIndirect = traversal.indirectDownstreamIds.has(node.id);

        if (isDirect || isIndirect) {
          const mapping = mappingMap.get(node.id);
          relatedDatabaseObjects.push({
            id: node.id,
            name: node.name,
            entityKind: "database",
            direction: "downstream",
            hopDistance: isDirect ? 1 : 2,
            relationship: "data_persistence",
            relationshipStatus: mapping?.state === "verified" ? "verified" : "inferred",
            evidence: {
              databases: mapping?.matchedDatabases,
              dependencies: mapping?.matchedDependencies,
              note: `Data store '${node.name}' (${node.technology || "relational"}) is within blast radius.`,
            },
          });
        }
      }
    }

    // 5. Potentially Affected Integrations
    const archAnalysis = (analysis?.architecture ?? {}) as any;
    const externalIntegrations = (archAnalysis.externalIntegrations || []) as string[];
    for (const integ of externalIntegrations) {
      const lowerInteg = integ.toLowerCase();
      const isTargetRelated =
        resolvedTarget.target.name.toLowerCase().includes(lowerInteg) ||
        (change.details?.integration as string)?.toLowerCase()?.includes(lowerInteg);

      if (isTargetRelated || change.changeType === "update_external_integration") {
        affectedIntegrations.push({
          id: `integ_${integ}`,
          name: integ,
          entityKind: "integration",
          direction: "downstream",
          hopDistance: 1,
          relationship: "third_party_saas",
          relationshipStatus: "verified",
          evidence: {
            note: `External integration dependency registered in repository analysis.`,
          },
        });
      }
    }

    // 6. Broken Connections
    if (change.changeType === "remove_service" && resolvedTarget.matchedNode) {
      const removedId = resolvedTarget.matchedNode.id;
      const severedEdges = edges.filter((e) => e.source_node_id === removedId || e.target_node_id === removedId);

      for (const edge of severedEdges) {
        const src = nodes.find((n) => n.id === edge.source_node_id)?.name || edge.source_node_id;
        const tgt = nodes.find((n) => n.id === edge.target_node_id)?.name || edge.target_node_id;
        brokenConnections.push({
          edgeId: edge.id,
          source: src,
          target: tgt,
          relationship: edge.relationship,
          reason: `Node '${resolvedTarget.matchedNode.name}' would be deleted, severing active relationship '${edge.relationship}' between '${src}' and '${tgt}'`,
        });
      }
    }

    // 7. Relevant Tests
    const analysisData = (analysis?.analysis_data ?? {}) as any;
    const testFiles = (analysisData.testFiles || []) as string[];
    const targetNameKeywords = [
      resolvedTarget.target.name.toLowerCase(),
      resolvedTarget.matchedNode?.node_key?.toLowerCase(),
      resolvedTarget.target.path?.toLowerCase(),
    ].filter(Boolean) as string[];

    for (const tf of testFiles) {
      const tfLower = tf.toLowerCase();
      const isMatch = targetNameKeywords.some((kw) => tfLower.includes(kw));

      if (isMatch) {
        relevantTests.push({
          id: tf,
          name: tf.split("/").pop() || tf,
          entityKind: "test",
          direction: "internal",
          hopDistance: 0,
          relationship: "test_suite_coverage",
          relationshipStatus: "verified",
          evidence: {
            testFiles: [tf],
            note: "Discovered test file matches target component name/path convention.",
          },
        });
      }
    }

    if (testFiles.length > 0 && relevantTests.length === 0) {
      unknownsAndAssumptions.push(
        `Repository contains ${testFiles.length} test file(s), but none explicitly match target '${resolvedTarget.target.name}'. Comprehensive regression testing is recommended.`
      );
    } else if (testFiles.length === 0) {
      unknownsAndAssumptions.push("No test files detected in repository snapshot. Automated test verification is unavailable.");
    }

    // 8. Documentation Sections Needing Updates
    const docSectionsNeedingUpdate: ImpactSummary["docSectionsNeedingUpdate"] = [];
    const neededTypes = new Set<string>(["system_design", "architecture_overview"]);

    if (relatedApis.length > 0 || change.changeType === "modify_api_contract") {
      neededTypes.add("api_documentation");
    }
    if (relatedDatabaseObjects.length > 0 || change.changeType === "replace_database" || change.changeType === "modify_schema") {
      neededTypes.add("database_documentation");
    }
    if (change.changeType === "change_auth") {
      neededTypes.add("security");
    }
    if (change.changeType === "introduce_cache" || change.changeType === "change_connection") {
      neededTypes.add("deployment");
    }

    const typeToSectionTitle: Record<string, string> = {
      architecture_overview: "Architecture Overview",
      system_design: "System Design",
      api_documentation: "API Documentation",
      database_documentation: "Database Documentation",
      security: "Security & Auth Guidelines",
      deployment: "Deployment & Infrastructure",
    };

    for (const t of neededTypes) {
      const matchingDoc = projectDocs.find((d) => d.type === t);
      docSectionsNeedingUpdate.push({
        section: typeToSectionTitle[t] || t,
        documentId: matchingDoc?.id,
        documentTitle: matchingDoc?.title,
      });
    }

    return {
      directlyAffected,
      downstreamComponents,
      relatedApis,
      relatedDatabaseObjects,
      affectedIntegrations,
      relevantTests,
      docSectionsNeedingUpdate,
      brokenConnections,
      unknownsAndAssumptions,
    };
  }

  correlateDrift(
    resolvedTarget: { target: ImpactTargetEntity; matchedNode?: ArchitectureNode },
    _change: ProposedChange,
    mappingResult: ReturnType<typeof this.computeArchitectureToCodeMapping>,
    existingDriftItems: Array<{ id: string; type: string; description: string; severity: string }>,
    _analysis: RepositoryAnalysis | null
  ): DriftCorrelationFinding[] {
    const findings: DriftCorrelationFinding[] = [];

    // Check if target node itself has uncertain or unmapped state
    if (resolvedTarget.matchedNode) {
      const mapping = mappingResult.mappings.find((m) => m.componentId === resolvedTarget.matchedNode?.id);
      if (mapping?.state === "unmapped_architecture") {
        findings.push({
          type: "missing_implementation",
          description: `Target component '${resolvedTarget.matchedNode.name}' has no verified implementation in the scanned codebase. Modifications increase architectural drift risk.`,
          severity: "high",
          component: resolvedTarget.matchedNode.name,
        });
      } else if (mapping?.state === "uncertain") {
        findings.push({
          type: "uncertain_mapping",
          description: `Target component '${resolvedTarget.matchedNode.name}' mapping to repository code is ambiguous or uncertain.`,
          severity: "medium",
          component: resolvedTarget.matchedNode.name,
        });
      }
    }

    // Match with existing drift items from previous drift runs
    const targetNameLower = resolvedTarget.target.name.toLowerCase();
    for (const item of existingDriftItems) {
      if (item.description.toLowerCase().includes(targetNameLower)) {
        findings.push({
          type: item.type,
          description: item.description,
          severity: item.severity,
          driftItemId: item.id,
          component: resolvedTarget.target.name,
        });
      }
    }

    return findings;
  }

  evaluateRiskAssessment(
    resolvedTarget: {
      target: ImpactTargetEntity;
      matchedNode?: ArchitectureNode;
      matchedEdge?: ArchitectureEdge;
    },
    change: ProposedChange,
    traversal: ReturnType<typeof this.traverseDependencyGraph>,
    impactSummary: ImpactSummary,
    driftCorrelations: DriftCorrelationFinding[],
    _mappingResult: ReturnType<typeof this.computeArchitectureToCodeMapping>,
    analysis: RepositoryAnalysis | null
  ): RiskAssessment {
    const findings: RiskFinding[] = [];

    // 1. Broken Connections / Severed Call Paths (CRITICAL)
    if (impactSummary.brokenConnections.length > 0) {
      findings.push({
        id: "risk_severed_connections",
        category: "breaking_change",
        severity: "critical",
        title: "Breaking Change: Active Connections Severed",
        description: `${impactSummary.brokenConnections.length} existing connection(s) severed without fallback`,
        evidence: impactSummary.brokenConnections.map((b) => `${b.source} -> ${b.target} (${b.relationship})`),
        rationale: "Deleting or isolating an active component breaks callers that depend on synchronous endpoints.",
        mitigation: "Establish backward-compatible proxy endpoints or deprecate callers before removal.",
      });
    }

    // 2. Authentication & Authorization Changes (CRITICAL / HIGH)
    if (change.changeType === "change_auth") {
      const isPublic = traversal.directUpstreamIds.size > 0;
      findings.push({
        id: "risk_auth_boundary",
        category: "auth_security",
        severity: isPublic ? "critical" : "high",
        title: "Security & Trust Boundary Modification",
        description: "Authentication or session verification mechanism being altered",
        evidence: [
          `Target component: ${resolvedTarget.target.name}`,
          `Callers dependent on auth: ${traversal.directUpstreamIds.size} service(s)`,
        ],
        rationale: "Authentication changes risk token invalidation, unauthorized bypass, or widespread login failures.",
        mitigation: "Implement dual-token verification during transition window and execute security penetration tests.",
      });
    }

    // 3. Database Technology / Schema Replacement (HIGH / CRITICAL)
    if (change.changeType === "replace_database" || change.changeType === "modify_schema") {
      const dependentServices = Array.from(traversal.directUpstreamIds).length;
      findings.push({
        id: "risk_db_migration",
        category: "database_integrity",
        severity: dependentServices > 2 ? "critical" : "high",
        title: "Data Store Migration & Schema Risk",
        description: `Database modification impacts ${dependentServices} direct dependent service(s)`,
        evidence: [
          `Target: ${resolvedTarget.target.name}`,
          `Affected data stores: ${impactSummary.relatedDatabaseObjects.map((d) => d.name).join(", ") || "None"}`,
        ],
        rationale: "Data store migrations risk query incompatibility, data loss, connection pool exhaustion, or migration locks.",
        mitigation: "Perform dual-write / expand-contract migration with complete rollback scripts and backup validation.",
      });
    }

    // 4. Public API Contract Modification (HIGH / MEDIUM)
    if (change.changeType === "modify_api_contract" || impactSummary.relatedApis.length > 0) {
      const routeCount = impactSummary.relatedApis.length;
      const callerCount = traversal.directUpstreamIds.size;
      findings.push({
        id: "risk_api_compatibility",
        category: "public_api_compatibility",
        severity: callerCount > 1 ? "high" : "medium",
        title: "API Interface Compatibility Risk",
        description: `Potential breaking changes across ${routeCount} API route(s) with ${callerCount} calling subsystem(s)`,
        evidence: impactSummary.relatedApis.map((a) => a.name).slice(0, 5),
        rationale: "Payload changes or HTTP status alteration without version negotiation can crash downstream clients.",
        mitigation: "Use semantic route versioning (/v2/) or non-breaking additive fields with deprecation warnings.",
      });
    }

    // 5. High Blast-Radius / Coupling (HIGH / MEDIUM)
    const totalAffectedComponents = traversal.directUpstreamIds.size + traversal.directDownstreamIds.size;
    if (totalAffectedComponents >= 4) {
      findings.push({
        id: "risk_blast_radius",
        category: "coupling_blast_radius",
        severity: totalAffectedComponents >= 6 ? "high" : "medium",
        title: "High Blast Radius Across Architecture Topology",
        description: `Change propagates directly to ${totalAffectedComponents} connected architecture component(s)`,
        evidence: [
          `Direct upstream callers: ${Array.from(traversal.directUpstreamIds).length}`,
          `Direct downstream dependencies: ${Array.from(traversal.directDownstreamIds).length}`,
        ],
        rationale: "Tightly coupled components create domino failure potential during deployment rollouts.",
        mitigation: "Decouple via asynchronous message queues or circuit breakers before deploying substantial changes.",
      });
    }

    // 6. Test Coverage Gap (HIGH / UNCERTAIN)
    let testCoverageStatus: "adequate" | "minimal" | "missing" | "uncertain" = "uncertain";
    if (!analysis) {
      testCoverageStatus = "uncertain";
      findings.push({
        id: "risk_test_uncertain",
        category: "test_gap",
        severity: "uncertain",
        title: "Test Coverage Status Unknown",
        description: "No repository analysis snapshot available to evaluate automated test suites",
        evidence: ["Architecture-only mode active"],
        rationale: "Cannot calculate test safety margin without codebase scan evidence.",
        mitigation: "Connect and analyze repository snapshot to discover automated tests.",
      });
    } else if (impactSummary.relevantTests.length === 0) {
      testCoverageStatus = "missing";
      findings.push({
        id: "risk_no_tests",
        category: "test_gap",
        severity: "high",
        title: "Lack of Relevant Automated Test Suites",
        description: "No unit or integration tests found matching the proposed change target",
        evidence: [`0 tests discovered for target '${resolvedTarget.target.name}'`],
        rationale: "Deploying changes without test verification increases regression escape probability.",
        mitigation: "Write comprehensive unit and integration tests before merging implementation code.",
      });
    } else {
      testCoverageStatus = impactSummary.relevantTests.length >= 3 ? "adequate" : "minimal";
    }

    // 7. Architectural Drift Warning (MEDIUM)
    if (driftCorrelations.length > 0) {
      findings.push({
        id: "risk_drift_correlation",
        category: "drift_deviation",
        severity: "medium",
        title: "Pre-existing Architectural Drift Detected",
        description: `${driftCorrelations.length} existing drift finding(s) correlate with target`,
        evidence: driftCorrelations.map((d) => d.description),
        rationale: "Modifying components that already diverge from code implementation compounds technical debt.",
        mitigation: "Resolve existing architectural drift items prior to introducing further structural changes.",
      });
    }

    // Calculate Overall Severity & Counts
    const severityCounts: Record<RiskSeverity, number> = {
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      uncertain: findings.filter((f) => f.severity === "uncertain").length,
    };

    let overallSeverity: RiskSeverity = "low";
    if (severityCounts.critical > 0) overallSeverity = "critical";
    else if (severityCounts.high > 0) overallSeverity = "high";
    else if (severityCounts.uncertain > 0 && severityCounts.medium === 0) overallSeverity = "uncertain";
    else if (severityCounts.medium > 0) overallSeverity = "medium";

    let evidenceCount = 0;
    for (const f of findings) evidenceCount += f.evidence.length;

    return {
      overallSeverity,
      findings,
      evidenceCount,
      testCoverageStatus,
      severityCounts,
    };
  }

  generateChangePlan(
    resolvedTarget: { target: ImpactTargetEntity; matchedNode?: ArchitectureNode },
    change: ProposedChange,
    traversal: ReturnType<typeof this.traverseDependencyGraph>,
    impactSummary: ImpactSummary,
    _riskAssessment: RiskAssessment,
    _mappingResult: ReturnType<typeof this.computeArchitectureToCodeMapping>,
    _projectDocs: any[]
  ): ChangePlan {
    const targetName = resolvedTarget.target.name;

    // 1. Pre-Change Checks
    const preChangeChecks: string[] = [
      `Audit current production metrics and error baseline for ${targetName}`,
      `Verify all dependent services (${traversal.graphData.directUpstream.join(", ") || "None"}) have passing CI runs`,
      `Review existing architectural drift items (${impactSummary.directlyAffected.length} directly affected entities)`,
      "Establish feature flag gating before code rollout",
    ];

    // 2. Affected Components & Files
    const affectedComponentsAndFiles: Array<{ name: string; file?: string; role: string }> = [];
    for (const da of impactSummary.directlyAffected) {
      affectedComponentsAndFiles.push({
        name: da.name,
        file: da.evidence.sourceFiles?.[0],
        role: "Direct Target",
      });
    }
    for (const dc of impactSummary.downstreamComponents.slice(0, 5)) {
      affectedComponentsAndFiles.push({
        name: dc.name,
        file: dc.evidence.sourceFiles?.[0],
        role: "Downstream Dependent",
      });
    }

    // 3. Implementation Tasks (Topologically ordered)
    let step = 1;
    const implementationTasks: ChangePlanTask[] = [];

    // Pre-check task
    implementationTasks.push({
      stepNumber: step++,
      title: "Establish baseline telemetry and feature flag",
      category: "pre_check",
      description: "Create toggle flag and verify current service health metrics before code edits.",
      requirementLevel: "confirmed",
      targetFiles: [],
      dependencies: [],
    });

    // Database task if applicable
    if (change.changeType === "replace_database" || change.changeType === "modify_schema") {
      implementationTasks.push({
        stepNumber: step++,
        title: "Draft backward-compatible database migration scripts",
        category: "database",
        description: "Author additive column/table migration scripts with idempotency and rollback files.",
        requirementLevel: "confirmed",
        targetFiles: [],
        dependencies: [1],
      });
    }

    // Core implementation task
    implementationTasks.push({
      stepNumber: step++,
      title: `Implement proposed change in '${targetName}'`,
      category: "implementation",
      description: `Implement ${change.description} preserving contract compatibility for dependent callers.`,
      requirementLevel: "confirmed",
      targetFiles: impactSummary.directlyAffected[0]?.evidence.sourceFiles || [],
      dependencies: [1],
    });

    // API compatibility task
    if (change.changeType === "modify_api_contract" || impactSummary.relatedApis.length > 0) {
      implementationTasks.push({
        stepNumber: step++,
        title: "Update API schemas and contract definitions",
        category: "api",
        description: "Ensure response payloads maintain backward compatibility or provide version headers.",
        requirementLevel: "confirmed",
        targetFiles: impactSummary.relatedApis.flatMap((a) => a.evidence.sourceFiles || []),
        dependencies: [step - 2],
      });
    }

    // Testing task
    implementationTasks.push({
      stepNumber: step++,
      title: `Update and execute unit & regression test suites`,
      category: "test",
      description: `Verify that all modified endpoints pass unit and integration assertions.`,
      requirementLevel: "confirmed",
      targetFiles: impactSummary.relevantTests.flatMap((t) => t.evidence.testFiles || []),
      dependencies: [step - 2],
    });

    // Documentation task
    implementationTasks.push({
      stepNumber: step++,
      title: "Update architecture and API documentation",
      category: "documentation",
      description: `Review and regenerate outdated documentation sections in ArchForge.`,
      requirementLevel: "recommended",
      targetFiles: [],
      dependencies: [step - 2],
    });

    // Verification task
    implementationTasks.push({
      stepNumber: step++,
      title: "Staging deployment and verification probe",
      category: "verification",
      description: "Deploy to staging environment; run automated smoke probes and monitor latency deltas.",
      requirementLevel: "confirmed",
      targetFiles: [],
      dependencies: [step - 2],
    });

    // Rollback task
    implementationTasks.push({
      stepNumber: step++,
      title: "Confirm rollback readiness and runbook",
      category: "rollback",
      description: "Ensure fast toggle disablement and database migration down scripts are validated.",
      requirementLevel: "confirmed",
      targetFiles: [],
      dependencies: [],
    });

    // 4. Database considerations
    const databaseConsiderations: string[] = [
      "All schema alterations must be backward-compatible (additive only in first deployment).",
      "Validate connection pooling limits to avoid starvation under peak load.",
      "Execute database migrations using transactional DDL where supported.",
      "Ensure automated backup snapshot completed prior to applying migrations.",
    ];

    // 5. API considerations
    const apiCompatibilityConsiderations: string[] = [
      "Preserve existing required fields on JSON response models.",
      "Provide deprecation headers (Sunset / Deprecation: Sun, 12 Oct 2026) for obsolete endpoints.",
      "Maintain existing HTTP error contracts and status codes.",
      "Update OpenAPI / Swagger specifications and distribute updated TypeScript types.",
    ];

    // 6. Tests to update or create
    const testsToUpdateOrCreate: ChangePlan["testsToUpdateOrCreate"] = [
      {
        testFile: impactSummary.relevantTests[0]?.evidence.testFiles?.[0],
        description: `Unit test assertions for ${targetName} logic updates`,
        type: "unit",
      },
      {
        description: `Integration contract test validating callers (${traversal.graphData.directUpstream.slice(0, 3).join(", ") || "frontend"})`,
        type: "integration",
      },
      {
        description: "End-to-end regression test for critical user journey",
        type: "regression",
      },
    ];

    // 7. Documentation to update
    const documentationToUpdate: ChangePlan["documentationToUpdate"] = impactSummary.docSectionsNeedingUpdate.map(
      (sec) => ({
        docType: sec.section.toLowerCase().replace(/ /g, "_"),
        title: sec.section,
        docId: sec.documentId,
        reason: `Reflects architectural changes to ${targetName} and related interfaces.`,
      })
    );

    // 8. Verification steps
    const verificationSteps: string[] = [
      "Verify HTTP 200 healthcheck probes across all running pods/instances.",
      "Confirm zero uncaught exceptions in centralized log streams during 30-minute canary window.",
      "Inspect p95 and p99 latency metrics to confirm SLA compliance.",
      "Verify database connection metrics remain within normal operating thresholds.",
    ];

    // 9. Rollback considerations
    const rollbackConsiderations: string[] = [
      "Toggle feature flag off if error rate exceeds 1% threshold.",
      "Revert application container image to preceding immutable tag.",
      "Verify schema changes are non-destructive so rollback requires no data migration rollback.",
    ];

    return {
      summary: `Actionable engineering change plan for proposing '${change.description}' on target '${targetName}'.`,
      preChangeChecks,
      affectedComponentsAndFiles,
      implementationTasks,
      databaseConsiderations,
      apiCompatibilityConsiderations,
      testsToUpdateOrCreate,
      documentationToUpdate,
      verificationSteps,
      rollbackConsiderations,
    };
  }

  formulatePlaygroundBridge(
    resolvedTarget: { target: ImpactTargetEntity; matchedNode?: ArchitectureNode },
    change: ProposedChange,
    _nodes: ArchitectureNode[],
    _impactSummary: ImpactSummary
  ): PlaygroundSimulationBridge {
    const candidateChanges: Array<Record<string, unknown>> = [];
    const targetName = resolvedTarget.matchedNode?.name || resolvedTarget.target.name;

    switch (change.changeType) {
      case "introduce_cache":
        candidateChanges.push({
          type: "introduce_cache",
          name: `${targetName} Cache`,
          technology: "Redis 7.2",
          target: targetName,
          responsibility: `Read cache layer for ${targetName}`,
        });
        break;

      case "replace_database":
        candidateChanges.push({
          type: "change_database_technology",
          target: targetName,
          technology: (change.details?.technology as string) || "PostgreSQL 16 HA",
          responsibility: `High-availability managed database for ${targetName}`,
        });
        break;

      case "remove_service":
        candidateChanges.push({
          type: "remove_service",
          target: targetName,
        });
        break;

      case "change_auth":
        candidateChanges.push({
          type: "change_authentication",
          target: targetName,
          details: { mechanism: "OAuth2 / JWT" },
        });
        break;

      case "update_external_integration":
        candidateChanges.push({
          type: "add_external_integration",
          name: (change.details?.integration as string) || "External Integration",
          target: targetName,
        });
        break;

      default:
        candidateChanges.push({
          type: "modify_api",
          target: targetName,
          details: { changeType: change.changeType, description: change.description },
        });
        break;
    }

    return {
      supported: true,
      simulationCandidateChanges: candidateChanges as any,
      evaluableMetrics: [
        "Network latency score & sync call chain hops",
        "Single Points of Failure (SPOFs) count",
        "Relative infrastructure compute cost index",
        "Architecture complexity & coupling index",
        "Attack surface count & trust boundaries",
        "Estimated engineering development days",
      ],
      unevaluableMetrics: [
        "Dynamic runtime production QPS & burst concurrency",
        "Process heap memory fragmentation & GC pause duration",
        "Third-party vendor network transit jitter",
      ],
      explanation:
        "ArchForge Engineering Playground can simulate the structural, performance hop, cost index, and coupling deltas of this change without mutating production infrastructure or saved architecture versions.",
    };
  }
}

export const engineeringImpactService = new EngineeringImpactService();

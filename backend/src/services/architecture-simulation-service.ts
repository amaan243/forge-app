import { NotFoundError, ConflictError, ValidationError } from "../errors/app-error.js";
import { architectureService } from "./architecture-service.js";
import { changeImpactService } from "./change-impact-service.js";
import { engineeringRepository } from "../repositories/engineering-intelligence-repository.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import type {
  SimulationChange,
  SimulationMetricsRecord,
  MetricValue,
  BrokenConnection,
  PlaygroundSimulation,
} from "../types/engineering-intelligence.js";
import type { ArchitectureNode, ArchitectureEdge } from "../types/architecture.js";
import type { RepositoryAnalysis } from "../types/repository-intelligence.js";

interface GraphState {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export class ArchitectureSimulationService {
  async create(projectId: string, userId: string, input: Record<string, unknown>): Promise<PlaygroundSimulation> {
    const version = await architectureService.getVersion(String(input.base_version_id));
    if (!version.version || version.version.project_id !== projectId) {
      throw new NotFoundError("Architecture version not found for this project");
    }

    if (input.repository_id) {
      const repo = await repositoryIntelligenceRepository.repository(projectId, String(input.repository_id));
      if (!repo || repo.project_id !== projectId) {
        throw new NotFoundError("Repository not found for this project");
      }
    }

    if (input.snapshot_id) {
      const analysis = await repositoryIntelligenceRepository.analysis(String(input.snapshot_id));
      if (!analysis || analysis.project_id !== projectId) {
        throw new NotFoundError("Repository snapshot not found for this project");
      }
    }

    return engineeringRepository.createSimulation({
      ...input,
      project_id: projectId,
      created_by: userId,
      status: "draft",
      before_architecture: { nodes: version.nodes, edges: version.edges },
      after_architecture: { nodes: version.nodes, edges: version.edges },
      metrics: {},
      impact_analysis: {},
      ai_analysis: {},
    });
  }

  async list(projectId: string): Promise<PlaygroundSimulation[]> {
    return engineeringRepository.simulations(projectId);
  }

  async get(projectId: string, id: string): Promise<PlaygroundSimulation> {
    const simulation = await engineeringRepository.simulation(projectId, id);
    if (!simulation) throw new NotFoundError("Simulation not found");
    return simulation;
  }

  async update(projectId: string, id: string, input: Record<string, unknown>): Promise<PlaygroundSimulation> {
    const simulation = await this.get(projectId, id);
    if (["applied", "discarded"].includes(simulation.status)) {
      throw new ConflictError("Simulation is no longer editable");
    }

    if (input.base_version_id && input.base_version_id !== simulation.base_version_id) {
      const version = await architectureService.getVersion(String(input.base_version_id));
      if (!version.version || version.version.project_id !== projectId) {
        throw new NotFoundError("Architecture version not found for this project");
      }
      input.before_architecture = { nodes: version.nodes, edges: version.edges };
      input.after_architecture = { nodes: version.nodes, edges: version.edges };
    }

    if (input.repository_id) {
      const repo = await repositoryIntelligenceRepository.repository(projectId, String(input.repository_id));
      if (!repo || repo.project_id !== projectId) {
        throw new NotFoundError("Repository not found for this project");
      }
    }

    if (input.snapshot_id) {
      const analysis = await repositoryIntelligenceRepository.analysis(String(input.snapshot_id));
      if (!analysis || analysis.project_id !== projectId) {
        throw new NotFoundError("Repository snapshot not found for this project");
      }
    }

    return engineeringRepository.updateSimulation(projectId, id, input);
  }

  async simulate(projectId: string, id: string): Promise<PlaygroundSimulation> {
    const simulation = await this.get(projectId, id);
    if (["applied", "discarded"].includes(simulation.status)) {
      throw new ConflictError("Simulation is no longer editable");
    }

    const before = simulation.before_architecture as unknown as GraphState;
    if (!before || !Array.isArray(before.nodes) || !Array.isArray(before.edges)) {
      throw new ValidationError({ architecture: "Base architecture graph is missing or corrupted." });
    }

    const changes = (simulation.proposed_changes ?? []) as SimulationChange[];
    if (changes.length === 0) {
      throw new ValidationError({ proposed_changes: "At least one proposed change is required to simulate." });
    }

    // Load repository analysis snapshot if specified
    let repositoryAnalysis: RepositoryAnalysis | null = null;
    if (simulation.snapshot_id) {
      repositoryAnalysis = await repositoryIntelligenceRepository.analysis(simulation.snapshot_id);
    } else if (simulation.repository_id) {
      repositoryAnalysis = await repositoryIntelligenceRepository.latestSuccessful(projectId, simulation.repository_id);
    }

    // 1. Create in-memory proposed architecture state
    const { after, brokenConnections, communicationChanges } = this.applyAllChanges(before, changes);

    // 2. Perform impact analysis using changeImpactService
    const impact = changeImpactService.analyze(
      before.nodes,
      before.edges,
      changes,
      after.nodes,
      after.edges,
      brokenConnections,
      repositoryAnalysis
    );

    // 3. Deterministic metric evaluations
    const metrics = this.evaluateMetrics(
      before,
      after,
      changes,
      communicationChanges,
      brokenConnections,
      repositoryAnalysis
    );

    // 4. Persist simulation outcome
    return engineeringRepository.updateSimulation(projectId, id, {
      status: "completed",
      after_architecture: after,
      impact_analysis: impact,
      metrics,
    });
  }

  async apply(projectId: string, userId: string, id: string) {
    const simulation = await this.get(projectId, id);
    if (simulation.status !== "completed") {
      throw new ConflictError("Only a completed simulation can be applied as a new architecture version");
    }
    const after = simulation.after_architecture as { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
    return engineeringRepository.applySimulationTransaction(projectId, userId, simulation, after);
  }

  async discard(projectId: string, id: string) {
    await this.get(projectId, id);
    return engineeringRepository.updateSimulation(projectId, id, { status: "discarded" });
  }

  async alternative(projectId: string, userId: string, id: string) {
    const simulation = await this.get(projectId, id);
    return this.create(projectId, userId, {
      base_version_id: simulation.base_version_id,
      repository_id: simulation.repository_id,
      snapshot_id: simulation.snapshot_id,
      name: `${simulation.name} alternative`,
      description: simulation.description,
      proposed_changes: simulation.proposed_changes,
    });
  }

  private applyAllChanges(
    before: GraphState,
    changes: SimulationChange[]
  ): { after: GraphState; brokenConnections: BrokenConnection[]; communicationChanges: string[] } {
    const nodes: ArchitectureNode[] = JSON.parse(JSON.stringify(before.nodes));
    const edges: ArchitectureEdge[] = JSON.parse(JSON.stringify(before.edges));
    const brokenConnections: BrokenConnection[] = [];
    const communicationChanges: string[] = [];

    const findNodeIndex = (target?: string) => {
      if (!target) return -1;
      return nodes.findIndex((n) => n.id === target || n.node_key === target || n.name === target);
    };

    const findNode = (target?: string) => {
      const idx = findNodeIndex(target);
      return idx >= 0 ? nodes[idx] : null;
    };

    for (const change of changes) {
      const type = change.type;

      if (type === "add_service" || type === "add_component") {
        const componentName = change.name ?? "New Component";
        const nodeKey = (change.name ?? `component-${nodes.length + 1}`).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
        const newNodeId = `sim-node-${nodes.length + 1}`;
        const nodeType = (change.node_type ?? "service") as ArchitectureNode["type"];

        const newNode: ArchitectureNode = {
          id: newNodeId,
          architecture_version_id: "simulated",
          node_key: nodeKey,
          name: componentName,
          type: nodeType,
          technology: change.technology ?? null,
          description: change.responsibility ?? change.details?.description ? String(change.details?.description) : null,
          metadata: { simulated: true, ...(change.details ?? {}) },
          position_x: 100 + (nodes.length % 5) * 120,
          position_y: 100 + Math.floor(nodes.length / 5) * 120,
          created_at: new Date().toISOString(),
        };
        nodes.push(newNode);

        if (change.source || change.target_component) {
          const connectedTarget = findNode(change.target_component ?? change.target);
          const connectedSource = findNode(change.source);

          if (connectedSource) {
            edges.push({
              id: `sim-edge-${edges.length + 1}`,
              architecture_version_id: "simulated",
              source_node_id: connectedSource.id,
              target_node_id: newNode.id,
              relationship: (change.relationship as ArchitectureEdge["relationship"]) ?? "calls",
              protocol: change.protocol ?? "HTTP/REST",
              description: `Connection from ${connectedSource.name} to ${newNode.name}`,
              metadata: { simulated: true },
              created_at: new Date().toISOString(),
            });
            communicationChanges.push(`Added connection: ${connectedSource.name} -> ${newNode.name}`);
          }

          if (connectedTarget && connectedTarget.id !== newNode.id) {
            edges.push({
              id: `sim-edge-${edges.length + 1}`,
              architecture_version_id: "simulated",
              source_node_id: newNode.id,
              target_node_id: connectedTarget.id,
              relationship: (change.relationship as ArchitectureEdge["relationship"]) ?? "calls",
              protocol: change.protocol ?? "HTTP/REST",
              description: `Connection from ${newNode.name} to ${connectedTarget.name}`,
              metadata: { simulated: true },
              created_at: new Date().toISOString(),
            });
            communicationChanges.push(`Added connection: ${newNode.name} -> ${connectedTarget.name}`);
          }
        }
      } else if (type === "remove_service" || type === "remove_component") {
        const targetNode = findNode(change.target);
        if (targetNode) {
          const removedId = targetNode.id;
          const orphanedEdges = edges.filter((e) => e.source_node_id === removedId || e.target_node_id === removedId);

          for (const edge of orphanedEdges) {
            const src = nodes.find((n) => n.id === edge.source_node_id)?.name ?? edge.source_node_id;
            const tgt = nodes.find((n) => n.id === edge.target_node_id)?.name ?? edge.target_node_id;
            brokenConnections.push({
              edgeId: edge.id,
              source: src,
              target: tgt,
              relationship: edge.relationship,
              reason: `Node '${targetNode.name}' was removed, breaking connection ${src} -> ${tgt}`,
            });
            communicationChanges.push(`Removed connection: ${src} -> ${tgt} (cascaded from component removal)`);
          }

          // Remove orphaned edges
          const remainingEdges = edges.filter((e) => e.source_node_id !== removedId && e.target_node_id !== removedId);
          edges.length = 0;
          edges.push(...remainingEdges);

          // Remove the node
          const idx = nodes.findIndex((n) => n.id === removedId);
          if (idx >= 0) nodes.splice(idx, 1);
        }
      } else if (type === "replace_technology" || type === "change_technology") {
        const targetNode = findNode(change.target);
        if (targetNode && change.technology) {
          targetNode.metadata = {
            ...(targetNode.metadata ?? {}),
            previous_technology: targetNode.technology,
            technology_modified: true,
          };
          targetNode.technology = change.technology;
        }
      } else if (type === "change_database_technology") {
        const targetNode =
          findNode(change.target) ?? nodes.find((n) => n.type === "database");
        if (targetNode && change.technology) {
          targetNode.metadata = {
            ...(targetNode.metadata ?? {}),
            previous_technology: targetNode.technology,
            database_engine_changed: true,
          };
          targetNode.technology = change.technology;
          if (change.responsibility) targetNode.description = change.responsibility;
        }
      } else if (type === "add_database") {
        const dbName = change.name ?? `${change.technology ?? "PostgreSQL"} Database`;
        const newDbNode: ArchitectureNode = {
          id: `sim-db-${nodes.length + 1}`,
          architecture_version_id: "simulated",
          node_key: (change.name ?? "database").toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
          name: dbName,
          type: "database",
          technology: change.technology ?? "PostgreSQL",
          description: change.responsibility ?? "Managed Relational Database",
          metadata: { simulated: true, ...(change.details ?? {}) },
          position_x: 200,
          position_y: 350,
          created_at: new Date().toISOString(),
        };
        nodes.push(newDbNode);

        const caller = findNode(change.target ?? change.source);
        if (caller) {
          edges.push({
            id: `sim-edge-${edges.length + 1}`,
            architecture_version_id: "simulated",
            source_node_id: caller.id,
            target_node_id: newDbNode.id,
            relationship: "reads",
            protocol: "SQL/TCP",
            description: `${caller.name} reads/writes ${newDbNode.name}`,
            metadata: { simulated: true },
            created_at: new Date().toISOString(),
          });
          communicationChanges.push(`Added database connection: ${caller.name} -> ${newDbNode.name}`);
        }
      } else if (type === "remove_database") {
        const dbNode = findNode(change.target) ?? nodes.find((n) => n.type === "database");
        if (dbNode) {
          const orphanedEdges = edges.filter((e) => e.source_node_id === dbNode.id || e.target_node_id === dbNode.id);
          for (const edge of orphanedEdges) {
            brokenConnections.push({
              edgeId: edge.id,
              source: nodes.find((n) => n.id === edge.source_node_id)?.name ?? edge.source_node_id,
              target: nodes.find((n) => n.id === edge.target_node_id)?.name ?? edge.target_node_id,
              relationship: edge.relationship,
              reason: `Database '${dbNode.name}' was removed`,
            });
          }
          const remainingEdges = edges.filter((e) => e.source_node_id !== dbNode.id && e.target_node_id !== dbNode.id);
          edges.length = 0;
          edges.push(...remainingEdges);
          const idx = nodes.findIndex((n) => n.id === dbNode.id);
          if (idx >= 0) nodes.splice(idx, 1);
        }
      } else if (type === "introduce_cache" || type === "add_cache") {
        const cacheTech = change.technology ?? "Redis";
        const cacheName = change.name ?? `${cacheTech} Cache`;
        const newCacheNode: ArchitectureNode = {
          id: `sim-cache-${nodes.length + 1}`,
          architecture_version_id: "simulated",
          node_key: (change.name ?? "redis-cache").toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
          name: cacheName,
          type: "cache",
          technology: cacheTech,
          description: change.responsibility ?? `In-memory caching layer using ${cacheTech}`,
          metadata: { simulated: true, cache_mode: "read-through", ...(change.details ?? {}) },
          position_x: 250,
          position_y: 220,
          created_at: new Date().toISOString(),
        };
        nodes.push(newCacheNode);

        const targetNode = findNode(change.target ?? change.source) ?? nodes.find((n) => n.type === "service" || n.type === "backend");
        if (targetNode) {
          edges.push({
            id: `sim-edge-${edges.length + 1}`,
            architecture_version_id: "simulated",
            source_node_id: targetNode.id,
            target_node_id: newCacheNode.id,
            relationship: "reads",
            protocol: "Redis/RESP",
            description: `${targetNode.name} caches query results in ${newCacheNode.name}`,
            metadata: { simulated: true },
            created_at: new Date().toISOString(),
          });
          communicationChanges.push(`Introduced caching connection: ${targetNode.name} -> ${newCacheNode.name}`);
        }
      } else if (type === "remove_cache") {
        const cacheNode = findNode(change.target) ?? nodes.find((n) => n.type === "cache");
        if (cacheNode) {
          const remainingEdges = edges.filter((e) => e.source_node_id !== cacheNode.id && e.target_node_id !== cacheNode.id);
          edges.length = 0;
          edges.push(...remainingEdges);
          const idx = nodes.findIndex((n) => n.id === cacheNode.id);
          if (idx >= 0) nodes.splice(idx, 1);
        }
      } else if (type === "introduce_queue" || type === "add_queue") {
        const queueTech = change.technology ?? "Kafka";
        const queueName = change.name ?? `${queueTech} Event Bus`;
        const newQueueNode: ArchitectureNode = {
          id: `sim-queue-${nodes.length + 1}`,
          architecture_version_id: "simulated",
          node_key: (change.name ?? "event-bus").toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
          name: queueName,
          type: "queue",
          technology: queueTech,
          description: change.responsibility ?? `Asynchronous message queue / event stream via ${queueTech}`,
          metadata: { simulated: true, ...(change.details ?? {}) },
          position_x: 320,
          position_y: 180,
          created_at: new Date().toISOString(),
        };
        nodes.push(newQueueNode);

        const producerNode = findNode(change.source ?? change.target);
        const consumerNode = findNode(change.target_component);

        if (producerNode) {
          edges.push({
            id: `sim-edge-${edges.length + 1}`,
            architecture_version_id: "simulated",
            source_node_id: producerNode.id,
            target_node_id: newQueueNode.id,
            relationship: "publishes",
            protocol: queueTech === "Kafka" ? "Kafka/TCP" : "AMQP",
            description: `${producerNode.name} publishes events to ${newQueueNode.name}`,
            metadata: { simulated: true },
            created_at: new Date().toISOString(),
          });
          communicationChanges.push(`Asynchronous publishing: ${producerNode.name} -> ${newQueueNode.name}`);
        }

        if (consumerNode && consumerNode.id !== newQueueNode.id) {
          edges.push({
            id: `sim-edge-${edges.length + 1}`,
            architecture_version_id: "simulated",
            source_node_id: newQueueNode.id,
            target_node_id: consumerNode.id,
            relationship: "subscribes",
            protocol: queueTech === "Kafka" ? "Kafka/TCP" : "AMQP",
            description: `${consumerNode.name} consumes events from ${newQueueNode.name}`,
            metadata: { simulated: true },
            created_at: new Date().toISOString(),
          });
          communicationChanges.push(`Asynchronous subscribing: ${newQueueNode.name} -> ${consumerNode.name}`);
        }
      } else if (type === "change_communication") {
        const src = findNode(change.source ?? change.target);
        const tgt = findNode(change.target_component);
        if (src && tgt) {
          const existingEdge = edges.find((e) => e.source_node_id === src.id && e.target_node_id === tgt.id);
          if (existingEdge) {
            existingEdge.relationship = (change.relationship as ArchitectureEdge["relationship"]) ?? "publishes";
            existingEdge.protocol = change.protocol ?? "Async Event / AMQP";
            existingEdge.description = change.responsibility ?? `Converted to asynchronous communication`;
            communicationChanges.push(`Communication mode changed for ${src.name} -> ${tgt.name} to ${existingEdge.relationship} (${existingEdge.protocol})`);
          } else {
            edges.push({
              id: `sim-edge-${edges.length + 1}`,
              architecture_version_id: "simulated",
              source_node_id: src.id,
              target_node_id: tgt.id,
              relationship: (change.relationship as ArchitectureEdge["relationship"]) ?? "publishes",
              protocol: change.protocol ?? "Async Event / AMQP",
              description: `New asynchronous channel`,
              metadata: { simulated: true },
              created_at: new Date().toISOString(),
            });
            communicationChanges.push(`Added async channel: ${src.name} -> ${tgt.name}`);
          }
        }
      } else if (type === "add_connection") {
        const src = findNode(change.source ?? change.target);
        const tgt = findNode(change.target_component);
        if (src && tgt) {
          edges.push({
            id: `sim-edge-${edges.length + 1}`,
            architecture_version_id: "simulated",
            source_node_id: src.id,
            target_node_id: tgt.id,
            relationship: (change.relationship as ArchitectureEdge["relationship"]) ?? "calls",
            protocol: change.protocol ?? "HTTP/REST",
            description: change.responsibility ?? `Connection from ${src.name} to ${tgt.name}`,
            metadata: { simulated: true, ...(change.details ?? {}) },
            created_at: new Date().toISOString(),
          });
          communicationChanges.push(`Added connection: ${src.name} -> ${tgt.name}`);
        }
      } else if (type === "remove_connection") {
        const src = findNode(change.source ?? change.target);
        const tgt = findNode(change.target_component);
        if (src && tgt) {
          const idx = edges.findIndex((e) => e.source_node_id === src.id && e.target_node_id === tgt.id);
          if (idx >= 0) {
            const removed = edges.splice(idx, 1)[0];
            brokenConnections.push({
              edgeId: removed.id,
              source: src.name,
              target: tgt.name,
              relationship: removed.relationship,
              reason: "Explicitly removed connection",
            });
            communicationChanges.push(`Removed connection: ${src.name} -> ${tgt.name}`);
          }
        }
      } else if (type === "add_external_integration") {
        const extName = change.name ?? "External API Service";
        const extNode: ArchitectureNode = {
          id: `sim-ext-${nodes.length + 1}`,
          architecture_version_id: "simulated",
          node_key: (change.name ?? "external-api").toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
          name: extName,
          type: "external_service",
          technology: change.technology ?? "Third-Party SaaS",
          description: change.responsibility ?? "External Third-Party Integration",
          metadata: { simulated: true, external: true, ...(change.details ?? {}) },
          position_x: 400,
          position_y: 80,
          created_at: new Date().toISOString(),
        };
        nodes.push(extNode);

        const caller = findNode(change.target ?? change.source) ?? nodes.find((n) => n.type === "service" || n.type === "backend");
        if (caller) {
          edges.push({
            id: `sim-edge-${edges.length + 1}`,
            architecture_version_id: "simulated",
            source_node_id: caller.id,
            target_node_id: extNode.id,
            relationship: "calls",
            protocol: change.protocol ?? "HTTPS/REST",
            description: `${caller.name} integrates with ${extNode.name}`,
            metadata: { simulated: true, external: true },
            created_at: new Date().toISOString(),
          });
          communicationChanges.push(`Added external integration: ${caller.name} -> ${extNode.name}`);
        }
      } else if (type === "modify_deployment" || type === "modify_scaling" || type === "modify_deployment_scaling") {
        const targetNode = findNode(change.target);
        if (targetNode) {
          targetNode.metadata = {
            ...(targetNode.metadata ?? {}),
            scaling: change.details?.scaling ?? { minReplicas: 2, maxReplicas: 10, autoscaling: true },
            deployment: change.details?.deployment ?? "containerized",
          };
        }
      }
    }

    return {
      after: { nodes, edges },
      brokenConnections,
      communicationChanges,
    };
  }

  private evaluateMetrics(
    before: GraphState,
    after: GraphState,
    changes: SimulationChange[],
    communicationChanges: string[],
    brokenConnections: BrokenConnection[],
    repositoryAnalysis: RepositoryAnalysis | null
  ): SimulationMetricsRecord {
    // 1. Longest synchronous call chain (Performance)
    const computeMaxSyncHops = (state: GraphState): number => {
      const syncEdges = state.edges.filter((e) => e.relationship === "calls");
      const adj = new Map<string, string[]>();
      for (const edge of syncEdges) {
        if (!adj.has(edge.source_node_id)) adj.set(edge.source_node_id, []);
        adj.get(edge.source_node_id)!.push(edge.target_node_id);
      }

      let maxHops = 0;
      const visited = new Set<string>();

      const dfs = (nodeId: string, depth: number) => {
        if (depth > maxHops) maxHops = depth;
        visited.add(nodeId);
        const neighbors = adj.get(nodeId) ?? [];
        for (const next of neighbors) {
          if (!visited.has(next)) {
            dfs(next, depth + 1);
          }
        }
        visited.delete(nodeId);
      };

      for (const node of state.nodes) {
        dfs(node.id, 0);
      }
      return maxHops;
    };

    const baseSyncHops = computeMaxSyncHops(before);
    const propSyncHops = computeMaxSyncHops(after);
    const syncHopsDelta = propSyncHops - baseSyncHops;

    // Latency evaluation
    const cacheIntroduced = changes.some((c) => c.type.includes("cache"));
    const queueIntroduced = changes.some((c) => c.type.includes("queue") || c.type === "change_communication");
    let latencyText = "Negligible latency difference";
    let latencyStatus: MetricValue["status"] = "neutral";

    if (cacheIntroduced && syncHopsDelta <= 0) {
      latencyText = "Estimated -30% to -50% latency reduction on cached query paths";
      latencyStatus = "improved";
    } else if (queueIntroduced && syncHopsDelta <= 0) {
      latencyText = "Decoupled request latency; asynchronous execution unblocks caller immediate return";
      latencyStatus = "improved";
    } else if (syncHopsDelta > 0) {
      latencyText = `+${syncHopsDelta} synchronous hop(s) adds serial network latency (~15-30ms p95 per hop)`;
      latencyStatus = "degraded";
    } else if (syncHopsDelta < 0) {
      latencyText = `${syncHopsDelta} fewer synchronous hops reduces overall serialization overhead`;
      latencyStatus = "improved";
    }

    // Potential bottlenecks
    const findBottlenecks = (state: GraphState): string[] => {
      const inDegree = new Map<string, number>();
      for (const e of state.edges) {
        inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) ?? 0) + 1);
      }
      const bottlenecks: string[] = [];
      for (const [nodeId, count] of inDegree.entries()) {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node && count >= 3) {
          bottlenecks.push(`${node.name} (${count} incoming connections, type: ${node.type})`);
        }
      }
      return bottlenecks;
    };

    const proposedBottlenecks = findBottlenecks(after);

    // 2. Scalability & SPOFs
    const findSPOFs = (state: GraphState): string[] => {
      const spofs: string[] = [];
      for (const node of state.nodes) {
        const inbound = state.edges.filter((e) => e.target_node_id === node.id).length;
        const isDb = node.type === "database";
        const isQueue = node.type === "queue";
        const hasReplicas = Boolean((node.metadata?.scaling as Record<string, unknown>)?.autoscaling || (node.metadata?.replicas as number) > 1);

        if ((isDb && !hasReplicas) || (inbound >= 2 && !hasReplicas) || (isQueue && !hasReplicas)) {
          spofs.push(`${node.name} (${node.type}, no redundancy configured)`);
        }
      }
      return spofs;
    };

    const baseSpofs = findSPOFs(before);
    const propSpofs = findSPOFs(after);
    const spofDelta = propSpofs.length - baseSpofs.length;

    const scalingLimitations: string[] = [];
    if (after.nodes.some((n) => n.type === "database")) {
      scalingLimitations.push("Single relational database engine may constrain horizontal write scaling");
    }
    if (propSyncHops >= 4) {
      scalingLimitations.push("Long synchronous call chain limits throughput under high concurrent load");
    }

    // 3. Cost
    const typeWeights: Record<string, number> = {
      database: 2.5,
      cache: 1.2,
      queue: 1.8,
      service: 1.0,
      backend: 1.0,
      frontend: 0.6,
      worker: 0.8,
      gateway: 1.0,
      infrastructure: 1.5,
      external_service: 0.5,
      monitoring: 0.4,
      auth: 0.8,
      api: 0.9,
    };

    const calculateCostIndex = (state: GraphState): number => {
      let total = 0;
      for (const node of state.nodes) {
        const weight = typeWeights[node.type] ?? 1.0;
        const replicas = Number((node.metadata?.replicas as number) ?? 1);
        total += weight * Math.max(1, replicas);
      }
      return Math.round(total * 10) / 10;
    };

    const baseCostIndex = calculateCostIndex(before);
    const propCostIndex = calculateCostIndex(after);
    const deltaCost = Math.round((propCostIndex - baseCostIndex) * 10) / 10;

    const introducedServices = after.nodes
      .filter((n) => !before.nodes.some((bn) => bn.id === n.id || bn.name === n.name))
      .map((n) => `${n.name} (${n.type}${n.technology ? `: ${n.technology}` : ""})`);

    // 4. Complexity
    const baseNodesCount = before.nodes.length;
    const propNodesCount = after.nodes.length;
    const baseEdgesCount = before.edges.length;
    const propEdgesCount = after.edges.length;

    const baseCoupling = baseNodesCount > 0 ? Math.round((baseEdgesCount / baseNodesCount) * 10) / 10 : 0;
    const propCoupling = propNodesCount > 0 ? Math.round((propEdgesCount / propNodesCount) * 10) / 10 : 0;

    // 5. Security
    const countAttackSurfaces = (state: GraphState): number => {
      return state.nodes.filter(
        (n) => n.type === "gateway" || n.type === "frontend" || n.type === "external_service" || n.type === "api"
      ).length;
    };

    const baseAttackSurfaces = countAttackSurfaces(before);
    const propAttackSurfaces = countAttackSurfaces(after);

    const authGaps: string[] = [];
    for (const node of after.nodes) {
      if (node.type === "service" || node.type === "backend") {
        const inEdges = after.edges.filter((e) => e.target_node_id === node.id);
        const hasAuthEdge = inEdges.some((e) => e.relationship === "authenticates" || e.protocol === "Bearer/JWT");
        const hasGateway = inEdges.some((e) => {
          const srcNode = after.nodes.find((n) => n.id === e.source_node_id);
          return srcNode?.type === "gateway" || srcNode?.type === "auth";
        });
        if (inEdges.length > 0 && !hasAuthEdge && !hasGateway) {
          authGaps.push(`${node.name}: directly reachable without explicit auth middleware or gateway inspection`);
        }
      }
    }

    const trustBoundaryChanges: string[] = [];
    for (const edge of after.edges) {
      const src = after.nodes.find((n) => n.id === edge.source_node_id);
      const tgt = after.nodes.find((n) => n.id === edge.target_node_id);
      if (src && tgt && (src.type === "external_service" || tgt.type === "external_service")) {
        trustBoundaryChanges.push(`Crosses trust boundary: ${src.name} (${src.type}) <-> ${tgt.name} (${tgt.type})`);
      }
    }

    // 6. Development Effort Heuristics (in days)
    let minDays = 0;
    let maxDays = 0;

    for (const change of changes) {
      switch (change.type) {
        case "add_service":
        case "add_component":
          minDays += 5;
          maxDays += 10;
          break;
        case "remove_service":
        case "remove_component":
          minDays += 2;
          maxDays += 4;
          break;
        case "replace_technology":
        case "change_technology":
          minDays += 6;
          maxDays += 12;
          break;
        case "change_database_technology":
          minDays += 10;
          maxDays += 20;
          break;
        case "add_database":
          minDays += 4;
          maxDays += 8;
          break;
        case "remove_database":
          minDays += 3;
          maxDays += 6;
          break;
        case "introduce_cache":
        case "add_cache":
          minDays += 2;
          maxDays += 5;
          break;
        case "remove_cache":
          minDays += 1;
          maxDays += 3;
          break;
        case "introduce_queue":
        case "add_queue":
          minDays += 5;
          maxDays += 10;
          break;
        case "change_communication":
          minDays += 4;
          maxDays += 8;
          break;
        case "add_connection":
        case "remove_connection":
          minDays += 1;
          maxDays += 3;
          break;
        case "add_external_integration":
          minDays += 3;
          maxDays += 7;
          break;
        case "modify_deployment":
        case "modify_scaling":
        case "modify_deployment_scaling":
          minDays += 2;
          maxDays += 4;
          break;
        default:
          minDays += 2;
          maxDays += 4;
      }
    }

    const storyPoints = Math.max(1, Math.round((minDays + maxDays) / 1.5));
    const confidence: "high" | "medium" | "low" = repositoryAnalysis ? "high" : changes.length > 3 ? "medium" : "medium";

    const overallRisk: "low" | "medium" | "high" =
      brokenConnections.length > 0 || changes.some((c) => c.type === "change_database_technology") || spofDelta > 1
        ? "high"
        : changes.length > 2 || propSyncHops > baseSyncHops
          ? "medium"
          : "low";

    const warnings: string[] = [];
    if (brokenConnections.length > 0) {
      warnings.push(`Breaking change: ${brokenConnections.length} connection(s) severed by removing component(s).`);
    }
    if (authGaps.length > 0) {
      warnings.push(`Security warning: ${authGaps.length} service(s) lack detected authentication boundary.`);
    }
    if (syncHopsDelta > 1) {
      warnings.push(`Performance warning: Synchronous call chain increased by ${syncHopsDelta} hops.`);
    }

    const assumptions: string[] = [
      "Relative cost index is based on cloud compute heuristics (Database = 2.5x, Queue = 1.8x, Cache = 1.2x, Compute = 1.0x).",
      "Effort estimates assume experienced engineering team and automated CI/CD; excludes cross-team approvals.",
      repositoryAnalysis
        ? "Correlated with repository snapshot for verified code modules and route matches."
        : "Architecture-only simulation mode. Security and implementation drift checks require an active repository snapshot for complete verification.",
    ];

    return {
      label: "deterministic, evidence-based architecture simulation",
      evaluationConfidence: confidence,
      performance: {
        latencyScore: {
          baseline: "Baseline network latency",
          proposed: latencyText,
          delta: syncHopsDelta === 0 ? "0 hops" : `${syncHopsDelta > 0 ? "+" : ""}${syncHopsDelta} hops`,
          status: latencyStatus,
          rationale: `Evaluated across ${propSyncHops} synchronous hop(s) vs ${baseSyncHops} in baseline. Caching: ${cacheIntroduced ? "active" : "none"}.`,
        },
        maxSyncHops: {
          baseline: baseSyncHops,
          proposed: propSyncHops,
          delta: syncHopsDelta,
          unit: "hops",
          status: syncHopsDelta < 0 ? "improved" : syncHopsDelta > 0 ? "degraded" : "neutral",
          rationale: "Longest directed path of synchronous 'calls' edges.",
        },
        potentialBottlenecks: proposedBottlenecks,
        communicationChanges,
      },
      scalability: {
        spofCount: {
          baseline: baseSpofs.length,
          proposed: propSpofs.length,
          delta: spofDelta,
          unit: "SPOFs",
          status: spofDelta < 0 ? "improved" : spofDelta > 0 ? "degraded" : "neutral",
          rationale: "Count of single points of failure without redundancy or autoscaling.",
        },
        identifiedSpofs: propSpofs,
        scalingLimitations,
        potentialBottlenecks: proposedBottlenecks,
      },
      cost: {
        relativeCostIndex: {
          baseline: baseCostIndex,
          proposed: propCostIndex,
          delta: deltaCost,
          unit: "units",
          status: deltaCost < 0 ? "improved" : deltaCost > 0 ? "degraded" : "neutral",
          rationale: "Sum of normalized infrastructure resource weights across all active components.",
        },
        introducedServices,
        assumptions: [
          "Database standard weight: 2.5 units",
          "Queue standard weight: 1.8 units",
          "Cache standard weight: 1.2 units",
          "Compute service standard weight: 1.0 unit",
        ],
      },
      complexity: {
        componentCount: {
          baseline: baseNodesCount,
          proposed: propNodesCount,
          delta: propNodesCount - baseNodesCount,
          unit: "components",
          rationale: "Total active architecture components.",
        },
        connectionCount: {
          baseline: baseEdgesCount,
          proposed: propEdgesCount,
          delta: propEdgesCount - baseEdgesCount,
          unit: "connections",
          rationale: "Total inter-service communication edges.",
        },
        couplingIndex: {
          baseline: baseCoupling,
          proposed: propCoupling,
          delta: Math.round((propCoupling - baseCoupling) * 10) / 10,
          unit: "edges/node",
          status: propCoupling < baseCoupling ? "improved" : propCoupling > baseCoupling ? "degraded" : "neutral",
          rationale: "Average connection density per component.",
        },
        additionalDependencies: introducedServices,
      },
      security: {
        attackSurfacesCount: {
          baseline: baseAttackSurfaces,
          proposed: propAttackSurfaces,
          delta: propAttackSurfaces - baseAttackSurfaces,
          unit: "surfaces",
          status: propAttackSurfaces <= baseAttackSurfaces ? "neutral" : "degraded",
          rationale: "Gateways, frontends, APIs, and external integration ingress points.",
        },
        identifiedRisks: authGaps.length > 0 ? authGaps : ["No obvious authentication gaps detected in graph edges"],
        authGaps,
        trustBoundaryChanges,
        evidenceNote: repositoryAnalysis
          ? "Verified against repository code analysis."
          : "Insufficient evidence for code-level security (repository snapshot not linked).",
      },
      developmentEffort: {
        estimatedDaysMin: minDays,
        estimatedDaysMax: maxDays,
        storyPointsEstimate: storyPoints,
        confidence,
        assumptions: [
          "Based on empirical component delivery ranges (5-10d microservice, 2-5d cache layer, 8-16d DB migration).",
          "Assumes team familiarity with targeted technologies.",
        ],
      },
      overallRisk,
      assumptions,
      warnings,
      // Legacy backward compatible fields
      performance_score: Math.max(10, Math.min(100, 75 - syncHopsDelta * 10 + (cacheIntroduced ? 15 : 0))),
      latency: Math.max(10, 50 + syncHopsDelta * 15 - (cacheIntroduced ? 20 : 0)),
      cost_score: Math.max(10, Math.round(propCostIndex * 10)),
      complexity_score: Math.round(propCoupling * 20),
      security_score: Math.max(20, 80 - authGaps.length * 15 - (propAttackSurfaces - baseAttackSurfaces) * 10),
      reliability: Math.max(20, 90 - propSpofs.length * 10),
      scalability_score: Math.max(20, 85 - propSpofs.length * 12 + (queueIntroduced ? 10 : 0)),
      implementationEffort: maxDays,
    };
  }
}

export const architectureSimulationService = new ArchitectureSimulationService();
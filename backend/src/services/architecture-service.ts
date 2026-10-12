import { ConflictError, NotFoundError, ValidationError } from "../errors/app-error.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
import { projectRepository } from "../repositories/project-repository.js";
import { engineeringRepository } from "../repositories/engineering-intelligence-repository.js";
import type { ArchitectureVersion } from "../types/architecture.js";
import { DeterministicArchitectureGenerator } from "./deterministic-architecture-generator.js";

export const architectureService = {
  async getCurrent(projectId: string) {
    const version = await architectureRepository.latest(projectId);
    return version ? this.hydrate(version) : { version: null, nodes: [], edges: [] };
  },

  async listVersions(projectId: string) {
    const versions = await architectureRepository.versions(projectId);
    return Promise.all(
      versions.map(async (v) => {
        const [nodes, edges] = await Promise.all([
          architectureRepository.nodes(v.id).catch(() => []),
          architectureRepository.edges(v.id).catch(() => []),
        ]);
        const nodeTypes: Record<string, number> = {};
        const technologies = new Set<string>();
        nodes.forEach((n) => {
          nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
          if (n.technology) technologies.add(n.technology);
        });
        return {
          ...v,
          node_count: nodes.length,
          edge_count: edges.length,
          node_types: nodeTypes,
          technologies: Array.from(technologies),
          sample_nodes: nodes.slice(0, 6).map((n) => ({ id: n.id, name: n.name, type: n.type, technology: n.technology })),
        };
      })
    );
  },

  async getVersion(id: string) {
    const version = await this.requireVersion(id);
    return this.hydrate(version);
  },

  async generatePreview(projectId: string, _userId: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");
    const requirements = await projectRepository.requirements(projectId);
    if (!requirements || requirements.length === 0) {
      throw new ValidationError({
        requirements: "Project must have at least one requirement to generate architecture. Please add requirements first.",
      });
    }
    const generator = new DeterministicArchitectureGenerator();
    const architecture = generator.generate(requirements, project.name);
    return {
      preview: true,
      architecture,
    };
  },

  async createVersion(projectId: string, userId: string, input: Record<string, any>) {
    const latest = await architectureRepository.latest(projectId);
    const nextVersionNumber = (latest?.version_number ?? 0) + 1;
    const { nodes, edges, name, description, architecture_data, ...rest } = input;

    const version = await architectureRepository.createVersion({
      ...rest,
      name: name || `Architecture v${nextVersionNumber}`,
      description: description || `Generated architecture snapshot v${nextVersionNumber}`,
      project_id: projectId,
      version_number: nextVersionNumber,
      status: "draft",
      created_by: userId,
      architecture_data: architecture_data ?? {},
    });

    const createdNodes: any[] = [];
    const createdEdges: any[] = [];

    if (Array.isArray(nodes) && nodes.length > 0) {
      const nodeKeyMap = new Map<string, string>();
      const nodePromises = nodes.map(async (node) => {
        const nodeKey = String(node.node_key ?? node.id ?? "");
        if (!nodeKey) return null;
        const createdNode = await architectureRepository.createNode({
          architecture_version_id: version.id,
          node_key: nodeKey,
          name: String(node.name ?? nodeKey),
          type: String(node.type ?? "service"),
          technology: node.technology ?? null,
          description: node.description ?? null,
          metadata: node.metadata ?? {},
          position_x: Number(node.position_x ?? 0),
          position_y: Number(node.position_y ?? 0),
        });
        return { node, nodeKey, createdNode };
      });

      const settledNodes = await Promise.all(nodePromises);
      for (const item of settledNodes) {
        if (!item) continue;
        createdNodes.push(item.createdNode);
        nodeKeyMap.set(item.nodeKey, item.createdNode.id);
        if (item.node.id) nodeKeyMap.set(String(item.node.id), item.createdNode.id);
        nodeKeyMap.set(item.createdNode.id, item.createdNode.id);
      }

      if (Array.isArray(edges) && edges.length > 0) {
        const edgePromises = edges.map(async (edge) => {
          const sourceKey = String(edge.source_node_key ?? edge.source ?? edge.source_node_id ?? "");
          const targetKey = String(edge.target_node_key ?? edge.target ?? edge.target_node_id ?? "");
          const sourceId = nodeKeyMap.get(sourceKey);
          const targetId = nodeKeyMap.get(targetKey);
          if (sourceId && targetId && sourceId !== targetId) {
            return await architectureRepository.createEdge({
              architecture_version_id: version.id,
              source_node_id: sourceId,
              target_node_id: targetId,
              relationship: String(edge.relationship ?? "calls"),
              protocol: edge.protocol ?? null,
              description: edge.description ?? null,
              metadata: edge.metadata ?? {},
            });
          }
          return null;
        });

        const settledEdges = await Promise.all(edgePromises);
        for (const edge of settledEdges) {
          if (edge) createdEdges.push(edge);
        }
      }
    }

    await Promise.all([
      engineeringRepository.markDocumentsOutdated(projectId, version.id),
      this.event(projectId, "version_created", "architecture_version", version.id, userId),
    ]);

    return {
      ...version,
      version,
      nodes: createdNodes,
      edges: createdEdges,
    };
  },

  async updateVersion(id: string, input: Record<string, unknown>) {
    await this.requireEditableVersion(id);
    return architectureRepository.updateVersion(id, input);
  },

  async deleteVersion(id: string) {
    await this.requireEditableVersion(id);
    await architectureRepository.deleteVersion(id);
  },

  async publish(id: string, userId: string) {
    const version = await this.requireEditableVersion(id);
    const published = await architectureRepository.updateVersion(id, { status: "published" });
    await this.event(version.project_id, "version_published", "architecture_version", id, userId);
    return published;
  },

  async copyVersion(projectId: string, userId: string, sourceId: string, input: { name?: string; description?: string }) {
    const source = await this.requireVersion(sourceId);
    if (source.project_id !== projectId) throw new NotFoundError("Architecture version not found");
    const sourceHydrated = await this.hydrate(source);

    const copyInput = {
      name: input.name ?? `${source.name} copy`,
      description: input.description ?? source.description ?? undefined,
      architecture_data: source.architecture_data,
      nodes: sourceHydrated.nodes.map((n) => ({
        node_key: n.node_key,
        name: n.name,
        type: n.type,
        technology: n.technology,
        description: n.description,
        metadata: n.metadata,
        position_x: n.position_x,
        position_y: n.position_y,
      })),
      edges: sourceHydrated.edges.map((e) => {
        const sourceNode = sourceHydrated.nodes.find((n) => n.id === e.source_node_id);
        const targetNode = sourceHydrated.nodes.find((n) => n.id === e.target_node_id);
        return {
          source_node_key: sourceNode?.node_key,
          target_node_key: targetNode?.node_key,
          relationship: e.relationship,
          protocol: e.protocol,
          description: e.description,
          metadata: e.metadata,
        };
      }),
    };

    return this.createVersion(projectId, userId, copyInput);
  },

  async requireVersion(id: string): Promise<ArchitectureVersion> {
    const version = await architectureRepository.version(id);
    if (!version) throw new NotFoundError("Architecture version not found");
    return version;
  },

  async requireEditableVersion(id: string): Promise<ArchitectureVersion> {
    const version = await this.requireVersion(id);
    if (version.status === "published") throw new ConflictError("Published architecture versions are immutable");
    return version;
  },

  async hydrate(version: ArchitectureVersion) {
    return {
      version,
      nodes: await architectureRepository.nodes(version.id),
      edges: await architectureRepository.edges(version.id),
    };
  },

  async nodeCreate(versionId: string, input: Record<string, unknown>) {
    await this.requireEditableVersion(versionId);
    return architectureRepository.createNode({ ...input, architecture_version_id: versionId });
  },

  async nodeUpdate(versionId: string, nodeId: string, input: Record<string, unknown>) {
    await this.requireEditableVersion(versionId);
    const node = await architectureRepository.node(nodeId);
    if (!node || node.architecture_version_id !== versionId) throw new NotFoundError("Architecture node not found");
    return architectureRepository.updateNode(nodeId, input);
  },

  async nodeDelete(versionId: string, nodeId: string) {
    await this.requireEditableVersion(versionId);
    const node = await architectureRepository.node(nodeId);
    if (!node || node.architecture_version_id !== versionId) throw new NotFoundError("Architecture node not found");
    await architectureRepository.deleteNode(nodeId);
  },

  async edgeCreate(versionId: string, input: Record<string, unknown>) {
    await this.requireEditableVersion(versionId);
    const nodes = await architectureRepository.nodes(versionId);
    const nodeIds = new Set(nodes.map((node) => node.id));
    if (!nodeIds.has(String(input.source_node_id)) || !nodeIds.has(String(input.target_node_id))) {
      throw new NotFoundError("Architecture edge node not found");
    }
    return architectureRepository.createEdge({ ...input, architecture_version_id: versionId });
  },

  async edgeUpdate(versionId: string, edgeId: string, input: Record<string, unknown>) {
    await this.requireEditableVersion(versionId);
    const edge = await architectureRepository.edge(edgeId);
    if (!edge || edge.architecture_version_id !== versionId) throw new NotFoundError("Architecture edge not found");
    return architectureRepository.updateEdge(edgeId, input);
  },

  async edgeDelete(versionId: string, edgeId: string) {
    await this.requireEditableVersion(versionId);
    const edge = await architectureRepository.edge(edgeId);
    if (!edge || edge.architecture_version_id !== versionId) throw new NotFoundError("Architecture edge not found");
    await architectureRepository.deleteEdge(edgeId);
  },

  async event(projectId: string, eventType: string, entityType: string, entityId: string, userId: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");
    return architectureRepository.createTimelineEvent({
      project_id: projectId,
      workspace_id: project.workspace_id,
      user_id: userId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      metadata: {},
    });
  },
};
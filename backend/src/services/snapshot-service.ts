import { NotFoundError } from "../errors/app-error.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
import { architectureService } from "./architecture-service.js";

export const snapshotService = {
  async create(projectId: string, userId: string, input: Record<string, unknown>) {
    const versionId = String(input.architecture_version_id || input.version_id);
    const version = await architectureRepository.version(versionId);
    if (!version || version.project_id !== projectId) {
      throw new NotFoundError("Architecture version not found");
    }

    let snapshotData = input.snapshot_data as Record<string, unknown> | undefined;
    if (!snapshotData || !Array.isArray(snapshotData.nodes)) {
      const [nodes, edges] = await Promise.all([
        architectureRepository.nodes(versionId),
        architectureRepository.edges(versionId),
      ]);
      const nodeById = new Map(nodes.map((node) => [node.id, node.node_key]));
      snapshotData = {
        ...(version.architecture_data || {}),
        name: version.name,
        nodes: nodes.map((node) => ({
          node_key: node.node_key,
          name: node.name,
          type: node.type,
          technology: node.technology ?? undefined,
          description: node.description ?? undefined,
          metadata: node.metadata || {},
          position_x: node.position_x,
          position_y: node.position_y,
        })),
        edges: edges.flatMap((edge) => {
          const source = nodeById.get(edge.source_node_id);
          const target = nodeById.get(edge.target_node_id);
          return source && target
            ? [
                {
                  source_node_key: source,
                  target_node_key: target,
                  relationship: edge.relationship,
                  protocol: edge.protocol ?? undefined,
                  description: edge.description ?? undefined,
                  metadata: edge.metadata || {},
                },
              ]
            : [];
        }),
      };
    }

    const snapshot = await architectureRepository.createSnapshot({
      project_id: projectId,
      architecture_version_id: versionId,
      name: String(input.name),
      description: input.description ? String(input.description) : null,
      type: (input.type as string) || "milestone",
      snapshot_data: snapshotData,
      created_by: userId,
    });

    await architectureService.event(projectId, "snapshot_created", "snapshot", snapshot.id, userId);
    return snapshot;
  },

  list(projectId: string) {
    return architectureRepository.snapshots(projectId);
  },

  async get(id: string, projectId?: string) {
    const snapshot = await architectureRepository.snapshot(id);
    if (!snapshot || (projectId && snapshot.project_id !== projectId)) {
      throw new NotFoundError("Snapshot not found");
    }
    return snapshot;
  },

  async restore(projectId: string, userId: string, id: string) {
    const snapshot = await this.get(id, projectId);
    const snapData = (snapshot.snapshot_data as Record<string, any>) || {};
    let nodes = Array.isArray(snapData.nodes) ? snapData.nodes : [];
    let edges = Array.isArray(snapData.edges) ? snapData.edges : [];

    // Fallback if snapshot_data had no nodes/edges array
    if (nodes.length === 0 && snapshot.architecture_version_id) {
      try {
        const [origNodes, origEdges] = await Promise.all([
          architectureRepository.nodes(snapshot.architecture_version_id),
          architectureRepository.edges(snapshot.architecture_version_id),
        ]);
        const nodeById = new Map(origNodes.map((n) => [n.id, n.node_key]));
        nodes = origNodes.map((n) => ({
          node_key: n.node_key,
          name: n.name,
          type: n.type,
          technology: n.technology ?? undefined,
          description: n.description ?? undefined,
          metadata: n.metadata || {},
          position_x: n.position_x,
          position_y: n.position_y,
        }));
        edges = origEdges.flatMap((e) => {
          const source = nodeById.get(e.source_node_id);
          const target = nodeById.get(e.target_node_id);
          return source && target
            ? [
                {
                  source_node_key: source,
                  target_node_key: target,
                  relationship: e.relationship,
                  protocol: e.protocol ?? undefined,
                  description: e.description ?? undefined,
                  metadata: e.metadata || {},
                },
              ]
            : [];
        });
      } catch {
        // original version may have been deleted; proceed with available data
      }
    }

    const restoredVersion = await architectureService.createVersion(projectId, userId, {
      name: `${snapshot.name} (restored)`,
      description: snapshot.description
        ? `Restored from snapshot "${snapshot.name}": ${snapshot.description}`
        : `Restored from snapshot "${snapshot.name}"`,
      architecture_data: snapData,
      nodes,
      edges,
    });

    await architectureService.event(projectId, "snapshot_restored", "snapshot", snapshot.id, userId);
    return restoredVersion;
  },
};
import type { ArchitectureComparison, ArchitectureEdge } from "../types/architecture.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
import { NotFoundError } from "../errors/app-error.js";
export class VersionComparisonService {
  async compare(projectId: string, fromId: string, toId: string): Promise<ArchitectureComparison> {
    const [fromVersion, toVersion] = await Promise.all([architectureRepository.version(fromId), architectureRepository.version(toId)]);
    if (!fromVersion || !toVersion || fromVersion.project_id !== projectId || toVersion.project_id !== projectId) throw new NotFoundError("Architecture versions not found");
    const [fromNodes, toNodes, fromEdges, toEdges] = await Promise.all([architectureRepository.nodes(fromId), architectureRepository.nodes(toId), architectureRepository.edges(fromId), architectureRepository.edges(toId)]);
    const fromByKey = new Map(fromNodes.map((node) => [node.node_key, node])); const toByKey = new Map(toNodes.map((node) => [node.node_key, node]));
    const added = toNodes.filter((node) => !fromByKey.has(node.node_key)); const removed = fromNodes.filter((node) => !toByKey.has(node.node_key)); const modified = toNodes.filter((node) => { const old = fromByKey.get(node.node_key); return old && JSON.stringify({ ...old, id: undefined, created_at: undefined }) !== JSON.stringify({ ...node, id: undefined, created_at: undefined }); }); const unchanged = toNodes.filter((node) => fromByKey.has(node.node_key) && !modified.includes(node));
    const edgeKey = (edge: ArchitectureEdge) => `${edge.source_node_id}:${edge.target_node_id}:${edge.relationship}`; const fromEdgeKeys = new Set(fromEdges.map(edgeKey)); const toEdgeKeys = new Set(toEdges.map(edgeKey));
    const addedEdges = toEdges.filter((edge) => !fromEdgeKeys.has(edgeKey(edge))); const removedEdges = fromEdges.filter((edge) => !toEdgeKeys.has(edgeKey(edge)));
    return { added, removed, modified, unchanged, summary: { addedNodes: added.length, removedNodes: removed.length, modifiedNodes: modified.length, addedEdges: addedEdges.length, removedEdges: removedEdges.length, technologyChanges: modified.filter((node) => fromByKey.get(node.node_key)?.technology !== node.technology).length } };
  }
}
export const versionComparisonService = new VersionComparisonService();
import { z } from "zod";
import { projectIdParams, uuid } from "./common.js";

export const architectureVersionParams = projectIdParams.extend({ versionId: uuid });
export const architectureNodeParams = architectureVersionParams.extend({ nodeId: uuid });
export const architectureEdgeParams = architectureVersionParams.extend({ edgeId: uuid });
export const snapshotParams = projectIdParams.extend({ snapshotId: uuid });
export const architectureVersionCreate = z.object({ name: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), architecture_data: z.record(z.unknown()).optional() });
export const architectureVersionUpdate = architectureVersionCreate.partial().extend({ status: z.enum(["draft", "archived"]).optional() });
export const architectureVersionCopy = z.object({ name: z.string().trim().min(1).max(160).optional(), description: z.string().max(2000).optional() });
export const architectureNodeCreate = z.object({ node_key: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/), name: z.string().trim().min(1).max(160), type: z.enum(["frontend", "backend", "service", "database", "cache", "queue", "storage", "external_service", "auth", "worker", "api", "gateway", "monitoring", "infrastructure"]), technology: z.string().max(160).optional(), description: z.string().max(2000).optional(), metadata: z.record(z.unknown()).default({}), position_x: z.number().finite().default(0), position_y: z.number().finite().default(0) });
export const architectureNodeUpdate = architectureNodeCreate.partial();
export const architectureEdgeCreate = z.object({ source_node_id: uuid, target_node_id: uuid, relationship: z.enum(["calls", "reads", "writes", "publishes", "subscribes", "authenticates", "depends_on", "connects_to"]), protocol: z.string().max(120).optional(), description: z.string().max(2000).optional(), metadata: z.record(z.unknown()).default({}) });
export const architectureEdgeUpdate = architectureEdgeCreate.partial();
export const snapshotCreate = z.object({ architecture_version_id: uuid, name: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), type: z.enum(["milestone", "sprint", "beta", "production", "custom"]), snapshot_data: z.record(z.unknown()).optional() });
export const compareQuery = z.object({ from: uuid, to: uuid });
export const explanationRequest = z.object({ context: z.string().max(4000).optional() });
export const architectureVersionSave = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  architecture_data: z.record(z.unknown()).optional(),
  nodes: z.array(z.object({
    id: z.string().optional(),
    node_key: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    type: architectureNodeCreate.shape.type,
    technology: z.string().max(160).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    metadata: z.record(z.unknown()).optional().default({}),
    position_x: z.number().finite().default(0),
    position_y: z.number().finite().default(0),
  })).optional(),
  edges: z.array(z.object({
    source: z.string().optional(),
    target: z.string().optional(),
    source_node_key: z.string().optional(),
    target_node_key: z.string().optional(),
    source_node_id: z.string().optional(),
    target_node_id: z.string().optional(),
    relationship: architectureEdgeCreate.shape.relationship,
    protocol: z.string().max(120).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    metadata: z.record(z.unknown()).optional().default({}),
  })).optional(),
});
export type ArchitectureVersionSaveInput = z.infer<typeof architectureVersionSave>;
export const generatedArchitectureSchema = z.object({ name: z.string().min(1), summary: z.string(), assumptions: z.array(z.string()), nodes: z.array(z.object({ node_key: z.string().min(1), name: z.string().min(1), type: architectureNodeCreate.shape.type, technology: z.string().optional(), description: z.string().optional(), metadata: z.record(z.unknown()).optional(), position_x: z.number().optional(), position_y: z.number().optional() })), edges: z.array(z.object({ source_node_key: z.string().min(1), target_node_key: z.string().min(1), relationship: architectureEdgeCreate.shape.relationship, protocol: z.string().optional(), description: z.string().optional(), metadata: z.record(z.unknown()).optional() })), technologies: z.array(z.string()), securityConsiderations: z.array(z.string()), scalabilityConsiderations: z.array(z.string()), risks: z.array(z.string()) });
export type GeneratedArchitectureInput = z.infer<typeof generatedArchitectureSchema>;
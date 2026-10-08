export type ArchitectureVersionStatus = "draft" | "published" | "archived";
export type ArchitectureNodeType = "frontend" | "backend" | "service" | "database" | "cache" | "queue" | "storage" | "external_service" | "auth" | "worker" | "api" | "gateway" | "monitoring" | "infrastructure";
export type ArchitectureRelationship = "calls" | "reads" | "writes" | "publishes" | "subscribes" | "authenticates" | "depends_on" | "connects_to";
export type SnapshotType = "milestone" | "sprint" | "beta" | "production" | "custom";
export type TimelineEventType = "project_created" | "requirements_updated" | "architecture_generated" | "architecture_modified" | "version_created" | "version_published" | "version_restored" | "snapshot_created" | "snapshot_restored";

export interface ArchitectureNode { id: string; architecture_version_id: string; node_key: string; name: string; type: ArchitectureNodeType; technology: string | null; description: string | null; metadata: Record<string, unknown>; position_x: number; position_y: number; created_at: string }
export interface ArchitectureEdge { id: string; architecture_version_id: string; source_node_id: string; target_node_id: string; relationship: ArchitectureRelationship; protocol: string | null; description: string | null; metadata: Record<string, unknown>; created_at: string }
export interface ArchitectureVersion { id: string; project_id: string; version_number: number; name: string; description: string | null; status: ArchitectureVersionStatus; architecture_data: GeneratedArchitecture; created_by: string; created_at: string }
export interface Snapshot { id: string; project_id: string; architecture_version_id: string; name: string; description: string | null; type: SnapshotType; snapshot_data: GeneratedArchitecture; created_by: string; created_at: string }
export interface TimelineEvent { id: string; project_id: string; workspace_id: string; user_id: string; event_type: TimelineEventType; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string }

export interface GeneratedArchitecture { name: string; summary: string; assumptions: string[]; nodes: GeneratedNode[]; edges: GeneratedEdge[]; technologies: string[]; securityConsiderations: string[]; scalabilityConsiderations: string[]; risks: string[] }
export interface GeneratedNode { node_key: string; name: string; type: ArchitectureNodeType; technology?: string; description?: string; metadata?: Record<string, unknown>; position_x?: number; position_y?: number }
export interface GeneratedEdge { source_node_key: string; target_node_key: string; relationship: ArchitectureRelationship; protocol?: string; description?: string; metadata?: Record<string, unknown> }
export interface ArchitectureComparison { added: unknown[]; removed: unknown[]; modified: unknown[]; unchanged: unknown[]; summary: { addedNodes: number; removedNodes: number; modifiedNodes: number; addedEdges: number; removedEdges: number; technologyChanges: number } }
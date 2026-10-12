import { z } from "zod";

const entityTypeEnum = z.enum([
  "requirement",
  "architecture_component",
  "architecture_connection",
  "repository_module",
  "api_route",
  "database_model",
  "dependency",
  "test",
  "documentation",
  "drift_finding",
  "impact_finding",
  "architecture_version",
]);

const relationTypeEnum = z.enum([
  "implemented_by",
  "mapped_to",
  "handled_by",
  "accesses",
  "imports",
  "depends_on",
  "verifies",
  "describes",
  "has_drift",
  "affects",
  "connects_to",
  "contains",
]);

export const queryKnowledgeGraphSchema = z.object({
  architectureVersionId: z.string().uuid("Invalid architecture version ID").optional(),
  repositoryId: z.string().uuid("Invalid repository ID").optional(),
  repositoryAnalysisId: z.string().uuid("Invalid repository analysis snapshot ID").optional(),
  scope: z.enum(["architecture", "repository", "all"]).optional(),
  entityTypes: z.union([
    z.array(entityTypeEnum),
    z.string().transform((val) => val.split(",").map((s) => s.trim()).filter(Boolean) as any),
  ]).optional(),
  relationTypes: z.union([
    z.array(relationTypeEnum),
    z.string().transform((val) => val.split(",").map((s) => s.trim()).filter(Boolean) as any),
  ]).optional(),
  search: z.string().max(200).optional(),
  centerEntityId: z.string().max(200).optional(),
  neighborhoodDepth: z.coerce.number().int().min(1).max(3).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  forceRefresh: z.union([z.boolean(), z.string().transform((v) => v === "true")]).optional(),
});

export const getNeighborhoodSchema = z.object({
  centerEntityId: z.string().min(1, "Center entity ID is required"),
  depth: z.coerce.number().int().min(1).max(3).default(1),
});

export const getTraceabilitySchema = z.object({
  rootEntityId: z.string().min(1, "Root entity ID is required"),
});

export const nodeImpactSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  changeType: z.enum(["modified", "deprecated", "removed", "refactored"]).default("modified"),
});

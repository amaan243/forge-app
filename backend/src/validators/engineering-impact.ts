import { z } from "zod";

export const impactTargetEntitySchema = z.object({
  type: z.enum([
    "architecture_component",
    "service_module",
    "api_route",
    "database_object",
    "external_integration",
    "dependency",
    "architecture_connection",
  ]),
  id: z.string().min(1),
  name: z.string().min(1),
  nodeKey: z.string().optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  technology: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const proposedChangeSchema = z.object({
  changeType: z.string().min(1),
  description: z.string().min(3, "Change description must be at least 3 characters long"),
  details: z.record(z.unknown()).optional(),
});

export const impactAnalyzeSchema = z.object({
  architectureVersionId: z.string().uuid("Invalid architecture version ID"),
  repositoryId: z.string().uuid("Invalid repository ID").nullable().optional(),
  repositoryAnalysisId: z.string().uuid("Invalid repository analysis ID").nullable().optional(),
  targetEntity: impactTargetEntitySchema,
  proposedChange: proposedChangeSchema,
});

export const impactToSimulationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

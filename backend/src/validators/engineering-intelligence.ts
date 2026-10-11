import { z } from "zod";
import { projectIdParams, uuid } from "./common.js";

export const simulationParams = projectIdParams.extend({ simulationId: uuid });
export const documentationParams = projectIdParams.extend({ documentId: uuid });
export const reviewParams = projectIdParams.extend({ reviewId: uuid });

export const simulationCreate = z.object({
  base_version_id: uuid,
  repository_id: uuid.optional().nullable(),
  snapshot_id: uuid.optional().nullable(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional().nullable(),
  proposed_changes: z
    .array(
      z.object({
        type: z.enum([
          "add_service",
          "add_component",
          "remove_service",
          "remove_component",
          "replace_technology",
          "change_technology",
          "add_connection",
          "remove_connection",
          "change_database_technology",
          "add_database",
          "remove_database",
          "introduce_cache",
          "add_cache",
          "remove_cache",
          "introduce_queue",
          "add_queue",
          "remove_queue",
          "change_communication",
          "add_external_integration",
          "modify_deployment",
          "modify_scaling",
          "modify_deployment_scaling",
          "modify_api",
          "change_infrastructure",
          "change_authentication",
        ]),
        target: z.string().max(160).optional(),
        name: z.string().max(160).optional(),
        responsibility: z.string().max(500).optional(),
        technology: z.string().max(160).optional(),
        node_type: z.string().max(50).optional(),
        source: z.string().max(160).optional(),
        target_component: z.string().max(160).optional(),
        relationship: z.string().max(50).optional(),
        protocol: z.string().max(50).optional(),
        details: z.record(z.unknown()).optional(),
      })
    )
    .min(1),
});

export const simulationUpdate = simulationCreate.partial();

export const documentGenerate = z.object({
  type: z.enum([
    "architecture_overview",
    "system_design",
    "api_documentation",
    "database_documentation",
    "deployment",
    "security",
    "getting_started",
    "repository_overview",
    "testing_security",
    "custom",
  ]),
  title: z.string().trim().min(1).max(200),
  format: z.enum(["markdown", "html", "mermaid", "openapi_json", "openapi_yaml"]),
  version_id: uuid.optional().nullable(),
  repository_analysis_id: uuid.optional().nullable(),
  repository_id: uuid.optional().nullable(),
  snapshot_branch: z.string().max(200).optional().nullable(),
  custom_prompt: z.string().max(4000).optional(),
  force_overwrite: z.boolean().optional(),
});

export const sectionRegenerate = z.object({
  section: z.string().max(100),
  force_overwrite: z.boolean().optional(),
});

export const documentUpdate = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(200000).optional(),
  format: z.enum(["markdown", "html", "mermaid", "openapi_json", "openapi_yaml"]).optional(),
});

export const documentExport = z.object({
  format: z.enum(["markdown", "html", "pdf", "openapi_json", "openapi_yaml"]),
});
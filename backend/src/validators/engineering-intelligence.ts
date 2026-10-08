import { z } from "zod";
import { projectIdParams, uuid } from "./common.js";
export const simulationParams = projectIdParams.extend({ simulationId: uuid });
export const documentationParams = projectIdParams.extend({ documentId: uuid });
export const reviewParams = projectIdParams.extend({ reviewId: uuid });
export const simulationCreate = z.object({ base_version_id: uuid, name: z.string().trim().min(1).max(160), description: z.string().max(2000).optional(), proposed_changes: z.array(z.object({ type: z.enum(["add_service", "remove_service", "replace_technology", "add_database", "remove_database", "add_cache", "remove_cache", "add_queue", "modify_api", "change_communication", "change_deployment", "change_authentication", "change_infrastructure"]), target: z.string().max(160).optional(), name: z.string().max(160).optional(), technology: z.string().max(160).optional(), details: z.record(z.unknown()).optional() })).min(1) });
export const simulationUpdate = simulationCreate.partial();
export const documentGenerate = z.object({ type: z.enum(["architecture_overview", "system_design", "api_documentation", "database_documentation", "deployment", "security", "getting_started", "custom"]), title: z.string().trim().min(1).max(200), format: z.enum(["markdown", "html", "mermaid"]), version_id: uuid, custom_prompt: z.string().max(4000).optional() });
export const documentUpdate = z.object({ title: z.string().trim().min(1).max(200).optional(), content: z.string().max(200000).optional(), format: z.enum(["markdown", "html", "mermaid"]).optional() });
import { z } from "zod";
import { uuid } from "./common.js";
export const analyticsQuery = z.object({ from: z.string().datetime().optional(), to: z.string().datetime().optional(), metric: z.string().max(80).optional() });
export const exportCreate = z.object({ type: z.enum(["architecture", "documentation", "project_story", "dependency_graph", "drift_report", "version_comparison", "full_project_report"]), format: z.enum(["json", "markdown", "pdf", "svg", "png"]) });
export const notificationParams = z.object({ notificationId: uuid });
export const settingsUpdate = z.object({ theme: z.string().max(40).optional(), default_workspace: uuid.nullable().optional(), notifications: z.record(z.unknown()).optional(), ai_preferences: z.record(z.unknown()).optional(), editor_preferences: z.record(z.unknown()).optional() }).strict();
export const workspaceSettingsUpdate = z.object({ visibility: z.enum(["private", "workspace"]).optional(), default_architecture_settings: z.record(z.unknown()).optional() }).strict();
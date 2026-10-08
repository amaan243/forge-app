import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectEditor, requireProjectMember } from "../middleware/project-auth.js";
import { requireWorkspaceAdmin, requireWorkspaceMember } from "../middleware/workspace-auth.js";
import { platformController } from "../controllers/platform-operations-controller.js";
export const platformRoutes = Router({ mergeParams: true });
platformRoutes.use(requireAuth);
const exportLimit = rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
platformRoutes.get("/analytics", requireProjectMember, platformController.analytics);
platformRoutes.post("/exports", requireProjectEditor, exportLimit, platformController.createExport);
platformRoutes.get("/exports/:exportId", requireProjectMember, platformController.getExport);
platformRoutes.get("/audit", requireProjectMember, platformController.audit);
platformRoutes.get("/export-data", requireProjectMember, platformController.projectExportData);

export const notificationRoutes = Router();
notificationRoutes.use(requireAuth);
notificationRoutes.get("/", platformController.notifications);
notificationRoutes.patch("/:notificationId/read", platformController.readNotification);
notificationRoutes.post("/read-all", platformController.readAllNotifications);

export const settingsRoutes = Router();
settingsRoutes.use(requireAuth);
settingsRoutes.get("/", platformController.settings);
settingsRoutes.patch("/", platformController.updateSettings);

export const workspaceSettingsRoutes = Router({ mergeParams: true });
workspaceSettingsRoutes.use(requireAuth);
workspaceSettingsRoutes.get("/", requireWorkspaceMember, platformController.workspaceSettings);
workspaceSettingsRoutes.patch("/", requireWorkspaceAdmin, platformController.updateWorkspaceSettings);
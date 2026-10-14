import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { analyticsQuery, exportCreate, notificationParams, settingsUpdate, workspaceSettingsUpdate } from "../validators/platform-operations.js";
import { analyticsService } from "../services/analytics-service.js";
import { exportService } from "../services/export-service.js";
import { notificationService } from "../services/notification-service.js";
import { searchService } from "../services/search-service.js";
import { settingsService } from "../services/settings-service.js";
import { platformRepository } from "../repositories/platform-operations-repository.js";
import { architectureService } from "../services/architecture-service.js";
import { exportGenerationQueue, isRedisAvailable } from "../jobs/repository-analysis-queue.js";
const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;
export const platformController = {
  analytics: (async (request, response) => { response.json({ success: true, message: "Analytics retrieved", data: await analyticsService.get(String(request.params.projectId), analyticsQuery.parse(request.query)) }); }) as RequestHandler,
  listExports: (async (request, response) => {
    response.json({ success: true, message: "Exports retrieved", data: await platformRepository.listExports(String(request.params.projectId)) });
  }) as RequestHandler,
  createExport: (async (request, response) => {
    const input = exportCreate.parse(request.body);
    const projectId = String(request.params.projectId);
    const requestedBy = userId(request);
    const record = await exportService.create(projectId, requestedBy, input.type, input.format);
    const executeExport = async () => {
      try {
        await platformRepository.updateExport(record.id, { status: "running" });
        const data = await architectureService.getCurrent(projectId);
        await exportService.generate(record.id, data);
        const reqAny = request as any;
        const workspaceId = reqAny.project?.workspace_id || "";
        await notificationService.notify({ user_id: requestedBy, workspace_id: workspaceId, project_id: projectId, type: "export_ready", title: "Export ready", message: `Your ${record.type} export is ready.`, severity: "success", metadata: { export_id: record.id } }).catch(() => undefined);
      } catch (err) {
        await platformRepository.updateExport(record.id, { status: "failed", metadata: { error: err instanceof Error ? err.message : "Export failed" }, completed_at: new Date().toISOString() });
      }
    };
    const hasRedis = await isRedisAvailable();
    if (hasRedis) {
      try {
        await Promise.race([
          exportGenerationQueue.add("generate-export", { exportId: record.id, projectId, requestedBy }, { jobId: record.id }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Queue add timeout")), 1000)),
        ]);
      } catch {
        setImmediate(executeExport);
      }
    } else {
      setImmediate(executeExport);
    }
    response.status(202).json({ success: true, message: "Export queued", data: record });
  }) as RequestHandler,
  getExport: (async (request, response) => { response.json({ success: true, message: "Export retrieved", data: await exportService.get(String(request.params.exportId)) }); }) as RequestHandler,
  notifications: (async (request, response) => { response.json({ success: true, message: "Notifications retrieved", data: await notificationService.list(userId(request)) }); }) as RequestHandler,
  readNotification: (async (request, response) => { const params = notificationParams.parse(request.params); response.json({ success: true, message: "Notification marked read", data: await notificationService.read(userId(request), params.notificationId) }); }) as RequestHandler,
  readAllNotifications: (async (request, response) => { await notificationService.readAll(userId(request)); response.json({ success: true, message: "Notifications marked read" }); }) as RequestHandler,
  search: (async (request, response) => { const query = String(request.query.q ?? "").trim(); if (!query) { response.json({ success: true, message: "Search results retrieved", data: [] }); return; } response.json({ success: true, message: "Search results retrieved", data: await searchService.search(userId(request), query) }); }) as RequestHandler,
  audit: (async (request, response) => { response.json({ success: true, message: "Audit events retrieved", data: await platformRepository.audit(String(request.params.projectId)) }); }) as RequestHandler,
  settings: (async (request, response) => { response.json({ success: true, message: "Settings retrieved", data: await settingsService.get(userId(request)) }); }) as RequestHandler,
  updateSettings: (async (request, response) => { response.json({ success: true, message: "Settings updated", data: await settingsService.update(userId(request), settingsUpdate.parse(request.body)) }); }) as RequestHandler,
  workspaceSettings: (async (request, response) => { response.json({ success: true, message: "Workspace settings retrieved", data: await platformRepository.workspaceSettings(String(request.params.workspaceId)) }); }) as RequestHandler,
  updateWorkspaceSettings: (async (request, response) => { response.json({ success: true, message: "Workspace settings updated", data: await platformRepository.updateWorkspaceSettings(String(request.params.workspaceId), workspaceSettingsUpdate.parse(request.body)) }); }) as RequestHandler,
  projectExportData: (async (request, response) => { const architecture = await architectureService.getCurrent(String(request.params.projectId)); response.json({ success: true, message: "Export data retrieved", data: architecture }); }) as RequestHandler,
};
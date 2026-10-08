import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { exportService } from "../services/export-service.js";
import { notificationService } from "../services/notification-service.js";
import { projectRepository } from "../repositories/project-repository.js";
import { architectureService } from "../services/architecture-service.js";
import { platformRepository } from "../repositories/platform-operations-repository.js";
export function createExportWorker(): Worker<{ exportId: string; projectId: string; requestedBy: string }> {
  return new Worker("export-generation", async (job) => {
    const record = await platformRepository.export(job.data.exportId);
    if (!record || record.status === "completed") return record;
    await platformRepository.updateExport(record.id, { status: "running" });
    try {
      const data = await architectureService.getCurrent(job.data.projectId);
      const completed = await exportService.generate(record.id, data);
      const project = await projectRepository.findById(job.data.projectId);
      if (project) await notificationService.notify({ user_id: job.data.requestedBy, workspace_id: project.workspace_id, project_id: job.data.projectId, type: "export_ready", title: "Export ready", message: `Your ${record.type} export is ready.`, severity: "success", metadata: { export_id: record.id } });
      return completed;
    } catch (error) { await platformRepository.updateExport(record.id, { status: "failed", metadata: { error: error instanceof Error ? error.message : "Export failed" }, completed_at: new Date().toISOString() }); throw error; }
  }, { connection: { url: env.REDIS_URL }, concurrency: 2 });
}
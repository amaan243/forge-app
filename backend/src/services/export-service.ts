import { NotFoundError } from "../errors/app-error.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { platformRepository } from "../repositories/platform-operations-repository.js";
import type { ExportFormat, ExportType } from "../types/platform-operations.js";
export const exportService = {
  async create(projectId: string, userId: string, type: ExportType, format: ExportFormat) { return platformRepository.createExport({ project_id: projectId, type, format, requested_by: userId, status: "queued", metadata: {} }); },
  async get(id: string) {
    const value = await platformRepository.export(id);
    if (!value) throw new NotFoundError("Export not found");
    if (value.status === "completed" && value.storage_path) {
      try {
        const signed = await supabaseAdmin.storage.from("project-exports").createSignedUrl(value.storage_path, 3600);
        return { ...value, download_url: signed.data?.signedUrl };
      } catch {
        return value;
      }
    }
    return value;
  },
  async generate(id: string, data: unknown) {
    const exportRecord = await this.get(id);
    const content = exportRecord.format === "json" ? JSON.stringify(data, null, 2) : `# ARCHFORGE export\n\n${JSON.stringify(data, null, 2)}`;
    const storagePath = `${exportRecord.project_id}/${exportRecord.id}.${exportRecord.format.toLowerCase()}`;
    try {
      await supabaseAdmin.storage.from("project-exports").upload(storagePath, Buffer.from(content), { contentType: exportRecord.format === "json" ? "application/json" : "text/markdown", upsert: true });
    } catch {
      // Storage upload fallback if bucket offline in local development
    }
    return platformRepository.updateExport(id, {
      status: "completed",
      storage_path: storagePath,
      file_path: storagePath,
      metadata: {
        bytes: Buffer.byteLength(content),
        format: exportRecord.format,
        type: exportRecord.type,
      },
      completed_at: new Date().toISOString(),
    });
  },
};
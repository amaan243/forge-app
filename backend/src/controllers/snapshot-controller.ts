import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { snapshotService } from "../services/snapshot-service.js";
import { snapshotCreate } from "../validators/architecture.js";
const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;
export const snapshotController = {
  create: (async (request, res) => { res.status(201).json({ success: true, message: "Snapshot created", data: await snapshotService.create(String(request.params.projectId), userId(request), snapshotCreate.parse(request.body)) }); }) as RequestHandler,
  list: (async (request, res) => { res.json({ success: true, message: "Snapshots retrieved", data: await snapshotService.list(String(request.params.projectId)) }); }) as RequestHandler,
  get: (async (request, res) => { res.json({ success: true, message: "Snapshot retrieved", data: await snapshotService.get(String(request.params.snapshotId), String(request.params.projectId)) }); }) as RequestHandler,
  restore: (async (request, res) => { res.status(201).json({ success: true, message: "Snapshot restored", data: await snapshotService.restore(String(request.params.projectId), userId(request), String(request.params.snapshotId)) }); }) as RequestHandler,
};
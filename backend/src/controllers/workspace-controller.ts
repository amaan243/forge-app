import type { RequestHandler } from "express";
import { workspaceService } from "../services/workspace-service.js";
import { workspaceCreate, workspaceUpdate, memberCreate, memberUpdate } from "../validators/domain.js";
import type { AuthenticatedRequest, ApiResponse } from "../types/api.js";
const ok = <T>(message: string, data: T): ApiResponse<T> => ({ success: true, message, data });
export const workspaceController = {
  create: (async (request, response) => { response.status(201).json(ok("Workspace created", await workspaceService.create((request as unknown as AuthenticatedRequest).userId, workspaceCreate.parse(request.body)))); }) as RequestHandler,
  list: (async (request, response) => { response.json(ok("Workspaces retrieved", await workspaceService.list((request as unknown as AuthenticatedRequest).userId))); }) as RequestHandler,
  get: (async (request, response) => { response.json(ok("Workspace retrieved", await workspaceService.get(String(request.params.workspaceId)))); }) as RequestHandler,
  update: (async (request, response) => { response.json(ok("Workspace updated", await workspaceService.update(String(request.params.workspaceId), workspaceUpdate.parse(request.body)))); }) as RequestHandler,
  remove: (async (request, response) => { await workspaceService.remove(String(request.params.workspaceId)); response.status(204).send(); }) as RequestHandler,
  members: (async (request, response) => { response.json(ok("Members retrieved", await workspaceService.members(String(request.params.workspaceId)))); }) as RequestHandler,
  addMember: (async (request, response) => { response.status(201).json(ok("Member added", await workspaceService.addMember({ workspace_id: String(request.params.workspaceId), ...memberCreate.parse(request.body) }))); }) as RequestHandler,
  updateMember: (async (request, response) => { response.json(ok("Member updated", await workspaceService.updateMember(String(request.params.memberId), memberUpdate.parse(request.body).role))); }) as RequestHandler,
  removeMember: (async (request, response) => { await workspaceService.removeMember(String(request.params.memberId)); response.status(204).send(); }) as RequestHandler,
};
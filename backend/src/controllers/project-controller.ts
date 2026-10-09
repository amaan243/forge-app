import type { RequestHandler } from "express";
import { projectService } from "../services/project-service.js";
import { projectCreate, projectUpdate, requirementCreate, requirementUpdate } from "../validators/domain.js";
import type { AuthenticatedRequest, ApiResponse } from "../types/api.js";
const ok = <T>(message: string, data: T): ApiResponse<T> => ({ success: true, message, data });
export const projectController = {
  create: (async (request, response) => { response.status(201).json(ok("Project created", await projectService.create((request as unknown as AuthenticatedRequest).userId, projectCreate.parse(request.body)))); }) as RequestHandler,
  createInWorkspace: (async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    const parsed = projectCreate.parse({ ...request.body, workspace_id: workspaceId });
    response.status(201).json(ok("Project created", await projectService.create((request as unknown as AuthenticatedRequest).userId, { ...parsed, workspace_id: workspaceId })));
  }) as RequestHandler,
  list: (async (request, response) => {
    const workspaceId = request.query.workspace_id ? String(request.query.workspace_id) : undefined;
    const userId = (request as unknown as AuthenticatedRequest).userId;
    const projects = workspaceId ? await projectService.list(workspaceId) : await projectService.listForUser(userId);
    response.json(ok("Projects retrieved", projects));
  }) as RequestHandler,
  listForWorkspace: (async (request, response) => {
    const workspaceId = String(request.params.workspaceId);
    response.json(ok("Projects retrieved", await projectService.list(workspaceId)));
  }) as RequestHandler,
  get: (async (request, response) => { response.json(ok("Project retrieved", await projectService.get(String(request.params.projectId)))); }) as RequestHandler,
  update: (async (request, response) => { response.json(ok("Project updated", await projectService.update(String(request.params.projectId), projectUpdate.parse(request.body)))); }) as RequestHandler,
  remove: (async (request, response) => { await projectService.remove(String(request.params.projectId)); response.status(204).send(); }) as RequestHandler,
  requirements: (async (request, response) => { response.json(ok("Requirements retrieved", await projectService.requirements(String(request.params.projectId)))); }) as RequestHandler,
  getRequirement: (async (request, response) => { response.json(ok("Requirement retrieved", await projectService.getRequirement(String(request.params.requirementId)))); }) as RequestHandler,
  createRequirement: (async (request, response) => { response.status(201).json(ok("Requirement created", await projectService.createRequirement((request as unknown as AuthenticatedRequest).userId, { project_id: String(request.params.projectId), ...requirementCreate.parse(request.body), version: 1 }))); }) as RequestHandler,
  updateRequirement: (async (request, response) => { response.json(ok("Requirement updated", await projectService.updateRequirement(String(request.params.requirementId), requirementUpdate.parse(request.body)))); }) as RequestHandler,
  removeRequirement: (async (request, response) => { await projectService.removeRequirement(String(request.params.requirementId)); response.status(204).send(); }) as RequestHandler,
};
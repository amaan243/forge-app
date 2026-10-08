import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, NotFoundError } from "../errors/app-error.js";
import { projectRepository } from "../repositories/project-repository.js";
import { workspaceRepository } from "../repositories/workspace-repository.js";
import type { AuthenticatedRequest, WorkspaceRole } from "../types/api.js";

export function requireProjectRole(allowed: WorkspaceRole[]) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const project = await projectRepository.findById(String(request.params.projectId));
      if (!project) throw new NotFoundError("Project not found");
      if (request.params.requirementId) {
        const requirement = await projectRepository.findRequirement(String(request.params.requirementId));
        if (!requirement || requirement.project_id !== project.id) throw new NotFoundError("Requirement not found");
      }
      const member = await workspaceRepository.findMember(project.workspace_id, (request as unknown as AuthenticatedRequest).userId);
      if (!member || !allowed.includes(member.role)) throw new ForbiddenError();
      request.project = project; request.workspaceMember = member;
      next();
    } catch (error) { next(error); }
  };
}
export const requireProjectMember = requireProjectRole(["owner", "admin", "member", "viewer"]);
export const requireProjectEditor = requireProjectRole(["owner", "admin", "member"]);
export const requireProjectAdmin = requireProjectRole(["owner", "admin"]);
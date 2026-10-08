import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, NotFoundError } from "../errors/app-error.js";
import type { AuthenticatedRequest, WorkspaceRole } from "../types/api.js";
import { workspaceRepository } from "../repositories/workspace-repository.js";

export function requireWorkspaceRole(allowed: WorkspaceRole[]) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    try {
      const workspaceId = String(request.params.workspaceId);
      const member = await workspaceRepository.findMember(workspaceId, (request as unknown as AuthenticatedRequest).userId);
      if (!member) throw new NotFoundError("Workspace not found");
      if (!allowed.includes(member.role)) throw new ForbiddenError();
      request.workspaceMember = member;
      next();
    } catch (error) { next(error); }
  };
}
export const requireWorkspaceMember = requireWorkspaceRole(["owner", "admin", "member", "viewer"]);
export const requireWorkspaceAdmin = requireWorkspaceRole(["owner", "admin"]);
export const requireWorkspaceOwner = requireWorkspaceRole(["owner"]);

export async function requireWorkspaceFromInput(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try {
    const workspaceId = String(request.body.workspace_id ?? request.query.workspace_id ?? "");
    const member = await workspaceRepository.findMember(workspaceId, (request as unknown as AuthenticatedRequest).userId);
    if (!member) throw new NotFoundError("Workspace not found");
    request.workspaceMember = member;
    next();
  } catch (error) { next(error); }
}
import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "../errors/app-error.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
export async function requireVersionBelongsToProject(request: Request, _response: Response, next: NextFunction): Promise<void> {
  try { const version = await architectureRepository.version(String(request.params.versionId)); if (!version || version.project_id !== String(request.params.projectId)) throw new NotFoundError("Architecture version not found"); next(); } catch (error) { next(error); }
}
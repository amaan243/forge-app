import { NotFoundError } from "../errors/app-error.js";
import { projectRepository } from "../repositories/project-repository.js";
export const projectService = {
  create(userId: string, input: Record<string, unknown>) { return projectRepository.create({ ...input, created_by: userId }); },
  list(workspaceId: string) { return projectRepository.list(workspaceId); },
  async get(id: string) { const value = await projectRepository.findById(id); if (!value) throw new NotFoundError("Project not found"); return value; },
  update(id: string, input: Record<string, unknown>) { return projectRepository.update(id, input); },
  remove(id: string) { return projectRepository.remove(id); },
  requirements(id: string) { return projectRepository.requirements(id); },
  createRequirement(userId: string, input: Record<string, unknown>) { return projectRepository.createRequirement({ ...input, created_by: userId }); },
  updateRequirement(id: string, input: Record<string, unknown>) { return projectRepository.updateRequirement(id, input); },
  removeRequirement(id: string) { return projectRepository.removeRequirement(id); },
};
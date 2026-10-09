import { NotFoundError } from "../errors/app-error.js";
import { projectRepository } from "../repositories/project-repository.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export const projectService = {
  create(userId: string, input: Record<string, unknown>) {
    const name = String(input.name ?? "project");
    const baseSlug = input.slug ? String(input.slug) : slugify(name);
    const finalSlug = baseSlug.length >= 2 ? baseSlug : `proj-${Math.random().toString(36).substring(2, 7)}`;
    return projectRepository.create({ ...input, slug: finalSlug, created_by: userId });
  },
  list(workspaceId?: string) {
    if (!workspaceId) return [];
    return projectRepository.list(workspaceId);
  },
  listForUser(userId: string) {
    return projectRepository.listForUser(userId);
  },
  async get(id: string) { const value = await projectRepository.findById(id); if (!value) throw new NotFoundError("Project not found"); return value; },
  update(id: string, input: Record<string, unknown>) { return projectRepository.update(id, input); },
  remove(id: string) { return projectRepository.remove(id); },
  requirements(id: string) { return projectRepository.requirements(id); },
  async getRequirement(id: string) { const value = await projectRepository.findRequirement(id); if (!value) throw new NotFoundError("Requirement not found"); return value; },
  createRequirement(userId: string, input: Record<string, unknown>) { return projectRepository.createRequirement({ ...input, created_by: userId }); },
  updateRequirement(id: string, input: Record<string, unknown>) { return projectRepository.updateRequirement(id, input); },
  removeRequirement(id: string) { return projectRepository.removeRequirement(id); },
};
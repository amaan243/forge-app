import { ConflictError, NotFoundError } from "../errors/app-error.js";
import { workspaceRepository } from "../repositories/workspace-repository.js";
import type { WorkspaceRole } from "../types/api.js";
export const workspaceService = {
  async create(userId: string, input: { name: string; slug: string; description?: string }) { return workspaceRepository.create({ ...input, owner_id: userId }); },
  list(userId: string) { return workspaceRepository.listForUser(userId); },
  async get(id: string) { const value = await workspaceRepository.findById(id); if (!value) throw new NotFoundError("Workspace not found"); return value; },
  update(id: string, input: Record<string, unknown>) { return workspaceRepository.update(id, input); },
  remove(id: string) { return workspaceRepository.remove(id); },
  members(id: string) { return workspaceRepository.members(id); },
  async addMember(input: { workspace_id: string; user_id: string; role: WorkspaceRole }) { try { return await workspaceRepository.addMember(input); } catch { throw new ConflictError("User is already a workspace member"); } },
  updateMember(id: string, role: WorkspaceRole) { return workspaceRepository.updateMember(id, { role }); },
  removeMember(id: string) { return workspaceRepository.removeMember(id); },
};
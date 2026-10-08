import { z } from "zod";
export const uuid = z.string().uuid();
export const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const workspaceIdParams = z.object({ workspaceId: uuid });
export const projectIdParams = z.object({ projectId: uuid });
export const memberParams = workspaceIdParams.extend({ memberId: uuid });
export const requirementParams = projectIdParams.extend({ requirementId: uuid });
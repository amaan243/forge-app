import type { WorkspaceMember } from "./api.js";
declare global { namespace Express { interface Request { requestId: string; userId?: string; workspaceMember?: WorkspaceMember } } }
export {};
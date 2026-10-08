import type { Project } from "./api.js";
declare global { namespace Express { interface Request { project?: Project } } }
export {};
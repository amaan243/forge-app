import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectEditor, requireProjectMember } from "../middleware/project-auth.js";
import { knowledgeGraphController } from "../controllers/knowledge-graph-controller.js";

export const knowledgeGraphRoutes = Router({ mergeParams: true });

knowledgeGraphRoutes.use(requireAuth);

knowledgeGraphRoutes.get("/knowledge-graph/context", requireProjectMember, knowledgeGraphController.getContext);
knowledgeGraphRoutes.get("/knowledge-graph", requireProjectMember, knowledgeGraphController.getGraph);
knowledgeGraphRoutes.get("/knowledge-graph/neighborhood/:entityId", requireProjectMember, knowledgeGraphController.getNeighborhood);
knowledgeGraphRoutes.get("/knowledge-graph/traceability/:entityId", requireProjectMember, knowledgeGraphController.getTraceability);
knowledgeGraphRoutes.post("/knowledge-graph/impact", requireProjectEditor, knowledgeGraphController.analyzeImpact);

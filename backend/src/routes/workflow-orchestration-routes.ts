import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireProjectEditor, requireProjectMember } from "../middleware/project-auth.js";
import { workflowOrchestrationController } from "../controllers/workflow-orchestration-controller.js";

export const workflowRoutes = Router({ mergeParams: true });

workflowRoutes.use(requireAuth);

workflowRoutes.get("/workflow/context", requireProjectMember, workflowOrchestrationController.getContext);
workflowRoutes.post("/workflow/run", requireProjectEditor, workflowOrchestrationController.runWorkflow);
workflowRoutes.get("/workflow/runs", requireProjectMember, workflowOrchestrationController.listRuns);
workflowRoutes.get("/workflow/runs/:runId", requireProjectMember, workflowOrchestrationController.getRun);
workflowRoutes.post("/workflow/runs/:runId/retry-stage", requireProjectEditor, workflowOrchestrationController.retryStage);

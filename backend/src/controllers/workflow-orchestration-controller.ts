import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { workflowOrchestrationService } from "../services/workflow-orchestration-service.js";
import { runWorkflowSchema, retryStageSchema } from "../validators/workflow-orchestration.js";

const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;

export const workflowOrchestrationController = {
  getContext: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const context = await workflowOrchestrationService.getContext(projectId);
    response.json({
      success: true,
      message: "Workflow context retrieved",
      data: context,
    });
  }) as RequestHandler,

  runWorkflow: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = runWorkflowSchema.parse(request.body ?? {});
    const run = await workflowOrchestrationService.executeWorkflow(projectId, userId(request), parsed);
    response.status(201).json({
      success: true,
      message: "Engineering workflow executed",
      data: run,
    });
  }) as RequestHandler,

  listRuns: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const runs = await workflowOrchestrationService.listRuns(projectId);
    response.json({
      success: true,
      message: "Workflow runs retrieved",
      data: runs,
    });
  }) as RequestHandler,

  getRun: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const runId = String(request.params.runId);
    const run = await workflowOrchestrationService.getRun(projectId, runId);
    response.json({
      success: true,
      message: "Workflow run retrieved",
      data: run,
    });
  }) as RequestHandler,

  retryStage: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const runId = String(request.params.runId);
    const parsed = retryStageSchema.parse(request.body ?? {});
    const updatedRun = await workflowOrchestrationService.retryStage(
      projectId,
      runId,
      parsed.stage,
      userId(request)
    );
    response.json({
      success: true,
      message: `Workflow stage ${parsed.stage} retried successfully`,
      data: updatedRun,
    });
  }) as RequestHandler,
};

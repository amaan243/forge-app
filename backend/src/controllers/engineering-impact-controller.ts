import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { engineeringImpactService } from "../services/engineering-impact-service.js";
import { impactAnalyzeSchema, impactToSimulationSchema } from "../validators/engineering-impact.js";

const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;

export const engineeringImpactController = {
  analyze: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = impactAnalyzeSchema.parse(request.body);
    const report = await engineeringImpactService.analyze(projectId, userId(request), parsed);
    response.status(201).json({
      success: true,
      message: "Engineering impact analysis completed",
      data: report,
    });
  }) as RequestHandler,

  listReports: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const reports = await engineeringImpactService.list(projectId);
    response.json({
      success: true,
      message: "Impact reports retrieved",
      data: reports,
    });
  }) as RequestHandler,

  getReport: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const reportId = String(request.params.reportId);
    const report = await engineeringImpactService.get(projectId, reportId);
    response.json({
      success: true,
      message: "Impact report retrieved",
      data: report,
    });
  }) as RequestHandler,

  deleteReport: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const reportId = String(request.params.reportId);
    await engineeringImpactService.delete(projectId, reportId);
    response.json({
      success: true,
      message: "Impact report deleted",
    });
  }) as RequestHandler,

  convertToSimulation: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const reportId = String(request.params.reportId);
    const parsed = impactToSimulationSchema.parse(request.body);
    const simulation = await engineeringImpactService.convertToPlaygroundSimulation(
      projectId,
      userId(request),
      reportId,
      parsed
    );
    response.status(201).json({
      success: true,
      message: "Impact report converted to Engineering Playground simulation",
      data: simulation,
    });
  }) as RequestHandler,
};

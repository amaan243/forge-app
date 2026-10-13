import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { qualityService } from "../services/quality-service.js";
import { engineeringQualityRepository } from "../repositories/engineering-quality-repository.js";
import {
  evaluateQualitySchema,
  recordEvidenceSchema,
  updatePolicySchema,
} from "../validators/engineering-quality.js";

const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;

export const engineeringQualityController = {
  getContext: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const context = await qualityService.getContext(projectId);
    response.json({
      success: true,
      message: "Quality gate context retrieved",
      data: context,
    });
  }) as RequestHandler,

  evaluate: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = evaluateQualitySchema.parse(request.body ?? {});
    const report = await qualityService.evaluateQualityGate(projectId, userId(request), parsed);
    response.status(201).json({
      success: true,
      message: "Engineering quality evaluation completed",
      data: report,
    });
  }) as RequestHandler,

  listReports: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const reports = await qualityService.listReports(projectId);
    response.json({
      success: true,
      message: "Quality reports retrieved",
      data: reports,
    });
  }) as RequestHandler,

  getReport: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const reportId = String(request.params.reportId);
    const report = await qualityService.getReport(projectId, reportId);
    response.json({
      success: true,
      message: "Quality report retrieved",
      data: report,
    });
  }) as RequestHandler,

  recordEvidence: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = recordEvidenceSchema.parse(request.body ?? {});
    const evidence = await qualityService.recordEvidence(projectId, userId(request), parsed as any);
    response.status(201).json({
      success: true,
      message: "Quality verification evidence recorded",
      data: evidence,
    });
  }) as RequestHandler,

  listEvidence: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const evidenceList = await engineeringQualityRepository.listEvidence(projectId);
    response.json({
      success: true,
      message: "Quality verification evidence records retrieved",
      data: evidenceList,
    });
  }) as RequestHandler,

  getPolicies: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const policies = await qualityService.getPolicies(projectId);
    response.json({
      success: true,
      message: "Quality policies retrieved",
      data: policies,
    });
  }) as RequestHandler,

  updatePolicy: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const policyId = String(request.params.policyId);
    const parsed = updatePolicySchema.parse(request.body ?? {});
    const updated = await qualityService.updatePolicy(projectId, policyId, parsed);
    response.json({
      success: true,
      message: `Quality policy '${policyId}' updated`,
      data: updated,
    });
  }) as RequestHandler,
};

import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { knowledgeGraphService } from "../services/knowledge-graph-service.js";
import {
  queryKnowledgeGraphSchema,
  getNeighborhoodSchema,
  getTraceabilitySchema,
  nodeImpactSchema,
} from "../validators/knowledge-graph.js";

const userId = (request: Parameters<RequestHandler>[0]) =>
  (request as unknown as AuthenticatedRequest).userId;

export const knowledgeGraphController = {
  getContext: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const context = await knowledgeGraphService.getContext(projectId);
    response.json({
      success: true,
      message: "Knowledge graph context retrieved",
      data: context,
    });
  }) as RequestHandler,

  getGraph: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = queryKnowledgeGraphSchema.parse(request.query ?? {});
    const result = await knowledgeGraphService.queryGraph(projectId, parsed, userId(request));
    response.json({
      success: true,
      message: "Knowledge graph retrieved",
      data: result,
    });
  }) as RequestHandler,

  getNeighborhood: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = getNeighborhoodSchema.parse({
      centerEntityId: request.params.entityId || request.query.centerEntityId,
      depth: request.query.depth,
    });
    const result = await knowledgeGraphService.getNeighborhood(
      projectId,
      parsed.centerEntityId,
      parsed.depth
    );
    response.json({
      success: true,
      message: "Entity neighborhood retrieved",
      data: result,
    });
  }) as RequestHandler,

  getTraceability: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = getTraceabilitySchema.parse({
      rootEntityId: request.params.entityId || request.query.rootEntityId,
    });
    const result = await knowledgeGraphService.getTraceability(projectId, parsed.rootEntityId);
    response.json({
      success: true,
      message: "Traceability chain retrieved",
      data: result,
    });
  }) as RequestHandler,

  analyzeImpact: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const parsed = nodeImpactSchema.parse(request.body ?? {});
    const result = await knowledgeGraphService.analyzeNodeImpact(
      projectId,
      parsed.entityId,
      userId(request),
      parsed.changeType
    );
    response.json({
      success: true,
      message: "Node impact analyzed",
      data: result,
    });
  }) as RequestHandler,
};

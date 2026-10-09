import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { architectureService } from "../services/architecture-service.js";
import { architectureEdgeCreate, architectureEdgeUpdate, architectureNodeCreate, architectureNodeUpdate, architectureVersionCopy, architectureVersionSave, architectureVersionUpdate, compareQuery, explanationRequest } from "../validators/architecture.js";
import { versionComparisonService } from "../services/version-comparison-service.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
import { ArchitectureExplanationService } from "../services/architecture-explanation-service.js";
import { UnsupportedAIProvider } from "../integrations/ai-provider.js";
import { ValidationError } from "../errors/app-error.js";
const response = <T>(message: string, data: T) => ({ success: true, message, data });
const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;
export const architectureController = {
  generate: (async (request, res) => { res.json(response("Architecture preview generated", await architectureService.generatePreview(String(request.params.projectId), userId(request)))); }) as RequestHandler,
  current: (async (request, res) => { res.json(response("Architecture retrieved", await architectureService.getCurrent(String(request.params.projectId)))); }) as RequestHandler,
  listVersions: (async (request, res) => { res.json(response("Architecture versions retrieved", await architectureService.listVersions(String(request.params.projectId)))); }) as RequestHandler,
  getVersion: (async (request, res) => { res.json(response("Architecture version retrieved", await architectureService.getVersion(String(request.params.versionId)))); }) as RequestHandler,
  createVersion: (async (request, res) => { res.status(201).json(response("Architecture version created", await architectureService.createVersion(String(request.params.projectId), userId(request), architectureVersionSave.parse(request.body)))); }) as RequestHandler,
  updateVersion: (async (request, res) => { res.json(response("Architecture version updated", await architectureService.updateVersion(String(request.params.versionId), architectureVersionUpdate.parse(request.body)))); }) as RequestHandler,
  deleteVersion: (async (request, res) => { await architectureService.deleteVersion(String(request.params.versionId)); res.status(204).send(); }) as RequestHandler,
  publish: (async (request, res) => { res.json(response("Architecture version published", await architectureService.publish(String(request.params.versionId), userId(request)))); }) as RequestHandler,
  duplicateVersion: (async (request, res) => { res.status(201).json(response("Architecture version duplicated", await architectureService.copyVersion(String(request.params.projectId), userId(request), String(request.params.versionId), architectureVersionCopy.parse(request.body)))); }) as RequestHandler,
  restoreVersion: (async (request, res) => { res.status(201).json(response("Architecture version restored", await architectureService.copyVersion(String(request.params.projectId), userId(request), String(request.params.versionId), { name: `Restored ${String(request.params.versionId)}` }))); }) as RequestHandler,
  createNode: (async (request, res) => { res.status(201).json(response("Architecture node created", await architectureService.nodeCreate(String(request.params.versionId), architectureNodeCreate.parse(request.body)))); }) as RequestHandler,
  updateNode: (async (request, res) => { res.json(response("Architecture node updated", await architectureService.nodeUpdate(String(request.params.versionId), String(request.params.nodeId), architectureNodeUpdate.parse(request.body)))); }) as RequestHandler,
  deleteNode: (async (request, res) => { await architectureService.nodeDelete(String(request.params.versionId), String(request.params.nodeId)); res.status(204).send(); }) as RequestHandler,
  createEdge: (async (request, res) => { res.status(201).json(response("Architecture edge created", await architectureService.edgeCreate(String(request.params.versionId), architectureEdgeCreate.parse(request.body)))); }) as RequestHandler,
  updateEdge: (async (request, res) => { res.json(response("Architecture edge updated", await architectureService.edgeUpdate(String(request.params.versionId), String(request.params.edgeId), architectureEdgeUpdate.parse(request.body)))); }) as RequestHandler,
  deleteEdge: (async (request, res) => { await architectureService.edgeDelete(String(request.params.versionId), String(request.params.edgeId)); res.status(204).send(); }) as RequestHandler,
  compare: (async (request, res) => { const query = compareQuery.parse(request.query); res.json(response("Architecture versions compared", await versionComparisonService.compare(String(request.params.projectId), query.from, query.to))); }) as RequestHandler,
  explain: (async (request, res) => { const node = await architectureRepository.node(String(request.params.nodeId)); if (!node || (request.project && (await architectureService.getVersion(node.architecture_version_id)).version.project_id !== request.project.id)) throw new ValidationError({ nodeId: "Node not found" }); const architecture = await architectureService.getVersion(node.architecture_version_id); res.json(response("Architecture explanation generated", await new ArchitectureExplanationService(new UnsupportedAIProvider()).explain({ node, architecture, context: explanationRequest.parse(request.body).context }))); }) as RequestHandler,
};
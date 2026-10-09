import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { repositoryIntelligenceService } from "../services/repository-intelligence-service.js";
import {
  dependencyQuery,
  driftAnalyzeInput,
  repositoryAnalyzeTrigger,
  repositoryConnect,
} from "../validators/repository-intelligence.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import { architectureService } from "../services/architecture-service.js";
import { driftDetectionService } from "../services/drift-service.js";
import { DriftRemediationService } from "../services/drift-remediation-service.js";
import { UnsupportedAIProvider } from "../integrations/ai-provider.js";
import { repositoryAnalysisQueue, isRedisAvailable } from "../jobs/repository-analysis-queue.js";
import { dependencyAnalyzerService } from "../services/dependency-analyzer-service.js";
import { NotFoundError, ValidationError } from "../errors/app-error.js";
import { logger } from "../lib/logger.js";

const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;

export const repositoryIntelligenceController = {
  connect: (async (request, response) => {
    const input = repositoryConnect.parse(request.body);
    const data = await repositoryIntelligenceService.connect(String(request.params.projectId), userId(request), {
      url: input.repository_url,
      branch: input.branch,
      provider: input.provider,
      accessType: input.access_type,
      tokenReference: input.credential_reference,
    });
    response.status(201).json({ success: true, message: "Repository connected successfully", data });
  }) as RequestHandler,

  get: (async (request, response) => {
    const data = await repositoryIntelligenceService.get(String(request.params.projectId));
    response.json({ success: true, message: "Repository retrieved", data });
  }) as RequestHandler,

  remove: (async (request, response) => {
    await repositoryIntelligenceService.disconnect(String(request.params.projectId));
    response.status(204).send();
  }) as RequestHandler,

  analyses: (async (request, response) => {
    const data = await repositoryIntelligenceService.analyses(String(request.params.projectId));
    response.json({ success: true, message: "Repository analyses retrieved", data });
  }) as RequestHandler,

  latestAnalysis: (async (request, response) => {
    const data = await repositoryIntelligenceService.latestAnalysis(String(request.params.projectId));
    response.json({ success: true, message: "Latest analysis retrieved", data });
  }) as RequestHandler,

  getAnalysis: (async (request, response) => {
    const data = await repositoryIntelligenceService.analysis(String(request.params.analysisId));
    if (!data || data.project_id !== String(request.params.projectId)) {
      throw new NotFoundError("Repository analysis snapshot not found");
    }
    response.json({ success: true, message: "Analysis snapshot retrieved", data });
  }) as RequestHandler,

  analyze: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const trigger = repositoryAnalyzeTrigger.parse(request.body ?? {});
    const currentUserId = userId(request);

    // Prevent duplicate concurrent work if one is already active
    const active = await repositoryIntelligenceRepository.activeAnalysis(projectId);
    if (active) {
      response.status(202).json({ success: true, message: "Analysis is already in progress", data: active });
      return;
    }

    const analysis = await repositoryIntelligenceService.enqueueAnalysis(projectId, currentUserId, trigger?.branch);

    // Check if Redis is running and reachable
    const hasRedis = await isRedisAvailable();
    if (hasRedis) {
      try {
        await Promise.race([
          repositoryAnalysisQueue.add(
            "analyze",
            { projectId, userId: currentUserId, analysisId: analysis.id }
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Queue add timeout")), 1000)),
        ]);
      } catch (queueError) {
        logger.warn("Redis BullMQ queue unavailable; running controlled asynchronous analysis:", queueError);
        setImmediate(() => {
          repositoryIntelligenceService.analyze(projectId, currentUserId, analysis.id).catch((err) => {
            logger.error("Controlled asynchronous repository analysis failed:", err);
          });
        });
      }
    } else {
      // Development mode / Redis offline: execute asynchronous bounded job ensuring status lifecycle
      setImmediate(() => {
        repositoryIntelligenceService.analyze(projectId, currentUserId, analysis.id).catch((err) => {
          logger.error("Controlled asynchronous repository analysis failed:", err);
        });
      });
    }

    response.status(202).json({ success: true, message: "Repository analysis queued", data: analysis });
  }) as RequestHandler,

  dependencies: (async (request, response) => {
    const dependencies = await repositoryIntelligenceService.dependencies(
      String(request.params.projectId),
      dependencyQuery.parse(request.query)
    );
    const graph = dependencyAnalyzerService.graph(dependencies);
    response.json({ success: true, message: "Dependencies retrieved", data: graph });
  }) as RequestHandler,

  driftAnalyze: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const input = driftAnalyzeInput.parse(request.body ?? {});

    // 1. Resolve selected or latest architecture version
    let version;
    if (input.architecture_version_id) {
      version = await architectureService.getVersion(input.architecture_version_id);
    } else {
      version = await architectureService.getCurrent(projectId);
    }

    if (!version || !version.version) {
      throw new ValidationError({
        architecture: "No intended architecture version exists for this project. Please create or save an architecture version first.",
      });
    }

    // 2. Resolve latest completed repository analysis
    const analysis = await repositoryIntelligenceRepository.latestAnalysis(projectId);
    if (!analysis || analysis.status !== "completed") {
      throw new ValidationError({
        repository: "A completed repository analysis snapshot is required before drift detection. Please analyze your repository first.",
      });
    }

    // 3. Deterministic drift detection
    const result = await driftDetectionService.compare(projectId, version.version.id, analysis);

    // 4. Persist drift analysis and items
    const drift = await repositoryIntelligenceRepository.createDrift({
      project_id: projectId,
      architecture_version_id: version.version.id,
      repository_analysis_id: analysis.id,
      match_score: result.score,
      summary: result.summary,
      status: "completed",
    });

    await repositoryIntelligenceRepository.createDriftItems(
      result.items.map((item) => ({ ...item, drift_analysis_id: drift.id }))
    );

    response.status(201).json({
      success: true,
      message: "Drift analysis completed",
      data: { ...drift, items: result.items },
    });
  }) as RequestHandler,

  drifts: (async (request, response) => {
    const data = await repositoryIntelligenceRepository.drifts(String(request.params.projectId));
    response.json({ success: true, message: "Drift analyses retrieved", data });
  }) as RequestHandler,

  drift: (async (request, response) => {
    const drift = await repositoryIntelligenceRepository.drift(String(request.params.analysisId));
    if (!drift || drift.project_id !== String(request.params.projectId)) {
      throw new NotFoundError("Drift analysis not found");
    }
    response.json({ success: true, message: "Drift analysis retrieved", data: drift });
  }) as RequestHandler,

  remediation: (async (request, response) => {
    const drift = await repositoryIntelligenceRepository.drift(String(request.params.analysisId));
    if (!drift || drift.project_id !== String(request.params.projectId)) {
      throw new NotFoundError("Drift analysis not found");
    }
    const data = await new DriftRemediationService(new UnsupportedAIProvider()).remediation(drift);
    response.json({ success: true, message: "Drift remediation generated", data });
  }) as RequestHandler,
};
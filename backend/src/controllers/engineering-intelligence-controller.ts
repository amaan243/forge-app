import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "../types/api.js";
import { architectureSimulationService } from "../services/architecture-simulation-service.js";
import { simulationCreate, simulationUpdate, documentGenerate, documentUpdate, sectionRegenerate } from "../validators/engineering-intelligence.js";
import { engineeringRepository } from "../repositories/engineering-intelligence-repository.js";
import { documentationGeneratorService } from "../services/documentation-generator-service.js";
import { architectureService } from "../services/architecture-service.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import { designReviewService } from "../services/design-review-service.js";
import { projectStoryService } from "../services/project-story-service.js";
import { workspaceInsightsService } from "../services/workspace-insights-service.js";
import { aiRunService } from "../services/ai-run-service.js";
import { NotFoundError } from "../errors/app-error.js";

const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;

/** Resolve architecture context if a version_id is provided, or fall back to current */
async function resolveArchitecture(projectId: string, versionId?: string | null) {
  if (versionId) {
    try { return await architectureService.getVersion(versionId); } catch { return undefined; }
  }
  try {
    const current = await architectureService.getCurrent(projectId);
    if (current?.version) return current;
  } catch {
    return undefined;
  }
  return undefined;
}

/** Resolve repository and analysis context */
async function resolveRepoContext(projectId: string, repositoryAnalysisId?: string | null, repositoryId?: string | null) {
  let analysis;
  let repository;
  if (repositoryAnalysisId) {
    analysis = await repositoryIntelligenceRepository.analysis(repositoryAnalysisId);
    if (analysis && analysis.project_id !== projectId) {
      throw new NotFoundError("Repository analysis not found for this project");
    }
  } else {
    // Fall back to latest successful analysis for the project
    analysis = await repositoryIntelligenceRepository.latestSuccessful(projectId, repositoryId || undefined) || undefined;
  }
  if (analysis) {
    repository = await repositoryIntelligenceRepository.repository(projectId, analysis.repository_id) || undefined;
  }
  return { analysis, repository };
}

export const engineeringController = {
  createSimulation: (async (request, response) => {
    response.status(201).json({ success: true, message: "Simulation created", data: await architectureSimulationService.create(String(request.params.projectId), userId(request), simulationCreate.parse(request.body)) });
  }) as RequestHandler,

  listSimulations: (async (request, response) => {
    response.json({ success: true, message: "Simulations retrieved", data: await architectureSimulationService.list(String(request.params.projectId)) });
  }) as RequestHandler,

  getSimulation: (async (request, response) => {
    response.json({ success: true, message: "Simulation retrieved", data: await architectureSimulationService.get(String(request.params.projectId), String(request.params.simulationId)) });
  }) as RequestHandler,

  updateSimulation: (async (request, response) => {
    response.json({ success: true, message: "Simulation updated", data: await architectureSimulationService.update(String(request.params.projectId), String(request.params.simulationId), simulationUpdate.parse(request.body)) });
  }) as RequestHandler,

  simulate: (async (request, response) => {
    response.json({ success: true, message: "Simulation completed", data: await architectureSimulationService.simulate(String(request.params.projectId), String(request.params.simulationId)) });
  }) as RequestHandler,

  apply: (async (request, response) => {
    response.status(201).json({ success: true, message: "Simulation applied as a new architecture version", data: await architectureSimulationService.apply(String(request.params.projectId), userId(request), String(request.params.simulationId)) });
  }) as RequestHandler,

  discard: (async (request, response) => {
    response.json({ success: true, message: "Simulation discarded", data: await architectureSimulationService.discard(String(request.params.projectId), String(request.params.simulationId)) });
  }) as RequestHandler,

  alternative: (async (request, response) => {
    const simulation = await architectureSimulationService.get(String(request.params.projectId), String(request.params.simulationId));
    response.status(201).json({ success: true, message: "Alternative simulation created", data: await architectureSimulationService.create(String(request.params.projectId), userId(request), { base_version_id: simulation.base_version_id, name: `${simulation.name} alternative`, description: simulation.description, proposed_changes: simulation.proposed_changes }) });
  }) as RequestHandler,

  documents: (async (request, response) => {
    response.json({ success: true, message: "Documentation retrieved", data: await engineeringRepository.documents(String(request.params.projectId)) });
  }) as RequestHandler,

  generateDocument: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const input = documentGenerate.parse(request.body);
    const uid = userId(request);

    // Validate that at least one source is specified
    if (!input.version_id && !input.repository_analysis_id) {
      // Try to use latest available sources
    }

    // Check for existing document of same type — avoid duplicates unless force_overwrite
    const existing = (await engineeringRepository.documents(projectId)).find(
      (d) => d.type === input.type
    );
    if (existing && !input.force_overwrite) {
      // Return existing document instead of duplicating
      return response.json({ success: true, message: "Existing documentation returned — use force_overwrite to replace", data: existing });
    }

    const started = Date.now();
    const run = await aiRunService.start(projectId, uid, "documentation_generation", { type: input.type, versionId: input.version_id, analysisId: input.repository_analysis_id });
    try {
      const architecture = await resolveArchitecture(projectId, input.version_id);
      const { analysis, repository } = await resolveRepoContext(projectId, input.repository_analysis_id, input.repository_id);

      // Cross-project isolation: verify architecture belongs to this project
      if (architecture?.version && architecture.version.project_id !== projectId) {
        throw new NotFoundError("Architecture version not found for this project");
      }

      const result = documentationGeneratorService.generateFull({
        title: input.title,
        format: input.format as any,
        type: input.type,
        architecture: architecture ? { version: architecture.version, nodes: architecture.nodes, edges: architecture.edges } : undefined,
        analysis: analysis as any,
        repository: repository as any,
      });

      const docData = {
        project_id: projectId,
        type: input.type,
        title: input.title,
        format: input.format,
        content: result.content,
        source_version_id: result.sourceVersionId || null,
        source_repository_analysis_id: result.sourceAnalysisId || null,
        source_commit_sha: result.sourceCommitSha || null,
        source_branch: result.sourceBranch || input.snapshot_branch || null,
        generated_by: uid,
        manually_edited: false,
        status: "up_to_date",
        generation_metadata: {
          hasArchitectureSource: result.hasArchitectureSource,
          hasRepositorySource: result.hasRepositorySource,
          generatedAt: result.generatedAt,
        },
      };

      let document;
      if (existing && input.force_overwrite) {
        document = await engineeringRepository.updateDocument(projectId, existing.id, docData);
      } else {
        document = await engineeringRepository.createDocument(docData);
      }

      await aiRunService.complete(run.id, { documentId: document.id }, started);
      response.status(201).json({ success: true, message: "Documentation generated", data: document });
    } catch (error) {
      await aiRunService.fail(run.id, error, started);
      throw error;
    }
  }) as RequestHandler,

  getDocument: (async (request, response) => {
    const doc = await engineeringRepository.document(String(request.params.projectId), String(request.params.documentId));
    if (!doc) throw new NotFoundError("Document not found");
    response.json({ success: true, message: "Document retrieved", data: doc });
  }) as RequestHandler,

  updateDocument: (async (request, response) => {
    const input = documentUpdate.parse(request.body);
    const doc = await engineeringRepository.document(String(request.params.projectId), String(request.params.documentId));
    if (!doc) throw new NotFoundError("Document not found");
    response.json({ success: true, message: "Document updated", data: await engineeringRepository.updateDocument(String(request.params.projectId), String(request.params.documentId), { ...input, manually_edited: true, status: "up_to_date" }) });
  }) as RequestHandler,

  deleteDocument: (async (request, response) => {
    await engineeringRepository.deleteDocument(String(request.params.projectId), String(request.params.documentId));
    response.status(204).send();
  }) as RequestHandler,

  regenerateDocument: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const document = await engineeringRepository.document(projectId, String(request.params.documentId));
    if (!document) throw new NotFoundError("Document not found");

    if (document.manually_edited) {
      const body = sectionRegenerate.safeParse(request.body);
      if (!body.success || !body.data.force_overwrite) {
        return response.status(409).json({
          success: false,
          message: "This document has been manually edited. Use force_overwrite: true to regenerate and discard edits.",
          error: { code: "MANUAL_EDIT_PROTECTED" },
        });
      }
    }

    const architecture = await resolveArchitecture(projectId, (document as any).source_version_id);
    const { analysis, repository } = await resolveRepoContext(projectId, (document as any).source_repository_analysis_id);

    // Cross-project isolation
    if (architecture?.version && architecture.version.project_id !== projectId) {
      throw new NotFoundError("Architecture version not found for this project");
    }

    const result = documentationGeneratorService.generateFull({
      title: document.title,
      format: document.format as any,
      type: document.type,
      architecture: architecture ? { version: architecture.version, nodes: architecture.nodes, edges: architecture.edges } : undefined,
      analysis: analysis as any,
      repository: repository as any,
    });

    const updated = await engineeringRepository.updateDocument(projectId, document.id, {
      content: result.content,
      status: "up_to_date",
      manually_edited: false,
      source_commit_sha: result.sourceCommitSha || null,
      generation_metadata: { hasArchitectureSource: result.hasArchitectureSource, hasRepositorySource: result.hasRepositorySource, generatedAt: result.generatedAt },
    });
    response.json({ success: true, message: "Documentation regenerated", data: updated });
  }) as RequestHandler,

  staleness: (async (request, response) => {
    const projectId = String(request.params.projectId);
    const documents = await engineeringRepository.documents(projectId);
    const latestAnalysis = await repositoryIntelligenceRepository.latestSuccessful(projectId);
    const staleInfo = documents.map((doc) => {
      const docAny = doc as any;
      const isAnalysisStale = latestAnalysis && docAny.source_repository_analysis_id && docAny.source_repository_analysis_id !== latestAnalysis.id;
      return {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        manually_edited: doc.manually_edited,
        source_version_id: docAny.source_version_id,
        source_repository_analysis_id: docAny.source_repository_analysis_id,
        source_commit_sha: docAny.source_commit_sha,
        latest_analysis_id: latestAnalysis?.id || null,
        latest_commit_sha: latestAnalysis?.commit_sha || null,
        is_analysis_stale: !!isAnalysisStale,
        updated_at: doc.updated_at,
      };
    });
    response.json({ success: true, message: "Staleness report retrieved", data: staleInfo });
  }) as RequestHandler,

  review: (async (request, response) => {
    const architecture = await architectureService.getCurrent(String(request.params.projectId));
    const started = Date.now();
    const run = await aiRunService.start(String(request.params.projectId), userId(request), "design_review", {});
    const findings = designReviewService.review(architecture);
    await aiRunService.complete(run.id, { findingCount: findings.length }, started);
    response.json({ success: true, message: "Design review completed", data: findings });
  }) as RequestHandler,

  story: (async (request, response) => {
    const existing = await engineeringRepository.story(String(request.params.projectId));
    response.json({ success: true, message: "Project story retrieved", data: existing });
  }) as RequestHandler,

  generateStory: (async (request, response) => {
    const story = await projectStoryService.generate(String(request.params.projectId));
    const saved = await engineeringRepository.upsertStory({ project_id: request.params.projectId, content: story, generated_by: userId(request) });
    response.status(201).json({ success: true, message: "Project story generated", data: saved });
  }) as RequestHandler,

  insights: (async (request, response) => {
    response.json({ success: true, message: "Project insights retrieved", data: await workspaceInsightsService.get(String(request.params.projectId)) });
  }) as RequestHandler,
};

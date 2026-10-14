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
import { AppError, NotFoundError } from "../errors/app-error.js";

const userId = (request: Parameters<RequestHandler>[0]) => (request as unknown as AuthenticatedRequest).userId;

/** Resolve architecture context strictly based on requirements and project boundary */
async function resolveArchitectureContext(projectId: string, versionId?: string | null, required = false) {
  if (versionId) {
    let architecture;
    try {
      architecture = await architectureService.getVersion(versionId);
    } catch {
      throw new NotFoundError("Architecture version not found for this project");
    }
    if (!architecture?.version) {
      throw new NotFoundError("Architecture version not found for this project");
    }
    if (architecture.version.project_id !== projectId) {
      throw new NotFoundError("Architecture version not found for this project");
    }
    return architecture;
  }
  if (required) {
    try {
      const current = await architectureService.getCurrent(projectId);
      if (current?.version) {
        if (current.version.project_id !== projectId) {
          throw new NotFoundError("Architecture version not found for this project");
        }
        return current;
      }
    } catch {
      // ignore
    }
    throw new AppError("A saved architecture version is required for this documentation type.", 400, "MISSING_REQUIRED_SOURCE");
  }
  return undefined;
}

/** Resolve repository and analysis context strictly based on requirements and project boundary */
async function resolveRepoContext(projectId: string, repositoryAnalysisId?: string | null, repositoryId?: string | null, required = false) {
  let analysis;
  let repository;

  if (repositoryId) {
    repository = await repositoryIntelligenceRepository.repository(projectId, repositoryId);
    if (!repository || repository.project_id !== projectId) {
      throw new NotFoundError("Repository not found for this project");
    }
  }

  if (repositoryAnalysisId) {
    analysis = await repositoryIntelligenceRepository.analysis(repositoryAnalysisId);
    if (!analysis || analysis.project_id !== projectId) {
      throw new NotFoundError("Repository analysis snapshot not found for this project");
    }
    if (repositoryId && analysis.repository_id !== repositoryId) {
      throw new AppError("Repository analysis snapshot does not belong to the selected repository", 400, "INVALID_SOURCE_COMBINATION");
    }
    if (analysis.status !== "completed") {
      throw new AppError(`Repository analysis is not completed (status: ${analysis.status}). A completed analysis scan is required.`, 400, "ANALYSIS_NOT_COMPLETED");
    }
  } else if (required) {
    analysis = (await repositoryIntelligenceRepository.latestSuccessful(projectId, repositoryId || undefined)) || undefined;
    if (!analysis) {
      throw new AppError("A completed repository analysis scan is required for this documentation type.", 400, "MISSING_REQUIRED_SOURCE");
    }
    if (analysis.status !== "completed") {
      throw new AppError(`Repository analysis is not completed (status: ${analysis.status}). A completed analysis scan is required.`, 400, "ANALYSIS_NOT_COMPLETED");
    }
  }

  if (analysis && !repository) {
    repository = (await repositoryIntelligenceRepository.repository(projectId, analysis.repository_id)) || undefined;
    if (repository && repository.project_id !== projectId) {
      throw new NotFoundError("Repository not found for this project");
    }
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

    // Validate cross-project boundaries on any supplied IDs early
    if (input.version_id) {
      const ver = await architectureService.getVersion(input.version_id).catch(() => null);
      if (!ver || ver.version?.project_id !== projectId) {
        throw new NotFoundError("Architecture version not found for this project");
      }
    }
    if (input.repository_id) {
      const repo = await repositoryIntelligenceRepository.repository(projectId, input.repository_id).catch(() => null);
      if (!repo || repo.project_id !== projectId) {
        throw new NotFoundError("Repository not found for this project");
      }
    }
    if (input.repository_analysis_id) {
      const an = await repositoryIntelligenceRepository.analysis(input.repository_analysis_id).catch(() => null);
      if (!an || an.project_id !== projectId) {
        throw new NotFoundError("Repository analysis snapshot not found for this project");
      }
      if (input.repository_id && an.repository_id !== input.repository_id) {
        throw new AppError("Repository analysis snapshot does not belong to the selected repository", 400, "INVALID_SOURCE_COMBINATION");
      }
    }

    // Determine effective source mode based on document type and input
    const type = input.type;
    let mode = input.source_mode;

    // Enforce document type source constraints
    if (type === "repository_overview" || type === "getting_started") {
      if (mode && mode !== "repository") {
        throw new AppError(`${type === "repository_overview" ? "Repository Intelligence" : "Developer Setup"} requires a repository scan only.`, 400, "INVALID_SOURCE_MODE");
      }
      mode = "repository";
    } else if (type === "architecture_overview" || type === "system_design") {
      if (mode === "repository") {
        throw new AppError(`${type === "architecture_overview" ? "Architecture Overview" : "System Design"} requires a saved architecture baseline.`, 400, "INVALID_SOURCE_MODE");
      }
      if (!mode) {
        mode = input.repository_analysis_id ? "combined" : "architecture";
      }
    } else if (type === "api_documentation" || type === "deployment" || type === "security" || type === "testing_security") {
      if (mode === "architecture") {
        throw new AppError(`${input.type} requires repository implementation evidence.`, 400, "INVALID_SOURCE_MODE");
      }
      if (!mode) {
        mode = input.version_id ? "combined" : "repository";
      }
    } else if (type === "database_documentation") {
      if (!mode) {
        mode = (input.version_id && input.repository_analysis_id) ? "combined" : (input.version_id ? "architecture" : "repository");
      }
    } else {
      if (!mode) {
        mode = (input.version_id && input.repository_analysis_id) ? "combined" : (input.version_id ? "architecture" : "repository");
      }
    }

    const requiresArchitecture = mode === "architecture" || mode === "combined";
    const requiresRepository = mode === "repository" || mode === "combined";

    // Resolve sources strictly according to mode
    let architecture: Awaited<ReturnType<typeof resolveArchitectureContext>> = undefined;
    if (requiresArchitecture) {
      architecture = await resolveArchitectureContext(projectId, input.version_id, true);
    }

    let repoContext = { analysis: undefined as any, repository: undefined as any };
    if (requiresRepository) {
      repoContext = await resolveRepoContext(projectId, input.repository_analysis_id, input.repository_id, true);
    }

    const { analysis, repository } = repoContext;

    // Check for existing document of same type — avoid duplicates unless force_overwrite
    const existing = (await engineeringRepository.documents(projectId)).find(
      (d) => d.type === input.type
    );
    if (existing && !input.force_overwrite) {
      return response.json({ success: true, message: "Existing documentation returned — use force_overwrite to replace", data: existing });
    }

    const started = Date.now();
    const run = await aiRunService.start(projectId, uid, "documentation_generation", {
      type: input.type,
      versionId: architecture?.version?.id || null,
      analysisId: analysis?.id || null,
      sourceMode: mode,
    });

    try {
      const result = documentationGeneratorService.generateFull({
        title: input.title,
        format: input.format as any,
        type: input.type,
        sourceMode: mode,
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
        source_version_id: architecture ? result.sourceVersionId || null : null,
        source_repository_analysis_id: analysis ? result.sourceAnalysisId || null : null,
        source_commit_sha: analysis ? result.sourceCommitSha || null : null,
        source_branch: analysis ? (result.sourceBranch || input.snapshot_branch || null) : null,
        generated_by: uid,
        manually_edited: false,
        status: "up_to_date",
        generation_metadata: {
          sourceMode: mode,
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

    const docAny = document as any;
    let architecture: Awaited<ReturnType<typeof resolveArchitectureContext>> = undefined;
    if (docAny.source_version_id) {
      architecture = await resolveArchitectureContext(projectId, docAny.source_version_id, false);
    }

    let repoContext = { analysis: undefined as any, repository: undefined as any };
    if (docAny.source_repository_analysis_id) {
      repoContext = await resolveRepoContext(projectId, docAny.source_repository_analysis_id, undefined, false);
    }

    const { analysis, repository } = repoContext;

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
      source_commit_sha: analysis ? (result.sourceCommitSha || null) : null,
      generation_metadata: {
        sourceMode: docAny.generation_metadata?.sourceMode || (architecture && analysis ? "combined" : architecture ? "architecture" : "repository"),
        hasArchitectureSource: result.hasArchitectureSource,
        hasRepositorySource: result.hasRepositorySource,
        generatedAt: result.generatedAt,
      },
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
    const findings = await designReviewService.reviewWithAI(architecture);
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

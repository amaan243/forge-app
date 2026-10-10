import { ConflictError, NotFoundError } from "../errors/app-error.js";
import { GitHubRepositoryProvider } from "../integrations/github-repository-provider.js";
import type { RepositoryProvider } from "../integrations/repository-provider.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import { dependencyAnalyzerService } from "./dependency-analyzer-service.js";
import { RepositoryAnalyzerService } from "./repository-analyzer-service.js";
import type { RepositoryRecord, RepositoryAnalysis } from "../types/repository-intelligence.js";
import { logger } from "../lib/logger.js";

export class RepositoryIntelligenceService {
  constructor(
    private readonly providers: Record<string, RepositoryProvider> = { github: new GitHubRepositoryProvider() },
    private readonly analyzer = new RepositoryAnalyzerService()
  ) {}

  async connect(
    projectId: string,
    userId: string,
    input: { url: string; branch?: string; provider?: string; accessType?: "public" | "private"; tokenReference?: string }
  ): Promise<RepositoryRecord> {
    const providerName = input.provider || "github";
    const provider = this.providers[providerName];
    if (!provider) throw new NotFoundError(`Repository provider '${providerName}' is not supported`);

    // Verify repository exists on GitHub
    const external = await provider.connect({
      url: input.url,
      branch: input.branch,
      accessType: input.accessType,
      tokenReference: input.tokenReference,
    });

    // Check if this repository is already actively connected to this project
    const existingActive = await repositoryIntelligenceRepository.findActiveByUrl(projectId, external.repository_url);
    if (existingActive) {
      throw new ConflictError(`Repository '${external.repository_name}' is already connected to this project.`);
    }

    // If this repository was previously disconnected, reactivate it rather than creating a duplicate
    const previouslyDisconnected = await repositoryIntelligenceRepository.findByUrl(projectId, external.repository_url);
    if (previouslyDisconnected) {
      return repositoryIntelligenceRepository.updateRepository(previouslyDisconnected.id, {
        status: "active",
        default_branch: input.branch || external.default_branch || previouslyDisconnected.default_branch || "main",
        access_type: input.accessType || external.access_type || "public",
        external_repository_id: external.external_repository_id,
        connected_by: userId,
        credential_reference: input.tokenReference || previouslyDisconnected.credential_reference,
        updated_at: new Date().toISOString(),
      });
    }

    const { id: _id, project_id: _projectId, connected_by: _connectedBy, created_at: _createdAt, updated_at: _updatedAt, ...repository } = external;
    void _id;
    void _projectId;
    void _connectedBy;
    void _createdAt;
    void _updatedAt;

    return repositoryIntelligenceRepository.connect({
      ...repository,
      project_id: projectId,
      connected_by: userId,
      default_branch: input.branch || external.default_branch || "main",
      access_type: input.accessType || external.access_type || "public",
      status: "active",
    });
  }

  async get(projectId: string, repositoryId?: string): Promise<{
    repository: RepositoryRecord | null;
    repositories: RepositoryRecord[];
    latestAnalysis: RepositoryAnalysis | null;
    latestAttempt: RepositoryAnalysis | null;
    latestSuccessful: RepositoryAnalysis | null;
    activeAnalysis: RepositoryAnalysis | null;
  }> {
    const repositories = await repositoryIntelligenceRepository.repositories(projectId);
    const repository = repositoryId
      ? await repositoryIntelligenceRepository.repository(projectId, repositoryId)
      : (repositories[0] || await repositoryIntelligenceRepository.repository(projectId));

    if (!repository) {
      return { repository: null, repositories, latestAnalysis: null, latestAttempt: null, latestSuccessful: null, activeAnalysis: null };
    }
    const latestAttempt = await repositoryIntelligenceRepository.latestAttempt(projectId, repository.id);
    const latestSuccessful = await repositoryIntelligenceRepository.latestSuccessful(projectId, repository.id);
    const latestAnalysis = latestSuccessful || latestAttempt;
    const activeAnalysis = await repositoryIntelligenceRepository.activeAnalysis(projectId, repository.id);
    return { repository, repositories, latestAnalysis, latestAttempt, latestSuccessful, activeAnalysis };
  }

  async list(projectId: string): Promise<Array<{
    repository: RepositoryRecord;
    latestAnalysis: RepositoryAnalysis | null;
    latestAttempt: RepositoryAnalysis | null;
    latestSuccessful: RepositoryAnalysis | null;
    activeAnalysis: RepositoryAnalysis | null;
  }>> {
    const repositories = await repositoryIntelligenceRepository.repositories(projectId);
    return Promise.all(
      repositories.map(async (repo) => {
        const latestAttempt = await repositoryIntelligenceRepository.latestAttempt(projectId, repo.id);
        const latestSuccessful = await repositoryIntelligenceRepository.latestSuccessful(projectId, repo.id);
        const latestAnalysis = latestSuccessful || latestAttempt;
        const activeAnalysis = await repositoryIntelligenceRepository.activeAnalysis(projectId, repo.id);
        return {
          repository: repo,
          latestAnalysis,
          latestAttempt,
          latestSuccessful,
          activeAnalysis,
        };
      })
    );
  }

  async disconnect(projectId: string, repositoryId?: string): Promise<void> {
    return repositoryIntelligenceRepository.disconnect(projectId, repositoryId);
  }

  async analyses(projectId: string, repositoryId?: string): Promise<RepositoryAnalysis[]> {
    return repositoryIntelligenceRepository.analyses(projectId, repositoryId);
  }

  async latestAnalysis(projectId: string, repositoryId?: string): Promise<RepositoryAnalysis | null> {
    return repositoryIntelligenceRepository.latestAnalysis(projectId, repositoryId);
  }

  async analysis(analysisId: string): Promise<RepositoryAnalysis | null> {
    return repositoryIntelligenceRepository.analysis(analysisId);
  }

  async enqueueAnalysis(projectId: string, userId: string, branch?: string, repositoryId?: string): Promise<RepositoryAnalysis> {
    const repository = await repositoryIntelligenceRepository.repository(projectId, repositoryId);
    if (!repository) throw new NotFoundError("No repository connected for this project");

    void userId;

    // Check if an analysis is already queued or running to prevent duplicate concurrent work for this repository
    const active = await repositoryIntelligenceRepository.activeAnalysis(projectId, repository.id);
    if (active) {
      return active;
    }

    if (branch && branch !== repository.default_branch) {
      // Update branch if specified
      await repositoryIntelligenceRepository.updateRepository(repository.id, {
        default_branch: branch,
      }).catch(() => undefined);
    }

    return repositoryIntelligenceRepository.createAnalysis({
      repository_id: repository.id,
      project_id: projectId,
      status: "queued",
      frameworks: [],
      languages: {},
      dependencies: [],
      infrastructure: {},
      architecture: {},
      metrics: {},
      analysis_data: { branch: branch || repository.default_branch },
    });
  }

  async analyze(projectId: string, userId: string, existingAnalysisId?: string, repositoryId?: string): Promise<RepositoryAnalysis> {
    void userId;
    let analysis = existingAnalysisId
      ? await repositoryIntelligenceRepository.analysis(existingAnalysisId)
      : null;

    const targetRepoId = analysis?.repository_id || repositoryId;
    const repository = await repositoryIntelligenceRepository.repository(projectId, targetRepoId);
    if (!repository) throw new NotFoundError("Repository is not connected");

    const provider = this.providers[repository.provider];
    if (!provider) throw new NotFoundError(`Repository provider '${repository.provider}' is not supported`);

    if (!analysis) {
      analysis = await repositoryIntelligenceRepository.createAnalysis({
        repository_id: repository.id,
        project_id: projectId,
        status: "queued",
        frameworks: [],
        languages: {},
        dependencies: [],
        infrastructure: {},
        architecture: {},
        metrics: {},
        analysis_data: {},
      });
    }

    if (!analysis) throw new NotFoundError("Repository analysis record not found");

    try {
      await repositoryIntelligenceRepository.updateAnalysis(analysis.id, {
        status: "running",
        started_at: new Date().toISOString(),
      });

      const targetBranch = (analysis.analysis_data?.branch as string) || repository.default_branch;
      const repoToFetch = { ...repository, default_branch: targetBranch };

      const snapshot = await provider.fetchSnapshot(repoToFetch);
      const result = this.analyzer.analyze(snapshot);

      const rawDependencies = result.dependencies.map((dependency) => ({
        ...dependency,
        risk_level: dependencyAnalyzerService.riskFor(dependency.name, dependency.version),
        metadata: dependency.metadata ?? {},
      }));

      // Deduplicate dependencies by (ecosystem, lowercase name) to respect table unique(project_id, name, ecosystem)
      const deduplicated = new Map<string, typeof rawDependencies[0]>();
      for (const dep of rawDependencies) {
        const key = `${dep.ecosystem}:${dep.name.toLowerCase()}`;
        if (!deduplicated.has(key)) {
          deduplicated.set(key, dep);
        } else {
          const existing = deduplicated.get(key)!;
          if (existing.type !== "runtime" && dep.type === "runtime") {
            deduplicated.set(key, dep);
          }
        }
      }

      const validTypes = new Set(["runtime", "development", "peer", "infrastructure"]);
      const validRisks = new Set(["low", "medium", "high", "critical"]);

      const normalizedDependencies = Array.from(deduplicated.values()).map((dep) => ({
        ...dep,
        type: validTypes.has(dep.type) ? dep.type : "runtime",
        risk_level: validRisks.has(dep.risk_level) ? dep.risk_level : "low",
      }));

      const completed = await repositoryIntelligenceRepository.updateAnalysis(analysis.id, {
        status: "completed",
        commit_sha: String(result.analysisData.commitSha || snapshot.commitSha || ""),
        frameworks: result.frameworks,
        languages: result.languages,
        dependencies: normalizedDependencies,
        infrastructure: result.infrastructure,
        architecture: result.architecture,
        metrics: result.metrics,
        analysis_data: result.analysisData,
        completed_at: new Date().toISOString(),
      });

      await repositoryIntelligenceRepository.replaceDependencies(projectId, analysis.id, normalizedDependencies);
      return completed;
    } catch (error) {
      let errorMessage = "Repository analysis failed";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "object" && error !== null && "message" in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      logger.error("Repository analysis failed:", error);
      await repositoryIntelligenceRepository.updateAnalysis(analysis.id, {
        status: "failed",
        analysis_data: {
          error: errorMessage,
        },
        completed_at: new Date().toISOString(),
      });
      throw error;
    }
  }

  async dependencies(projectId: string, filters: { type?: string; risk?: string; ecosystem?: string; repositoryId?: string }) {
    return repositoryIntelligenceRepository.dependencies(projectId, filters);
  }
}

export const repositoryIntelligenceService = new RepositoryIntelligenceService();
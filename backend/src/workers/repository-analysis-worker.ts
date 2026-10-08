import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { repositoryIntelligenceService } from "../services/repository-intelligence-service.js";

export function createRepositoryAnalysisWorker(): Worker<{ projectId: string; userId: string; analysisId: string }> {
  return new Worker("repository-analysis", async (job) => repositoryIntelligenceService.analyze(job.data.projectId, job.data.userId, job.data.analysisId), { connection: { url: env.REDIS_URL } });
}
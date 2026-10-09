import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

let redisAvailableCache: boolean | null = null;
let lastRedisCheckTime = 0;

export async function isRedisAvailable(): Promise<boolean> {
  const now = Date.now();
  if (redisAvailableCache !== null && now - lastRedisCheckTime < 15000) {
    return redisAvailableCache;
  }

  try {
    const client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 500,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
    });
    client.on("error", () => undefined);
    await client.connect();
    await client.ping();
    await client.quit();
    redisAvailableCache = true;
  } catch {
    redisAvailableCache = false;
  }

  lastRedisCheckTime = now;
  return redisAvailableCache;
}

const queueOptions = {
  connection: {
    url: env.REDIS_URL,
    enableOfflineQueue: false,
    connectTimeout: 1000,
    maxRetriesPerRequest: 0,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 100,
  },
};

export const repositoryAnalysisQueue = new Queue("repository-analysis", queueOptions);
export const dependencyAnalysisQueue = new Queue("dependency-analysis", queueOptions);
export const driftAnalysisQueue = new Queue("drift-analysis", queueOptions);
export const aiGenerationQueue = new Queue("ai-generation", queueOptions);
export const documentationGenerationQueue = new Queue("documentation-generation", queueOptions);
export const designReviewQueue = new Queue("design-review", queueOptions);
export const storyGenerationQueue = new Queue("story-generation", queueOptions);
export const exportGenerationQueue = new Queue("export-generation", queueOptions);
import { z } from "zod";

// Strict GitHub repository URL validation: https://github.com/:owner/:repo (allowing optional .git suffix, disallowing directory traversal, private IPs, or arbitrary schemes)
const githubRepoUrlRegex = /^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?:\.git)?\/?$/;

export const repositoryConnect = z.object({
  repository_url: z
    .string()
    .url("Must be a valid URL")
    .regex(githubRepoUrlRegex, "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"),
  branch: z.string().trim().min(1).max(255).default("main"),
  provider: z.enum(["github", "gitlab", "bitbucket"]).default("github"),
  access_type: z.enum(["public", "private"]).default("public"),
  credential_reference: z.string().trim().min(1).max(255).optional(),
});

export const repositoryAnalyzeTrigger = z.object({
  branch: z.string().trim().min(1).max(255).optional(),
});

export const dependencyQuery = z.object({
  type: z.enum(["runtime", "development", "peer", "infrastructure"]).optional(),
  risk: z.enum(["low", "medium", "high", "critical"]).optional(),
  ecosystem: z.string().max(40).optional(),
});

export const driftAnalyzeInput = z.object({
  architecture_version_id: z.string().uuid("Invalid architecture version ID").optional(),
  repository_analysis_id: z.string().uuid("Invalid repository analysis snapshot ID").optional(),
});

export const driftFilterQuery = z.object({
  type: z.enum(["missing", "extra", "mismatch", "uncertain", "coverage_limitation", "limitation", "integration_mismatch"]).optional(),
  category: z.string().max(50).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});
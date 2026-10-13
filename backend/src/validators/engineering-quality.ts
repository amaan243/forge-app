import { z } from "zod";

export const evaluateQualitySchema = z.object({
  architectureVersionId: z.string().uuid("Invalid architecture version ID").optional().nullable(),
  repositoryId: z.string().uuid("Invalid repository ID").optional().nullable(),
  repositoryAnalysisId: z.string().uuid("Invalid repository analysis snapshot ID").optional().nullable(),
  policyId: z.string().min(1).max(100).optional(),
  baselineArchitectureVersionId: z.string().uuid("Invalid baseline architecture version ID").optional().nullable(),
  baselineRepositoryAnalysisId: z.string().uuid("Invalid baseline repository analysis snapshot ID").optional().nullable(),
  baselineQualityReportId: z.string().uuid("Invalid baseline quality report ID").optional().nullable(),
});

export const updatePolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  mandatoryCheckIds: z.array(z.string().min(1)),
  severityThresholds: z.object({
    maxCritical: z.number().int().min(0),
    maxHigh: z.number().int().min(0),
  }),
});

export const recordEvidenceSchema = z.object({
  repositoryId: z.string().uuid("Invalid repository ID").optional().nullable(),
  commitSha: z.string().min(1).max(100),
  branch: z.string().max(200).optional().nullable(),
  buildStatus: z.enum(["passed", "failed", "not_evaluated"]),
  buildCommand: z.string().max(500).optional().nullable(),
  buildDurationMs: z.number().int().min(0).optional().nullable(),
  buildOutput: z.string().max(20000).optional().nullable(),
  testStatus: z.enum(["passed", "failed", "not_evaluated"]),
  testFramework: z.string().max(100).optional().nullable(),
  testsTotal: z.number().int().min(0).default(0),
  testsPassed: z.number().int().min(0).default(0),
  testsFailed: z.number().int().min(0).default(0),
  testsSkipped: z.number().int().min(0).default(0),
  testDurationMs: z.number().int().min(0).optional().nullable(),
  coveragePercent: z.number().min(0).max(100).optional().nullable(),
  errorSummary: z.string().max(2000).optional().nullable(),
  securityScanStatus: z.enum(["passed", "failed", "warning", "not_evaluated"]).optional().nullable(),
  securityScannerName: z.string().max(100).optional().nullable(),
  securityAdvisoriesCount: z.number().int().min(0).default(0),
  executedBy: z.string().max(100).default("manual"),
  metadata: z.record(z.unknown()).optional().default({}),
});

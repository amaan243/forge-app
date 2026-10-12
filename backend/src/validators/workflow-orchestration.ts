import { z } from "zod";

export const runWorkflowSchema = z.object({
  architectureVersionId: z.string().uuid("Invalid architecture version ID").optional(),
  repositoryId: z.string().uuid("Invalid repository ID").optional(),
  repositoryAnalysisId: z.string().uuid("Invalid repository analysis snapshot ID").optional(),
  branch: z.string().min(1).max(200).optional(),
  forceRerun: z.boolean().optional(),
});

export const retryStageSchema = z.object({
  stage: z.enum([
    "stage_a_architecture",
    "stage_b_repository",
    "stage_c_drift",
    "stage_d_impact",
    "stage_e_playground",
    "stage_f_documentation",
    "stage_g_verification",
  ], {
    errorMap: () => ({ message: "Invalid workflow stage identifier" }),
  }),
});

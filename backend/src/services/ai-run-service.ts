import { engineeringRepository } from "../repositories/engineering-intelligence-repository.js";
export class AIRunService {
  async start(projectId: string, userId: string, operation: string, inputMetadata: Record<string, unknown>) { return engineeringRepository.createAIRun({ project_id: projectId, user_id: userId, operation, provider: "configured", status: "running", input_metadata: inputMetadata, output_metadata: {}, token_usage: {} }); }
  async complete(id: string, outputMetadata: Record<string, unknown>, startedAt: number) { return engineeringRepository.updateAIRun(id, { status: "completed", output_metadata: outputMetadata, latency_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); }
  async fail(id: string, error: unknown, startedAt: number) { return engineeringRepository.updateAIRun(id, { status: "failed", error: error instanceof Error ? error.message : "AI operation failed", latency_ms: Date.now() - startedAt, completed_at: new Date().toISOString() }); }
}
export const aiRunService = new AIRunService();
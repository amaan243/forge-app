import type { AIProvider } from "../integrations/ai-provider.js";
export interface ArchitectureExplanation { purpose: string; responsibility: string; technology: string; dependencies: string[]; dataFlow: string; failureScenarios: string[]; scalingConsiderations: string[]; securityConsiderations: string[] }
export class ArchitectureExplanationService {
  constructor(private readonly provider: AIProvider) {}
  async explain(input: { node: unknown; architecture: unknown; context?: string }): Promise<ArchitectureExplanation> {
    return this.provider.structuredOutput<ArchitectureExplanation>({ prompt: JSON.stringify(input), schema: "ArchitectureExplanation" });
  }
}
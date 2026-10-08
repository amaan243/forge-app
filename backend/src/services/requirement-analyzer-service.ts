import type { AIProvider } from "../integrations/ai-provider.js";
export class RequirementAnalyzerService {
  constructor(private readonly provider: AIProvider) {}
  analyze(requirements: string): Promise<unknown> { return this.provider.analyze({ requirements }); }
}
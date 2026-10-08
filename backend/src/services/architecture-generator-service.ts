import { generatedArchitectureSchema } from "../validators/architecture.js";
import type { AIProvider } from "../integrations/ai-provider.js";
import type { GeneratedArchitecture } from "../types/architecture.js";
import { RequirementAnalyzerService } from "./requirement-analyzer-service.js";
export class ArchitectureGeneratorService {
  constructor(private readonly provider: AIProvider, private readonly analyzer = new RequirementAnalyzerService(provider)) {}
  async generate(requirements: string): Promise<GeneratedArchitecture> {
    const analyzed = await this.analyzer.analyze(requirements);
    const output = await this.provider.structuredOutput<unknown>({ prompt: JSON.stringify({ requirements: analyzed }), schema: generatedArchitectureSchema });
    return generatedArchitectureSchema.parse(output) as GeneratedArchitecture;
  }
}
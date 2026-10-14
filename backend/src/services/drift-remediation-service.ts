import type { AIProvider } from "../integrations/ai-provider.js";
import type { DriftAnalysis, DriftItem } from "../types/repository-intelligence.js";

export interface DriftRemediation {
  problem: string;
  root_cause: string;
  recommended_changes: string[];
  affected_components: string[];
  risk: string;
  implementation_steps: string[];
}

export class DriftRemediationService {
  constructor(private readonly provider: AIProvider) {}

  async remediation(input: unknown): Promise<DriftRemediation> {
    try {
      if (typeof (this.provider as any).remediateDrift === "function") {
        return await (this.provider as any).remediateDrift(input);
      }
      return await this.provider.structuredOutput<DriftRemediation>({
        prompt: JSON.stringify(input),
        schema: "DriftRemediation",
      });
    } catch {
      // Deterministic fallback when AI provider is "none" or unavailable
      const drift = input as DriftAnalysis & { drift_items?: DriftItem[]; items?: DriftItem[] };
      const items = drift.drift_items || drift.items || [];

      const affectedComponents = Array.from(
        new Set(items.map((i) => i.metadata?.affectedComponent || i.description).filter(Boolean))
      );

      const severities = items.map((i) => i.severity);
      const maxRisk = severities.includes("critical")
        ? "critical"
        : severities.includes("high")
        ? "high"
        : severities.includes("medium")
        ? "medium"
        : "low";

      const recommendedChanges = items.map((i) => i.recommendation).filter(Boolean);
      const implementationSteps = items.map(
        (i, idx) => `Step ${idx + 1}: ${i.recommendation} (${i.description})`
      );

      return {
        problem:
          items.length > 0
            ? `${items.length} architectural difference(s) detected between intended architecture and repository implementation.`
            : "No architectural drift detected.",
        root_cause:
          items.length > 0
            ? "Discrepancy between saved architecture specification and analyzed repository manifests, services, or frameworks."
            : "Repository matches architecture version within static analysis coverage.",
        recommended_changes: recommendedChanges.length > 0 ? recommendedChanges : ["No action required."],
        affected_components: affectedComponents.length > 0 ? affectedComponents : ["None"],
        risk: maxRisk,
        implementation_steps:
          implementationSteps.length > 0 ? implementationSteps : ["Maintain current architecture specification."],
      };
    }
  }
}
import type { AIProvider } from "../integrations/ai-provider.js";
export interface ArchitectureExplanation { purpose: string; responsibility: string; technology: string; dependencies: string[]; dataFlow: string; failureScenarios: string[]; scalingConsiderations: string[]; securityConsiderations: string[] }
export class ArchitectureExplanationService {
  constructor(private readonly provider: AIProvider) {}
  async explain(input: { node: unknown; architecture: unknown; context?: string }): Promise<ArchitectureExplanation> {
    try {
      if (typeof (this.provider as any).explainComponent === "function") {
        return await (this.provider as any).explainComponent(input);
      }
      return await this.provider.structuredOutput<ArchitectureExplanation>({ prompt: JSON.stringify(input), schema: "ArchitectureExplanation" });
    } catch {
      const n = (input.node || {}) as { id?: string; name?: string; type?: string; technology?: string; description?: string };
      const arch = (input.architecture || {}) as { nodes?: Array<{ id: string; name: string }>; edges?: Array<{ source_node_id: string; target_node_id: string }> };
      const nodeNameMap = new Map((arch.nodes || []).map((node) => [node.id, node.name]));
      const outgoing = (arch.edges || []).filter((e) => e.source_node_id === n.id).map((e) => nodeNameMap.get(e.target_node_id) || e.target_node_id);
      const incoming = (arch.edges || []).filter((e) => e.target_node_id === n.id).map((e) => nodeNameMap.get(e.source_node_id) || e.source_node_id);
      const uniqueDeps = Array.from(new Set([...outgoing, ...incoming]));
      return {
        purpose: n.description || `Primary ${n.type || "system"} component responsible for ${n.name || "core domain"} operations.`,
        responsibility: `Implements ${n.type || "service"} lifecycle, request handling, and business rules for ${n.name || "the subsystem"}.`,
        technology: n.technology || "Standard cloud platform runtime",
        dependencies: uniqueDeps.length > 0 ? uniqueDeps : ["Standalone boundary"],
        dataFlow: `${incoming.length} upstream caller${incoming.length === 1 ? "" : "s"} (${incoming.slice(0, 3).join(", ") || "ingress"}), ${outgoing.length} downstream service${outgoing.length === 1 ? "" : "s"} (${outgoing.slice(0, 3).join(", ") || "terminal"}).`,
        failureScenarios: [
          `Transient communication latency or timeout on downstream dependencies (${outgoing.slice(0, 2).join(", ") || "external storage"}).`,
          `Connection pool exhaustion under peak load conditions.`,
        ],
        scalingConsiderations: [
          `Stateless horizontal replication with load-balanced ingress.`,
          `Read caching or message-queue decoupling for write-heavy bursts.`,
        ],
        securityConsiderations: [
          `Enforce TLS in-transit and least-privilege IAM service permissions.`,
          `Validate and sanitize all ingress parameters and authorization tokens.`,
        ],
      };
    }
  }
}
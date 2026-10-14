import type { DesignReviewFinding } from "../types/engineering-intelligence.js";
import { getAIProvider, isAIConfigured } from "../integrations/ai-provider.js";
import { logger } from "../lib/logger.js";

export class DesignReviewService {
  /**
   * Deterministic structural design review (Synchronous for contract compatibility)
   */
  review(architecture: {
    nodes: Array<{ id: string; name: string; type: string; technology?: string | null }>;
    edges: Array<{ source_node_id: string; target_node_id: string; relationship?: string | null; protocol?: string | null }>;
  }): DesignReviewFinding[] {
    const findings: DesignReviewFinding[] = [];
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    for (const edge of architecture.edges) {
      incoming.set(edge.target_node_id, (incoming.get(edge.target_node_id) ?? 0) + 1);
      outgoing.set(edge.source_node_id, (outgoing.get(edge.source_node_id) ?? 0) + 1);
    }

    for (const node of architecture.nodes) {
      if (architecture.nodes.length > 2 && !incoming.has(node.id) && !outgoing.has(node.id)) {
        findings.push({
          finding: `Unconnected component: ${node.name}`,
          severity: "medium",
          evidence: [node.id],
          explanation: "The component has no modeled communication edges in the architecture graph.",
          recommendation: "Confirm whether this component is intentionally isolated and document its boundary.",
          component_ids: [node.id],
        });
      }
      if ((incoming.get(node.id) ?? 0) > 5) {
        findings.push({
          finding: `Potential coupling hotspot: ${node.name}`,
          severity: "high",
          evidence: [`${incoming.get(node.id)} incoming edges`],
          explanation: "Many components depend directly on this component, forming a potential coupling bottleneck.",
          recommendation: "Review the boundary and consider introducing an asynchronous queue or stable API facade.",
          component_ids: [node.id],
        });
      }
    }

    if (!architecture.nodes.some((node) => node.type === "database")) {
      findings.push({
        finding: "No database is modeled",
        severity: "low",
        evidence: [],
        explanation: "The architecture contains no database or persistent storage node.",
        recommendation: "Confirm persistence is intentionally external or add the data store to the architecture model.",
        component_ids: [],
      });
    }

    return findings;
  }

  /**
   * Enhanced Design Review with Groq AI integration, merged with baseline deterministic checks
   */
  async reviewWithAI(architecture: {
    nodes: Array<{ id: string; name: string; type: string; technology?: string | null }>;
    edges: Array<{ source_node_id: string; target_node_id: string; relationship?: string | null; protocol?: string | null }>;
  }): Promise<DesignReviewFinding[]> {
    const findings = this.review(architecture);

    if (isAIConfigured() && architecture.nodes.length > 0) {
      try {
        const provider = getAIProvider();
        if (typeof (provider as any).reviewDesign === "function") {
          const aiFindings: DesignReviewFinding[] = await (provider as any).reviewDesign({ architecture });
          if (Array.isArray(aiFindings)) {
            const existingTitles = new Set(findings.map((f) => f.finding.toLowerCase()));
            for (const af of aiFindings) {
              if (af.finding && !existingTitles.has(af.finding.toLowerCase())) {
                findings.push(af);
                existingTitles.add(af.finding.toLowerCase());
              }
            }
          }
        }
      } catch (err: any) {
        logger.warn("Groq AI design review failed, falling back to deterministic review findings:", {
          message: err?.message,
        });
      }
    }

    return findings;
  }
}

export const designReviewService = new DesignReviewService();
import { architectureService } from "./architecture-service.js";
import { projectRepository } from "../repositories/project-repository.js";
import { getAIProvider, isAIConfigured } from "../integrations/ai-provider.js";
import { logger } from "../lib/logger.js";

export const projectStoryService = {
  async generate(projectId: string): Promise<Record<string, unknown>> {
    const [architecture, project, requirements] = await Promise.all([
      architectureService.getCurrent(projectId),
      projectRepository.findById(projectId),
      projectRepository.requirements(projectId).catch(() => []),
    ]);

    const projectName = project?.name || "Software Architecture System";
    const reqList = requirements || [];
    const nodes = architecture.nodes || [];
    const edges = architecture.edges || [];
    const versionName = architecture.version?.name ?? "Baseline Architecture";

    // Attempt Groq AI generation when configured
    if (isAIConfigured() && (nodes.length > 0 || reqList.length > 0)) {
      try {
        const provider = getAIProvider();
        if (typeof (provider as any).generateStory === "function") {
          const aiStory = await (provider as any).generateStory({
            projectName,
            requirements: reqList,
            architecture: {
              nodes,
              edges,
              version: architecture.version,
            },
          });

          if (aiStory && typeof aiStory === "object" && Object.keys(aiStory).length > 0) {
            return aiStory;
          }
        }
      } catch (err: any) {
        logger.warn("Groq AI story generation failed, falling back to deterministic synthesis:", {
          message: err?.message,
        });
      }
    }

    // Deterministic fallback based on actual requirements & topology
    const techChoices = Array.from(new Set(nodes.map((n) => n.technology).filter(Boolean)));
    const coreRequirements = reqList.map((r: any) => r.title || r.id).slice(0, 8);

    return {
      problem: reqList.length > 0
        ? `Architected to satisfy ${reqList.length} defined system requirement(s) for ${projectName}, delivering scalable cloud infrastructure and modular service boundaries.`
        : `Primary architecture blueprint for ${projectName}, establishing modular service boundaries, reliable data communication, and high-availability operations.`,
      currentState: versionName,
      requirements: coreRequirements.length > 0
        ? coreRequirements
        : ["High-availability multi-tier service model", "Secure authenticated API communication"],
      architecture: nodes.map((node) => `${node.name} (${node.type})`),
      importantDecisions: [
        {
          decision: "Decoupled Service Architecture",
          rationale: `Separated ${nodes.length} functional domain(s) to isolate failure boundaries and streamline developer velocity.`,
          tradeOff: "Increased operational topology and cross-service network coordination.",
        },
        {
          decision: "Dedicated Persistence Layer",
          rationale: "Ensured ACID compliance and durability for transactional system state.",
          tradeOff: "Requires dedicated replication, connection pooling, and backup procedures.",
        },
      ],
      technologyChoices: techChoices.map((tech) => ({
        name: String(tech),
        category: "Workstation Stack",
        reason: "Selected for production stability, robust community support, and rapid developer ramp-up.",
      })),
      dataFlow: edges.map((e) => {
        const src = nodes.find((n) => n.id === e.source_node_id)?.name || e.source_node_id;
        const tgt = nodes.find((n) => n.id === e.target_node_id)?.name || e.target_node_id;
        return `${src} ${e.relationship || "calls"} ${tgt}${e.protocol ? ` via ${e.protocol}` : ""}`;
      }),
      security: [
        "Enforce TLS in-transit and token-based authentication on all ingress routes",
        "Principle of least privilege across internal service-to-service communication",
        "Environment secret isolation with zero hardcoded credentials",
      ],
      scalability: [
        "Stateless service nodes support horizontal container replication",
        "Load-balanced traffic distribution to prevent single node saturation",
        "Connection pooling and bounded queue limits for downstream protection",
      ],
      tradeOffs: [
        "Optimized for maintainability and clear boundaries over minimal infrastructure footprint",
        "Asynchronous decoupling introduces eventual consistency considerations",
      ],
      evolution: [
        "Phase 1: Validate baseline service interactions and latency budgets",
        "Phase 2: Introduce distributed caching for read-heavy query paths",
        "Phase 3: Automated drift detection and CI architecture gate verification",
      ],
    };
  },
};
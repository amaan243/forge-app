import type { ImpactAnalysis, BrokenConnection, SimulationChange } from "../types/engineering-intelligence.js";
import type { ArchitectureNode, ArchitectureEdge } from "../types/architecture.js";
import type { RepositoryAnalysis } from "../types/repository-intelligence.js";

export class ChangeImpactService {
  analyze(
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    changes: Array<SimulationChange | { target?: string; type: string; technology?: string }>,
    _proposedNodes?: ArchitectureNode[],
    _proposedEdges?: ArchitectureEdge[],
    brokenConnections?: BrokenConnection[],
    repositoryAnalysis?: RepositoryAnalysis | null
  ): ImpactAnalysis {
    const targets = new Set<string>();
    for (const change of changes) {
      if (change.target) targets.add(change.target);
      if ("name" in change && change.name) targets.add(change.name);
      if ("source" in change && change.source) targets.add(change.source);
      if ("target_component" in change && change.target_component) targets.add(change.target_component);
    }

    // Direct components in baseline
    const direct = nodes.filter(
      (node) => targets.has(node.id) || targets.has(node.node_key) || targets.has(node.name)
    );
    const directIds = new Set(direct.map((node) => node.id));

    // Also include any newly introduced nodes in direct targets
    const directlyChangedNames = new Set(direct.map((node) => node.name));
    for (const change of changes) {
      if ("name" in change && change.name) {
        directlyChangedNames.add(change.name);
      }
    }

    // 1-hop and 2-hop connected components in baseline
    const affectedEdges = edges.filter(
      (edge) => directIds.has(edge.source_node_id) || directIds.has(edge.target_node_id)
    );
    const indirect = nodes.filter(
      (node) =>
        affectedEdges.some(
          (edge) => edge.source_node_id === node.id || edge.target_node_id === node.id
        ) && !directIds.has(node.id)
    );

    const affected = [...direct, ...indirect];
    const affectedComponentNames = Array.from(
      new Set([...affected.map((n) => n.name), ...Array.from(directlyChangedNames)])
    );

    // Affected APIs: edges with calls or authenticates or connects_to
    const affectedApis = Array.from(
      new Set(
        affectedEdges
          .filter(
            (edge) =>
              edge.relationship === "calls" ||
              edge.relationship === "authenticates" ||
              edge.relationship === "connects_to"
          )
          .map((edge) => edge.id)
      )
    );

    // Affected data stores and infrastructure
    const affectedDataStores = Array.from(
      new Set(
        affected
          .filter((node) => ["database", "storage", "cache"].includes(node.type))
          .map((node) => node.name)
      )
    );

    const affectedInfrastructure = Array.from(
      new Set(
        affected
          .filter((node) =>
            ["infrastructure", "gateway", "monitoring", "queue"].includes(node.type)
          )
          .map((node) => node.name)
      )
    );

    // Broken connections detection
    const reportedBrokenConnections: BrokenConnection[] = brokenConnections ? [...brokenConnections] : [];
    if (!brokenConnections) {
      const removedChanges = changes.filter(
        (c) => c.type.startsWith("remove_") && c.target
      );
      for (const removed of removedChanges) {
        const removedNode = nodes.find(
          (n) => n.id === removed.target || n.node_key === removed.target || n.name === removed.target
        );
        if (removedNode) {
          const orphanedEdges = edges.filter(
            (e) => e.source_node_id === removedNode.id || e.target_node_id === removedNode.id
          );
          for (const edge of orphanedEdges) {
            const src = nodes.find((n) => n.id === edge.source_node_id)?.name ?? edge.source_node_id;
            const tgt = nodes.find((n) => n.id === edge.target_node_id)?.name ?? edge.target_node_id;
            reportedBrokenConnections.push({
              edgeId: edge.id,
              source: src,
              target: tgt,
              relationship: edge.relationship,
              reason: `Node '${removedNode.name}' was removed, severing connection between '${src}' and '${tgt}'`,
            });
          }
        }
      }
    }

    // Determine documentation sections needing updates
    const docSections = new Set<string>();
    docSections.add("System Design");
    docSections.add("Architecture Overview");

    const hasDataStoreChange = changes.some(
      (c) =>
        c.type.includes("database") ||
        c.type.includes("cache") ||
        (c.target && affectedDataStores.includes(c.target))
    );
    if (hasDataStoreChange) {
      docSections.add("Database Documentation");
    }

    const hasApiOrCommChange = changes.some(
      (c) =>
        c.type.includes("connection") ||
        c.type.includes("communication") ||
        c.type.includes("queue") ||
        c.type.includes("api")
    );
    if (hasApiOrCommChange || affectedApis.length > 0) {
      docSections.add("API Documentation");
    }

    const hasSecurityChange = changes.some(
      (c) =>
        c.type.includes("authentication") ||
        c.type.includes("external") ||
        c.type === "add_external_integration"
    );
    if (hasSecurityChange) {
      docSections.add("Security & Auth Guidelines");
    }

    const hasDeployChange = changes.some(
      (c) =>
        c.type.includes("deployment") ||
        c.type.includes("scaling") ||
        c.type.includes("infrastructure")
    );
    if (hasDeployChange) {
      docSections.add("Deployment & Infrastructure");
    }

    // Repository evidence matching
    let repoEvidence: ImpactAnalysis["repositoryEvidence"] = {
      hasEvidence: false,
      statusNote: "Architecture-only simulation. No repository snapshot linked.",
      matchedModules: [],
      matchedRoutes: [],
    };

    let potentialDrift: ImpactAnalysis["potentialDrift"] = {
      hasDriftRisk: false,
      items: [],
      note: "No repository analysis linked to detect implementation drift.",
    };

    if (repositoryAnalysis && repositoryAnalysis.status === "completed") {
      const arch = (repositoryAnalysis.architecture ?? {}) as {
        services?: string[];
        technologies?: string[];
        routes?: Array<{ method: string; path: string; file?: string }>;
      };
      const routes = Array.isArray(arch.routes) ? arch.routes : [];
      const frameworks = Array.isArray(repositoryAnalysis.frameworks)
        ? repositoryAnalysis.frameworks
        : [];

      const matchedModules: string[] = [];
      const matchedRoutes: string[] = [];

      for (const compName of affectedComponentNames) {
        const lowerComp = compName.toLowerCase();
        // Check route files
        for (const r of routes) {
          if (r.path.toLowerCase().includes(lowerComp) || (r.file && r.file.toLowerCase().includes(lowerComp))) {
            matchedRoutes.push(`${r.method} ${r.path}`);
            if (r.file && !matchedModules.includes(r.file)) {
              matchedModules.push(r.file);
            }
          }
        }
        // Check frameworks
        for (const f of frameworks) {
          const fName = typeof f === "string" ? f : (f as { name?: string })?.name ?? "";
          if (fName.toLowerCase().includes(lowerComp) && !matchedModules.includes(fName)) {
            matchedModules.push(fName);
          }
        }
      }

      repoEvidence = {
        hasEvidence: true,
        commitSha: repositoryAnalysis.commit_sha || undefined,
        matchedModules: matchedModules.slice(0, 10),
        matchedRoutes: matchedRoutes.slice(0, 10),
        statusNote: `Correlated with repository snapshot ${repositoryAnalysis.commit_sha ? `(${repositoryAnalysis.commit_sha.slice(0, 7)})` : ""}. Verified ${matchedModules.length} module(s) and ${matchedRoutes.length} route(s).`,
      };

      // Check for potential drift
      const driftItems: string[] = [];
      for (const change of changes) {
        if ("technology" in change && change.technology) {
          const techLower = change.technology.toLowerCase();
          const repoTechs = (arch.technologies ?? []).map((t) => t.toLowerCase());
          const repoFrameworks = frameworks.map((f) =>
            (typeof f === "string" ? f : (f as { name?: string })?.name ?? "").toLowerCase()
          );
          if (!repoTechs.includes(techLower) && !repoFrameworks.some((rf) => rf.includes(techLower))) {
            driftItems.push(
              `Proposed technology '${change.technology}' is not detected in current repository dependencies`
            );
          }
        }
        if (change.type.startsWith("add_") && "name" in change && change.name) {
          const compLower = change.name.toLowerCase();
          const existingServices = (arch.services ?? []).map((s) => s.toLowerCase());
          if (!existingServices.some((s) => s.includes(compLower))) {
            driftItems.push(`Proposed component '${change.name}' has no corresponding repository code module yet`);
          }
        }
      }

      if (driftItems.length > 0) {
        potentialDrift = {
          hasDriftRisk: true,
          items: driftItems,
          note: "Proposed architectural changes deviate from currently merged codebase. Implementation will be needed to prevent drift.",
        };
      } else {
        potentialDrift = {
          hasDriftRisk: false,
          items: [],
          note: "Proposed changes align with existing codebase patterns and technologies.",
        };
      }
    }

    // Concrete risks
    const risks: string[] = [];
    if (indirect.length > 0) {
      risks.push(
        `Changes propagate upstream/downstream to ${indirect.length} dependent component(s): ${indirect.map((n) => n.name).join(", ")}`
      );
    }
    if (reportedBrokenConnections.length > 0) {
      risks.push(
        `Breaking change: ${reportedBrokenConnections.length} connection(s) severed by component removal`
      );
    }
    if (changes.some((c) => c.type.includes("database"))) {
      risks.push("Data store modification requires migration strategy, backup validation, and schema compatibility audit");
    }
    if (changes.some((c) => c.type === "add_external_integration")) {
      risks.push("External SaaS dependency introduces network latency, availability SLA dependency, and potential egress costs");
    }

    // Concrete recommended actions
    const recommendedActions: string[] = [];
    if (affectedApis.length > 0 || affectedEdges.length > 0) {
      recommendedActions.push("Update API contracts, client SDKs, and integration tests for modified communication paths");
    }
    if (reportedBrokenConnections.length > 0) {
      recommendedActions.push("Reroute or gracefully deprecate caller endpoints connected to severed services");
    }
    if (docSections.size > 0) {
      recommendedActions.push(`Update documentation in: ${Array.from(docSections).join(", ")}`);
    }
    if (repoEvidence.hasEvidence && potentialDrift.hasDriftRisk) {
      recommendedActions.push("Create implementation issue tracking codebase updates before publishing new architecture version");
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push("Run unit and end-to-end regression tests on changed components");
    }

    return {
      affectedComponents: affectedComponentNames,
      directlyChangedComponents: Array.from(directlyChangedNames),
      connectedComponents: indirect.map((n) => n.name),
      affectedApis,
      affectedDataStores,
      affectedInfrastructure,
      brokenConnections: reportedBrokenConnections,
      docSectionsNeedingUpdate: Array.from(docSections),
      repositoryEvidence: repoEvidence,
      potentialDrift,
      risks,
      recommendedActions,
    };
  }
}

export const changeImpactService = new ChangeImpactService();
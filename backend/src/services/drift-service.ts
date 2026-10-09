import { NotFoundError } from "../errors/app-error.js";
import { architectureService } from "./architecture-service.js";
import type { RepositoryAnalysis } from "../types/repository-intelligence.js";

export interface DriftFindingItem {
  type: "missing" | "extra" | "mismatch";
  severity: "low" | "medium" | "high" | "critical";
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  description: string;
  recommendation: string;
  metadata: {
    confidence: "high" | "medium" | "low";
    evidence: string[];
    affectedComponent: string;
    findingType: "missing_component" | "extra_module" | "technology_mismatch" | "integration_mismatch" | "uncertain_match";
    category: string;
  };
}

export interface DriftResult {
  items: DriftFindingItem[];
  score: number;
  summary: string;
}

export class DriftDetectionService {
  async compare(projectId: string, versionId: string, analysis: RepositoryAnalysis): Promise<DriftResult> {
    const intended = await architectureService.getVersion(versionId);
    if (!intended.version || intended.version.project_id !== projectId) {
      throw new NotFoundError("Architecture version not found for this project");
    }

    const actual = (analysis.architecture ?? {}) as {
      technologies?: string[];
      services?: string[];
      databases?: string[];
      apis?: string[];
      routes?: Array<{ method: string; path: string; file: string }>;
      authentication?: boolean;
      externalIntegrations?: string[];
    };

    const actualFrameworks = (analysis.frameworks as string[]) || actual.technologies || [];
    const actualServices = actual.services || [];
    const actualDatabases = actual.databases || [];
    const actualIntegrations = actual.externalIntegrations || [];
    const filesAnalyzed = Number((analysis.analysis_data as Record<string, unknown>)?.filesAnalyzed ?? 0);

    const items: DriftFindingItem[] = [];

    // Helper to normalize component names (e.g. "AuthService" -> "auth", "UserDB" -> "user")
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/(service|api|db|database|server|handler|controller)$/i, "")
        .replace(/[^a-z0-9]/g, "");

    const matchedServiceNames = new Set<string>();

    // 1. Compare Expected Architecture Nodes against Repository Evidence
    for (const node of intended.nodes) {
      const nodeKey = normalize(node.name || "");
      const techKey = node.technology ? normalize(node.technology) : "";

      if (node.type === "database" || node.type === "cache") {
        // Evidence check: check detected databases, frameworks, or dependencies
        const hasDbMatch = actualDatabases.some((db) => {
          const normDb = normalize(db);
          return normDb.includes(nodeKey) || (techKey && normDb.includes(techKey)) || normDb.includes(normalize(node.type));
        });

        const hasTechMatch = actualFrameworks.some((fw) => {
          const normFw = normalize(fw);
          return (techKey && normFw.includes(techKey)) || (nodeKey && normFw.includes(nodeKey));
        });

        if (!hasDbMatch && !hasTechMatch) {
          const severity = node.type === "database" ? "high" : "medium";
          items.push({
            type: "missing",
            severity,
            expected: { name: node.name, type: node.type, technology: node.technology },
            actual: { detectedDatabases: actualDatabases },
            description: `Expected ${node.type} '${node.name}' (${node.technology || "unspecified"}) was not detected in repository dependencies or database configurations.`,
            recommendation: `Add client library or connection configuration for ${node.technology || node.name}, or update the intended architecture specification.`,
            metadata: {
              confidence: filesAnalyzed > 0 ? "high" : "medium",
              evidence: [
                `Checked ${actualDatabases.length} detected database manifests/drivers`,
                `Repository frameworks: ${actualFrameworks.join(", ") || "none"}`,
              ],
              affectedComponent: node.name,
              findingType: "missing_component",
              category: node.type === "cache" ? "Cache" : "Database",
            },
          });
        }
      } else if (node.type === "external_service") {
        // Evidence check for external services (e.g. Stripe, SendGrid, Twilio, AWS)
        const hasIntegrationMatch = actualIntegrations.some((intg) => {
          const normIntg = normalize(intg);
          return normIntg.includes(nodeKey) || (techKey && normIntg.includes(techKey));
        });

        if (!hasIntegrationMatch) {
          items.push({
            type: "missing",
            severity: "medium",
            expected: { name: node.name, type: node.type, technology: node.technology },
            actual: { detectedIntegrations: actualIntegrations },
            description: `Expected external integration '${node.name}' was not detected in repository code or dependencies.`,
            recommendation: `Install integration package for ${node.name} or document external API interaction.`,
            metadata: {
              confidence: "high",
              evidence: [`Detected repository integrations: ${actualIntegrations.join(", ") || "none"}`],
              affectedComponent: node.name,
              findingType: "integration_mismatch",
              category: "External Service",
            },
          });
        }
      } else if (["service", "backend", "worker", "gateway", "api"].includes(node.type)) {
        // Evidence check for services: search detected services, backend files, apis
        const matchedService = actualServices.find((s) => {
          const sName = normalize(s.split("/").pop() || s);
          return sName.includes(nodeKey) || nodeKey.includes(sName);
        });

        if (matchedService) {
          matchedServiceNames.add(matchedService);
        } else {
          // If not found in services, check entry points and apis
          const matchedApi = (actual.apis || []).find((a) => {
            const aName = normalize(a.split("/").pop() || a);
            return aName.includes(nodeKey) || nodeKey.includes(aName);
          });

          if (matchedApi) {
            matchedServiceNames.add(matchedApi);
          } else {
            // Unmatched service
            const confidence = filesAnalyzed >= 10 ? "medium" : "low";
            items.push({
              type: "missing",
              severity: node.type === "gateway" || node.type === "backend" ? "high" : "medium",
              expected: { name: node.name, type: node.type, technology: node.technology },
              actual: { detectedServices: actualServices.slice(0, 5) },
              description: `Expected architecture component '${node.name}' does not have a matching module or service in the repository.`,
              recommendation: `Implement '${node.name}' in 'src/services/${nodeKey}' or reconcile the architecture version.`,
              metadata: {
                confidence,
                evidence: [
                  `Searched ${actualServices.length} detected service files and ${actual.apis?.length ?? 0} API files`,
                  `Total files inspected: ${filesAnalyzed}`,
                ],
                affectedComponent: node.name,
                findingType: "missing_component",
                category: "Service",
              },
            });
          }
        }
      }
    }

    // 2. Extra Modules in Repository Not Represented in Architecture
    for (const servicePath of actualServices) {
      if (!matchedServiceNames.has(servicePath)) {
        const rawFileName = servicePath.split("/").pop()?.replace(/\.[^/.]+$/, "") || servicePath;
        const normService = normalize(rawFileName);

        // Check if any node in architecture matched this
        const existsInArch = intended.nodes.some((n) => {
          const normNode = normalize(n.name || "");
          return normNode.includes(normService) || normService.includes(normNode);
        });

        if (!existsInArch) {
          items.push({
            type: "extra",
            severity: "low",
            expected: {},
            actual: { path: servicePath, module: rawFileName },
            description: `Repository module '${rawFileName}' (${servicePath}) is implemented in code but not documented in architecture v${intended.version.version_number}.`,
            recommendation: `Add '${rawFileName}' as a component in architecture version or assess if this module is obsolete.`,
            metadata: {
              confidence: "high",
              evidence: [`Found service file at: ${servicePath}`],
              affectedComponent: rawFileName,
              findingType: "extra_module",
              category: "Service",
            },
          });
        }
      }
    }

    // 3. Expected Technologies Mismatch
    const expectedTechs = (intended.version.architecture_data?.technologies as string[]) || [];
    for (const tech of expectedTechs) {
      const normExpected = normalize(tech);
      const isFound = actualFrameworks.some((f) => normalize(f).includes(normExpected) || normExpected.includes(normalize(f)));

      if (!isFound) {
        items.push({
          type: "mismatch",
          severity: "medium",
          expected: { technology: tech },
          actual: { detectedTechnologies: actualFrameworks },
          description: `Intended technology '${tech}' was not detected in repository frameworks or dependencies.`,
          recommendation: `Adopt '${tech}' or update intended architecture technologies to match detected frameworks (${actualFrameworks.join(", ") || "none"}).`,
          metadata: {
            confidence: "high",
            evidence: [`Detected repository frameworks: ${actualFrameworks.join(", ") || "none"}`],
            affectedComponent: tech,
            findingType: "technology_mismatch",
            category: "Technology",
          },
        });
      }
    }

    // 4. Deterministic, Reproducible Match Score Calculation
    // Total elements evaluated
    const totalElements = Math.max(
      1,
      intended.nodes.length + expectedTechs.length + items.filter((i) => i.type === "extra").length
    );

    const severityWeights: Record<string, number> = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
    };

    const totalPenalty = items.reduce((sum, item) => sum + (severityWeights[item.severity] || 5), 0);
    // Score out of 100
    const rawScore = 100 - (totalPenalty / Math.max(1, totalElements * 12)) * 100;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    const missingCount = items.filter((i) => i.type === "missing").length;
    const extraCount = items.filter((i) => i.type === "extra").length;
    const mismatchCount = items.filter((i) => i.type === "mismatch").length;

    const summary =
      items.length > 0
        ? `${items.length} architectural differences detected (${missingCount} missing, ${mismatchCount} mismatches, ${extraCount} extra) against architecture v${intended.version.version_number}.`
        : `Repository implementation matches architecture v${intended.version.version_number} with 100% compliance.`;

    return {
      items,
      score,
      summary,
    };
  }
}

export const driftDetectionService = new DriftDetectionService();
import { NotFoundError, ValidationError } from "../errors/app-error.js";
import { architectureService } from "./architecture-service.js";
import type {
  DriftCounts,
  DriftFindingMetadata,
  DriftItemType,
  DriftSeverity,
  RepositoryAnalysis,
} from "../types/repository-intelligence.js";

export interface DriftFindingItem {
  type: DriftItemType;
  severity: DriftSeverity;
  expected: Record<string, unknown>;
  actual: Record<string, unknown>;
  description: string;
  recommendation: string;
  metadata: DriftFindingMetadata;
}

export interface DriftResult {
  items: DriftFindingItem[];
  score: number;
  summary: string;
  counts: DriftCounts;
}

export class DriftDetectionService {
  async compare(
    projectId: string,
    versionId: string,
    analysis: RepositoryAnalysis
  ): Promise<DriftResult> {
    // 1. Validate Project Scope & Isolation
    if (analysis.project_id && analysis.project_id !== projectId) {
      throw new NotFoundError("Repository analysis snapshot not found for this project");
    }

    const intended = await architectureService.getVersion(versionId);
    if (!intended.version || intended.version.project_id !== projectId) {
      throw new NotFoundError("Architecture version not found for this project");
    }

    if (analysis.status && analysis.status !== "completed") {
      throw new ValidationError({
        repository: `Repository analysis status is '${analysis.status}'. A completed repository analysis is required for drift detection.`,
      });
    }

    // 2. Extract Evidence from Repository Snapshot
    const actual = (analysis.architecture ?? {}) as {
      technologies?: string[];
      services?: string[];
      databases?: string[];
      apis?: string[];
      routes?: Array<{
        method: string;
        path: string;
        framework?: string;
        file?: string;
        line?: number;
        handler?: string;
        detectionBasis?: string;
        confidence?: string;
      }>;
      entryPoints?: Array<{
        path: string;
        kind: string;
        evidence: string;
        confidence: string;
      }>;
      authentication?: boolean;
      externalIntegrations?: string[];
    };

    const actualFrameworks = (analysis.frameworks as string[]) || actual.technologies || [];
    const actualServices = actual.services || [];
    const actualDatabases = actual.databases || [];
    const actualApis = actual.apis || [];
    const actualRoutes = actual.routes || [];
    const actualIntegrations =
      actual.externalIntegrations ||
      (analysis.analysis_data as Record<string, unknown>)?.externalIntegrations as string[] ||
      [];
    const actualDependencies = (Array.isArray(analysis.dependencies)
      ? analysis.dependencies
      : []) as Array<{ name: string; version?: string; ecosystem?: string }>;

    const analysisData = (analysis.analysis_data ?? {}) as Record<string, unknown>;
    const filesAnalyzed = Number(analysisData.filesAnalyzed ?? 0);
    const fileCounts = analysisData.fileCounts as
      | {
          totalFilesDiscovered?: number;
          eligibleSourceFiles?: number;
          analyzedSourceFiles?: number;
          skippedFiles?: number;
          failedFiles?: number;
          manifestFilesProcessed?: number;
        }
      | undefined;
    const skippedFiles = Number(fileCounts?.skippedFiles ?? 0);
    const analysisWarnings = Array.isArray(analysisData.warnings) ? (analysisData.warnings as string[]) : [];

    const items: DriftFindingItem[] = [];

    // Normalization helper
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/(service|api|db|database|server|handler|controller)$/i, "")
        .replace(/[^a-z0-9]/g, "");

    const matchedServiceNames = new Set<string>();
    const matchedNodeKeys = new Set<string>();

    // Node Map for edge reconciliation
    const nodeMapById = new Map<string, any>();
    for (const node of intended.nodes) {
      nodeMapById.set(node.id, node);
    }

    // =========================================================================
    // 3. Category: Compare Architecture Nodes against Repository Evidence
    // =========================================================================
    for (const node of intended.nodes) {
      const nodeKey = normalize(node.name || "");
      const techKey = node.technology ? normalize(node.technology) : "";
      const isDynamic =
        Boolean(node.metadata?.dynamic) ||
        (node.description || "").toLowerCase().includes("dynamically configured") ||
        (node.technology || "").toLowerCase().includes("dynamic");

      // --- 3.A Database & Cache Nodes ---
      if (node.type === "database" || node.type === "cache") {
        const matchingDbManifest = actualDatabases.find((db) => {
          const normDb = normalize(db);
          return normDb.includes(nodeKey) || (techKey && normDb.includes(techKey)) || normDb.includes(normalize(node.type));
        });

        const matchingDep = actualDependencies.find((d) => {
          const normDep = normalize(d.name);
          return (techKey && normDep.includes(techKey)) || (nodeKey && normDep.includes(nodeKey));
        });

        const matchingFw = actualFrameworks.find((fw) => {
          const normFw = normalize(fw);
          return (techKey && normFw.includes(techKey)) || (nodeKey && normFw.includes(nodeKey));
        });

        if (matchingDbManifest || matchingDep || matchingFw) {
          matchedNodeKeys.add(node.id);
        } else {
          // Check for technology mismatch if another DB exists
          const alternativeDb = actualDatabases[0] || (actualDependencies.find((d) => /postgres|mongo|mysql|sqlite|redis/i.test(d.name))?.name);
          if (node.technology && alternativeDb && normalize(node.technology) !== normalize(alternativeDb)) {
            items.push({
              type: "mismatch",
              severity: "high",
              expected: { name: node.name, technology: node.technology, type: node.type },
              actual: { detectedDatabase: alternativeDb, detectedDatabases: actualDatabases },
              description: `Intended ${node.type} '${node.name}' specifies technology '${node.technology}', but repository uses '${alternativeDb}'.`,
              recommendation: `Align intended architecture technology with '${alternativeDb}' or migrate database driver to '${node.technology}'.`,
              metadata: {
                confidence: "high",
                evidence: [
                  `Expected technology: ${node.technology}`,
                  `Found repository database driver: ${alternativeDb}`,
                ],
                affectedComponent: node.name,
                affectedNodeId: node.id,
                findingType: "technology_mismatch",
                category: node.type === "cache" ? "Cache" : "Database",
                title: `Database technology mismatch: ${node.name}`,
                relatedDependencies: [alternativeDb],
                confidenceReason: "Confirmed through parsed package manifests and database drivers.",
              },
            });
            matchedNodeKeys.add(node.id);
          } else {
            const severity = node.type === "database" ? "high" : "medium";
            const confidence = filesAnalyzed >= 5 ? "high" : "medium";
            items.push({
              type: "missing",
              severity,
              expected: { name: node.name, type: node.type, technology: node.technology },
              actual: { detectedDatabases: actualDatabases },
              description: `Expected ${node.type} '${node.name}' (${node.technology || "unspecified"}) was not detected in repository dependencies or database configurations.`,
              recommendation: `Add client library or connection configuration for ${node.technology || node.name}, or update the intended architecture specification.`,
              metadata: {
                confidence,
                evidence: [
                  `Checked ${actualDatabases.length} detected database manifests/drivers`,
                  `Repository frameworks: ${actualFrameworks.join(", ") || "none"}`,
                ],
                affectedComponent: node.name,
                affectedNodeId: node.id,
                findingType: "missing_component",
                category: node.type === "cache" ? "Cache" : "Database",
                title: `Component not detected: ${node.name}`,
                confidenceReason: "Static scan inspected all dependency manifests without finding database client or configuration.",
              },
            });
          }
        }
      }

      // --- 3.B External Service Nodes ---
      else if (node.type === "external_service") {
        if (isDynamic) {
          items.push({
            type: "uncertain",
            severity: "low",
            expected: { name: node.name, type: node.type },
            actual: { integrations: actualIntegrations },
            description: `Integration '${node.name}' is dynamically configured or relies on runtime environment variables; static analysis cannot confirm presence.`,
            recommendation: `Verify runtime environment configuration or document explicit integration client in repository.`,
            metadata: {
              confidence: "low",
              evidence: [
                `Dynamic configuration noted in node metadata or description`,
                `Inspected static integrations: ${actualIntegrations.join(", ") || "none"}`,
              ],
              affectedComponent: node.name,
              affectedNodeId: node.id,
              findingType: "uncertain_match",
              category: "External Service",
              title: `Uncertain match: ${node.name}`,
              confidenceReason: "Static analysis cannot verify runtime endpoints or dynamic external requests.",
            },
          });
          matchedNodeKeys.add(node.id);
        } else {
          const hasIntegrationMatch = actualIntegrations.some((intg) => {
            const normIntg = normalize(intg);
            return normIntg.includes(nodeKey) || (techKey && normIntg.includes(techKey));
          });

          const matchingDep = actualDependencies.some((d) => {
            const normDep = normalize(d.name);
            return (techKey && normDep.includes(techKey)) || (nodeKey && normDep.includes(nodeKey));
          });

          if (hasIntegrationMatch || matchingDep) {
            matchedNodeKeys.add(node.id);
          } else {
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
                affectedNodeId: node.id,
                findingType: "integration_mismatch",
                category: "External Service",
                title: `Integration not detected: ${node.name}`,
                confidenceReason: "No corresponding external SDK or configuration found in static manifests.",
              },
            });
          }
        }
      }

      // --- 3.C Service, Backend, Worker, Gateway, API, Frontend, Queue, Storage Nodes ---
      else if (["service", "backend", "worker", "gateway", "api", "frontend", "auth", "queue", "storage", "monitoring", "infrastructure"].includes(node.type)) {
        if (isDynamic) {
          items.push({
            type: "uncertain",
            severity: "low",
            expected: { name: node.name, type: node.type },
            actual: { services: actualServices.slice(0, 5) },
            description: `Architecture component '${node.name}' uses ambiguous or dynamically configured routing/dispatch; static analysis is uncertain.`,
            recommendation: `Explicitly declare route or module path in component metadata.`,
            metadata: {
              confidence: "low",
              evidence: [`Component marked dynamic or uses dynamic dispatch: ${node.name}`],
              affectedComponent: node.name,
              affectedNodeId: node.id,
              findingType: "uncertain_match",
              category: "Service",
              title: `Uncertain component match: ${node.name}`,
              confidenceReason: "Dynamic dispatch or wildcard patterns prevent deterministic static resolution.",
            },
          });
          matchedNodeKeys.add(node.id);
          continue;
        }

        // Check dependencies for queues/storage/infrastructure (e.g. kafka, rabbitmq, bullmq, s3)
        const matchingQueueOrStorageDep = actualDependencies.find((d) => {
          const normDep = normalize(d.name);
          return (techKey && normDep.includes(techKey)) || (nodeKey && normDep.includes(nodeKey));
        });

        // 1. Try matching with actual services
        const matchedService = actualServices.find((s) => {
          const sName = normalize(s.split("/").pop() || s);
          return sName.includes(nodeKey) || nodeKey.includes(sName);
        });

        // 2. Try matching with actual API files
        const matchedApi = actualApis.find((a) => {
          const aName = normalize(a.split("/").pop() || a);
          return aName.includes(nodeKey) || nodeKey.includes(aName);
        });

        // 3. Try matching with routes
        const matchedRoute = actualRoutes.find((r) => {
          const normPath = normalize(r.path);
          return normPath.includes(nodeKey) || nodeKey.includes(normPath);
        });

        // 4. Try matching with frontend / backend entry points
        const matchedEntryPoint = actual.entryPoints?.find((ep) => {
          if (node.type === "frontend" && ep.kind === "frontend_app") return true;
          if ((node.type === "backend" || node.type === "gateway") && ep.kind === "backend_server") return true;
          return false;
        });

        if (matchedService || matchedApi || matchedRoute || matchedEntryPoint || matchingQueueOrStorageDep) {
          if (matchedService) matchedServiceNames.add(matchedService);
          if (matchedApi) matchedServiceNames.add(matchedApi);
          matchedNodeKeys.add(node.id);

          // Check for technology mismatch on matched component
          if (node.technology && actualFrameworks.length > 0) {
            const isLanguage = ["typescript", "ts", "javascript", "js", "python", "py", "go", "java", "rust", "rs", "ruby", "php"].includes(techKey);
            const hasLanguage =
              isLanguage &&
              (Boolean(analysis.languages?.[techKey]) ||
                (techKey === "typescript" && Boolean(analysis.languages?.ts || analysis.languages?.tsx)) ||
                (techKey === "javascript" && Boolean(analysis.languages?.js || analysis.languages?.jsx)));

            const hasTech =
              hasLanguage ||
              actualFrameworks.some((fw) => {
                const normFw = normalize(fw);
                return normFw.includes(techKey) || techKey.includes(normFw);
              }) ||
              actualDependencies.some((dep) => {
                const normDep = normalize(dep.name);
                return normDep.includes(techKey) || techKey.includes(normDep);
              });

            if (!hasTech && techKey) {
              items.push({
                type: "mismatch",
                severity: "medium",
                expected: { component: node.name, technology: node.technology },
                actual: { detectedFrameworks: actualFrameworks },
                description: `Component '${node.name}' specifies technology '${node.technology}', but repository frameworks are (${actualFrameworks.join(", ") || "none"}).`,
                recommendation: `Update component technology specification to match detected framework or migrate code.`,
                metadata: {
                  confidence: "high",
                  evidence: [
                    `Declared technology: ${node.technology}`,
                    `Detected frameworks: ${actualFrameworks.join(", ")}`,
                  ],
                  affectedComponent: node.name,
                  affectedNodeId: node.id,
                  findingType: "technology_mismatch",
                  category: "Technology",
                  title: `Component technology mismatch: ${node.name}`,
                  sourceFilePaths: matchedService ? [matchedService] : matchedApi ? [matchedApi] : [],
                  confidenceReason: "Component file located, but declared framework is absent from package dependencies.",
                },
              });
            }
          }
        } else {
          // Unmatched component
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
                `Searched ${actualServices.length} detected service files and ${actualApis.length} API files`,
                `Total files inspected: ${filesAnalyzed}`,
              ],
              affectedComponent: node.name,
              affectedNodeId: node.id,
              findingType: "missing_component",
              category: "Service",
              title: `Component not detected: ${node.name}`,
              confidenceReason: filesAnalyzed >= 10 ? "Repository source files inspected without identifying matching module." : "Low file count inspected in repository.",
            },
          });
        }
      }
    }

    // =========================================================================
    // 4. Category: Architecture Edges & Integration Mismatches
    // =========================================================================
    for (const edge of intended.edges) {
      const sourceNode = nodeMapById.get(edge.source_node_id);
      const targetNode = nodeMapById.get(edge.target_node_id);

      if (sourceNode && targetNode) {
        // If target is external service and not matched
        if (targetNode.type === "external_service" && !matchedNodeKeys.has(targetNode.id)) {
          // Already captured at node level or edge level
          const exists = items.some(
            (i) => i.metadata.affectedNodeId === targetNode.id && i.metadata.findingType === "integration_mismatch"
          );
          if (!exists) {
            items.push({
              type: "mismatch",
              severity: "medium",
              expected: {
                source: sourceNode.name,
                target: targetNode.name,
                relationship: edge.relationship,
                protocol: edge.protocol,
              },
              actual: { detectedIntegrations: actualIntegrations },
              description: `Connection from '${sourceNode.name}' to '${targetNode.name}' (${edge.protocol || edge.relationship}) has no verified client integration in repository.`,
              recommendation: `Configure integration client between '${sourceNode.name}' and '${targetNode.name}'.`,
              metadata: {
                confidence: "medium",
                evidence: [
                  `Declared edge: ${sourceNode.name} -> ${targetNode.name} via ${edge.relationship}`,
                  `No supporting external integration found in repository`,
                ],
                affectedComponent: `${sourceNode.name} -> ${targetNode.name}`,
                findingType: "integration_mismatch",
                category: "Integration",
                title: `Unverified connection: ${sourceNode.name} -> ${targetNode.name}`,
                confidenceReason: "Static scan found no client library for external endpoint.",
              },
            });
          }
        }
      }
    }

    // =========================================================================
    // 5. Category: Extra Modules in Repository Not Represented in Architecture
    // =========================================================================
    for (const servicePath of actualServices) {
      if (!matchedServiceNames.has(servicePath)) {
        const rawFileName = servicePath.split("/").pop()?.replace(/\.[^/.]+$/, "") || servicePath;
        const normService = normalize(rawFileName);

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
              title: `Unmapped repository module: ${rawFileName}`,
              sourceFilePaths: [servicePath],
              confidenceReason: "Direct source file exists in repository without matching architecture node.",
            },
          });
        }
      }
    }

    // =========================================================================
    // 6. Category: Expected Technologies Mismatch (Architecture Global)
    // =========================================================================
    const expectedTechs = (intended.version.architecture_data?.technologies as string[]) || [];
    for (const tech of expectedTechs) {
      const normExpected = normalize(tech);
      const isFound =
        actualFrameworks.some((f) => normalize(f).includes(normExpected) || normExpected.includes(normalize(f))) ||
        actualDependencies.some((d) => normalize(d.name).includes(normExpected) || normExpected.includes(normalize(d.name)));

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
            title: `Intended technology missing: ${tech}`,
            confidenceReason: "Repository dependency manifests analyzed; technology absent.",
          },
        });
      }
    }

    // =========================================================================
    // 7. Category: Coverage Limitations
    // =========================================================================
    if (filesAnalyzed < 3 && filesAnalyzed > 0) {
      items.push({
        type: "limitation",
        severity: "low",
        expected: {},
        actual: { filesAnalyzed, skippedFiles },
        description: `Repository analysis evaluated only ${filesAnalyzed} file(s). Limited repository content may restrict drift detection coverage.`,
        recommendation: `Ensure repository source files are committed and re-run analysis to improve coverage.`,
        metadata: {
          confidence: "medium",
          evidence: [`Inspected files: ${filesAnalyzed}`, `Skipped files: ${skippedFiles}`],
          affectedComponent: "Repository Analysis Scope",
          findingType: "coverage_limitation",
          category: "Analysis Coverage",
          title: "Limited static analysis coverage",
          confidenceReason: "Low total file count limits completeness of static comparison.",
        },
      });
    } else if (skippedFiles > 0 && filesAnalyzed > 0) {
      const sensitiveWarning = analysisWarnings.find((w) => w.toLowerCase().includes("environment"));
      if (sensitiveWarning) {
        items.push({
          type: "limitation",
          severity: "low",
          expected: {},
          actual: { skippedFiles, warning: sensitiveWarning },
          description: `Sensitive environment variables excluded from static analysis by policy; dynamic endpoint configurations were not inspected.`,
          recommendation: `Verify runtime environment variables directly in your deployment provider.`,
          metadata: {
            confidence: "high",
            evidence: [sensitiveWarning],
            affectedComponent: "Environment Configuration",
            findingType: "coverage_limitation",
            category: "Analysis Coverage",
            title: "Environment variables excluded from scan",
            confidenceReason: "Policy filter safely skipped .env file contents.",
          },
        });
      }
    }

    // =========================================================================
    // 8. Deterministic Counts & Score Calculation
    // =========================================================================
    const counts: DriftCounts = {
      total: items.length,
      byCategory: {
        missing_component: items.filter((i) => i.metadata.findingType === "missing_component").length,
        extra_module: items.filter((i) => i.metadata.findingType === "extra_module").length,
        technology_mismatch: items.filter((i) => i.metadata.findingType === "technology_mismatch").length,
        integration_mismatch: items.filter((i) => i.metadata.findingType === "integration_mismatch").length,
        uncertain_match: items.filter((i) => i.metadata.findingType === "uncertain_match").length,
        coverage_limitation: items.filter((i) => i.metadata.findingType === "coverage_limitation").length,
      },
      bySeverity: {
        critical: items.filter((i) => i.severity === "critical").length,
        high: items.filter((i) => i.severity === "high").length,
        medium: items.filter((i) => i.severity === "medium").length,
        low: items.filter((i) => i.severity === "low").length,
      },
    };

    const totalElements = Math.max(
      1,
      intended.nodes.length + expectedTechs.length + counts.byCategory.extra_module
    );

    const severityWeights: Record<string, number> = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
    };

    const totalPenalty = items.reduce((sum, item) => sum + (severityWeights[item.severity] || 5), 0);
    const rawScore = 100 - (totalPenalty / Math.max(1, totalElements * 12)) * 100;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    const summary =
      items.length > 0
        ? `${items.length} architectural differences detected (${counts.byCategory.missing_component} missing, ${counts.byCategory.technology_mismatch + counts.byCategory.integration_mismatch} mismatches, ${counts.byCategory.extra_module} extra) against architecture v${intended.version.version_number}.`
        : `No drift findings detected in the inspected scope across ${intended.nodes.length} architecture components and ${filesAnalyzed} repository files.`;

    return {
      items,
      score,
      summary,
      counts,
    };
  }
}

export const driftDetectionService = new DriftDetectionService();
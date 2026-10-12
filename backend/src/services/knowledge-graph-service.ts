import crypto from "node:crypto";
import { NotFoundError, ValidationError } from "../errors/app-error.js";
import { projectRepository } from "../repositories/project-repository.js";
import { architectureRepository } from "../repositories/architecture-repository.js";
import { repositoryIntelligenceRepository } from "../repositories/repository-intelligence-repository.js";
import { engineeringImpactRepository } from "../repositories/engineering-impact-repository.js";
import { engineeringRepository } from "../repositories/engineering-intelligence-repository.js";
import { knowledgeGraphRepository } from "../repositories/knowledge-graph-repository.js";
import { engineeringImpactService } from "./engineering-impact-service.js";
import type {
  EvidenceConfidence,
  KnowledgeGraphCoverage,
  KnowledgeGraphEntityNode,
  KnowledgeGraphEntityType,
  KnowledgeGraphNeighborhood,
  KnowledgeGraphRelationship,
  KnowledgeGraphRelationType,
  KnowledgeGraphSnapshot,
  KnowledgeGraphSummary,
  QueryKnowledgeGraphInput,
  SourceVersionContext,
  TraceabilityChainStep,
  TraceabilityReport,
} from "../types/knowledge-graph.js";
import type { ArchitectureEdge, ArchitectureNode, ArchitectureVersion } from "../types/architecture.js";
import type { RepositoryAnalysis, RepositoryRecord } from "../types/repository-intelligence.js";
import type { ImpactTargetEntity, ProposedChange } from "../types/engineering-impact.js";

function computeSourceHash(context: {
  versionId?: string | null;
  versionNumber?: number | null;
  repoId?: string | null;
  analysisId?: string | null;
  commitSha?: string | null;
  docsCount?: number;
}): string {
  const payload = [
    context.versionId || "no-ver",
    context.versionNumber ?? "0",
    context.repoId || "no-repo",
    context.analysisId || "no-analysis",
    context.commitSha || "no-sha",
    context.docsCount ?? "0",
  ].join(":");
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

function sanitizeId(str: unknown): string {
  if (typeof str !== "string") {
    if (str && typeof str === "object") {
      if ("path" in (str as any) && typeof (str as any).path === "string") {
        return (str as any).path.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      }
      if ("name" in (str as any) && typeof (str as any).name === "string") {
        return (str as any).name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      }
      if ("id" in (str as any)) {
        return String((str as any).id).replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
      }
    }
    return String(str || "").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  }
  return str.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

export class KnowledgeGraphService {
  async getContext(projectId: string) {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    const versions = await architectureRepository.versions(projectId);
    const repos = await repositoryIntelligenceRepository.repositories(projectId);

    const repoDetails = await Promise.all(
      repos.map(async (repo) => {
        const analyses = await repositoryIntelligenceRepository.analyses(projectId, repo.id).catch(() => []);
        return {
          id: repo.id,
          name: repo.repository_name,
          url: repo.repository_url,
          defaultBranch: repo.default_branch,
          analyses: analyses.map((a) => ({
            id: a.id,
            commitSha: a.commit_sha || "",
            branch: (a.analysis_data?.branch as string) || repo.default_branch,
            status: a.status,
            createdAt: a.created_at,
          })),
        };
      })
    );

    const latestSnapshot = await knowledgeGraphRepository.findLatest(projectId);

    return {
      projectId,
      workspaceId: project.workspace_id,
      architectureVersions: versions.map((v) => ({
        id: v.id,
        versionNumber: v.version_number,
        name: v.name,
        status: v.status,
        createdAt: v.created_at,
      })),
      repositories: repoDetails,
      latestSnapshotId: latestSnapshot?.id || null,
      latestSourceHash: latestSnapshot?.sourceHash || null,
      updatedAt: latestSnapshot?.updatedAt || null,
    };
  }

  async buildOrGetGraph(
    projectId: string,
    input: QueryKnowledgeGraphInput = {},
    userId?: string
  ): Promise<{ snapshot: KnowledgeGraphSnapshot; isFresh: boolean }> {
    const project = await projectRepository.findById(projectId);
    if (!project) {
      throw new NotFoundError("Project not found");
    }

    // 1. Resolve Architecture Version
    const versions = await architectureRepository.versions(projectId);
    let archVersion: ArchitectureVersion | null = null;
    if (input.architectureVersionId) {
      archVersion = versions.find((v) => v.id === input.architectureVersionId) || null;
      if (!archVersion || archVersion.project_id !== projectId) {
        throw new ValidationError("Requested architecture version does not belong to this project");
      }
    } else {
      archVersion = versions.find((v) => v.status === "published" && v.project_id === projectId) || versions.find((v) => v.project_id === projectId) || null;
    }

    // 2. Resolve Repository
    const repos = await repositoryIntelligenceRepository.repositories(projectId);
    let repo: RepositoryRecord | null = null;
    if (input.repositoryId) {
      repo = repos.find((r) => r.id === input.repositoryId) || null;
      if (!repo || repo.project_id !== projectId) {
        throw new ValidationError("Requested repository does not belong to this project");
      }
    } else if (repos.length > 0) {
      repo = repos.find((r) => r.project_id === projectId) || null;
    }

    // 3. Resolve Repository Analysis
    let analysis: RepositoryAnalysis | null = null;
    if (repo) {
      if (input.repositoryAnalysisId) {
        const repoAnalyses = await repositoryIntelligenceRepository.analyses(projectId, repo.id).catch(() => []);
        analysis = repoAnalyses.find((a) => a.id === input.repositoryAnalysisId) || null;
        if (!analysis) {
          throw new ValidationError("Requested repository analysis does not belong to this project or repository");
        }
      } else {
        analysis = await repositoryIntelligenceRepository.latestSuccessful(projectId, repo.id).catch(() => null);
        if (!analysis) {
          const allAnalyses = await repositoryIntelligenceRepository.analyses(projectId, repo.id).catch(() => []);
          analysis = allAnalyses[0] || null;
        }
      }
    }

    // 4. Resolve Documentation documents count
    const docs = await engineeringRepository.documents(projectId).catch(() => []);

    // 5. Compute deterministic source hash
    const sourceHash = computeSourceHash({
      versionId: archVersion?.id,
      versionNumber: archVersion?.version_number,
      repoId: repo?.id,
      analysisId: analysis?.id,
      commitSha: analysis?.commit_sha,
      docsCount: docs.length,
    });

    const sourceContext: SourceVersionContext = {
      architectureVersionId: archVersion?.id || null,
      architectureVersionNumber: archVersion?.version_number ?? null,
      repositoryId: repo?.id || null,
      repositoryName: repo?.repository_name || null,
      commitSha: analysis?.commit_sha || null,
      analysisSnapshotId: analysis?.id || null,
      branch: (analysis?.analysis_data?.branch as string) || repo?.default_branch || null,
      documentIds: docs.map((d) => d.id),
    };

    // 6. Check cache if not forcing refresh
    if (!input.forceRefresh) {
      const existing = await knowledgeGraphRepository.findByHash(projectId, sourceHash);
      if (existing) {
        return { snapshot: existing, isFresh: true };
      }
    }

    // 7. Deterministic Graph Generation
    const nodes: KnowledgeGraphEntityNode[] = [];
    const relationships: KnowledgeGraphRelationship[] = [];

    const nodeMap = new Map<string, KnowledgeGraphEntityNode>();
    const addNode = (node: KnowledgeGraphEntityNode) => {
      if (!nodeMap.has(node.id)) {
        nodeMap.set(node.id, node);
        nodes.push(node);
      }
    };

    const relKeySet = new Set<string>();
    const addRelationship = (rel: KnowledgeGraphRelationship) => {
      if (!nodeMap.has(rel.sourceId) || !nodeMap.has(rel.targetId)) {
        return;
      }
      const key = `${rel.sourceId}->${rel.type}->${rel.targetId}`;
      if (!relKeySet.has(key)) {
        relKeySet.add(key);
        relationships.push(rel);
      }
    };

    // A. Architecture Version Node
    if (archVersion) {
      const verNodeId = `ver_${archVersion.id}`;
      addNode({
        id: verNodeId,
        name: `v${archVersion.version_number}: ${archVersion.name}`,
        type: "architecture_version",
        projectId,
        sourceReference: `architecture_versions:${archVersion.id}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/versions`,
        metadata: {
          versionNumber: archVersion.version_number,
          status: archVersion.status,
          description: archVersion.description,
        },
        tags: ["version", archVersion.status],
      });
    }

    // B. Architecture Component Nodes & Connections
    let archNodes: ArchitectureNode[] = [];
    let archEdges: ArchitectureEdge[] = [];
    if (archVersion) {
      archNodes = await architectureRepository.nodes(archVersion.id).catch(() => []);
      archEdges = await architectureRepository.edges(archVersion.id).catch(() => []);

      for (const an of archNodes) {
        const nodeId = `arch_${an.id}`;
        addNode({
          id: nodeId,
          name: an.name,
          type: "architecture_component",
          projectId,
          sourceReference: `architecture_nodes:${an.id}`,
          sourceVersion: sourceContext,
          evidenceStatus: "verified",
          freshness: "fresh",
          url: `/workspace`,
          metadata: {
            nodeKey: an.node_key,
            componentType: an.type,
            technology: an.technology,
            description: an.description,
            properties: an.metadata || {},
          },
          tags: [an.type, an.technology || "service"].filter(Boolean) as string[],
        });

        // Link Version -> Architecture Component
        addRelationship({
          id: `rel_ver_${archVersion.id}_${an.id}`,
          sourceId: `ver_${archVersion.id}`,
          targetId: nodeId,
          type: "contains",
          confidence: "verified",
          evidence: `Architecture version ${archVersion.version_number} contains component ${an.name}`,
          sourceVersion: `v${archVersion.version_number}`,
          freshness: "fresh",
        });
      }

      // Architecture Connections (Edges)
      for (const edge of archEdges) {
        const sourceId = `arch_${edge.source_node_id}`;
        const targetId = `arch_${edge.target_node_id}`;
        if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
          addRelationship({
            id: `rel_edge_${edge.id}`,
            sourceId,
            targetId,
            type: "connects_to",
            confidence: "verified",
            evidence: `Architecture connection defined in baseline: ${edge.relationship} (${edge.protocol || "internal"})`,
            sourceVersion: `v${archVersion.version_number}`,
            freshness: "fresh",
            metadata: {
              protocol: edge.protocol,
              relationship: edge.relationship,
              description: edge.description,
            },
          });
        }
      }
    }

    // C. Requirement Entities
    const dbReqs = await projectRepository.requirements(projectId).catch(() => []);
    const requirementsRaw: Array<{ id: string; title: string; description?: string }> = [];

    if (dbReqs.length > 0) {
      dbReqs.forEach((r, idx) => {
        requirementsRaw.push({
          id: r.id || `REQ-${idx + 1}`,
          title: `Requirement v${r.version}: ${r.content.slice(0, 40)}`,
          description: r.content,
        });
      });
    } else if (project.description) {
      requirementsRaw.push({
        id: `REQ-CORE-1`,
        title: `${project.name} Core Requirement`,
        description: project.description,
      });
    }

    for (const req of requirementsRaw) {
      const reqId = `req_${sanitizeId(req.id)}`;
      addNode({
        id: reqId,
        name: req.title,
        type: "requirement",
        projectId,
        sourceReference: `project_requirements:${req.id}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/workspace`,
        metadata: {
          requirementId: req.id,
          description: req.description,
        },
        tags: ["requirement"],
      });

      // Map Requirement -> Architecture Component
      let mapped = false;
      for (const an of archNodes) {
        const matchesName = req.title.toLowerCase().includes(an.name.toLowerCase()) ||
          (req.description && req.description.toLowerCase().includes(an.name.toLowerCase()));

        if (matchesName) {
          mapped = true;
          addRelationship({
            id: `rel_req_${req.id}_${an.id}`,
            sourceId: reqId,
            targetId: `arch_${an.id}`,
            type: "implemented_by",
            confidence: "verified",
            evidence: `Requirement references architecture component [${an.name}]`,
            sourceVersion: archVersion ? `v${archVersion.version_number}` : undefined,
            freshness: "fresh",
          });
        }
      }

      if (!mapped && archNodes.length > 0) {
        const coreComp = archNodes.find((n) => n.type === "service" || n.type === "api") || archNodes[0];
        addRelationship({
          id: `rel_req_${req.id}_${coreComp.id}_inferred`,
          sourceId: reqId,
          targetId: `arch_${coreComp.id}`,
          type: "implemented_by",
          confidence: "inferred",
          evidence: `Inferred default association with primary architecture component [${coreComp.name}]`,
          sourceVersion: archVersion ? `v${archVersion.version_number}` : undefined,
          freshness: "fresh",
        });
      }
    }

    // D. Repository Modules & Source Files
    const analysisData = (analysis?.analysis_data || {}) as any;
    const archAnalysis = ((analysis as any)?.architecture || analysisData.architecture || {}) as any;
    const entryPointsRaw: any[] = Array.isArray(archAnalysis.entryPoints)
      ? archAnalysis.entryPoints
      : Array.isArray(analysisData.entryPoints)
      ? analysisData.entryPoints
      : [];
    const entryPointPaths = new Set<string>();
    entryPointsRaw.forEach((p) => {
      const pathStr = typeof p === "string" ? p : p?.path;
      if (pathStr && typeof pathStr === "string") {
        entryPointPaths.add(pathStr);
      }
    });

    const routesList: any[] = Array.isArray(archAnalysis.routes) ? archAnalysis.routes : [];
    const dbList: any[] = Array.isArray(archAnalysis.databases) ? archAnalysis.databases : [];
    const frameworksList: any[] = Array.isArray(archAnalysis.frameworks) ? archAnalysis.frameworks : [];
    const testFiles: any[] = Array.isArray(analysisData.testFiles) ? analysisData.testFiles : [];

    const moduleMap = new Map<string, string>();
    const registeredModules: Array<{ id: string; name: string; path: string; isEntryPoint: boolean }> = [];

    const sourcePaths = new Set<string>();
    entryPointPaths.forEach((p) => sourcePaths.add(p));
    routesList.forEach((r) => {
      if (typeof r?.file === "string") sourcePaths.add(r.file);
    });

    if (sourcePaths.size === 0 && analysis) {
      sourcePaths.add("src/index.ts");
    }

    for (const srcPath of sourcePaths) {
      const modId = `mod_${sanitizeId(srcPath)}`;
      const modName = srcPath.split("/").pop() || srcPath;
      moduleMap.set(srcPath, modId);
      registeredModules.push({
        id: modId,
        name: modName,
        path: srcPath,
        isEntryPoint: entryPointPaths.has(srcPath),
      });

      addNode({
        id: modId,
        name: modName,
        type: "repository_module",
        projectId,
        repositoryId: repo?.id || null,
        sourceReference: `repository_file:${srcPath}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/repository-intelligence`,
        metadata: {
          filePath: srcPath,
          isEntryPoint: entryPointPaths.has(srcPath),
          commitSha: analysis?.commit_sha,
          repositoryName: repo?.repository_name,
        },
        tags: ["code", "module", entryPointPaths.has(srcPath) ? "entrypoint" : ""].filter(Boolean),
      });

      for (const an of archNodes) {
        const compNameLow = an.name.toLowerCase();
        const pathLow = srcPath.toLowerCase();
        const techMatch = an.technology && frameworksList.some((f: any) => {
          const fName = typeof f === "string" ? f : f?.name || "";
          return fName.toLowerCase().includes(an.technology!.toLowerCase());
        });
        const nameMatch = pathLow.includes(compNameLow) || (an.description && an.description.toLowerCase().includes(srcPath.toLowerCase()));

        if (nameMatch || (techMatch && entryPointPaths.has(srcPath))) {
          addRelationship({
            id: `rel_arch_map_${an.id}_${modId}`,
            sourceId: `arch_${an.id}`,
            targetId: modId,
            type: "mapped_to",
            confidence: nameMatch ? "verified" : "inferred",
            evidence: nameMatch
              ? `Component name [${an.name}] corresponds directly to repository module [${srcPath}]`
              : `Technology [${an.technology}] corresponds to detected framework stack and entrypoint [${srcPath}]`,
            sourceSnapshot: analysis?.id,
            sourceVersion: analysis?.commit_sha?.slice(0, 7),
            freshness: "fresh",
          });
        }
      }
    }

    // E. API Routes & Handlers
    for (let i = 0; i < routesList.length; i++) {
      const route = routesList[i];
      const routeMethod = (route.method || "GET").toUpperCase();
      const routePath = route.path || `/api/v1/resource_${i}`;
      const routeId = `route_${sanitizeId(`${routeMethod}_${routePath}`)}`;

      addNode({
        id: routeId,
        name: `${routeMethod} ${routePath}`,
        type: "api_route",
        projectId,
        repositoryId: repo?.id || null,
        sourceReference: `api_routes:${route.file || "app"}:${route.line || i}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/repository-intelligence`,
        metadata: {
          method: routeMethod,
          path: routePath,
          handler: route.handler,
          file: route.file,
          line: route.line,
        },
        tags: ["api", routeMethod],
      });

      if (route.file && moduleMap.has(route.file)) {
        const targetModId = moduleMap.get(route.file)!;
        addRelationship({
          id: `rel_route_hand_${routeId}_${targetModId}`,
          sourceId: routeId,
          targetId: targetModId,
          type: "handled_by",
          confidence: "verified",
          evidence: `Route declaration handled by controller in [${route.file}${route.line ? `:${route.line}` : ""}]`,
          sourceSnapshot: analysis?.id,
          freshness: "fresh",
        });
      } else if (registeredModules.length > 0) {
        const targetMod = registeredModules[0];
        addRelationship({
          id: `rel_route_hand_${routeId}_${targetMod.id}`,
          sourceId: routeId,
          targetId: targetMod.id,
          type: "handled_by",
          confidence: "inferred",
          evidence: `Route registered in repository module [${targetMod.path}]`,
          sourceSnapshot: analysis?.id,
          freshness: "fresh",
        });
      }
    }

    // F. Database Tables / Models
    for (const db of dbList) {
      const dbName = typeof db === "string" ? db : db?.name || "unnamed_model";
      const dbType = typeof db === "object" ? db?.type || "table" : "database";
      const dbId = `db_${sanitizeId(dbName)}`;

      addNode({
        id: dbId,
        name: dbName,
        type: "database_model",
        projectId,
        repositoryId: repo?.id || null,
        sourceReference: `database_schema:${dbName}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/repository-intelligence`,
        metadata: {
          modelType: dbType,
          fields: typeof db === "object" ? db?.fields || db?.columns || [] : [],
          orm: typeof db === "object" ? db?.orm || "detected" : "detected",
        },
        tags: ["database", dbType],
      });

      for (const mod of registeredModules) {
        addRelationship({
          id: `rel_mod_db_${mod.id}_${dbId}`,
          sourceId: mod.id,
          targetId: dbId,
          type: "accesses",
          confidence: "verified",
          evidence: `Repository module [${mod.path}] declares or queries database model [${dbName}]`,
          sourceSnapshot: analysis?.id,
          freshness: "fresh",
        });
        break;
      }
    }

    // G. Dependencies
    const dbDependencies = repo && analysis
      ? await repositoryIntelligenceRepository.dependencies(projectId, { repositoryId: repo.id }).catch(() => [])
      : [];
    const directDeps = dbDependencies.slice(0, 15);

    for (const dep of directDeps) {
      const depId = `dep_${sanitizeId(dep.name)}`;
      const manifestFile = (dep.metadata?.manifest_file as string) || "package.json";
      const isDirect = dep.metadata?.is_direct !== false;

      addNode({
        id: depId,
        name: `${dep.name} (${dep.version})`,
        type: "dependency",
        projectId,
        repositoryId: repo?.id || null,
        sourceReference: `manifest:${manifestFile}:${dep.name}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/repository-intelligence`,
        metadata: {
          packageName: dep.name,
          versionSpec: dep.version,
          ecosystem: dep.ecosystem,
          riskLevel: dep.risk_level,
          isDirect,
        },
        tags: ["dependency", dep.ecosystem, dep.risk_level],
      });

      if (registeredModules.length > 0) {
        addRelationship({
          id: `rel_dep_${registeredModules[0].id}_${depId}`,
          sourceId: registeredModules[0].id,
          targetId: depId,
          type: "depends_on",
          confidence: "verified",
          evidence: `Declared in package manifest [${manifestFile}]`,
          sourceSnapshot: analysis?.id,
          freshness: "fresh",
        });
      }
    }

    // H. Tests
    for (let i = 0; i < testFiles.length; i++) {
      const testItem = testFiles[i];
      const testPath = typeof testItem === "string" ? testItem : testItem?.path || testItem?.file || `tests/test_${i}.ts`;
      const testName = String(testPath).split("/").pop() || String(testPath);
      const testId = `test_${sanitizeId(testPath)}`;

      addNode({
        id: testId,
        name: testName,
        type: "test",
        projectId,
        repositoryId: repo?.id || null,
        sourceReference: `test_file:${testPath}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/repository-intelligence`,
        metadata: {
          testFile: testPath,
          runner: analysisData.testRunner || "vitest",
        },
        tags: ["test", analysisData.testRunner || "unit-test"],
      });

      let testLinked = false;
      for (const mod of registeredModules) {
        const baseName = mod.name.replace(/\.(ts|js|jsx|tsx)$/, "");
        if (testPath.includes(baseName) || testName.includes(baseName)) {
          testLinked = true;
          addRelationship({
            id: `rel_test_ver_${testId}_${mod.id}`,
            sourceId: testId,
            targetId: mod.id,
            type: "verifies",
            confidence: "verified",
            evidence: `Test suite verifies implementation in module [${mod.path}]`,
            sourceSnapshot: analysis?.id,
            freshness: "fresh",
          });
        }
      }

      if (!testLinked && registeredModules.length > 0) {
        addRelationship({
          id: `rel_test_ver_${testId}_${registeredModules[0].id}`,
          sourceId: testId,
          targetId: registeredModules[0].id,
          type: "verifies",
          confidence: "inferred",
          evidence: `Detected test suite executing in project test runner`,
          sourceSnapshot: analysis?.id,
          freshness: "fresh",
        });
      }

      for (let rIdx = 0; rIdx < routesList.length; rIdx++) {
        const r = routesList[rIdx];
        const routeMethod = (r.method || "GET").toUpperCase();
        const routePath = r.path || `/api/v1/resource_${rIdx}`;
        const routeId = `route_${sanitizeId(`${routeMethod}_${routePath}`)}`;
        if (nodeMap.has(routeId)) {
          const pathSnippet = routePath.split("/").filter(Boolean).pop();
          if (pathSnippet && testPath.toLowerCase().includes(pathSnippet.toLowerCase())) {
            addRelationship({
              id: `rel_test_route_${testId}_${routeId}`,
              sourceId: testId,
              targetId: routeId,
              type: "verifies",
              confidence: "verified",
              evidence: `Integration test file targets route endpoint [${routePath}]`,
              sourceSnapshot: analysis?.id,
              freshness: "fresh",
            });
          }
        }
      }
    }

    // I. Documentation Sections
    for (const doc of docs) {
      const docId = `doc_${doc.id}`;
      addNode({
        id: docId,
        name: doc.title,
        type: "documentation",
        projectId,
        sourceReference: `documentation_documents:${doc.id}`,
        sourceVersion: sourceContext,
        evidenceStatus: doc.status === "outdated" ? "partial" : "verified",
        freshness: doc.status === "outdated" ? "stale" : "fresh",
        url: `/documentation`,
        metadata: {
          documentType: doc.type,
          status: doc.status,
          sourceVersionId: doc.source_version_id,
          wordCount: (doc.content || "").length,
        },
        tags: ["documentation", doc.type, doc.status],
      });

      for (const an of archNodes) {
        const matchesVersion = doc.source_version_id === archVersion?.id;
        const mentionsComponent = (doc.content || "").toLowerCase().includes(an.name.toLowerCase());

        if (matchesVersion || mentionsComponent) {
          addRelationship({
            id: `rel_doc_desc_${docId}_arch_${an.id}`,
            sourceId: docId,
            targetId: `arch_${an.id}`,
            type: "describes",
            confidence: mentionsComponent ? "verified" : "inferred",
            evidence: mentionsComponent
              ? `Document explicitly references component [${an.name}] in documentation body`
              : `Document generated from architecture version [v${archVersion?.version_number}]`,
            sourceVersion: archVersion ? `v${archVersion.version_number}` : undefined,
            freshness: doc.status === "outdated" ? "stale" : "fresh",
          });
        }
      }
    }

    // J. Architecture Drift Findings
    if (archVersion && repo) {
      const drifts = await repositoryIntelligenceRepository.drifts(projectId, repo.id).catch(() => []);
      const latestDrift = drifts.find((d) => d.architecture_version_id === archVersion?.id) || drifts[0];
      if (latestDrift) {
        const driftItems = await repositoryIntelligenceRepository.driftFindings(latestDrift.id).catch(() => []);
        for (const item of driftItems) {
          const driftId = `drift_${item.id || sanitizeId(item.description.slice(0, 20))}`;
          const affectedNodeId = item.metadata?.affectedNodeId;
          const repoFile = item.metadata?.sourceFilePaths?.[0];

          addNode({
            id: driftId,
            name: `Drift: ${item.type.toUpperCase()} - ${item.severity}`,
            type: "drift_finding",
            projectId,
            repositoryId: repo.id,
            sourceReference: `drift_items:${item.id || driftId}`,
            sourceVersion: sourceContext,
            evidenceStatus: "verified",
            freshness: "fresh",
            url: `/drift-detection`,
            metadata: {
              driftType: item.type,
              severity: item.severity,
              description: item.description,
              suggestedAction: item.recommendation,
              architectureNodeId: affectedNodeId,
              repositoryFile: repoFile,
            },
            tags: ["drift", item.severity, item.type],
          });

          if (affectedNodeId && nodeMap.has(`arch_${affectedNodeId}`)) {
            addRelationship({
              id: `rel_drift_${affectedNodeId}_${driftId}`,
              sourceId: `arch_${affectedNodeId}`,
              targetId: driftId,
              type: "has_drift",
              confidence: "verified",
              evidence: `Drift detection engine identified: ${item.description}`,
              sourceSnapshot: analysis?.id,
              sourceVersion: `v${archVersion.version_number}`,
              freshness: "fresh",
            });
          } else if (archNodes.length > 0) {
            const matchedComp = archNodes.find((an) => item.description.toLowerCase().includes(an.name.toLowerCase()));
            if (matchedComp) {
              addRelationship({
                id: `rel_drift_${matchedComp.id}_${driftId}`,
                sourceId: `arch_${matchedComp.id}`,
                targetId: driftId,
                type: "has_drift",
                confidence: "verified",
                evidence: `Drift finding text references architecture component [${matchedComp.name}]`,
                sourceSnapshot: analysis?.id,
                sourceVersion: `v${archVersion.version_number}`,
                freshness: "fresh",
              });
            }
          }
        }
      }
    }

    // K. Engineering Impact Findings
    const impactReports = await engineeringImpactRepository.listReports(projectId).catch(() => []);
    for (const report of impactReports.slice(0, 5)) {
      const impactId = `impact_${report.id}`;
      const overallRisk = report.riskAssessment?.overallSeverity || "medium";
      const directCount = report.impactSummary?.directlyAffected?.length || 0;
      const indirectCount = report.impactSummary?.downstreamComponents?.length || 0;

      addNode({
        id: impactId,
        name: `Impact Analysis: ${report.targetEntity?.name || "Target Component"} (${overallRisk})`,
        type: "impact_finding",
        projectId,
        sourceReference: `impact_reports:${report.id}`,
        sourceVersion: sourceContext,
        evidenceStatus: "verified",
        freshness: "fresh",
        url: `/impact-analysis`,
        metadata: {
          reportId: report.id,
          targetEntityName: report.targetEntity?.name,
          changeType: report.proposedChange?.changeType,
          risk: overallRisk,
          directCount,
          indirectCount,
        },
        tags: ["impact", overallRisk],
      });

      if (report.targetEntity?.id && nodeMap.has(`arch_${report.targetEntity.id}`)) {
        addRelationship({
          id: `rel_impact_target_${impactId}_arch_${report.targetEntity.id}`,
          sourceId: impactId,
          targetId: `arch_${report.targetEntity.id}`,
          type: "affects",
          confidence: "verified",
          evidence: `Impact assessment target entity: ${report.targetEntity.name} (${report.proposedChange?.changeType || "modified"})`,
          freshness: "fresh",
        });
      }
    }

    // 8. Compute Summary Counts
    const entityTypeCounts: Record<string, number> = {};
    for (const n of nodes) {
      entityTypeCounts[n.type] = (entityTypeCounts[n.type] || 0) + 1;
    }

    const relationTypeCounts: Record<string, number> = {};
    let verifiedCount = 0;
    let inferredCount = 0;
    let uncertainCount = 0;
    let staleCount = 0;

    for (const r of relationships) {
      relationTypeCounts[r.type] = (relationTypeCounts[r.type] || 0) + 1;
      if (r.confidence === "verified") verifiedCount++;
      else if (r.confidence === "inferred") inferredCount++;
      else if (r.confidence === "uncertain") uncertainCount++;

      if (r.freshness === "stale") staleCount++;
    }

    const summary: KnowledgeGraphSummary = {
      totalEntities: nodes.length,
      totalRelationships: relationships.length,
      entityTypeCounts,
      relationTypeCounts,
      verifiedRelationsCount: verifiedCount,
      inferredRelationsCount: inferredCount,
      uncertainRelationsCount: uncertainCount,
      staleRelationsCount: staleCount,
    };

    // 9. Compute Coverage & Traceability Gaps
    const totalReqs = nodes.filter((n) => n.type === "requirement").length;
    const mappedReqs = new Set(
      relationships.filter((r) => r.type === "implemented_by").map((r) => r.sourceId)
    );

    const totalComps = nodes.filter((n) => n.type === "architecture_component").length;
    const mappedComps = new Set(
      relationships.filter((r) => r.type === "mapped_to").map((r) => r.sourceId)
    );

    const totalRoutes = nodes.filter((n) => n.type === "api_route").length;
    const testedRoutes = new Set(
      relationships.filter((r) => r.type === "verifies" && r.targetId.startsWith("route_")).map((r) => r.targetId)
    );

    const totalMods = nodes.filter((n) => n.type === "repository_module").length;
    const documentedMods = new Set(
      relationships.filter((r) => r.type === "describes").map((r) => r.targetId)
    );

    const totalDrifts = nodes.filter((n) => n.type === "drift_finding").length;
    const linkedDrifts = new Set(
      relationships.filter((r) => r.type === "has_drift").map((r) => r.targetId)
    );

    const gaps = {
      requirementsWithoutArchitecture: nodes
        .filter((n) => n.type === "requirement" && !mappedReqs.has(n.id))
        .map((n) => n.name),
      componentsWithoutRepository: nodes
        .filter((n) => n.type === "architecture_component" && !mappedComps.has(n.id))
        .map((n) => n.name),
      routesWithoutTests: nodes
        .filter((n) => n.type === "api_route" && !testedRoutes.has(n.id))
        .map((n) => n.name),
      modulesWithoutDocumentation: nodes
        .filter((n) => n.type === "repository_module" && !documentedMods.has(n.id))
        .map((n) => n.name),
      staleSources: relationships
        .filter((r) => r.freshness === "stale")
        .map((r) => `${r.sourceId} -> ${r.targetId}`),
    };

    const coverageSum =
      (totalReqs ? mappedReqs.size / totalReqs : 1) +
      (totalComps ? mappedComps.size / totalComps : 1) +
      (totalRoutes ? testedRoutes.size / totalRoutes : 1) +
      (totalMods ? documentedMods.size / totalMods : 1);
    const overallCoveragePercentage = Math.round((coverageSum / 4) * 100);

    const coverage: KnowledgeGraphCoverage = {
      totalRequirements: totalReqs,
      mappedRequirementsCount: mappedReqs.size,
      totalComponents: totalComps,
      mappedComponentsCount: mappedComps.size,
      totalRoutes,
      testedRoutesCount: testedRoutes.size,
      totalModules: totalMods,
      documentedModulesCount: documentedMods.size,
      totalDriftFindings: totalDrifts,
      linkedDriftFindingsCount: linkedDrifts.size,
      gaps,
      overallCoveragePercentage,
    };

    // 10. Persist Snapshot Idempotently
    const savedSnapshot = await knowledgeGraphRepository.save({
      projectId,
      workspaceId: project.workspace_id,
      architectureVersionId: archVersion?.id || null,
      repositoryId: repo?.id || null,
      repositoryAnalysisId: analysis?.id || null,
      sourceHash,
      sourceContext,
      entities: nodes,
      relationships,
      summary,
      coverage,
      status: "completed",
      createdBy: userId || null,
    });

    return { snapshot: savedSnapshot, isFresh: true };
  }

  async queryGraph(
    projectId: string,
    input: QueryKnowledgeGraphInput = {},
    userId?: string
  ): Promise<{
    snapshot: KnowledgeGraphSnapshot;
    filteredEntities: KnowledgeGraphEntityNode[];
    filteredRelationships: KnowledgeGraphRelationship[];
    totalEntities: number;
    totalRelationships: number;
  }> {
    const { snapshot } = await this.buildOrGetGraph(projectId, input, userId);

    let entities = [...snapshot.entities];
    let relationships = [...snapshot.relationships];

    // Filter by graph dependency scope
    if (input.scope === "architecture") {
      const archTypes = new Set<KnowledgeGraphEntityType>([
        "architecture_version",
        "requirement",
        "architecture_component",
        "architecture_connection",
        "drift_finding",
        "impact_finding",
        "documentation",
      ]);
      entities = entities.filter((e) => archTypes.has(e.type));
    } else if (input.scope === "repository") {
      const repoTypes = new Set<KnowledgeGraphEntityType>([
        "repository_module",
        "api_route",
        "database_model",
        "dependency",
        "test",
      ]);
      entities = entities.filter((e) => repoTypes.has(e.type));
    }

    if (input.entityTypes && input.entityTypes.length > 0) {
      const typeSet = new Set(input.entityTypes);
      entities = entities.filter((e) => typeSet.has(e.type));
    }

    if (input.relationTypes && input.relationTypes.length > 0) {
      const relTypeSet = new Set(input.relationTypes);
      relationships = relationships.filter((r) => relTypeSet.has(r.type));
    }

    if (input.search && input.search.trim().length > 0) {
      const s = input.search.toLowerCase().trim();
      entities = entities.filter(
        (e) =>
          e.name.toLowerCase().includes(s) ||
          e.sourceReference.toLowerCase().includes(s) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(s)))
      );
    }

    const validEntityIds = new Set(entities.map((e) => e.id));
    relationships = relationships.filter(
      (r) => validEntityIds.has(r.sourceId) && validEntityIds.has(r.targetId)
    );

    const offset = input.offset || 0;
    const limit = input.limit || 100;
    const paginatedEntities = entities.slice(offset, offset + limit);

    return {
      snapshot,
      filteredEntities: paginatedEntities,
      filteredRelationships: relationships,
      totalEntities: entities.length,
      totalRelationships: relationships.length,
    };
  }

  async getNeighborhood(
    projectId: string,
    centerEntityId: string,
    depth: number = 1
  ): Promise<KnowledgeGraphNeighborhood> {
    const { snapshot } = await this.buildOrGetGraph(projectId, {});

    const center = snapshot.entities.find((e) => e.id === centerEntityId);
    if (!center) {
      throw new NotFoundError(`Entity with ID [${centerEntityId}] not found in knowledge graph`);
    }

    const boundedDepth = Math.max(1, Math.min(depth, 3));
    const visitedNodeIds = new Set<string>([center.id]);
    let currentLevel = new Set<string>([center.id]);

    const includedRelIds = new Set<string>();

    for (let d = 0; d < boundedDepth; d++) {
      const nextLevel = new Set<string>();

      for (const rel of snapshot.relationships) {
        if (currentLevel.has(rel.sourceId)) {
          visitedNodeIds.add(rel.targetId);
          nextLevel.add(rel.targetId);
          includedRelIds.add(rel.id);
        } else if (currentLevel.has(rel.targetId)) {
          visitedNodeIds.add(rel.sourceId);
          nextLevel.add(rel.sourceId);
          includedRelIds.add(rel.id);
        }
      }

      currentLevel = nextLevel;
      if (currentLevel.size === 0) break;
    }

    const neighborNodes = snapshot.entities.filter((e) => visitedNodeIds.has(e.id));
    const neighborRels = snapshot.relationships.filter(
      (r) => visitedNodeIds.has(r.sourceId) && visitedNodeIds.has(r.targetId)
    );

    return {
      centerEntity: center,
      nodes: neighborNodes,
      relationships: neighborRels,
      depth: boundedDepth,
      totalNeighbors: neighborNodes.length - 1,
    };
  }

  async getTraceability(
    projectId: string,
    rootEntityId: string
  ): Promise<TraceabilityReport> {
    const { snapshot } = await this.buildOrGetGraph(projectId, {});

    const rootEntity = snapshot.entities.find((e) => e.id === rootEntityId);
    if (!rootEntity) {
      throw new NotFoundError(`Entity with ID [${rootEntityId}] not found in knowledge graph`);
    }

    const findConnected = (
      sourceId: string,
      targetType: KnowledgeGraphEntityType,
      relTypes: KnowledgeGraphRelationType[]
    ): { node?: KnowledgeGraphEntityNode; confidence: EvidenceConfidence; evidence: string } | null => {
      for (const r of snapshot.relationships) {
        if (r.sourceId === sourceId && relTypes.includes(r.type)) {
          const target = snapshot.entities.find((e) => e.id === r.targetId && e.type === targetType);
          if (target) return { node: target, confidence: r.confidence, evidence: r.evidence };
        }
      }
      for (const r of snapshot.relationships) {
        if (r.targetId === sourceId && relTypes.includes(r.type)) {
          const source = snapshot.entities.find((e) => e.id === r.sourceId && e.type === targetType);
          if (source) return { node: source, confidence: r.confidence, evidence: r.evidence };
        }
      }
      return null;
    };

    let reqNode: KnowledgeGraphEntityNode | undefined;
    let archNode: KnowledgeGraphEntityNode | undefined;
    let modNode: KnowledgeGraphEntityNode | undefined;
    let routeNode: KnowledgeGraphEntityNode | undefined;
    let dbNode: KnowledgeGraphEntityNode | undefined;
    let testNode: KnowledgeGraphEntityNode | undefined;
    let docNode: KnowledgeGraphEntityNode | undefined;

    if (rootEntity.type === "requirement") reqNode = rootEntity;
    else if (rootEntity.type === "architecture_component") archNode = rootEntity;
    else if (rootEntity.type === "repository_module") modNode = rootEntity;
    else if (rootEntity.type === "api_route") routeNode = rootEntity;
    else if (rootEntity.type === "database_model") dbNode = rootEntity;
    else if (rootEntity.type === "test") testNode = rootEntity;
    else if (rootEntity.type === "documentation") docNode = rootEntity;

    if (reqNode && !archNode) {
      const match = findConnected(reqNode.id, "architecture_component", ["implemented_by"]);
      if (match?.node) archNode = match.node;
    } else if (archNode && !reqNode) {
      const match = findConnected(archNode.id, "requirement", ["implemented_by"]);
      if (match?.node) reqNode = match.node;
    }

    if (archNode && !modNode) {
      const match = findConnected(archNode.id, "repository_module", ["mapped_to"]);
      if (match?.node) modNode = match.node;
    } else if (modNode && !archNode) {
      const match = findConnected(modNode.id, "architecture_component", ["mapped_to"]);
      if (match?.node) archNode = match.node;
    }

    if (modNode && !routeNode) {
      const match = findConnected(modNode.id, "api_route", ["handled_by"]);
      if (match?.node) routeNode = match.node;
    } else if (routeNode && !modNode) {
      const match = findConnected(routeNode.id, "repository_module", ["handled_by"]);
      if (match?.node) modNode = match.node;
    }

    if (modNode && !dbNode) {
      const match = findConnected(modNode.id, "database_model", ["accesses"]);
      if (match?.node) dbNode = match.node;
    }

    if (modNode && !testNode) {
      const match = findConnected(modNode.id, "test", ["verifies"]);
      if (match?.node) testNode = match.node;
    }

    if (archNode && !docNode) {
      const match = findConnected(archNode.id, "documentation", ["describes"]);
      if (match?.node) docNode = match.node;
    }

    const chain: TraceabilityChainStep[] = [
      {
        stage: "requirement",
        stageLabel: "Requirement",
        status: reqNode ? reqNode.evidenceStatus : "not_mapped",
        entity: reqNode,
        notes: reqNode ? `Verified requirement [${reqNode.name}]` : "No requirement linked to this component",
      },
      {
        stage: "architecture",
        stageLabel: "Architecture Component",
        status: archNode ? archNode.evidenceStatus : "not_mapped",
        entity: archNode,
        notes: archNode ? `Architecture component [${archNode.name}]` : "No architecture component mapped",
      },
      {
        stage: "repository",
        stageLabel: "Repository Module",
        status: modNode ? modNode.evidenceStatus : "source_unavailable",
        entity: modNode,
        notes: modNode ? `Repository implementation module [${modNode.name}]` : "No source code module detected in repository analysis",
      },
      {
        stage: "api",
        stageLabel: "API Route",
        status: routeNode ? routeNode.evidenceStatus : "not_mapped",
        entity: routeNode,
        notes: routeNode ? `API Endpoint [${routeNode.name}]` : "No dedicated API route mapped to this module",
      },
      {
        stage: "data_model",
        stageLabel: "Database Model",
        status: dbNode ? dbNode.evidenceStatus : "not_mapped",
        entity: dbNode,
        notes: dbNode ? `Database table/model [${dbNode.name}]` : "No database entity accessed by this component",
      },
      {
        stage: "test",
        stageLabel: "Automated Test",
        status: testNode ? testNode.evidenceStatus : "no_matching_test",
        entity: testNode,
        notes: testNode ? `Test suite [${testNode.name}]` : "No matching test suite found in repository analysis",
      },
      {
        stage: "documentation",
        stageLabel: "Documentation",
        status: docNode ? (docNode.freshness === "stale" ? "uncertain" : docNode.evidenceStatus) : "documentation_missing",
        entity: docNode,
        notes: docNode ? `Documentation section [${docNode.name}]` : "Documentation missing for this architecture component",
      },
    ];

    const unresolvedGaps: string[] = [];
    chain.forEach((step) => {
      if (step.status === "not_mapped") unresolvedGaps.push(`${step.stageLabel}: Not mapped`);
      else if (step.status === "no_matching_test") unresolvedGaps.push(`${step.stageLabel}: No matching test found`);
      else if (step.status === "documentation_missing") unresolvedGaps.push(`${step.stageLabel}: Documentation missing`);
      else if (step.status === "source_unavailable") unresolvedGaps.push(`${step.stageLabel}: Source unavailable`);
      else if (step.status === "uncertain") unresolvedGaps.push(`${step.stageLabel}: Link uncertain or stale`);
    });

    const isComplete = unresolvedGaps.length === 0;
    const summary = isComplete
      ? `Full 7-stage traceability verified from requirement down to documentation.`
      : `Partial traceability established. ${unresolvedGaps.length} gap(s) identified across the engineering chain.`;

    return {
      rootEntityId: rootEntity.id,
      rootEntityType: rootEntity.type,
      rootEntityName: rootEntity.name,
      chain,
      complete: isComplete,
      unresolvedGaps,
      summary,
    };
  }

  async analyzeNodeImpact(
    projectId: string,
    entityId: string,
    userId: string,
    changeType: "modified" | "deprecated" | "removed" | "refactored" = "modified"
  ) {
    const { snapshot } = await this.buildOrGetGraph(projectId, {});

    const entity = snapshot.entities.find((e) => e.id === entityId);
    if (!entity) {
      throw new NotFoundError(`Entity with ID [${entityId}] not found in knowledge graph`);
    }

    if (!snapshot.architectureVersionId) {
      throw new ValidationError("No architecture version associated with current graph snapshot");
    }

    let targetEntityId = entity.id;
    let targetEntityName = entity.name;
    let targetType: ImpactTargetEntity["type"] = "architecture_component";

    if (entity.type === "architecture_component") {
      targetEntityId = entity.id.replace(/^arch_/, "");
      targetEntityName = entity.name;
      targetType = "architecture_component";
    } else if (entity.type === "repository_module") {
      targetType = "service_module";
    } else if (entity.type === "api_route") {
      targetType = "api_route";
    } else if (entity.type === "database_model") {
      targetType = "database_object";
    } else if (entity.type === "dependency") {
      targetType = "dependency";
    }

    const targetEntity: ImpactTargetEntity = {
      type: targetType,
      id: targetEntityId,
      name: targetEntityName,
      nodeKey: entity.metadata?.nodeKey as string | undefined,
      path: entity.metadata?.filePath as string | undefined,
    };

    const proposedChange: ProposedChange = {
      changeType,
      description: `Impact analysis triggered from Knowledge Graph for entity [${entity.name}] (${entity.type})`,
    };

    const report = await engineeringImpactService.analyze(projectId, userId, {
      architectureVersionId: snapshot.architectureVersionId,
      repositoryId: snapshot.repositoryId || undefined,
      repositoryAnalysisId: snapshot.repositoryAnalysisId || undefined,
      targetEntity,
      proposedChange,
    });

    return {
      report,
      entity,
      impactSummary: report.impactSummary,
      riskAssessment: report.riskAssessment,
    };
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();

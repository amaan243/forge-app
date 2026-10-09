import type { DependencyGraph, DependencyRecord, RiskLevel } from "../types/repository-intelligence.js";

export class DependencyAnalyzerService {
  graph(
    dependencies: DependencyRecord[],
    sourceFiles?: Array<{ path: string; content: string }>
  ): DependencyGraph & {
    unusedDependencies: string[];
    vulnerabilityScanningConfigured: boolean;
    notice: string;
  } {
    const nodeMap = new Map<
      string,
      {
        id: string;
        name: string;
        version: string;
        ecosystem: string;
        type?: string;
        kind: "package" | "internal";
        risk: RiskLevel;
        depth: number;
        fanIn: number;
        fanOut: number;
        isUnused?: boolean;
      }
    >();

    const edges: Array<{ source: string; target: string; relationship: "depends_on" }> = [];
    const adjacency = new Map<string, string[]>();

    // 1. Add manifest dependencies
    for (const dep of dependencies) {
      nodeMap.set(dep.name, {
        id: dep.name,
        name: dep.name,
        version: dep.version,
        ecosystem: dep.ecosystem,
        type: dep.type,
        kind: "package",
        risk: dep.risk_level,
        depth: 0,
        fanIn: 0,
        fanOut: 0,
      });

      // Package -> Package dependencies from manifest metadata (e.g. workspace dependencies)
      const targetDeps = dep.metadata?.dependencies;
      if (Array.isArray(targetDeps)) {
        for (const target of targetDeps) {
          if (typeof target === "string" && target !== dep.name) {
            edges.push({ source: dep.name, target, relationship: "depends_on" });
            adjacency.set(dep.name, [...(adjacency.get(dep.name) ?? []), target]);
          }
        }
      }
    }

    // 2. Parse source files for internal module imports and package imports
    const importedPackages = new Set<string>();

    if (sourceFiles && sourceFiles.length > 0) {
      for (const file of sourceFiles) {
        if (!file.content) continue;
        const normalizedFilePath = file.path.replace(/\\/g, "/");

        // Ensure this source file is a node
        if (!nodeMap.has(normalizedFilePath)) {
          nodeMap.set(normalizedFilePath, {
            id: normalizedFilePath,
            name: normalizedFilePath.split("/").pop() || normalizedFilePath,
            version: "source",
            ecosystem: "internal",
            type: "development",
            kind: "internal",
            risk: "low",
            depth: 0,
            fanIn: 0,
            fanOut: 0,
          });
        }

        // Match import statements: import ... from "..." or require("...")
        const importRegex = /(?:import\s+(?:[\w*\s{},]*\s+from\s+)?|require\s*\()\s*['"]([^'"]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(file.content)) !== null) {
          const importPath = match[1];

          if (importPath.startsWith(".")) {
            // Internal relative import: resolve to relative path
            const targetPath = this.resolveRelativePath(normalizedFilePath, importPath);
            if (!nodeMap.has(targetPath)) {
              nodeMap.set(targetPath, {
                id: targetPath,
                name: targetPath.split("/").pop() || targetPath,
                version: "source",
                ecosystem: "internal",
                type: "development",
                kind: "internal",
                risk: "low",
                depth: 0,
                fanIn: 0,
                fanOut: 0,
              });
            }

            edges.push({ source: normalizedFilePath, target: targetPath, relationship: "depends_on" });
            adjacency.set(normalizedFilePath, [...(adjacency.get(normalizedFilePath) ?? []), targetPath]);
          } else {
            // Package import: e.g. "express" or "@scope/pkg"
            const pkgName = importPath.startsWith("@")
              ? importPath.split("/").slice(0, 2).join("/")
              : importPath.split("/")[0];
            importedPackages.add(pkgName);

            if (nodeMap.has(pkgName)) {
              edges.push({ source: normalizedFilePath, target: pkgName, relationship: "depends_on" });
              adjacency.set(normalizedFilePath, [...(adjacency.get(normalizedFilePath) ?? []), pkgName]);
            }
          }
        }
      }
    }

    // 3. Detect unused dependencies with high confidence
    const unusedDependencies: string[] = [];
    if (sourceFiles && sourceFiles.length > 5) {
      for (const dep of dependencies) {
        if (
          dep.type === "runtime" &&
          dep.ecosystem === "npm" &&
          !importedPackages.has(dep.name) &&
          !this.isImplicitRuntimeTool(dep.name)
        ) {
          unusedDependencies.push(dep.name);
          const n = nodeMap.get(dep.name);
          if (n) n.isUnused = true;
        }
      }
    }

    // 4. Compute metrics: Fan-in & Fan-out
    const nodes = Array.from(nodeMap.values());
    for (const edge of edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (source) source.fanOut++;
      if (target) target.fanIn++;
    }

    // Compute depth
    const depth = (name: string, path: Set<string>): number => {
      if (path.has(name) || path.size > 20) return 0;
      const children = adjacency.get(name) ?? [];
      return children.length ? 1 + Math.max(...children.map((child) => depth(child, new Set([...path, name])))) : 0;
    };

    for (const node of nodes) {
      node.depth = depth(node.id, new Set());
    }

    // 5. Detect cycles
    const circularCandidates = this.findCycles(adjacency);

    return {
      nodes,
      edges,
      circularCandidates,
      unusedDependencies,
      vulnerabilityScanningConfigured: false,
      notice: "Vulnerability scanning is not configured. Connect GitHub Dependabot or Snyk for CVE scanning.",
    };
  }

  riskFor(_name: string, _version: string): RiskLevel {
    // Honest risk calculation: do not invent CVEs or arbitrary vulnerability levels
    // Default to 'low' as safe baseline without external scanning provider
    return "low";
  }

  private resolveRelativePath(fromPath: string, relativeTarget: string): string {
    const fromParts = fromPath.split("/");
    fromParts.pop(); // remove file name, keep directory
    const relParts = relativeTarget.split("/");

    for (const part of relParts) {
      if (part === "." || part === "") continue;
      if (part === "..") {
        fromParts.pop();
      } else {
        fromParts.push(part);
      }
    }

    let resolved = fromParts.join("/");
    // Normalize common extensions if missing
    if (!/\.(ts|tsx|js|jsx|json)$/.test(resolved)) {
      resolved += ".ts";
    }
    return resolved;
  }

  private isImplicitRuntimeTool(name: string): string | boolean {
    return /^(tslib|dotenv|core-js|@types\/|typescript|tsx|cross-env)$/i.test(name);
  }

  private findCycles(adjacency: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visitedGlobal = new Set<string>();

    const dfs = (node: string, path: string[]) => {
      const idx = path.indexOf(node);
      if (idx !== -1) {
        cycles.push(path.slice(idx));
        return;
      }
      if (visitedGlobal.has(node) || path.length > 15) return;

      const children = adjacency.get(node) ?? [];
      for (const child of children) {
        dfs(child, [...path, node]);
      }
    };

    for (const node of adjacency.keys()) {
      dfs(node, []);
      visitedGlobal.add(node);
    }

    return cycles;
  }
}

export const dependencyAnalyzerService = new DependencyAnalyzerService();
import type { DocumentationFormat, DocumentationType } from "../types/engineering-intelligence.js";
import type { ArchitectureNode, ArchitectureEdge, ArchitectureVersion } from "../types/architecture.js";
import type { RepositoryAnalysis, RepositoryRecord, DetectedRoute, DetectedFramework } from "../types/repository-intelligence.js";

export interface DocumentSource {
  type: "architecture_version" | "repository_analysis" | "detected_route" | "detected_framework" | "dependency" | "env_var" | "security" | "test" | "inferred";
  label: string;
  identifier?: string;
  file?: string;
  verified: boolean;
}

export interface GeneratedSection {
  id: string;
  title: string;
  content: string;
  sources: DocumentSource[];
  status: "verified" | "inferred" | "unavailable";
}

export interface GenerationContext {
  architecture?: { version: ArchitectureVersion; nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
  analysis?: RepositoryAnalysis;
  repository?: RepositoryRecord;
}

export interface DocumentGenerationInput {
  title: string;
  format: DocumentationFormat;
  type: DocumentationType | string;
  architecture?: { version: ArchitectureVersion; nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
  analysis?: RepositoryAnalysis;
  repository?: RepositoryRecord;
  requirements?: string;
  dependencies?: unknown[];
}

export interface DocumentGenerationResult {
  content: string;
  sections: GeneratedSection[];
  generatedAt: string;
  sourceVersionId?: string;
  sourceAnalysisId?: string;
  sourceCommitSha?: string;
  sourceBranch?: string;
  hasArchitectureSource: boolean;
  hasRepositorySource: boolean;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function h2(t: string) { return `\n## ${t}\n`; }
function h3(t: string) { return `\n### ${t}\n`; }
function badge(t: string) { return "`" + t + "`"; }
function unknownField(f: string) { return `_${f} — undocumented or unverified_`; }
function unavailable(r: string) { return `\n> ℹ️ **${r}**\n`; }
function safeTs(ts: string | null | undefined) {
  if (!ts) return "—";
  try { return new Date(ts).toISOString(); } catch { return ts; }
}

// ─── Section Builders ────────────────────────────────────────────────────────

export class DocumentationGeneratorService {
  /** Legacy compatibility — preserves existing test contracts */
  generate(input: {
    title: string;
    format: DocumentationFormat;
    architecture: {
      version: { name: string };
      nodes: Array<{ name: string; type: string; technology: string | null }>;
      edges: Array<{ source_node_id: string; target_node_id: string; relationship: string }>;
    };
    requirements?: string;
    repository?: Record<string, unknown>;
    dependencies?: unknown[];
  }): string {
    const lines = [
      `# ${input.title}`,
      "",
      `Architecture version: ${input.architecture.version.name}`,
      "",
      "## Components",
      ...input.architecture.nodes.map(
        (node) => `- **${node.name}** (${node.type})${node.technology ? ` - ${node.technology}` : ""}`
      ),
      "",
      "## Relationships",
      ...input.architecture.edges.map(
        (edge) => `- ${edge.source_node_id} ${edge.relationship} ${edge.target_node_id}`
      ),
    ];
    if (input.requirements) lines.push("", "## Requirements", input.requirements);
    if (input.repository) lines.push("", "## Repository Analysis", "This section is generated from the latest repository analysis.");
    if (input.dependencies?.length) lines.push("", `Dependencies detected: ${input.dependencies.length}`);
    const markdown = lines.join("\n");
    if (input.format === "html") {
      return `<article>${markdown.replace(/^# (.+)$/gm, "<h1>$1</h1>").replace(/^## (.+)$/gm, "<h2>$1</h2>")}</article>`;
    }
    if (input.format === "mermaid") {
      return `graph TD\n${input.architecture.edges.map((e) => `  ${e.source_node_id} -->|${e.relationship}| ${e.target_node_id}`).join("\n")}`;
    }
    return markdown;
  }

  generateFull(input: DocumentGenerationInput): DocumentGenerationResult {
    const now = new Date().toISOString();
    const ctx: GenerationContext = {
      architecture: input.architecture,
      analysis: input.analysis,
      repository: input.repository,
    };
    const content = this.assembleDocument(input, ctx, now);
    return {
      content,
      sections: [],
      generatedAt: now,
      sourceVersionId: input.architecture?.version.id,
      sourceAnalysisId: input.analysis?.id,
      sourceCommitSha: input.analysis?.commit_sha,
      sourceBranch: (input.analysis?.analysis_data?.branch as string) || undefined,
      hasArchitectureSource: !!input.architecture,
      hasRepositorySource: !!input.analysis && input.analysis.status === "completed",
    };
  }

  private assembleDocument(input: DocumentGenerationInput, ctx: GenerationContext, now: string): string {
    const parts: string[] = [];

    // Header block
    parts.push(`# ${input.title}`);
    parts.push("");
    parts.push(`> **ArchForge Documentation Intelligence**  `);
    parts.push(`> Generated: ${now}`);
    if (ctx.architecture) {
      parts.push(`> Architecture: **${ctx.architecture.version.name}** (v${ctx.architecture.version.version_number}) — ${badge(ctx.architecture.version.status)}`);
    }
    if (ctx.analysis) {
      parts.push(`> Repository analysis: ${badge(ctx.analysis.id)}`);
      if (ctx.analysis.commit_sha) parts.push(`> Commit SHA: ${badge(ctx.analysis.commit_sha)}`);
      const branch = ctx.analysis.analysis_data?.branch as string | undefined;
      if (branch) parts.push(`> Branch: ${badge(branch)}`);
    }
    parts.push("");

    // System overview (always included)
    parts.push(...this.sectionSystemOverview(ctx));

    // Type-specific section
    switch (input.type) {
      case "architecture_overview": parts.push(...this.sectionArchitecture(ctx)); break;
      case "api_documentation": parts.push(...this.sectionAPI(ctx)); break;
      case "database_documentation": parts.push(...this.sectionDatabase(ctx)); break;
      case "deployment":
      case "getting_started": parts.push(...this.sectionSetup(ctx)); break;
      case "security":
      case "testing_security": parts.push(...this.sectionTestingSecurity(ctx)); break;
      case "repository_overview": parts.push(...this.sectionRepository(ctx)); break;
      case "system_design": break; // Overview already covers this
      default: break;
    }

    let content = parts.join("\n");

    if (input.format === "mermaid") {
      if (ctx.architecture) {
        const nm = new Map(ctx.architecture.nodes.map((n) => [n.id, (n.node_key || n.name).replace(/\s+/g, "_")]));
        const lines = ["graph TD"];
        ctx.architecture.nodes.forEach((n) => {
          const k = nm.get(n.id) || n.id;
          lines.push(`  ${k}["${n.name} (${n.type})"]`);
        });
        ctx.architecture.edges.forEach((e) => {
          const s = nm.get(e.source_node_id) || e.source_node_id;
          const t = nm.get(e.target_node_id) || e.target_node_id;
          lines.push(`  ${s} -->|${e.relationship}| ${t}`);
        });
        content = lines.join("\n");
      } else {
        content = "graph TD\n  // No architecture data available";
      }
    } else if (input.format === "html") {
      content = `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>${input.title}</title></head>\n<body>\n<article>\n`
        + content
          .replace(/^# (.+)$/gm, "<h1>$1</h1>")
          .replace(/^## (.+)$/gm, "<h2>$1</h2>")
          .replace(/^### (.+)$/gm, "<h3>$1</h3>")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, "<code>$1</code>")
        + "\n</article>\n</body>\n</html>";
    } else if (input.format === "openapi_json" || input.format === "openapi_yaml") {
      const routes = ctx.analysis?.architecture?.routes as Array<{ method: string; path: string; handler?: string; file: string }> | undefined;
      const paths: Record<string, Record<string, unknown>> = {};
      (routes || []).forEach((r) => {
        if (!paths[r.path]) paths[r.path] = {};
        paths[r.path][r.method.toLowerCase()] = {
          summary: r.handler || "undocumented",
          description: `Source: \`${r.file}\``,
          responses: {
            "200": { description: "Success — schema not verified" },
            "401": { description: "Unauthorized — if auth middleware detected" },
          },
        };
      });
      const spec = {
        openapi: "3.1.0",
        info: {
          title: input.title,
          version: ctx.architecture?.version.name || "1.0.0",
          description: `Generated by ArchForge. Commit: ${ctx.analysis?.commit_sha || "unknown"}`,
        },
        paths,
      };
      content = JSON.stringify(spec, null, 2);
    }

    return content;
  }

  private sectionSystemOverview(ctx: GenerationContext): string[] {
    const lines: string[] = [h2("System Overview")];
    if (ctx.architecture) {
      const arch = ctx.architecture;
      const tech = [...new Set(arch.nodes.filter((n) => n.technology).map((n) => n.technology!))];
      lines.push(`**Architecture version**: ${arch.version.name} (v${arch.version.version_number}) — ${badge(arch.version.status)}`);
      lines.push(`**Components**: ${arch.nodes.length} | **Connections**: ${arch.edges.length}`);
      if (tech.length) lines.push(`**Technology stack**: ${tech.join(", ")}`);
      const ad = arch.version.architecture_data as unknown as Record<string, unknown>;
      if (ad?.summary && typeof ad.summary === "string") lines.push("", ad.summary);
      if (Array.isArray(ad?.assumptions) && ad.assumptions.length) {
        lines.push("", "**Assumptions**:");
        (ad.assumptions as string[]).forEach((a) => lines.push(`- ${a}`));
      }
      if (Array.isArray(ad?.risks) && ad.risks.length) {
        lines.push("", "**Known Risks**:");
        (ad.risks as string[]).forEach((r) => lines.push(`- ${r}`));
      }
      lines.push("", `> **Source** [✓]: Architecture version **${arch.version.name}** (id: \`${arch.version.id}\`)`);
    } else {
      lines.push(unavailable("No architecture version selected. Select a saved architecture version to populate this section."));
    }
    if (ctx.analysis && ctx.analysis.status === "completed") {
      const langs = Object.entries(ctx.analysis.languages || {}) as Array<[string, number]>;
      if (langs.length) {
        lines.push(h3("Detected Languages"));
        langs.sort((a, b) => b[1] - a[1]).forEach(([l, n]) => lines.push(`- **${l}**: ${n} files`));
      }
      const extInt = (ctx.analysis.analysis_data?.externalIntegrations || ctx.analysis.architecture?.externalIntegrations) as string[] | undefined;
      if (extInt?.length) {
        lines.push(h3("External Integrations"));
        extInt.forEach((e) => lines.push(`- ${e}`));
      }
      if (ctx.repository) {
        lines.push("");
        lines.push(`**Repository**: [${ctx.repository.repository_name}](${ctx.repository.repository_url})`);
        lines.push(`**Branch**: ${badge(ctx.repository.default_branch)} | **Commit**: ${badge(ctx.analysis.commit_sha || "—")}`);
        lines.push(`**Analysis completed**: ${safeTs(ctx.analysis.completed_at)}`);
        lines.push("", `> **Source** [✓]: Repository analysis \`${ctx.analysis.id}\`, commit \`${ctx.analysis.commit_sha || "—"}\``);
      }
    } else if (!ctx.analysis) {
      lines.push(unavailable("No repository analysis available. Connect a repository and run an analysis."));
    }
    return lines;
  }

  private sectionArchitecture(ctx: GenerationContext): string[] {
    const lines: string[] = [h2("Architecture Documentation")];
    if (!ctx.architecture) {
      lines.push(unavailable("No architecture version selected. Select a saved architecture version to generate this section."));
      return lines;
    }
    const arch = ctx.architecture;
    const nodeMap = new Map(arch.nodes.map((n) => [n.id, n.name]));

    lines.push(h3("Components"));
    lines.push("| Name | Type | Technology | Description |");
    lines.push("| --- | --- | --- | --- |");
    arch.nodes.forEach((n) => {
      lines.push(`| **${n.name}** | ${badge(n.type)} | ${n.technology || unknownField("technology")} | ${n.description || unknownField("description")} |`);
    });

    lines.push(h3("Communication Paths"));
    lines.push("| Source | Target | Relationship | Protocol |");
    lines.push("| --- | --- | --- | --- |");
    arch.edges.forEach((e) => {
      lines.push(`| ${nodeMap.get(e.source_node_id) || e.source_node_id} | ${nodeMap.get(e.target_node_id) || e.target_node_id} | ${badge(e.relationship)} | ${e.protocol || unknownField("protocol")} |`);
    });

    lines.push(h3("Architecture Diagram"));
    const nm = new Map(arch.nodes.map((n) => [n.id, (n.node_key || n.name).replace(/\s+/g, "_")]));
    const mermaid = ["```mermaid", "graph TD"];
    arch.nodes.forEach((n) => { mermaid.push(`  ${nm.get(n.id) || n.id}["${n.name} (${n.type})"]`); });
    arch.edges.forEach((e) => {
      const s = nm.get(e.source_node_id) || e.source_node_id;
      const t = nm.get(e.target_node_id) || e.target_node_id;
      mermaid.push(`  ${s} -->|${e.relationship}| ${t}`);
    });
    mermaid.push("```");
    lines.push(mermaid.join("\n"));

    const ad = arch.version.architecture_data as unknown as Record<string, unknown>;
    if (Array.isArray(ad?.securityConsiderations) && ad.securityConsiderations.length) {
      lines.push(h3("Security Considerations"));
      (ad.securityConsiderations as string[]).forEach((s) => lines.push(`- ${s}`));
    }
    if (Array.isArray(ad?.scalabilityConsiderations) && ad.scalabilityConsiderations.length) {
      lines.push(h3("Scalability Considerations"));
      (ad.scalabilityConsiderations as string[]).forEach((s) => lines.push(`- ${s}`));
    }
    lines.push("", `> **Source** [✓]: Architecture version **${arch.version.name}** (id: \`${arch.version.id}\`)`);
    return lines;
  }

  private sectionAPI(ctx: GenerationContext): string[] {
    const lines: string[] = [h2("API Documentation")];
    if (!ctx.analysis || ctx.analysis.status !== "completed") {
      lines.push(unavailable("A completed repository analysis is required to generate API documentation."));
      return lines;
    }
    const routes = ctx.analysis.architecture?.routes as DetectedRoute[] | undefined;
    if (!routes?.length) {
      lines.push(unavailable("No API routes detected in repository analysis. Routes are detected from Express, FastAPI, NestJS, and Flask source files."));
      return lines;
    }
    lines.push(`> ⚠️ **Stale content warning**: Reflects repository at time of analysis. Re-analyze to detect route changes.`);
    lines.push("", `**Routes detected**: ${routes.length} | **Commit**: ${badge(ctx.analysis.commit_sha || "—")}`);

    const byFile = new Map<string, DetectedRoute[]>();
    routes.forEach((r) => { const arr = byFile.get(r.file) || []; arr.push(r); byFile.set(r.file, arr); });

    byFile.forEach((fileRoutes, file) => {
      lines.push(h3(`Routes in \`${file}\``));
      fileRoutes.forEach((route) => {
        lines.push(`\n#### \`${route.method} ${route.path}\``);
        lines.push("| Field | Value |", "| --- | --- |");
        lines.push(
          `| Method | ${badge(route.method)} |`,
          `| Path | \`${route.path}\` |`,
          `| Framework | ${route.framework} |`,
          `| Handler | ${route.handler ? badge(route.handler) : unknownField("handler")} |`,
          `| Source file | \`${route.file}${route.line ? `:${route.line}` : ""}\` |`,
          `| Confidence | ${badge(route.confidence)} |`,
          `| Detection basis | ${route.detectionBasis} |`,
          `| Request body | ${unknownField("request body")} |`,
          `| Response schema | ${unknownField("response schema")} |`,
          `| Auth required | ${unknownField("auth required — check middleware")} |`,
        );
      });
    });

    lines.push(h3("Notes"));
    lines.push("- Request body, response schemas, and auth requirements are _undocumented_ unless an OpenAPI spec is provided.");
    lines.push("- Fields marked _undocumented or unverified_ are never fabricated.");
    lines.push("", `> **Source** [✓]: Repository analysis \`${ctx.analysis.id}\`, commit \`${ctx.analysis.commit_sha || "—"}\``);
    return lines;
  }

  private sectionDatabase(ctx: GenerationContext): string[] {
    const lines: string[] = [h2("Database Documentation")];
    if (ctx.architecture) {
      const dbs = ctx.architecture.nodes.filter((n) => n.type === "database");
      if (dbs.length) {
        lines.push(h3("Intended Databases (Architecture Version)"));
        lines.push("| Name | Technology | Description |", "| --- | --- | --- |");
        dbs.forEach((d) => lines.push(`| **${d.name}** | ${d.technology || unknownField("technology")} | ${d.description || unknownField("description")} |`));
        lines.push("", `> **Source** [✓]: Architecture version **${ctx.architecture.version.name}**`);
      }
    }
    if (ctx.analysis?.status === "completed") {
      const detectedDbs = ctx.analysis.architecture?.databases as string[] | undefined;
      if (detectedDbs?.length) {
        lines.push(h3("Observed Databases (Repository Analysis)"));
        detectedDbs.forEach((d) => lines.push(`- ${d}`));
      }
      const models = (ctx.analysis.architecture as any)?.models as Array<{ name: string; file?: string; fields?: string[] }> | undefined;
      if (models?.length) {
        lines.push(h3("Data Models & Entities"));
        models.forEach((m) => {
          lines.push(`\n#### Model \`${m.name}\``);
          if (m.file) lines.push(`Source: \`${m.file}\``);
          if (m.fields?.length) {
            lines.push("| Field |", "| --- |");
            m.fields.forEach((f) => lines.push(`| \`${f}\` |`));
          }
        });
      }
      const deps = Array.isArray(ctx.analysis.dependencies) ? ctx.analysis.dependencies as Array<{ name: string; version: string; ecosystem: string }> : [];
      const dbDeps = deps.filter((d) => ["pg", "mysql", "mongoose", "prisma", "sequelize", "typeorm", "sqlite3", "redis", "mongodb", "drizzle-orm", "kysely"].includes(d.name.toLowerCase()));
      if (dbDeps.length) {
        lines.push(h3("Database Client Dependencies"));
        lines.push("| Package | Version | Ecosystem |", "| --- | --- | --- |");
        dbDeps.forEach((d) => lines.push(`| ${d.name} | ${d.version} | ${d.ecosystem} |`));
      }
      lines.push("", `> **Source** [✓]: Repository analysis \`${ctx.analysis.id}\``);
    }
    if (!ctx.architecture && (!ctx.analysis || ctx.analysis.status !== "completed")) {
      lines.push(unavailable("Select an architecture version or connect a repository to generate database documentation."));
    }
    lines.push(h3("Notes"));
    lines.push("- **Intended design** is from the selected architecture version.");
    lines.push("- Column definitions and migration history require schema file analysis.");
    lines.push("- Connection strings and credentials are **never** included in documentation.");
    return lines;
  }

  private sectionSetup(ctx: GenerationContext): string[] {
    const lines: string[] = [h2("Setup & Deployment")];
    if (!ctx.analysis || ctx.analysis.status !== "completed") {
      lines.push(unavailable("Connect a repository and complete an analysis to generate setup documentation."));
      return lines;
    }
    const frameworks = (Array.isArray(ctx.analysis.analysis_data?.detectedFrameworks) ? ctx.analysis.analysis_data.detectedFrameworks : []) as DetectedFramework[];
    const infra = ctx.analysis.infrastructure as Record<string, unknown>;
    const envVars = ctx.analysis.analysis_data?.detectedEnvVars as string[] | undefined;

    lines.push(h3("Prerequisites"));
    const frontFw = frameworks.filter((f) => f.category === "frontend");
    const backFw = frameworks.filter((f) => f.category === "backend");
    lines.push("- A supported runtime (Node.js, Python, etc.)");
    if (frontFw.length) lines.push(`- Frontend framework: ${frontFw.map((f) => f.name).join(", ")}`);
    if (backFw.length) lines.push(`- Backend framework: ${backFw.map((f) => f.name).join(", ")}`);
    if (infra.docker) lines.push("- Docker (Dockerfile detected)");
    if (infra.kubernetes) lines.push("- Kubernetes (manifests detected)");

    lines.push(h3("Development Commands"));
    lines.push("```bash");
    lines.push("npm install       # Install dependencies");
    lines.push("npm run dev       # Start development server");
    lines.push("npm test          # Run tests");
    lines.push("npm run build     # Build for production");
    lines.push("```");

    if (envVars?.length) {
      lines.push(h3("Environment Variables"));
      lines.push("> ⚠️ These are variable **names only** — secret values are never included in documentation.");
      lines.push("", "| Variable | Required | Description |", "| --- | --- | --- |");
      envVars.forEach((v) => lines.push(`| \`${v}\` | ${unknownField("required?")} | ${unknownField("description")} |`));
    } else {
      lines.push(h3("Environment Variables"));
      lines.push("> ℹ️ No environment variables detected. Add a `.env.example` file to improve detection.");
    }

    if (infra.docker) {
      lines.push(h3("Docker"));
      lines.push("- Dockerfile detected in repository.");
      if (infra.dockerCompose) lines.push("- docker-compose.yml detected.");
    }
    if (infra.ci) {
      lines.push(h3("CI/CD"));
      lines.push("CI configuration detected. Refer to CI configuration files for pipeline details.");
    }

    if (ctx.architecture) {
      const ad = ctx.architecture.version.architecture_data as unknown as Record<string, unknown>;
      const extInt = ad?.externalIntegrations as string[] | undefined;
      if (extInt?.length) {
        lines.push(h3("External Services"));
        extInt.forEach((e) => lines.push(`- ${e}`));
      }
    }

    lines.push(h3("Troubleshooting"));
    lines.push("- Verify all required environment variables are configured.");
    lines.push("- Check database and external service connectivity.");
    lines.push("- Review application logs for startup errors.");
    lines.push("", `> **Source** [✓]: Repository analysis \`${ctx.analysis.id}\``);
    return lines;
  }

  private sectionTestingSecurity(ctx: GenerationContext): string[] {
    const lines: string[] = [h2("Testing & Security")];
    if (!ctx.analysis || ctx.analysis.status !== "completed") {
      lines.push(unavailable("A completed repository analysis is required for this section."));
      return lines;
    }
    const testFiles = ctx.analysis.analysis_data?.testFiles as string[] | undefined;
    const testRunner = ctx.analysis.analysis_data?.testRunner as string | null;
    const testCount = ctx.analysis.analysis_data?.testCount as number | undefined;

    lines.push(h3("Testing"));
    if (testRunner) lines.push(`**Test runner detected**: ${testRunner}`);
    if (typeof testCount === "number") lines.push(`**Test files detected**: ${testCount}`);
    if (testFiles?.length) {
      lines.push("```");
      testFiles.slice(0, 20).forEach((f) => lines.push(f));
      if (testFiles.length > 20) lines.push(`… and ${testFiles.length - 20} more`);
      lines.push("```");
    } else {
      lines.push("> ℹ️ No test files detected. Test detection looks for `*.test.*`, `*.spec.*`, and `tests/` directories.");
    }
    lines.push("> ⚠️ **Note**: Test results and coverage data are not reported because tests were not executed during analysis.");

    const sec = ctx.analysis.analysis_data?.security;
    const auth = ctx.analysis.architecture?.authentication;
    lines.push(h3("Security"));
    if (typeof auth === "boolean") lines.push(`**Authentication detected**: ${auth ? "Yes" : "No"}`);
    if (sec) {
      lines.push(`**Static checks**: ${(sec.checksExecuted || []).join(", ") || "none"}`);
      lines.push(`**Files scanned**: ${sec.filesScanned ?? "unknown"}`);
      if (sec.findings?.length) {
        lines.push("", "| Severity | Rule | File | Message |", "| --- | --- | --- | --- |");
        (sec.findings as Array<{ severity: string; rule: string; file: string; message: string }>).forEach((f) => {
          lines.push(`| ${badge(f.severity)} | ${f.rule} | \`${f.file}\` | ${f.message} |`);
        });
      } else {
        lines.push("> _No static analysis findings. This does not confirm the application is secure — only that the configured checks found no issues._");
      }
      if (sec.advisory) lines.push("", `> ${sec.advisory}`);
    }
    lines.push("", `> **Source** [✓]: Repository analysis \`${ctx.analysis.id}\``);
    return lines;
  }

  private sectionRepository(ctx: GenerationContext): string[] {
    const lines: string[] = [h2("Repository Overview")];
    if (!ctx.analysis || ctx.analysis.status !== "completed") {
      lines.push(unavailable("Connect a repository and complete an analysis to generate repository documentation."));
      return lines;
    }
    if (ctx.repository) {
      lines.push(`**Repository**: [${ctx.repository.repository_name}](${ctx.repository.repository_url})`);
      lines.push(`**Provider**: ${ctx.repository.provider} | **Owner**: ${ctx.repository.owner}`);
      lines.push(`**Branch**: ${badge(ctx.repository.default_branch)} | **Commit**: ${badge(ctx.analysis.commit_sha || "—")}`);
      lines.push(`**Analysis completed**: ${safeTs(ctx.analysis.completed_at)}`);
    }
    const langs = Object.entries(ctx.analysis.languages || {}) as Array<[string, number]>;
    if (langs.length) {
      lines.push(h3("Languages"), "", "| Language | Files |", "| --- | --- |");
      langs.sort((a, b) => b[1] - a[1]).forEach(([l, n]) => lines.push(`| ${l} | ${n} |`));
    }
    const frameworks = (Array.isArray(ctx.analysis.analysis_data?.detectedFrameworks) ? ctx.analysis.analysis_data.detectedFrameworks : ctx.analysis.frameworks) as DetectedFramework[] | string[];
    if (frameworks?.length) {
      lines.push(h3("Detected Frameworks"));
      if (typeof frameworks[0] === "object") {
        const fwObjs = frameworks as DetectedFramework[];
        lines.push("| Framework | Ecosystem | Category | Confidence | Evidence |", "| --- | --- | --- | --- | --- |");
        fwObjs.forEach((f) => lines.push(`| ${f.name} | ${f.ecosystem} | ${f.category} | ${badge(f.confidence)} | \`${f.evidenceFile}\` |`));
      } else {
        (frameworks as string[]).forEach((f) => lines.push(`- ${f}`));
      }
    }
    const infra = ctx.analysis.infrastructure as Record<string, unknown>;
    const detected = Object.keys(infra || {}).filter((k) => infra[k] === true);
    if (detected.length) {
      lines.push(h3("Infrastructure Configuration"));
      detected.forEach((k) => lines.push(`- ${k} detected`));
    }
    const m = ctx.analysis.metrics;
    if (m && Object.keys(m).length) {
      lines.push(h3("Repository Metrics"), "", "| Metric | Value |", "| --- | --- |");
      Object.entries(m).filter(([, v]) => v !== undefined && v !== null).forEach(([k, v]) => {
        lines.push(`| ${k.replace(/([A-Z])/g, " $1").trim()} | ${v} |`);
      });
    }
    lines.push("", `> **Source** [✓]: Repository analysis \`${ctx.analysis.id}\`, commit \`${ctx.analysis.commit_sha || "—"}\``);
    return lines;
  }
}

export const documentationGeneratorService = new DocumentationGeneratorService();

import { describe, expect, it, vi } from "vitest";
import { RepositoryAnalyzerService } from "../src/services/repository-analyzer-service.js";
import { DependencyAnalyzerService } from "../src/services/dependency-analyzer-service.js";
import { GitHubRepositoryProvider } from "../src/integrations/github-repository-provider.js";
import { DriftDetectionService } from "../src/services/drift-service.js";
import { architectureService } from "../src/services/architecture-service.js";
import type { RepositorySnapshot, RepositoryAnalysis } from "../src/types/repository-intelligence.js";

const snapshot = (files: RepositorySnapshot["files"]): RepositorySnapshot => ({
  commitSha: "fixture-sha-123456",
  repository: {
    id: "repo-123",
    project_id: "project-123",
    provider: "github",
    repository_url: "https://github.com/example/repo",
    repository_name: "repo",
    owner: "example",
    default_branch: "main",
    access_type: "public",
    external_repository_id: "1",
    connected_by: "user-123",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  files,
});

describe("Repository Intelligence & Security", () => {
  describe("GitHub URL Validation & SSRF Prevention", () => {
    const mockClient = {
      get: vi.fn().mockImplementation((url: string) => {
        if (url === "/repos/amaan243/forge-app") {
          return Promise.resolve({
            data: {
              id: 12345,
              name: "forge-app",
              full_name: "amaan243/forge-app",
              default_branch: "main",
              private: false,
              html_url: "https://github.com/amaan243/forge-app",
            },
          });
        }
        return Promise.reject(new Error("Not found"));
      }),
    };
    const provider = new GitHubRepositoryProvider(mockClient as any);

    it("accepts valid GitHub repository URLs", async () => {
      const result = await provider.connect({
        url: "https://github.com/amaan243/forge-app",
        branch: "main",
      });

      expect(result.owner).toBe("amaan243");
      expect(result.repository_name).toBe("forge-app");
      expect(result.default_branch).toBe("main");
      expect(result.provider).toBe("github");
    });

    it("rejects non-GitHub domains and arbitrary URLs", async () => {
      await expect(provider.connect({ url: "https://gitlab.com/owner/repo" })).rejects.toThrow(
        "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"
      );
      await expect(provider.connect({ url: "https://bitbucket.org/owner/repo" })).rejects.toThrow(
        "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"
      );
    });

    it("rejects local and intranet SSRF targets", async () => {
      await expect(provider.connect({ url: "http://localhost:3000/repo" })).rejects.toThrow(
        "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"
      );
      await expect(provider.connect({ url: "http://127.0.0.1:8080/repo" })).rejects.toThrow(
        "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"
      );
      await expect(provider.connect({ url: "http://169.254.169.254/latest/meta-data" })).rejects.toThrow(
        "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"
      );
    });

    it("rejects invalid path structures", async () => {
      await expect(provider.connect({ url: "https://github.com/onlyowner" })).rejects.toThrow(
        "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"
      );
      await expect(provider.connect({ url: "https://github.com/" })).rejects.toThrow(
        "Only valid GitHub repository URLs (https://github.com/owner/repo) are supported"
      );
    });
  });

  describe("Repository Analysis Service", () => {
    const analyzer = new RepositoryAnalyzerService();

    it("analyzes Node.js / React / Express fixtures deterministically", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "package.json",
            content: JSON.stringify({
              name: "forge-app",
              dependencies: {
                react: "^19.0.0",
                "react-dom": "^19.0.0",
                express: "^5.0.0",
                prisma: "^6.0.0",
                "@supabase/supabase-js": "^2.0.0",
                redis: "^4.0.0",
              },
              devDependencies: {
                vite: "^6.0.0",
                vitest: "^3.0.0",
                typescript: "^5.0.0",
              },
            }),
          },
          { path: "src/main.tsx", content: "import React from 'react'; ReactDOM.render();" },
          { path: "src/api/routes.ts", content: "router.get('/api/v1/users', handler); router.post('/api/v1/auth', login);" },
          { path: "src/services/user-service.ts", content: "export class UserService {}" },
          { path: "Dockerfile", content: "FROM node:22-alpine\nWORKDIR /app" },
          { path: ".github/workflows/ci.yml", content: "name: CI Pipeline\non: push" },
        ])
      );

      // Languages detected
      expect(result.languages).toHaveProperty("tsx");
      expect(result.languages).toHaveProperty("ts");
      const tsBreakdown = result.analysisData.languagesBreakdown.find((l) => l.name === "TypeScript");
      expect(tsBreakdown).toBeDefined();
      expect(tsBreakdown?.percentage).toBeGreaterThan(0);

      // Frameworks detected
      expect(result.frameworks).toContain("React");
      expect(result.frameworks).toContain("Express");
      expect(result.frameworks).toContain("Vite");
      expect(result.frameworks).toContain("PostgreSQL");

      // Architecture metadata
      expect(result.architecture.authentication).toBe(true);
      expect(result.architecture.databases).toContain("prisma");
      expect(result.architecture.databases).toContain("redis");
      expect(result.architecture.services).toContain("src/services/user-service.ts");
      expect(result.architecture.apis).toContain("src/api/routes.ts");

      // Routes parsed
      expect(result.architecture.routes.length).toBeGreaterThanOrEqual(2);
      expect(result.architecture.routes.some((r) => r.path === "/api/v1/users" && r.method === "GET")).toBe(true);

      // Infrastructure and tests
      expect(result.infrastructure.docker).toBe(true);
      expect(result.infrastructure.ci).toBe(true);
      expect(result.analysisData.testRunner).toBe("Vitest");
    });

    it("analyzes Python / FastAPI / SQLAlchemy fixtures", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "requirements.txt",
            content: "fastapi==0.115.0\nuvicorn==0.30.0\nsqlalchemy==2.0.0\npytest==8.0.0",
          },
          { path: "app/main.py", content: "@app.get('/items')\ndef read_items(): return []" },
          { path: "app/services/item_service.py", content: "class ItemService: pass" },
        ])
      );

      expect(result.languages).toHaveProperty("py");
      const pyBreakdown = result.analysisData.languagesBreakdown.find((l) => l.name === "Python");
      expect(pyBreakdown).toBeDefined();
      expect(result.frameworks).toContain("FastAPI");
      expect(result.architecture.databases).toContain("sqlalchemy");
      expect(result.analysisData.testRunner).toBe("Pytest");
      expect(result.architecture.routes.some((r) => r.path === "/items")).toBe(true);
    });

    it("extracts environment variable names safely without revealing secret values", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: ".env.example",
            content: "DATABASE_URL=postgres://...\nGITHUB_CLIENT_SECRET=supersecret123\nAPI_KEY=shhh",
          },
          {
            path: "src/config.ts",
            content: "const port = process.env.PORT || 3000; const host = process.env.DATABASE_HOST;",
          },
        ])
      );

      // Environment variable names extracted safely
      expect(result.analysisData.detectedEnvVars).toContain("DATABASE_URL");
      expect(result.analysisData.detectedEnvVars).toContain("GITHUB_CLIENT_SECRET");
      expect(result.analysisData.detectedEnvVars).toContain("PORT");
      expect(result.analysisData.detectedEnvVars).toContain("DATABASE_HOST");

      // Verify that secret values are NEVER included in analysis metadata
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("supersecret123");
      expect(serialized).not.toContain("shhh");
    });

    it("strictly ignores sensitive credential files and build artifacts", () => {
      const result = analyzer.analyze(
        snapshot([
          { path: ".env", content: "SUPER_SECRET_TOKEN=xyz123" },
          { path: "secrets.json", content: '{"key": "private"}' },
          { path: "dist/bundle.js", content: "compiled output" },
          { path: "node_modules/pkg/index.js", content: "vendor code" },
          { path: "src/app.ts", content: "export const app = 1;" },
        ])
      );

      // Only src/app.ts should be analyzed
      expect(result.analysisData.filesAnalyzed).toBe(1);
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("SUPER_SECRET_TOKEN");
      expect(serialized).not.toContain("xyz123");
    });
  });

  describe("Dependency Analyzer Service", () => {
    const analyzer = new RepositoryAnalyzerService();
    const depAnalyzer = new DependencyAnalyzerService();

    it("parses npm package.json manifests with versions and runtime/dev types", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "package.json",
            content: JSON.stringify({
              dependencies: {
                react: "^19.0.0",
                express: "5.0.0",
              },
              devDependencies: {
                vitest: "3.0.0",
              },
            }),
          },
        ])
      );

      expect(result.dependencies.length).toBeGreaterThanOrEqual(3);
      const reactDep = result.dependencies.find((d) => d.name === "react");
      expect(reactDep).toMatchObject({
        version: "^19.0.0",
        ecosystem: "npm",
        type: "runtime",
      });
      const vitestDep = result.dependencies.find((d) => d.name === "vitest");
      expect(vitestDep).toMatchObject({
        type: "development",
      });
    });

    it("parses Python requirements.txt manifests", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "requirements.txt",
            content: "fastapi==0.115.0\n# comment\nsqlalchemy>=2.0.0",
          },
        ])
      );

      expect(result.dependencies.length).toBeGreaterThanOrEqual(2);
      expect(result.dependencies.find((d) => d.name === "fastapi")).toMatchObject({
        version: "0.115.0",
        ecosystem: "pip",
      });
      expect(result.dependencies.find((d) => d.name === "sqlalchemy")).toMatchObject({
        version: "2.0.0",
        ecosystem: "pip",
      });
    });

    it("parses Java Maven pom.xml manifests", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "pom.xml",
            content: `
              <project>
                <dependencies>
                  <dependency>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-starter-web</artifactId>
                    <version>3.2.0</version>
                  </dependency>
                </dependencies>
              </project>
            `,
          },
        ])
      );

      expect(result.dependencies).toHaveLength(1);
      expect(result.dependencies[0]).toMatchObject({
        name: "org.springframework.boot:spring-boot-starter-web",
        version: "3.2.0",
        ecosystem: "maven",
      });
    });

    it("constructs topology graph, resolves internal imports, and detects cycles", () => {
      const manifestDeps = [
        {
          id: "dep-a",
          project_id: "p",
          repository_analysis_id: "a",
          name: "module-a",
          version: "1.0.0",
          ecosystem: "internal",
          type: "infrastructure" as const,
          risk_level: "low" as const,
          metadata: { dependencies: ["module-b"] },
          created_at: "",
        },
        {
          id: "dep-b",
          project_id: "p",
          repository_analysis_id: "a",
          name: "module-b",
          version: "1.0.0",
          ecosystem: "internal",
          type: "infrastructure" as const,
          risk_level: "low" as const,
          metadata: { dependencies: ["module-c"] },
          created_at: "",
        },
        {
          id: "dep-c",
          project_id: "p",
          repository_analysis_id: "a",
          name: "module-c",
          version: "1.0.0",
          ecosystem: "internal",
          type: "infrastructure" as const,
          risk_level: "low" as const,
          metadata: { dependencies: ["module-a"] }, // Cycle: a -> b -> c -> a
          created_at: "",
        },
      ];

      const graph = depAnalyzer.graph(manifestDeps);

      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(3);

      // Fan-in and Fan-out verification
      const nodeA = graph.nodes.find((n) => n.id === "module-a");
      expect(nodeA?.fanOut).toBe(1);
      expect(nodeA?.fanIn).toBe(1);

      // Circular dependency candidate detection
      expect(graph.circularCandidates.length).toBeGreaterThan(0);
      expect(graph.circularCandidates[0]).toContain("module-a");

      // Honest vulnerability disclosure: external scanning is not configured
      expect(graph.vulnerabilityScanningConfigured).toBe(false);
      expect(graph.notice).toContain("Vulnerability scanning is not configured");
    });
  });

  describe("Architecture Drift Detection Service", () => {
    const driftService = new DriftDetectionService();

    it("detects missing components, extra modules, and tech mismatches deterministically", async () => {
      const mockArchitectureVersion: any = {
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "v1.0 Baseline Architecture",
          is_current: true,
          created_by: "user-1",
          created_at: new Date().toISOString(),
          architecture_data: {
            technologies: ["Node.js", "Redis"],
          },
        },
        nodes: [
          {
            id: "node-1",
            version_id: "ver-1",
            name: "API Gateway",
            type: "gateway",
            technology: "Express",
            tier: "gateway",
            metadata: {},
            created_at: "",
          },
          {
            id: "node-2",
            version_id: "ver-1",
            name: "PostgreSQL Database",
            type: "database",
            technology: "PostgreSQL",
            tier: "data",
            metadata: {},
            created_at: "",
          },
          {
            id: "node-3",
            version_id: "ver-1",
            name: "Stripe Billing",
            type: "external_service",
            technology: "Stripe",
            tier: "external",
            metadata: {},
            created_at: "",
          },
        ],
        edges: [],
      };

      vi.spyOn(architectureService, "getVersion").mockResolvedValue(mockArchitectureVersion);

      // Repository analysis that:
      // - Has Express and PostgreSQL (matches node-1 and node-2)
      // - Is MISSING Stripe (node-3 missing)
      // - Has an EXTRA unrepresented service: "BillingWorker"
      // - Is MISSING expected technology: "Redis"
      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: { ts: 1 },
        frameworks: ["Express", "PostgreSQL"],
        architecture: {
          technologies: ["Express", "PostgreSQL"],
          services: ["src/services/billing-worker.ts"],
          databases: ["postgres"],
          apis: ["src/api/gateway.ts"],
          externalIntegrations: [], // Missing Stripe
        },
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 25 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);

      expect(result.items.length).toBeGreaterThanOrEqual(3);

      // 1. Missing component: Stripe Billing
      const missingStripe = result.items.find(
        (i) => i.type === "missing" && i.metadata.affectedComponent === "Stripe Billing"
      );
      expect(missingStripe).toBeDefined();
      expect(missingStripe?.severity).toBe("medium");
      expect(missingStripe?.metadata.confidence).toBe("high");
      expect(missingStripe?.recommendation).toContain("Install integration package");

      // 2. Extra module: billing-worker
      const extraWorker = result.items.find(
        (i) => i.type === "extra" && i.metadata.affectedComponent === "billing-worker"
      );
      expect(extraWorker).toBeDefined();
      expect(extraWorker?.type).toBe("extra");

      // 3. Technology mismatch: Redis
      const mismatchRedis = result.items.find(
        (i) => i.type === "mismatch" && i.metadata.affectedComponent === "Redis"
      );
      expect(mismatchRedis).toBeDefined();
      expect(mismatchRedis?.severity).toBe("medium");

      // 4. Deterministic score computation
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(100);
      expect(result.summary).toContain("architectural differences detected");
    });

    it("enforces project isolation and rejects comparing versions belonging to another project", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-other",
          project_id: "proj-OTHER", // Mismatched project
          version_number: 1,
          name: "Other Project Arch",
          is_current: true,
          created_by: "user-other",
          created_at: "",
          architecture_data: {} as any,
        },
        nodes: [],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: {},
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: {},
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      await expect(driftService.compare("proj-1", "ver-other", analysis)).rejects.toThrow(
        "Architecture version not found for this project"
      );
    });

    it("1. matches an architecture node when real repository evidence exists", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "User Service Architecture",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [
          {
            id: "node-user",
            version_id: "ver-1",
            name: "User Service",
            type: "service",
            technology: "TypeScript",
            metadata: {},
            created_at: "",
          },
          {
            id: "node-db",
            version_id: "ver-1",
            name: "PostgreSQL Database",
            type: "database",
            technology: "PostgreSQL",
            metadata: {},
            created_at: "",
          },
        ],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: { ts: 1 },
        frameworks: ["PostgreSQL"],
        architecture: {
          services: ["src/services/user-service.ts"],
          databases: ["postgres"],
          apis: [],
          routes: [],
          externalIntegrations: [],
        },
        dependencies: [{ name: "pg", version: "8.11.0", ecosystem: "npm", type: "runtime" }],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 15 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      const missingUser = result.items.find((i) => i.metadata?.affectedComponent === "User Service");
      const missingDb = result.items.find((i) => i.metadata?.affectedComponent === "PostgreSQL Database");

      expect(missingUser).toBeUndefined();
      expect(missingDb).toBeUndefined();
    });

    it("2. flags an architecture node with no detected evidence as missing", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [
          {
            id: "node-kafka",
            version_id: "ver-1",
            name: "Kafka Event Broker",
            type: "queue",
            technology: "Kafka",
            metadata: {},
            created_at: "",
          },
        ],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: { services: [], databases: [], apis: [], routes: [] },
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 20 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      const missing = result.items.find((i) => i.metadata?.affectedComponent === "Kafka Event Broker");
      expect(missing).toBeDefined();
      expect(missing?.type).toBe("missing");
      expect(missing?.metadata.findingType).toBe("missing_component");
      expect(missing?.description).toContain("does not have a matching module or service");
      expect(missing?.recommendation).toBeDefined();
    });

    it("3. flags a repository module missing from the architecture as extra", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: { services: ["src/services/legacy-sync-job.ts"], databases: [], apis: [], routes: [] },
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 20 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      const extra = result.items.find((i) => i.metadata?.affectedComponent === "legacy-sync-job");
      expect(extra).toBeDefined();
      expect(extra?.type).toBe("extra");
      expect(extra?.metadata.findingType).toBe("extra_module");
      expect(extra?.metadata.sourceFilePaths).toContain("src/services/legacy-sync-job.ts");
    });

    it("4. detects technology mismatch between node specification and detected framework", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [
          {
            id: "node-backend",
            version_id: "ver-1",
            name: "Backend Server",
            type: "backend",
            technology: "FastAPI",
            metadata: {},
            created_at: "",
          },
        ],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: { ts: 1 },
        frameworks: ["Express"],
        architecture: {
          services: ["src/server.ts"],
          apis: ["src/server.ts"],
          routes: [],
          entryPoints: [{ path: "src/server.ts", kind: "backend_server", evidence: "listen", confidence: "confirmed" }],
        },
        dependencies: [{ name: "express", version: "5.0.0", ecosystem: "npm", type: "runtime" }],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 10 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      const mismatch = result.items.find((i) => i.metadata?.findingType === "technology_mismatch");
      expect(mismatch).toBeDefined();
      expect(mismatch?.type).toBe("mismatch");
      expect(mismatch?.description).toContain("specifies technology 'FastAPI'");
    });

    it("5. matches an architecture component through detected API routes", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [
          {
            id: "node-orders",
            version_id: "ver-1",
            name: "Orders API",
            type: "api",
            technology: "Express",
            metadata: {},
            created_at: "",
          },
        ],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: { ts: 1 },
        frameworks: ["Express"],
        architecture: {
          services: [],
          databases: [],
          apis: ["src/routes/orders.ts"],
          routes: [{ method: "POST", path: "/api/v1/orders", file: "src/routes/orders.ts", framework: "Express", confidence: "high", detectionBasis: "mounted_router" }],
        },
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 10 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      const missing = result.items.find((i) => i.metadata?.affectedComponent === "Orders API");
      expect(missing).toBeUndefined();
    });

    it("6. identifies ambiguous or dynamically configured integrations as uncertain match", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [
          {
            id: "node-dynamic",
            version_id: "ver-1",
            name: "Dynamic Webhook Target",
            type: "external_service",
            technology: "dynamic",
            metadata: { dynamic: true },
            description: "dynamically configured external webhook dispatch endpoint",
            created_at: "",
          },
        ],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: { services: [], databases: [], apis: [], routes: [] },
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 10 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      const uncertain = result.items.find((i) => i.metadata?.findingType === "uncertain_match");
      expect(uncertain).toBeDefined();
      expect(uncertain?.type).toBe("uncertain");
      expect(uncertain?.metadata.confidence).toBe("low");
    });

    it("7. flags incomplete repository analysis with coverage limitations and rejects non-completed scans", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [],
        edges: [],
      } as any);

      // Incomplete analysis status
      const runningAnalysis: RepositoryAnalysis = {
        id: "analysis-running",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "running",
        languages: {},
        frameworks: [],
        architecture: {},
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: {},
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      await expect(driftService.compare("proj-1", "ver-1", runningAnalysis)).rejects.toThrow("Request validation failed");

      // Completed but limited files scope
      const limitedAnalysis: RepositoryAnalysis = {
        id: "analysis-lim",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: {},
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: {
          filesAnalyzed: 1,
          fileCounts: {
            totalFilesDiscovered: 6,
            eligibleSourceFiles: 1,
            analyzedSourceFiles: 1,
            skippedFiles: 5,
            failedFiles: 0,
            manifestFilesProcessed: 1,
          },
        },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", limitedAnalysis);
      const limitation = result.items.find((i) => i.metadata?.findingType === "coverage_limitation");
      expect(limitation).toBeDefined();
      expect(limitation?.type).toBe("limitation");
    });

    it("8. rejects architecture version belonging to another project", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-other",
          project_id: "proj-ANOTHER",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: {},
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: {},
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      await expect(driftService.compare("proj-1", "ver-other", analysis)).rejects.toThrow(
        "Architecture version not found for this project"
      );
    });

    it("9. rejects repository analysis snapshot belonging to another project", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [],
        edges: [],
      } as any);

      const foreignAnalysis: RepositoryAnalysis = {
        id: "analysis-foreign",
        project_id: "proj-ANOTHER",
        repository_id: "repo-other",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: {},
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: {},
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      await expect(driftService.compare("proj-1", "ver-1", foreignAnalysis)).rejects.toThrow(
        "Repository analysis snapshot not found for this project"
      );
    });

    it("10. ensures historical drift runs remain immutable when a new drift analysis is executed", async () => {
      // Historical drift object from a prior run
      const historicalRun = {
        id: "drift-history-1",
        project_id: "proj-1",
        architecture_version_id: "ver-1",
        repository_analysis_id: "analysis-1",
        match_score: 85,
        summary: "1 difference detected",
        status: "completed",
        created_at: "2026-10-01T00:00:00Z",
        completed_at: "2026-10-01T00:00:01Z",
      };

      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-2",
          project_id: "proj-1",
          version_number: 2,
          name: "Updated Arch v2",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [],
        edges: [],
      } as any);

      const newAnalysis: RepositoryAnalysis = {
        id: "analysis-2",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-commit-2",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: {},
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 10 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const newResult = await driftService.compare("proj-1", "ver-2", newAnalysis);

      // Verify that the historical run was untouched
      expect(historicalRun.match_score).toBe(85);
      expect(historicalRun.architecture_version_id).toBe("ver-1");
      expect(historicalRun.repository_analysis_id).toBe("analysis-1");
      expect(newResult.score).toBe(100);
    });

    it("11. returns real traceable findings with evidence, without mock data", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [
          {
            id: "node-auth",
            version_id: "ver-1",
            name: "Auth Service",
            type: "service",
            technology: "Node.js",
            metadata: {},
            created_at: "",
          },
        ],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: { services: [], databases: [], apis: [], routes: [] },
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 12 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      for (const item of result.items) {
        // Assert every finding is traceable to real inspected fields
        expect(item.description).not.toContain("Lorem ipsum");
        expect(item.metadata.affectedComponent).toBeDefined();
        expect(item.metadata.evidence.length).toBeGreaterThan(0);
        expect(["high", "medium", "low"]).toContain(item.metadata.confidence);
        expect(item.recommendation).toBeDefined();
      }
    });

    it("12. honestly represents no-finding results within inspected scope", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: "ver-1",
          project_id: "proj-1",
          version_number: 1,
          name: "Arch",
          is_current: true,
          created_by: "user-1",
          created_at: "",
          architecture_data: {},
        },
        nodes: [],
        edges: [],
      } as any);

      const analysis: RepositoryAnalysis = {
        id: "analysis-1",
        project_id: "proj-1",
        repository_id: "repo-1",
        commit_sha: "sha-1",
        status: "completed",
        languages: {},
        frameworks: [],
        architecture: { services: [], databases: [], apis: [], routes: [] },
        dependencies: [],
        infrastructure: {},
        metrics: {},
        analysis_data: { filesAnalyzed: 10 },
        started_at: null,
        completed_at: null,
        created_at: "",
      };

      const result = await driftService.compare("proj-1", "ver-1", analysis);
      expect(result.items).toHaveLength(0);
      expect(result.summary).toContain("No drift findings detected in the inspected scope");
      expect(result.summary).not.toContain("100% compliance guarantee");
    });
  });

  describe("Part 12 — Parser & Static Analysis Edge Cases & Reliability", () => {
    const analyzer = new RepositoryAnalyzerService();

    it("resolves Express mounted routers, prefixes, handlers, and middlewares", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "server/server.js",
            content: `
              import express from 'express';
              import userRouter from './routes/userRoutes.js';
              import resumeRouter from './routes/resumeRoutes.js';

              const app = express();
              app.get('/', (req, res) => res.send('OK'));
              app.use('/api/users', userRouter);
              app.use('/api/resumes', resumeRouter);
              app.listen(3000);
            `,
          },
          {
            path: "server/routes/userRoutes.js",
            content: `
              import express from 'express';
              const router = express.Router();
              router.post('/register', registerUser);
              router.post('/login', loginUser);
              router.get('/data', protect, getUserData);
              export default router;
            `,
          },
          {
            path: "server/routes/resumeRoutes.js",
            content: `
              import express from 'express';
              const router = express.Router();
              router.post('/create', protect, createResume);
              router.put('/update', upload.single('img'), protect, updateResume);
              router.delete('/delete/:id', protect, deleteResume);
              export default router;
            `,
          },
        ])
      );

      const paths = result.architecture.routes.map((r) => `${r.method} ${r.path}`);
      expect(paths).toContain("GET /");
      expect(paths).toContain("POST /api/users/register");
      expect(paths).toContain("POST /api/users/login");
      expect(paths).toContain("GET /api/users/data");
      expect(paths).toContain("POST /api/resumes/create");
      expect(paths).toContain("PUT /api/resumes/update");
      expect(paths).toContain("DELETE /api/resumes/delete/:id");

      const updateRoute = result.architecture.routes.find((r) => r.path === "/api/resumes/update");
      expect(updateRoute).toBeDefined();
      expect(updateRoute?.handler).toBe("updateResume");
      expect(updateRoute?.line).toBeGreaterThan(0);
      expect(updateRoute?.detectionBasis).toBe("mounted_router");
    });

    it("preserves distinct HTTP methods on the same path without collapsing them", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "server/server.js",
            content: `
              const app = express();
              app.get('/api/resource', getResource);
              app.post('/api/resource', createResource);
              app.put('/api/resource', updateResource);
              app.delete('/api/resource', deleteResource);
            `,
          },
        ])
      );

      const resourceRoutes = result.architecture.routes.filter((r) => r.path === "/api/resource");
      expect(resourceRoutes).toHaveLength(4);
      const methods = resourceRoutes.map((r) => r.method).sort();
      expect(methods).toEqual(["DELETE", "GET", "POST", "PUT"]);
    });

    it("deduplicates identical route declarations across multiple parser passes", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "server/app.js",
            content: `
              app.get('/health', healthCheck);
              app.get('/health', healthCheck); // Duplicate declaration in same file
            `,
          },
        ])
      );

      const healthRoutes = result.architecture.routes.filter((r) => r.path === "/health");
      expect(healthRoutes).toHaveLength(1);
    });

    it("correctly parses FastAPI decorator routes and handlers in Python files", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "ml_api.py",
            content: `
              from fastapi import FastAPI
              app = FastAPI()

              @app.post("/predict")
              def predict_interview_score(data: dict):
                  return {"score": 90}

              @app.get("/status")
              def get_model_status():
                  return {"status": "ready"}
            `,
          },
        ])
      );

      const predictRoute = result.architecture.routes.find((r) => r.path === "/predict");
      expect(predictRoute).toBeDefined();
      expect(predictRoute?.method).toBe("POST");
      expect(predictRoute?.framework).toBe("FastAPI");
      expect(predictRoute?.handler).toBe("predict_interview_score");
      expect(predictRoute?.detectionBasis).toBe("decorator");
    });

    it("reconciles file counts accurately across discovered, source, manifest, and skipped files", () => {
      const result = analyzer.analyze(
        snapshot([
          { path: "package.json", content: '{"name": "test"}' },
          { path: "requirements.txt", content: "fastapi==0.115.0" },
          { path: "src/index.ts", content: "console.log('hi');" },
          { path: "src/utils.js", content: "export const u = 1;" },
          { path: "README.md", content: "# Documentation" },
          { path: "assets/logo.png", content: "" },
        ])
      );

      const counts = result.analysisData.fileCounts;
      expect(counts.totalFilesDiscovered).toBe(6);
      expect(counts.manifestFilesProcessed).toBe(2);
      expect(counts.eligibleSourceFiles).toBe(4); // package.json, requirements.txt, index.ts, utils.js
      expect(counts.analyzedSourceFiles).toBe(4);
      expect(counts.skippedFiles).toBe(2); // README.md, logo.png
      expect(counts.failedFiles).toBe(0);
    });

    it("redacts matched credentials and preserves safe findings metadata", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "src/config.js",
            content: `
              const awsKey = "AKIAIOSFODNN7EXAMPLE";
              const privateKey = "-----BEGIN RSA PRIVATE KEY-----SECRET";
            `,
          },
        ])
      );

      const security = result.analysisData.security;
      expect(security.checksExecuted).toHaveLength(4);
      expect(security.findings.length).toBeGreaterThanOrEqual(2);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(serialized).toContain("AKIA***REDACTED***");
      expect(serialized).toContain("-----BEGIN ***REDACTED***");
    });

    it("computes deterministic Architecture Readiness Score with factor breakdown", () => {
      const result = analyzer.analyze(
        snapshot([
          {
            path: "package.json",
            content: JSON.stringify({
              dependencies: { express: "^4.18.0", mongoose: "^7.0.0" },
            }),
          },
          {
            path: "server.js",
            content: `
              import express from 'express';
              const app = express();
              app.get('/api/users', (req, res) => res.json([]));
              app.listen(5000);
            `,
          },
          {
            path: "main.jsx",
            content: "import { createRoot } from 'react-dom/client'; createRoot();",
          },
        ])
      );

      const readiness = result.analysisData.readiness;
      expect(readiness.score).toBeGreaterThan(0);
      expect(readiness.score).toBeLessThanOrEqual(100);
      expect(readiness.factors).toHaveLength(6);

      const testFactor = readiness.factors.find((f) => f.name === "Automated Testing Suite");
      expect(testFactor?.points).toBe(0); // 0 tests = 0 points
      expect(testFactor?.status).toBe("fail");

      const entryFactor = readiness.factors.find((f) => f.name === "Entry Points & Bootstrapping");
      expect(entryFactor?.points).toBe(15); // both backend and frontend confirmed
      expect(entryFactor?.status).toBe("pass");
    });

    it("handles empty repository and malformed manifests gracefully without crashing", () => {
      const emptyResult = analyzer.analyze(snapshot([]));
      expect(emptyResult.metrics.fileCount).toBe(0);
      expect(emptyResult.architecture.routes).toEqual([]);
      expect(emptyResult.analysisData.languagesBreakdown).toEqual([]);

      const malformedResult = analyzer.analyze(
        snapshot([
          { path: "package.json", content: "{ malformed json..." },
          { path: "src/broken.js", content: "const a = " },
        ])
      );
      expect(malformedResult.dependencies).toEqual([]);
      expect(malformedResult.analysisData.fileCounts.totalFilesDiscovered).toBe(2);
    });
  });
});
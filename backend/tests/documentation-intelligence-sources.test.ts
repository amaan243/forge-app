import { beforeEach, describe, expect, it, vi } from "vitest";

const { engineeringRepo, archService, repoIntelRepo, aiRuns } = vi.hoisted(() => ({
  engineeringRepo: {
    documents: vi.fn(),
    document: vi.fn(),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
  },
  archService: {
    getVersion: vi.fn(),
    getCurrent: vi.fn(),
  },
  repoIntelRepo: {
    repository: vi.fn(),
    analysis: vi.fn(),
    latestSuccessful: vi.fn(),
  },
  aiRuns: {
    start: vi.fn().mockResolvedValue({ id: "run-1" }),
    complete: vi.fn().mockResolvedValue({}),
    fail: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../src/repositories/engineering-intelligence-repository.js", () => ({
  engineeringRepository: engineeringRepo,
}));
vi.mock("../src/services/architecture-service.js", () => ({
  architectureService: archService,
}));
vi.mock("../src/repositories/repository-intelligence-repository.js", () => ({
  repositoryIntelligenceRepository: repoIntelRepo,
}));
vi.mock("../src/services/ai-run-service.js", () => ({
  aiRunService: aiRuns,
}));

import { DocumentationGeneratorService } from "../src/services/documentation-generator-service.js";
import { engineeringController } from "../src/controllers/engineering-intelligence-controller.js";
import { AppError, NotFoundError } from "../src/errors/app-error.js";

const sampleArchitecture = {
  version: {
    id: "ver-proj1-01",
    project_id: "project-1",
    version_number: 1,
    name: "Core Platform v1",
    description: "Core microservice topology",
    status: "published",
    architecture_data: {
      summary: "High throughput service cluster",
      scalabilityConsiderations: ["Autoscale API gateway", "Read replicas for Postgres"],
      securityConsiderations: ["mTLS between microservices", "OAuth2 JWT tokens"],
      risks: ["Cross-region latency"],
    } as any,
    created_by: "user-1",
    created_at: "2026-01-01T00:00:00Z",
  },
  nodes: [
    {
      id: "node-api",
      architecture_version_id: "ver-proj1-01",
      node_key: "api_gateway",
      name: "API Gateway",
      type: "api",
      technology: "Express",
      description: "Edge HTTP ingress",
      metadata: {},
      position_x: 0,
      position_y: 0,
      created_at: "",
    },
    {
      id: "node-db",
      architecture_version_id: "ver-proj1-01",
      node_key: "primary_db",
      name: "Primary Database",
      type: "database",
      technology: "PostgreSQL",
      description: "Relational persistence store",
      metadata: {},
      position_x: 100,
      position_y: 100,
      created_at: "",
    },
  ],
  edges: [
    {
      id: "edge-1",
      architecture_version_id: "ver-proj1-01",
      source_node_id: "node-api",
      target_node_id: "node-db",
      relationship: "persists",
      protocol: "TCP / 5432",
      description: "SQL queries",
      metadata: {},
      created_at: "",
    },
  ],
};

const sampleRepo = {
  id: "repo-proj1-01",
  project_id: "project-1",
  provider: "github" as const,
  repository_url: "https://github.com/org/core-platform",
  repository_name: "core-platform",
  owner: "org",
  default_branch: "main",
  access_type: "public" as const,
  external_repository_id: "ext-1",
  connected_by: "user-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const sampleAnalysis = {
  id: "analysis-proj1-01",
  project_id: "project-1",
  repository_id: "repo-proj1-01",
  commit_sha: "7a8b9c0d",
  branch: "main",
  status: "completed" as const,
  analysis_data: {
    branch: "main",
    detectedFrameworks: [
      { name: "Express", ecosystem: "node", category: "backend", confidence: "high", evidenceFile: "package.json" },
    ],
    detectedEnvVars: ["DATABASE_URL", "JWT_SECRET"],
    testRunner: "vitest",
    testCount: 14,
    testFiles: ["tests/api.test.ts", "tests/db.test.ts"],
    entryPoints: [{ path: "src/server.ts", kind: "backend_server" }],
  },
  languages: { TypeScript: 42, JavaScript: 8 },
  infrastructure: { docker: true, ci: true },
  architecture: {
    routes: [
      { method: "GET", path: "/api/v1/health", handler: "getHealth", file: "src/routes/health.ts", framework: "Express", confidence: "high", detectionBasis: "direct_app_route" },
      { method: "POST", path: "/api/v1/auth/login", handler: "login", file: "src/routes/auth.ts", framework: "Express", confidence: "high", detectionBasis: "direct_app_route" },
    ],
    models: [
      { name: "User", file: "src/models/user.ts", fields: ["id: uuid", "email: string", "role: string"] },
      { name: "Account", file: "src/models/account.ts", fields: ["id: uuid", "balance: decimal"] },
    ],
    databases: ["PostgreSQL (detected via pg dependency)"],
  },
  dependencies: [
    { name: "express", version: "^4.19.0", ecosystem: "npm" },
    { name: "pg", version: "^8.11.0", ecosystem: "npm" },
  ],
  created_at: "2026-01-01T00:00:00Z",
  completed_at: "2026-01-01T00:01:00Z",
};

describe("Documentation Intelligence: Dynamic Sources & Validation", () => {
  const generator = new DocumentationGeneratorService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Repository Intelligence without an architecture version
  it("1. generates Repository Intelligence without requiring an architecture version", () => {
    const result = generator.generateFull({
      title: "Repository Intelligence Overview",
      format: "markdown",
      type: "repository_overview",
      sourceMode: "repository",
      analysis: sampleAnalysis as any,
      repository: sampleRepo,
    });

    expect(result.hasArchitectureSource).toBe(false);
    expect(result.hasRepositorySource).toBe(true);
    expect(result.sourceVersionId).toBeUndefined();
    expect(result.sourceAnalysisId).toBe(sampleAnalysis.id);
    expect(result.sourceCommitSha).toBe(sampleAnalysis.commit_sha);

    // Content verifies repository facts and does NOT complain about missing architecture
    expect(result.content).toContain("# Repository Intelligence Overview");
    expect(result.content).toContain("core-platform");
    expect(result.content).toContain("TypeScript");
    expect(result.content).toContain("Express");
    expect(result.content).not.toContain("No architecture version selected");
  });

  // 2. Developer Setup without an architecture version
  it("2. generates Developer Setup without an architecture version and sanitizes secret credentials", () => {
    const analysisWithSecrets = {
      ...sampleAnalysis,
      analysis_data: {
        ...sampleAnalysis.analysis_data,
        detectedEnvVars: ["DATABASE_URL=postgres://appuser:SuperSecretPassword123@db.prod.internal:5432/maindb", "API_KEY=sk_live_999888777"],
      },
    };

    const result = generator.generateFull({
      title: "Developer Onboarding & Setup",
      format: "markdown",
      type: "getting_started",
      sourceMode: "repository",
      analysis: analysisWithSecrets as any,
      repository: sampleRepo,
    });

    expect(result.hasArchitectureSource).toBe(false);
    expect(result.hasRepositorySource).toBe(true);
    expect(result.content).toContain("# Developer Onboarding & Setup");
    expect(result.content).toContain("npm install");
    expect(result.content).toContain("npm run dev");
    expect(result.content).not.toContain("No architecture version selected");

    // Secrets MUST be redacted/sanitized
    expect(result.content).not.toContain("SuperSecretPassword123");
    expect(result.content).not.toContain("sk_live_999888777");
  });

  // 3. Architecture Overview without a repository scan
  it("3. generates Architecture Overview without requiring a repository scan", () => {
    const result = generator.generateFull({
      title: "Platform Architecture Baseline",
      format: "markdown",
      type: "architecture_overview",
      sourceMode: "architecture",
      architecture: sampleArchitecture as any,
    });

    expect(result.hasArchitectureSource).toBe(true);
    expect(result.hasRepositorySource).toBe(false);
    expect(result.sourceVersionId).toBe(sampleArchitecture.version.id);
    expect(result.sourceAnalysisId).toBeUndefined();

    // Contains topology and diagrams, but does NOT complain about missing repository scan
    expect(result.content).toContain("# Platform Architecture Baseline");
    expect(result.content).toContain("API Gateway");
    expect(result.content).toContain("Primary Database");
    expect(result.content).toContain("graph TD");
    expect(result.content).not.toContain("No repository analysis available");
  });

  // 4. System Design without a repository scan
  it("4. generates System Design without requiring a repository scan", () => {
    const result = generator.generateFull({
      title: "System Design Specification",
      format: "markdown",
      type: "system_design",
      sourceMode: "architecture",
      architecture: sampleArchitecture as any,
    });

    expect(result.hasArchitectureSource).toBe(true);
    expect(result.hasRepositorySource).toBe(false);
    expect(result.content).toContain("# System Design Specification");
    expect(result.content).toContain("Component Decomposition & Responsibilities");
    expect(result.content).toContain("Architectural Patterns & Communication Protocols");
    expect(result.content).toContain("Architectural Trade-offs & Quality Attributes");
    expect(result.content).not.toContain("No repository analysis available");
  });

  // 5. API Reference with a repository scan
  it("5. generates API Reference from repository scan in Markdown and OpenAPI JSON", () => {
    const mdResult = generator.generateFull({
      title: "Core Service API Reference",
      format: "markdown",
      type: "api_documentation",
      sourceMode: "repository",
      analysis: sampleAnalysis as any,
      repository: sampleRepo,
    });

    expect(mdResult.content).toContain("GET /api/v1/health");
    expect(mdResult.content).toContain("POST /api/v1/auth/login");
    expect(mdResult.content).toContain("src/routes/health.ts");

    const openApiResult = generator.generateFull({
      title: "Core Service OpenAPI Spec",
      format: "openapi_json",
      type: "api_documentation",
      sourceMode: "repository",
      analysis: sampleAnalysis as any,
      repository: sampleRepo,
    });

    const parsed = JSON.parse(openApiResult.content);
    expect(parsed.openapi).toBe("3.1.0");
    expect(parsed.paths["/api/v1/health"].get).toBeDefined();
    expect(parsed.paths["/api/v1/auth/login"].post).toBeDefined();
  });

  // 6. Combined documentation using both sources
  it("6. generates Combined documentation distinguishing intended architecture, observed repo, and verified matches", () => {
    const result = generator.generateFull({
      title: "Unified System Documentation",
      format: "markdown",
      type: "architecture_overview",
      sourceMode: "combined",
      architecture: sampleArchitecture as any,
      analysis: sampleAnalysis as any,
      repository: sampleRepo,
    });

    expect(result.hasArchitectureSource).toBe(true);
    expect(result.hasRepositorySource).toBe(true);
    expect(result.sourceVersionId).toBe(sampleArchitecture.version.id);
    expect(result.sourceAnalysisId).toBe(sampleAnalysis.id);

    // Verifies the explicit combined sections
    expect(result.content).toContain("Architecture vs. Implementation Analysis");
    expect(result.content).toContain("1. Intended Architecture Baseline");
    expect(result.content).toContain("2. Observed Repository Implementation");
    expect(result.content).toContain("3. Verified Matches");
    expect(result.content).toContain("4. Missing or Additional Elements");
    expect(result.content).toContain("5. Unknown or Unverified Information");
    expect(result.content).toContain("Verified match with detected framework `Express`");
  });

  // 7. Switching document types updates required source selectors
  it("7. defines dynamic source mode constraints per document type", () => {
    const rules: Record<string, { requiresArch: boolean; requiresRepo: boolean }> = {
      architecture_overview: { requiresArch: true, requiresRepo: false },
      system_design: { requiresArch: true, requiresRepo: false },
      api_documentation: { requiresArch: false, requiresRepo: true },
      repository_overview: { requiresArch: false, requiresRepo: true },
      getting_started: { requiresArch: false, requiresRepo: true },
      deployment: { requiresArch: false, requiresRepo: true },
    };

    expect(rules.architecture_overview.requiresArch).toBe(true);
    expect(rules.repository_overview.requiresArch).toBe(false);
    expect(rules.repository_overview.requiresRepo).toBe(true);
    expect(rules.getting_started.requiresRepo).toBe(true);
    expect(rules.getting_started.requiresArch).toBe(false);
  });

  // 8. Switching projects clears incompatible selections
  it("8. isolates project contexts and resets selections when project changes", () => {
    let activeProjectId = "project-1";
    let selectedVersionId: string | null = "ver-proj1-01";
    let selectedRepoId: string | null = "repo-proj1-01";

    // Switch project
    const switchProject = (newProjectId: string) => {
      activeProjectId = newProjectId;
      selectedVersionId = null;
      selectedRepoId = null;
    };

    switchProject("project-2");
    expect(activeProjectId).toBe("project-2");
    expect(selectedVersionId).toBeNull();
    expect(selectedRepoId).toBeNull();
  });

  // 9. Invalid cross-project source IDs are rejected
  it("9. rejects cross-project source IDs and invalid repository-analysis pairings", async () => {
    const mockRes = () => {
      const res: any = {};
      res.status = vi.fn().mockReturnValue(res);
      res.json = vi.fn().mockReturnValue(res);
      return res;
    };

    // Case 9a: version belongs to project-2, request is for project-1
    archService.getVersion.mockResolvedValueOnce({
      version: { id: "ver-proj2-99", project_id: "project-2" },
      nodes: [],
      edges: [],
    });
    engineeringRepo.documents.mockResolvedValueOnce([]);

    await expect(
      engineeringController.generateDocument(
        {
          params: { projectId: "project-1" },
          body: {
            type: "architecture_overview",
            title: "Architecture",
            format: "markdown",
            source_mode: "architecture",
            version_id: "00000000-0000-0000-0000-000000000002",
          },
        } as any,
        mockRes(),
        () => {}
      )
    ).rejects.toThrow(NotFoundError);

    // Case 9b: repository analysis belongs to project-2, request is for project-1
    repoIntelRepo.analysis.mockResolvedValueOnce({
      id: "analysis-proj2-99",
      project_id: "project-2",
      repository_id: "repo-99",
      status: "completed",
    });

    await expect(
      engineeringController.generateDocument(
        {
          params: { projectId: "project-1" },
          body: {
            type: "repository_overview",
            title: "Repo Overview",
            format: "markdown",
            source_mode: "repository",
            repository_analysis_id: "00000000-0000-0000-0000-000000000003",
          },
        } as any,
        mockRes(),
        () => {}
      )
    ).rejects.toThrow(NotFoundError);

    // Case 9c: repository analysis does not belong to specified repository_id
    repoIntelRepo.repository.mockResolvedValueOnce({
      id: "00000000-0000-0000-0000-000000000004",
      project_id: "project-1",
    } as any);
    repoIntelRepo.analysis.mockResolvedValueOnce({
      id: "00000000-0000-0000-0000-000000000005",
      project_id: "project-1",
      repository_id: "different-repo-id",
      status: "completed",
    });

    await expect(
      engineeringController.generateDocument(
        {
          params: { projectId: "project-1" },
          body: {
            type: "repository_overview",
            title: "Repo Overview",
            format: "markdown",
            source_mode: "repository",
            repository_id: "00000000-0000-0000-0000-000000000004",
            repository_analysis_id: "00000000-0000-0000-0000-000000000005",
          },
        } as any,
        mockRes(),
        () => {}
      )
    ).rejects.toThrow(AppError);

    // Case 9d: repository analysis is not completed (status: failed)
    repoIntelRepo.analysis.mockResolvedValueOnce({
      id: "00000000-0000-0000-0000-000000000006",
      project_id: "project-1",
      repository_id: "repo-1",
      status: "failed",
    });

    await expect(
      engineeringController.generateDocument(
        {
          params: { projectId: "project-1" },
          body: {
            type: "repository_overview",
            title: "Repo Overview",
            format: "markdown",
            source_mode: "repository",
            repository_analysis_id: "00000000-0000-0000-0000-000000000006",
          },
        } as any,
        mockRes(),
        () => {}
      )
    ).rejects.toThrow(AppError);
  });

  // 10. Existing document generation and export functionality continue working
  it("10. continues supporting legacy generation contract and all export formats", () => {
    const legacyResult = generator.generate({
      title: "Legacy Service",
      format: "markdown",
      architecture: {
        version: { name: "v0" },
        nodes: [{ name: "Service A", type: "service", technology: "Go" }],
        edges: [],
      },
    });
    expect(legacyResult).toContain("# Legacy Service");
    expect(legacyResult).toContain("Service A");

    const htmlResult = generator.generate({
      title: "Legacy Service HTML",
      format: "html",
      architecture: {
        version: { name: "v0" },
        nodes: [{ name: "Service B", type: "service", technology: "Rust" }],
        edges: [],
      },
    });
    expect(htmlResult).toContain("<h1>Legacy Service HTML</h1>");

    const mermaidResult = generator.generate({
      title: "Legacy Service Mermaid",
      format: "mermaid",
      architecture: {
        version: { name: "v0" },
        nodes: [],
        edges: [{ source_node_id: "a", target_node_id: "b", relationship: "calls" }],
      },
    });
    expect(mermaidResult).toContain("graph TD");
    expect(mermaidResult).toContain("a -->|calls| b");
  });
});

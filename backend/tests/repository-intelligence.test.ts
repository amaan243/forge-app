import { describe, expect, it } from "vitest";
import { RepositoryAnalyzerService } from "../src/services/repository-analyzer-service.js";
import { DependencyAnalyzerService } from "../src/services/dependency-analyzer-service.js";
import { GitHubRepositoryProvider } from "../src/integrations/github-repository-provider.js";
import type { RepositorySnapshot } from "../src/types/repository-intelligence.js";

const snapshot = (files: RepositorySnapshot["files"]): RepositorySnapshot => ({ commitSha: "fixture-sha", repository: { id: "repo", project_id: "project", provider: "github", repository_url: "https://github.com/example/repo", repository_name: "repo", owner: "example", default_branch: "main", access_type: "public", external_repository_id: "1", connected_by: "user", created_at: "", updated_at: "" }, files });

describe("repository intelligence", () => {
  it("extracts frontend, backend, auth, databases, CI, and infrastructure", () => {
    const result = new RepositoryAnalyzerService().analyze(snapshot([
      { path: "package.json", content: JSON.stringify({ dependencies: { react: "^19", express: "^5", prisma: "^6", "@supabase/supabase-js": "^2" }, devDependencies: { vite: "^6" } }) },
      { path: "src/components/App.tsx", content: "export const App = () => null" }, { path: "src/api/routes.ts", content: "export const routes = []" }, { path: "Dockerfile", content: "FROM node:22" }, { path: ".github/workflows/ci.yml", content: "name: ci" },
    ]));
    expect(result.frameworks).toEqual(expect.arrayContaining(["React", "Express", "Vite", "PostgreSQL"]));
    expect(result.architecture).toMatchObject({ authentication: true });
    expect(result.architecture.databases).toEqual(expect.arrayContaining(["prisma"]));
    expect(result.infrastructure).toMatchObject({ docker: true, ci: true });
  });

  it("ignores secrets and generated directories", () => {
    const result = new RepositoryAnalyzerService().analyze(snapshot([{ path: ".env", content: "TOKEN=secret" }, { path: "dist/app.js", content: "secret" }, { path: "src/main.ts", content: "export {}" }]));
    expect(result.analysisData.filesAnalyzed).toBe(1);
  });

  it("builds dependency graph metrics and cycle candidates", () => {
    const graph = new DependencyAnalyzerService().graph([
      { id: "a", project_id: "p", repository_analysis_id: "a", name: "a", version: "1", ecosystem: "npm", type: "runtime", risk_level: "low", metadata: { dependencies: ["b"] }, created_at: "" },
      { id: "b", project_id: "p", repository_analysis_id: "a", name: "b", version: "1", ecosystem: "npm", type: "runtime", risk_level: "low", metadata: { dependencies: ["a"] }, created_at: "" },
    ]);
    expect(graph.edges).toHaveLength(2); expect(graph.nodes.find((node) => node.id === "a")).toMatchObject({ fanIn: 1, fanOut: 1 }); expect(graph.circularCandidates.length).toBeGreaterThan(0);
  });

  it("validates GitHub URLs before making provider calls", async () => { await expect(new GitHubRepositoryProvider().connect({ url: "https://example.com/repo" })).rejects.toThrow("GitHub"); });
});
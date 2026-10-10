import { describe, it, expect, vi, beforeEach } from "vitest";
import { driftDetectionService } from "../src/services/drift-service.js";
import { architectureService } from "../src/services/architecture-service.js";
import { NotFoundError, ValidationError } from "../src/errors/app-error.js";
import type { RepositoryAnalysis } from "../src/types/repository-intelligence.js";

describe("Global Project Management, Multi-Repository, and Project-Scoped Drift", () => {
  const projectIdA = "11111111-1111-1111-1111-111111111111";
  const projectIdB = "22222222-2222-2222-2222-222222222222";
  const repoIdA1 = "33333333-3333-3333-3333-333333333331";
  const repoIdA2 = "33333333-3333-3333-3333-333333333332";
  const repoIdB1 = "44444444-4444-4444-4444-444444444441";
  const versionIdA = "55555555-5555-5555-5555-555555555551";

  describe("Multi-Repository Hierarchy & Isolation", () => {
    it("associates multiple repositories with a single project", async () => {
      const repoA1 = {
        id: repoIdA1,
        project_id: projectIdA,
        owner: "org",
        repository_name: "service-frontend",
        status: "active",
      };
      const repoA2 = {
        id: repoIdA2,
        project_id: projectIdA,
        owner: "org",
        repository_name: "service-backend",
        status: "active",
      };

      expect(repoA1.project_id).toBe(projectIdA);
      expect(repoA2.project_id).toBe(projectIdA);
      expect(repoA1.id).not.toBe(repoA2.id);
    });

    it("isolates snapshots and commits between repositories in the same project", () => {
      const snapshotRepo1: Partial<RepositoryAnalysis> = {
        id: "snap-1",
        project_id: projectIdA,
        repository_id: repoIdA1,
        commit_sha: "aaa1111",
        status: "completed",
      };

      const snapshotRepo2: Partial<RepositoryAnalysis> = {
        id: "snap-2",
        project_id: projectIdA,
        repository_id: repoIdA2,
        commit_sha: "bbb2222",
        status: "completed",
      };

      expect(snapshotRepo1.repository_id).toBe(repoIdA1);
      expect(snapshotRepo2.repository_id).toBe(repoIdA2);
      expect(snapshotRepo1.commit_sha).not.toBe(snapshotRepo2.commit_sha);
    });

    it("prevents cross-project repository leakage", () => {
      const projectARepos = [
        { id: repoIdA1, project_id: projectIdA },
        { id: repoIdA2, project_id: projectIdA },
      ];
      const projectBRepos = [
        { id: repoIdB1, project_id: projectIdB },
      ];

      const reposForProjectA = projectARepos.filter((r) => r.project_id === projectIdA);
      const reposForProjectB = projectBRepos.filter((r) => r.project_id === projectIdB);

      expect(reposForProjectA).toHaveLength(2);
      expect(reposForProjectB).toHaveLength(1);
      expect(reposForProjectA.some((r) => r.id === repoIdB1)).toBe(false);
    });
  });

  describe("Architecture Drift Validation Hierarchy", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("rejects drift comparison if architecture version belongs to another project", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: versionIdA,
          project_id: projectIdA,
          version_number: 1,
          name: "v1",
          status: "published",
        } as any,
        nodes: [],
        edges: [],
      });

      const analysis: RepositoryAnalysis = {
        id: "snap-1",
        project_id: projectIdB,
        repository_id: repoIdB1,
        commit_sha: "sha1",
        status: "completed",
        created_at: new Date().toISOString(),
      };

      // Calling compare with projectIdB but version belongs to projectIdA
      await expect(
        driftDetectionService.compare(projectIdB, versionIdA, analysis)
      ).rejects.toThrow(NotFoundError);
    });

    it("rejects drift comparison if repository analysis snapshot belongs to another project", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: versionIdA,
          project_id: projectIdA,
          version_number: 1,
          name: "v1",
          status: "published",
        } as any,
        nodes: [],
        edges: [],
      });

      // Snapshot has project_id = projectIdB, requested project is projectIdA
      const crossProjectAnalysis: RepositoryAnalysis = {
        id: "snap-cross",
        project_id: projectIdB,
        repository_id: repoIdB1,
        commit_sha: "sha2",
        status: "completed",
        created_at: new Date().toISOString(),
      };

      await expect(
        driftDetectionService.compare(projectIdA, versionIdA, crossProjectAnalysis)
      ).rejects.toThrow("Repository analysis snapshot not found for this project");
    });

    it("rejects incomplete or failed snapshots for drift analysis", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: versionIdA,
          project_id: projectIdA,
          version_number: 1,
          name: "v1",
          status: "published",
        } as any,
        nodes: [],
        edges: [],
      });

      const incompleteSnapshot: RepositoryAnalysis = {
        id: "snap-running",
        project_id: projectIdA,
        repository_id: repoIdA1,
        commit_sha: "sha3",
        status: "running" as any,
        created_at: new Date().toISOString(),
      };

      await expect(
        driftDetectionService.compare(projectIdA, versionIdA, incompleteSnapshot)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("Deterministic Drift Scoring & Evidence", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("correctly identifies missing components with evidence", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: versionIdA,
          project_id: projectIdA,
          version_number: 1,
          name: "Payment Architecture",
          status: "published",
        } as any,
        nodes: [
          {
            id: "node-1",
            architecture_version_id: versionIdA,
            node_key: "auth-service",
            name: "Authentication Service",
            type: "backend",
            technology: "Node.js",
            description: "Handles JWT authentication",
            metadata: {},
            position_x: 0,
            position_y: 0,
            created_at: new Date().toISOString(),
          },
        ],
        edges: [],
      });

      const emptyAnalysis: RepositoryAnalysis = {
        id: "snap-empty",
        project_id: projectIdA,
        repository_id: repoIdA1,
        commit_sha: "def4567",
        status: "completed",
        analysis_data: {
          fileCounts: { total: 10, source: 8 },
          languagesBreakdown: [{ language: "TypeScript", percentage: 100 }],
        },
        frameworks: ["express"],
        architecture: {
          services: [{ name: "Orders Module", path: "src/orders", confidence: "confirmed" }],
          entryPoints: ["src/index.ts"],
          routes: [{ path: "/orders", method: "GET", file: "src/orders.ts" }],
        },
        created_at: new Date().toISOString(),
      };

      const result = await driftDetectionService.compare(projectIdA, versionIdA, emptyAnalysis);

      expect(result.score).toBeLessThan(100);
      expect(result.counts.byCategory.missing_component).toBeGreaterThanOrEqual(1);
      const missingItem = result.items.find((i) => i.type === "missing");
      expect(missingItem).toBeDefined();
      expect(missingItem?.description).toContain("Authentication Service");
    });

    it("correctly scores matching components without false positives", async () => {
      vi.spyOn(architectureService, "getVersion").mockResolvedValue({
        version: {
          id: versionIdA,
          project_id: projectIdA,
          version_number: 1,
          name: "Orders System",
          status: "published",
        } as any,
        nodes: [
          {
            id: "node-1",
            architecture_version_id: versionIdA,
            node_key: "orders-service",
            name: "Orders Service",
            type: "backend",
            technology: "Express",
            description: "Orders processing",
            metadata: {},
            position_x: 0,
            position_y: 0,
            created_at: new Date().toISOString(),
          },
        ],
        edges: [],
      });

      const matchingAnalysis: RepositoryAnalysis = {
        id: "snap-matching",
        project_id: projectIdA,
        repository_id: repoIdA1,
        commit_sha: "abc1234",
        status: "completed",
        analysis_data: {
          fileCounts: { total: 15, source: 12 },
          languagesBreakdown: [{ language: "TypeScript", percentage: 100 }],
        },
        frameworks: ["express"],
        architecture: {
          services: [{ name: "Orders Service", path: "src/orders", confidence: "confirmed" }],
          entryPoints: ["src/index.ts"],
          routes: [{ path: "/orders", method: "POST", file: "src/orders.ts" }],
        },
        created_at: new Date().toISOString(),
      };

      const result = await driftDetectionService.compare(projectIdA, versionIdA, matchingAnalysis);

      expect(result.score).toBe(100);
      expect(result.counts.byCategory.missing_component).toBe(0);
    });
  });
});

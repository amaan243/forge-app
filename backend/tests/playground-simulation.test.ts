import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArchitectureNode, ArchitectureEdge } from "../src/types/architecture.js";

const { engineeringRepo, archService, repoIntelRepo } = vi.hoisted(() => ({
  engineeringRepo: {
    simulation: vi.fn(),
    simulations: vi.fn(),
    createSimulation: vi.fn(),
    updateSimulation: vi.fn(),
    applySimulationTransaction: vi.fn(),
  },
  archService: {
    getVersion: vi.fn(),
  },
  repoIntelRepo: {
    repository: vi.fn(),
    analysis: vi.fn(),
    latestSuccessful: vi.fn(),
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

import { ArchitectureSimulationService } from "../src/services/architecture-simulation-service.js";
import { ChangeImpactService } from "../src/services/change-impact-service.js";
import { simulationCreate } from "../src/validators/engineering-intelligence.js";
import { NotFoundError, ValidationError } from "../src/errors/app-error.js";

const sampleNodes: ArchitectureNode[] = [
  {
    id: "node-gw",
    architecture_version_id: "v-1",
    node_key: "api-gateway",
    name: "API Gateway",
    type: "gateway",
    technology: "Kong",
    description: "Public ingress gateway",
    metadata: {},
    position_x: 0,
    position_y: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "node-orders",
    architecture_version_id: "v-1",
    node_key: "orders-service",
    name: "Orders Service",
    type: "service",
    technology: "Express.js",
    description: "Orders processing service",
    metadata: {},
    position_x: 100,
    position_y: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "node-db",
    architecture_version_id: "v-1",
    node_key: "orders-db",
    name: "Orders Database",
    type: "database",
    technology: "PostgreSQL",
    description: "Primary relational database",
    metadata: {},
    position_x: 200,
    position_y: 0,
    created_at: "2026-01-01T00:00:00Z",
  },
];

const sampleEdges: ArchitectureEdge[] = [
  {
    id: "edge-1",
    architecture_version_id: "v-1",
    source_node_id: "node-gw",
    target_node_id: "node-orders",
    relationship: "calls",
    protocol: "HTTP/REST",
    description: "Gateway routes traffic to Orders",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "edge-2",
    architecture_version_id: "v-1",
    source_node_id: "node-orders",
    target_node_id: "node-db",
    relationship: "reads",
    protocol: "SQL/TCP",
    description: "Orders reads and writes database",
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
];

describe("Engineering Playground & Architecture Simulation Engine", () => {
  let service: ArchitectureSimulationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ArchitectureSimulationService();
  });

  // 1. Simulating a change against a saved architecture
  it("1. simulates a change against a saved architecture and produces structured metrics", async () => {
    const simulationRecord = {
      id: "sim-1",
      project_id: "proj-1",
      base_version_id: "v-1",
      name: "Cache Introduction Proposal",
      status: "draft",
      proposed_changes: [
        {
          type: "introduce_cache",
          name: "Redis Cache",
          technology: "Redis",
          target: "Orders Service",
        },
      ],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
      after_architecture: { nodes: [], edges: [] },
      metrics: {},
      impact_analysis: {},
    };

    engineeringRepo.simulation.mockResolvedValue(simulationRecord);
    engineeringRepo.updateSimulation.mockImplementation(async (_pid, _id, update) => ({
      ...simulationRecord,
      ...update,
    }));

    const result = (await service.simulate("proj-1", "sim-1")) as any;

    expect(result.status).toBe("completed");
    expect(result.metrics).toBeDefined();
    expect(result.metrics.performance).toBeDefined();
    expect(result.metrics.performance.latencyScore.proposed).toContain("reduction on cached query paths");
    expect(result.metrics.cost.relativeCostIndex).toBeDefined();
    expect(result.after_architecture.nodes.length).toBe(sampleNodes.length + 1);
  });

  // 2. Confirming simulation does not modify original architecture
  it("2. does not mutate or modify the baseline architecture version", async () => {
    const originalNodes = JSON.parse(JSON.stringify(sampleNodes));
    const originalEdges = JSON.parse(JSON.stringify(sampleEdges));

    const simulationRecord = {
      id: "sim-2",
      project_id: "proj-1",
      base_version_id: "v-1",
      name: "Remove Service Test",
      status: "draft",
      proposed_changes: [{ type: "remove_service", target: "Orders Service" }],
      before_architecture: { nodes: originalNodes, edges: originalEdges },
    };

    engineeringRepo.simulation.mockResolvedValue(simulationRecord);
    engineeringRepo.updateSimulation.mockImplementation(async (_pid, _id, update) => update);

    await service.simulate("proj-1", "sim-2");

    // The baseline nodes and edges in before_architecture must remain completely intact
    expect(originalNodes.length).toBe(3);
    expect(originalEdges.length).toBe(2);
    expect(simulationRecord.before_architecture.nodes.length).toBe(3);
  });

  // 3. Adding and removing components
  it("3. supports adding and removing components with accurate after_architecture graph", async () => {
    // Add component
    const addSim = {
      id: "sim-add",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      proposed_changes: [
        {
          type: "add_service",
          name: "Notification Service",
          node_type: "worker",
          technology: "Go",
          responsibility: "Async notifications",
        },
      ],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
    };

    engineeringRepo.simulation.mockResolvedValue(addSim);
    engineeringRepo.updateSimulation.mockImplementation(async (_p, _i, update) => update);

    const addResult = (await service.simulate("proj-1", "sim-add")) as any;
    expect(addResult.after_architecture.nodes.some((n: any) => n.name === "Notification Service")).toBe(true);
    expect(addResult.after_architecture.nodes.length).toBe(sampleNodes.length + 1);

    // Remove component
    const removeSim = {
      id: "sim-rem",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      proposed_changes: [{ type: "remove_service", target: "Orders Service" }],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
    };

    engineeringRepo.simulation.mockResolvedValue(removeSim);
    const removeResult = (await service.simulate("proj-1", "sim-rem")) as any;
    expect(removeResult.after_architecture.nodes.some((n: any) => n.name === "Orders Service")).toBe(false);
    expect(removeResult.after_architecture.nodes.length).toBe(sampleNodes.length - 1);
  });

  // 4. Adding and removing connections
  it("4. supports adding and removing connections between components", async () => {
    const connSim = {
      id: "sim-conn",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      proposed_changes: [
        {
          type: "add_connection",
          source: "API Gateway",
          target_component: "Orders Database",
          relationship: "reads",
          protocol: "SQL/TCP",
        },
        {
          type: "remove_connection",
          source: "API Gateway",
          target_component: "Orders Service",
        },
      ],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
    };

    engineeringRepo.simulation.mockResolvedValue(connSim);
    engineeringRepo.updateSimulation.mockImplementation(async (_p, _i, update) => update);

    const result = (await service.simulate("proj-1", "sim-conn")) as any;
    const edges = result.after_architecture.edges as any[];

    // Direct gateway to orders edge was removed
    expect(
      edges.some((e: any) => e.source_node_id === "node-gw" && e.target_node_id === "node-orders")
    ).toBe(false);
    // New gateway to db edge was added
    expect(
      edges.some((e: any) => e.source_node_id === "node-gw" && e.target_node_id === "node-db")
    ).toBe(true);
  });

  // 5. Detecting affected downstream components
  it("5. detects direct, connected, and severed downstream components and breaking changes", async () => {
    const sim = {
      id: "sim-impact",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      proposed_changes: [{ type: "remove_service", target: "Orders Service" }],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
    };

    engineeringRepo.simulation.mockResolvedValue(sim);
    engineeringRepo.updateSimulation.mockImplementation(async (_p, _i, update) => update);

    const result = (await service.simulate("proj-1", "sim-impact")) as any;
    expect(result.impact_analysis.affectedComponents).toContain("Orders Service");
    expect(result.impact_analysis.brokenConnections.length).toBeGreaterThan(0);
    expect(result.impact_analysis.brokenConnections[0].source).toBe("API Gateway");
  });

  // 6. Handling missing architecture data
  it("6. rejects simulation gracefully when architecture data is missing or corrupted", async () => {
    const corruptSim = {
      id: "sim-corrupt",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      proposed_changes: [{ type: "add_service", name: "Worker" }],
      before_architecture: null,
    };

    engineeringRepo.simulation.mockResolvedValue(corruptSim);
    await expect(service.simulate("proj-1", "sim-corrupt")).rejects.toThrow(ValidationError);
  });

  // 7. Handling stale or missing repository snapshots
  it("7. handles missing repository snapshot by falling back to architecture-only simulation with clear notice", async () => {
    const sim = {
      id: "sim-norepo",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      snapshot_id: null,
      proposed_changes: [{ type: "introduce_cache", technology: "Redis" }],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
    };

    engineeringRepo.simulation.mockResolvedValue(sim);
    engineeringRepo.updateSimulation.mockImplementation(async (_p, _i, update) => update);

    const result = (await service.simulate("proj-1", "sim-norepo")) as any;
    expect(result.impact_analysis.repositoryEvidence.hasEvidence).toBe(false);
    expect(result.metrics.security.evidenceNote).toContain("Insufficient evidence");
  });

  // 8. Switching projects without leaking results
  it("8. isolates simulations by project and rejects access from another project", async () => {
    engineeringRepo.simulation.mockResolvedValue(null);
    await expect(service.get("project-A", "sim-from-project-B")).rejects.toThrow(NotFoundError);
  });

  // 9. Rejecting unauthorized architecture versions
  it("9. rejects creating a simulation if the baseline version belongs to a different project", async () => {
    archService.getVersion.mockResolvedValue({
      version: { id: "v-foreign", project_id: "other-project" },
      nodes: [],
      edges: [],
    });

    await expect(
      service.create("proj-1", "user-1", {
        base_version_id: "v-foreign",
        name: "Malicious attempt",
        proposed_changes: [{ type: "add_service", name: "Hacker" }],
      })
    ).rejects.toThrow(NotFoundError);
  });

  // 10. Ensuring deterministic inputs produce deterministic results
  it("10. ensures identical inputs yield deterministic simulation results", async () => {
    const simTemplate = {
      id: "sim-det",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      proposed_changes: [
        { type: "introduce_queue", technology: "Kafka", source: "API Gateway", target_component: "Orders Service" },
      ],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
    };

    engineeringRepo.simulation.mockResolvedValue(simTemplate);
    engineeringRepo.updateSimulation.mockImplementation(async (_p, _i, update) => update);

    const run1 = (await service.simulate("proj-1", "sim-det")) as any;
    const run2 = (await service.simulate("proj-1", "sim-det")) as any;

    expect(run1.metrics.cost.relativeCostIndex.proposed).toBe(run2.metrics.cost.relativeCostIndex.proposed);
    expect(run1.metrics.complexity.couplingIndex.proposed).toBe(run2.metrics.complexity.couplingIndex.proposed);
    expect(run1.metrics.performance.maxSyncHops.proposed).toBe(run2.metrics.performance.maxSyncHops.proposed);
    expect(run1.metrics.developmentEffort.estimatedDaysMin).toBe(run2.metrics.developmentEffort.estimatedDaysMin);
  });

  // 11. Handling unsupported change types and invalid configurations
  it("11. rejects invalid configurations via zod validator", () => {
    // Empty proposed changes array
    expect(() =>
      simulationCreate.parse({
        base_version_id: "00000000-0000-0000-0000-000000000001",
        name: "Invalid",
        proposed_changes: [],
      })
    ).toThrow();

    // Unsupported change type
    expect(() =>
      simulationCreate.parse({
        base_version_id: "00000000-0000-0000-0000-000000000001",
        name: "Invalid Type",
        proposed_changes: [{ type: "unsupported_magic_op" as any }],
      })
    ).toThrow();
  });

  // 12. Saving a proposal as a new version while preserving baseline
  it("12. applies completed simulation by creating a new version without modifying baseline", async () => {
    const completedSim = {
      id: "sim-apply",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "completed",
      name: "Approved Architecture",
      after_architecture: { nodes: sampleNodes, edges: sampleEdges },
    };

    engineeringRepo.simulation.mockResolvedValue(completedSim);
    engineeringRepo.applySimulationTransaction.mockResolvedValue({
      id: "v-2",
      project_id: "proj-1",
      version_number: 2,
      name: "Approved Architecture applied",
      status: "draft",
    });

    const newVersion = await service.apply("proj-1", "user-1", "sim-apply");
    expect(newVersion.id).toBe("v-2");
    expect(newVersion.version_number).toBe(2);
    expect(engineeringRepo.applySimulationTransaction).toHaveBeenCalledWith(
      "proj-1",
      "user-1",
      completedSim,
      completedSim.after_architecture
    );
  });

  // 13. Verifying that unknown metrics are not replaced with fabricated values
  it("13. reports insufficient evidence instead of fabricating numbers when evidence is unavailable", async () => {
    const sim = {
      id: "sim-unverified",
      project_id: "proj-1",
      base_version_id: "v-1",
      status: "draft",
      snapshot_id: null,
      proposed_changes: [{ type: "add_service", name: "Unverified Service" }],
      before_architecture: {
        nodes: JSON.parse(JSON.stringify(sampleNodes)),
        edges: JSON.parse(JSON.stringify(sampleEdges)),
      },
    };

    engineeringRepo.simulation.mockResolvedValue(sim);
    engineeringRepo.updateSimulation.mockImplementation(async (_p, _i, update) => update);

    const result = (await service.simulate("proj-1", "sim-unverified")) as any;
    expect(result.metrics.security.evidenceNote).toContain("Insufficient evidence");
    expect(result.impact_analysis.repositoryEvidence.hasEvidence).toBe(false);
  });

  // 14. Confirming that unrelated existing features continue to work
  it("14. maintains compatibility with existing change impact analysis contracts", () => {
    const impactService = new ChangeImpactService();
    const result = impactService.analyze(sampleNodes, sampleEdges, [
      { type: "replace_technology", target: "Orders Service", technology: "FastAPI" },
    ]);

    expect(result.affectedComponents).toContain("Orders Service");
    expect(result.affectedDataStores).toContain("Orders Database");
    expect(result.affectedApis).toContain("edge-1");
  });
});

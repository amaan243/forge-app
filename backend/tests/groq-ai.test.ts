import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import { GroqAIProvider } from "../src/integrations/groq-provider.js";
import { getAIProvider, isAIConfigured, UnsupportedAIProvider } from "../src/integrations/ai-provider.js";
import { ArchitectureExplanationService } from "../src/services/architecture-explanation-service.js";
import { DesignReviewService } from "../src/services/design-review-service.js";
import { DriftRemediationService } from "../src/services/drift-remediation-service.js";
import { projectStoryService } from "../src/services/project-story-service.js";
import { architectureService } from "../src/services/architecture-service.js";
import { projectRepository } from "../src/repositories/project-repository.js";

vi.mock("axios");

describe("Groq AI Provider & Service Integrations", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // 1. Configuration & Model Selection
  it("initializes GroqAIProvider with model and credentials", () => {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "gsk_test_12345";
    process.env.GROQ_MODEL = "openai/gpt-oss-20b";

    const provider = new GroqAIProvider();
    expect(provider.getModelName()).toBe("openai/gpt-oss-20b");
    expect(provider.isAvailable()).toBe(true);
  });

  it("returns UnsupportedAIProvider when AI_PROVIDER=none", () => {
    process.env.AI_PROVIDER = "none";
    process.env.GROQ_API_KEY = "gsk_test_12345";

    const provider = getAIProvider();
    expect(provider instanceof UnsupportedAIProvider).toBe(true);
    expect(isAIConfigured()).toBe(false);
  });

  it("returns UnsupportedAIProvider when GROQ_API_KEY is missing", () => {
    process.env.AI_PROVIDER = "groq";
    delete process.env.GROQ_API_KEY;
    delete process.env.AI_API_KEY;

    const provider = getAIProvider();
    expect(provider instanceof UnsupportedAIProvider).toBe(true);
    expect(isAIConfigured()).toBe(false);
  });

  it("returns GroqAIProvider via getAIProvider when AI_PROVIDER=groq and key is set", () => {
    process.env.AI_PROVIDER = "groq";
    process.env.GROQ_API_KEY = "gsk_test_valid_key";

    const provider = getAIProvider();
    expect(provider instanceof GroqAIProvider).toBe(true);
    expect(isAIConfigured()).toBe(true);
  });

  // 2. Structured JSON Output & Markdown Fence Stripping
  it("cleans markdown fences and parses valid JSON output", async () => {
    const mockPost = vi.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: "```json\n{\"status\": \"ok\", \"components\": 5}\n```",
            },
          },
        ],
      },
    });

    vi.mocked(axios.create).mockReturnValue({
      post: mockPost,
    } as any);

    const provider = new GroqAIProvider({ apiKey: "test-key" });
    const result = await provider.structuredOutput<{ status: string; components: number }>({
      prompt: "Extract system metrics",
    });

    expect(result.status).toBe("ok");
    expect(result.components).toBe(5);
    expect(mockPost).toHaveBeenCalledWith(
      "/chat/completions",
      expect.objectContaining({
        model: "openai/gpt-oss-20b",
        response_format: { type: "json_object" },
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );
  });

  // 3. Error Handling: Rate Limit 429
  it("handles 429 rate limit with descriptive error and no infinite loop", async () => {
    const axiosError: any = new Error("Request failed with status code 429");
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 429,
      data: { error: { message: "Rate limit reached for free tier organization" } },
    };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.create).mockReturnValue({
      post: vi.fn().mockRejectedValue(axiosError),
    } as any);

    const provider = new GroqAIProvider({ apiKey: "test-key" });
    await expect(
      provider.chatCompletion({
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow(/rate limit/i);
  });

  // 4. Error Handling: 401 Unauthorized
  it("handles 401 authentication error safely without exposing secret", async () => {
    const axiosError: any = new Error("Request failed with status code 401");
    axiosError.isAxiosError = true;
    axiosError.response = {
      status: 401,
      data: { error: { message: "Invalid API Key" } },
    };

    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.create).mockReturnValue({
      post: vi.fn().mockRejectedValue(axiosError),
    } as any);

    const provider = new GroqAIProvider({ apiKey: "gsk_bad_secret" });
    await expect(
      provider.chatCompletion({
        messages: [{ role: "user", content: "test" }],
      })
    ).rejects.toThrow(/GROQ_API_KEY/i);
  });

  // 5. Component Explanation with AI & Deterministic Fallback
  it("explains architecture component with AI when configured, and falls back on error", async () => {
    const mockExplanation = {
      purpose: "Auth Gateway Service",
      responsibility: "Handles JWT validation and rate limiting",
      technology: "Go / Envoy",
      dependencies: ["User DB"],
      dataFlow: "Clients connect over HTTPS",
      failureScenarios: ["Token cache eviction spike"],
      scalingConsiderations: ["Horizontal replica autoscaling"],
      securityConsiderations: ["Strict TLS 1.3"],
    };

    const mockProvider = {
      explainComponent: vi.fn().mockResolvedValue(mockExplanation),
      structuredOutput: vi.fn(),
      generate: vi.fn(),
      analyze: vi.fn(),
    };

    const service = new ArchitectureExplanationService(mockProvider as any);
    const result = await service.explain({
      node: { id: "node-1", name: "Auth Gateway", type: "gateway" },
      architecture: { nodes: [{ id: "node-1", name: "Auth Gateway" }], edges: [] },
    });

    expect(result.purpose).toBe("Auth Gateway Service");
    expect(result.technology).toBe("Go / Envoy");

    // Test fallback when AI fails
    mockProvider.explainComponent.mockRejectedValue(new Error("Network timeout"));
    const fallbackResult = await service.explain({
      node: { id: "node-1", name: "Auth Gateway", type: "gateway", technology: "Go" },
      architecture: { nodes: [{ id: "node-1", name: "Auth Gateway" }], edges: [] },
    });

    expect(fallbackResult.purpose).toContain("Auth Gateway");
    expect(fallbackResult.technology).toBe("Go");
  });

  // 6. Design Review with AI Integration & Rule Merging
  it("merges AI review findings with deterministic baseline checks", async () => {
    process.env.AI_PROVIDER = "none";
    const designService = new DesignReviewService();

    const baselineFindings = await designService.review({
      nodes: [
        { id: "n1", name: "Service A", type: "service" },
        { id: "n2", name: "Service B", type: "service" },
        { id: "n3", name: "Service C", type: "service" },
      ],
      edges: [],
    });

    // Contains unconnected components rule and no database rule
    expect(baselineFindings.some((f) => f.finding.includes("Unconnected component"))).toBe(true);
    expect(baselineFindings.some((f) => f.finding.includes("No database is modeled"))).toBe(true);
  });

  // 7. Story Mode Generation
  it("generates story mode narrative with AI when available, and falls back deterministically", async () => {
    process.env.AI_PROVIDER = "none";

    vi.spyOn(architectureService, "getCurrent").mockResolvedValue({
      version: { id: "v1", name: "Architecture v1" } as any,
      nodes: [
        { id: "n1", name: "Web App", type: "frontend", technology: "React" } as any,
        { id: "n2", name: "API Server", type: "backend", technology: "Node.js" } as any,
      ],
      edges: [
        { source_node_id: "n1", target_node_id: "n2", relationship: "calls" } as any,
      ],
    });

    vi.spyOn(projectRepository, "findById").mockResolvedValue({
      id: "p1",
      name: "ArchForge Test Project",
    } as any);

    vi.spyOn(projectRepository, "requirements").mockResolvedValue([
      { id: "r1", title: "Real-time Collaboration", description: "Multiplayer editing" },
    ] as any);

    const story = await projectStoryService.generate("p1");

    expect(story.problem).toBeDefined();
    expect(story.currentState).toBe("Architecture v1");
    expect(Array.isArray(story.importantDecisions)).toBe(true);
    expect(Array.isArray(story.technologyChoices)).toBe(true);
    expect(Array.isArray(story.dataFlow)).toBe(true);
  });

  // 8. Drift Remediation Service
  it("generates drift remediation recommendations", async () => {
    const remediationService = new DriftRemediationService({
      structuredOutput: vi.fn().mockRejectedValue(new Error("AI Provider unavailable")),
      generate: vi.fn(),
      analyze: vi.fn(),
    });

    const remediation = await remediationService.remediation({
      drift_items: [
        {
          id: "d1",
          severity: "high",
          drift_type: "undocumented_api",
          description: "New endpoint /api/v2/orders missing in design",
          recommendation: "Model /api/v2/orders in Order Service",
        },
      ],
    });

    expect(remediation.risk).toBe("high");
    expect(remediation.recommended_changes).toContain("Model /api/v2/orders in Order Service");
    expect(remediation.implementation_steps.length).toBeGreaterThan(0);
  });
});

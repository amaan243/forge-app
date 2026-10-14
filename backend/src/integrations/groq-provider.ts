import axios, { type AxiosInstance } from "axios";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { AppError } from "../errors/app-error.js";
import type { AIProvider } from "./ai-provider.js";
import type { GeneratedArchitecture } from "../types/architecture.js";
import type { DesignReviewFinding } from "../types/engineering-intelligence.js";
import type { ArchitectureExplanation } from "../services/architecture-explanation-service.js";
import type { DriftRemediation } from "../services/drift-remediation-service.js";
import { generatedArchitectureSchema } from "../validators/architecture.js";

export interface GroqProviderConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

export class GroqAIProvider implements AIProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly client: AxiosInstance;

  constructor(config: GroqProviderConfig = {}) {
    this.apiKey =
      config.apiKey ||
      process.env.GROQ_API_KEY ||
      env.GROQ_API_KEY ||
      process.env.AI_API_KEY ||
      env.AI_API_KEY ||
      "";
    this.model =
      config.model ||
      process.env.GROQ_MODEL ||
      env.GROQ_MODEL ||
      "openai/gpt-oss-20b";

    this.client = axios.create({
      baseURL: "https://api.groq.com/openai/v1",
      timeout: config.timeoutMs ?? 30000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ArchForge-Engine/1.0",
      },
    });
  }

  isAvailable(): boolean {
    const provider = (process.env.AI_PROVIDER || env.AI_PROVIDER || "").toLowerCase();
    return provider === "groq" && Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  getModelName(): string {
    return this.model;
  }

  /**
   * Helper to clean JSON string from possible markdown fences (```json ... ```)
   */
  private cleanJsonResponse(raw: string): string {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    return cleaned.trim();
  }

  /**
   * Core chat completion caller with token bounding, rate limit detection, and structured JSON parsing.
   */
  async chatCompletion(options: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  }): Promise<string> {
    if (!this.apiKey) {
      throw new AppError(
        "GROQ_API_KEY is not configured on the ArchForge server. Please set GROQ_API_KEY in backend/.env.",
        503,
        "AI_CONFIG_MISSING"
      );
    }

    const payload: Record<string, unknown> = {
      model: this.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.2,
      max_completion_tokens: options.maxTokens ?? 4096,
    };

    if (options.jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    try {
      const response = await this.client.post("/chat/completions", payload, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      const choice = response.data?.choices?.[0];
      const content = choice?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("Empty response received from Groq model");
      }

      return content;
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const errorData = err.response?.data?.error;
        const errorMsg = errorData?.message || err.message;

        if (status === 429) {
          logger.warn("Groq rate limit encountered (HTTP 429).", { model: this.model });
          throw new AppError(
            "Groq free tier rate limit reached. Please wait a moment before trying again or check your token quotas.",
            429,
            "GROQ_RATE_LIMITED"
          );
        }

        if (status === 401) {
          logger.error("Groq authentication failed (HTTP 401). Invalid GROQ_API_KEY.");
          throw new AppError(
            "Invalid GROQ_API_KEY provided. Please check your credentials in backend/.env.",
            401,
            "GROQ_UNAUTHORIZED"
          );
        }

        if (status === 404) {
          logger.error("Groq model not found (HTTP 404):", { model: this.model });
          throw new AppError(
            `Configured Groq model "${this.model}" was not found or is unavailable on your account.`,
            404,
            "GROQ_MODEL_NOT_FOUND"
          );
        }

        logger.error("Groq API request failed:", { status, message: errorMsg });
        throw new AppError(`Groq AI request failed: ${errorMsg}`, 502, "GROQ_PROVIDER_ERROR");
      }

      throw err;
    }
  }

  /**
   * Generic structured JSON output generator with schema validation
   */
  async structuredOutput<T>(input: {
    prompt: string;
    systemPrompt?: string;
    schema?: unknown;
    maxTokens?: number;
  }): Promise<T> {
    const systemPrompt =
      input.systemPrompt ||
      "You are a Software Architecture AI Assistant on ArchForge. You provide rigorous, production-grade software engineering analysis. Always output strictly valid JSON matching the requested structure.";

    const content = await this.chatCompletion({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.prompt },
      ],
      jsonMode: true,
      maxTokens: input.maxTokens || 4096,
      temperature: 0.2,
    });

    const cleaned = this.cleanJsonResponse(content);
    try {
      return JSON.parse(cleaned) as T;
    } catch (jsonErr: any) {
      logger.error("Failed to parse JSON from Groq completion:", { cleanedSnippet: cleaned.slice(0, 300) });
      throw new AppError("Invalid JSON structure returned by Groq AI model", 502, "INVALID_AI_JSON");
    }
  }

  /**
   * Architecture Generation from requirements
   */
  async generate(input: { requirements: string; projectName?: string }): Promise<GeneratedArchitecture> {
    const prompt = `Project: ${input.projectName || "Software Project"}
Requirements:
${input.requirements}

Generate a production-grade software architecture graph in JSON matching this exact structure:
{
  "name": "System Architecture Title",
  "summary": "Executive architectural overview and rationale",
  "assumptions": ["List of core technical assumptions"],
  "nodes": [
    {
      "node_key": "unique_kebab_case_id",
      "name": "Component Display Name",
      "type": "frontend|backend|service|database|cache|queue|storage|external_service|auth|worker|api|gateway|monitoring|infrastructure",
      "technology": "e.g. Next.js, Node.js, PostgreSQL, Redis, Kafka",
      "description": "Component boundary and responsibility",
      "position_x": 100,
      "position_y": 150
    }
  ],
  "edges": [
    {
      "source_node_key": "source_component_key",
      "target_node_key": "target_component_key",
      "relationship": "calls|reads|writes|publishes|subscribes|authenticates|depends_on|connects_to",
      "protocol": "e.g. HTTPS, gRPC, TCP, AMQP",
      "description": "Data flow or protocol details"
    }
  ],
  "technologies": ["List of all distinct technologies chosen"],
  "securityConsiderations": ["List of security boundaries, encryption, auth rules"],
  "scalabilityConsiderations": ["List of scaling patterns, caching, partitioning"],
  "risks": ["List of architectural risks or single points of failure"]
}`;

    const raw = await this.structuredOutput<unknown>({
      prompt,
      systemPrompt:
        "You are an expert Chief Software Architect. Given user software requirements, design an enterprise-grade cloud system architecture topology with modular services, data stores, caches, gateways, and protocols. Return strictly valid JSON adhering to the specified schema.",
      maxTokens: 4096,
    });

    const parsed = generatedArchitectureSchema.safeParse(raw);
    if (!parsed.success) {
      logger.warn("Groq generated architecture failed zod schema validation:", parsed.error.format());
      throw new AppError("Generated architecture did not conform to schema requirements", 502, "SCHEMA_VALIDATION_FAILED");
    }

    return parsed.data as GeneratedArchitecture;
  }

  /**
   * Requirement analysis and breakdown
   */
  async analyze(input: { requirements: string }): Promise<unknown> {
    return this.structuredOutput({
      prompt: `Analyze the following system requirements and extract functional requirements, non-functional requirements, constraints, and suggested architectural patterns:\n\n${input.requirements}`,
      systemPrompt: "You are an expert requirements analyst. Output structured JSON with functional, nonFunctional, constraints, and proposedPatterns keys.",
    });
  }

  /**
   * Explain an architecture component with rich engineering context
   */
  async explainComponent(input: {
    node: any;
    architecture: any;
    context?: string;
  }): Promise<ArchitectureExplanation> {
    const node = input.node || {};
    const arch = input.architecture || {};

    const prompt = `Component Details:
Name: ${node.name}
Type: ${node.type}
Technology: ${node.technology || "Unspecified"}
Description: ${node.description || "None provided"}
User Context: ${input.context || "General architecture review"}

Architecture Graph Context:
Total Nodes: ${arch.nodes?.length || 0}
Total Edges: ${arch.edges?.length || 0}
Connected components: ${
      arch.edges
        ?.filter((e: any) => e.source_node_id === node.id || e.target_node_id === node.id)
        ?.map((e: any) => `${e.source_node_id} -> ${e.target_node_id} (${e.relationship})`)
        ?.join("; ") || "None"
    }

Provide a deep engineering explanation in JSON with these exact fields:
{
  "purpose": "Primary purpose and role of this component",
  "responsibility": "Specific boundaries and responsibilities",
  "technology": "Why this technology is suitable and runtime characteristics",
  "dependencies": ["Array of upstream and downstream dependencies with purpose"],
  "dataFlow": "Description of ingress and egress data movements",
  "failureScenarios": ["2-3 realistic failure scenarios and recovery strategies"],
  "scalingConsiderations": ["Horizontal/vertical scaling and performance bottlenecks"],
  "securityConsiderations": ["Authentication, authorization, and data protection measures"]
}`;

    return this.structuredOutput<ArchitectureExplanation>({
      prompt,
      systemPrompt:
        "You are a Staff Systems Architect analyzing a component within a distributed software architecture. Provide crisp, realistic engineering analysis in valid JSON.",
      maxTokens: 2048,
    });
  }

  /**
   * Deep design review with AI recommendations
   */
  async reviewDesign(input: {
    architecture: { nodes: any[]; edges: any[] };
  }): Promise<DesignReviewFinding[]> {
    const nodes = input.architecture.nodes || [];
    const edges = input.architecture.edges || [];

    const prompt = `System Architecture to Review:
Components (${nodes.length}):
${nodes.map((n) => `- [${n.type}] ${n.name} (${n.technology || "default"}) [id: ${n.id}]`).join("\n")}

Connections (${edges.length}):
${edges.map((e) => `- ${e.source_node_id} ${e.relationship} ${e.target_node_id} via ${e.protocol || "standard"}`).join("\n")}

Perform a rigorous software architecture review inspecting:
1. Single points of failure & bottleneck hotspots
2. Security & authorization boundary gaps
3. Resilience, caching, & decoupling opportunities
4. Distributed data consistency & coupling anti-patterns

Return a JSON object with a "findings" array of objects matching:
{
  "findings": [
    {
      "finding": "Clear title of the architectural finding",
      "severity": "low|medium|high|critical",
      "evidence": ["Specific component names or edges demonstrating this issue"],
      "explanation": "Detailed explanation of the risk and technical impact",
      "recommendation": "Concrete, actionable architectural remediation",
      "component_ids": ["ids of affected components"]
    }
  ]
}`;

    const res = await this.structuredOutput<{ findings: DesignReviewFinding[] }>({
      prompt,
      systemPrompt:
        "You are an Elite Enterprise Architecture Reviewer. Evaluate the supplied topology graph for reliability, scalability, performance, and security flaws. Provide practical, high-impact findings in valid JSON.",
      maxTokens: 3072,
    });

    return Array.isArray(res?.findings) ? res.findings : [];
  }

  /**
   * Generate complete engineering project narrative for Story Mode
   */
  async generateStory(input: {
    projectName: string;
    requirements: any[];
    architecture: { nodes: any[]; edges: any[]; version?: any };
  }): Promise<Record<string, unknown>> {
    const nodes = input.architecture.nodes || [];
    const edges = input.architecture.edges || [];
    const requirements = input.requirements || [];

    const prompt = `Project Name: ${input.projectName}
Current Version: ${input.architecture.version?.name || "Baseline"}
Requirements (${requirements.length}):
${requirements.map((r: any) => `- ${r.title || r.id}: ${r.description || ""}`).join("\n")}

Architecture Nodes (${nodes.length}):
${nodes.map((n) => `- ${n.name} (${n.type}, ${n.technology || "tech"})`).join("\n")}

Architecture Edges (${edges.length}):
${edges.map((e) => `- ${e.source_node_id} -> ${e.target_node_id} (${e.relationship})`).join("\n")}

Synthesize a cohesive, high-impact engineering project narrative for the ArchForge Story Mode presentation.
Return valid JSON with this exact schema:
{
  "problem": "Comprehensive statement of the problem, domain challenge, and business context this project addresses.",
  "currentState": "${input.architecture.version?.name || "Production Architecture v1"}",
  "requirements": ["Summarized key functional and architectural requirements"],
  "architecture": ["Core topology overview and component interactions"],
  "importantDecisions": [
    {
      "decision": "Architectural decision made",
      "rationale": "Why this approach was selected",
      "tradeOff": "Accepted compromise or technical trade-off"
    }
  ],
  "technologyChoices": [
    {
      "name": "Technology name",
      "category": "Frontend | Backend | Database | Messaging | Infrastructure",
      "reason": "Why this stack was selected for this workload"
    }
  ],
  "dataFlow": [
    "Step-by-step description of critical path data flow through the system"
  ],
  "security": [
    "Security pillars: auth boundaries, zero trust, encryption, secrets management"
  ],
  "scalability": [
    "Scalability strategy: stateless tiers, horizontal scale, caching, asynchronous queues"
  ],
  "tradeOffs": [
    "Major architectural trade-offs accepted in this design"
  ],
  "evolution": [
    "Future architecture roadmap and next evolution milestones"
  ]
}`;

    return this.structuredOutput<Record<string, unknown>>({
      prompt,
      systemPrompt:
        "You are a Lead Software Architect presenting a system design story to engineering leadership. Synthesize a professional, accurate narrative that highlights architectural rigor, intentional trade-offs, and technology rationale in valid JSON.",
      maxTokens: 4096,
    });
  }

  /**
   * AI Drift Remediation Planner
   */
  async remediateDrift(input: any): Promise<DriftRemediation> {
    const items = input.drift_items || input.items || [];

    const prompt = `Detected Architecture Drifts (${items.length}):
${items.map((i: any, idx: number) => `${idx + 1}. [${i.severity}] ${i.drift_type || i.type}: ${i.description || i.finding} (Recommendation: ${i.recommendation || "N/A"})`).join("\n")}

Generate an actionable, engineering remediation plan in valid JSON matching:
{
  "problem": "Clear summary of the architectural deviations detected between code and design",
  "root_cause": "Underlying technical cause for how this drift materialized",
  "recommended_changes": ["Array of prioritized architectural and code corrections"],
  "affected_components": ["List of component names or modules needing changes"],
  "risk": "low|medium|high|critical",
  "implementation_steps": [
    "Step 1: Concrete remediation action",
    "Step 2: Concrete remediation action"
  ]
}`;

    return this.structuredOutput<DriftRemediation>({
      prompt,
      systemPrompt:
        "You are an Architecture Governance Lead. Given detected architectural drift items between a codebase and its intended architecture, formulate a practical, step-by-step remediation plan in valid JSON.",
      maxTokens: 2048,
    });
  }
}

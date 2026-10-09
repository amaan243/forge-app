import { generatedArchitectureSchema } from "../validators/architecture.js";
import type { GeneratedArchitecture, ArchitectureNodeType, ArchitectureRelationship } from "../types/architecture.js";
import type { Requirement } from "../types/api.js";

export interface PreviewNode {
  id: string;
  node_key: string;
  name: string;
  type: ArchitectureNodeType;
  technology?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  position_x: number;
  position_y: number;
}

export interface PreviewEdge {
  source: string;
  target: string;
  source_node_key: string;
  target_node_key: string;
  relationship: ArchitectureRelationship;
  protocol?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface ArchitecturePreviewData extends GeneratedArchitecture {
  nodes: PreviewNode[];
  edges: PreviewEdge[];
}

export class DeterministicArchitectureGenerator {
  generate(requirements: Requirement[], projectName?: string): ArchitecturePreviewData {
    if (!requirements || requirements.length === 0) {
      throw new Error("Cannot generate architecture without requirements");
    }

    // Normalize requirement text
    const rawText = requirements.map((r) => r.content).join("\n");
    const normalizedText = rawText.toLowerCase();

    // Node candidate pool
    const detectedNodes: Map<string, PreviewNode> = new Map();

    const addNode = (
      key: string,
      name: string,
      type: ArchitectureNodeType,
      technology: string,
      description: string,
      tier: number
    ) => {
      if (!detectedNodes.has(key)) {
        detectedNodes.set(key, {
          id: key,
          node_key: key,
          name,
          type,
          technology,
          description,
          metadata: { tier },
          position_x: 0,
          position_y: 0,
        });
      }
    };

    // ─── Capability Extraction ──────────────────────────────────────────────

    // 1. Semantic Search / Vector AI capability
    const hasSemanticSearch = /\b(semantic search|vector search|embeddings?|vector db|vector database|similarity search|rag)\b/.test(
      normalizedText
    );

    // 2. Document / PDF / File upload capability
    const hasFileUpload = /\b(upload|uploads|uploaded|pdf|pdfs|file|files|documents?|attachments?|blobs?|media)\b/.test(
      normalizedText
    );

    // 3. Authentication & User Identity capability
    const hasAuth = /\b(auth|authenticate|authentication|login|log in|signin|sign in|signup|sign up|register|registration|password|passwords|jwt|oauth|credentials|session|sessions|rbac|permissions?|roles?)\b/.test(
      normalizedText
    );

    // Explicit User Profile Management (distinguished from just English "users should...")
    const hasUserMgmt = /\b(user profile|user profiles|user accounts?|user directory|account management|user management|teams?|workspaces?|tenants?)\b/.test(
      normalizedText
    );

    // 4. Email & Notification capability
    const hasEmailNotif = /\b(email|emails|notification|notifications|notify|alerts?|sms|push notifications?|mailer|smtp|webhook)\b/.test(
      normalizedText
    );

    // 5. Payments & Billing capability
    const hasBilling = /\b(payment|payments|billing|stripe|subscriptions?|invoices?|checkout|pricing)\b/.test(
      normalizedText
    );

    // 6. Caching capability
    const hasCache = /\b(cache|caching|redis|in-memory|memcached|fast lookup|low latency)\b/.test(
      normalizedText
    );

    // 7. Background Worker / Queue capability
    const hasQueue = /\b(queue|queues|worker|workers|background jobs?|async processing|batch|cron|scheduled|rabbitmq|kafka|bullmq)\b/.test(
      normalizedText
    );

    // 8. Realtime / WebSocket capability
    const hasRealtime = /\b(realtime|real-time|websockets?|sockets?|live updates?|sse)\b/.test(
      normalizedText
    );

    // 9. Analytics & Metrics capability
    const hasAnalytics = /\b(analytics|telemetry|metrics|insights|usage tracking|dashboard reporting)\b/.test(
      normalizedText
    );

    // 10. General Database / Relational storage
    const hasDatabase = /\b(database|postgres|postgresql|sql|mysql|relational|persistent storage|tables?)\b/.test(
      normalizedText
    );

    // 11. Keyword Search (only if not already semantic search)
    const hasKeywordSearch = !hasSemanticSearch && /\b(search|searching|full-text search|indexing|catalog search)\b/.test(
      normalizedText
    );

    // ─── Component Mapping Based on Detected Capabilities ───────────────────

    // Always provide client presentation layer for user-facing projects
    addNode(
      "web_client",
      "Web Application",
      "frontend",
      "React / TypeScript",
      "Interactive client interface and user workspace",
      0
    );

    // Provide API Gateway when multiple services or ingress are needed
    addNode(
      "api_gateway",
      "API Gateway",
      "gateway",
      "Reverse Proxy / Express",
      "API ingress routing, rate limiting, and request termination",
      1
    );

    // Map: Semantic Search
    if (hasSemanticSearch) {
      addNode(
        "embedding_service",
        "Embedding Service",
        "service",
        "ML / Embedding Pipeline",
        "Generates dense vector embeddings for document text chunks",
        2
      );
      addNode(
        "vector_database",
        "Vector Database",
        "database",
        "pgvector / Pinecone",
        "High-dimensional vector index for semantic similarity search",
        3
      );
    }

    // Map: File / Document Processing
    if (hasFileUpload) {
      addNode(
        "document_service",
        "Document Service",
        "service",
        "Node.js / Document Parser",
        "Handles document ingestion, PDF parsing, and metadata extraction",
        2
      );
      addNode(
        "object_storage",
        "Object Storage",
        "storage",
        "S3 / Cloud Storage",
        "Durable binary storage for uploaded PDF and document files",
        3
      );
    }

    // Map: Authentication
    if (hasAuth) {
      addNode(
        "auth_service",
        "Authentication Service",
        "auth",
        "Node.js / JWT",
        "User credential verification, token signing, and session security",
        2
      );
      addNode(
        "user_service",
        "User Service",
        "service",
        "TypeScript Service",
        "User account profiles and identity record management",
        2
      );
      addNode(
        "primary_database",
        "User Database",
        "database",
        "PostgreSQL",
        "Relational persistence for user accounts and auth credentials",
        3
      );
    } else if (hasUserMgmt) {
      addNode(
        "user_service",
        "User Service",
        "service",
        "TypeScript Service",
        "User account profiles and organization records",
        2
      );
    }

    // Map: Email & Notifications
    if (hasEmailNotif) {
      addNode(
        "notification_service",
        "Notification Service",
        "service",
        "Node.js / Template Engine",
        "Manages transactional emails and event-driven user notifications",
        2
      );
      addNode(
        "email_provider",
        "Email Provider",
        "external_service",
        "Resend / SMTP",
        "External transactional email delivery provider",
        3
      );
    }

    // Map: Payments
    if (hasBilling) {
      addNode(
        "payment_service",
        "Payment Service",
        "service",
        "Stripe SDK / Node.js",
        "Handles checkout sessions, billing subscriptions, and invoices",
        2
      );
      addNode(
        "payment_gateway",
        "Payment Gateway",
        "external_service",
        "Stripe API",
        "External PCI-compliant payment processing gateway",
        3
      );
    }

    // Map: Caching
    if (hasCache) {
      addNode(
        "cache_store",
        "Cache Store",
        "cache",
        "Redis",
        "In-memory store for session validation and low-latency lookups",
        3
      );
    }

    // Map: Background queue & worker
    if (hasQueue) {
      addNode(
        "task_queue",
        "Message Queue",
        "queue",
        "RabbitMQ / SQS",
        "Durable queue for asynchronous background task buffering",
        3
      );
      addNode(
        "worker_service",
        "Background Worker",
        "worker",
        "Node.js Worker",
        "Processes asynchronous background jobs and data pipelines",
        2
      );
    }

    // Map: Realtime
    if (hasRealtime) {
      addNode(
        "realtime_service",
        "Realtime Gateway",
        "service",
        "WebSockets / Socket.io",
        "Duplex connection manager for live state updates",
        2
      );
    }

    // Map: Analytics
    if (hasAnalytics) {
      addNode(
        "analytics_service",
        "Analytics Service",
        "monitoring",
        "ClickHouse / Prometheus",
        "Gathers telemetry events, usage metrics, and audit records",
        2
      );
    }

    // Map: Keyword Search
    if (hasKeywordSearch) {
      addNode(
        "search_service",
        "Search Service",
        "service",
        "Elasticsearch",
        "Full-text search indexing and query retrieval engine",
        2
      );
    }

    // Map: Database if explicitly requested and not already added
    if (hasDatabase && !detectedNodes.has("primary_database")) {
      addNode(
        "primary_database",
        "Primary Database",
        "database",
        "PostgreSQL",
        "Relational database for ACID entity persistence",
        3
      );
    }

    // ─── Domain-specific Services from Requirements ─────────────────────────
    // Extract domain entities when specific nouns are present
    const domainMatchers = [
      { regex: /\b(orders?|checkout|cart)\b/, key: "order_service", name: "Order Service" },
      { regex: /\b(inventory|warehouse|stock)\b/, key: "inventory_service", name: "Inventory Service" },
      { regex: /\b(products?|catalog|items?)\b/, key: "catalog_service", name: "Catalog Service" },
      { regex: /\b(chat|messages?|conversations?)\b/, key: "chat_service", name: "Chat Service" },
      { regex: /\b(workflows?|pipeline|automation)\b/, key: "workflow_service", name: "Workflow Service" },
    ];

    for (const m of domainMatchers) {
      if (m.regex.test(normalizedText) && !detectedNodes.has(m.key)) {
        addNode(m.key, m.name, "service", "TypeScript Microservice", `Handles ${m.name.toLowerCase()} domain logic`, 2);
      }
    }

    // If no middle service exists at all, provide a single focused service from the first requirement
    const middleServices = Array.from(detectedNodes.values()).filter(
      (n) => n.type === "service" || n.type === "auth" || n.type === "worker"
    );
    if (middleServices.length === 0) {
      const firstLine = requirements[0]?.content.split("\n")[0].trim().replace(/^[-*#\d.]+\s*/, "") || "Application";
      const cleanName = firstLine.length > 25 ? `${firstLine.slice(0, 22)}...` : firstLine;
      addNode(
        "app_service",
        `${cleanName} Service`,
        "service",
        "Node.js / TypeScript",
        requirements[0]?.content.slice(0, 120) || "Core application logic service",
        2
      );
    }

    // ─── Deterministic Tier Layout ──────────────────────────────────────────
    const tiers: Map<number, PreviewNode[]> = new Map();
    for (const node of detectedNodes.values()) {
      const tier = (node.metadata?.tier as number) ?? 2;
      if (!tiers.has(tier)) tiers.set(tier, []);
      tiers.get(tier)!.push(node);
    }

    const tierY = [40, 160, 290, 430];
    const spacing = 190;

    for (let t = 0; t <= 3; t++) {
      const nodesInTier = tiers.get(t) || [];
      const count = nodesInTier.length;
      if (count > 0) {
        const totalW = (count - 1) * spacing;
        const startX = Math.max(60, 420 - totalW / 2);
        nodesInTier.forEach((node, i) => {
          node.position_x = Math.round(startX + i * spacing);
          node.position_y = tierY[t];
        });
      }
    }

    const nodesList = Array.from(detectedNodes.values());

    // ─── Logical Edge Generation ───────────────────────────────────────────
    const edgesList: PreviewEdge[] = [];
    const addedEdgeKeys = new Set<string>();

    const addEdge = (
      sourceKey: string,
      targetKey: string,
      relationship: ArchitectureRelationship,
      protocol: string,
      desc: string
    ) => {
      if (!detectedNodes.has(sourceKey) || !detectedNodes.has(targetKey) || sourceKey === targetKey) {
        return;
      }
      const edgeKey = `${sourceKey}->${targetKey}`;
      if (!addedEdgeKeys.has(edgeKey)) {
        addedEdgeKeys.add(edgeKey);
        edgesList.push({
          source: sourceKey,
          target: targetKey,
          source_node_key: sourceKey,
          target_node_key: targetKey,
          relationship,
          protocol,
          description: desc,
          metadata: {},
        });
      }
    };

    // Client -> Gateway
    addEdge("web_client", "api_gateway", "calls", "HTTP", "Client HTTPS requests to API Gateway");

    // Gateway -> Services
    const activeServices = nodesList.filter(
      (n) => n.type === "service" || n.type === "auth" || n.type === "worker"
    );

    for (const s of activeServices) {
      if (s.node_key === "auth_service") {
        addEdge("api_gateway", "auth_service", "authenticates", "AUTH", "Gateway authenticates via Auth Service");
      } else if (s.node_key !== "worker_service") {
        addEdge("api_gateway", s.node_key, "calls", "API", `Gateway routes API traffic to ${s.name}`);
      }
    }

    // Document Processing & Semantic Search Connections
    if (detectedNodes.has("document_service") && detectedNodes.has("object_storage")) {
      addEdge("document_service", "object_storage", "connects_to", "STORAGE", "Document Service uploads to Object Storage");
    }

    if (detectedNodes.has("document_service") && detectedNodes.has("embedding_service")) {
      addEdge("document_service", "embedding_service", "calls", "DATA_FLOW", "Sends text chunks to generate vector embeddings");
    }

    if (detectedNodes.has("embedding_service") && detectedNodes.has("vector_database")) {
      addEdge("embedding_service", "vector_database", "writes", "VECTOR", "Stores embeddings in Vector Database");
    }

    if (detectedNodes.has("document_service") && detectedNodes.has("vector_database")) {
      addEdge("document_service", "vector_database", "reads", "SEARCH", "Queries vector index for semantic similarity search");
    }

    // Auth & User -> Database
    if (detectedNodes.has("auth_service") && detectedNodes.has("primary_database")) {
      addEdge("auth_service", "primary_database", "reads", "DATABASE", "Auth Service verifies credentials against Database");
    }
    if (detectedNodes.has("user_service") && detectedNodes.has("primary_database")) {
      addEdge("user_service", "primary_database", "writes", "DATABASE", "User Service updates accounts in Database");
    }

    // Notification -> Email Provider
    if (detectedNodes.has("notification_service") && detectedNodes.has("email_provider")) {
      addEdge("notification_service", "email_provider", "calls", "EXTERNAL", "Notification Service dispatches emails via Email Provider");
    }

    // Payment -> Payment Gateway
    if (detectedNodes.has("payment_service") && detectedNodes.has("payment_gateway")) {
      addEdge("payment_service", "payment_gateway", "calls", "EXTERNAL", "Payment Service interacts with Payment Gateway");
    }

    // Services -> Cache
    if (detectedNodes.has("cache_store")) {
      if (detectedNodes.has("auth_service")) {
        addEdge("auth_service", "cache_store", "reads", "CACHE", "Session token lookup");
      }
      if (detectedNodes.has("api_gateway")) {
        addEdge("api_gateway", "cache_store", "reads", "CACHE", "Rate limit check");
      }
    }

    // Services -> Queue & Worker
    if (detectedNodes.has("task_queue")) {
      if (detectedNodes.has("document_service")) {
        addEdge("document_service", "task_queue", "publishes", "QUEUE", "Enqueues background document processing");
      }
      if (detectedNodes.has("worker_service")) {
        addEdge("task_queue", "worker_service", "subscribes", "QUEUE", "Worker pulls async jobs from queue");
      }
    }

    // General Database connection for domain services if present
    if (detectedNodes.has("primary_database")) {
      for (const s of activeServices) {
        if (s.node_key !== "auth_service" && s.node_key !== "user_service" && s.node_key !== "worker_service") {
          addEdge(s.node_key, "primary_database", "reads", "DATABASE", `${s.name} reads/writes entity state`);
        }
      }
    }

    // Compile technologies
    const technologies = Array.from(
      new Set(nodesList.map((n) => n.technology).filter(Boolean) as string[])
    );

    const result: ArchitecturePreviewData = {
      name: projectName ? `${projectName} Architecture` : "System Architecture",
      summary: `Requirement-sensitive architecture generated from ${requirements.length} requirement${
        requirements.length === 1 ? "" : "s"
      }`,
      assumptions: [
        "Architecture derived deterministically from specific project requirements",
        "Components scale independently based on capability requirements",
        "Published architecture versions are immutable snapshots",
      ],
      nodes: nodesList,
      edges: edgesList,
      technologies,
      securityConsiderations: [
        "API Gateway maintains external security perimeter",
        "Services operate with least-privilege resource access",
        "Data stores isolated to backend networks",
      ],
      scalabilityConsiderations: [
        "Independent horizontal scaling per capability layer",
        "Dedicated databases tailored to workload type (relational vs vector)",
      ],
      risks: [
        "Monitor latency and throughput across inter-service connections",
      ],
    };

    // Validate with Zod
    generatedArchitectureSchema.parse(result);

    return result;
  }
}

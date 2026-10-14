import { useState } from "react";
import {
  Network,
  GitBranch,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Activity,
  FileCode,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DemoNode {
  id: string;
  name: string;
  type: "edge" | "microservice" | "event" | "database" | "external";
  tech: string;
  repoFile: string;
  port: number;
  inbound: string[];
  outbound: string[];
  driftStatus: "clean" | "warning";
  driftNote?: string;
  description: string;
  sla: string;
  x: number;
  y: number;
}

const DEMO_NODES: DemoNode[] = [
  {
    id: "edge-waf",
    name: "CloudFront + Edge WAF",
    type: "edge",
    tech: "AWS CloudFront / AWS WAF",
    repoFile: "infra/terraform/edge-ingress.tf",
    port: 443,
    inbound: [],
    outbound: ["api-gateway"],
    driftStatus: "clean",
    description: "Global edge TLS termination, DDoS mitigation, and geo-distributed cache.",
    sla: "99.99% Availability",
    x: 8,
    y: 40,
  },
  {
    id: "api-gateway",
    name: "API Gateway (Envoy)",
    type: "edge",
    tech: "Envoy Proxy / Go",
    repoFile: "services/gateway/src/routes.go",
    port: 8443,
    inbound: ["edge-waf"],
    outbound: ["auth-svc", "order-svc", "catalog-svc"],
    driftStatus: "clean",
    description: "L7 routing, JWT authentication validation, rate limiting, and CORS enforcement.",
    sla: "< 8ms p99 latency",
    x: 32,
    y: 40,
  },
  {
    id: "auth-svc",
    name: "Auth & Identity Provider",
    type: "microservice",
    tech: "Node.js 22 / TypeScript",
    repoFile: "services/auth/src/controller.ts",
    port: 3001,
    inbound: ["api-gateway"],
    outbound: ["redis-cache"],
    driftStatus: "clean",
    description: "OAuth2 / OIDC token issuance, refresh token rotation, and RBAC policy evaluation.",
    sla: "Zero-Trust mTLS",
    x: 58,
    y: 12,
  },
  {
    id: "order-svc",
    name: "Order & Checkout Service",
    type: "microservice",
    tech: "Go 1.22 / Chi Router",
    repoFile: "services/orders/cmd/server/main.go",
    port: 8080,
    inbound: ["api-gateway"],
    outbound: ["payment-gw", "kafka-mesh", "postgres-db"],
    driftStatus: "warning",
    driftNote: "Codebase contains unmapped direct connection to stripe-adapter not declared in original v1 spec.",
    description: "Coordinates shopping cart checkout, order persistence, and asynchronous fulfillment dispatch.",
    sla: "< 25ms p99 latency",
    x: 58,
    y: 40,
  },
  {
    id: "catalog-svc",
    name: "Catalog & Search Service",
    type: "microservice",
    tech: "Rust / Axum",
    repoFile: "services/catalog/src/main.rs",
    port: 8085,
    inbound: ["api-gateway"],
    outbound: ["redis-cache", "postgres-db"],
    driftStatus: "clean",
    description: "High-throughput search engine, catalog indexing, and real-time inventory checks.",
    sla: "< 12ms p99 latency",
    x: 58,
    y: 68,
  },
  {
    id: "payment-gw",
    name: "Payment Gateway Adapter",
    type: "external",
    tech: "Stripe SDK / Webhooks",
    repoFile: "services/orders/src/integrations/payment.ts",
    port: 443,
    inbound: ["order-svc"],
    outbound: ["kafka-mesh"],
    driftStatus: "warning",
    driftNote: "Detected undocumented webhook retry queue parameter in repo AST.",
    description: "Encrypted payment capture, idempotency keys, and 3D-Secure charge authorization.",
    sla: "PCI-DSS Level 1",
    x: 82,
    y: 18,
  },
  {
    id: "kafka-mesh",
    name: "Kafka Event Mesh",
    type: "event",
    tech: "Apache Kafka 3.6",
    repoFile: "deploy/helm/kafka-cluster.yaml",
    port: 9092,
    inbound: ["order-svc", "payment-gw"],
    outbound: ["postgres-db"],
    driftStatus: "clean",
    description: "Durable event log for order.created, payment.authorized, and inventory.allocated events.",
    sla: "At-least-once delivery",
    x: 82,
    y: 44,
  },
  {
    id: "redis-cache",
    name: "Redis Cluster (Cache)",
    type: "database",
    tech: "Redis 7.2 / Sentinels",
    repoFile: "services/catalog/src/cache.rs",
    port: 6379,
    inbound: ["auth-svc", "catalog-svc"],
    outbound: [],
    driftStatus: "clean",
    description: "Distributed cache for hot product items, user session tokens, and rate limit buckets.",
    sla: "< 1ms read latency",
    x: 32,
    y: 72,
  },
  {
    id: "postgres-db",
    name: "Order & Inventory DB",
    type: "database",
    tech: "PostgreSQL 16 (HA Replicas)",
    repoFile: "db/migrations/20260401_init.sql",
    port: 5432,
    inbound: ["order-svc", "catalog-svc", "kafka-mesh"],
    outbound: [],
    driftStatus: "clean",
    description: "ACID compliant relational persistence for orders, line items, customers, and ledger entries.",
    sla: "RPO: 0 / RTO: < 30s",
    x: 82,
    y: 72,
  },
];

export function InteractiveArchitectureDemo() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("order-svc");
  const [viewMode, setViewMode] = useState<"topology" | "drift">("topology");
  const [transformationStep, setTransformationStep] = useState<number>(2);

  const selectedNode = DEMO_NODES.find((n) => n.id === selectedNodeId) || DEMO_NODES[3];

  const isConnected = (nodeId: string) => {
    if (nodeId === selectedNode.id) return true;
    return selectedNode.inbound.includes(nodeId) || selectedNode.outbound.includes(nodeId);
  };

  const isOutbound = (nodeId: string) => selectedNode.outbound.includes(nodeId);
  const isInbound = (nodeId: string) => selectedNode.inbound.includes(nodeId);

  return (
    <div className="w-full surface-panel border-border/80 bg-panel/70 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl">
      {/* Sandbox Control Header */}
      <div className="p-4 sm:p-5 border-b border-border bg-surface/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive Architecture Sandbox</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground">E-Commerce & Checkout Engine</span>
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground tracking-tight mt-0.5">
            Explore live topology, inspect dependencies, and detect architectural drift
          </h3>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-surface/80 p-0.5 text-xs font-mono">
            <button
              onClick={() => setViewMode("topology")}
              className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "topology"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>System Topology</span>
            </button>
            <button
              onClick={() => setViewMode("drift")}
              className={`px-3 py-1 rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "drift"
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>Drift & AST View</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedNodeId("order-svc")}
            className="text-xs font-mono h-8"
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        </div>
      </div>

      {/* Conceptual Transformation Stepper */}
      <div className="px-4 py-2.5 border-b border-border/60 bg-background/50 flex items-center justify-between overflow-x-auto text-xs font-mono select-none">
        <span className="text-[10px] uppercase text-muted-foreground shrink-0 font-semibold mr-3">
          Pipeline Phase:
        </span>
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {[
            { step: 1, label: "1. Requirements Spec" },
            { step: 2, label: "2. Architecture Topology" },
            { step: 3, label: "3. Codebase AST Sync" },
            { step: 4, label: "4. Release Gate Check" },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setTransformationStep(item.step)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] transition-colors ${
                transformationStep === item.step
                  ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${transformationStep >= item.step ? "bg-primary" : "bg-muted"}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Stage: Diagram Grid + Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
        {/* Interactive Diagram Canvas (8 Cols) */}
        <div className="lg:col-span-8 p-4 sm:p-6 relative bg-gradient-to-b from-background/40 to-panel/60 overflow-hidden flex flex-col justify-between">
          {/* Subtle grid background */}
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

          {/* Canvas Instructions Pill */}
          <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Click any node below to inspect communication edges and codebase mappings
            </span>
            <span className="hidden sm:inline text-[10px] text-muted-foreground/70">
              {viewMode === "drift" ? "● Drift Highlight Mode" : "● Standard Topology"}
            </span>
          </div>

          {/* Interactive Nodes Layout */}
          <div className="relative z-10 my-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DEMO_NODES.map((node) => {
              const isSelected = node.id === selectedNode.id;
              const connected = isConnected(node.id);
              const isOut = isOutbound(node.id);
              const isIn = isInbound(node.id);
              const hasDrift = node.driftStatus === "warning";

              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`text-left p-3 rounded-lg border transition-all duration-200 relative group select-none ${
                    isSelected
                      ? "bg-surface border-primary shadow-lg ring-1 ring-primary/40 scale-[1.02]"
                      : connected
                      ? "bg-surface/70 border-primary/40 hover:border-primary/80"
                      : "bg-surface/30 border-border/70 opacity-60 hover:opacity-100 hover:border-border"
                  }`}
                >
                  {/* Status Indicator Tag */}
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1.5">
                    <span
                      className={`uppercase tracking-wider font-semibold ${
                        node.type === "edge"
                          ? "text-[#38BDF8]"
                          : node.type === "microservice"
                          ? "text-[#F59E0B]"
                          : node.type === "event"
                          ? "text-[#818CF8]"
                          : "text-[#10B981]"
                      }`}
                    >
                      {node.type}
                    </span>

                    {viewMode === "drift" ? (
                      hasDrift ? (
                        <span className="flex items-center gap-1 text-warning font-semibold">
                          <AlertTriangle className="h-3 w-3" /> Drift
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="h-3 w-3" /> Synced
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">:{node.port}</span>
                    )}
                  </div>

                  {/* Node Title */}
                  <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {node.name}
                  </div>

                  {/* Node Technology */}
                  <div className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                    {node.tech}
                  </div>

                  {/* Active Relationship Pip */}
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
                  )}
                  {isOut && (
                    <span
                      className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded bg-primary/20 text-primary border border-primary/30 text-[9px] font-mono"
                      title="Outbound dependency"
                    >
                      OUT →
                    </span>
                  )}
                  {isIn && (
                    <span
                      className="absolute -bottom-1 -left-1 px-1 py-0.2 rounded bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 text-[9px] font-mono"
                      title="Inbound consumer"
                    >
                      ← IN
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Connection Legend Bar */}
          <div className="relative z-10 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" /> Active Selection
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Outbound Dependency
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#38BDF8]" /> Inbound Consumer
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {selectedNode.outbound.length} downstream · {selectedNode.inbound.length} upstream
            </div>
          </div>
        </div>

        {/* Live Node Telemetry & Codebase Inspector (4 Cols) */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-border bg-panel p-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Inspector Title */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  Node Telemetry Inspector
                </div>
                <div className="text-sm font-semibold font-display text-foreground">
                  {selectedNode.name}
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {selectedNode.type}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {selectedNode.description}
            </p>

            {/* Drift Callout (if drift view) */}
            {selectedNode.driftStatus === "warning" ? (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Architectural Drift Flagged</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {selectedNode.driftNote}
                </p>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-success/10 border border-success/30 flex items-center gap-2 text-xs text-success font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Synchronized with active repo AST</span>
              </div>
            )}

            {/* Technical Metadata Table */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border">
                <span className="text-muted-foreground">Tech Stack:</span>
                <span className="text-foreground font-medium">{selectedNode.tech}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border">
                <span className="text-muted-foreground">Ingress Port:</span>
                <span className="text-foreground font-medium">:{selectedNode.port}</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-surface/50 border border-border">
                <span className="text-muted-foreground">SLA & Contract:</span>
                <span className="text-primary font-medium">{selectedNode.sla}</span>
              </div>

              <div className="p-2 rounded bg-surface/50 border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase">Linked Source File:</span>
                <div className="text-[11px] text-foreground font-mono truncate flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{selectedNode.repoFile}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-4 border-t border-border mt-4">
            <div className="text-[10px] font-mono text-muted-foreground mb-2">
              Ready to generate architecture for your own repository?
            </div>
            <a
              href="/register"
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
            >
              <span>Model Your Architecture</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Sparkles,
  Workflow,
  Network,
  GitBranch,
  Radar,
  ShieldAlert,
  ShieldCheck,
  FlaskConical,
  FileText,
  Share2,
  Activity,
  History,
  GitCompare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Terminal,
  Compass,
  Boxes,
  Code2,
  Layers,
  ChevronRight,
  Database,
  ExternalLink,
  BookOpen,
  Cpu,
  BarChart3,
  Download,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import React, { lazy, Suspense } from "react";

const Architecture3DScene = lazy(() =>
  import("@/components/landing/3d-architecture-scene").then((m) => ({
    default: m.Architecture3DScene,
  }))
);

const InteractiveArchitectureDemo = lazy(() =>
  import("@/components/landing/interactive-demo").then((m) => ({
    default: m.InteractiveArchitectureDemo,
  }))
);

function Architecture3DSceneSkeleton() {
  return (
    <div className="relative w-full rounded-2xl border border-border/80 bg-panel/85 backdrop-blur-xl overflow-hidden shadow-2xl flex flex-col">
      <div className="px-4 py-3 border-b border-border bg-[#0B1120]/95 flex items-center justify-between text-xs font-mono text-muted-foreground select-none">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span className="text-foreground font-semibold">Stage 1: Software Architecture Core</span>
        </div>
        <span className="text-[11px] text-muted-foreground">Initializing 3D Keplerian Simulation…</span>
      </div>
      <div className="relative w-full h-[380px] xs:h-[450px] sm:h-[540px] lg:h-[640px] bg-gradient-to-b from-[#050811] via-[#090D18] to-[#0E1526] flex flex-col items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <div className="text-xs font-mono text-foreground font-medium">Assembling Engineering Planetary System</div>
          <div className="text-[11px] font-mono text-muted-foreground max-w-xs">Loading WebGL shaders, orbital ephemerides, and telemetry conduits…</div>
        </div>
      </div>
      <div className="p-4 border-t border-border bg-surface/30 flex items-center justify-between text-xs font-mono text-muted-foreground">
        <span>Deterministic Layout</span>
        <span>Three.js Engine</span>
      </div>
    </div>
  );
}

function InteractiveDemoSkeleton() {
  return (
    <div className="surface-panel p-8 rounded-xl border border-border/80 bg-panel/70 flex flex-col items-center justify-center text-center min-h-[380px] space-y-3">
      <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      <div className="text-xs font-mono text-muted-foreground">Loading interactive architecture intelligence demo…</div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ArchForge — Software Architecture Generator & Codebase Intelligence" },
      {
        name: "description",
        content:
          "Turn software requirements into structured architecture, traceable engineering decisions, and production-oriented documentation. Analyze codebases, detect architectural drift, and evaluate release readiness in one engineering workspace.",
      },
      { property: "og:title", content: "ArchForge — From Requirements to Production Architecture" },
      {
        property: "og:description",
        content:
          "AI-powered Software Architecture Generator and Codebase Intelligence Platform. Design systems before you build them.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { isAuthenticated, user } = useAuth();
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);

  const WORKFLOW_STEPS = [
    {
      step: 1,
      title: "Define Requirements",
      subtitle: "Problem capture & constraints",
      desc: "Capture system requirements, functional constraints, latency targets, and scalability needs in structured engineering specifications.",
      features: ["Requirement categorization", "Security constraints", "System scale targets"],
      route: "/workspace",
      icon: FileText,
    },
    {
      step: 2,
      title: "Generate Architecture",
      subtitle: "Topology & service synthesis",
      desc: "Synthesize interconnected microservices, API boundaries, event streams, and database schemas with versioned architectural baselines.",
      features: ["Automated topology synthesis", "Port/protocol mapping", "Multi-version snapshots"],
      route: "/architecture",
      icon: Network,
    },
    {
      step: 3,
      title: "Analyze the Repository",
      subtitle: "Codebase AST extraction",
      desc: "Connect your git repository to inspect snapshot files, framework technologies, dependency graphs, API routes, and database models.",
      features: ["Static AST analysis", "Package dependency tree", "Route & entity discovery"],
      route: "/repository",
      icon: GitBranch,
    },
    {
      step: 4,
      title: "Detect Drift & Assess Impact",
      subtitle: "Model vs implementation alignment",
      desc: "Compare your intended architecture design with actual codebase reality. Identify undeclared dependencies and calculate change blast radius.",
      features: ["AST drift detection", "Discrepancy scoring", "Blast radius simulation"],
      route: "/drift",
      icon: Radar,
    },
    {
      step: 5,
      title: "Simulate Engineering Decisions",
      subtitle: "Tradeoff evaluation sandbox",
      desc: "Use the Engineering Playground to model proposed modifications, calculate estimated latency/cost tradeoffs, and evaluate alternatives before writing code.",
      features: ["Interactive node mutation", "Tradeoff matrix", "Scenario rollback"],
      route: "/playground",
      icon: FlaskConical,
    },
    {
      step: 6,
      title: "Generate Documentation & Traceability",
      subtitle: "Source-aware documentation",
      desc: "Generate synchronized OpenAPI specs, Markdown guides, and architectural decision records (ADRs) linked directly to repository entities in a Knowledge Graph.",
      features: ["Living ADR documents", "Bidirectional traceability", "OpenAPI & Markdown export"],
      route: "/documentation",
      icon: Share2,
    },
    {
      step: 7,
      title: "Evaluate Release Readiness",
      subtitle: "Deterministic quality gates",
      desc: "Review automated CI test results, security posture evaluations, architecture alignment score, and unresolved engineering risks before deployment.",
      features: ["Composite quality score", "Evidence-backed criteria", "Deterministic go/no-go gates"],
      route: "/quality",
      icon: ShieldCheck,
    },
  ];

  const PROBLEMS = [
    {
      problem: "Requirements disconnect",
      summary: "Product specs, PRDs, and tickets get detached from architecture models within weeks of project kickoff.",
      solution: "Structured Requirement Store",
      archforge: "Directly anchors every synthesized architecture node and edge back to specific requirement items in Workspace Studio.",
      icon: FileText,
      route: "/workspace",
    },
    {
      problem: "Diagram drift & rot",
      summary: "Architecture diagrams are static whiteboard drawings or slide decks that never update as the implementation evolves.",
      solution: "Repository AST Drift Detection",
      archforge: "Extracts active codebase topology from git snapshots and flags discrepancies against design specifications automatically.",
      icon: Radar,
      route: "/drift",
    },
    {
      problem: "Opaque repository architecture",
      summary: "Understanding polyglot services, hidden inter-service calls, and database models across repos requires manual code auditing.",
      solution: "Deep Codebase Intelligence",
      archforge: "Analyzes packages, dependencies, API controllers, and schemas in one unified repository telemetry inspector.",
      icon: GitBranch,
      route: "/repository",
    },
    {
      problem: "Unknown blast radius of changes",
      summary: "Modifying a core service, database column, or message queue causes unexpected breakage in dependent microservices.",
      solution: "Engineering Impact Analysis",
      archforge: "Models transitive downstream consumers, calculates blast radius severity, and highlights affected routes before commit.",
      icon: ShieldAlert,
      route: "/impact",
    },
    {
      problem: "Outdated technical documentation",
      summary: "Engineering documentation is scattered across wikis, readmes, and slack messages, quickly becoming stale and misleading.",
      solution: "Source-Aware Documentation",
      archforge: "Generates living architecture documents, entity relationship maps, and system manuals synchronized with AST code snapshots.",
      icon: Share2,
      route: "/documentation",
    },
    {
      problem: "Subjective release sign-offs",
      summary: "Teams lack a single evidence-based view of engineering health, relying on gut feel instead of verified quality criteria.",
      solution: "Release Quality Gate",
      archforge: "Aggregates drift alignment, automated test evidence, security evaluations, and unresolved warnings into a verified release score.",
      icon: ShieldCheck,
      route: "/quality",
    },
  ];

  const CORE_FEATURES = [
    {
      id: "generator",
      title: "Architecture Generator & Studio",
      tagline: "Natural requirements to rigorous topologies",
      desc: "Input system goals, scale criteria, and constraints. ArchForge generates production-grade service components, protocol boundaries, and versioned blueprints.",
      icon: Workflow,
      route: "/workspace",
      tag: "Design Studio",
    },
    {
      id: "versions",
      title: "Versions & Diff Comparison",
      tagline: "Preserve and compare architectural lineage",
      desc: "Save immutable architecture version snapshots (v1, v2, v3). Run visual side-by-side diffs to inspect added components, altered protocols, and removed dependencies.",
      icon: GitCompare,
      route: "/compare",
      tag: "Design Studio",
    },
    {
      id: "repo-intel",
      title: "Repository & Dependency Intelligence",
      tagline: "Source-level codebase visibility",
      desc: "Connect git repos to inspect parsed snapshot files, technology stacks, external package dependencies, and discovered endpoints without leaving the workstation.",
      icon: GitBranch,
      route: "/repository",
      tag: "Code Intelligence",
    },
    {
      id: "drift",
      title: "Architecture Drift Detection",
      tagline: "Reconcile design against implementation",
      desc: "Continuously compare planned system models with actual code ASTs. Highlight missing services, unmapped network calls, and shadow database connections.",
      icon: Radar,
      route: "/drift",
      tag: "Code Intelligence",
    },
    {
      id: "impact",
      title: "Engineering Impact Analysis",
      tagline: "Simulate blast radius before you deploy",
      desc: "Select any service, database, or API route to calculate transitive dependencies, identify critical path bottlenecks, and prevent cascading downtime.",
      icon: ShieldAlert,
      route: "/impact",
      tag: "Code Intelligence",
    },
    {
      id: "playground",
      title: "Engineering Playground",
      tagline: "Test architecture changes in simulation",
      desc: "Evaluate proposed microservice splits, caching layers, and database migrations. Model tradeoffs across complexity, latency, and operational cost in real time.",
      icon: FlaskConical,
      route: "/playground",
      tag: "Engineering",
    },
    {
      id: "docs",
      title: "Documentation Intelligence",
      tagline: "Source-aware technical specifications",
      desc: "Generate comprehensive system design documents, API catalogs, data schemas, and architecture decision records (ADRs) linked to your code entities.",
      icon: FileText,
      route: "/documentation",
      tag: "Engineering",
    },
    {
      id: "workflow",
      title: "Workflow Orchestrator",
      tagline: "Automated architecture validation pipeline",
      desc: "Run end-to-end multi-step verification: validate requirements → generate architecture → sync repo AST → audit drift → evaluate release gate.",
      icon: Activity,
      route: "/workflow",
      tag: "Engineering",
    },
    {
      id: "knowledge-graph",
      title: "Knowledge Graph & Traceability",
      tagline: "Unified graph linking code, specs & tests",
      desc: "Explore a unified semantic graph linking business requirements, architectural nodes, source code files, database schemas, and verified test suites.",
      icon: Share2,
      route: "/knowledge-graph",
      tag: "Code Intelligence",
    },
    {
      id: "quality",
      title: "Quality & Release Readiness",
      tagline: "Objective, evidence-based release gates",
      desc: "Synthesize test results, static analysis findings, security evaluations, and drift scores into an actionable go/no-go quality gate before shipping.",
      icon: ShieldCheck,
      route: "/quality",
      tag: "Release & Quality",
    },
    {
      id: "story",
      title: "Architecture Story & Review Mode",
      tagline: "Interactive design walkthroughs",
      desc: "Step through architectural decisions narratively with interactive presentation slides, technical rationales, and design review checkpoints.",
      icon: BookOpen,
      route: "/story",
      tag: "Engineering",
    },
    {
      id: "exports",
      title: "Telemetry, Exports & Audit Trail",
      tagline: "Standard formats & immutable history",
      desc: "Export architectures as OpenAPI specs, JSON models, and Markdown. Monitor workspace telemetry, project timelines, and historical audit logs.",
      icon: BarChart3,
      route: "/exports",
      tag: "Insights & Exports",
    },
  ];

  const AUDIENCES = [
    {
      role: "Software Engineers",
      desc: "Understand existing codebase topology fast, trace unfamiliar service dependencies, and evaluate the blast radius of changes before making pull requests.",
      icon: Code2,
    },
    {
      role: "Solution Architects",
      desc: "Draft rigorous system blueprints, synthesize protocol boundaries, maintain versioned design lineages, and prevent implementation drift from day one.",
      icon: Network,
    },
    {
      role: "Technical Leads & Staff",
      desc: "Conduct objective design reviews, enforce architectural governance, and verify that actual code conforms to documented system architecture standards.",
      icon: Compass,
    },
    {
      role: "Engineering Organizations",
      desc: "Replace siloed documentation and tribal knowledge with a single unified platform connecting product requirements, architecture specs, and live repos.",
      icon: Boxes,
    },
    {
      role: "Students & System Designers",
      desc: "Learn real-world software architecture patterns, explore microservice trade-offs in an interactive sandbox, and see how requirements map to production systems.",
      icon: BookOpen,
    },
    {
      role: "Legacy Codebase Maintainers",
      desc: "Reverse-engineer complex, undocumented codebases through automated repository snapshot analysis, dependency extraction, and drift reporting.",
      icon: GitBranch,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary flex flex-col">
      {/* Navigation Header */}
      <LandingHeader />

      <main className="flex-1 pt-16">
        {/* ==================== 1. HERO SECTION ==================== */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 border-b border-border/60">
          {/* Subtle grid background */}
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 left-10 w-80 h-80 bg-info/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center space-y-6 max-w-4xl mx-auto">
              {/* Technical Status Pill */}
              <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full border border-border/80 bg-surface/70 text-xs font-mono backdrop-blur-sm shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="text-muted-foreground shrink-0">ArchForge Platform</span>
                <span className="text-muted-foreground/60 hidden xs:inline">·</span>
                <span className="text-foreground font-semibold truncate max-w-[200px] xs:max-w-none">From Requirements to Production Architecture</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-foreground leading-[1.1]">
                Design systems before <br className="hidden sm:inline" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-primary">
                  you build them.
                </span>
              </h1>

              {/* Supporting Copy */}
              <p className="text-base sm:text-lg text-muted-foreground max-w-3xl leading-relaxed">
                Turn software requirements into structured architecture, traceable engineering decisions, and production-oriented documentation. Analyze your codebase, detect architectural drift, understand change impact, and evaluate release readiness in one engineering workspace.
              </p>

              {/* Calls to Action */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {isAuthenticated ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/10"
                    >
                      <span>Enter Workstation Dashboard</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/workspace"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/80 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                    >
                      <Workflow className="h-4 w-4 text-primary" />
                      <span>Workspace Studio</span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md shadow-primary/10"
                    >
                      <span>Start Building</span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <a
                      href="#interactive-demo"
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/80 px-5 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                    >
                      <span>Explore the Platform</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </>
                )}
              </div>

              {/* Engineering Cluster Pill */}
              <div className="pt-2 flex items-center gap-4 text-[11px] font-mono text-muted-foreground/80">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  Cluster us-east-1 online
                </span>
                <span>·</span>
                <span>Deterministic AST Engine</span>
                <span>·</span>
                <span>No Fabricated Metrics</span>
              </div>
            </div>

            {/* Cinematic Interactive 3D Architecture Experience Centerpiece */}
            <div className="mt-12 sm:mt-16 max-w-6xl mx-auto w-full">
              <Suspense fallback={<Architecture3DSceneSkeleton />}>
                <Architecture3DScene />
              </Suspense>
              <div className="mt-3 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-muted-foreground/80 px-2 gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Engineering Solar System · Architecture Core & Orbiting Worlds · Click planets to inspect · Drag to orbit · Scroll to zoom
                </span>
                <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                  Guided Tour · Exploded Layers Mode · Real Inter-World Conduits
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 2. THE PROBLEM SECTION ==================== */}
        <section id="problem" className="py-20 border-b border-border/60 bg-[#0A0F1D]/50 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
                Engineering Reality
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                Software architecture should not stop at a diagram.
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Modern software engineering suffers from a chronic divide between intended architectural designs and actual codebases. ArchForge bridges the gap with evidence-backed codebase intelligence.
              </p>
            </div>

            {/* 6 Engineering Problems Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PROBLEMS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="surface-panel p-5 bg-panel/60 border-border/80 rounded-xl space-y-3 hover:border-primary/40 transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-8 w-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase">
                          Problem 0{idx + 1}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-semibold font-display text-foreground">
                          {item.problem}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {item.summary}
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-border/60 space-y-1.5">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>ArchForge: {item.solution}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {item.archforge}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== 3. HOW IT WORKS (COMPLETE WORKFLOW) ==================== */}
        <section id="workflow" className="py-20 border-b border-border/60 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
                Lifecycle Orchestration
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                The 7-step engineering workflow
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                From requirement elicitation to automated release gates, ArchForge orchestrates every phase of system architecture into a unified, reproducible engineering pipeline.
              </p>
            </div>

            {/* Interactive Workflow Progression Pipeline */}
            <div className="surface-panel p-4 sm:p-6 bg-panel/70 border-border/80 rounded-xl space-y-6">
              {/* Stepper Tabs Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                {WORKFLOW_STEPS.map((step, idx) => {
                  const active = activeWorkflowStep === idx;
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.step}
                      onClick={() => setActiveWorkflowStep(idx)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        active
                          ? "bg-surface border-primary text-foreground shadow-sm ring-1 ring-primary/40"
                          : "bg-surface/30 border-border/60 text-muted-foreground hover:text-foreground hover:bg-surface/60"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                        <span className="font-semibold text-primary">0{step.step}</span>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="text-xs font-semibold truncate">{step.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {step.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Step Detailed Inspector */}
              {(() => {
                const current = WORKFLOW_STEPS[activeWorkflowStep];
                const Icon = current.icon;
                return (
                  <div className="p-6 rounded-xl bg-surface/40 border border-border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-2xl">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[11px] font-mono font-semibold">
                          Step 0{current.step}
                        </span>
                        <h3 className="text-xl font-display font-bold text-foreground">
                          {current.title}
                        </h3>
                      </div>

                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {current.desc}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {current.features.map((feat, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-panel border border-border text-xs font-mono text-foreground"
                          >
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col gap-2 w-full lg:w-auto">
                      <Link
                        to={current.route as any}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-mono font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-xs"
                      >
                        <span>Open in Workstation</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                      <span className="text-[10px] font-mono text-muted-foreground text-center">
                        Requires project authentication
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* ==================== 4. FEATURE SHOWCASE ==================== */}
        <section id="features" className="py-20 border-b border-border/60 bg-[#0A0F1D]/50 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
                Capability Matrix
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                Engineered for serious software architects
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Every feature below is implemented in ArchForge to bring architecture design, codebase reality, and release readiness into one workstation.
              </p>
            </div>

            {/* 12 Core Capabilities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {CORE_FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <div
                    key={feat.id}
                    className="surface-panel p-5 bg-panel/60 border-border/80 rounded-xl space-y-4 hover:border-primary/50 transition-colors flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="h-8 w-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary group-hover:border-primary/50 transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        <Badge variant="outline" className="font-mono text-[9px] uppercase">
                          {feat.tag}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-base font-semibold font-display text-foreground group-hover:text-primary transition-colors">
                          {feat.title}
                        </h3>
                        <div className="text-[11px] font-mono text-primary/80">
                          {feat.tagline}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground text-[10px]">Route: {feat.route}</span>
                      <Link
                        to={feat.route as any}
                        className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        <span>Explore</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== 5. INTERACTIVE ARCHITECTURE DEMO ==================== */}
        <section id="interactive-demo" className="py-20 border-b border-border/60 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-3xl space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
                Live Public Demonstration
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                Experience the architecture intelligence engine
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Explore an illustrative high-throughput e-commerce system. Toggle between architectural topology and AST drift mode, click nodes to inspect inbound/outbound communication, and see how ArchForge detects discrepancies. No login required.
              </p>
            </div>

            {/* Sandbox Component */}
            <Suspense fallback={<InteractiveDemoSkeleton />}>
              <InteractiveArchitectureDemo />
            </Suspense>
          </div>
        </section>

        {/* ==================== 6. WHO SHOULD USE ARCHFORGE? ==================== */}
        <section id="use-cases" className="py-20 border-b border-border/60 bg-[#0A0F1D]/50 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
                Designed for Engineering Teams
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                Who builds with ArchForge?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Whether you are architecting a new greenfield platform, scaling microservices, or untangling an existing monolith, ArchForge provides the clarity engineering teams need.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {AUDIENCES.map((aud, idx) => {
                const Icon = aud.icon;
                return (
                  <div
                    key={idx}
                    className="surface-panel p-5 bg-panel/60 border-border/80 rounded-xl space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-surface border border-border flex items-center justify-center text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-base font-semibold font-display text-foreground">
                        {aud.role}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {aud.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== 7. SECURITY, ACCURACY & TRUST ==================== */}
        <section id="trust" className="py-20 border-b border-border/60 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
            <div className="max-w-3xl space-y-3">
              <div className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold">
                Evidence-Based Trust
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-foreground">
                Grounded in verifiable codebase reality
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Unlike speculative AI assistants, ArchForge anchors all recommendations and evaluations in actual repository evidence, deterministic AST extraction, and verifiable tests.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="surface-panel p-5 bg-panel/60 border-border/80 rounded-xl space-y-2">
                <div className="text-xs font-mono uppercase font-semibold text-primary flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span>Evidence-Backed Findings</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Every drift discrepancy, dependency edge, and security evaluation references concrete source files, AST symbols, and git commit SHAs.
                </p>
              </div>

              <div className="surface-panel p-5 bg-panel/60 border-border/80 rounded-xl space-y-2">
                <div className="text-xs font-mono uppercase font-semibold text-primary flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  <span>Immutable Version Lineage</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Architecture designs are stored with version numbers, diffs, and change rationales so design history is never accidentally overwritten.
                </p>
              </div>

              <div className="surface-panel p-5 bg-panel/60 border-border/80 rounded-xl space-y-2">
                <div className="text-xs font-mono uppercase font-semibold text-primary flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Rigorous Quality Gates</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Release readiness distinguishes verified passes, warnings, hard failures, and unverified checks without exaggerating production readiness.
                </p>
              </div>

              <div className="surface-panel p-5 bg-panel/60 border-border/80 rounded-xl space-y-2">
                <div className="text-xs font-mono uppercase font-semibold text-primary flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  <span>Tenant & Privacy Isolation</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Public demonstrations use sandboxed illustrative data. Private project topologies and code snapshots remain isolated in your workspace.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== 8. CLOSING CTA SECTION ==================== */}
        <section className="py-24 relative overflow-hidden bg-gradient-to-b from-panel/40 via-surface/30 to-[#090D16]">
          <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs font-mono text-primary">
              <Sparkles className="h-3 w-3" />
              <span>Production-Grade Architecture Engineering</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-foreground leading-tight">
              Bring requirements, architecture, and implementation into one engineering workspace.
            </h2>

            <p className="text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Eliminate drift, predict change impact, and deliver verifiable software architectures with ArchForge.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <span>Start Building with ArchForge</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    <span>Start Building with ArchForge</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-medium text-foreground hover:bg-surface/80 transition-colors"
                  >
                    <span>Sign In to Workstation</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Product Footer */}
      <LandingFooter />
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Presentation, Download, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/story")({
  head: () => ({
    meta: [
      { title: "Project Story Mode — ArchForge" },
      { name: "description", content: "One-click presentation summary of the project — designed for demos and placement interviews." },
    ],
  }),
  component: StoryPage,
});

import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";

function StoryPage() {
  const { currentProject } = useWorkspace();
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" /> Project story mode
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            {currentProject ? currentProject.name : "Engineering Story"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Generated for demos and placement interviews. Regenerate any section on demand.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <ProjectSwitcher variant="inline" />
          <Button variant="outline"><Download className="h-3.5 w-3.5 mr-1" /> Export PDF</Button>
          <Button variant="outline"><Presentation className="h-3.5 w-3.5 mr-1" /> Present</Button>
          <Button><Sparkles className="h-3.5 w-3.5 mr-1" /> Regenerate</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Services" value="14" />
        <Stat label="APIs" value="126" />
        <Stat label="DB Tables" value="38" />
        <Stat label="Test coverage" value="72%" />
      </div>

      <Slide index="01" title="Project summary">
        <p>
          The ERP Platform is a multi-tenant enterprise resource planning system serving 40+ business units.
          It manages orders, billing, notifications, and analytics across a distributed service topology deployed to Kubernetes on AWS.
          ArchForge is used as the single source of truth for architecture, keeping generated design, code, and documentation continuously reconciled.
        </p>
      </Slide>

      <Slide index="02" title="Architecture overview">
        <ul>
          <li>Gateway-fronted microservices with strict service boundaries.</li>
          <li>AuthService owns identity, JWT + refresh tokens with PKCE.</li>
          <li>Redis cache in front of OrdersService for a 20% p95 latency reduction.</li>
          <li>Kafka event bus for asynchronous notification fanout.</li>
          <li>Postgres primary with read replica in eu-west-1.</li>
        </ul>
      </Slide>

      <Slide index="03" title="Technology stack">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 not-prose">
          {[
            ["Frontend", "React 18, Vite, TanStack Router"],
            ["Backend", "Node.js, Fastify, TypeScript"],
            ["Database", "PostgreSQL 15, Redis 7"],
            ["Messaging", "Kafka 3.6"],
            ["Auth", "OAuth 2.1 + PKCE, Argon2id"],
            ["Infra", "Kubernetes, Helm, Terraform, AWS"],
          ].map(([k, v]) => (
            <div key={k} className="surface-panel p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{k}</div>
              <div className="text-sm font-medium mt-1">{v}</div>
            </div>
          ))}
        </div>
      </Slide>

      <Slide index="04" title="Repository analysis">
        <ul>
          <li>Monorepo with 1,214 source files across 9 packages.</li>
          <li>92% match between architecture spec and repository code (drift score).</li>
          <li>0 critical CVEs · 3 medium CVEs pending upgrade.</li>
          <li>Documentation coverage grew from 42% (Sprint 1) to 76% (v12).</li>
        </ul>
      </Slide>

      <Slide index="05" title="Engineering challenges">
        <ul>
          <li>Untangling coupled Auth + Profile responsibilities without breaking clients.</li>
          <li>Absorbing a 3x traffic spike during promotional windows.</li>
          <li>Reconciling architecture spec against a monorepo with legacy cron workers.</li>
          <li>Keeping documentation from decaying under weekly deploys.</li>
        </ul>
      </Slide>

      <Slide index="06" title="Key engineering decisions">
        <ul>
          <li><strong>Split UserService → AuthService + UserService</strong> — restored clear ownership.</li>
          <li><strong>Redis in front of Orders</strong> — 35% throughput gain, 5% cost delta.</li>
          <li><strong>Kafka for notifications</strong> — decoupled fanout from request path.</li>
          <li><strong>ArchForge Playground gating</strong> — no architectural change ships without simulation.</li>
        </ul>
      </Slide>

      <Slide index="07" title="Future improvements">
        <ul>
          <li>Introduce a CDN edge layer for SSR responses (est. +28% perf).</li>
          <li>Adopt a rate limiter fronting /auth (security +18).</li>
          <li>Automate drift remediation via GitHub Actions on every push.</li>
          <li>Extend Story Mode with per-service deep-dives for onboarding.</li>
        </ul>
      </Slide>

      <Slide index="08" title="Presentation notes">
        <ul>
          <li><em>Open with the drift score</em> — the &ldquo;92% match&rdquo; number lands well.</li>
          <li>Show the Playground simulating Redis before showing the topology.</li>
          <li>Use version compare (v11 → v12) to demonstrate change tracking.</li>
          <li>Close with Story Mode itself as proof of the platform&rsquo;s value.</li>
        </ul>
      </Slide>

      <div className="surface-panel p-4 flex items-center gap-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm">Ready to present. Story regenerates automatically on every architecture change.</span>
        <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-panel p-3.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-display font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function Slide({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section className="surface-panel">
      <div className="h-10 px-4 flex items-center border-b border-border">
        <span className="font-mono text-xs text-primary mr-3">{index}</span>
        <span className="font-display font-semibold">{title}</span>
      </div>
      <div className="p-5 prose prose-invert prose-sm max-w-none prose-p:text-foreground/90 prose-li:text-foreground/90">
        {children}
      </div>
    </section>
  );
}
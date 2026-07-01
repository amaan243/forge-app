import { createFileRoute } from "@tanstack/react-router";
import { FileText, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/documentation")({
  head: () => ({
    meta: [
      { title: "Documentation — ArchForge" },
      { name: "description", content: "Auto-generated engineering documentation for every service, module, and API." },
      { property: "og:title", content: "Documentation — ArchForge" },
      { property: "og:description", content: "Auto-generated engineering documentation for services and APIs." },
    ],
  }),
  component: DocumentationPage,
});

const TREE = [
  { name: "Overview", children: ["System context", "Domain glossary", "Non-functional requirements"] },
  { name: "Services", children: ["Auth Service", "User Service", "Payment Service", "Notification Service"] },
  { name: "Database", children: ["Schema", "Entities", "Migrations"] },
  { name: "APIs", children: ["REST reference", "Webhooks", "Rate limits"] },
];

function DocumentationPage() {
  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] min-h-[calc(100vh-3rem)]">
      <aside className="border-r border-border p-3 space-y-3 bg-panel/40 overflow-y-auto">
        {TREE.map((s) => (
          <div key={s.name} className="space-y-0.5">
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.name}</div>
            {s.children.map((c, i) => (
              <div key={c} className={"flex items-center gap-1.5 h-7 px-2 rounded text-xs " + (i === 1 && s.name === "Services" ? "bg-surface border border-border" : "text-muted-foreground hover:text-foreground hover:bg-surface/60")}>
                <ChevronRight className="h-3 w-3" />
                {c}
              </div>
            ))}
          </div>
        ))}
      </aside>
      <div className="p-8 max-w-3xl space-y-6">
        <div className="space-y-1">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> services / user-service.md
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">User Service</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The User Service owns the canonical user profile, tenant membership, and role assignments.
          It exposes a REST API to the API Gateway and publishes profile-change events to RabbitMQ
          for downstream consumers.
        </p>
        <div className="surface-panel p-4 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Responsibilities</div>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li>Profile CRUD and validation</li>
            <li>Tenant membership and role assignment</li>
            <li>Emitting user.updated and user.deleted events</li>
          </ul>
        </div>
        <pre className="rounded border border-border bg-background p-3 font-mono text-xs overflow-x-auto"><code>{`GET  /v1/users/:id
POST /v1/users
PATCH /v1/users/:id
DELETE /v1/users/:id`}</code></pre>
      </div>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, FileImage, FileCode2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/exports")({
  head: () => ({
    meta: [
      { title: "Exports — ArchForge" },
      { name: "description", content: "Export architecture diagrams, engineering reports, OpenAPI specs, and starter code." },
      { property: "og:title", content: "Exports — ArchForge" },
      { property: "og:description", content: "Export diagrams, reports, OpenAPI specs, and starter code." },
    ],
  }),
  component: ExportsPage,
});

const FORMATS = [
  { icon: FileText, name: "Architecture PDF", desc: "Board-ready report with diagrams and rationale.", ext: "pdf" },
  { icon: FileImage, name: "Diagram", desc: "Vector export of the current canvas.", ext: "svg" },
  { icon: FileCode2, name: "OpenAPI 3.1", desc: "Full REST + webhook specification.", ext: "yaml" },
  { icon: FileCode2, name: "Database Schema", desc: "SQL DDL with indexes and constraints.", ext: "sql" },
  { icon: Package, name: "Starter Repository", desc: "Folder layout with placeholder files.", ext: "zip" },
  { icon: FileText, name: "Engineering Report", desc: "Complexity, security, and maintainability findings.", ext: "md" },
];

function ExportsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">payments-platform · v0.3.0</div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">Exports</h1>
      </header>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {FORMATS.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.name} className="surface-panel p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded border border-border bg-surface grid place-items-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{f.name}</div>
                  <div className="text-[11px] font-mono text-muted-foreground uppercase">.{f.ext}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              <Button size="sm" variant="outline" className="mt-auto h-8"><Download /> Download</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
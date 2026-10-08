import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, FileImage, FileCode2, Package, FileJson, FileArchive, CheckCircle2, Loader2 } from "lucide-react";
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
  { icon: FileImage, name: "Architecture Diagram", desc: "Vector export of the current canvas.", ext: "svg", category: "Diagram" },
  { icon: FileCode2, name: "Mermaid Diagram", desc: "Text-based diagram source for markdown docs.", ext: "mmd", category: "Diagram" },
  { icon: FileCode2, name: "PlantUML", desc: "PlantUML representation of services and flows.", ext: "puml", category: "Diagram" },
  { icon: FileText, name: "Markdown Documentation", desc: "Complete engineering docs as markdown files.", ext: "md", category: "Docs" },
  { icon: FileText, name: "PDF Report", desc: "Board-ready report with diagrams and rationale.", ext: "pdf", category: "Docs" },
  { icon: FileJson, name: "JSON Definition", desc: "Full architecture as machine-readable JSON.", ext: "json", category: "Data" },
  { icon: FileCode2, name: "YAML Definition", desc: "Full architecture as YAML for CI pipelines.", ext: "yaml", category: "Data" },
  { icon: FileCode2, name: "OpenAPI 3.1", desc: "Full REST + webhook specification.", ext: "yaml", category: "Data" },
  { icon: FileArchive, name: "ZIP Project", desc: "Folder layout with placeholder files.", ext: "zip", category: "Code" },
];

const HISTORY = [
  { name: "payments-platform-v0.3.pdf", size: "4.2 MB", when: "2m ago", status: "ready" },
  { name: "openapi.yaml", size: "184 KB", when: "18m ago", status: "ready" },
  { name: "architecture.svg", size: "62 KB", when: "1h ago", status: "ready" },
  { name: "docs-bundle.zip", size: "12.6 MB", when: "3h ago", status: "ready" },
  { name: "engineering-report.pdf", size: "—", when: "now", status: "building" },
  { name: "starter-repo.zip", size: "—", when: "queued", status: "queued" },
];

function ExportsPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="space-y-2">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">payments-platform · v0.3.0</div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">Export Center</h1>
        <p className="text-sm text-muted-foreground">Ship your architecture in the format your team needs.</p>
      </header>

      {(["Diagram", "Docs", "Data", "Code"] as const).map((cat) => (
        <section key={cat} className="space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{cat}</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {FORMATS.filter((f) => f.category === cat).map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.name} className="surface-panel p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors">
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
        </section>
      ))}

      <section className="space-y-3">
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Export history</div>
        <div className="surface-panel">
          <div className="grid grid-cols-[minmax(0,1fr)_100px_100px_120px] items-center gap-3 h-9 px-3 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span>Name</span>
            <span>Size</span>
            <span>When</span>
            <span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-border">
            {HISTORY.map((h) => (
              <div key={h.name} className="grid grid-cols-[minmax(0,1fr)_100px_100px_120px] items-center gap-3 h-10 px-3 text-xs hover:bg-surface/40">
                <span className="font-mono truncate">{h.name}</span>
                <span className="font-mono text-muted-foreground">{h.size}</span>
                <span className="font-mono text-muted-foreground">{h.when}</span>
                <div className="flex items-center justify-end gap-2">
                  {h.status === "ready" ? (
                    <span className="flex items-center gap-1 text-success text-[11px] font-mono">
                      <CheckCircle2 className="h-3 w-3" /> ready
                    </span>
                  ) : h.status === "building" ? (
                    <span className="flex items-center gap-1 text-primary text-[11px] font-mono">
                      <Loader2 className="h-3 w-3 animate-spin" /> building
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px] font-mono">queued</span>
                  )}
                  {h.status === "ready" && (
                    <button className="h-6 w-6 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface">
                      <Download className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
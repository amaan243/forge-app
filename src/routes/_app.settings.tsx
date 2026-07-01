import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ArchForge" },
      { name: "description", content: "Manage workspaces, integrations, model preferences, and team access." },
      { property: "og:title", content: "Settings — ArchForge" },
      { property: "og:description", content: "Manage workspaces, integrations, and team access." },
    ],
  }),
  component: SettingsPage,
});

const GROUPS = [
  { key: "general", label: "General" },
  { key: "integrations", label: "Integrations" },
  { key: "models", label: "Generation models" },
  { key: "team", label: "Team & access" },
  { key: "billing", label: "Billing" },
];

function SettingsPage() {
  return (
    <div className="grid grid-cols-[220px_minmax(0,1fr)] min-h-[calc(100vh-3rem)]">
      <aside className="border-r border-border p-3 space-y-0.5 bg-panel/40">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Sections</div>
        {GROUPS.map((g, i) => (
          <div key={g.key} className={"h-8 px-2 flex items-center rounded text-xs " + (i === 0 ? "bg-surface border border-border" : "text-muted-foreground hover:text-foreground hover:bg-surface/60")}>
            {g.label}
          </div>
        ))}
        <div className="pt-4 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Developer</div>
        <Link to="/design-system" className="h-8 px-2 flex items-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface/60">
          Design system
        </Link>
      </aside>
      <div className="p-8 max-w-2xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-display font-semibold tracking-tight">General</h1>
          <p className="text-sm text-muted-foreground">Workspace defaults applied to new projects.</p>
        </header>
        <div className="space-y-4">
          <Field label="Organization"><Input defaultValue="Acme Engineering" /></Field>
          <Field label="Default stack"><Input defaultValue="Node + React + Postgres" className="font-mono" /></Field>
          <Field label="Region"><Input defaultValue="us-east-1" className="font-mono" /></Field>
          <Field label="Architecture style"><Input defaultValue="microservices" className="font-mono" /></Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-4">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
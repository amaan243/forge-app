import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  User,
  Palette,
  Bell,
  GitBranch,
  Sparkles,
  KeyRound,
  Download,
  Building2,
  Info,
} from "lucide-react";
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
  { key: "general", label: "General", icon: User },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "github", label: "GitHub Integration", icon: GitBranch },
  { key: "model", label: "AI Model", icon: Sparkles },
  { key: "apiKeys", label: "API Keys", icon: KeyRound },
  { key: "exports", label: "Export Preferences", icon: Download },
  { key: "workspace", label: "Workspace", icon: Building2 },
  { key: "about", label: "About", icon: Info },
] as const;

function SettingsPage() {
  const [active, setActive] = useState<(typeof GROUPS)[number]["key"]>("general");
  const group = GROUPS.find((g) => g.key === active)!;

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] min-h-[calc(100vh-3rem)]">
      <aside className="border-r border-border p-3 space-y-0.5 bg-panel/40">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Sections</div>
        {GROUPS.map((g) => {
          const Icon = g.icon;
          const on = active === g.key;
          return (
            <button
              key={g.key}
              onClick={() => setActive(g.key)}
              className={
                "w-full h-8 px-2 flex items-center gap-2 rounded text-xs text-left transition-colors " +
                (on ? "bg-surface text-foreground border border-border" : "text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent")
              }
            >
              <Icon className="h-3.5 w-3.5" /> {g.label}
            </button>
          );
        })}
        <div className="pt-4 px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Developer</div>
        <Link to="/design-system" className="h-8 px-2 flex items-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface/60">
          Design system
        </Link>
      </aside>

      <div className="p-8 max-w-2xl space-y-6">
        <header className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Settings</div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">{group.label}</h1>
        </header>

        {active === "general" && <GeneralSettings />}
        {active === "appearance" && <AppearanceSettings />}
        {active === "notifications" && <NotificationsSettings />}
        {active === "github" && <GitHubSettings />}
        {active === "model" && <ModelSettings />}
        {active === "apiKeys" && <ApiKeysSettings />}
        {active === "exports" && <ExportPrefs />}
        {active === "workspace" && <WorkspaceSettings />}
        {active === "about" && <AboutPanel />}

        {active !== "about" && (
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline">Cancel</Button>
            <Button>Save changes</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-start gap-4">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
      </div>
      <div className="pt-0.5">{children}</div>
    </div>
  );
}

function Toggle({ defaultOn = false, label }: { defaultOn?: boolean; label?: string }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button
      onClick={() => setOn(!on)}
      className={"h-5 w-9 rounded-full border transition-colors relative " + (on ? "bg-primary/30 border-primary/50" : "bg-surface border-border")}
      aria-label={label}
    >
      <span className={"absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all " + (on ? "left-4 bg-primary" : "left-0.5 bg-muted-foreground")} />
    </button>
  );
}

function GeneralSettings() {
  return (
    <div className="space-y-4">
      <Field label="Organization"><Input defaultValue="Acme Engineering" /></Field>
      <Field label="Default stack"><Input defaultValue="Node + React + Postgres" className="font-mono" /></Field>
      <Field label="Region"><Input defaultValue="us-east-1" className="font-mono" /></Field>
      <Field label="Architecture style"><Input defaultValue="microservices" className="font-mono" /></Field>
    </div>
  );
}
function AppearanceSettings() {
  return (
    <div className="space-y-4">
      <Field label="Theme" hint="Deep-slate is the only supported palette for the engineering workstation.">
        <div className="flex gap-2">
          {["Slate (default)", "Graphite", "Ink"].map((t, i) => (
            <div key={t} className={"flex-1 rounded border p-3 " + (i === 0 ? "border-primary/50 bg-primary/5" : "border-border")}>
              <div className="h-8 rounded bg-background border border-border mb-2" />
              <div className="text-xs">{t}</div>
            </div>
          ))}
        </div>
      </Field>
      <Field label="Density"><Input defaultValue="Compact" className="font-mono" /></Field>
      <Field label="Reduce motion"><Toggle label="Reduce motion" /></Field>
    </div>
  );
}
function NotificationsSettings() {
  return (
    <div className="space-y-3">
      {[
        ["Generation completed", true],
        ["Repository imported", true],
        ["Security findings", true],
        ["Weekly digest", false],
        ["Export ready", true],
      ].map(([label, on]) => (
        <div key={label as string} className="flex items-center justify-between h-9 px-3 rounded border border-border bg-background">
          <span className="text-sm">{label}</span>
          <Toggle defaultOn={on as boolean} />
        </div>
      ))}
    </div>
  );
}
function GitHubSettings() {
  return (
    <div className="space-y-4">
      <div className="surface-panel p-4 flex items-center gap-3">
        <GitBranch className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <div className="text-sm font-medium">Connected as acme-eng</div>
          <div className="text-[11px] font-mono text-muted-foreground">4 repositories · read + write</div>
        </div>
        <Button variant="outline" size="sm">Disconnect</Button>
      </div>
      <Field label="Default branch"><Input defaultValue="main" className="font-mono" /></Field>
      <Field label="Auto-analyze on push"><Toggle defaultOn /></Field>
    </div>
  );
}
function ModelSettings() {
  return (
    <div className="space-y-4">
      <Field label="Generation model">
        <div className="grid grid-cols-3 gap-2">
          {["gen-4 (recommended)", "gen-3.5", "gen-4-preview"].map((m, i) => (
            <div key={m} className={"rounded border p-3 " + (i === 0 ? "border-primary/50 bg-primary/5" : "border-border")}>
              <div className="text-xs font-mono">{m}</div>
              <div className="text-[10px] text-muted-foreground mt-1">latency 42s · score 87</div>
            </div>
          ))}
        </div>
      </Field>
      <Field label="Temperature"><Input defaultValue="0.3" className="font-mono w-24" /></Field>
      <Field label="Reasoning depth"><Input defaultValue="deep" className="font-mono w-40" /></Field>
    </div>
  );
}
function ApiKeysSettings() {
  return (
    <div className="space-y-3">
      {[
        { name: "cli-token", masked: "af_prod_••••••••••••4a2d", last: "used 2m ago" },
        { name: "ci-runner", masked: "af_prod_••••••••••••81ef", last: "used 3h ago" },
      ].map((k) => (
        <div key={k.name} className="surface-panel p-3 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm">{k.name}</div>
            <div className="text-[11px] font-mono text-muted-foreground truncate">{k.masked}</div>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{k.last}</span>
          <Button size="sm" variant="outline">Revoke</Button>
        </div>
      ))}
      <Button variant="outline">Generate new key</Button>
    </div>
  );
}
function ExportPrefs() {
  return (
    <div className="space-y-4">
      <Field label="Default format"><Input defaultValue="PDF" className="font-mono w-32" /></Field>
      <Field label="Include diagrams"><Toggle defaultOn /></Field>
      <Field label="Include code samples"><Toggle defaultOn /></Field>
      <Field label="Watermark"><Toggle /></Field>
    </div>
  );
}
function WorkspaceSettings() {
  return (
    <div className="space-y-4">
      <Field label="Workspace name"><Input defaultValue="Acme Payments" /></Field>
      <Field label="Members"><Input defaultValue="12 members · 3 admins" className="font-mono" /></Field>
      <Field label="Danger zone">
        <Button variant="outline" className="border-destructive/40 text-destructive hover:text-destructive">Delete workspace</Button>
      </Field>
    </div>
  );
}
function AboutPanel() {
  return (
    <div className="surface-panel p-4 space-y-2 text-sm">
      <div className="flex items-center justify-between"><span className="text-muted-foreground">Version</span><span className="font-mono">0.2.0</span></div>
      <div className="flex items-center justify-between"><span className="text-muted-foreground">Build</span><span className="font-mono">2026-07-02</span></div>
      <div className="flex items-center justify-between"><span className="text-muted-foreground">Runtime</span><span className="font-mono">gen-4 / us-east-1</span></div>
      <div className="flex items-center justify-between"><span className="text-muted-foreground">License</span><span className="font-mono">Enterprise</span></div>
    </div>
  );
}
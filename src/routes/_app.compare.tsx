import { createFileRoute } from "@tanstack/react-router";
import { GitCompare, Plus, Minus, Pencil, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/compare")({
  head: () => ({
    meta: [
      { title: "Compare Versions — ArchForge" },
      { name: "description", content: "Side-by-side diff of any two architecture versions with change summary." },
    ],
  }),
  component: ComparePage,
});

type Change = {
  kind: "added" | "removed" | "modified";
  scope: string;
  entity: string;
  detail: string;
};

const CHANGES: Change[] = [
  { kind: "added", scope: "Service", entity: "AuthService", detail: "Split out of UserService — owns JWT + refresh tokens" },
  { kind: "added", scope: "Service", entity: "CacheLayer (Redis)", detail: "Fronts /orders with 60s TTL" },
  { kind: "removed", scope: "Service", entity: "LegacySessionStore", detail: "Superseded by AuthService" },
  { kind: "modified", scope: "Service", entity: "UserService", detail: "Reduced to profile CRUD" },
  { kind: "added", scope: "API", entity: "POST /auth/refresh", detail: "New endpoint on AuthService" },
  { kind: "modified", scope: "API", entity: "GET /orders", detail: "Response shape unchanged, backed by cache" },
  { kind: "removed", scope: "API", entity: "GET /session/ping", detail: "Retired with session store" },
  { kind: "added", scope: "Database", entity: "auth.refresh_tokens", detail: "New table (7 columns, 2 indexes)" },
  { kind: "modified", scope: "Database", entity: "users.password_hash", detail: "Algorithm bcrypt → argon2id" },
  { kind: "modified", scope: "Auth", entity: "OAuth flow", detail: "Added PKCE requirement for public clients" },
  { kind: "modified", scope: "Deployment", entity: "k8s manifests", detail: "+2 deployments, updated HPA thresholds" },
  { kind: "added", scope: "Infra", entity: "Redis cluster", detail: "3-node cluster provisioned in eu-west-1" },
];

function ComparePage() {
  const added = CHANGES.filter((c) => c.kind === "added").length;
  const removed = CHANGES.filter((c) => c.kind === "removed").length;
  const modified = CHANGES.filter((c) => c.kind === "modified").length;
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <GitCompare className="h-3.5 w-3.5" /> Version comparison
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Compare architectures</h1>
        </div>
        <Button variant="outline">Export diff report</Button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <VersionPicker side="base" version="v11" label="Base" ts="2026-07-02 09:18" score={88} />
        <VersionPicker side="head" version="v12" label="Head" ts="2026-07-03 14:22" score={92} />
      </div>

      <div className="surface-panel p-4 flex flex-wrap items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-display font-semibold tabular-nums">{CHANGES.length}</span>
          <span className="text-xs text-muted-foreground">changes detected</span>
        </div>
        <ChangeLegend count={added} label="Added" tone="success" />
        <ChangeLegend count={removed} label="Removed" tone="destructive" />
        <ChangeLegend count={modified} label="Modified" tone="warning" />
        <div className="ml-auto text-[11px] font-mono text-muted-foreground">
          Architecture score <span className="text-success">+4</span> · Health <span className="text-success">+3</span> · Docs <span className="text-success">+5</span>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-4">
        <DiffPane title="v11 — before" changes={CHANGES} side="base" />
        <DiffPane title="v12 — after" changes={CHANGES} side="head" />
      </section>

      <section>
        <h2 className="text-sm font-display font-semibold mb-3">Detailed change log</h2>
        <div className="surface-panel divide-y divide-border">
          {CHANGES.map((c, i) => (
            <ChangeRow key={i} c={c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function VersionPicker({ side, version, label, ts, score }: { side: "base" | "head"; version: string; label: string; ts: string; score: number }) {
  return (
    <div className="surface-panel p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label} — {side}</span>
        <button className="text-[11px] font-mono text-primary hover:underline">Change</button>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-display font-semibold">{version}</span>
        <span className="text-[11px] font-mono text-muted-foreground">{ts}</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
        <span>score {score}</span>
        <span className="h-1 w-1 rounded-full bg-border" />
        <span>gen-4</span>
      </div>
    </div>
  );
}

function ChangeLegend({ count, label, tone }: { count: number; label: string; tone: "success" | "destructive" | "warning" }) {
  const dot = tone === "success" ? "bg-success" : tone === "destructive" ? "bg-destructive" : "bg-warning";
  return (
    <div className="flex items-center gap-2">
      <span className={"h-2 w-2 rounded-full " + dot} />
      <span className="text-xs">
        <span className="font-mono tabular-nums">{count}</span> {label}
      </span>
    </div>
  );
}

function DiffPane({ title, changes, side }: { title: string; changes: Change[]; side: "base" | "head" }) {
  const services = side === "base"
    ? ["Gateway", "UserService", "OrdersService", "LegacySessionStore", "PaymentsService", "NotificationsService"]
    : ["Gateway", "AuthService", "UserService", "OrdersService", "CacheLayer (Redis)", "PaymentsService", "NotificationsService"];
  return (
    <div className="surface-panel">
      <div className="h-9 px-3 flex items-center border-b border-border">
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{title}</span>
      </div>
      <div className="p-3 space-y-1.5 font-mono text-xs">
        {services.map((s) => {
          const c = changes.find((x) => x.entity === s);
          let cls = "text-muted-foreground";
          let prefix = "  ";
          if (c) {
            if (c.kind === "added" && side === "head") { cls = "text-success bg-success/10"; prefix = "+ "; }
            else if (c.kind === "removed" && side === "base") { cls = "text-destructive bg-destructive/10"; prefix = "- "; }
            else if (c.kind === "modified") { cls = "text-warning bg-warning/10"; prefix = "~ "; }
          }
          return (
            <div key={s} className={"px-2 py-1 rounded " + cls}>
              <span className="opacity-70">{prefix}</span>{s}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChangeRow({ c }: { c: Change }) {
  const map = {
    added: { Icon: Plus, cls: "text-success", bg: "bg-success/10 border-success/30" },
    removed: { Icon: Minus, cls: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
    modified: { Icon: Pencil, cls: "text-warning", bg: "bg-warning/10 border-warning/30" },
  } as const;
  const { Icon, cls, bg } = map[c.kind];
  return (
    <div className="p-3 flex items-start gap-3">
      <span className={"h-6 w-6 rounded border grid place-items-center " + bg}>
        <Icon className={"h-3.5 w-3.5 " + cls} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-[11px] text-muted-foreground uppercase">{c.scope}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{c.entity}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{c.detail}</div>
      </div>
      <span className={"text-[10px] font-mono uppercase tracking-wider " + cls}>{c.kind}</span>
    </div>
  );
}
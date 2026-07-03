import { createFileRoute } from "@tanstack/react-router";
import { Radar, AlertTriangle, CheckCircle2, XCircle, GitBranch, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/drift")({
  head: () => ({
    meta: [
      { title: "Architecture Drift — ArchForge" },
      { name: "description", content: "Detect drift between the generated architecture and the actual repository." },
    ],
  }),
  component: DriftPage,
});

type Row = { kind: "missing" | "extra" | "match" | "mismatch"; category: string; item: string; note: string };

const ROWS: Row[] = [
  { kind: "missing", category: "Service", item: "CacheLayer (Redis)", note: "Defined in v12 but no matching deployment in repo" },
  { kind: "extra", category: "Service", item: "legacy-cron-runner", note: "Present in repo but not in architecture" },
  { kind: "match", category: "Service", item: "AuthService", note: "Matches spec — 12 handlers" },
  { kind: "match", category: "Service", item: "OrdersService", note: "Matches spec — 21 handlers" },
  { kind: "missing", category: "API", item: "POST /auth/refresh", note: "Route missing from routes/auth.ts" },
  { kind: "extra", category: "API", item: "GET /internal/debug", note: "Undocumented endpoint" },
  { kind: "mismatch", category: "Database", item: "users.password_hash", note: "Column type text vs spec varchar(255)" },
  { kind: "missing", category: "Database", item: "auth.refresh_tokens", note: "Migration not applied" },
  { kind: "mismatch", category: "Folder", item: "/apps/notifications", note: "Renamed to /services/notify in repo" },
  { kind: "mismatch", category: "Dependency", item: "express", note: "Repo pinned to 4.18.2 · spec expects ^4.21" },
];

function DriftPage() {
  const matches = ROWS.filter((r) => r.kind === "match").length;
  const total = ROWS.length;
  const score = Math.round((matches / total) * 100);
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Radar className="h-3.5 w-3.5" /> Drift detection
          </div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Generated vs actual</h1>
          <p className="text-sm text-muted-foreground">
            Continuous reconciliation between architecture v12 and repository <span className="font-mono">acme/erp-monorepo@main</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><GitBranch /> Re-scan repository</Button>
          <Button><Sparkles /> Auto-fix suggestions</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <ScoreCard score={score} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DriftStat icon={AlertTriangle} tone="warning" label="Missing" value={ROWS.filter(r => r.kind === "missing").length} />
          <DriftStat icon={XCircle} tone="destructive" label="Extra" value={ROWS.filter(r => r.kind === "extra").length} />
          <DriftStat icon={AlertTriangle} tone="warning" label="Mismatch" value={ROWS.filter(r => r.kind === "mismatch").length} />
          <DriftStat icon={CheckCircle2} tone="success" label="Matches" value={matches} />
        </div>
      </div>

      <section>
        <h2 className="text-sm font-display font-semibold mb-3">Reconciliation report</h2>
        <div className="surface-panel divide-y divide-border">
          {ROWS.map((r, i) => <DriftRow key={i} r={r} />)}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-display font-semibold mb-3">AI remediation plan</h2>
        <div className="surface-panel p-4 space-y-3">
          {[
            "Apply migration 20260702_create_refresh_tokens.sql to add auth.refresh_tokens.",
            "Add /services/cache Helm chart and wire OrdersService env REDIS_URL.",
            "Remove legacy-cron-runner or add it to architecture as a scheduled worker.",
            "Register POST /auth/refresh in apps/auth/src/routes.ts and expose via gateway.",
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="h-5 w-5 rounded border border-primary/40 bg-primary/10 text-primary grid place-items-center font-mono text-[11px]">{i + 1}</span>
              <span className="text-sm flex-1">{s}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Apply</Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ScoreCard({ score }: { score: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = c * (score / 100);
  return (
    <div className="surface-panel p-4 flex flex-col items-center justify-center">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Architecture drift score</div>
      <div className="relative mt-3">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" className="text-border" strokeWidth="6" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" className="text-primary" strokeWidth="6"
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={c / 4} transform="rotate(-90 60 60)" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-3xl font-display font-semibold tabular-nums">{score}%</div>
            <div className="text-[10px] font-mono text-muted-foreground">match</div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-[11px] font-mono text-muted-foreground">Last scan · 4m ago</div>
    </div>
  );
}

function DriftStat({ icon: Icon, tone, label, value }: { icon: typeof Radar; tone: "success" | "warning" | "destructive"; label: string; value: number }) {
  const cls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  return (
    <div className="surface-panel p-3.5">
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className={"h-3.5 w-3.5 " + cls} />
        {label}
      </div>
      <div className="text-2xl font-display font-semibold tabular-nums mt-1">{value}</div>
    </div>
  );
}

function DriftRow({ r }: { r: Row }) {
  const map = {
    missing: { cls: "text-warning", label: "Missing" },
    extra: { cls: "text-destructive", label: "Extra" },
    match: { cls: "text-success", label: "Match" },
    mismatch: { cls: "text-warning", label: "Mismatch" },
  } as const;
  const m = map[r.kind];
  return (
    <div className="p-3 flex items-center gap-3">
      <span className={"h-1.5 w-1.5 rounded-full " + (r.kind === "match" ? "bg-success" : r.kind === "extra" ? "bg-destructive" : "bg-warning")} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{r.category}</span>
          <span className="text-sm font-medium truncate">{r.item}</span>
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{r.note}</div>
      </div>
      <span className={"text-[10px] font-mono uppercase " + m.cls}>{m.label}</span>
    </div>
  );
}
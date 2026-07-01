import { createFileRoute } from "@tanstack/react-router";
import { GitBranch, GitCommit, GitPullRequest, FileCode2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_app/repository")({
  head: () => ({
    meta: [
      { title: "Repository — ArchForge" },
      { name: "description", content: "Import and analyze source repositories: file trees, hotspots, and dependency graphs." },
      { property: "og:title", content: "Repository — ArchForge" },
      { property: "og:description", content: "Analyze repositories, hotspots, and dependency graphs." },
    ],
  }),
  component: RepositoryPage,
});

const FILES = [
  { path: "src/services/auth/", lines: 1240, cx: 18, hot: true },
  { path: "src/services/payments/", lines: 2380, cx: 24, hot: true },
  { path: "src/services/notifications/", lines: 610, cx: 9, hot: false },
  { path: "src/lib/db/", lines: 820, cx: 12, hot: false },
  { path: "src/api/gateway/", lines: 940, cx: 14, hot: false },
  { path: "src/workers/", lines: 470, cx: 8, hot: false },
];

function RepositoryPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">github.com / acme / payments-platform</div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Repository</h1>
          <p className="text-sm text-muted-foreground">Static analysis of the imported source tree.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input defaultValue="main" className="pl-8 font-mono text-xs h-8 w-40" />
          </div>
          <Button>Analyze</Button>
        </div>
      </header>

      <div className="grid md:grid-cols-4 gap-3">
        <Stat icon={FileCode2} label="Files" value="1,284" />
        <Stat icon={GitCommit} label="Commits" value="6,412" />
        <Stat icon={GitPullRequest} label="Open PRs" value="14" />
        <Stat icon={ShieldAlert} label="Findings" value="9" tone="warning" />
      </div>

      <div className="surface-panel">
        <div className="h-9 px-3 flex items-center border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          Hotspots
        </div>
        <div className="divide-y divide-border">
          {FILES.map((f) => (
            <div key={f.path} className="grid grid-cols-[minmax(0,1fr)_auto_auto_120px] items-center gap-4 px-3 py-2 text-xs">
              <span className="font-mono truncate">{f.path}</span>
              <span className="font-mono text-muted-foreground">{f.lines.toLocaleString()} loc</span>
              <span className="font-mono text-muted-foreground">cx {f.cx}</span>
              <div className="h-1 rounded-full bg-surface overflow-hidden">
                <div className={"h-full " + (f.hot ? "bg-destructive" : "bg-primary")} style={{ width: `${(f.cx / 30) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof GitBranch; label: string; value: string; tone?: "warning" }) {
  return (
    <div className="surface-panel p-3.5 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={"text-2xl font-display font-semibold tabular-nums " + (tone === "warning" ? "text-warning" : "")}>{value}</div>
    </div>
  );
}
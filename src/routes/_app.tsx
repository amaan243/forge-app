import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Workflow,
  Network,
  GitBranch,
  FileText,
  BarChart3,
  Download,
  Settings,
  Search,
  Bell,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

type NavItem = {
  to: "/" | "/workspace" | "/architecture" | "/repository" | "/documentation" | "/analytics" | "/exports" | "/settings";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/workspace", label: "Workspace", icon: Workflow },
  { to: "/architecture", label: "Architecture", icon: Network },
  { to: "/repository", label: "Repository", icon: GitBranch },
  { to: "/documentation", label: "Documentation", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/exports", label: "Exports", icon: Download },
  { to: "/settings", label: "Settings", icon: Settings },
];

function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = pathname === "/" ? ["dashboard"] : pathname.split("/").filter(Boolean);

  return (
    <div className="flex min-h-screen text-foreground">
      <aside className="w-56 shrink-0 border-r border-border bg-panel flex flex-col">
        <div className="h-12 px-3 flex items-center border-b border-border">
          <Logo />
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          <div className="px-2 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Workstation
          </div>
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={
                  "flex items-center gap-2 h-8 px-2 rounded text-xs transition-colors " +
                  (active
                    ? "bg-surface text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1 w-1 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-border space-y-2">
          <div className="surface-panel p-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>Cluster</span>
              <span className="text-success">● online</span>
            </div>
            <div className="mt-1 text-xs font-mono">us-east-1 · gen-4</div>
          </div>
          <div className="flex items-center gap-2 px-1">
            <div className="h-7 w-7 rounded bg-surface border border-border grid place-items-center text-[11px] font-mono">AR</div>
            <div className="min-w-0">
              <div className="text-xs truncate">A. Rios</div>
              <div className="text-[10px] font-mono text-muted-foreground truncate">lead architect</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-border bg-panel/95 backdrop-blur-sm flex items-center gap-3 px-4">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span>archforge</span>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" />
                <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>{c}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-2 h-7 rounded border border-border bg-background text-xs text-muted-foreground font-mono w-64">
              <Search className="h-3 w-3" />
              <span>search projects, files, entities…</span>
              <kbd className="ml-auto px-1 py-px text-[10px] border border-border rounded bg-surface">⌘K</kbd>
            </div>
            <button className="h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors relative">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <div className="h-7 px-2 grid place-items-center rounded border border-border bg-surface text-[11px] font-mono text-muted-foreground">
              v0.2.0
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="15.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="2.5" y="15.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="15.5" y="15.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-primary" fill="currentColor" fillOpacity="0.15" />
        <path d="M8.5 5.5h7M5.5 8.5v7M18.5 8.5v7M8.5 18.5h7" stroke="currentColor" strokeWidth="1.25" className="text-border" />
      </svg>
      <span className="font-display font-semibold text-sm tracking-tight">
        Arch<span className="text-primary">Forge</span>
      </span>
    </div>
  );
}
import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
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
  ChevronDown,
  Building2,
  Plus,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Package,
  User,
  LogOut,
  Settings as SettingsIcon,
  Command as CommandIcon,
  History,
  GitCompare,
  Radar,
  Share2,
  FlaskConical,
  Activity as ActivityIcon,
  Camera,
  BookOpen,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CommandPalette } from "@/components/command-palette";
import { GeometricAvatar } from "@/components/geometric-avatar";
import { getHealth } from "@/api/health";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

type NavItem = {
  to:
    | "/"
    | "/workspace"
    | "/architecture"
    | "/repository"
    | "/documentation"
    | "/analytics"
    | "/exports"
    | "/settings"
    | "/versions"
    | "/compare"
    | "/drift"
    | "/dependencies"
    | "/playground"
    | "/timeline"
    | "/snapshots"
    | "/story";
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

const INTEL_NAV: NavItem[] = [
  { to: "/playground", label: "Playground", icon: FlaskConical },
  { to: "/versions", label: "Versions", icon: History },
  { to: "/compare", label: "Compare", icon: GitCompare },
  { to: "/drift", label: "Drift", icon: Radar },
  { to: "/dependencies", label: "Dependencies", icon: Share2 },
  { to: "/timeline", label: "Timeline", icon: ActivityIcon },
  { to: "/snapshots", label: "Snapshots", icon: Camera },
  { to: "/story", label: "Story", icon: BookOpen },
];

function AppShell() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const crumbs = pathname === "/" ? ["dashboard"] : pathname.split("/").filter(Boolean);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/login" });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-mono text-muted-foreground">Authenticating workstation session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const displayName = user?.full_name || user?.email?.split("@")[0] || "Architect";

  return (
    <div className="flex h-screen overflow-hidden text-foreground">
      <aside className="w-56 shrink-0 border-r border-border bg-panel flex flex-col h-full">
        <div className="h-12 px-3 flex items-center border-b border-border shrink-0">
          <Logo />
        </div>
        <div className="p-2 border-b border-border shrink-0">
          <WorkspaceSwitcher />
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
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
          <div className="px-2 pt-4 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Intelligence
          </div>
          {INTEL_NAV.map((item) => {
            const active = pathname.startsWith(item.to);
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
        <div className="shrink-0 p-2 border-t border-border space-y-2">
          <div className="surface-panel p-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>Cluster</span>
              <span className="text-success">● online</span>
            </div>
            <div className="mt-1 text-xs font-mono">us-east-1 · gen-4</div>
          </div>
          <UserMenu open={userOpen} onOpenChange={setUserOpen} user={user} onLogout={handleLogout} />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="h-12 border-b border-border bg-panel/95 backdrop-blur-sm flex items-center gap-3 px-4 shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span>archforge</span>
            {currentWorkspace && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground">{currentWorkspace.name}</span>
              </>
            )}
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3" />
                <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>{c}</span>
              </span>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-2 h-7 rounded border border-border bg-background text-xs text-muted-foreground font-mono w-64 hover:text-foreground hover:border-border/80 transition-colors"
            >
              <Search className="h-3 w-3" />
              <span>search projects, files, entities…</span>
              <kbd className="ml-auto px-1 py-px text-[10px] border border-border rounded bg-surface">⌘K</kbd>
            </button>
            <NotificationsButton open={notifOpen} onOpenChange={setNotifOpen} />
            <div className="h-7 px-2 grid place-items-center rounded border border-border bg-surface text-[11px] font-mono text-muted-foreground">
              v0.2.0
            </div>
            <div className="flex items-center gap-1.5 pl-2 border-l border-border">
              <button
                onClick={() => setUserOpen((v) => !v)}
                className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surface text-xs transition-colors"
                title="User profile & settings"
              >
                <GeometricAvatar name={displayName} size={22} />
                <span className="hidden sm:inline font-mono text-xs">{displayName}</span>
              </button>
              <button
                onClick={handleLogout}
                className="h-7 px-2 flex items-center gap-1 rounded border border-border bg-surface text-[11px] font-mono text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3 w-3" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          <Outlet />
        </main>
        <StatusBar />
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
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

const NOTIFICATIONS = [
  { id: 1, tone: "ok", icon: CheckCircle2, title: "Architecture generated", body: "payments-platform · score 92", time: "2m" },
  { id: 2, tone: "warn", icon: ShieldAlert, title: "Security warning", body: "Missing rate limit on /login", time: "18m" },
  { id: 3, tone: "ok", icon: Package, title: "Export completed", body: "engineering-report.pdf · 4.2 MB", time: "1h" },
  { id: 4, tone: "info", icon: Sparkles, title: "Documentation updated", body: "128 modules re-indexed", time: "3h" },
  { id: 5, tone: "warn", icon: ShieldAlert, title: "Dependency risk", body: "3 packages need review", time: "yesterday" },
  { id: 6, tone: "ok", icon: GitBranch, title: "Repository imported", body: "acme/identity-service", time: "2d" },
] as const;

function NotificationsButton({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className="h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 mt-2 w-80 surface-panel shadow-xl z-50 overflow-hidden">
            <div className="h-9 px-3 flex items-center border-b border-border">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Notifications
              </span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                {NOTIFICATIONS.length} events
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {NOTIFICATIONS.map((n) => {
                const Icon = n.icon;
                const tone =
                  n.tone === "ok"
                    ? "text-success"
                    : n.tone === "warn"
                      ? "text-warning"
                      : "text-info";
                return (
                  <div key={n.id} className="p-3 flex items-start gap-2.5 hover:bg-surface/50 transition-colors">
                    <Icon className={"h-3.5 w-3.5 mt-0.5 shrink-0 " + tone} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{n.body}</div>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">{n.time}</span>
                  </div>
                );
              })}
            </div>
            <div className="h-9 px-3 border-t border-border flex items-center justify-between">
              <button className="text-[11px] font-mono text-muted-foreground hover:text-foreground">
                Mark all as read
              </button>
              <button className="text-[11px] font-mono text-primary hover:underline">
                View history
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu({
  open,
  onOpenChange,
  user,
  onLogout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: import("@/api/auth").User | null;
  onLogout: () => void;
}) {
  const name = user?.full_name || user?.email?.split("@")[0] || "Architect";
  const email = user?.email || "architect@archforge.dev";
  const role = user?.role || "lead architect";

  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center gap-2 px-1 py-1 rounded hover:bg-surface/60 transition-colors"
      >
        <GeometricAvatar name={name} size={28} />
        <div className="min-w-0 text-left">
          <div className="text-xs truncate">{name}</div>
          <div className="text-[10px] font-mono text-muted-foreground truncate">{role}</div>
        </div>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => onOpenChange(false)} />
          <div className="absolute left-0 right-0 bottom-full mb-2 surface-panel shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <GeometricAvatar name={name} size={32} />
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{name}</div>
                <div className="text-[10px] font-mono text-muted-foreground truncate">{email}</div>
              </div>
            </div>
            <div className="p-2 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <UsageChip label="API" value="8.2k / 10k" pct={82} />
                <UsageChip label="Storage" value="1.4 / 5 GB" pct={28} />
              </div>
            </div>
            <div className="p-1 border-t border-border">
              <MenuLink icon={User} label="Profile" />
              <MenuLink icon={SettingsIcon} label="Account settings" to="/settings" onClick={() => onOpenChange(false)} />
              <MenuLink icon={CommandIcon} label="Keyboard shortcuts" hint="⌘K" />
              <MenuLink
                icon={LogOut}
                label="Sign out"
                onClick={() => {
                  onOpenChange(false);
                  onLogout();
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UsageChip({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[11px] font-mono">{value}</div>
      <div className="mt-1 h-1 rounded-full bg-surface overflow-hidden">
        <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MenuLink({
  icon: Icon,
  label,
  hint,
  to,
  onClick,
}: {
  icon: typeof User;
  label: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <div className="flex items-center gap-2 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-colors">
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      {hint && <span className="ml-auto font-mono text-[10px]">{hint}</span>}
    </div>
  );
  if (to) {
    return (
      <Link to={to} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return <button onClick={onClick} className="w-full text-left">{inner}</button>;
}

function StatusBar() {
  const { data: health, isError } = useQuery({
    queryKey: ["backend-health"],
    queryFn: getHealth,
    staleTime: 30000,
    retry: 1,
  });

  return (
    <div className="h-6 shrink-0 border-t border-border bg-panel/80 flex items-center gap-4 px-3 text-[10px] font-mono text-muted-foreground">
      <span className="flex items-center gap-1.5" id="backend-health-indicator">
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (health?.status === "ok" ? "bg-success" : isError ? "bg-destructive" : "bg-warning animate-pulse")
          }
        />
        api: {health?.status === "ok" ? "connected" : isError ? "offline" : "connecting..."}
      </span>
      <span>branch: main</span>
      <span>latency: 42ms</span>
      <span className="ml-auto">UTF-8</span>
      <span>LF</span>
      <span>TypeScript</span>
      <span className="text-primary">⌘K</span>
    </div>
  );
}

function WorkspaceSwitcher() {
  const {
    workspaces,
    currentWorkspace,
    selectWorkspace,
    setIsNewWorkspaceOpen,
    setIsNewProjectOpen,
  } = useWorkspace();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded border border-border bg-surface/60 hover:bg-surface text-left transition-colors"
        title="Active Workspace"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium truncate">
            {currentWorkspace ? currentWorkspace.name : "Select Workspace"}
          </span>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full mt-1 surface-panel shadow-xl z-50 overflow-hidden divide-y divide-border">
            <div className="p-1 max-h-48 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Workspaces ({workspaces.length})
              </div>
              {workspaces.length === 0 ? (
                <div className="px-2 py-2 text-xs text-muted-foreground font-mono">
                  No workspaces yet
                </div>
              ) : (
                workspaces.map((w) => {
                  const active = currentWorkspace?.id === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => {
                        selectWorkspace(w);
                        setOpen(false);
                      }}
                      className={
                        "w-full flex items-center justify-between px-2 py-1.5 rounded text-xs text-left transition-colors " +
                        (active ? "bg-surface font-medium text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-surface/50")
                      }
                    >
                      <span className="truncate">{w.name}</span>
                      {active && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
            <div className="p-1 space-y-0.5">
              <button
                onClick={() => {
                  setOpen(false);
                  setIsNewWorkspaceOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-primary hover:bg-surface/60 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>New Workspace</span>
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setIsNewProjectOpen(true);
                }}
                className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface/60 transition-colors"
              >
                <Plus className="h-3 w-3" />
                <span>New Project</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
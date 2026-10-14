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
  ShieldCheck,
  Sparkles,
  Package,
  User,
  LogOut,
  Settings as SettingsIcon,
  History,
  GitCompare,
  Radar,
  Share2,
  FlaskConical,
  Activity as ActivityIcon,
  Camera,
  BookOpen,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CommandPalette } from "@/components/command-palette";
import { GeometricAvatar } from "@/components/geometric-avatar";
import { getHealth } from "@/api/health";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/api";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

export interface NavItem {
  to:
    | "/"
    | "/quality"
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
    | "/impact"
    | "/timeline"
    | "/snapshots"
    | "/story"
    | "/workflow"
    | "/knowledge-graph";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  items: NavItem[];
}

export const NAVIGATION_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    id: "design-studio",
    label: "Design Studio",
    icon: Workflow,
    items: [
      { to: "/workspace", label: "Workspace Studio", icon: Workflow },
      { to: "/architecture", label: "Architecture", icon: Network },
      { to: "/versions", label: "Versions", icon: History },
      { to: "/compare", label: "Compare", icon: GitCompare },
    ],
  },
  {
    id: "code-intelligence",
    label: "Code Intelligence",
    icon: GitBranch,
    items: [
      { to: "/repository", label: "Repository", icon: GitBranch },
      { to: "/dependencies", label: "Dependencies", icon: Package },
      { to: "/drift", label: "Architecture Drift", icon: Radar },
      { to: "/impact", label: "Impact Analysis", icon: ShieldAlert },
      { to: "/knowledge-graph", label: "Knowledge Graph", icon: Share2 },
    ],
  },
  {
    id: "engineering",
    label: "Engineering",
    icon: ActivityIcon,
    items: [
      { to: "/workflow", label: "Workflow Orchestrator", icon: ActivityIcon },
      { to: "/playground", label: "Engineering Playground", icon: FlaskConical },
      { to: "/documentation", label: "Documentation", icon: FileText },
      { to: "/story", label: "Story Mode", icon: BookOpen },
    ],
  },
  {
    id: "release-quality",
    label: "Release & Quality",
    icon: ShieldCheck,
    items: [
      { to: "/quality", label: "Quality & Readiness", icon: ShieldCheck },
    ],
  },
  {
    id: "insights-exports",
    label: "Insights & Exports",
    icon: BarChart3,
    items: [
      { to: "/analytics", label: "Analytics & Telemetry", icon: BarChart3 },
      { to: "/exports", label: "Exports", icon: Download },
      { to: "/timeline", label: "Project Timeline", icon: History },
      { to: "/snapshots", label: "Architecture Snapshots", icon: Camera },
    ],
  },
  {
    id: "workspace-admin",
    label: "Workspace Administration",
    icon: Settings,
    items: [
      { to: "/settings", label: "Settings & Members", icon: Settings },
    ],
  },
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Collapsed groups state with persistence
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("archforge:nav_collapsed_groups");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Automatically expand group containing active route
  useEffect(() => {
    for (const group of NAVIGATION_GROUPS) {
      const hasActive = group.items.some((item) =>
        item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/")
      );
      if (hasActive && collapsedGroups[group.id]) {
        setCollapsedGroups((prev) => {
          const next = { ...prev, [group.id]: false };
          try {
            localStorage.setItem("archforge:nav_collapsed_groups", JSON.stringify(next));
          } catch {}
          return next;
        });
      }
    }
  }, [pathname, collapsedGroups]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem("archforge:nav_collapsed_groups", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

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
      {/* Desktop Sidebar */}
      <aside className="w-56 shrink-0 border-r border-border bg-panel hidden md:flex flex-col h-full">
        <div className="h-12 px-3 flex items-center border-b border-border shrink-0">
          <Logo />
        </div>
        <div className="p-2 border-b border-border shrink-0">
          <WorkspaceSwitcher />
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-1 select-none">
          {NAVIGATION_GROUPS.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.id]);
            const GroupIcon = group.icon;
            const hasActiveItem = group.items.some((item) =>
              item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/")
            );

            return (
              <div key={group.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground rounded transition-colors group select-none"
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GroupIcon className={`h-3 w-3 shrink-0 transition-colors ${hasActiveItem ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground"}`} />
                    <span className="truncate">{group.label}</span>
                  </div>
                  <ChevronDown
                    className={`h-3 w-3 text-muted-foreground/70 transition-transform duration-150 shrink-0 ${
                      isCollapsed ? "-rotate-90" : "rotate-0"
                    }`}
                  />
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 pl-2 border-l border-border/40 ml-2.5">
                    {group.items.map((item) => {
                      const active = item.exact
                        ? pathname === item.to
                        : pathname === item.to || pathname.startsWith(item.to + "/");
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={
                            "flex items-center gap-2 h-7 px-2 rounded text-xs transition-colors " +
                            (active
                              ? "bg-surface text-foreground font-medium border border-border/80 shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-surface/50 border border-transparent")
                          }
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="shrink-0 p-2 border-t border-border space-y-2">
          <div className="surface-panel p-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <span>Cluster</span>
              <span className="text-success">● online</span>
            </div>
            <div className="mt-0.5 text-xs font-mono">us-east-1 · gen-4</div>
          </div>
          <UserMenu open={userOpen} onOpenChange={setUserOpen} user={user} onLogout={handleLogout} />
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[85vw] bg-panel border-r border-border h-full flex flex-col z-10 shadow-2xl">
            <div className="h-12 px-3 flex items-center justify-between border-b border-border shrink-0">
              <Logo />
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-surface"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2 border-b border-border shrink-0">
              <WorkspaceSwitcher />
            </div>
            <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-1">
              {NAVIGATION_GROUPS.map((group) => {
                const isCollapsed = Boolean(collapsedGroups[group.id]);
                const GroupIcon = group.icon;
                const hasActiveItem = group.items.some((item) =>
                  item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + "/")
                );

                return (
                  <div key={group.id} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-mono uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground rounded transition-colors group select-none"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GroupIcon className={`h-3 w-3 shrink-0 ${hasActiveItem ? "text-primary" : "text-muted-foreground/80"}`} />
                        <span className="truncate">{group.label}</span>
                      </div>
                      <ChevronDown
                        className={`h-3 w-3 text-muted-foreground/70 transition-transform duration-150 shrink-0 ${
                          isCollapsed ? "-rotate-90" : "rotate-0"
                        }`}
                      />
                    </button>

                    {!isCollapsed && (
                      <div className="space-y-0.5 pl-2 border-l border-border/40 ml-2.5">
                        {group.items.map((item) => {
                          const active = item.exact
                            ? pathname === item.to
                            : pathname === item.to || pathname.startsWith(item.to + "/");
                          const Icon = item.icon;
                          return (
                            <Link
                              key={item.to}
                              to={item.to}
                              onClick={() => setMobileNavOpen(false)}
                              className={
                                "flex items-center gap-2 h-7 px-2 rounded text-xs transition-colors " +
                                (active
                                  ? "bg-surface text-foreground font-medium border border-border/80 shadow-xs"
                                  : "text-muted-foreground hover:text-foreground hover:bg-surface/50 border border-transparent")
                              }
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            <div className="shrink-0 p-2 border-t border-border space-y-2">
              <UserMenu open={userOpen} onOpenChange={setUserOpen} user={user} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="relative z-50 h-12 border-b border-border bg-panel/95 backdrop-blur-sm flex items-center gap-3 px-4 shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground min-w-0 truncate">
            <span className="hidden sm:inline">archforge</span>
            {currentWorkspace && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0 hidden sm:inline" />
                <span className="text-foreground shrink-0">{currentWorkspace.name}</span>
                <ChevronRight className="h-3 w-3 shrink-0" />
                <ProjectSwitcher variant="header" />
              </>
            )}
            {crumbs.map((c, i) => (
              <span key={i} className="hidden lg:flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 shrink-0" />
                <span className={i === crumbs.length - 1 ? "text-foreground font-medium" : ""}>{c}</span>
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

function formatRelativeTime(dateString: string): string {
  try {
    const delta = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (delta < 60) return "just now";
    if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
    if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
    return `${Math.floor(delta / 86400)}d ago`;
  } catch {
    return "";
  }
}

function NotificationsButton({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.read) {
      markReadMutation.mutate(n.id);
    }
    const target = (n.metadata?.route as string) || (n.metadata?.path as string);
    if (target) {
      onOpenChange(false);
      navigate({ to: target as any });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => onOpenChange(!open)}
        className="h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-primary text-[9px] font-mono font-bold text-primary-foreground flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
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
                {unreadCount > 0 ? `${unreadCount} unread` : `${notifications.length} total`}
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-border">
              {isLoading ? (
                <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Loading notifications…
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const isErr = n.severity === "error";
                  const isWarn = n.severity === "warning";
                  const isSuccess = n.severity === "success";

                  const Icon = isErr || isWarn
                    ? ShieldAlert
                    : isSuccess
                      ? CheckCircle2
                      : n.type?.includes("export")
                        ? Package
                        : Sparkles;

                  const tone = isErr
                    ? "text-destructive"
                    : isWarn
                      ? "text-warning"
                      : isSuccess
                        ? "text-success"
                        : "text-primary";

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 flex items-start gap-2.5 transition-colors cursor-pointer ${
                        n.read ? "hover:bg-surface/50 opacity-75" : "bg-primary/5 hover:bg-primary/10"
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs truncate ${!n.read ? "font-semibold text-foreground" : "font-medium"}`}>
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="h-9 px-3 border-t border-border flex items-center justify-between">
              <button
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending || unreadCount === 0}
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              >
                {markAllMutation.isPending ? "Marking…" : "Mark all as read"}
              </button>
              <Link
                to="/analytics"
                onClick={() => onOpenChange(false)}
                className="text-[11px] font-mono text-primary hover:underline"
              >
                Activity trail →
              </Link>
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
              <MenuLink
                icon={User}
                label="Profile"
                to="/settings"
                search={{ tab: "general" }}
                onClick={() => {
                  onOpenChange(false);
                  window.dispatchEvent(new CustomEvent("archforge:settings-tab", { detail: "general" }));
                }}
              />
              <MenuLink
                icon={SettingsIcon}
                label="Account settings"
                to="/settings"
                search={{ tab: "general" }}
                onClick={() => {
                  onOpenChange(false);
                  window.dispatchEvent(new CustomEvent("archforge:settings-tab", { detail: "general" }));
                }}
              />
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
  search,
  onClick,
}: {
  icon: typeof User;
  label: string;
  hint?: string;
  to?: string;
  search?: Record<string, any>;
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
      <Link to={to as any} search={search as any} onClick={onClick}>
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
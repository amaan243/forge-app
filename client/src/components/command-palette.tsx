import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Workflow,
  Network,
  GitBranch,
  FileText,
  BarChart3,
  Download,
  Settings,
  Sparkles,
  Play,
  Search,
  ArrowRight,
  FolderGit2,
  FileCode2,
  Database,
  Terminal,
  ShieldCheck,
  Loader2,
  Clock,
  Layers,
  History as HistoryIcon,
} from "lucide-react";
import { searchGlobal, type GlobalSearchResults } from "@/api/search";
import { useWorkspace } from "@/lib/workspace-context";

type Cmd = {
  id: string;
  label: string;
  subtitle?: string;
  hint?: string;
  group: "Navigate" | "Actions" | "Projects" | "Components" | "Documentation" | "Repositories" | "Snapshots" | "Timeline";
  icon: typeof Search;
  to?: string;
  action?: () => void;
  keywords?: string;
};

const BASE_COMMANDS: Cmd[] = [
  { id: "n1", label: "Go to Dashboard", group: "Navigate", icon: LayoutDashboard, to: "/dashboard", hint: "G D" },
  { id: "n-quality", label: "Release Quality & Readiness", group: "Navigate", icon: ShieldCheck, to: "/quality", hint: "G Q" },
  { id: "n2", label: "Open Workspace", group: "Navigate", icon: Workflow, to: "/workspace", hint: "G W" },
  { id: "n3", label: "Architecture", group: "Navigate", icon: Network, to: "/architecture" },
  { id: "n4", label: "Repository Analysis", group: "Navigate", icon: GitBranch, to: "/repository" },
  { id: "n5", label: "Documentation", group: "Navigate", icon: FileText, to: "/documentation" },
  { id: "n6", label: "Analytics & Insights", group: "Navigate", icon: BarChart3, to: "/analytics" },
  { id: "n7", label: "Exports", group: "Navigate", icon: Download, to: "/exports" },
  { id: "n8", label: "Settings & Members", group: "Navigate", icon: Settings, to: "/settings" },

  { id: "a1", label: "Generate Architecture", group: "Actions", icon: Sparkles, to: "/workspace", hint: "⌘ G" },
  { id: "a2", label: "Generate Documentation", group: "Actions", icon: FileText, to: "/documentation" },
  { id: "a3", label: "Analyze Repository", group: "Actions", icon: GitBranch, to: "/repository" },
  { id: "a4", label: "Run Architecture Pipeline", group: "Actions", icon: Play, to: "/workspace" },
  { id: "a5", label: "Export Project Data", group: "Actions", icon: Download, to: "/exports" },
  { id: "a6", label: "Open Console / Story Mode", group: "Actions", icon: Terminal, to: "/story" },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResults | null>(null);
  const navigate = useNavigate();
  const { projects, selectProject } = useWorkspace();
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
      setIsSearching(false);
      setSearchResults(null);
    }
  }, [open]);

  // Debounced search query
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setIsSearching(false);
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    const requestId = ++searchRequestIdRef.current;
    const timeout = setTimeout(async () => {
      try {
        const data = await searchGlobal(term);
        if (searchRequestIdRef.current === requestId) {
          setSearchResults(data);
          setIsSearching(false);
        }
      } catch (err) {
        if (searchRequestIdRef.current === requestId) {
          setSearchResults(null);
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [q]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();

    if (!term) {
      // Return base navigation + action commands + workspace projects
      const projectCmds: Cmd[] = projects.map((p) => ({
        id: `project-${p.id}`,
        label: p.name,
        subtitle: p.description || "Workspace project",
        group: "Projects",
        icon: FolderGit2,
        action: () => {
          selectProject(p);
          navigate({ to: "/workspace" });
          onClose();
        },
      }));

      return [...BASE_COMMANDS, ...projectCmds];
    }

    const filteredBase: Cmd[] = BASE_COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        c.group.toLowerCase().includes(term) ||
        c.keywords?.toLowerCase().includes(term)
    );

    const liveCmds: Cmd[] = [];

    if (searchResults) {
      // Map live projects
      searchResults.projects.forEach((p) => {
        liveCmds.push({
          id: `p-${p.id}`,
          label: p.name,
          subtitle: p.description || "Project",
          group: "Projects",
          icon: FolderGit2,
          action: () => {
            const match = projects.find((proj) => proj.id === p.id);
            if (match) selectProject(match);
            navigate({ to: "/workspace" });
            onClose();
          },
        });
      });

      // Map live architecture nodes
      searchResults.nodes.forEach((n) => {
        liveCmds.push({
          id: `node-${n.id}`,
          label: n.name,
          subtitle: `${n.type} · version ${n.architecture_version_id.slice(0, 8)}`,
          group: "Components",
          icon: Layers,
          to: "/workspace",
        });
      });

      // Map live documentation
      searchResults.documentation.forEach((d) => {
        liveCmds.push({
          id: `doc-${d.id}`,
          label: d.title,
          subtitle: `Type: ${d.type}`,
          group: "Documentation",
          icon: FileText,
          to: "/documentation",
        });
      });

      // Map live repositories
      searchResults.repositories.forEach((r) => {
        liveCmds.push({
          id: `repo-${r.id}`,
          label: r.repository_name,
          subtitle: r.repository_url,
          group: "Repositories",
          icon: GitBranch,
          to: "/repository",
        });
      });

      // Map snapshots
      searchResults.snapshots.forEach((s) => {
        liveCmds.push({
          id: `snap-${s.id}`,
          label: s.name,
          subtitle: `Type: ${s.type}`,
          group: "Snapshots",
          icon: HistoryIcon,
          to: "/snapshots",
        });
      });

      // Map timeline events
      searchResults.timeline.forEach((t) => {
        liveCmds.push({
          id: `time-${t.id}`,
          label: `${t.event_type} (${t.entity_type})`,
          subtitle: `Project ID: ${t.project_id.slice(0, 8)}`,
          group: "Timeline",
          icon: Clock,
          to: "/timeline",
        });
      });
    }

    return [...liveCmds, ...filteredBase];
  }, [q, searchResults, projects, selectProject, navigate, onClose]);

  const grouped = useMemo(() => {
    const m: Record<string, Cmd[]> = {};
    results.forEach((c) => {
      m[c.group] = m[c.group] || [];
      m[c.group].push(c);
    });
    return m;
  }, [results]);

  const flat = results;

  const executeCmd = (cmd: Cmd | undefined) => {
    if (!cmd) return;
    if (cmd.action) {
      cmd.action();
    } else if (cmd.to) {
      navigate({ to: cmd.to as any });
      onClose();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(flat.length - 1, i + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      }
      if (e.key === "Enter") {
        executeCmd(flat[idx]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, idx]);

  if (!open) return null;

  let counter = -1;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto mt-24 w-[92%] max-w-2xl surface-panel shadow-2xl overflow-hidden border border-border">
        <div className="h-11 border-b border-border flex items-center gap-2 px-3">
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            placeholder="Search projects, architecture components, repositories, documentation…"
            className="flex-1 bg-transparent border-0 outline-none text-sm font-mono placeholder:text-muted-foreground"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono border border-border rounded bg-surface text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {flat.length === 0 && !isSearching && (
            <div className="p-8 text-center text-xs font-mono text-muted-foreground">
              No matching resources or commands found
            </div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="py-1">
              <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {group}
              </div>
              {items.map((c) => {
                counter++;
                const active = counter === idx;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    onClick={() => executeCmd(c)}
                    onMouseEnter={() => setIdx(counter)}
                    className={
                      "w-full flex items-center gap-2.5 h-10 px-3 text-left text-xs transition-colors " +
                      (active ? "bg-surface text-foreground" : "text-muted-foreground hover:bg-surface/60")
                    }
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{c.label}</div>
                      {c.subtitle && (
                        <div className="truncate text-[10px] font-mono text-muted-foreground">{c.subtitle}</div>
                      )}
                    </div>
                    {c.hint && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{c.hint}</span>
                    )}
                    {active && <ArrowRight className="h-3 w-3 text-primary ml-1 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="h-8 border-t border-border px-3 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span><kbd className="px-1 border border-border rounded bg-surface">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 border border-border rounded bg-surface">↵</kbd> select</span>
          <span><kbd className="px-1 border border-border rounded bg-surface">esc</kbd> close</span>
          <span className="ml-auto">{flat.length} results</span>
        </div>
      </div>
    </div>
  );
}
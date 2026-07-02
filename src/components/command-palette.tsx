import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigate" | "Actions" | "Projects" | "Files" | "Recent";
  icon: typeof Search;
  to?: string;
  keywords?: string;
};

const COMMANDS: Cmd[] = [
  { id: "n1", label: "Go to Dashboard", group: "Navigate", icon: LayoutDashboard, to: "/", hint: "G D" },
  { id: "n2", label: "Open Workspace", group: "Navigate", icon: Workflow, to: "/workspace", hint: "G W" },
  { id: "n3", label: "Architecture", group: "Navigate", icon: Network, to: "/architecture" },
  { id: "n4", label: "Repository", group: "Navigate", icon: GitBranch, to: "/repository" },
  { id: "n5", label: "Documentation", group: "Navigate", icon: FileText, to: "/documentation" },
  { id: "n6", label: "Analytics", group: "Navigate", icon: BarChart3, to: "/analytics" },
  { id: "n7", label: "Exports", group: "Navigate", icon: Download, to: "/exports" },
  { id: "n8", label: "Settings", group: "Navigate", icon: Settings, to: "/settings" },

  { id: "a1", label: "Generate Architecture", group: "Actions", icon: Sparkles, to: "/workspace", hint: "⌘ G" },
  { id: "a2", label: "Generate Documentation", group: "Actions", icon: FileText, to: "/documentation" },
  { id: "a3", label: "Analyze Repository", group: "Actions", icon: GitBranch, to: "/repository" },
  { id: "a4", label: "Run Pipeline", group: "Actions", icon: Play, to: "/workspace" },
  { id: "a5", label: "Export current project", group: "Actions", icon: Download, to: "/exports" },
  { id: "a6", label: "Open Console", group: "Actions", icon: Terminal, to: "/workspace" },

  { id: "p1", label: "payments-platform", group: "Projects", icon: FolderGit2, to: "/workspace", keywords: "acme payments" },
  { id: "p2", label: "identity-service", group: "Projects", icon: FolderGit2, to: "/workspace" },
  { id: "p3", label: "billing-portal", group: "Projects", icon: FolderGit2, to: "/workspace" },

  { id: "f1", label: "src/services/auth/index.ts", group: "Files", icon: FileCode2, to: "/repository" },
  { id: "f2", label: "src/services/payments/router.ts", group: "Files", icon: FileCode2, to: "/repository" },
  { id: "f3", label: "db/migrations/2026_07_users.sql", group: "Files", icon: Database, to: "/repository" },

  { id: "r1", label: "requirements.md", group: "Recent", icon: FileText, to: "/workspace" },
  { id: "r2", label: "architecture.canvas", group: "Recent", icon: Network, to: "/workspace" },
  { id: "r3", label: "user-service.md", group: "Recent", icon: FileText, to: "/documentation" },
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
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return COMMANDS;
    return COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(term) ||
        c.group.toLowerCase().includes(term) ||
        c.keywords?.toLowerCase().includes(term),
    );
  }, [q]);

  const grouped = useMemo(() => {
    const m: Record<string, Cmd[]> = {};
    results.forEach((c) => {
      m[c.group] = m[c.group] || [];
      m[c.group].push(c);
    });
    return m;
  }, [results]);

  const flat = results;

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
        const cmd = flat[idx];
        if (cmd?.to) {
          navigate({ to: cmd.to });
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, idx, navigate, onClose]);

  if (!open) return null;

  let counter = -1;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-auto mt-24 w-[92%] max-w-2xl surface-panel shadow-2xl overflow-hidden">
        <div className="h-11 border-b border-border flex items-center gap-2 px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            placeholder="Type a command, project, or file…"
            className="flex-1 bg-transparent border-0 outline-none text-sm font-mono placeholder:text-muted-foreground"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono border border-border rounded bg-surface text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {flat.length === 0 && (
            <div className="p-6 text-center text-xs font-mono text-muted-foreground">No results</div>
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
                    onClick={() => {
                      if (c.to) {
                        navigate({ to: c.to });
                        onClose();
                      }
                    }}
                    onMouseEnter={() => setIdx(counter)}
                    className={
                      "w-full flex items-center gap-2.5 h-9 px-3 text-left text-xs transition-colors " +
                      (active ? "bg-surface text-foreground" : "text-muted-foreground hover:bg-surface/60")
                    }
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{c.label}</span>
                    {c.hint && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{c.hint}</span>
                    )}
                    {active && <ArrowRight className="h-3 w-3 text-primary ml-1" />}
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
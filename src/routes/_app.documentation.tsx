import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Bookmark,
  Copy,
  Check,
  Download,
  BookOpen,
  Network,
  Database,
  KeyRound,
  CloudUpload,
  GitMerge,
  Shield,
  Zap,
  Activity,
  FlaskConical,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_app/documentation")({
  head: () => ({
    meta: [
      { title: "Documentation — ArchForge" },
      { name: "description", content: "Auto-generated engineering documentation for every service, module, and API." },
      { property: "og:title", content: "Documentation — ArchForge" },
      { property: "og:description", content: "Auto-generated engineering documentation for services and APIs." },
    ],
  }),
  component: DocumentationPage,
});

const CATEGORIES = [
  { key: "readme", label: "README", icon: BookOpen },
  { key: "arch", label: "Architecture", icon: Network },
  { key: "api", label: "API", icon: FileText },
  { key: "db", label: "Database", icon: Database },
  { key: "auth", label: "Authentication", icon: KeyRound },
  { key: "deploy", label: "Deployment", icon: CloudUpload },
  { key: "cicd", label: "CI/CD", icon: GitMerge },
  { key: "sec", label: "Security", icon: Shield },
  { key: "perf", label: "Performance", icon: Zap },
  { key: "mon", label: "Monitoring", icon: Activity },
  { key: "test", label: "Testing", icon: FlaskConical },
] as const;

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "responsibilities", label: "Responsibilities" },
  { id: "endpoints", label: "API endpoints" },
  { id: "data-model", label: "Data model" },
  { id: "errors", label: "Error handling" },
  { id: "events", label: "Events" },
  { id: "runbook", label: "Runbook" },
];

const SAMPLE_CODE = `import express from "express";
import { authMiddleware } from "../auth";
import { db } from "../lib/db";

const router = express.Router();

router.get("/v1/users/:id", authMiddleware, async (req, res) => {
  const user = await db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "not_found" });
  return res.json(user);
});

export default router;`;

function DocumentationPage() {
  const [active, setActive] = useState("arch");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)_220px] min-h-[calc(100vh-3rem)]">
      <aside className="border-r border-border bg-panel/40 overflow-y-auto flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search docs…"
              className="w-full h-7 pl-6 pr-2 rounded border border-border bg-background text-[11px] font-mono placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>
        <div className="p-2 space-y-0.5 flex-1">
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Sections</div>
          {CATEGORIES.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())).map((c) => {
            const Icon = c.icon;
            const on = active === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActive(c.key)}
                className={
                  "w-full flex items-center gap-2 h-7 px-2 rounded text-xs text-left transition-colors " +
                  (on ? "bg-surface text-foreground border border-border" : "text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{c.label}</span>
              </button>
            );
          })}
          <div className="px-2 pt-4 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Bookmark className="h-3 w-3" /> Bookmarks
          </div>
          {["services/user-service.md", "db/schema.md", "sec/threat-model.md"].map((b) => (
            <div key={b} className="h-7 px-2 flex items-center rounded text-xs text-muted-foreground hover:text-foreground hover:bg-surface/60 truncate font-mono">
              {b}
            </div>
          ))}
        </div>
      </aside>

      <div className="min-w-0 overflow-y-auto">
        <div className="h-11 border-b border-border px-4 flex items-center gap-2">
          <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> services / user-service.md
          </div>
          <div className="ml-auto flex items-center gap-1">
            <IconGhost title="Bookmark"><Bookmark className="h-3.5 w-3.5" /></IconGhost>
            <IconGhost title="Export Markdown"><Download className="h-3.5 w-3.5" /></IconGhost>
            <button className="h-7 px-2 rounded border border-border bg-surface hover:bg-surface/80 text-[11px] font-mono flex items-center gap-1.5">
              <Download className="h-3 w-3" /> PDF
            </button>
          </div>
        </div>

        <article className="max-w-3xl mx-auto p-8 space-y-6">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Service</div>
            <h1 id="overview" className="text-3xl font-display font-semibold tracking-tight">User Service</h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The User Service owns the canonical user profile, tenant membership, and role assignments.
            It exposes a REST API to the API Gateway and publishes profile-change events to RabbitMQ
            for downstream consumers.
          </p>

          <CollapsibleSection
            id="responsibilities"
            title="Responsibilities"
            open={!collapsed.responsibilities}
            onToggle={() => setCollapsed((c) => ({ ...c, responsibilities: !c.responsibilities }))}
          >
            <ul className="text-sm space-y-1 list-disc pl-5 text-muted-foreground">
              <li>Profile CRUD and validation</li>
              <li>Tenant membership and role assignment</li>
              <li>Emitting <code className="font-mono text-primary text-[12px]">user.updated</code> and <code className="font-mono text-primary text-[12px]">user.deleted</code> events</li>
            </ul>
          </CollapsibleSection>

          <CollapsibleSection
            id="endpoints"
            title="API endpoints"
            open={!collapsed.endpoints}
            onToggle={() => setCollapsed((c) => ({ ...c, endpoints: !c.endpoints }))}
          >
            <CodeBlock
              lang="ts"
              code={SAMPLE_CODE}
              copied={copied}
              onCopy={() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="data-model"
            title="Data model"
            open={!collapsed.dataModel}
            onToggle={() => setCollapsed((c) => ({ ...c, dataModel: !c.dataModel }))}
          >
            <div className="rounded border border-border overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead className="bg-surface/60">
                  <tr>
                    <th className="text-left px-3 py-1.5 border-b border-border">field</th>
                    <th className="text-left px-3 py-1.5 border-b border-border">type</th>
                    <th className="text-left px-3 py-1.5 border-b border-border">notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    ["id", "uuid", "primary key"],
                    ["email", "string", "unique, encrypted"],
                    ["tenant_id", "uuid", "fk → tenants"],
                    ["role", "enum", "user | admin | owner"],
                    ["created_at", "timestamp", "utc"],
                  ].map(([f, t, n]) => (
                    <tr key={f}>
                      <td className="px-3 py-1.5">{f}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{t}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </article>
      </div>

      <aside className="border-l border-border p-3 space-y-2 bg-panel/40">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">On this page</div>
        {TOC.map((t, i) => (
          <a
            key={t.id}
            href={"#" + t.id}
            className={
              "flex items-center gap-1.5 h-7 px-2 rounded text-xs " +
              (i === 0 ? "text-foreground bg-surface border border-border" : "text-muted-foreground hover:text-foreground hover:bg-surface/60")
            }
          >
            <span className="h-1 w-1 rounded-full bg-primary/60" />
            {t.label}
          </a>
        ))}
      </aside>
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <button onClick={onToggle} className="w-full flex items-center gap-2 text-left group">
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <h2 className="text-lg font-display font-semibold tracking-tight">{title}</h2>
        <a href={"#" + id} className="ml-1 text-muted-foreground opacity-0 group-hover:opacity-100 text-xs font-mono">#</a>
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

function CodeBlock({ lang, code, copied, onCopy }: { lang: string; code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="rounded border border-border bg-background overflow-hidden">
      <div className="h-8 px-3 flex items-center border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{lang}</span>
        <button
          onClick={() => {
            if (typeof navigator !== "undefined") navigator.clipboard?.writeText(code);
            onCopy();
          }}
          className="ml-auto flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
        >
          {copied ? <><Check className="h-3 w-3" /> copied</> : <><Copy className="h-3 w-3" /> copy</>}
        </button>
      </div>
      <pre className="p-3 text-[12px] leading-relaxed overflow-x-auto"><code className="font-mono">{highlight(code)}</code></pre>
    </div>
  );
}

function highlight(code: string) {
  // Very small syntactic pass: color keywords, strings, comments.
  const parts: React.ReactNode[] = [];
  const regex = /(\/\/[^\n]*|"[^"]*"|`[^`]*`|\b(?:import|from|const|let|var|return|async|await|if|else|new|export|default|function)\b)/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = regex.exec(code))) {
    if (m.index > last) parts.push(code.slice(last, m.index));
    const t = m[0];
    const cls = t.startsWith("//")
      ? "text-muted-foreground"
      : t.startsWith('"') || t.startsWith("`")
        ? "text-success"
        : "text-primary";
    parts.push(<span key={k++} className={cls}>{t}</span>);
    last = m.index + t.length;
  }
  if (last < code.length) parts.push(code.slice(last));
  return parts;
}

function IconGhost({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button title={title} className="h-7 w-7 grid place-items-center rounded border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
      {children}
    </button>
  );
}
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthLogo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="2.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="15.5" y="2.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="2.5" y="15.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-muted-foreground" />
        <rect x="15.5" y="15.5" width="6" height="6" stroke="currentColor" strokeWidth="1.25" className="text-primary" fill="currentColor" fillOpacity="0.15" />
        <path d="M8.5 5.5h7M5.5 8.5v7M18.5 8.5v7M8.5 18.5h7" stroke="currentColor" strokeWidth="1.25" className="text-border" />
      </svg>
      <span className="font-display font-semibold text-base tracking-tight">
        Arch<span className="text-primary">Forge</span>
      </span>
    </div>
  );
}

export function AnimatedArchitecture() {
  const nodes = [
    { x: 90, y: 60 },
    { x: 200, y: 40 },
    { x: 320, y: 60 },
    { x: 90, y: 160 },
    { x: 200, y: 140 },
    { x: 320, y: 160 },
    { x: 200, y: 240 },
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [1, 4], [0, 3], [2, 5], [3, 4], [4, 5], [3, 6], [4, 6], [5, 6],
  ];
  return (
    <svg viewBox="0 0 420 300" className="w-full h-full" aria-hidden>
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/60" />
        </pattern>
      </defs>
      <rect width="420" height="300" fill="url(#grid)" />
      {edges.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x + 10}
          y1={nodes[a].y + 10}
          x2={nodes[b].x + 10}
          y2={nodes[b].y + 10}
          stroke="currentColor"
          strokeWidth="0.75"
          className="text-primary/30"
          strokeDasharray="4 4"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-16" dur="8s" repeatCount="indefinite" />
        </line>
      ))}
      {nodes.map((n, i) => (
        <g key={i} transform={`translate(${n.x}, ${n.y})`}>
          <rect width="20" height="20" fill="none" stroke="currentColor" className={i === 4 ? "text-primary" : "text-muted-foreground/60"} />
          <circle cx="10" cy="10" r="2" className={i === 4 ? "fill-primary" : "fill-muted-foreground/40"}>
            <animate attributeName="opacity" values="0.3;1;0.3" dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ))}
    </svg>
  );
}

export function AuthLayout({ children, tagline }: { children: ReactNode; tagline?: boolean }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] bg-background text-foreground">
      <aside className="hidden lg:flex flex-col justify-between border-r border-border bg-panel/40 relative overflow-hidden">
        <div className="p-8">
          <Link to="/login"><AuthLogo /></Link>
        </div>
        <div className="p-8 relative z-10 space-y-4">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Software Architecture Workstation</div>
          <h1 className="text-3xl font-display font-semibold tracking-tight max-w-sm leading-tight">
            From Requirements to Production Architecture.
          </h1>
          {tagline !== false && (
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Turn engineering briefs into services, schemas, APIs, and documentation you can ship.
            </p>
          )}
          <ul className="space-y-2 pt-4 text-sm">
            {[
              "AI architecture generation",
              "Codebase documentation",
              "Repository analysis",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-sm bg-primary" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <AnimatedArchitecture />
        </div>
        <div className="p-8 text-[10px] font-mono uppercase tracking-wider text-muted-foreground relative z-10">
          © 2026 ArchForge Engineering
        </div>
      </aside>
      <main className="flex flex-col items-center justify-center p-6 lg:p-12">
        <div className="lg:hidden mb-6"><AuthLogo /></div>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="surface-panel p-7 space-y-5">
      <div className="space-y-1.5">
        <h2 className="text-xl font-display font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function AuthField({
  label,
  hint,
  children,
  right,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center">
        <label className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</label>
        {right && <div className="ml-auto">{right}</div>}
      </div>
      {children}
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function OrDivider({ label = "or continue with" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

export function OAuthButton({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button
      type="button"
      className="h-9 flex items-center justify-center gap-2 rounded border border-border bg-background hover:bg-surface/60 transition-colors text-sm w-full"
    >
      {icon} <span>{label}</span>
    </button>
  );
}

export function GitHubMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.6.5.5 5.6.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2.9-.3 1.9-.4 2.9-.4 1 0 2 .1 2.9.4 2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.6 18.4.5 12 .5z"/>
    </svg>
  );
}
export function GoogleMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6 1.5 7.4 2.7l5.4-5.3C33.6 3.6 29.3 1.5 24 1.5 14.8 1.5 7 6.9 3.5 14.5l6.4 5c1.6-4.8 6.1-10 14.1-10z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.4-4H24v7.5h12.7c-.3 2-1.6 4.9-4.6 6.9l6.3 4.9c3.7-3.4 8.1-8.5 8.1-15.3z"/>
      <path fill="#FBBC05" d="M9.9 28.5c-.4-1.2-.7-2.5-.7-3.9 0-1.3.2-2.6.6-3.9l-6.4-5C1.7 18.9.5 22 .5 24.6c0 2.6 1.2 5.7 3 8.9l6.4-5z"/>
      <path fill="#34A853" d="M24 47.5c6.4 0 11.8-2.1 15.7-5.7l-6.3-4.9c-1.7 1.2-4 2-9.4 2-7.7 0-14.3-5.3-16.6-12.4l-6.4 5C4.3 41.3 13.3 47.5 24 47.5z"/>
    </svg>
  );
}
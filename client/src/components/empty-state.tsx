import type { ReactNode } from "react";

export function GeometricGlyph({ variant = "grid" }: { variant?: "grid" | "stack" | "graph" | "doc" | "pulse" | "cube" }) {
  const commonSvg = "text-border";
  switch (variant) {
    case "stack":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className={commonSvg} aria-hidden>
          <rect x="10" y="12" width="52" height="14" stroke="currentColor" />
          <rect x="10" y="30" width="52" height="14" stroke="currentColor" />
          <rect x="10" y="48" width="52" height="14" stroke="currentColor" className="text-primary/60" />
        </svg>
      );
    case "graph":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className={commonSvg} aria-hidden>
          <circle cx="18" cy="18" r="6" stroke="currentColor" />
          <circle cx="54" cy="18" r="6" stroke="currentColor" />
          <circle cx="36" cy="54" r="6" stroke="currentColor" className="text-primary/60" />
          <path d="M22 22 L32 50 M50 22 L40 50 M24 18 L48 18" stroke="currentColor" />
        </svg>
      );
    case "doc":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className={commonSvg} aria-hidden>
          <rect x="16" y="10" width="40" height="52" stroke="currentColor" />
          <path d="M22 22h28M22 30h28M22 38h20M22 46h24" stroke="currentColor" />
        </svg>
      );
    case "pulse":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className={commonSvg} aria-hidden>
          <path d="M4 40h14l6-18 8 32 8-24 6 10h22" stroke="currentColor" strokeWidth="1.25" className="text-primary/70" />
        </svg>
      );
    case "cube":
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className={commonSvg} aria-hidden>
          <path d="M36 8 L60 20 L60 48 L36 60 L12 48 L12 20 Z" stroke="currentColor" />
          <path d="M36 8 L36 34 M12 20 L36 34 M60 20 L36 34 M36 34 L36 60" stroke="currentColor" className="text-primary/60" />
        </svg>
      );
    default:
      return (
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none" className={commonSvg} aria-hidden>
          {Array.from({ length: 9 }).map((_, i) => {
            const x = 10 + (i % 3) * 18;
            const y = 10 + Math.floor(i / 3) * 18;
            return <rect key={i} x={x} y={y} width="16" height="16" stroke="currentColor" className={i === 4 ? "text-primary/60" : ""} />;
          })}
        </svg>
      );
  }
}

export function EmptyState({
  glyph = "grid",
  eyebrow,
  title,
  body,
  actions,
}: {
  glyph?: "grid" | "stack" | "graph" | "doc" | "pulse" | "cube";
  eyebrow?: string;
  title: string;
  body?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="grid place-items-center p-8">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto grid place-items-center h-20 w-20 rounded border border-border bg-panel/40">
          <GeometricGlyph variant={glyph} />
        </div>
        <div className="space-y-2">
          {eyebrow && (
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
          )}
          <h2 className="text-xl font-display font-semibold tracking-tight">{title}</h2>
          {body && <p className="text-sm text-muted-foreground">{body}</p>}
        </div>
        {actions && <div className="flex justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function PipelineLoader({
  steps,
  activeIndex = 0,
}: {
  steps: string[];
  activeIndex?: number;
}) {
  return (
    <div className="surface-panel p-4 space-y-3 max-w-lg">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Pipeline</div>
      <div className="space-y-1.5">
        {steps.map((s, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <div key={s} className="flex items-center gap-2 text-[12px] font-mono">
              <span
                className={
                  "h-4 w-4 grid place-items-center rounded border " +
                  (done
                    ? "border-success/40 text-success bg-success/10"
                    : active
                      ? "border-primary/50 text-primary bg-primary/10"
                      : "border-border text-muted-foreground")
                }
              >
                {done ? "✓" : active ? "›" : "·"}
              </span>
              <span className={done ? "text-muted-foreground line-through" : active ? "text-foreground" : "text-muted-foreground"}>
                {s}
              </span>
              {active && (
                <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  running
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
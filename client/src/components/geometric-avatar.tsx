function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function GeometricAvatar({
  name,
  size = 28,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  const h = hashString(name);
  const shapes = ["square", "triangle", "circle"] as const;
  const shape = shapes[h % shapes.length];
  return (
    <div
      className={"relative shrink-0 grid place-items-center rounded border border-border bg-surface overflow-hidden " + className}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} className="absolute inset-0 opacity-30" viewBox="0 0 32 32">
        {shape === "square" && (
          <rect x="2" y="2" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
        )}
        {shape === "triangle" && (
          <polygon points="16,3 30,29 2,29" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
        )}
        {shape === "circle" && (
          <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
        )}
      </svg>
      <span className="relative font-mono font-medium text-foreground" style={{ fontSize: size * 0.36 }}>
        {initials}
      </span>
    </div>
  );
}
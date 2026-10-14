import type { SVGProps } from "react";
import { Link } from "@tanstack/react-router";

export interface BrandMarkProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  glow?: boolean;
}

/**
 * ArchForge Standalone Brand Symbol Mark
 * Represents:
 * 1. Letter "A" for ArchForge
 * 2. Architectural Structural Pylon & Truss Frame
 * 3. 3-Tier Distributed System Topology (Requirements -> AST -> Quality Gate)
 * 4. Central Synthesis Reactor Core
 */
export function ArchForgeMark({
  size = 24,
  glow = true,
  className = "",
  ...props
}: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="ArchForge Symbol"
      {...props}
    >
      <defs>
        <linearGradient id="af-mark-left" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F0FF" />
          <stop offset="45%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="af-mark-right" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#0369A1" />
          <stop offset="100%" stopColor="#090D1A" />
        </linearGradient>
        <linearGradient id="af-mark-truss" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="50%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="af-mark-core" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#00F0FF" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        {glow && (
          <filter id="af-mark-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        )}
      </defs>

      {/* Structural Arch Beams */}
      {/* Left Strut */}
      <path d="M32 6 L12 52 L20 56 L32 24 Z" fill="url(#af-mark-left)" />
      {/* Right Strut */}
      <path d="M32 6 L32 24 L44 56 L52 52 Z" fill="url(#af-mark-right)" />

      {/* Crossbar Truss */}
      <path d="M19 40 L45 40 L43 45 L21 45 Z" fill="url(#af-mark-truss)" opacity="0.95" />

      {/* Engineering Network Graph Conduits */}
      <line x1="32" y1="13" x2="32" y2="32" stroke="#00F0FF" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
      <line x1="32" y1="32" x2="21" y2="48" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <line x1="32" y1="32" x2="43" y2="48" stroke="#10B981" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
      <line x1="21" y1="48" x2="43" y2="48" stroke="#0284C7" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 2" opacity="0.65" />

      {/* Apex Blueprint Node */}
      <circle cx="32" cy="11" r="5" fill="#070B14" stroke="#00F0FF" strokeWidth="2" />
      <circle cx="32" cy="11" r="2.2" fill="#00F0FF" />

      {/* Left Codebase AST Node */}
      <circle cx="21" cy="48" r="4" fill="#070B14" stroke="#38BDF8" strokeWidth="1.6" />
      <circle cx="21" cy="48" r="1.8" fill="#38BDF8" />

      {/* Right Production Quality Gate Node */}
      <circle cx="43" cy="48" r="4" fill="#070B14" stroke="#10B981" strokeWidth="1.6" />
      <circle cx="43" cy="48" r="1.8" fill="#10B981" />

      {/* Central Synthesis Reactor Core */}
      <polygon
        points="32,26 38,32 32,38 26,32"
        fill="url(#af-mark-core)"
        filter={glow ? "url(#af-mark-filter)" : undefined}
      />
      <circle cx="32" cy="32" r="1.8" fill="#FFFFFF" />
    </svg>
  );
}

export interface BrandLogoProps {
  size?: "sm" | "md" | "lg" | number;
  showTagline?: boolean;
  asLink?: boolean;
  href?: string;
  className?: string;
}

/**
 * ArchForge Full Brand Logo with Wordmark
 */
export function ArchForgeLogo({
  size = "md",
  showTagline = false,
  asLink = false,
  href = "/",
  className = "",
}: BrandLogoProps) {
  const markSize =
    typeof size === "number"
      ? size
      : size === "sm"
      ? 20
      : size === "lg"
      ? 34
      : 26;

  const titleClass =
    typeof size === "number"
      ? "text-sm"
      : size === "sm"
      ? "text-sm font-semibold"
      : size === "lg"
      ? "text-xl font-bold"
      : "text-base font-bold";

  const content = (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <ArchForgeMark size={markSize} />
      <div className="flex flex-col leading-none">
        <span className={`font-display tracking-tight text-foreground ${titleClass}`}>
          Arch<span className="text-primary bg-gradient-to-r from-primary via-cyan-400 to-sky-400 bg-clip-text text-transparent">Forge</span>
        </span>
        {showTagline && (
          <span className="text-[9px] font-mono tracking-widest uppercase text-muted-foreground mt-0.5">
            Engineering Workstation
          </span>
        )}
      </div>
    </div>
  );

  if (asLink) {
    return (
      <Link to={href as any} className="inline-flex items-center group transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}

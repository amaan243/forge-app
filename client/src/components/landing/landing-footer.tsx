import { Link } from "@tanstack/react-router";
import { ArchForgeLogo } from "@/components/brand-logo";
import {
  Network,
  Workflow,
  GitBranch,
  ShieldCheck,
  Radar,
  ShieldAlert,
  FlaskConical,
  FileText,
  Share2,
  BookOpen,
  History,
  Terminal,
} from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-[#090D16] text-muted-foreground text-xs font-mono">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand Info (2 cols on large) */}
          <div className="col-span-2 space-y-4">
            <ArchForgeLogo size="md" />
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              AI-powered Software Architecture Generator and Codebase Intelligence Platform. Turn requirements into structured architecture, traceable engineering decisions, and production-oriented documentation.
            </p>
            <div className="pt-2 text-[10px] text-muted-foreground/80 space-y-1">
              <div>Telemetry Cluster: <span className="text-foreground">us-east-1 · gen-4</span></div>
              <div>Engine Core: <span className="text-foreground">v0.2.0 · AST Parser Active</span></div>
            </div>
          </div>

          {/* Architecture Studio */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Architecture Studio
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/workspace" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Workflow className="h-3 w-3 text-primary" /> Workspace Studio
                </Link>
              </li>
              <li>
                <Link to="/architecture" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Network className="h-3 w-3" /> Topology Canvas
                </Link>
              </li>
              <li>
                <Link to="/versions" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <History className="h-3 w-3" /> Version History
                </Link>
              </li>
              <li>
                <Link to="/compare" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" /> Diff Comparison
                </Link>
              </li>
              <li>
                <Link to="/playground" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <FlaskConical className="h-3 w-3" /> Tradeoff Sandbox
                </Link>
              </li>
            </ul>
          </div>

          {/* Codebase Intelligence */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Code Intelligence
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/repository" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3" /> Repository Analysis
                </Link>
              </li>
              <li>
                <Link to="/drift" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Radar className="h-3 w-3 text-warning" /> Drift Detection
                </Link>
              </li>
              <li>
                <Link to="/impact" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <ShieldAlert className="h-3 w-3" /> Impact Analysis
                </Link>
              </li>
              <li>
                <Link to="/knowledge-graph" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <Share2 className="h-3 w-3" /> Knowledge Graph
                </Link>
              </li>
              <li>
                <Link to="/quality" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-success" /> Release Readiness
                </Link>
              </li>
            </ul>
          </div>

          {/* Workstation Access */}
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              Workstation
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/dashboard" className="hover:text-foreground transition-colors">
                  Telemetry Dashboard
                </Link>
              </li>
              <li>
                <Link to="/documentation" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <FileText className="h-3 w-3" /> Documentation Specs
                </Link>
              </li>
              <li>
                <Link to="/story" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3" /> Architecture Story Mode
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-foreground transition-colors text-primary font-medium">
                  Create Account →
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Technical Disclosure & Copyright */}
        <div className="mt-12 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-muted-foreground">
          <div>
            © {new Date().getFullYear()} ArchForge. All rights reserved. Engineering workstation for software architecture.
          </div>
          <div className="text-muted-foreground/70 text-center sm:text-right">
            Verified AST analysis · Multi-repo topology · Deterministic release gates
          </div>
        </div>
      </div>
    </footer>
  );
}

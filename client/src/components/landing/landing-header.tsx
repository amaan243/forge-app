import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Menu,
  X,
  ArrowRight,
  Workflow,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  LogOut,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeometricAvatar } from "@/components/geometric-avatar";
import { useAuth } from "@/lib/auth-context";
import { ArchForgeLogo } from "@/components/brand-logo";

export function LandingHeader() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const displayName = user?.full_name || user?.email?.split("@")[0] || "Architect";

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 border-b ${
        scrolled
          ? "bg-[#0B1120]/95 backdrop-blur-md border-border/80 shadow-lg shadow-black/20"
          : "bg-[#0B1120]/80 backdrop-blur-sm border-border/40"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <Link to="/" className="flex items-center group">
          <ArchForgeLogo size="md" showTagline={true} />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-mono text-muted-foreground">
          <a
            href="#problem"
            onClick={(e) => scrollToSection(e, "problem")}
            className="hover:text-foreground transition-colors"
          >
            The Problem
          </a>
          <a
            href="#workflow"
            onClick={(e) => scrollToSection(e, "workflow")}
            className="hover:text-foreground transition-colors"
          >
            How It Works
          </a>
          <a
            href="#features"
            onClick={(e) => scrollToSection(e, "features")}
            className="hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#interactive-demo"
            onClick={(e) => scrollToSection(e, "interactive-demo")}
            className="hover:text-foreground transition-colors text-primary font-medium"
          >
            Interactive Demo
          </a>
          <a
            href="#use-cases"
            onClick={(e) => scrollToSection(e, "use-cases")}
            className="hover:text-foreground transition-colors"
          >
            Use Cases
          </a>
          <a
            href="#trust"
            onClick={(e) => scrollToSection(e, "trust")}
            className="hover:text-foreground transition-colors"
          >
            Trust & Security
          </a>
        </nav>

        {/* Auth CTA Actions */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to="/workspace"
                className="h-8 px-3 rounded-md border border-border bg-surface text-xs font-mono text-foreground hover:bg-surface/80 transition-colors flex items-center gap-1.5"
              >
                <Workflow className="h-3.5 w-3.5 text-primary" />
                <span>Workspace Studio</span>
              </Link>

              <Link
                to="/dashboard"
                className="h-8 px-3.5 rounded-md bg-primary text-xs font-mono font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Enter Dashboard →</span>
              </Link>

              <div className="pl-2 border-l border-border flex items-center gap-2">
                <GeometricAvatar name={displayName} size={26} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="h-8 px-3 rounded-md text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-surface/50 transition-colors flex items-center justify-center"
              >
                <span>Sign In</span>
              </Link>
              <Link
                to="/register"
                className="h-8 px-3.5 rounded-md bg-primary text-xs font-mono font-medium text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>Start Building</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="flex sm:hidden items-center gap-2">
          {isAuthenticated && (
            <Link
              to="/dashboard"
              className="px-2.5 py-1 rounded bg-primary text-[11px] font-mono font-semibold text-primary-foreground"
            >
              Dashboard
            </Link>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-b border-border bg-panel px-4 pt-3 pb-6 space-y-4 shadow-xl">
          <nav className="flex flex-col space-y-2 text-sm font-mono text-muted-foreground">
            <a
              href="#problem"
              onClick={(e) => scrollToSection(e, "problem")}
              className="px-2 py-1.5 rounded hover:bg-surface hover:text-foreground transition-colors"
            >
              The Problem
            </a>
            <a
              href="#workflow"
              onClick={(e) => scrollToSection(e, "workflow")}
              className="px-2 py-1.5 rounded hover:bg-surface hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, "features")}
              className="px-2 py-1.5 rounded hover:bg-surface hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#interactive-demo"
              onClick={(e) => scrollToSection(e, "interactive-demo")}
              className="px-2 py-1.5 rounded text-primary hover:bg-surface transition-colors font-medium"
            >
              Interactive Demo
            </a>
            <a
              href="#use-cases"
              onClick={(e) => scrollToSection(e, "use-cases")}
              className="px-2 py-1.5 rounded hover:bg-surface hover:text-foreground transition-colors"
            >
              Use Cases
            </a>
            <a
              href="#trust"
              onClick={(e) => scrollToSection(e, "trust")}
              className="px-2 py-1.5 rounded hover:bg-surface hover:text-foreground transition-colors"
            >
              Trust & Security
            </a>
          </nav>

          <div className="pt-3 border-t border-border flex flex-col gap-2">
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 rounded-md bg-primary text-xs font-mono font-medium text-primary-foreground"
                >
                  Enter Dashboard
                </Link>
                <Link
                  to="/workspace"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 rounded-md border border-border bg-surface text-xs font-mono text-foreground"
                >
                  Workspace Studio
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 rounded-md bg-primary text-xs font-mono font-medium text-primary-foreground"
                >
                  Start Building
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2 rounded-md border border-border bg-surface text-xs font-mono text-muted-foreground"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

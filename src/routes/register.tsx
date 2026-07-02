import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField, OrDivider, OAuthButton, GitHubMark, GoogleMark } from "@/components/auth-shell";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create account — ArchForge" },
      { name: "description", content: "Create your ArchForge workspace and start generating architecture." },
    ],
  }),
  component: RegisterPage,
});

const ROLES = ["Student", "Developer", "Architect", "Tech Lead"];

function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("Developer");
  const [accept, setAccept] = useState(true);
  const navigate = useNavigate();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accept) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate({ to: "/verify-email" });
    }, 700);
  }

  return (
    <AuthLayout>
      <AuthCard title="Create your ArchForge account" subtitle="Set up your engineering workstation in under a minute.">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <AuthField label="Full name"><Input required placeholder="Alex Rios" /></AuthField>
            <AuthField label="Email"><Input required type="email" className="font-mono" placeholder="you@company.dev" /></AuthField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AuthField label="Password"><Input required type="password" className="font-mono" /></AuthField>
            <AuthField label="Confirm"><Input required type="password" className="font-mono" /></AuthField>
          </div>
          <AuthField label="Company / College (optional)"><Input placeholder="Acme Engineering" /></AuthField>
          <AuthField label="Role">
            <div className="grid grid-cols-4 gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={
                    "h-8 rounded border text-[11px] font-mono transition-colors " +
                    (role === r
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground")
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </AuthField>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-background"
            />
            <span>I agree to the <a className="text-primary hover:underline" href="#">Terms of Service</a> and <a className="text-primary hover:underline" href="#">Privacy Policy</a>.</span>
          </label>
          <Button type="submit" disabled={loading || !accept} className="w-full h-9">
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <OrDivider />
        <div className="grid grid-cols-2 gap-2">
          <OAuthButton label="GitHub" icon={<GitHubMark />} />
          <OAuthButton label="Google" icon={<GoogleMark />} />
        </div>
        <div className="text-center text-xs text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
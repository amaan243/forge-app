import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField, OrDivider, OAuthButton, GitHubMark, GoogleMark } from "@/components/auth-shell";
import { useAuth } from "@/lib/auth-context";

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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("Developer");
  const [accept, setAccept] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accept) return;

    if (password !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setErr("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setErr(null);

    const res = await register({
      email,
      password,
      full_name: fullName,
      role,
      company: company || undefined,
    });

    setLoading(false);

    if (res.success) {
      if (res.isEmailVerified) {
        navigate({ to: "/" });
      } else {
        navigate({
          to: "/verify-email",
          search: { email } as any,
        });
      }
    } else {
      setErr(res.error || "Failed to create account. Please check your details.");
    }
  }

  return (
    <AuthLayout>
      <AuthCard title="Create your ArchForge account" subtitle="Set up your engineering workstation in under a minute.">
        {err && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-[12px] text-destructive mb-4">
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <AuthField label="Full name">
              <Input
                required
                placeholder="Alex Rios"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </AuthField>
            <AuthField label="Email">
              <Input
                required
                type="email"
                className="font-mono"
                placeholder="you@company.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </AuthField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AuthField label="Password">
              <Input
                required
                type="password"
                className="font-mono"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </AuthField>
            <AuthField label="Confirm">
              <Input
                required
                type="password"
                className="font-mono"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </AuthField>
          </div>
          <AuthField label="Company / College (optional)">
            <Input
              placeholder="Acme Engineering"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </AuthField>
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
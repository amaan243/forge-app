import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Mail, Lock, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField, OrDivider, OAuthButton, GitHubMark, GoogleMark } from "@/components/auth-shell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ArchForge" },
      { name: "description", content: "Sign in to your ArchForge engineering workstation." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [err] = useState<string | null>(null);
  const navigate = useNavigate();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate({ to: "/" });
    }, 700);
  }

  return (
    <AuthLayout>
      <AuthCard title="Sign in to ArchForge" subtitle="Continue to your engineering workstation.">
        {err && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-[12px] text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthField label="Email">
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input required type="email" placeholder="alex@acme.dev" className="pl-8 font-mono" defaultValue="alex@acme.dev" />
            </div>
          </AuthField>
          <AuthField
            label="Password"
            right={<Link to="/forgot-password" className="text-[10px] font-mono uppercase tracking-wider text-primary hover:underline">Forgot?</Link>}
          >
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input required type="password" placeholder="********" className="pl-8 font-mono" defaultValue="password" />
            </div>
          </AuthField>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="h-3.5 w-3.5 rounded border-border bg-background" defaultChecked />
            Keep me signed in on this device
          </label>
          <Button type="submit" disabled={loading} className="w-full h-9">
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <OrDivider />
        <div className="grid grid-cols-2 gap-2">
          <OAuthButton label="GitHub" icon={<GitHubMark />} />
          <OAuthButton label="Google" icon={<GoogleMark />} />
        </div>
        <div className="text-center text-xs text-muted-foreground">
          Don't have an account? <Link to="/register" className="text-primary hover:underline">Create account</Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
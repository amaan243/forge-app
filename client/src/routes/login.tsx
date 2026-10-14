import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Loader2, Mail, Lock, ArrowRight, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField, OrDivider, OAuthButton, GoogleMark } from "@/components/auth-shell";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/api/auth";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const { login, loginWithToken, exchangeOAuthCode, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const oauthHandled = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (typeof window === "undefined" || oauthHandled.current) return;

    // 1. Check hash fragment for implicit OAuth tokens (e.g. #access_token=...&refresh_token=...)
    const hash = window.location.hash.substring(1);
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) {
        oauthHandled.current = true;
        setErr(decodeURIComponent(hashError));
        window.history.replaceState(null, "", window.location.pathname);
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken) {
        oauthHandled.current = true;
        setOauthLoading(true);
        window.history.replaceState(null, "", window.location.pathname);
        loginWithToken(accessToken, refreshToken || undefined).then((ok) => {
          setOauthLoading(false);
          if (ok) {
            navigate({ to: "/dashboard" });
          } else {
            setErr("Failed to establish session from Google credentials.");
          }
        });
        return;
      }
    }

    // 2. Check query params for PKCE OAuth code or error (?code=... or ?error=...)
    const urlParams = new URLSearchParams(window.location.search);
    const queryError = urlParams.get("error_description") || urlParams.get("error");
    if (queryError) {
      oauthHandled.current = true;
      setErr(decodeURIComponent(queryError));
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const code = urlParams.get("code");
    if (code) {
      oauthHandled.current = true;
      setOauthLoading(true);
      window.history.replaceState(null, "", window.location.pathname);
      exchangeOAuthCode(code).then((result) => {
        setOauthLoading(false);
        if (result.success) {
          navigate({ to: "/dashboard" });
        } else {
          setErr(result.error || "Failed to complete Google sign in.");
        }
      });
      return;
    }
  }, [loginWithToken, exchangeOAuthCode, navigate]);

  async function handleGoogleSignIn() {
    setOauthLoading(true);
    setErr(null);
    try {
      const redirectUrl = `${window.location.origin}/login`;
      const res = await authApi.getGoogleOAuthUrl(redirectUrl);
      if (res.url) {
        window.location.href = res.url;
      } else {
        setErr("Could not retrieve Google sign in link.");
        setOauthLoading(false);
      }
    } catch (e: any) {
      setErr(e.response?.data?.message || e.message || "Failed to initialize Google sign in.");
      setOauthLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setUnverifiedEmail(null);

    const res = await login({ email, password });
    setLoading(false);

    if (res.success) {
      navigate({ to: "/dashboard" });
    } else {
      if (res.emailNotVerified) {
        setUnverifiedEmail(res.email || email);
        setErr(res.error || "Please verify your email before signing in.");
      } else {
        setErr(res.error || "Invalid email or password.");
      }
    }
  }

  return (
    <AuthLayout>
      <AuthCard title="Sign in to ArchForge" subtitle="Continue to your engineering workstation.">
        {err && (
          <div className="flex flex-col gap-1.5 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-[12px] text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>{err}</span>
            </div>
            {unverifiedEmail && (
              <div className="pt-1 border-t border-destructive/20 flex items-center justify-between text-[11px]">
                <span>Need a new verification link?</span>
                <Link
                  to="/verify-email"
                  search={{ email: unverifiedEmail } as any}
                  className="font-mono underline font-medium hover:text-foreground inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Resend verification
                </Link>
              </div>
            )}
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthField label="Email">
            <div className="relative">
              <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                required
                type="email"
                placeholder="alex@acme.dev"
                className="pl-8 font-mono"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </AuthField>
          <AuthField
            label="Password"
            right={<Link to="/forgot-password" className="text-[10px] font-mono uppercase tracking-wider text-primary hover:underline">Forgot?</Link>}
          >
            <div className="relative">
              <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                required
                type="password"
                placeholder="••••••••"
                className="pl-8 font-mono"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
        <OAuthButton
          label={oauthLoading ? "Connecting to Google..." : "Google"}
          icon={oauthLoading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <GoogleMark />}
          onClick={handleGoogleSignIn}
          disabled={loading || oauthLoading}
        />
        <div className="text-center text-xs text-muted-foreground">
          Don't have an account? <Link to="/register" className="text-primary hover:underline">Create account</Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
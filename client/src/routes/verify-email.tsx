import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout, AuthCard } from "@/components/auth-shell";
import { authApi } from "@/api/auth";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: (search.email as string) || undefined,
    token_hash: (search.token_hash as string) || undefined,
    code: (search.code as string) || undefined,
    type: (search.type as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verify your email — ArchForge" },
      { name: "description", content: "Confirm your email to activate your ArchForge workspace." },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const search = Route.useSearch();
  const [email, setEmail] = useState<string>(search.email || "");
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const verificationAttempted = useRef(false);

  useEffect(() => {
    // If token_hash or code exists in query params or hash, attempt verification automatically
    if (typeof window === "undefined" || verificationAttempted.current) return;

    let tokenHash = search.token_hash;
    let code = search.code;
    let type = search.type || "signup";

    // Also check hash fragment e.g. #access_token=... or #error=...
    const hash = window.location.hash.substring(1);
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) {
        setVerifyError(hashError);
        return;
      }
      const hashToken = hashParams.get("access_token");
      if (hashToken) {
        localStorage.setItem("archforge_token", hashToken);
        setVerified(true);
        refreshUser().then(() => {
          setTimeout(() => navigate({ to: "/" }), 1200);
        });
        return;
      }
    }

    if (tokenHash || code) {
      verificationAttempted.current = true;
      setVerifying(true);
      setVerifyError(null);

      authApi
        .verifyEmail({ token_hash: tokenHash, code, type })
        .then((res) => {
          if (res.success) {
            if (res.data?.session?.accessToken) {
              localStorage.setItem("archforge_token", res.data.session.accessToken);
              if (res.data.session.refreshToken) {
                localStorage.setItem("archforge_refresh_token", res.data.session.refreshToken);
              }
            }
            if (res.data?.user) {
              localStorage.setItem("archforge_user", JSON.stringify(res.data.user));
            }
            setVerified(true);
            refreshUser();
            toast.success("Email verified successfully! Welcome to ArchForge.");
            setTimeout(() => {
              navigate({ to: "/" });
            }, 1200);
          } else {
            setVerifyError(res.message || "Verification failed");
          }
        })
        .catch((err: any) => {
          const msg =
            err.response?.data?.message ||
            err.message ||
            "Verification link has expired or is invalid. Please request a new one.";
          setVerifyError(msg);
        })
        .finally(() => {
          setVerifying(false);
        });
    }
  }, [search, navigate, refreshUser]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (!email) {
      const promptEmail = window.prompt("Enter your email address to resend verification link:");
      if (!promptEmail) return;
      setEmail(promptEmail);
      triggerResend(promptEmail);
    } else {
      triggerResend(email);
    }
  };

  const triggerResend = async (targetEmail: string) => {
    setResending(true);
    try {
      const res = await authApi.resendVerification({ email: targetEmail });
      if (res.success) {
        toast.success("Verification email resent. Please check your inbox.");
        setCountdown(60);
      } else {
        toast.error(res.message || "Failed to resend verification email");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to resend verification email";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  const displayTarget = email || "your email address";

  return (
    <AuthLayout>
      <AuthCard
        title={verified ? "Email verified!" : "Verify your email"}
        subtitle={
          verified
            ? "Your account is verified. Redirecting you to your engineering workstation..."
            : `We sent a link to ${displayTarget}. Click it to activate your workspace.`
        }
      >
        {verifying && (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-xs font-mono text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Verifying your email token...</span>
          </div>
        )}

        {verified && (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-xs font-mono text-success">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <span className="font-semibold text-sm">Verification successful</span>
            <span className="text-muted-foreground">Redirecting to dashboard...</span>
          </div>
        )}

        {verifyError && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-[12px] text-destructive mb-3">
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>{verifyError}</span>
          </div>
        )}

        {!verifying && !verified && (
          <>
            <div className="grid place-items-center py-4">
              <svg width="160" height="100" viewBox="0 0 160 100" className="text-border" aria-hidden>
                <rect x="20" y="18" width="120" height="70" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M20 18 L80 62 L140 18" stroke="currentColor" strokeWidth="1" fill="none" />
                <rect x="66" y="46" width="28" height="20" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
                <path d="M66 46 L80 60 L94 46" stroke="currentColor" strokeWidth="1" fill="none" className="text-primary" />
              </svg>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={resending || countdown > 0}
                onClick={handleResend}
              >
                {resending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw className={countdown > 0 ? "" : "animate-none"} />
                )}
                {countdown > 0 ? `Resend (${countdown}s)` : "Resend email"}
              </Button>
              <Button asChild className="flex-1">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground text-center">
              Didn't get it? Check spam or resend in {countdown > 0 ? `${countdown}s` : "60s"}.
            </p>
          </>
        )}
      </AuthCard>
    </AuthLayout>
  );
}
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Lock, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField } from "@/components/auth-shell";
import { authApi } from "@/api/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token_hash: (search.token_hash as string) || undefined,
    type: (search.type as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Set a new password — ArchForge" },
      { name: "description", content: "Set a new password for your ArchForge account." },
    ],
  }),
  component: ResetPage,
});

function score(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}

function ResetPage() {
  const search = Route.useSearch();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenFromHash, setTokenFromHash] = useState<string | null>(null);

  const navigate = useNavigate();
  const s = useMemo(() => score(pw), [pw]);
  const labels = ["Too weak", "Weak", "Fair", "Strong", "Excellent"];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        if (accessToken) {
          setTokenFromHash(accessToken);
        }
      }
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) {
      setErr("Passwords do not match.");
      return;
    }
    if (pw.length < 8) {
      setErr("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await authApi.resetPassword({
        password: pw,
        accessToken: tokenFromHash || undefined,
        token_hash: search.token_hash || undefined,
        type: search.type || "recovery",
      });

      if (res.success) {
        setSuccess(true);
        toast.success("Password updated successfully. Please sign in.");
        setTimeout(() => {
          navigate({ to: "/login" });
        }, 1500);
      } else {
        setErr(res.message || "Failed to update password.");
      }
    } catch (error: any) {
      setErr(error.response?.data?.message || error.message || "Failed to update password. Reset link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <AuthCard title="Set a new password" subtitle="Use at least 8 characters with a mix of letters, numbers, and symbols.">
        {err && (
          <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-[12px] text-destructive mb-3">
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
            <span>{err}</span>
          </div>
        )}

        {success ? (
          <div className="rounded border border-success/30 bg-success/10 p-3 flex items-start gap-2 text-sm my-4">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
            <div>
              <div className="font-medium">Password updated!</div>
              <div className="text-xs text-muted-foreground mt-0.5">Redirecting you to the sign in page...</div>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <AuthField label="New password">
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input required type="password" className="pl-8 font-mono" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
            </AuthField>
            <div className="space-y-1.5">
              <div className="h-1 flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className={"flex-1 rounded-full " + (i < s ? (s >= 3 ? "bg-success" : s === 2 ? "bg-warning" : "bg-destructive") : "bg-surface")} />
                ))}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Strength: {labels[s]}</div>
            </div>
            <AuthField label="Confirm password">
              <div className="relative">
                <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input required type="password" className="pl-8 font-mono" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
            </AuthField>
            <Button type="submit" disabled={loading || !pw || pw !== pw2} className="w-full h-9">
              {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {loading ? "Saving..." : "Update password"}
            </Button>
          </form>
        )}
        <div className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
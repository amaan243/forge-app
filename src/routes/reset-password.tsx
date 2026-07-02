import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField } from "@/components/auth-shell";

export const Route = createFileRoute("/reset-password")({
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
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const s = useMemo(() => score(pw), [pw]);
  const labels = ["Too weak", "Weak", "Fair", "Strong", "Excellent"];
  return (
    <AuthLayout>
      <AuthCard title="Set a new password" subtitle="Use at least 8 characters with a mix of letters, numbers, and symbols.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLoading(true);
            setTimeout(() => {
              setLoading(false);
              navigate({ to: "/login" });
            }, 700);
          }}
          className="space-y-4"
        >
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
        <div className="text-center text-xs text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
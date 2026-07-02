import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField } from "@/components/auth-shell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — ArchForge" },
      { name: "description", content: "Get a password reset link for your ArchForge account." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout>
      <AuthCard title="Reset your password" subtitle="Enter your email and we'll send you a reset link.">
        {sent ? (
          <div className="rounded border border-success/30 bg-success/10 p-3 flex items-start gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
            <div>
              <div className="font-medium">Reset link sent</div>
              <div className="text-xs text-muted-foreground">Check your inbox for the next step.</div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setLoading(true);
              setTimeout(() => {
                setLoading(false);
                setSent(true);
              }, 700);
            }}
            className="space-y-4"
          >
            <AuthField label="Email">
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input required type="email" className="pl-8 font-mono" placeholder="you@company.dev" />
              </div>
            </AuthField>
            <Button type="submit" disabled={loading} className="w-full h-9">
              {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
              {loading ? "Sending..." : "Send reset link"}
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
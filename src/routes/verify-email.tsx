import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthLayout, AuthCard } from "@/components/auth-shell";

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Verify your email — ArchForge" },
      { name: "description", content: "Confirm your email to activate your ArchForge workspace." },
    ],
  }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  return (
    <AuthLayout>
      <AuthCard title="Verify your email" subtitle="We sent a link to alex@acme.dev. Click it to activate your workspace.">
        <div className="grid place-items-center py-4">
          <svg width="140" height="90" viewBox="0 0 140 90" className="text-border" aria-hidden>
            <rect x="14" y="14" width="112" height="62" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M14 14 L70 52 L126 14" stroke="currentColor" strokeWidth="1" fill="none" />
            <rect x="60" y="42" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
            <Mail x="66" y="48" />
          </svg>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1"><RefreshCw /> Resend email</Button>
          <Button asChild className="flex-1"><Link to="/login">Back to sign in</Link></Button>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground text-center">Didn't get it? Check spam or resend in 60s.</p>
      </AuthCard>
    </AuthLayout>
  );
}
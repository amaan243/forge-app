import { createFileRoute, Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
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
          <svg width="160" height="100" viewBox="0 0 160 100" className="text-border" aria-hidden>
            <rect x="20" y="18" width="120" height="70" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M20 18 L80 62 L140 18" stroke="currentColor" strokeWidth="1" fill="none" />
            <rect x="66" y="46" width="28" height="20" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
            <path d="M66 46 L80 60 L94 46" stroke="currentColor" strokeWidth="1" fill="none" className="text-primary" />
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
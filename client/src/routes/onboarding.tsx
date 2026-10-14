import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, ArrowLeft, GitBranch, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout, AuthCard, AuthField } from "@/components/auth-shell";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — ArchForge" },
      { name: "description", content: "Set up your first workspace on ArchForge." },
    ],
  }),
  component: OnboardingPage,
});

const STACKS = ["React", "Angular", "Vue", "Node", "Spring Boot", ".NET", "Python", "Go"];
const STEPS = ["Create Workspace", "Choose Tech Stack", "Import Repository"];

function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [picks, setPicks] = useState<string[]>(["React", "Node"]);
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <AuthCard title="Set up your workspace" subtitle="Three quick steps and you're inside.">
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={
                  "h-6 w-6 grid place-items-center rounded-full border text-[10px] font-mono " +
                  (i < step
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : i === step
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-muted-foreground")
                }
              >
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className={"text-[11px] font-mono truncate " + (i === step ? "text-foreground" : "text-muted-foreground")}>{s}</div>
              </div>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <AuthField label="Workspace name"><Input defaultValue="Acme Payments" /></AuthField>
            <AuthField label="Description (optional)"><Input placeholder="What are you building?" /></AuthField>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Pick your primary stack</div>
            <div className="grid grid-cols-4 gap-2">
              {STACKS.map((s) => {
                const on = picks.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setPicks((p) => (on ? p.filter((x) => x !== s) : [...p, s]))
                    }
                    className={
                      "h-10 rounded border text-xs font-mono transition-colors " +
                      (on
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:text-foreground")
                    }
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {["GitHub", "GitLab", "Bitbucket"].map((p) => (
                <button
                  key={p}
                  type="button"
                  className="rounded border border-border bg-background hover:border-primary/40 p-3 text-left space-y-1.5"
                >
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm">{p}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">Connect account</div>
                </button>
              ))}
            </div>
            <AuthField label="Or paste a repo URL">
              <Input placeholder="https://github.com/acme/payments-platform.git" className="font-mono" />
            </AuthField>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ArrowLeft /> Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Skip</Link>
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button size="sm" onClick={() => navigate({ to: "/dashboard" })}>
              Enter workspace <ArrowRight />
            </Button>
          )}
        </div>
      </AuthCard>
    </AuthLayout>
  );
}
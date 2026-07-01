import { createFileRoute, Link } from "@tanstack/react-router";
import { Network, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture — ArchForge" },
      { name: "description", content: "Browse generated system architectures, service graphs, and design decisions." },
      { property: "og:title", content: "Architecture — ArchForge" },
      { property: "og:description", content: "Browse generated system architectures and service graphs." },
    ],
  }),
  component: ArchitecturePage,
});

function ArchitecturePage() {
  return (
    <div className="min-h-[calc(100vh-3rem)] grid place-items-center p-8">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto grid grid-cols-3 gap-1.5 w-24">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={"h-6 w-6 border border-border " + (i === 4 ? "bg-primary/30" : i % 2 ? "bg-surface" : "bg-panel")} />
          ))}
        </div>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            <Network className="h-3.5 w-3.5" /> Architecture library
          </div>
          <h2 className="text-2xl font-display font-semibold tracking-tight">Start your first Architecture Workspace.</h2>
          <p className="text-sm text-muted-foreground">Generated architectures for every workspace will appear here. Open a workspace to design a new one.</p>
        </div>
        <div className="flex justify-center gap-2">
          <Button asChild><Link to="/workspace"><Play /> Create Workspace</Link></Button>
          <Button asChild variant="outline"><Link to="/repository">Import GitHub Repository</Link></Button>
        </div>
      </div>
    </div>
  );
}
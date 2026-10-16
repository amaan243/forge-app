import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen,
  Presentation,
  Download,
  Sparkles,
  ArrowRight,
  FolderOpen,
  Loader2,
  AlertTriangle,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  Cpu,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspace-context";
import { ProjectSwitcher } from "@/components/project-switcher";
import {
  getProjectStory,
  generateProjectStory,
  type ProjectStory,
  type ProjectStoryContent,
} from "@/api";
import { toast } from "sonner";

function safeString(val: unknown, fallback = ""): string {
  if (val == null) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (typeof obj.title === "string") return obj.title;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.decision === "string") return obj.decision;
    if (typeof obj.description === "string") return obj.description;
    if (typeof obj.problem === "string") return obj.problem;
    try {
      return JSON.stringify(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export const Route = createFileRoute("/_app/story")({
  head: () => ({
    meta: [
      { title: "Project Story Mode — ArchForge" },
      {
        name: "description",
        content:
          "One-click presentation summary of the project — designed for demos, design reviews, and placement interviews.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="p-8 max-w-lg mx-auto text-center space-y-4">
      <div className="p-3 bg-destructive/10 text-destructive rounded-full w-12 h-12 mx-auto flex items-center justify-center">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Failed to render Project Story</h2>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {error?.message || "An unexpected error occurred while displaying the project story."}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => reset()} variant="default" size="sm">
          Try Again
        </Button>
        <Button onClick={() => window.location.reload()} variant="outline" size="sm">
          Reload Page
        </Button>
      </div>
    </div>
  ),
  component: StoryPage,
});

function StoryPage() {
  const { currentProject } = useWorkspace();
  const [story, setStory] = useState<ProjectStory | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const fetchStory = useCallback(async () => {
    if (!currentProject) {
      setStory(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getProjectStory(currentProject.id);
      setStory(data);
    } catch (err: any) {
      console.error("Failed to load project story:", err);
      setError(err.response?.data?.message || err.message || "Failed to load project story");
    } finally {
      setLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    fetchStory();
  }, [fetchStory]);

  const handleGenerateStory = async () => {
    if (!currentProject) {
      toast.error("Please select a project first.");
      return;
    }
    setGenerating(true);
    try {
      const data = await generateProjectStory(currentProject.id);
      setStory(data);
      toast.success("Project story generated successfully!");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to generate story";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = () => {
    if (!story) {
      toast.error("Generate a story first before exporting.");
      return;
    }
    window.print();
  };

  const content: ProjectStoryContent | undefined = useMemo(() => {
    if (!story?.content) return undefined;
    if (typeof story.content === "string") {
      try {
        return JSON.parse(story.content);
      } catch {
        return undefined;
      }
    }
    return story.content;
  }, [story?.content]);

  const slides = useMemo(() => [
    {
      index: "01",
      title: "Problem & System Scope",
      subtitle: safeString(content?.currentState, "Current Baseline"),
      body: (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {safeString(
              content?.problem,
              "Describe the core business and technical challenges this architecture solves."
            )}
          </p>
          <div className="p-3.5 rounded border border-border bg-surface/40 space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Architecture Baseline
            </div>
            <div className="text-sm font-medium">{safeString(content?.currentState, "Initial Draft")}</div>
          </div>
          {Array.isArray(content?.requirements) && content.requirements.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Target Requirements Satisfied ({content.requirements.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {content.requirements.map((req, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-primary/10 text-primary border border-primary/20"
                  >
                    {safeString(req)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      index: "02",
      title: "Architecture Topology & Components",
      subtitle: `${Array.isArray(content?.architecture) ? content.architecture.length : 0} components declared`,
      body: (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Core components and system topology derived from project requirements:
          </p>
          {Array.isArray(content?.architecture) && content.architecture.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {content.architecture.map((item, i) => {
                const name =
                  typeof item === "string"
                    ? item
                    : (item as any)?.name
                    ? `${(item as any).name}${(item as any).type ? ` (${(item as any).type})` : ""}`
                    : safeString(item, `Component ${i + 1}`);
                return (
                  <div key={i} className="p-3 rounded border border-border bg-surface/40 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    <span className="text-xs font-medium truncate" title={name}>
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No architecture components registered yet.</p>
          )}
          {Array.isArray(content?.dataFlow) && content.dataFlow.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="text-[11px] font-mono text-muted-foreground">
                Communication Edges & Data Flow ({content.dataFlow.length})
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {content.dataFlow.map((edge, i) => {
                  const edgeText =
                    typeof edge === "string"
                      ? edge
                      : `${(edge as any).source_node_id || "Node"} → ${(edge as any).target_node_id || "Node"}${
                          (edge as any).relationship ? ` (${(edge as any).relationship})` : ""
                        }${(edge as any).protocol ? ` via ${(edge as any).protocol}` : ""}`;
                  return (
                    <div
                      key={i}
                      className="text-xs font-mono p-2 rounded bg-surface/60 border border-border/40 text-muted-foreground flex items-center gap-2"
                    >
                      <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{edgeText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      index: "03",
      title: "Technology Stack & Tooling",
      subtitle: `${Array.isArray(content?.technologyChoices) ? content.technologyChoices.length : 0} verified technologies`,
      body: (
        <div className="space-y-4">
          {Array.isArray(content?.technologyChoices) && content.technologyChoices.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {content.technologyChoices.map((tech, i) => {
                const isObj = typeof tech === "object" && tech !== null;
                const name = isObj ? (tech as any).name || `Technology ${i + 1}` : String(tech);
                const category = isObj && (tech as any).category ? (tech as any).category : `Stack Layer ${i + 1}`;
                const reason = isObj && (tech as any).reason ? (tech as any).reason : null;

                return (
                  <div key={i} className="surface-panel p-3.5 space-y-1.5 border border-border/60">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {category}
                    </div>
                    <div className="text-sm font-semibold text-foreground truncate" title={name}>
                      {name}
                    </div>
                    {reason && (
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        {reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No specific technology choices detected in architecture nodes.
            </p>
          )}
        </div>
      ),
    },
    {
      index: "04",
      title: "Key Architectural Decisions",
      subtitle: "Engineering rationale and invariants",
      body: (
        <div className="space-y-3">
          {Array.isArray(content?.importantDecisions) && content.importantDecisions.length > 0 ? (
            <div className="space-y-3">
              {content.importantDecisions.map((dec, i) => {
                const isObj = typeof dec === "object" && dec !== null;
                const decision = isObj
                  ? (dec as any).decision || (dec as any).title || `Decision ${i + 1}`
                  : String(dec);
                const rationale = isObj ? (dec as any).rationale : null;
                const tradeOff = isObj ? (dec as any).tradeOff : null;

                return (
                  <div key={i} className="surface-panel p-4 space-y-2 border-l-2 border-l-primary">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1.5 w-full">
                        <div className="text-sm font-semibold text-foreground">{decision}</div>
                        {rationale && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-medium text-foreground/80">Rationale: </span>
                            {rationale}
                          </p>
                        )}
                        {tradeOff && (
                          <p className="text-xs text-warning/90 leading-relaxed font-mono bg-warning/5 p-2 rounded border border-warning/20">
                            <strong>Trade-off: </strong>
                            {tradeOff}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Deterministic modular boundaries isolating domains and external integrations.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>Zero implicit dependencies; all service relations explicitly modeled in the graph.</span>
              </div>
            </div>
          )}
        </div>
      ),
    },
    {
      index: "05",
      title: "Security, Scaling & Trade-offs",
      subtitle: "Operational resilience",
      body: (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="surface-panel p-4 space-y-2.5">
            <div className="text-xs font-semibold flex items-center gap-1.5 text-primary">
              <ShieldCheck className="h-4 w-4" /> Security Invariants
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {(Array.isArray(content?.security) && content.security.length > 0
                ? content.security
                : [
                    "Ingress perimeter TLS and token authorization boundary.",
                    "Isolated database access using least-privilege credentials.",
                  ]
              ).map((sec, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-primary font-bold">•</span>
                  <span>{safeString(sec)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-panel p-4 space-y-2.5">
            <div className="text-xs font-semibold flex items-center gap-1.5 text-info">
              <Cpu className="h-4 w-4" /> Scalability & Resiliency
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {(Array.isArray(content?.scalability) && content.scalability.length > 0
                ? content.scalability
                : [
                    "Horizontally scalable stateless compute services.",
                    "Managed caching and asynchronous queues for burst absorption.",
                  ]
              ).map((sca, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-info font-bold">•</span>
                  <span>{safeString(sca)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="surface-panel p-4 space-y-2.5 sm:col-span-2 lg:col-span-1">
            <div className="text-xs font-semibold flex items-center gap-1.5 text-warning">
              <AlertTriangle className="h-4 w-4" /> System Trade-offs
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              {(Array.isArray(content?.tradeOffs) && content.tradeOffs.length > 0
                ? content.tradeOffs
                : [
                    "Optimized for service autonomy over ultra-minimal resource footprint.",
                    "Asynchronous decoupling introduces eventual consistency considerations.",
                  ]
              ).map((tro, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-warning font-bold">•</span>
                  <span>{safeString(tro)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
    {
      index: "06",
      title: "Architecture Evolution & Roadmap",
      subtitle: "Future engineering milestones",
      body: (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Phased progression plan for scaling and evolving system capabilities:
          </p>
          <div className="space-y-2.5">
            {(Array.isArray(content?.evolution) && content.evolution.length > 0
              ? content.evolution
              : [
                  "Phase 1: Validate baseline service interactions and latency budgets",
                  "Phase 2: Introduce distributed caching for read-heavy query paths",
                  "Phase 3: Automated drift detection and CI architecture gate verification",
                ]
            ).map((evo, i) => (
              <div key={i} className="p-3.5 rounded border border-border bg-surface/40 flex items-center gap-3">
                <span className="font-mono text-xs text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">
                  0{i + 1}
                </span>
                <span className="text-xs font-medium text-foreground">{safeString(evo)}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ], [content]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-primary flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" /> Project Story Mode
          </div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            {currentProject ? currentProject.name : "Engineering Story"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Synthesized technical story for architecture reviews, demos, and technical interviews.
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <ProjectSwitcher variant="inline" />
          <Button
            variant="outline"
            onClick={handleExportPdf}
            disabled={!story || loading || generating}
            title="Export story as PDF report"
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSlideIndex(0);
              setIsPresenting(true);
            }}
            disabled={!story || loading || generating}
            title="Present full-screen slide deck"
          >
            <Presentation className="h-3.5 w-3.5 mr-1" /> Present
          </Button>
          <Button onClick={handleGenerateStory} disabled={generating || loading || !currentProject}>
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {story ? "Regenerate" : "Generate Story"}
              </>
            )}
          </Button>
        </div>
      </header>

      {!currentProject ? (
        <div className="surface-panel p-8 text-center space-y-3">
          <FolderOpen className="h-8 w-8 text-muted-foreground mx-auto" />
          <h3 className="text-sm font-semibold">No Project Selected</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Select an active project to view or generate its architectural story.
          </p>
        </div>
      ) : loading ? (
        <div className="surface-panel p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-mono">Loading project story…</span>
        </div>
      ) : error ? (
        <div className="surface-panel p-6 border-destructive/30 bg-destructive/5 space-y-3">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium">
            <AlertTriangle className="h-4 w-4" />
            <span>Failed to load project story</span>
          </div>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={fetchStory}>
            <RotateCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      ) : !story ? (
        <div className="surface-panel p-12 text-center space-y-4">
          <BookOpen className="h-10 w-10 text-primary mx-auto opacity-80" />
          <div className="space-y-1">
            <h2 className="text-lg font-display font-semibold">No Story Generated Yet</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              ArchForge will synthesize your requirements, architecture components, edges, and technology choices
              into an executive engineering deck.
            </p>
          </div>
          <Button onClick={handleGenerateStory} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Generate Story
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          {/* Summary Stat Counters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="surface-panel p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Components</div>
              <div className="text-xl font-display font-semibold mt-1">
                {Array.isArray(content?.architecture) ? content.architecture.length : 0}
              </div>
            </div>
            <div className="surface-panel p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Technologies
              </div>
              <div className="text-xl font-display font-semibold mt-1">
                {Array.isArray(content?.technologyChoices) ? content.technologyChoices.length : 0}
              </div>
            </div>
            <div className="surface-panel p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Connections</div>
              <div className="text-xl font-display font-semibold mt-1">
                {Array.isArray(content?.dataFlow) ? content.dataFlow.length : 0}
              </div>
            </div>
            <div className="surface-panel p-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Baseline</div>
              <div className="text-sm font-medium mt-1 truncate" title={safeString(content?.currentState, "Saved")}>
                {safeString(content?.currentState, "Saved")}
              </div>
            </div>
          </div>

          {/* Slides List */}
          <div className="space-y-4">
            {slides.map((s) => (
              <div key={s.index} className="surface-panel p-6 space-y-3">
                <div className="flex items-baseline justify-between border-b border-border pb-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-primary">{s.index}</span>
                    <h2 className="text-base font-display font-semibold">{s.title}</h2>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">{s.subtitle}</span>
                </div>
                {s.body}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Full-Screen Presentation Mode Modal */}
      {isPresenting && slides[slideIndex] && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col p-4 sm:p-8 lg:p-12 overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-primary">Slide</span>
              <span className="font-mono text-xs text-foreground font-semibold">
                {slideIndex + 1} of {slides.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsPresenting(false)}
              title="Close Presentation"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full py-4 sm:py-8">
            <div className="space-y-2 mb-4 sm:mb-8">
              <div className="text-xs font-mono text-primary uppercase tracking-wider">
                {slides[slideIndex].index} · {slides[slideIndex].subtitle}
              </div>
              <h1 className="text-2xl sm:text-4xl font-display font-semibold">
                {slides[slideIndex].title}
              </h1>
            </div>
            <div className="surface-panel p-4 sm:p-8">{slides[slideIndex].body}</div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border max-w-3xl mx-auto w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
              disabled={slideIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <div className="flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlideIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === slideIndex ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSlideIndex((i) => Math.min(slides.length - 1, i + 1))}
              disabled={slideIndex === slides.length - 1}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
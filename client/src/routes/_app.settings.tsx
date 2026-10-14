import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  User,
  Palette,
  Bell,
  Sparkles,
  Download,
  Building2,
  Info,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  UserPlus,
  Shield,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import {
  getUserSettings,
  updateUserSettings,
  getUserProfile,
  updateUserProfile,
  type UserSettings as IUserSettings,
  type UpdateSettingsInput,
} from "@/api/settings";
import {
  getWorkspaceSettings,
  updateWorkspaceSettings,
  getWorkspaceMembers,
  addWorkspaceMember,
  updateWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspace,
  type WorkspaceSettings as IWorkspaceSettings,
  type WorkspaceMember,
} from "@/api/workspaces";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ArchForge" },
      { name: "description", content: "Manage workspaces, integrations, model preferences, and team access." },
      { property: "og:title", content: "Settings — ArchForge" },
      { property: "og:description", content: "Manage workspaces, integrations, and team access." },
    ],
  }),
  component: SettingsPage,
});

const GROUPS = [
  { key: "general", label: "General & Profile", icon: User },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "model", label: "AI Model", icon: Sparkles },
  { key: "exports", label: "Export Preferences", icon: Download },
  { key: "workspace", label: "Workspace & Team", icon: Building2 },
  { key: "about", label: "About", icon: Info },
] as const;

function SettingsPage() {
  const routerState = useRouterState();
  const searchTab = (routerState.location.search as Record<string, any>)?.tab as string | undefined;

  const [active, setActive] = useState<(typeof GROUPS)[number]["key"]>(() => {
    return searchTab && GROUPS.some((g) => g.key === searchTab)
      ? (searchTab as (typeof GROUPS)[number]["key"])
      : "general";
  });

  useEffect(() => {
    if (searchTab && GROUPS.some((g) => g.key === searchTab)) {
      setActive(searchTab as (typeof GROUPS)[number]["key"]);
    }
  }, [searchTab]);

  useEffect(() => {
    const onTabEvent = (e: any) => {
      if (e.detail && GROUPS.some((g) => g.key === e.detail)) {
        setActive(e.detail);
      }
    };
    window.addEventListener("archforge:settings-tab", onTabEvent);
    return () => window.removeEventListener("archforge:settings-tab", onTabEvent);
  }, []);
  const group = GROUPS.find((g) => g.key === active)!;
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();

  // Load User Settings
  const { data: userSettings, isLoading: loadingSettings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: getUserSettings,
    staleTime: 30000,
  });

  // Load Profile
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: getUserProfile,
    staleTime: 30000,
  });

  // Load Workspace Settings
  const { data: workspaceSettings, isLoading: loadingWSSettings } = useQuery({
    queryKey: ["workspace-settings", currentWorkspace?.id],
    queryFn: () => getWorkspaceSettings(currentWorkspace!.id),
    enabled: Boolean(currentWorkspace),
    staleTime: 30000,
  });

  // Form states
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [theme, setTheme] = useState(() => {
    return (typeof window !== "undefined" && localStorage.getItem("archforge-theme")) || "slate";
  });
  const [notifState, setNotifState] = useState<Record<string, boolean>>({
    generation: true,
    repository: true,
    security: true,
    digest: false,
    export: true,
  });
  const [modelName, setModelName] = useState("gen-4");
  const [temperature, setTemperature] = useState("0.3");
  const [reasoningDepth, setReasoningDepth] = useState("deep");
  const [exportFormat, setExportFormat] = useState("pdf");
  const [includeDiagrams, setIncludeDiagrams] = useState(true);
  const [includeCode, setIncludeCode] = useState(true);

  // Sync loaded profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
    }
  }, [profile]);

  // Sync loaded settings
  useEffect(() => {
    if (userSettings) {
      if (userSettings.theme) {
        setTheme(userSettings.theme);
        try {
          localStorage.setItem("archforge-theme", userSettings.theme);
          document.documentElement.setAttribute("data-theme", userSettings.theme);
        } catch {}
      }
      if (userSettings.notifications) {
        setNotifState((prev) => ({ ...prev, ...(userSettings.notifications as Record<string, boolean>) }));
      }
      if (userSettings.ai_preferences) {
        const ai = userSettings.ai_preferences as Record<string, any>;
        if (ai.model) setModelName(ai.model);
        if (ai.temperature) setTemperature(String(ai.temperature));
        if (ai.reasoning_depth) setReasoningDepth(ai.reasoning_depth);
      }
      if (userSettings.editor_preferences) {
        const ep = userSettings.editor_preferences as Record<string, any>;
        if (ep.default_export_format) setExportFormat(ep.default_export_format);
      }
    }
  }, [userSettings]);

  // Apply theme to DOM
  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
      try {
        localStorage.setItem("archforge-theme", theme);
      } catch {}
    }
  }, [theme]);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Save Mutations
  const saveProfileMutation = useMutation({
    mutationFn: (data: { full_name?: string; bio?: string }) => updateUserProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      setStatusMsg({ type: "success", text: "Profile updated successfully." });
      setTimeout(() => setStatusMsg(null), 3000);
    },
    onError: (err: any) => {
      setStatusMsg({ type: "error", text: err?.response?.data?.message || err.message || "Failed to save profile." });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (data: UpdateSettingsInput) => updateUserSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      setStatusMsg({ type: "success", text: "Settings saved successfully." });
      setTimeout(() => setStatusMsg(null), 3000);
    },
    onError: (err: any) => {
      setStatusMsg({ type: "error", text: err?.response?.data?.message || err.message || "Failed to save settings." });
    },
  });

  const handleSave = () => {
    setStatusMsg(null);
    if (active === "general") {
      saveProfileMutation.mutate({ full_name: fullName, bio });
    } else if (active === "appearance") {
      saveSettingsMutation.mutate({ theme });
    } else if (active === "notifications") {
      saveSettingsMutation.mutate({ notifications: notifState });
    } else if (active === "model") {
      saveSettingsMutation.mutate({
        ai_preferences: {
          model: modelName,
          temperature: parseFloat(temperature) || 0.3,
          reasoning_depth: reasoningDepth,
        },
      });
    } else if (active === "exports") {
      saveSettingsMutation.mutate({
        editor_preferences: {
          default_export_format: exportFormat,
          include_diagrams: includeDiagrams,
          include_code: includeCode,
        },
      });
    }
  };

  const isSaving = saveProfileMutation.isPending || saveSettingsMutation.isPending;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)] min-h-[calc(100vh-3rem)]">
      <aside className="border-b md:border-b-0 md:border-r border-border p-2 md:p-3 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible bg-panel/40 shrink-0 select-none">
        <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden md:block">Sections</div>
        {GROUPS.map((g) => {
          const Icon = g.icon;
          const on = active === g.key;
          return (
            <button
              key={g.key}
              onClick={() => {
                setActive(g.key);
                setStatusMsg(null);
              }}
              className={
                "shrink-0 md:w-full h-8 px-2.5 md:px-2 flex items-center gap-2 rounded text-xs whitespace-nowrap text-left transition-colors " +
                (on ? "bg-surface text-foreground border border-border font-medium shadow-xs" : "text-muted-foreground hover:text-foreground hover:bg-surface/60 border border-transparent")
              }
            >
              <Icon className="h-3.5 w-3.5 shrink-0" /> <span>{g.label}</span>
            </button>
          );
        })}
      </aside>

      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl space-y-6 min-w-0">
        <header className="space-y-1 sm:space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Settings</div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">{group.label}</h1>
        </header>

        {statusMsg && (
          <div
            className={`p-3 rounded text-xs flex items-center gap-2 border ${
              statusMsg.type === "success"
                ? "bg-success/10 border-success/30 text-success"
                : "bg-destructive/10 border-destructive/30 text-destructive"
            }`}
          >
            {statusMsg.type === "success" ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {active === "general" && (
          <div className="space-y-4">
            <Field label="Email" hint="Managed by authentication provider">
              <Input value={user?.email || ""} disabled className="bg-surface/50 font-mono text-muted-foreground" />
            </Field>
            <Field label="Full Name">
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
              />
            </Field>
            <Field label="Bio / Title">
              <Input
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Lead Software Architect"
              />
            </Field>
            <Field label="Role" hint="Assigned workspace role">
              <Input value={user?.role || "Developer"} disabled className="bg-surface/50 font-mono text-muted-foreground" />
            </Field>
          </div>
        )}

        {active === "appearance" && (
          <div className="space-y-4">
            <Field label="Workstation Theme" hint="Tailored dark palettes for architecture review and system design.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    id: "slate",
                    label: "Slate",
                    badge: "Default",
                    palette: ["#0F172A", "#1E293B", "#38BDF8", "#F59E0B"],
                    desc: "Deep ocean-slate canvas with warm amber & sky highlights.",
                    preview: (
                      <div className="w-full h-24 rounded border border-[#1E293B] bg-[#0B1120] p-1.5 flex flex-col justify-between overflow-hidden relative shadow-inner">
                        <div className="flex items-center justify-between pb-1 border-b border-[#1E293B]/80">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          </div>
                          <span className="text-[8px] font-mono text-slate-400">slate-workstation</span>
                        </div>
                        <div className="flex items-stretch gap-1.5 flex-1 pt-1">
                          <div className="w-6 rounded bg-[#070D19] border border-[#1E293B]/40 p-1 flex flex-col gap-1 shrink-0">
                            <div className="w-full h-1.5 rounded bg-amber-500/80" />
                            <div className="w-3/4 h-1 rounded bg-slate-700/60" />
                            <div className="w-full h-1 rounded bg-slate-700/60" />
                          </div>
                          <div className="flex-1 rounded bg-[#0F172A] border border-[#1E293B] p-1 flex items-center justify-around">
                            <div className="p-1 rounded bg-[#1E293B] border border-sky-400/40 flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-mono text-sky-300 font-semibold">API</span>
                              <div className="w-4 h-1 rounded bg-slate-600" />
                            </div>
                            <div className="h-px w-4 bg-gradient-to-r from-sky-400 to-amber-400" />
                            <div className="p-1 rounded bg-[#1E293B] border border-amber-400/40 flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-mono text-amber-300 font-semibold">DB</span>
                              <div className="w-4 h-1 rounded bg-slate-600" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "graphite",
                    label: "Graphite",
                    badge: "Charcoal",
                    palette: ["#121214", "#18181B", "#27272A", "#10B981"],
                    desc: "Neutral monochrome zinc workstation with crisp emerald indicators.",
                    preview: (
                      <div className="w-full h-24 rounded border border-[#27272A] bg-[#121214] p-1.5 flex flex-col justify-between overflow-hidden relative shadow-inner">
                        <div className="flex items-center justify-between pb-1 border-b border-[#27272A]/80">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                          </div>
                          <span className="text-[8px] font-mono text-zinc-400">graphite-workstation</span>
                        </div>
                        <div className="flex items-stretch gap-1.5 flex-1 pt-1">
                          <div className="w-6 rounded bg-[#0A0A0C] border border-[#27272A]/40 p-1 flex flex-col gap-1 shrink-0">
                            <div className="w-full h-1.5 rounded bg-emerald-500/80" />
                            <div className="w-3/4 h-1 rounded bg-zinc-700/60" />
                            <div className="w-full h-1 rounded bg-zinc-700/60" />
                          </div>
                          <div className="flex-1 rounded bg-[#18181B] border border-[#27272A] p-1 flex items-center justify-around">
                            <div className="p-1 rounded bg-[#27272A] border border-emerald-400/40 flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-mono text-emerald-300 font-semibold">CORE</span>
                              <div className="w-4 h-1 rounded bg-zinc-600" />
                            </div>
                            <div className="h-px w-4 bg-gradient-to-r from-emerald-400 to-zinc-400" />
                            <div className="p-1 rounded bg-[#27272A] border border-zinc-500/40 flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-mono text-zinc-300 font-semibold">CACHE</span>
                              <div className="w-4 h-1 rounded bg-zinc-600" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "ink",
                    label: "Ink",
                    badge: "Obsidian",
                    palette: ["#000000", "#09090B", "#18181B", "#A855F7"],
                    desc: "Pitch-black high contrast canvas with electric violet accents.",
                    preview: (
                      <div className="w-full h-24 rounded border border-[#262626] bg-[#000000] p-1.5 flex flex-col justify-between overflow-hidden relative shadow-inner">
                        <div className="flex items-center justify-between pb-1 border-b border-[#262626]/80">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                          </div>
                          <span className="text-[8px] font-mono text-neutral-400">ink-workstation</span>
                        </div>
                        <div className="flex items-stretch gap-1.5 flex-1 pt-1">
                          <div className="w-6 rounded bg-[#000000] border border-[#262626] p-1 flex flex-col gap-1 shrink-0">
                            <div className="w-full h-1.5 rounded bg-purple-500" />
                            <div className="w-3/4 h-1 rounded bg-neutral-800" />
                            <div className="w-full h-1 rounded bg-neutral-800" />
                          </div>
                          <div className="flex-1 rounded bg-[#09090B] border border-[#262626] p-1 flex items-center justify-around">
                            <div className="p-1 rounded bg-[#18181B] border border-purple-500/50 flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-mono text-purple-300 font-semibold">GATE</span>
                              <div className="w-4 h-1 rounded bg-neutral-700" />
                            </div>
                            <div className="h-px w-4 bg-gradient-to-r from-purple-500 to-neutral-400" />
                            <div className="p-1 rounded bg-[#18181B] border border-neutral-700 flex flex-col items-center gap-0.5">
                              <span className="text-[7px] font-mono text-neutral-200 font-semibold">STREAM</span>
                              <div className="w-4 h-1 rounded bg-neutral-700" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ),
                  },
                ].map((t) => {
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={
                        "rounded-lg border p-3 text-left transition-all relative flex flex-col gap-2.5 " +
                        (isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary/25 shadow-sm"
                          : "border-border bg-surface/30 hover:border-border/80 hover:bg-surface/50")
                      }
                    >
                      {/* Theme Preview Image Mockup */}
                      {t.preview}

                      {/* Header with Title and Active Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold tracking-tight">{t.label}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                            {t.badge}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      {/* Palette Swatches */}
                      <div className="flex items-center gap-1.5">
                        {t.palette.map((color, idx) => (
                          <span
                            key={idx}
                            className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>

                      {/* Subtitle Description */}
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {t.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        {active === "notifications" && (
          <div className="space-y-3">
            {[
              { id: "generation", label: "Architecture generation complete" },
              { id: "repository", label: "Repository scan & analysis completed" },
              { id: "security", label: "Security & drift findings alert" },
              { id: "export", label: "Artifact export ready for download" },
              { id: "digest", label: "Weekly architecture digest" },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between h-10 px-3 rounded border border-border bg-background">
                <span className="text-xs">{item.label}</span>
                <Toggle
                  on={Boolean(notifState[item.id])}
                  onChange={(checked) => setNotifState((prev) => ({ ...prev, [item.id]: checked }))}
                  label={item.label}
                />
              </div>
            ))}
          </div>
        )}

        {active === "model" && (
          <div className="space-y-4">
            <Field label="Architecture Engine" hint="Configured AI provider or deterministic fallback">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "gen-4", label: "gen-4 (Recommended)", desc: "Deep reasoning" },
                  { id: "gen-3.5", label: "gen-3.5", desc: "Fast & lightweight" },
                  { id: "deterministic", label: "deterministic", desc: "Local heuristics" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModelName(m.id)}
                    className={
                      "rounded border p-3 text-left transition-colors " +
                      (modelName === m.id ? "border-primary bg-primary/10" : "border-border bg-surface/30 hover:border-border/80")
                    }
                  >
                    <div className="text-xs font-mono font-medium">{m.label}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Temperature">
              <Input
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                className="font-mono w-28"
              />
            </Field>
            <Field label="Reasoning Depth">
              <Input
                value={reasoningDepth}
                onChange={(e) => setReasoningDepth(e.target.value)}
                className="font-mono w-40"
              />
            </Field>
          </div>
        )}

        {active === "exports" && (
          <div className="space-y-4">
            <Field label="Default format">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className="h-8 px-2 rounded border border-border bg-background text-xs font-mono"
              >
                <option value="pdf">PDF Document</option>
                <option value="json">JSON Architecture</option>
                <option value="markdown">Markdown Report</option>
                <option value="svg">SVG Vector Diagram</option>
              </select>
            </Field>
            <Field label="Include diagrams">
              <Toggle on={includeDiagrams} onChange={setIncludeDiagrams} label="Include diagrams" />
            </Field>
            <Field label="Include code samples">
              <Toggle on={includeCode} onChange={setIncludeCode} label="Include code samples" />
            </Field>
          </div>
        )}

        {active === "workspace" && (
          <WorkspaceSection
            currentWorkspace={currentWorkspace}
            workspaceSettings={workspaceSettings}
          />
        )}

        {active === "about" && <AboutPanel />}

        {active !== "about" && active !== "workspace" && (
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                setStatusMsg(null);
                if (profile) setFullName(profile.full_name || "");
              }}
            >
              Reset
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)] items-start gap-1.5 sm:gap-4">
      <div>
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground mt-0.5 sm:mt-1">{hint}</div>}
      </div>
      <div className="pt-0.5 min-w-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={"h-5 w-9 rounded-full border transition-colors relative " + (on ? "bg-primary/30 border-primary/50" : "bg-surface border-border")}
      aria-label={label}
    >
      <span className={"absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all " + (on ? "left-4 bg-primary" : "left-0.5 bg-muted-foreground")} />
    </button>
  );
}

function WorkspaceSection({
  currentWorkspace,
  workspaceSettings,
}: {
  currentWorkspace: any;
  workspaceSettings?: IWorkspaceSettings;
}) {
  const queryClient = useQueryClient();
  const [wsName, setWsName] = useState(currentWorkspace?.name || "");
  const [visibility, setVisibility] = useState<"private" | "workspace">(
    workspaceSettings?.visibility || "workspace"
  );
  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"admin" | "member" | "viewer">("member");
  const [wsStatus, setWsStatus] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace) setWsName(currentWorkspace.name);
  }, [currentWorkspace]);

  useEffect(() => {
    if (workspaceSettings) setVisibility(workspaceSettings.visibility);
  }, [workspaceSettings]);

  // Load members
  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["workspace-members", currentWorkspace?.id],
    queryFn: () => getWorkspaceMembers(currentWorkspace!.id),
    enabled: Boolean(currentWorkspace),
  });

  const updateWsMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace) return;
      await updateWorkspace(currentWorkspace.id, { name: wsName });
      await updateWorkspaceSettings(currentWorkspace.id, { visibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-settings", currentWorkspace?.id] });
      setWsStatus("Workspace settings saved.");
      setTimeout(() => setWsStatus(null), 3000);
    },
    onError: (err: any) => {
      setWsStatus("Failed to save workspace settings: " + (err?.response?.data?.message || err.message));
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (input: { user_id: string; role: "admin" | "member" | "viewer" }) =>
      addWorkspaceMember(currentWorkspace.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", currentWorkspace?.id] });
      setNewMemberUserId("");
      setWsStatus("Member added successfully.");
      setTimeout(() => setWsStatus(null), 3000);
    },
    onError: (err: any) => {
      setWsStatus("Failed to add member: " + (err?.response?.data?.message || err.message));
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: "admin" | "member" | "viewer" }) =>
      updateWorkspaceMember(currentWorkspace.id, memberId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", currentWorkspace?.id] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => removeWorkspaceMember(currentWorkspace.id, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members", currentWorkspace?.id] });
    },
  });

  if (!currentWorkspace) {
    return <div className="text-xs text-muted-foreground">No workspace currently selected.</div>;
  }

  return (
    <div className="space-y-6">
      {wsStatus && (
        <div className="p-3 rounded text-xs border bg-primary/10 border-primary/30 text-foreground">
          {wsStatus}
        </div>
      )}

      <div className="space-y-4">
        <Field label="Workspace Name">
          <Input
            value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            placeholder="Workspace name"
          />
        </Field>
        <Field label="Visibility" hint="Access control within your organization">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "private" | "workspace")}
            className="h-8 px-2 rounded border border-border bg-background text-xs font-mono"
          >
            <option value="workspace">Workspace members only</option>
            <option value="private">Private (Restricted)</option>
          </select>
        </Field>
        <div className="flex justify-end">
          <Button onClick={() => updateWsMutation.mutate()} disabled={updateWsMutation.isPending} size="sm">
            {updateWsMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Save Workspace Settings
          </Button>
        </div>
      </div>

      <div className="pt-6 border-t border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Workspace Members</h3>
            <p className="text-[11px] text-muted-foreground">Manage access and role permissions for this workspace.</p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{members.length} members</span>
        </div>

        {/* Add Member Form */}
        <div className="surface-panel p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Input
            value={newMemberUserId}
            onChange={(e) => setNewMemberUserId(e.target.value)}
            placeholder="User UUID (e.g. 00000000-0000-0000-0000-000000000000)"
            className="text-xs font-mono flex-1 min-w-0"
          />
          <select
            value={newMemberRole}
            onChange={(e) => setNewMemberRole(e.target.value as any)}
            className="h-8 px-2 rounded border border-border bg-background text-xs font-mono"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          <Button
            size="sm"
            onClick={() => {
              if (newMemberUserId.trim()) {
                addMemberMutation.mutate({ user_id: newMemberUserId.trim(), role: newMemberRole });
              }
            }}
            disabled={!newMemberUserId.trim() || addMemberMutation.isPending}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>

        {/* Members List */}
        <div className="border border-border rounded overflow-hidden divide-y divide-border">
          {loadingMembers ? (
            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              Loading members…
            </div>
          ) : members.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">No members found in workspace.</div>
          ) : (
            members.map((m) => (
              <div key={m.id} className="p-3 flex items-center justify-between text-xs hover:bg-surface/40">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <div className="font-mono text-xs truncate">{m.user_id}</div>
                    <div className="text-[10px] text-muted-foreground">Joined {new Date(m.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) =>
                      updateMemberMutation.mutate({ memberId: m.id, role: e.target.value as any })
                    }
                    className="h-7 px-2 rounded border border-border bg-background text-xs font-mono"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Are you sure you want to remove this member?")) {
                        removeMemberMutation.mutate(m.id);
                      }
                    }}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    title="Remove member"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function AboutPanel() {
  return (
    <div className="surface-panel p-4 space-y-2 text-sm">
      <div className="flex items-center justify-between"><span className="text-muted-foreground">Version</span><span className="font-mono">0.2.0</span></div>
      <div className="flex items-center justify-between"><span className="text-muted-foreground">Build</span><span className="font-mono">2026-10-14</span></div>
      <div className="flex items-center justify-between"><span className="text-muted-foreground">Runtime</span><span className="font-mono">gen-4 / us-east-1</span></div>
      <div className="flex items-center justify-between"><span className="text-muted-foreground">License</span><span className="font-mono">Enterprise</span></div>
    </div>
  );
}
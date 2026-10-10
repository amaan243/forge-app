import { useState, useRef, useEffect } from "react";
import {
  FolderGit2,
  ChevronDown,
  Plus,
  Check,
  Search,
  Loader2,
  FolderOpen,
  Lock,
  Globe,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import type { Project } from "@/api";

interface ProjectSwitcherProps {
  variant?: "header" | "toolbar" | "inline" | "compact";
  className?: string;
}

export function ProjectSwitcher({ variant = "header", className = "" }: ProjectSwitcherProps) {
  const {
    projects,
    currentProject,
    selectProject,
    currentWorkspace,
    loadingProjects,
    setIsNewProjectOpen,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      // Focus search input after opening
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Reset search when opening/closing
  const handleToggle = () => {
    setOpen((prev) => {
      if (!prev) setSearch("");
      return !prev;
    });
  };

  const handleSelect = (project: Project) => {
    selectProject(project);
    setOpen(false);
  };

  const handleNewProject = () => {
    setOpen(false);
    setIsNewProjectOpen(true);
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Trigger button styles based on variant
  const renderTrigger = () => {
    if (variant === "header") {
      return (
        <button
          onClick={handleToggle}
          className={`flex items-center gap-1.5 h-7 px-2 rounded border border-border/80 bg-surface/70 hover:bg-surface hover:border-border text-xs font-mono transition-colors max-w-[220px] ${className}`}
          title={currentProject ? `Active Project: ${currentProject.name}` : "Select active project"}
          aria-expanded={open}
        >
          <FolderGit2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="truncate text-foreground font-medium">
            {currentProject ? currentProject.name : "Select Project"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 ml-auto" />
        </button>
      );
    }

    if (variant === "toolbar") {
      return (
        <button
          onClick={handleToggle}
          className={`flex items-center gap-1.5 h-6 px-2 rounded border border-border/90 bg-panel hover:bg-surface text-xs font-mono transition-colors group ${className}`}
          title="Switch Active Project"
          aria-expanded={open}
        >
          <span className="text-muted-foreground group-hover:text-foreground transition-colors">Project:</span>
          <span className="font-semibold text-foreground truncate max-w-[140px]">
            {currentProject ? currentProject.name : "Unassigned"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </button>
      );
    }

    if (variant === "compact") {
      return (
        <button
          onClick={handleToggle}
          className={`h-7 px-2 flex items-center gap-1.5 rounded border border-border bg-surface text-xs font-mono text-muted-foreground hover:text-foreground transition-colors ${className}`}
          title="Switch Project"
          aria-expanded={open}
        >
          <FolderGit2 className="h-3 w-3 text-primary" />
          <span className="truncate max-w-[120px]">{currentProject ? currentProject.name : "Projects"}</span>
          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
      );
    }

    // Default "inline"
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        <span className="text-[10px] font-mono uppercase text-muted-foreground">Project:</span>
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded border border-border bg-background hover:bg-surface text-xs font-mono transition-colors min-w-[160px] justify-between"
          title="Switch Project"
          aria-expanded={open}
        >
          <span className="truncate text-foreground font-medium">
            {currentProject ? currentProject.name : "Select Project"}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>
      </div>
    );
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {renderTrigger()}

      {open && (
        <div className="absolute left-0 mt-1 w-72 surface-panel shadow-2xl z-50 overflow-hidden divide-y divide-border border border-border rounded-md animate-in fade-in-50 zoom-in-95 duration-100">
          {/* Header Info */}
          <div className="px-3 py-2 bg-panel/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Workspace Projects
              </span>
              {currentWorkspace && (
                <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[120px]" title={currentWorkspace.name}>
                  {currentWorkspace.name}
                </span>
              )}
            </div>
            {/* Search Filter */}
            <div className="mt-1.5 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects…"
                className="w-full pl-7 pr-2 py-1 text-xs font-mono bg-background border border-border rounded text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/60"
              />
            </div>
          </div>

          {/* Projects List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/40">
            {loadingProjects ? (
              <div className="p-4 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Loading projects…</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-4 text-center space-y-1">
                <FolderOpen className="h-5 w-5 text-muted-foreground/60 mx-auto" />
                <p className="text-xs font-mono text-muted-foreground">
                  {search ? "No matching projects" : "No projects in this workspace"}
                </p>
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isSelected = currentProject?.id === project.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelect(project)}
                    className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded text-left transition-colors ${
                      isSelected
                        ? "bg-surface font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                    }`}
                  >
                    <FolderGit2
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        isSelected ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono truncate text-foreground">
                          {project.name}
                        </span>
                        {project.visibility === "private" ? (
                          <span title="Private project"><Lock className="h-2.5 w-2.5 text-muted-foreground shrink-0" /></span>
                        ) : (
                          <span title="Workspace project"><Globe className="h-2.5 w-2.5 text-muted-foreground shrink-0" /></span>
                        )}
                      </div>
                      {project.description && (
                        <p className="text-[11px] text-muted-foreground truncate font-sans">
                          {project.description}
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* New Project Action */}
          <div className="p-1 bg-panel/30">
            <button
              onClick={handleNewProject}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono text-primary hover:bg-surface/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create New Project</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

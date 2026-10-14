import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  type Workspace,
  type Project,
  type CreateWorkspaceInput,
  type UpdateProjectInput,
  getWorkspaces,
  createWorkspace as apiCreateWorkspace,
  deleteWorkspace as apiDeleteWorkspace,
  getProjects,
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  invalidateApiCache,
} from "@/api";
import { useAuth } from "./auth-context";
import { toast } from "sonner";

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loadingWorkspaces: boolean;
  projects: Project[];
  currentProject: Project | null;
  loadingProjects: boolean;
  selectWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (data: CreateWorkspaceInput) => Promise<Workspace>;
  deleteWorkspace: (id: string) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  selectProject: (project: Project | null) => void;
  createProject: (data: { name: string; description?: string; visibility?: "private" | "workspace" }) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  isNewWorkspaceOpen: boolean;
  setIsNewWorkspaceOpen: (open: boolean) => void;
  isNewProjectOpen: boolean;
  setIsNewProjectOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState<boolean>(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);

  const [isNewWorkspaceOpen, setIsNewWorkspaceOpen] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);

  // 1. Fetch workspaces when authenticated
  const fetchWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      return;
    }
    setLoadingWorkspaces(true);
    try {
      const data = await getWorkspaces();
      setWorkspaces(data);

      const savedWsId = typeof window !== "undefined" ? localStorage.getItem("archforge_active_workspace_id") : null;
      const matched = data.find((w) => w.id === savedWsId);
      if (matched) {
        setCurrentWorkspace(matched);
      } else if (data.length > 0) {
        setCurrentWorkspace(data[0]);
        if (typeof window !== "undefined") {
          localStorage.setItem("archforge_active_workspace_id", data[0].id);
        }
      } else {
        setCurrentWorkspace(null);
      }
    } catch {
      // Handled by global axios interceptor
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // 2. Fetch projects when active workspace changes
  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated || !currentWorkspace) {
      setProjects([]);
      setCurrentProject(null);
      return;
    }
    setLoadingProjects(true);
    try {
      const data = await getProjects(currentWorkspace.id);
      setProjects(data);

      let urlProjId: string | null = null;
      if (typeof window !== "undefined") {
        urlProjId = new URLSearchParams(window.location.search).get("projectId");
      }
      const savedProjId = typeof window !== "undefined" ? localStorage.getItem("archforge_active_project_id") : null;
      const targetId = urlProjId || savedProjId;
      const matched = data.find((p) => p.id === targetId);
      if (matched) {
        setCurrentProject(matched);
        if (typeof window !== "undefined") {
          localStorage.setItem("archforge_active_project_id", matched.id);
        }
      } else if (data.length > 0) {
        setCurrentProject(data[0]);
        if (typeof window !== "undefined") {
          localStorage.setItem("archforge_active_project_id", data[0].id);
        }
      } else {
        setCurrentProject(null);
      }
    } catch {
      // Handled by global axios interceptor
    } finally {
      setLoadingProjects(false);
    }
  }, [isAuthenticated, currentWorkspace]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Select workspace
  const selectWorkspace = useCallback((workspace: Workspace | null) => {
    invalidateApiCache();
    setCurrentWorkspace(workspace);
    setProjects([]);
    setCurrentProject(null);
    if (workspace && typeof window !== "undefined") {
      localStorage.setItem("archforge_active_workspace_id", workspace.id);
    }
  }, []);

  // Create workspace
  const handleCreateWorkspace = useCallback(async (data: CreateWorkspaceInput): Promise<Workspace> => {
    const created = await apiCreateWorkspace(data);
    setWorkspaces((prev) => [created, ...prev]);
    selectWorkspace(created);
    toast.success(`Workspace "${created.name}" created successfully`);
    return created;
  }, [selectWorkspace]);

  // Delete workspace
  const handleDeleteWorkspace = useCallback(async (id: string): Promise<void> => {
    await apiDeleteWorkspace(id);
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    if (currentWorkspace?.id === id) {
      const remaining = workspaces.filter((w) => w.id !== id);
      selectWorkspace(remaining.length > 0 ? remaining[0] : null);
    }
    toast.success("Workspace deleted");
  }, [currentWorkspace, workspaces, selectWorkspace]);

  // Select project
  const selectProject = useCallback((project: Project | null) => {
    invalidateApiCache();
    setCurrentProject(project);
    if (project && typeof window !== "undefined") {
      localStorage.setItem("archforge_active_project_id", project.id);
    }
  }, []);

  // Create project
  const handleCreateProject = useCallback(async (data: { name: string; description?: string; visibility?: "private" | "workspace" }): Promise<Project> => {
    if (!currentWorkspace) {
      throw new Error("Please select or create a workspace first.");
    }
    const created = await apiCreateProject(currentWorkspace.id, data);
    setProjects((prev) => [created, ...prev]);
    selectProject(created);
    toast.success(`Project "${created.name}" created successfully`);
    return created;
  }, [currentWorkspace, selectProject]);

  // Update project
  const handleUpdateProject = useCallback(async (id: string, data: UpdateProjectInput): Promise<Project> => {
    const updated = await apiUpdateProject(id, data);
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    if (currentProject?.id === id) {
      setCurrentProject(updated);
    }
    toast.success("Project updated");
    return updated;
  }, [currentProject]);

  // Delete project
  const handleDeleteProject = useCallback(async (id: string): Promise<void> => {
    await apiDeleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (currentProject?.id === id) {
      const remaining = projects.filter((p) => p.id !== id);
      selectProject(remaining.length > 0 ? remaining[0] : null);
    }
    toast.success("Project deleted");
  }, [currentProject, projects, selectProject]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        loadingWorkspaces,
        projects,
        currentProject,
        loadingProjects,
        selectWorkspace,
        createWorkspace: handleCreateWorkspace,
        deleteWorkspace: handleDeleteWorkspace,
        refreshWorkspaces: fetchWorkspaces,
        selectProject,
        createProject: handleCreateProject,
        updateProject: handleUpdateProject,
        deleteProject: handleDeleteProject,
        refreshProjects: fetchProjects,
        isNewWorkspaceOpen,
        setIsNewWorkspaceOpen,
        isNewProjectOpen,
        setIsNewProjectOpen,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}

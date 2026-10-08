import { supabaseAdmin } from "../lib/supabase.js";

export const searchService = {
  async search(userId: string, term: string) {
    const escaped = term.replace(/[%(),]/g, " ").trim();
    const projects = await supabaseAdmin
      .from("projects")
      .select("id, name, description, workspace_id, workspace_members!inner(user_id)")
      .eq("workspace_members.user_id", userId)
      .or(`name.ilike.%${escaped}%,description.ilike.%${escaped}%`)
      .limit(20);
    if (projects.error) throw projects.error;
    const projectIds = (projects.data ?? []).map((project) => String(project.id));
    if (!projectIds.length) return { projects: [], nodes: [], documentation: [], repositories: [], snapshots: [], timeline: [] };
    const [nodes, documentation, repositories, snapshots, timeline] = await Promise.all([
      supabaseAdmin.from("architecture_nodes").select("id,name,type,architecture_version_id").ilike("name", `%${escaped}%`).limit(20),
      supabaseAdmin.from("documentation_documents").select("id,title,type,project_id").ilike("title", `%${escaped}%`).in("project_id", projectIds).limit(20),
      supabaseAdmin.from("repositories").select("id,repository_name,repository_url,project_id").ilike("repository_name", `%${escaped}%`).in("project_id", projectIds).limit(20),
      supabaseAdmin.from("snapshots").select("id,name,type,project_id").ilike("name", `%${escaped}%`).in("project_id", projectIds).limit(20),
      supabaseAdmin.from("timeline_events").select("id,event_type,entity_type,project_id").ilike("event_type", `%${escaped}%`).in("project_id", projectIds).limit(20),
    ]);
    for (const result of [nodes, documentation, repositories, snapshots, timeline]) if (result.error) throw result.error;
    return { projects: projects.data ?? [], nodes: nodes.data ?? [], documentation: documentation.data ?? [], repositories: repositories.data ?? [], snapshots: snapshots.data ?? [], timeline: timeline.data ?? [] };
  },
};

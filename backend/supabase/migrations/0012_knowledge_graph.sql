-- Migration 0012: Engineering Knowledge Graph & Traceability Integration

create table if not exists public.knowledge_graph_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  architecture_version_id uuid references public.architecture_versions(id) on delete set null,
  repository_id uuid references public.repositories(id) on delete set null,
  repository_analysis_id uuid references public.repository_analyses(id) on delete set null,
  source_hash text not null,
  entities jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('active', 'completed', 'stale', 'archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists kg_snapshots_project_idx on public.knowledge_graph_snapshots(project_id, created_at desc);
create index if not exists kg_snapshots_version_idx on public.knowledge_graph_snapshots(architecture_version_id);
create index if not exists kg_snapshots_analysis_idx on public.knowledge_graph_snapshots(repository_analysis_id);
create index if not exists kg_snapshots_hash_idx on public.knowledge_graph_snapshots(project_id, source_hash);

alter table public.knowledge_graph_snapshots enable row level security;

drop policy if exists kg_snapshots_access on public.knowledge_graph_snapshots;
create policy kg_snapshots_access on public.knowledge_graph_snapshots for select using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

drop policy if exists kg_snapshots_manage on public.knowledge_graph_snapshots;
create policy kg_snapshots_manage on public.knowledge_graph_snapshots for all using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
) with check (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

do $$
begin
  alter publication supabase_realtime add table public.knowledge_graph_snapshots;
exception when duplicate_object then null;
          when others then null;
end $$;

notify pgrst, 'reload schema';

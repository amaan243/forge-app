-- Migration 0011: Engineering Workflow Orchestration Integration

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  architecture_version_id uuid references public.architecture_versions(id) on delete set null,
  repository_id uuid references public.repositories(id) on delete set null,
  repository_analysis_id uuid references public.repository_analyses(id) on delete set null,
  branch text,
  commit_sha text,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed', 'needs_attention')),
  stages jsonb not null default '{}'::jsonb,
  readiness_gate jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  source_context jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists workflow_runs_project_idx on public.workflow_runs(project_id, created_at desc);
create index if not exists workflow_runs_version_idx on public.workflow_runs(architecture_version_id);
create index if not exists workflow_runs_analysis_idx on public.workflow_runs(repository_analysis_id);

alter table public.workflow_runs enable row level security;

drop policy if exists workflow_runs_access on public.workflow_runs;
create policy workflow_runs_access on public.workflow_runs for select using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

drop policy if exists workflow_runs_manage on public.workflow_runs;
create policy workflow_runs_manage on public.workflow_runs for all using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
) with check (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

do $$
begin
  alter publication supabase_realtime add table public.workflow_runs;
exception when duplicate_object then null;
          when others then null;
end $$;

notify pgrst, 'reload schema';

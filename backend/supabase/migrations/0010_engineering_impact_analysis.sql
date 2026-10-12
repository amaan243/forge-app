-- Migration 0010: Engineering Impact Analysis Integration

create table if not exists public.impact_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  architecture_version_id uuid not null references public.architecture_versions(id) on delete cascade,
  repository_id uuid references public.repositories(id) on delete set null,
  repository_analysis_id uuid references public.repository_analyses(id) on delete set null,
  target_entity jsonb not null,
  proposed_change jsonb not null,
  source_context jsonb not null,
  mapping_summary jsonb not null default '{}'::jsonb,
  dependency_graph jsonb not null default '{}'::jsonb,
  impact_summary jsonb not null default '{}'::jsonb,
  risk_assessment jsonb not null default '{}'::jsonb,
  change_plan jsonb not null default '{}'::jsonb,
  drift_correlations jsonb not null default '[]'::jsonb,
  playground_bridge jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists impact_reports_project_idx on public.impact_reports(project_id, created_at desc);
create index if not exists impact_reports_version_idx on public.impact_reports(architecture_version_id);
create index if not exists impact_reports_snapshot_idx on public.impact_reports(repository_analysis_id);

alter table public.impact_reports enable row level security;

drop policy if exists impact_reports_access on public.impact_reports;
create policy impact_reports_access on public.impact_reports for select using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

drop policy if exists impact_reports_manage on public.impact_reports;
create policy impact_reports_manage on public.impact_reports for all using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
) with check (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

do $$
begin
  alter publication supabase_realtime add table public.impact_reports;
exception when duplicate_object then null;
          when others then null;
end $$;

notify pgrst, 'reload schema';

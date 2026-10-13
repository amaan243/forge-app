-- Migration 0013: Engineering Quality & Release Readiness Integration

create table if not exists public.quality_policies (
  id text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null,
  mandatory_check_ids text[] not null default '{}',
  severity_thresholds jsonb not null default '{"maxCritical": 0, "maxHigh": 0}'::jsonb,
  is_custom boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (project_id, id)
);

create table if not exists public.quality_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  repository_id uuid references public.repositories(id) on delete set null,
  commit_sha text not null,
  branch text,
  build_status text not null check (build_status in ('passed', 'failed', 'not_evaluated')),
  build_command text,
  build_duration_ms int,
  build_output text,
  test_status text not null check (test_status in ('passed', 'failed', 'not_evaluated')),
  test_framework text,
  tests_total int not null default 0,
  tests_passed int not null default 0,
  tests_failed int not null default 0,
  tests_skipped int not null default 0,
  test_duration_ms int,
  coverage_percent numeric(5,2),
  error_summary text,
  security_scan_status text check (security_scan_status in ('passed', 'failed', 'warning', 'not_evaluated')),
  security_scanner_name text,
  security_advisories_count int not null default 0,
  executed_by text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quality_reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  architecture_version_id uuid references public.architecture_versions(id) on delete set null,
  repository_id uuid references public.repositories(id) on delete set null,
  repository_analysis_id uuid references public.repository_analyses(id) on delete set null,
  baseline_architecture_version_id uuid references public.architecture_versions(id) on delete set null,
  baseline_repository_analysis_id uuid references public.repository_analyses(id) on delete set null,
  baseline_quality_report_id uuid references public.quality_reports(id) on delete set null,
  policy_id text not null,
  policy_name text not null,
  policy_version text not null default '1.0.0',
  readiness_verdict text not null check (readiness_verdict in ('ready', 'ready_with_warnings', 'blocked', 'not_evaluated')),
  summary text not null,
  checks jsonb not null default '[]'::jsonb,
  category_summaries jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  required_actions jsonb not null default '[]'::jsonb,
  baseline_comparison jsonb,
  source_context jsonb not null default '{}'::jsonb,
  evidence_sources jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists quality_policies_project_idx on public.quality_policies(project_id);
create index if not exists quality_evidence_project_commit_idx on public.quality_verification_evidence(project_id, commit_sha, created_at desc);
create index if not exists quality_reports_project_idx on public.quality_reports(project_id, created_at desc);
create index if not exists quality_reports_version_idx on public.quality_reports(architecture_version_id);
create index if not exists quality_reports_analysis_idx on public.quality_reports(repository_analysis_id);
create index if not exists quality_reports_baseline_idx on public.quality_reports(baseline_quality_report_id);

alter table public.quality_policies enable row level security;
alter table public.quality_verification_evidence enable row level security;
alter table public.quality_reports enable row level security;

-- Quality policies RLS
drop policy if exists quality_policies_access on public.quality_policies;
create policy quality_policies_access on public.quality_policies for select using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

drop policy if exists quality_policies_manage on public.quality_policies;
create policy quality_policies_manage on public.quality_policies for all using (
  public.is_workspace_admin((select workspace_id from public.projects where id = project_id))
) with check (
  public.is_workspace_admin((select workspace_id from public.projects where id = project_id))
);

-- Quality evidence RLS
drop policy if exists quality_evidence_access on public.quality_verification_evidence;
create policy quality_evidence_access on public.quality_verification_evidence for select using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

drop policy if exists quality_evidence_manage on public.quality_verification_evidence;
create policy quality_evidence_manage on public.quality_verification_evidence for all using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
) with check (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

-- Quality reports RLS
drop policy if exists quality_reports_access on public.quality_reports;
create policy quality_reports_access on public.quality_reports for select using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

drop policy if exists quality_reports_manage on public.quality_reports;
create policy quality_reports_manage on public.quality_reports for all using (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
) with check (
  public.is_workspace_member((select workspace_id from public.projects where id = project_id))
);

do $$
begin
  alter publication supabase_realtime add table public.quality_reports;
exception when duplicate_object then null;
          when others then null;
end $$;

notify pgrst, 'reload schema';

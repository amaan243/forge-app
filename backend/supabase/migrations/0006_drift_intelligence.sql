-- Migration 0006: Architecture Drift Intelligence Enhancements
alter table public.drift_analyses 
  add column if not exists repository_id uuid references public.repositories(id) on delete cascade;

alter table public.drift_analyses 
  add column if not exists completed_at timestamptz;

alter table public.drift_analyses 
  add column if not exists counts jsonb not null default '{}'::jsonb;

-- Allow extended drift types in drift_items
alter table public.drift_items drop constraint if exists drift_items_type_check;
alter table public.drift_items add constraint drift_items_type_check 
  check (type in ('missing', 'extra', 'mismatch', 'uncertain', 'coverage_limitation', 'limitation', 'integration_mismatch'));

create index if not exists drift_analyses_repo_idx on public.drift_analyses(repository_id);
create index if not exists drift_analyses_version_idx on public.drift_analyses(architecture_version_id);
create index if not exists drift_analyses_snapshot_idx on public.drift_analyses(repository_analysis_id);

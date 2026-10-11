alter table public.playground_simulations
  add column if not exists repository_id uuid references public.repositories(id) on delete set null,
  add column if not exists snapshot_id uuid references public.repository_analyses(id) on delete set null,
  add column if not exists applied_version_id uuid references public.architecture_versions(id) on delete set null;

create index if not exists playground_base_version_idx on public.playground_simulations(base_version_id);

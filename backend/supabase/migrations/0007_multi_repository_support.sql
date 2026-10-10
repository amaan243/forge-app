-- Migration 0007: Multi-Repository Management Support

-- 1. Remove the single repository per project restriction
alter table public.repositories drop constraint if exists repositories_project_id_key;
alter table public.repositories drop constraint if exists repositories_project_id_unique;

-- 2. Add status column to support disconnecting without losing records or analysis history
alter table public.repositories add column if not exists status text not null default 'active' check (status in ('active', 'disconnected'));

-- 3. Prevent duplicate active repository connections for the same project and URL
create unique index if not exists repositories_project_url_active_idx 
  on public.repositories(project_id, repository_url) 
  where status = 'active';

-- 4. Ensure deleting or disconnecting a repository never cascades to delete analysis history or drift analyses
alter table public.repository_analyses alter column repository_id drop not null;
alter table public.repository_analyses drop constraint if exists repository_analyses_repository_id_fkey;
alter table public.repository_analyses add constraint repository_analyses_repository_id_fkey 
  foreign key (repository_id) references public.repositories(id) on delete set null;

alter table public.drift_analyses drop constraint if exists drift_analyses_repository_id_fkey;
alter table public.drift_analyses add constraint drift_analyses_repository_id_fkey 
  foreign key (repository_id) references public.repositories(id) on delete set null;

-- 5. Scope dependencies per repository analysis instead of entire project
alter table public.dependencies drop constraint if exists dependencies_project_id_name_ecosystem_key;
alter table public.dependencies drop constraint if exists dependencies_analysis_name_ecosystem_key;
alter table public.dependencies add constraint dependencies_analysis_name_ecosystem_key 
  unique (repository_analysis_id, name, ecosystem);

-- 6. Additional index for fast repository querying by project
create index if not exists repositories_project_idx on public.repositories(project_id, created_at desc);
create index if not exists dependencies_analysis_idx on public.dependencies(repository_analysis_id);

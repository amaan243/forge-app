alter table public.documentation_documents
  add column if not exists source_repository_analysis_id uuid references public.repository_analyses(id) on delete set null,
  add column if not exists source_commit_sha text,
  add column if not exists source_branch text,
  add column if not exists generation_metadata jsonb not null default '{}'::jsonb;

alter table public.documentation_documents
  drop constraint if exists documentation_documents_format_check;

alter table public.documentation_documents
  add constraint documentation_documents_format_check
  check (format in ('markdown', 'html', 'mermaid', 'openapi_json', 'openapi_yaml'));

create index if not exists documentation_source_version_idx
  on public.documentation_documents(source_version_id);

create index if not exists documentation_source_analysis_idx
  on public.documentation_documents(source_repository_analysis_id);

notify pgrst, 'reload schema';

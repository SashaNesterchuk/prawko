create table if not exists public.question_ai_explanations (
  question_source_id text primary key
    references public.questions(question_source_id) on delete cascade,
  explanations jsonb not null
    check (jsonb_typeof(explanations) = 'object'),
  available_locales text[] not null default '{}'::text[]
    check (coalesce(array_length(available_locales, 1), 0) > 0),
  explanation_version text not null
    check (length(btrim(explanation_version)) > 0),
  source_context_version text,
  source_context_updated_at timestamptz,
  source_row_number integer not null
    check (source_row_number > 0),
  has_media boolean not null default false,
  media_type public.question_media_type,
  provider text,
  model text,
  confidence double precision
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  needs_manual_review boolean not null default false,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists question_ai_explanations_media_type_idx
  on public.question_ai_explanations (media_type)
  where media_type is not null;

create index if not exists question_ai_explanations_needs_review_idx
  on public.question_ai_explanations (needs_manual_review)
  where needs_manual_review = true;

drop trigger if exists set_question_ai_explanations_updated_at on public.question_ai_explanations;
create trigger set_question_ai_explanations_updated_at
  before update on public.question_ai_explanations
  for each row execute function public.set_updated_at();

grant all on public.question_ai_explanations to service_role;

alter table public.question_ai_explanations enable row level security;

revoke all on public.question_ai_explanations from anon;
revoke all on public.question_ai_explanations from authenticated;

grant select on public.question_ai_explanations to authenticated;
grant select on public.question_ai_explanations to anon;

drop policy if exists question_ai_explanations_select_authenticated
  on public.question_ai_explanations;
create policy question_ai_explanations_select_authenticated
  on public.question_ai_explanations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.questions q
      where q.question_source_id = question_ai_explanations.question_source_id
        and q.is_active = true
    )
  );

drop policy if exists question_ai_explanations_select_anon
  on public.question_ai_explanations;
create policy question_ai_explanations_select_anon
  on public.question_ai_explanations
  for select
  to anon
  using (
    exists (
      select 1
      from public.questions q
      where q.question_source_id = question_ai_explanations.question_source_id
        and q.is_active = true
    )
  );

-- V2 contexts are kept per question-set and must never alter legacy Prawko
-- context/explanation tables.
create table if not exists public.question_ai_contexts_v2 (
  question_id uuid primary key references public.questions_v2(id) on delete cascade,
  context jsonb not null check (jsonb_typeof(context) = 'object'),
  context_version text not null check (length(btrim(context_version)) > 0),
  media_fingerprint text,
  needs_manual_review boolean not null default false,
  source_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists question_ai_contexts_v2_review_idx
  on public.question_ai_contexts_v2 (needs_manual_review)
  where needs_manual_review;

grant all on public.question_ai_contexts_v2 to service_role;

alter table public.question_ai_contexts_v2 enable row level security;

revoke all on public.question_ai_contexts_v2 from anon, authenticated;

drop trigger if exists set_question_ai_contexts_v2_updated_at on public.question_ai_contexts_v2;
create trigger set_question_ai_contexts_v2_updated_at
  before update on public.question_ai_contexts_v2
  for each row execute function public.set_updated_at();

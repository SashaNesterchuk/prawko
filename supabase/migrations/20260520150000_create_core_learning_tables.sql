create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'app_locale'
  ) then
    create type public.app_locale as enum ('pl', 'ua', 'en');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'driving_category'
  ) then
    create type public.driving_category as enum (
      'AM', 'A1', 'A2', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'T'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'plan_level'
  ) then
    create type public.plan_level as enum ('first_time', 'repeater', 'already_studied');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'study_plan_status'
  ) then
    create type public.study_plan_status as enum (
      'draft',
      'active',
      'paused',
      'completed',
      'abandoned'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'question_scope'
  ) then
    create type public.question_scope as enum ('base', 'specialist');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'question_answer_type'
  ) then
    create type public.question_answer_type as enum ('boolean', 'abc');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'question_media_type'
  ) then
    create type public.question_media_type as enum ('image', 'video');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'topic_block'
  ) then
    create type public.topic_block as enum (
      'signs',
      'intersections',
      'overtaking',
      'pedestrians',
      'first_aid',
      'priority',
      'safety',
      'technical'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'attempt_mode'
  ) then
    create type public.attempt_mode as enum (
      'learning',
      'exam',
      'weak_spots',
      'saved',
      'plan',
      'mini_test',
      'exam_tomorrow'
    );
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  interface_locale public.app_locale not null default 'ua',
  current_category public.driving_category not null default 'B',
  timezone text not null default 'Europe/Warsaw',
  onboarding_completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_source_id text not null unique,
  source_row_number integer not null check (source_row_number > 0),
  question_pl text not null,
  question_ua text,
  question_en text,
  explanation_pl text,
  explanation_ua text,
  explanation_en text,
  answer_type public.question_answer_type not null,
  correct_answer text not null,
  option_a text,
  option_b text,
  option_c text,
  media_filename text,
  media_type public.question_media_type,
  points smallint not null check (points in (1, 2, 3)),
  scope public.question_scope not null,
  categories text[] not null,
  topic_block public.topic_block not null,
  difficulty_seed smallint not null check (difficulty_seed between 1 and 100),
  has_media boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint questions_category_array_valid
    check (
      coalesce(array_length(categories, 1), 0) > 0
      and categories <@ array[
        'AM', 'A1', 'A2', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'T'
      ]::text[]
    ),
  constraint questions_correct_answer_matches_type
    check (
      (answer_type = 'boolean' and correct_answer in ('true', 'false'))
      or
      (answer_type = 'abc' and correct_answer in ('A', 'B', 'C'))
    ),
  constraint questions_answer_options_match_type
    check (
      (answer_type = 'boolean' and option_a is null and option_b is null and option_c is null)
      or
      (answer_type = 'abc' and option_a is not null and option_b is not null and option_c is not null)
    ),
  constraint questions_media_fields_consistent
    check (
      (media_filename is null and media_type is null and has_media = false)
      or
      (media_filename is not null and media_type is not null and has_media = true)
    )
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Study Plan',
  status public.study_plan_status not null default 'draft',
  current_category public.driving_category not null default 'B',
  plan_locale public.app_locale not null default 'ua',
  level public.plan_level not null,
  exam_date date not null,
  days_planned smallint not null check (days_planned between 1 and 90),
  minutes_per_day smallint not null check (minutes_per_day between 5 and 180),
  generator_version text not null default 'v1',
  generation_context jsonb not null default '{}'::jsonb,
  plan_snapshot jsonb not null default '[]'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  last_rebuilt_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint study_plans_generation_context_is_object
    check (jsonb_typeof(generation_context) = 'object'),
  constraint study_plans_plan_snapshot_is_array
    check (jsonb_typeof(plan_snapshot) = 'array'),
  constraint study_plans_completed_after_created
    check (completed_at is null or completed_at >= created_at)
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  study_plan_id uuid references public.study_plans(id) on delete set null,
  mode public.attempt_mode not null,
  question_locale public.app_locale,
  answer_given text not null,
  is_correct boolean not null,
  answer_duration_ms integer check (answer_duration_ms is null or answer_duration_ms >= 0),
  explanation_opened boolean not null default false,
  ai_chat_used boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  answered_at timestamptz not null default timezone('utc', now()),
  constraint question_attempts_answer_given_not_blank
    check (length(btrim(answer_given)) > 0),
  constraint question_attempts_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists profiles_locale_category_idx
  on public.profiles (interface_locale, current_category);

create index if not exists questions_scope_topic_block_idx
  on public.questions (scope, topic_block);

create index if not exists questions_points_idx
  on public.questions (points);

create index if not exists questions_active_idx
  on public.questions (is_active);

create index if not exists questions_categories_gin_idx
  on public.questions using gin (categories);

create index if not exists study_plans_user_status_created_at_idx
  on public.study_plans (user_id, status, created_at desc);

create index if not exists study_plans_exam_date_idx
  on public.study_plans (exam_date);

create index if not exists question_attempts_user_answered_at_idx
  on public.question_attempts (user_id, answered_at desc);

create index if not exists question_attempts_user_question_answered_at_idx
  on public.question_attempts (user_id, question_id, answered_at desc);

create index if not exists question_attempts_user_wrong_answered_at_idx
  on public.question_attempts (user_id, answered_at desc)
  where is_correct = false;

create index if not exists question_attempts_study_plan_answered_at_idx
  on public.question_attempts (study_plan_id, answered_at desc)
  where study_plan_id is not null;

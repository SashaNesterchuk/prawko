do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'study_plan_day_status'
  ) then
    create type public.study_plan_day_status as enum (
      'pending',
      'in_progress',
      'completed',
      'skipped',
      'replanned'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'study_plan_task_type'
  ) then
    create type public.study_plan_task_type as enum (
      'learn_topic',
      'review_weak_spots',
      'mini_test',
      'full_exam',
      'review_saved',
      'review_wrong_answers'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'study_plan_task_status'
  ) then
    create type public.study_plan_task_status as enum (
      'pending',
      'in_progress',
      'completed',
      'skipped',
      'canceled'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where connamespace = 'public'::regnamespace
      and conname = 'study_plans_id_user_id_key'
  ) then
    alter table public.study_plans
      add constraint study_plans_id_user_id_key unique (id, user_id);
  end if;
end
$$;

create table if not exists public.question_user_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  times_seen integer not null default 0 check (times_seen >= 0),
  times_correct integer not null default 0 check (times_correct >= 0),
  times_wrong integer not null default 0 check (times_wrong >= 0),
  consecutive_correct integer not null default 0 check (consecutive_correct >= 0),
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  last_correct_at timestamptz,
  last_wrong_at timestamptz,
  review_due_at timestamptz,
  last_mode public.attempt_mode,
  is_hard boolean not null default false,
  is_mastered boolean not null default false,
  mastery_score smallint not null default 0 check (mastery_score between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint question_user_state_user_question_unique unique (user_id, question_id),
  constraint question_user_state_counts_consistent
    check (times_correct + times_wrong <= times_seen),
  constraint question_user_state_seen_timestamps_consistent
    check (
      (times_seen = 0 and first_seen_at is null and last_seen_at is null)
      or
      (times_seen > 0 and first_seen_at is not null and last_seen_at is not null)
    )
);

create table if not exists public.study_plan_days (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null,
  user_id uuid not null,
  plan_date date not null,
  day_number smallint not null check (day_number between 1 and 90),
  status public.study_plan_day_status not null default 'pending',
  focus_topic public.topic_block,
  tasks_total smallint not null default 0 check (tasks_total >= 0),
  tasks_completed smallint not null default 0 check (tasks_completed >= 0 and tasks_completed <= tasks_total),
  minimum_mode_enabled boolean not null default true,
  minimum_mode_completed boolean not null default false,
  readiness_score_snapshot smallint check (readiness_score_snapshot is null or readiness_score_snapshot between 0 and 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint study_plan_days_plan_fk
    foreign key (study_plan_id, user_id)
    references public.study_plans (id, user_id)
    on delete cascade,
  constraint study_plan_days_unique_date unique (study_plan_id, plan_date),
  constraint study_plan_days_unique_day_number unique (study_plan_id, day_number),
  constraint study_plan_days_identity_unique unique (id, study_plan_id, user_id)
);

create table if not exists public.study_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  study_plan_day_id uuid not null,
  study_plan_id uuid not null,
  user_id uuid not null,
  task_type public.study_plan_task_type not null,
  status public.study_plan_task_status not null default 'pending',
  title text not null,
  description text,
  sort_order smallint not null default 1 check (sort_order > 0),
  topic_block public.topic_block,
  question_scope public.question_scope,
  question_count_target smallint check (question_count_target is null or question_count_target >= 0),
  question_count_completed smallint not null default 0 check (
    question_count_completed >= 0
    and (
      question_count_target is null
      or question_count_completed <= question_count_target
    )
  ),
  estimated_minutes smallint check (estimated_minutes is null or estimated_minutes between 1 and 180),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint study_plan_tasks_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint study_plan_tasks_completed_after_started
    check (completed_at is null or started_at is null or completed_at >= started_at),
  constraint study_plan_tasks_day_fk
    foreign key (study_plan_day_id, study_plan_id, user_id)
    references public.study_plan_days (id, study_plan_id, user_id)
    on delete cascade,
  constraint study_plan_tasks_unique_sort_order unique (study_plan_day_id, sort_order)
);

create index if not exists question_user_state_user_review_due_idx
  on public.question_user_state (user_id, review_due_at asc)
  where review_due_at is not null;

create index if not exists question_user_state_user_hard_idx
  on public.question_user_state (user_id, is_hard)
  where is_hard = true;

create index if not exists question_user_state_user_mastery_idx
  on public.question_user_state (user_id, is_mastered, mastery_score desc);

create index if not exists study_plan_days_user_plan_date_idx
  on public.study_plan_days (user_id, plan_date asc);

create index if not exists study_plan_days_plan_status_idx
  on public.study_plan_days (study_plan_id, status);

create index if not exists study_plan_tasks_user_status_idx
  on public.study_plan_tasks (user_id, status);

create index if not exists study_plan_tasks_day_sort_idx
  on public.study_plan_tasks (study_plan_day_id, sort_order asc);

create index if not exists study_plan_tasks_topic_idx
  on public.study_plan_tasks (topic_block)
  where topic_block is not null;

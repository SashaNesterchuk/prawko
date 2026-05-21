do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'exam_session_status'
  ) then
    create type public.exam_session_status as enum (
      'active',
      'completed',
      'abandoned',
      'expired'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_message_role'
  ) then
    create type public.ai_message_role as enum ('user', 'assistant', 'system');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_message_kind'
  ) then
    create type public.ai_message_kind as enum (
      'question_explanation',
      'question_chat',
      'exam_review',
      'plan_help',
      'support'
    );
  end if;
end
$$;

create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  study_plan_id uuid references public.study_plans(id) on delete set null,
  mode public.attempt_mode not null,
  current_category public.driving_category not null default 'B',
  session_locale public.app_locale not null default 'ua',
  status public.exam_session_status not null default 'active',
  question_ids uuid[] not null,
  current_question_index smallint not null default 1,
  total_questions_target smallint not null check (total_questions_target between 1 and 64),
  total_questions_answered smallint not null default 0 check (
    total_questions_answered >= 0
    and total_questions_answered <= total_questions_target
  ),
  total_points_target smallint not null default 74 check (total_points_target > 0),
  pass_points smallint not null default 68 check (
    pass_points >= 0
    and pass_points <= total_points_target
  ),
  score_points smallint not null default 0 check (
    score_points >= 0
    and score_points <= total_points_target
  ),
  correct_answers_count smallint not null default 0 check (correct_answers_count >= 0),
  wrong_answers_count smallint not null default 0 check (wrong_answers_count >= 0),
  passed boolean,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exam_sessions_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint exam_sessions_mode_valid
    check (mode in ('exam', 'mini_test', 'exam_tomorrow')),
  constraint exam_sessions_question_ids_match_target
    check (coalesce(array_length(question_ids, 1), 0) = total_questions_target),
  constraint exam_sessions_current_index_valid
    check (
      current_question_index >= 1
      and current_question_index <= total_questions_target + 1
    ),
  constraint exam_sessions_counts_consistent
    check (
      correct_answers_count + wrong_answers_count <= total_questions_answered
    ),
  constraint exam_sessions_finished_after_started
    check (finished_at is null or finished_at >= started_at),
  constraint exam_sessions_id_user_unique unique (id, user_id)
);

create table if not exists public.exam_session_answers (
  id uuid primary key default gen_random_uuid(),
  exam_session_id uuid not null,
  user_id uuid not null,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_attempt_id uuid references public.question_attempts(id) on delete set null,
  question_order smallint not null check (question_order between 1 and 64),
  question_scope public.question_scope not null,
  question_points smallint not null check (question_points in (1, 2, 3)),
  answer_given text not null,
  is_correct boolean not null,
  points_awarded smallint not null default 0 check (
    points_awarded >= 0
    and points_awarded <= question_points
  ),
  answer_duration_ms integer check (
    answer_duration_ms is null
    or answer_duration_ms >= 0
  ),
  answered_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint exam_session_answers_answer_given_not_blank
    check (length(btrim(answer_given)) > 0),
  constraint exam_session_answers_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint exam_session_answers_session_fk
    foreign key (exam_session_id, user_id)
    references public.exam_sessions (id, user_id)
    on delete cascade,
  constraint exam_session_answers_unique_order unique (exam_session_id, question_order),
  constraint exam_session_answers_unique_question unique (exam_session_id, question_id)
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  saved_from_mode public.attempt_mode,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bookmarks_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint bookmarks_user_question_unique unique (user_id, question_id)
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  study_plan_id uuid references public.study_plans(id) on delete set null,
  exam_session_id uuid references public.exam_sessions(id) on delete set null,
  conversation_id uuid not null,
  message_order integer not null check (message_order > 0),
  message_role public.ai_message_role not null,
  message_kind public.ai_message_kind not null,
  provider text,
  model text,
  content text not null,
  is_visible_to_user boolean not null default true,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint ai_messages_content_not_blank
    check (length(btrim(content)) > 0),
  constraint ai_messages_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint ai_messages_user_conversation_order_unique
    unique (user_id, conversation_id, message_order)
);

create index if not exists exam_sessions_user_status_started_idx
  on public.exam_sessions (user_id, status, started_at desc);

create index if not exists exam_sessions_user_mode_created_idx
  on public.exam_sessions (user_id, mode, created_at desc);

create index if not exists exam_session_answers_session_order_idx
  on public.exam_session_answers (exam_session_id, question_order asc);

create index if not exists exam_session_answers_user_answered_idx
  on public.exam_session_answers (user_id, answered_at desc);

create index if not exists bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);

create index if not exists ai_messages_user_conversation_idx
  on public.ai_messages (user_id, conversation_id, message_order asc);

create index if not exists ai_messages_question_idx
  on public.ai_messages (question_id, created_at desc)
  where question_id is not null;

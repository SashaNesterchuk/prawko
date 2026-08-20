-- V2 is deliberately parallel to v1. Do not alter or delete v1 tables/data.

create table if not exists public.question_sets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(btrim(key)) > 0),
  country_code text not null check (length(country_code) = 2),
  source_name text not null,
  source_version text,
  exam_config jsonb not null default '{}'::jsonb check (jsonb_typeof(exam_config) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.question_topic_catalog_v2 (
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  topic_id text not null,
  sort_order integer not null check (sort_order > 0),
  titles jsonb not null default '{}'::jsonb check (jsonb_typeof(titles) = 'object'),
  source_label text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (question_set_id, topic_id)
);

create table if not exists public.questions_v2 (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  source_id text not null check (length(btrim(source_id)) > 0),
  source_row_number integer not null check (source_row_number > 0),
  points smallint not null check (points > 0),
  answer_kind text not null check (answer_kind in ('boolean', 'choice')),
  correct_option_id text not null check (length(btrim(correct_option_id)) > 0),
  category_codes text[] not null default '{}'::text[],
  primary_topic_id text,
  topic_ids text[] not null default '{}'::text[],
  scope text,
  difficulty_seed smallint check (difficulty_seed between 1 and 100),
  is_active boolean not null default true,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  official_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(official_metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (question_set_id, source_id),
  unique (question_set_id, source_row_number)
);

create table if not exists public.question_ai_explanations_v2 (
  question_id uuid primary key references public.questions_v2(id) on delete cascade,
  explanations jsonb not null check (jsonb_typeof(explanations) = 'object'),
  available_locales text[] not null default '{}'::text[] check (coalesce(array_length(available_locales, 1), 0) > 0),
  explanation_version text not null,
  source_context_version text,
  source_context_updated_at timestamptz,
  provider text,
  model text,
  confidence double precision check (confidence is null or confidence between 0 and 1),
  needs_manual_review boolean not null default false,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.question_attempts_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions_v2(id) on delete cascade,
  selected_answer text not null check (length(btrim(selected_answer)) > 0),
  is_correct boolean not null,
  mode text not null check (length(btrim(mode)) > 0),
  question_locale text,
  answer_duration_ms integer check (answer_duration_ms is null or answer_duration_ms >= 0),
  explanation_opened boolean not null default false,
  ai_chat_used boolean not null default false,
  answered_at timestamptz not null default timezone('utc', now()),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.question_user_state_v2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions_v2(id) on delete cascade,
  times_seen integer not null default 0 check (times_seen >= 0),
  times_correct integer not null default 0 check (times_correct >= 0),
  times_wrong integer not null default 0 check (times_wrong >= 0),
  consecutive_correct integer not null default 0 check (consecutive_correct >= 0),
  last_seen_at timestamptz,
  last_correct_at timestamptz,
  last_wrong_at timestamptz,
  review_due_at timestamptz,
  is_mastered boolean not null default false,
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  is_hard boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, question_id)
);

create table if not exists public.bookmarks_v2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions_v2(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  saved_from_mode text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  primary key (user_id, question_id)
);

create table if not exists public.exam_sessions_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_set_id uuid not null references public.question_sets(id),
  question_ids uuid[] not null,
  mode text not null default 'exam',
  current_category text,
  session_locale text,
  current_question_index smallint not null default 1 check (current_question_index > 0),
  total_questions_answered smallint not null default 0 check (total_questions_answered >= 0),
  correct_answers_count smallint not null default 0 check (correct_answers_count >= 0),
  wrong_answers_count smallint not null default 0 check (wrong_answers_count >= 0),
  passed boolean,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned', 'expired')),
  total_questions_target smallint not null check (total_questions_target > 0),
  total_points_target smallint not null check (total_points_target > 0),
  pass_points smallint not null check (pass_points between 0 and total_points_target),
  score_points smallint not null default 0,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.exam_session_answers_v2 (
  id uuid primary key default gen_random_uuid(),
  exam_session_id uuid not null references public.exam_sessions_v2(id) on delete cascade,
  question_id uuid not null references public.questions_v2(id) on delete cascade,
  question_order smallint not null check (question_order > 0),
  question_attempt_id uuid references public.question_attempts_v2(id) on delete set null,
  answer_given text not null,
  is_correct boolean not null,
  points_awarded smallint not null default 0 check (points_awarded >= 0),
  answered_at timestamptz not null default timezone('utc', now()),
  unique (exam_session_id, question_order), unique (exam_session_id, question_id)
);

create index if not exists questions_v2_set_active_order_idx on public.questions_v2(question_set_id, is_active, source_row_number);
create index if not exists questions_v2_categories_gin_idx on public.questions_v2 using gin(category_codes);
create index if not exists question_attempts_v2_user_answered_idx on public.question_attempts_v2(user_id, answered_at desc);
create index if not exists question_user_state_v2_user_hard_idx on public.question_user_state_v2(user_id, is_hard) where is_hard;
create index if not exists bookmarks_v2_user_created_idx on public.bookmarks_v2(user_id, created_at desc);
create index if not exists exam_sessions_v2_user_status_idx on public.exam_sessions_v2(user_id, status, started_at desc);
create index if not exists exam_session_answers_v2_session_order_idx on public.exam_session_answers_v2(exam_session_id, question_order);

do $$ declare t text; begin
  foreach t in array array['question_sets','question_topic_catalog_v2','questions_v2','question_ai_explanations_v2','question_attempts_v2','question_user_state_v2','bookmarks_v2','exam_sessions_v2','exam_session_answers_v2'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

grant select on public.question_sets, public.question_topic_catalog_v2, public.questions_v2, public.question_ai_explanations_v2 to anon, authenticated;
grant all on public.question_sets, public.question_topic_catalog_v2, public.questions_v2, public.question_ai_explanations_v2, public.question_attempts_v2, public.question_user_state_v2, public.bookmarks_v2, public.exam_sessions_v2, public.exam_session_answers_v2 to service_role;

create policy questions_v2_read_active on public.questions_v2 for select to anon, authenticated using (is_active and exists (select 1 from public.question_sets s where s.id = question_set_id and s.is_active));
create policy question_sets_read_active on public.question_sets for select to anon, authenticated using (is_active);
create policy question_topics_v2_read_active on public.question_topic_catalog_v2 for select to anon, authenticated using (is_active);
create policy question_ai_explanations_v2_read_active on public.question_ai_explanations_v2 for select to anon, authenticated using (exists (select 1 from public.questions_v2 q where q.id = question_id and q.is_active));

grant select, insert, update, delete on public.question_attempts_v2, public.question_user_state_v2, public.bookmarks_v2, public.exam_sessions_v2, public.exam_session_answers_v2 to authenticated;

create policy question_attempts_v2_own on public.question_attempts_v2 for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy question_user_state_v2_own on public.question_user_state_v2 for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy bookmarks_v2_own on public.bookmarks_v2 for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exam_sessions_v2_own on public.exam_sessions_v2 for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy exam_session_answers_v2_own on public.exam_session_answers_v2 for all to authenticated using (exists (select 1 from public.exam_sessions_v2 s where s.id = exam_session_id and s.user_id = auth.uid())) with check (exists (select 1 from public.exam_sessions_v2 s where s.id = exam_session_id and s.user_id = auth.uid()));

drop trigger if exists set_question_sets_v2_updated_at on public.question_sets;
create trigger set_question_sets_v2_updated_at before update on public.question_sets for each row execute function public.set_updated_at();
drop trigger if exists set_question_topic_catalog_v2_updated_at on public.question_topic_catalog_v2;
create trigger set_question_topic_catalog_v2_updated_at before update on public.question_topic_catalog_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_questions_v2_updated_at on public.questions_v2;
create trigger set_questions_v2_updated_at before update on public.questions_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_question_ai_explanations_v2_updated_at on public.question_ai_explanations_v2;
create trigger set_question_ai_explanations_v2_updated_at before update on public.question_ai_explanations_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_question_user_state_v2_updated_at on public.question_user_state_v2;
create trigger set_question_user_state_v2_updated_at before update on public.question_user_state_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_bookmarks_v2_updated_at on public.bookmarks_v2;
create trigger set_bookmarks_v2_updated_at before update on public.bookmarks_v2 for each row execute function public.set_updated_at();
drop trigger if exists set_exam_sessions_v2_updated_at on public.exam_sessions_v2;
create trigger set_exam_sessions_v2_updated_at before update on public.exam_sessions_v2 for each row execute function public.set_updated_at();

-- All v2 write APIs deliberately require a question-set key.  A source id is
-- unique only inside a national catalogue, so accepting it on its own would
-- eventually write an attempt to the wrong country's question.
create or replace function public.find_question_v2_id(
  p_question_set_key text,
  p_source_id text
)
returns uuid
language sql
stable
set search_path = public
as $$
  select q.id
  from public.questions_v2 q
  join public.question_sets s on s.id = q.question_set_id
  where s.key = p_question_set_key
    and s.is_active
    and q.source_id = p_source_id
    and q.is_active
  limit 1;
$$;

create or replace function public.recompute_question_user_state_v2(
  p_user_id uuid,
  p_question_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_seen integer;
  v_correct integer;
  v_wrong integer;
  v_consecutive integer;
  v_last_seen timestamptz;
  v_last_correct timestamptz;
  v_last_wrong timestamptz;
begin
  select count(*)::integer,
         count(*) filter (where is_correct)::integer,
         count(*) filter (where not is_correct)::integer,
         max(answered_at),
         max(answered_at) filter (where is_correct),
         max(answered_at) filter (where not is_correct)
    into v_seen, v_correct, v_wrong, v_last_seen, v_last_correct, v_last_wrong
  from public.question_attempts_v2
  where user_id = p_user_id and question_id = p_question_id;

  select count(*)::integer into v_consecutive
  from (
    select is_correct,
           sum(case when not is_correct then 1 else 0 end) over (order by answered_at desc, id desc) as wrong_group
    from public.question_attempts_v2
    where user_id = p_user_id and question_id = p_question_id
  ) recent
  where wrong_group = 0 and is_correct;

  insert into public.question_user_state_v2 (
    user_id, question_id, times_seen, times_correct, times_wrong,
    consecutive_correct, last_seen_at, last_correct_at, last_wrong_at,
    is_mastered, mastery_score
  ) values (
    p_user_id, p_question_id, coalesce(v_seen, 0), coalesce(v_correct, 0), coalesce(v_wrong, 0),
    coalesce(v_consecutive, 0), v_last_seen, v_last_correct, v_last_wrong,
    coalesce(v_seen, 0) >= 3 and coalesce(v_correct, 0)::numeric / greatest(v_seen, 1) >= .8,
    round((coalesce(v_correct, 0)::numeric / greatest(v_seen, 1)) * 100, 2)
  ) on conflict (user_id, question_id) do update set
    times_seen = excluded.times_seen,
    times_correct = excluded.times_correct,
    times_wrong = excluded.times_wrong,
    consecutive_correct = excluded.consecutive_correct,
    last_seen_at = excluded.last_seen_at,
    last_correct_at = excluded.last_correct_at,
    last_wrong_at = excluded.last_wrong_at,
    is_mastered = excluded.is_mastered,
    mastery_score = excluded.mastery_score;
end;
$$;

create or replace function public.sync_question_user_state_after_attempt_v2()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  perform public.recompute_question_user_state_v2(new.user_id, new.question_id);
  return new;
end;
$$;

drop trigger if exists sync_question_user_state_after_attempt_v2 on public.question_attempts_v2;
create trigger sync_question_user_state_after_attempt_v2
after insert on public.question_attempts_v2
for each row execute function public.sync_question_user_state_after_attempt_v2();

create or replace function public.record_question_attempt_by_source_id_v2(
  p_question_set_key text,
  p_question_source_id text,
  p_mode text,
  p_answer_given text,
  p_is_correct boolean,
  p_question_locale text default null,
  p_answer_duration_ms integer default null,
  p_explanation_opened boolean default false,
  p_ai_chat_used boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_question_id uuid;
  v_attempt_id uuid;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Attempt metadata must be a JSON object.' using errcode = '22023'; end if;
  v_question_id := public.find_question_v2_id(p_question_set_key, p_question_source_id);
  if v_question_id is null then raise exception 'Question source id "%" was not found for set "%".', p_question_source_id, p_question_set_key using errcode = 'P0002'; end if;
  insert into public.question_attempts_v2(user_id, question_id, selected_answer, is_correct, mode, question_locale, answer_duration_ms, explanation_opened, ai_chat_used, metadata)
  values (v_user_id, v_question_id, btrim(p_answer_given), p_is_correct, p_mode, p_question_locale, p_answer_duration_ms, p_explanation_opened, p_ai_chat_used, p_metadata)
  returning id into v_attempt_id;
  return v_attempt_id;
end;
$$;

create or replace function public.set_question_bookmark_state_by_source_id_v2(
  p_question_set_key text, p_question_source_id text, p_is_bookmarked boolean,
  p_saved_from_mode text default null, p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_question_id uuid; v_bookmark_id uuid;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Bookmark metadata must be a JSON object.' using errcode = '22023'; end if;
  v_question_id := public.find_question_v2_id(p_question_set_key, p_question_source_id);
  if v_question_id is null then raise exception 'Question source id was not found.' using errcode = 'P0002'; end if;
  if p_is_bookmarked then
    insert into public.bookmarks_v2(user_id, question_id, saved_from_mode, metadata)
    values(v_user_id, v_question_id, p_saved_from_mode, p_metadata)
    on conflict(user_id, question_id) do update set saved_from_mode = excluded.saved_from_mode, metadata = excluded.metadata
    returning id into v_bookmark_id;
  else
    delete from public.bookmarks_v2 where user_id = v_user_id and question_id = v_question_id returning id into v_bookmark_id;
  end if;
  return v_bookmark_id;
end;
$$;

create or replace function public.set_question_hard_state_by_source_id_v2(
  p_question_set_key text, p_question_source_id text, p_is_hard boolean,
  p_review_due_at timestamptz default null
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_question_id uuid;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  v_question_id := public.find_question_v2_id(p_question_set_key, p_question_source_id);
  if v_question_id is null then raise exception 'Question source id was not found.' using errcode = 'P0002'; end if;
  insert into public.question_user_state_v2(user_id, question_id, is_hard, review_due_at)
  values(v_user_id, v_question_id, p_is_hard, case when p_is_hard then coalesce(p_review_due_at, timezone('utc', now())) else null end)
  on conflict(user_id, question_id) do update set is_hard = excluded.is_hard, review_due_at = excluded.review_due_at;
  return v_question_id;
end;
$$;

create or replace function public.recompute_exam_session_v2(p_exam_session_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_answered integer; v_correct integer; v_score integer; v_total integer;
begin
  select count(*)::integer, count(*) filter (where is_correct)::integer, coalesce(sum(points_awarded), 0)::integer
    into v_answered, v_correct, v_score from public.exam_session_answers_v2 where exam_session_id = p_exam_session_id;
  select total_questions_target into v_total from public.exam_sessions_v2 where id = p_exam_session_id;
  update public.exam_sessions_v2 set
    total_questions_answered = coalesce(v_answered, 0),
    correct_answers_count = coalesce(v_correct, 0),
    wrong_answers_count = coalesce(v_answered, 0) - coalesce(v_correct, 0),
    score_points = coalesce(v_score, 0),
    current_question_index = least(coalesce(v_answered, 0) + 1, v_total + 1),
    status = case when coalesce(v_answered, 0) >= v_total then 'completed' else status end,
    finished_at = case when coalesce(v_answered, 0) >= v_total then coalesce(finished_at, timezone('utc', now())) else finished_at end,
    passed = case when coalesce(v_answered, 0) >= v_total then coalesce(v_score, 0) >= pass_points else null end
  where id = p_exam_session_id;
end;
$$;

create or replace function public.sync_exam_session_after_answer_v2()
returns trigger language plpgsql security invoker set search_path = public as $$
begin perform public.recompute_exam_session_v2(new.exam_session_id); return new; end;
$$;
drop trigger if exists sync_exam_session_after_answer_v2 on public.exam_session_answers_v2;
create trigger sync_exam_session_after_answer_v2 after insert on public.exam_session_answers_v2 for each row execute function public.sync_exam_session_after_answer_v2();

create or replace function public.get_exam_session_snapshot_v2(p_exam_session_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_snapshot jsonb;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  update public.exam_sessions_v2 set status = 'expired', finished_at = coalesce(finished_at, expires_at)
   where id = p_exam_session_id and user_id = v_user_id and status = 'active' and expires_at is not null and expires_at <= timezone('utc', now());
  select jsonb_build_object(
    'session', jsonb_build_object(
      'id', s.id, 'mode', s.mode, 'status', s.status, 'sessionLocale', s.session_locale,
      'currentCategory', coalesce(s.current_category, ''), 'currentQuestionIndex', s.current_question_index,
      'totalQuestionsTarget', s.total_questions_target, 'totalQuestionsAnswered', s.total_questions_answered,
      'totalPointsTarget', s.total_points_target, 'passPoints', s.pass_points, 'scorePoints', s.score_points,
      'correctAnswersCount', s.correct_answers_count, 'wrongAnswersCount', s.wrong_answers_count, 'passed', s.passed,
      'startedAt', s.started_at, 'finishedAt', s.finished_at, 'expiresAt', s.expires_at,
      'remainingSeconds', case when s.expires_at is null then null else greatest(0, floor(extract(epoch from (s.expires_at - timezone('utc', now()))))::integer) end,
      'studyPlanId', null, 'metadata', s.metadata
    ),
    'questions', coalesce((select jsonb_agg(jsonb_build_object('order', chosen.ordinality, 'questionId', q.id, 'questionSourceId', q.source_id, 'scope', coalesce(q.scope, 'base'), 'points', q.points) order by chosen.ordinality)
      from unnest(s.question_ids) with ordinality as chosen(question_id, ordinality) join public.questions_v2 q on q.id = chosen.question_id), '[]'::jsonb),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('order', a.question_order, 'questionId', a.question_id, 'questionSourceId', q.source_id, 'answerGiven', a.answer_given, 'isCorrect', a.is_correct, 'pointsAwarded', a.points_awarded, 'answeredAt', a.answered_at, 'questionAttemptId', a.question_attempt_id) order by a.question_order)
      from public.exam_session_answers_v2 a join public.questions_v2 q on q.id = a.question_id where a.exam_session_id = s.id), '[]'::jsonb),
    'wrongQuestionSourceIds', coalesce((select jsonb_agg(q.source_id order by a.question_order) from public.exam_session_answers_v2 a join public.questions_v2 q on q.id = a.question_id where a.exam_session_id = s.id and not a.is_correct), '[]'::jsonb)
  ) into v_snapshot from public.exam_sessions_v2 s where s.id = p_exam_session_id and s.user_id = v_user_id;
  if v_snapshot is null then raise exception 'Exam session was not found for the current user.' using errcode = 'P0002'; end if;
  return v_snapshot;
end;
$$;

create or replace function public.start_exam_session_v2(
  p_question_set_key text, p_mode text, p_session_locale text default 'ua',
  p_current_category text default 'B', p_requested_total_questions integer default null,
  p_metadata jsonb default '{}'::jsonb, p_replace_existing boolean default false
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_set_id uuid; v_existing uuid; v_session_id uuid := gen_random_uuid();
  v_target integer; v_question_ids uuid[]; v_total_points integer; v_pass_points integer; v_pass_ratio numeric := 68.0 / 74.0;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_mode not in ('exam', 'mini_test', 'exam_tomorrow') then raise exception 'Unsupported exam mode.' using errcode = '22023'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Exam metadata must be a JSON object.' using errcode = '22023'; end if;
  if p_requested_total_questions is not null and p_requested_total_questions not between 1 and 64 then raise exception 'Requested question count must be between 1 and 64.' using errcode = '22023'; end if;
  select id, coalesce(nullif(exam_config ->> 'pass_ratio', '')::numeric, v_pass_ratio)
    into v_set_id, v_pass_ratio
  from public.question_sets where key = p_question_set_key and is_active;
  if v_set_id is null then raise exception 'Question set "%" was not found.', p_question_set_key using errcode = 'P0002'; end if;
  update public.exam_sessions_v2 set status = 'expired', finished_at = coalesce(finished_at, expires_at)
   where user_id = v_user_id and question_set_id = v_set_id and status = 'active' and expires_at <= timezone('utc', now());
  select id into v_existing from public.exam_sessions_v2 where user_id = v_user_id and question_set_id = v_set_id and mode = p_mode and status = 'active' order by started_at desc limit 1;
  if v_existing is not null and not p_replace_existing then return public.get_exam_session_snapshot_v2(v_existing); end if;
  if v_existing is not null then update public.exam_sessions_v2 set status = 'abandoned', finished_at = timezone('utc', now()) where id = v_existing; end if;
  v_target := coalesce(p_requested_total_questions, case when p_mode = 'mini_test' then 12 else 32 end);
  select array_agg(id order by ranking), count(*)::integer, coalesce(sum(points), 0)::integer into v_question_ids, v_target, v_total_points from (
    select id, points, row_number() over (order by md5(id::text || v_user_id::text || timezone('utc', now())::date::text)) as ranking
    from public.questions_v2 where question_set_id = v_set_id and is_active and (coalesce(array_length(category_codes, 1), 0) = 0 or p_current_category = any(category_codes)) limit v_target
  ) selected;
  if coalesce(array_length(v_question_ids, 1), 0) = 0 then raise exception 'No active questions are available for this category.' using errcode = 'P0002'; end if;
  -- Round so the Polish 68/74 ratio keeps its existing 68-point threshold.
  v_pass_points := greatest(1, round(v_total_points * v_pass_ratio)::integer);
  insert into public.exam_sessions_v2(id, user_id, question_set_id, question_ids, mode, current_category, session_locale, total_questions_target, total_points_target, pass_points, started_at, expires_at, metadata)
  values(v_session_id, v_user_id, v_set_id, v_question_ids, p_mode, p_current_category, p_session_locale, v_target, v_total_points, v_pass_points, timezone('utc', now()), timezone('utc', now()) + make_interval(mins => greatest(5, ceil(v_target * 25.0 / 32)::integer)), p_metadata || jsonb_build_object('question_set_key', p_question_set_key));
  return public.get_exam_session_snapshot_v2(v_session_id);
end;
$$;

create or replace function public.submit_exam_session_answer_v2(
  p_exam_session_id uuid, p_answer_given text, p_question_locale text default null,
  p_answer_duration_ms integer default null, p_metadata jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_session public.exam_sessions_v2%rowtype; v_question public.questions_v2%rowtype; v_order smallint; v_answer text; v_correct boolean; v_attempt uuid;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Exam answer metadata must be a JSON object.' using errcode = '22023'; end if;
  select * into v_session from public.exam_sessions_v2 where id = p_exam_session_id and user_id = v_user_id for update;
  if not found then raise exception 'Exam session was not found for the current user.' using errcode = 'P0002'; end if;
  if v_session.status <> 'active' then return public.get_exam_session_snapshot_v2(v_session.id); end if;
  if v_session.expires_at is not null and v_session.expires_at <= timezone('utc', now()) then update public.exam_sessions_v2 set status = 'expired', finished_at = timezone('utc', now()) where id = v_session.id; return public.get_exam_session_snapshot_v2(v_session.id); end if;
  v_order := v_session.current_question_index;
  select * into v_question from public.questions_v2 where id = v_session.question_ids[v_order] and is_active;
  if not found then raise exception 'Current exam question is not available.' using errcode = 'P0002'; end if;
  if exists(select 1 from public.exam_session_answers_v2 where exam_session_id = v_session.id and question_order = v_order) then return public.get_exam_session_snapshot_v2(v_session.id); end if;
  v_answer := case when v_question.answer_kind = 'boolean' then lower(btrim(p_answer_given)) else upper(btrim(p_answer_given)) end;
  if v_answer = '' or (v_question.answer_kind = 'boolean' and v_answer not in ('true', 'false')) then raise exception 'Invalid answer.' using errcode = '22023'; end if;
  v_correct := v_question.correct_option_id = v_answer;
  insert into public.question_attempts_v2(user_id, question_id, selected_answer, is_correct, mode, question_locale, answer_duration_ms, metadata)
  values(v_user_id, v_question.id, v_answer, v_correct, v_session.mode, p_question_locale, p_answer_duration_ms, p_metadata || jsonb_build_object('exam_session_id', v_session.id)) returning id into v_attempt;
  insert into public.exam_session_answers_v2(exam_session_id, question_id, question_attempt_id, question_order, answer_given, is_correct, points_awarded)
  values(v_session.id, v_question.id, v_attempt, v_order, v_answer, v_correct, case when v_correct then v_question.points else 0 end);
  return public.get_exam_session_snapshot_v2(v_session.id);
end;
$$;

create or replace function public.get_latest_active_exam_session_v2(p_question_set_key text, p_mode text default null)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_session_id uuid;
begin
  select e.id into v_session_id from public.exam_sessions_v2 e join public.question_sets s on s.id = e.question_set_id
   where e.user_id = auth.uid() and s.key = p_question_set_key and e.status = 'active' and (p_mode is null or e.mode = p_mode) order by e.started_at desc limit 1;
  if v_session_id is null then return null; end if;
  return public.get_exam_session_snapshot_v2(v_session_id);
end;
$$;

create or replace function public.list_recent_exam_sessions_v2(p_question_set_key text, p_limit integer default 5)
returns jsonb language sql security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'mode', e.mode, 'status', e.status, 'sessionLocale', e.session_locale,
    'currentCategory', e.current_category, 'currentQuestionIndex', e.current_question_index,
    'totalQuestionsTarget', e.total_questions_target, 'totalQuestionsAnswered', e.total_questions_answered,
    'totalPointsTarget', e.total_points_target, 'passPoints', e.pass_points, 'scorePoints', e.score_points,
    'correctAnswersCount', e.correct_answers_count, 'wrongAnswersCount', e.wrong_answers_count,
    'passed', e.passed, 'startedAt', e.started_at, 'finishedAt', e.finished_at, 'expiresAt', e.expires_at,
    'remainingSeconds', null, 'studyPlanId', null, 'metadata', e.metadata) order by e.started_at desc), '[]'::jsonb)
  from (select e.* from public.exam_sessions_v2 e join public.question_sets s on s.id = e.question_set_id where e.user_id = auth.uid() and s.key = p_question_set_key order by e.started_at desc limit greatest(1, least(p_limit, 50))) e;
$$;

create or replace function public.set_exam_session_status_v2(p_exam_session_id uuid, p_status text, p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_status not in ('abandoned', 'expired') then raise exception 'Only abandoned or expired may be set manually.' using errcode = '22023'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Exam metadata must be a JSON object.' using errcode = '22023'; end if;
  update public.exam_sessions_v2 set status = case when status = 'completed' then status else p_status end, finished_at = case when status = 'completed' then finished_at else coalesce(finished_at, timezone('utc', now())) end, metadata = metadata || p_metadata where id = p_exam_session_id and user_id = auth.uid();
  if not found then raise exception 'Exam session was not found for the current user.' using errcode = 'P0002'; end if;
  return public.get_exam_session_snapshot_v2(p_exam_session_id);
end;
$$;

grant execute on function public.record_question_attempt_by_source_id_v2(text,text,text,text,boolean,text,integer,boolean,boolean,jsonb), public.set_question_bookmark_state_by_source_id_v2(text,text,boolean,text,jsonb), public.set_question_hard_state_by_source_id_v2(text,text,boolean,timestamptz), public.get_exam_session_snapshot_v2(uuid), public.start_exam_session_v2(text,text,text,text,integer,jsonb,boolean), public.submit_exam_session_answer_v2(uuid,text,text,integer,jsonb), public.get_latest_active_exam_session_v2(text,text), public.list_recent_exam_sessions_v2(text,integer), public.set_exam_session_status_v2(uuid,text,jsonb) to authenticated;

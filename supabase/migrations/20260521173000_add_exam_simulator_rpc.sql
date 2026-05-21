create or replace function public.get_exam_total_questions_target(
  p_mode public.attempt_mode,
  p_requested_total_questions integer default null
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_mode not in ('exam', 'mini_test', 'exam_tomorrow') then
    raise exception 'Exam mode "%" is not supported for simulator.', p_mode
      using errcode = '22023';
  end if;

  if p_requested_total_questions is not null then
    if p_requested_total_questions < 1 or p_requested_total_questions > 64 then
      raise exception 'Requested exam question count must be between 1 and 64.'
        using errcode = '22023';
    end if;

    return p_requested_total_questions;
  end if;

  if p_mode = 'mini_test' then
    return 12;
  end if;

  return 32;
end;
$$;

create or replace function public.get_exam_duration_minutes(
  p_total_questions integer
)
returns integer
language sql
immutable
set search_path = public
as $$
  select greatest(5, ceil((greatest(1, p_total_questions)::numeric * 25) / 32))::integer;
$$;

create or replace function public.expire_exam_session_if_needed(
  p_exam_session_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  update public.exam_sessions
  set
    status = 'expired',
    finished_at = coalesce(finished_at, expires_at, timezone('utc', now())),
    metadata = metadata || jsonb_build_object(
      'expired_at',
      timezone('utc', now())
    ),
    updated_at = timezone('utc', now())
  where id = p_exam_session_id
    and user_id = v_user_id
    and status = 'active'
    and expires_at is not null
    and expires_at <= timezone('utc', now());
end;
$$;

create or replace function public.get_exam_session_snapshot(
  p_exam_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot jsonb;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  perform public.expire_exam_session_if_needed(p_exam_session_id);

  select jsonb_build_object(
    'session',
    jsonb_build_object(
      'id',
      s.id,
      'mode',
      s.mode,
      'status',
      s.status,
      'sessionLocale',
      s.session_locale,
      'currentCategory',
      s.current_category,
      'currentQuestionIndex',
      s.current_question_index,
      'totalQuestionsTarget',
      s.total_questions_target,
      'totalQuestionsAnswered',
      s.total_questions_answered,
      'totalPointsTarget',
      s.total_points_target,
      'passPoints',
      s.pass_points,
      'scorePoints',
      s.score_points,
      'correctAnswersCount',
      s.correct_answers_count,
      'wrongAnswersCount',
      s.wrong_answers_count,
      'passed',
      s.passed,
      'startedAt',
      s.started_at,
      'finishedAt',
      s.finished_at,
      'expiresAt',
      s.expires_at,
      'remainingSeconds',
      case
        when s.expires_at is null then null
        else greatest(
          0,
          floor(extract(epoch from (s.expires_at - timezone('utc', now()))))
        )::integer
      end,
      'studyPlanId',
      s.study_plan_id,
      'metadata',
      s.metadata
    ),
    'questions',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'order',
            selected.question_order,
            'questionId',
            q.id,
            'questionSourceId',
            q.question_source_id,
            'scope',
            q.scope,
            'points',
            q.points
          )
          order by selected.question_order
        )
        from unnest(s.question_ids) with ordinality as selected(question_id, question_order)
        join public.questions q on q.id = selected.question_id
      ),
      '[]'::jsonb
    ),
    'answers',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'order',
            a.question_order,
            'questionId',
            a.question_id,
            'questionSourceId',
            q.question_source_id,
            'answerGiven',
            a.answer_given,
            'isCorrect',
            a.is_correct,
            'pointsAwarded',
            a.points_awarded,
            'answeredAt',
            a.answered_at,
            'questionAttemptId',
            a.question_attempt_id
          )
          order by a.question_order
        )
        from public.exam_session_answers a
        join public.questions q on q.id = a.question_id
        where a.exam_session_id = s.id
      ),
      '[]'::jsonb
    ),
    'wrongQuestionSourceIds',
    coalesce(
      (
        select jsonb_agg(q.question_source_id order by a.question_order)
        from public.exam_session_answers a
        join public.questions q on q.id = a.question_id
        where a.exam_session_id = s.id
          and a.is_correct = false
      ),
      '[]'::jsonb
    )
  )
  into v_snapshot
  from public.exam_sessions s
  where s.id = p_exam_session_id
    and s.user_id = v_user_id;

  if v_snapshot is null then
    raise exception 'Exam session "%" was not found for the current user.', p_exam_session_id
      using errcode = 'P0002';
  end if;

  return v_snapshot;
end;
$$;

create or replace function public.get_latest_active_exam_session(
  p_mode public.attempt_mode default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_mode is not null and p_mode not in ('exam', 'mini_test', 'exam_tomorrow') then
    raise exception 'Exam mode "%" is not supported for simulator.', p_mode
      using errcode = '22023';
  end if;

  update public.exam_sessions
  set
    status = 'expired',
    finished_at = coalesce(finished_at, expires_at, timezone('utc', now())),
    metadata = metadata || jsonb_build_object(
      'expired_at',
      timezone('utc', now())
    ),
    updated_at = timezone('utc', now())
  where user_id = v_user_id
    and status = 'active'
    and mode in ('exam', 'mini_test', 'exam_tomorrow')
    and (p_mode is null or mode = p_mode)
    and expires_at is not null
    and expires_at <= timezone('utc', now());

  select id
  into v_session_id
  from public.exam_sessions
  where user_id = v_user_id
    and status = 'active'
    and mode in ('exam', 'mini_test', 'exam_tomorrow')
    and (p_mode is null or mode = p_mode)
  order by started_at desc
  limit 1;

  if v_session_id is null then
    return null;
  end if;

  return public.get_exam_session_snapshot(v_session_id);
end;
$$;

create or replace function public.start_exam_session(
  p_mode public.attempt_mode,
  p_session_locale public.app_locale default 'ua',
  p_current_category public.driving_category default 'B',
  p_requested_total_questions integer default null,
  p_study_plan_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_replace_existing boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_existing_session_id uuid;
  v_new_session_id uuid := gen_random_uuid();
  v_total_questions_target integer;
  v_base_target integer;
  v_specialist_target integer;
  v_question_ids uuid[];
  v_missing_bucket_count integer := 0;
  v_selected_count integer := 0;
  v_total_points integer := 0;
  v_pass_points integer := 0;
  v_duration_minutes integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_mode not in ('exam', 'mini_test', 'exam_tomorrow') then
    raise exception 'Exam mode "%" is not supported for simulator.', p_mode
      using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Exam session metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  if p_study_plan_id is not null
    and not exists (
      select 1
      from public.study_plans
      where id = p_study_plan_id
        and user_id = v_user_id
    )
  then
    raise exception 'Study plan "%" does not belong to the current user.', p_study_plan_id
      using errcode = '42501';
  end if;

  v_total_questions_target := public.get_exam_total_questions_target(
    p_mode,
    p_requested_total_questions
  );
  v_base_target := least(
    v_total_questions_target,
    greatest(
      0,
      round((v_total_questions_target::numeric * 20) / 32)::integer
    )
  );
  v_specialist_target := greatest(0, v_total_questions_target - v_base_target);

  update public.exam_sessions
  set
    status = 'expired',
    finished_at = coalesce(finished_at, expires_at, v_now),
    metadata = metadata || jsonb_build_object(
      'expired_at',
      v_now
    ),
    updated_at = v_now
  where user_id = v_user_id
    and status = 'active'
    and mode = p_mode
    and expires_at is not null
    and expires_at <= v_now;

  select id
  into v_existing_session_id
  from public.exam_sessions
  where user_id = v_user_id
    and status = 'active'
    and mode = p_mode
  order by started_at desc
  limit 1;

  if v_existing_session_id is not null and not p_replace_existing then
    return public.get_exam_session_snapshot(v_existing_session_id);
  end if;

  if v_existing_session_id is not null and p_replace_existing then
    update public.exam_sessions
    set
      status = 'abandoned',
      finished_at = coalesce(finished_at, v_now),
      metadata = metadata || jsonb_build_object(
        'abandoned_at',
        v_now,
        'abandoned_reason',
        'restart_requested'
      ),
      updated_at = v_now
    where id = v_existing_session_id;
  end if;

  with scope_targets as (
    select
      'base'::public.question_scope as scope,
      v_base_target as target_count,
      20::integer as official_total
    union all
    select
      'specialist'::public.question_scope as scope,
      v_specialist_target as target_count,
      12::integer as official_total
  ),
  official_mix as (
    select 'base'::public.question_scope as scope, 3::smallint as points, 10::integer as weight
    union all
    select 'base'::public.question_scope, 2::smallint, 6::integer
    union all
    select 'base'::public.question_scope, 1::smallint, 4::integer
    union all
    select 'specialist'::public.question_scope, 3::smallint, 6::integer
    union all
    select 'specialist'::public.question_scope, 2::smallint, 4::integer
    union all
    select 'specialist'::public.question_scope, 1::smallint, 2::integer
  ),
  scaled_targets as (
    select
      mix.scope,
      mix.points,
      st.target_count,
      floor(
        (st.target_count::numeric * mix.weight::numeric) / st.official_total::numeric
      )::integer as floor_count,
      (
        (st.target_count::numeric * mix.weight::numeric) / st.official_total::numeric
      ) - floor(
        (st.target_count::numeric * mix.weight::numeric) / st.official_total::numeric
      ) as remainder
    from official_mix mix
    join scope_targets st on st.scope = mix.scope
  ),
  scope_remaining as (
    select
      scope,
      max(target_count) - sum(floor_count) as remaining
    from scaled_targets
    group by scope
  ),
  bucket_targets as (
    select
      st.scope,
      st.points,
      st.floor_count + case
        when row_number() over (
          partition by st.scope
          order by st.remainder desc, st.points desc
        ) <= sr.remaining
          then 1
        else 0
      end as target_count
    from scaled_targets st
    join scope_remaining sr on sr.scope = st.scope
  ),
  candidate_pool as (
    select
      q.id,
      q.question_source_id,
      q.scope,
      q.points,
      q.difficulty_seed,
      coalesce(state.times_seen, 0) as times_seen,
      coalesce(state.times_wrong, 0) as times_wrong,
      state.review_due_at
    from public.questions q
    left join public.question_user_state state
      on state.question_id = q.id
      and state.user_id = v_user_id
    where q.is_active = true
      and p_current_category::text = any(q.categories)
      and q.scope in ('base', 'specialist')
  ),
  pool_counts as (
    select
      scope,
      points,
      count(*)::integer as available_count
    from candidate_pool
    group by scope, points
  ),
  missing_bucket as (
    select
      bt.scope,
      bt.points,
      bt.target_count,
      coalesce(pc.available_count, 0) as available_count
    from bucket_targets bt
    left join pool_counts pc
      on pc.scope = bt.scope
      and pc.points = bt.points
    where bt.target_count > coalesce(pc.available_count, 0)
  ),
  ranked_pool as (
    select
      pool.id,
      pool.scope,
      pool.points,
      row_number() over (
        partition by pool.scope, pool.points
        order by
          (
            pool.difficulty_seed
            - case
              when pool.times_seen = 0 then 50
              else 0
            end
            - case
              when pool.review_due_at is not null and pool.review_due_at <= v_now
                then 10
              else 0
            end
            - (pool.times_wrong * 6)
            + (pool.times_seen * 2)
          ) asc,
          md5(pool.question_source_id || v_user_id::text || v_now::date::text)
      ) as bucket_rank
    from candidate_pool pool
  ),
  selected_questions as (
    select
      ranked.id,
      ranked.scope,
      ranked.points,
      row_number() over (
        order by
          case
            when ranked.scope = 'base' then 0
            else 1
          end,
          ranked.points desc,
          md5(ranked.id::text || v_user_id::text || v_now::text)
      ) as question_order
    from ranked_pool ranked
    join bucket_targets bt
      on bt.scope = ranked.scope
      and bt.points = ranked.points
    where ranked.bucket_rank <= bt.target_count
  )
  select
    array_agg(selected.id order by selected.question_order),
    count(*)::integer,
    coalesce(sum(selected.points), 0)::integer,
    (
      select count(*)::integer
      from missing_bucket
    )
  into
    v_question_ids,
    v_selected_count,
    v_total_points,
    v_missing_bucket_count
  from selected_questions selected;

  if v_missing_bucket_count > 0 then
    raise exception 'Not enough active questions to build the requested exam mix for category "%".', p_current_category
      using errcode = 'P0001';
  end if;

  if v_selected_count <> v_total_questions_target or v_question_ids is null then
    raise exception 'Exam generator produced "%" questions, expected "%".', v_selected_count, v_total_questions_target
      using errcode = 'P0001';
  end if;

  v_pass_points := greatest(
    1,
    round((v_total_points::numeric * 68) / 74)::integer
  );
  v_duration_minutes := public.get_exam_duration_minutes(v_total_questions_target);

  insert into public.exam_sessions (
    id,
    user_id,
    study_plan_id,
    mode,
    current_category,
    session_locale,
    status,
    question_ids,
    current_question_index,
    total_questions_target,
    total_questions_answered,
    total_points_target,
    pass_points,
    score_points,
    correct_answers_count,
    wrong_answers_count,
    passed,
    started_at,
    finished_at,
    expires_at,
    metadata
  )
  values (
    v_new_session_id,
    v_user_id,
    p_study_plan_id,
    p_mode,
    p_current_category,
    p_session_locale,
    'active',
    v_question_ids,
    1,
    v_total_questions_target,
    0,
    v_total_points,
    v_pass_points,
    0,
    0,
    0,
    null,
    v_now,
    null,
    v_now + make_interval(mins => v_duration_minutes),
    p_metadata || jsonb_build_object(
      'requested_total_questions',
      p_requested_total_questions,
      'generated_total_questions',
      v_total_questions_target,
      'generated_at',
      v_now
    )
  );

  return public.get_exam_session_snapshot(v_new_session_id);
end;
$$;

create or replace function public.submit_exam_session_answer(
  p_exam_session_id uuid,
  p_answer_given text,
  p_question_locale public.app_locale default null,
  p_answer_duration_ms integer default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.exam_sessions%rowtype;
  v_question public.questions%rowtype;
  v_question_order smallint;
  v_attempt_id uuid := gen_random_uuid();
  v_answer_given text;
  v_is_correct boolean;
  v_points_awarded smallint;
  v_study_plan_task_id uuid;
  v_study_plan_task_id_text text;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Exam answer metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  select *
  into v_session
  from public.exam_sessions
  where id = p_exam_session_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Exam session "%" was not found for the current user.', p_exam_session_id
      using errcode = 'P0002';
  end if;

  perform public.expire_exam_session_if_needed(v_session.id);

  select *
  into v_session
  from public.exam_sessions
  where id = p_exam_session_id
    and user_id = v_user_id
  for update;

  if v_session.status <> 'active' then
    return public.get_exam_session_snapshot(v_session.id);
  end if;

  v_question_order := v_session.current_question_index;

  if v_question_order < 1
    or v_question_order > coalesce(array_length(v_session.question_ids, 1), 0)
  then
    return public.get_exam_session_snapshot(v_session.id);
  end if;

  select *
  into v_question
  from public.questions
  where id = v_session.question_ids[v_question_order]
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Current exam question is not available anymore.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.exam_session_answers
    where exam_session_id = v_session.id
      and question_order = v_question_order
  ) then
    return public.get_exam_session_snapshot(v_session.id);
  end if;

  v_answer_given := case
    when v_question.answer_type = 'boolean'
      then lower(btrim(coalesce(p_answer_given, '')))
    else upper(btrim(coalesce(p_answer_given, '')))
  end;

  if length(v_answer_given) = 0 then
    raise exception 'Exam answer is required.'
      using errcode = '22023';
  end if;

  if (
    v_question.answer_type = 'boolean'
    and v_answer_given not in ('true', 'false')
  ) then
    raise exception 'Boolean question expects "true" or "false".'
      using errcode = '22023';
  end if;

  if (
    v_question.answer_type = 'abc'
    and v_answer_given not in ('A', 'B', 'C')
  ) then
    raise exception 'ABC question expects "A", "B", or "C".'
      using errcode = '22023';
  end if;

  v_is_correct := v_question.correct_answer = v_answer_given;
  v_points_awarded := case
    when v_is_correct then v_question.points
    else 0
  end;

  insert into public.question_attempts (
    id,
    user_id,
    question_id,
    study_plan_id,
    mode,
    question_locale,
    answer_given,
    is_correct,
    answer_duration_ms,
    explanation_opened,
    ai_chat_used,
    metadata
  )
  values (
    v_attempt_id,
    v_user_id,
    v_question.id,
    v_session.study_plan_id,
    v_session.mode,
    p_question_locale,
    v_answer_given,
    v_is_correct,
    p_answer_duration_ms,
    false,
    false,
    p_metadata || jsonb_build_object(
      'exam_session_id',
      v_session.id,
      'exam_question_order',
      v_question_order,
      'question_source_id',
      v_question.question_source_id
    )
  );

  insert into public.exam_session_answers (
    exam_session_id,
    user_id,
    question_id,
    question_attempt_id,
    question_order,
    question_scope,
    question_points,
    answer_given,
    is_correct,
    points_awarded,
    answer_duration_ms,
    answered_at,
    metadata
  )
  values (
    v_session.id,
    v_user_id,
    v_question.id,
    v_attempt_id,
    v_question_order,
    v_question.scope,
    v_question.points,
    v_answer_given,
    v_is_correct,
    v_points_awarded,
    p_answer_duration_ms,
    timezone('utc', now()),
    p_metadata
  );

  v_study_plan_task_id_text := nullif(
    trim(v_session.metadata ->> 'study_plan_task_id'),
    ''
  );

  if v_study_plan_task_id_text is not null then
    begin
      v_study_plan_task_id := v_study_plan_task_id_text::uuid;

      perform public.increment_study_plan_task_progress(
        v_study_plan_task_id,
        1::smallint
      );
    exception
      when invalid_text_representation then
        null;
      when sqlstate '42501' then
        null;
      when sqlstate 'P0002' then
        null;
    end;
  end if;

  return public.get_exam_session_snapshot(v_session.id);
end;
$$;

create or replace function public.set_exam_session_status(
  p_exam_session_id uuid,
  p_status public.exam_session_status,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_status not in ('abandoned', 'expired') then
    raise exception 'Only "abandoned" or "expired" can be set manually for exam sessions.'
      using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Exam session metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  update public.exam_sessions
  set
    status = case
      when status = 'completed' then status
      else p_status
    end,
    finished_at = case
      when status = 'completed' then finished_at
      else coalesce(finished_at, v_now)
    end,
    metadata = metadata || p_metadata || jsonb_build_object(
      'status_changed_at',
      v_now,
      'status_changed_to',
      p_status
    ),
    updated_at = v_now
  where id = p_exam_session_id
    and user_id = v_user_id;

  if not found then
    raise exception 'Exam session "%" was not found for the current user.', p_exam_session_id
      using errcode = 'P0002';
  end if;

  return public.get_exam_session_snapshot(p_exam_session_id);
end;
$$;

grant execute on function public.get_exam_total_questions_target(
  public.attempt_mode,
  integer
) to authenticated;

grant execute on function public.get_exam_duration_minutes(
  integer
) to authenticated;

grant execute on function public.get_exam_session_snapshot(
  uuid
) to authenticated;

grant execute on function public.get_latest_active_exam_session(
  public.attempt_mode
) to authenticated;

grant execute on function public.start_exam_session(
  public.attempt_mode,
  public.app_locale,
  public.driving_category,
  integer,
  uuid,
  jsonb,
  boolean
) to authenticated;

grant execute on function public.submit_exam_session_answer(
  uuid,
  text,
  public.app_locale,
  integer,
  jsonb
) to authenticated;

grant execute on function public.set_exam_session_status(
  uuid,
  public.exam_session_status,
  jsonb
) to authenticated;

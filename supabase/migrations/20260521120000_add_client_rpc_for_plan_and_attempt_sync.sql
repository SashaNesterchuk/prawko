create or replace function public.save_generated_study_plan(
  p_title text,
  p_current_category public.driving_category,
  p_plan_locale public.app_locale,
  p_level public.plan_level,
  p_exam_date date,
  p_days_planned smallint,
  p_minutes_per_day smallint,
  p_generator_version text,
  p_plan_snapshot jsonb,
  p_school_code text default null,
  p_generation_context jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid := gen_random_uuid();
  v_day_id uuid;
  v_day record;
  v_task record;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_plan_snapshot is null or jsonb_typeof(p_plan_snapshot) <> 'array' then
    raise exception 'Plan snapshot must be a JSON array.'
      using errcode = '22023';
  end if;

  if p_generation_context is null or jsonb_typeof(p_generation_context) <> 'object' then
    raise exception 'Generation context must be a JSON object.'
      using errcode = '22023';
  end if;

  update public.study_plans
  set
    status = 'abandoned',
    updated_at = timezone('utc', now())
  where user_id = v_user_id
    and status in ('draft', 'active', 'paused');

  insert into public.study_plans (
    id,
    user_id,
    title,
    status,
    current_category,
    plan_locale,
    level,
    exam_date,
    days_planned,
    minutes_per_day,
    generator_version,
    generation_context,
    plan_snapshot,
    started_at
  )
  values (
    v_plan_id,
    v_user_id,
    p_title,
    'active',
    p_current_category,
    p_plan_locale,
    p_level,
    p_exam_date,
    p_days_planned,
    p_minutes_per_day,
    p_generator_version,
    jsonb_strip_nulls(
      p_generation_context || jsonb_build_object('school_code', nullif(btrim(coalesce(p_school_code, '')), ''))
    ),
    p_plan_snapshot,
    timezone('utc', now())
  );

  for v_day in
    select day_item, ordinality
    from jsonb_array_elements(p_plan_snapshot) with ordinality as d(day_item, ordinality)
  loop
    v_day_id := gen_random_uuid();

    insert into public.study_plan_days (
      id,
      study_plan_id,
      user_id,
      plan_date,
      day_number,
      focus_topic,
      minimum_mode_enabled,
      readiness_score_snapshot
    )
    values (
      v_day_id,
      v_plan_id,
      v_user_id,
      (v_day.day_item ->> 'planDate')::date,
      coalesce((v_day.day_item ->> 'dayNumber')::smallint, v_day.ordinality::smallint),
      nullif(v_day.day_item ->> 'focusTopic', '')::public.topic_block,
      coalesce((v_day.day_item ->> 'minimumMode')::boolean, false),
      null
    );

    for v_task in
      select task_item, ordinality
      from jsonb_array_elements(coalesce(v_day.day_item -> 'tasks', '[]'::jsonb)) with ordinality as t(task_item, ordinality)
    loop
      insert into public.study_plan_tasks (
        id,
        study_plan_day_id,
        study_plan_id,
        user_id,
        task_type,
        title,
        description,
        sort_order,
        topic_block,
        question_count_target,
        estimated_minutes,
        metadata
      )
      values (
        gen_random_uuid(),
        v_day_id,
        v_plan_id,
        v_user_id,
        (v_task.task_item ->> 'taskType')::public.study_plan_task_type,
        coalesce(v_task.task_item ->> 'title', 'Task'),
        nullif(v_task.task_item ->> 'description', ''),
        coalesce((v_task.task_item ->> 'sortOrder')::smallint, v_task.ordinality::smallint),
        nullif(v_task.task_item ->> 'topicBlock', '')::public.topic_block,
        nullif(v_task.task_item ->> 'questionCountTarget', '')::smallint,
        nullif(v_task.task_item ->> 'estimatedMinutes', '')::smallint,
        jsonb_strip_nulls(
          jsonb_build_object(
            'client_day_id', v_day.day_item ->> 'id',
            'client_task_id', v_task.task_item ->> 'id',
            'counts_for_minimum', coalesce((v_task.task_item ->> 'countsForMinimum')::boolean, false)
          )
        )
      );
    end loop;
  end loop;

  update public.profiles
  set
    interface_locale = p_plan_locale,
    current_category = p_current_category,
    onboarding_completed = true,
    updated_at = timezone('utc', now()),
    metadata = jsonb_strip_nulls(
      coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'latest_study_plan_id', v_plan_id,
        'latest_generator_version', p_generator_version,
        'school_code', nullif(btrim(coalesce(p_school_code, '')), '')
      )
    )
  where id = v_user_id;

  return v_plan_id;
end;
$$;

create or replace function public.record_question_attempt_by_source_id(
  p_question_source_id text,
  p_mode public.attempt_mode,
  p_answer_given text,
  p_is_correct boolean,
  p_question_locale public.app_locale default null,
  p_study_plan_id uuid default null,
  p_answer_duration_ms integer default null,
  p_explanation_opened boolean default false,
  p_ai_chat_used boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question_id uuid;
  v_attempt_id uuid := gen_random_uuid();
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Attempt metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  select id
  into v_question_id
  from public.questions
  where question_source_id = p_question_source_id
    and is_active = true
  limit 1;

  if v_question_id is null then
    raise exception 'Question source id "%" was not found.', p_question_source_id
      using errcode = 'P0002';
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
    v_question_id,
    p_study_plan_id,
    p_mode,
    p_question_locale,
    p_answer_given,
    p_is_correct,
    p_answer_duration_ms,
    p_explanation_opened,
    p_ai_chat_used,
    p_metadata
  );

  return v_attempt_id;
end;
$$;

grant execute on function public.save_generated_study_plan(
  text,
  public.driving_category,
  public.app_locale,
  public.plan_level,
  date,
  smallint,
  smallint,
  text,
  jsonb,
  text,
  jsonb
) to authenticated;

grant execute on function public.record_question_attempt_by_source_id(
  text,
  public.attempt_mode,
  text,
  boolean,
  public.app_locale,
  uuid,
  integer,
  boolean,
  boolean,
  jsonb
) to authenticated;

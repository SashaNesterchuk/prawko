-- Study-plan topics switch from legacy 8-value topic_block enum to catalog topic ids.

alter table public.study_plan_days
  alter column focus_topic type text
  using focus_topic::text;

alter table public.study_plan_tasks
  alter column topic_block type text
  using topic_block::text;

comment on column public.study_plan_days.focus_topic is
  'question_topic_catalog.id (legacy column name focus_topic)';

comment on column public.study_plan_tasks.topic_block is
  'question_topic_catalog.id (legacy column name topic_block)';

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
      nullif(v_day.day_item ->> 'focusTopic', ''),
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
        nullif(v_task.task_item ->> 'topicBlock', ''),
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

  return v_plan_id;
end;
$$;

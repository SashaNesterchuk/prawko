do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typnamespace = 'public'::regnamespace
      and enum_type.typname = 'attempt_mode'
      and enum_value.enumlabel = 'wrong_answers'
  ) then
    alter type public.attempt_mode add value 'wrong_answers';
  end if;
end
$$;

create or replace function public.increment_study_plan_task_progress(
  p_task_id uuid,
  p_increment_by smallint default 1
)
returns public.study_plan_tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_next_completed smallint := 0;
  v_next_status public.study_plan_task_status := 'pending';
  v_task public.study_plan_tasks%rowtype;
begin
  if p_increment_by is null or p_increment_by < 1 then
    raise exception 'Task progress increment must be at least 1.'
      using errcode = '22023';
  end if;

  select *
  into v_task
  from public.study_plan_tasks
  where id = p_task_id
    and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Study plan task not found for current user.'
      using errcode = 'P0002';
  end if;

  v_next_completed := greatest(
    0,
    coalesce(v_task.question_count_completed, 0) + p_increment_by
  );

  if v_task.question_count_target is not null then
    v_next_completed := least(v_next_completed, v_task.question_count_target);
  end if;

  v_next_status := case
    when v_task.question_count_target is not null
      and v_next_completed >= v_task.question_count_target
      then 'completed'::public.study_plan_task_status
    when v_next_completed > 0
      then 'in_progress'::public.study_plan_task_status
    else 'pending'::public.study_plan_task_status
  end;

  update public.study_plan_tasks
  set
    question_count_completed = v_next_completed,
    status = v_next_status,
    started_at = case
      when v_next_completed > 0 then coalesce(started_at, v_now)
      else null
    end,
    completed_at = case
      when v_next_status = 'completed'::public.study_plan_task_status
        then coalesce(completed_at, v_now)
      else null
    end,
    updated_at = v_now
  where id = v_task.id
  returning *
  into v_task;

  return v_task;
end;
$$;

grant execute on function public.increment_study_plan_task_progress(
  uuid,
  smallint
) to authenticated;

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
  v_study_plan_task_id uuid;
  v_study_plan_task_id_text text;
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

  v_study_plan_task_id_text := nullif(trim(p_metadata ->> 'study_plan_task_id'), '');

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

  return v_attempt_id;
end;
$$;

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

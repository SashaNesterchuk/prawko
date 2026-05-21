create or replace function public.set_study_plan_task_status(
  p_task_id uuid,
  p_status public.study_plan_task_status,
  p_question_count_completed smallint default null
)
returns public.study_plan_tasks
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_task public.study_plan_tasks%rowtype;
  v_question_count_completed smallint := 0;
begin
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

  v_question_count_completed := case
    when p_question_count_completed is not null then p_question_count_completed
    when p_status = 'completed' then coalesce(
      v_task.question_count_target,
      v_task.question_count_completed
    )
    when p_status in ('pending', 'skipped', 'canceled') then 0
    else v_task.question_count_completed
  end;

  v_question_count_completed := greatest(coalesce(v_question_count_completed, 0), 0);

  if v_task.question_count_target is not null then
    v_question_count_completed := least(
      v_question_count_completed,
      v_task.question_count_target
    );
  end if;

  update public.study_plan_tasks
  set
    status = p_status,
    question_count_completed = v_question_count_completed,
    started_at = case
      when p_status in ('in_progress', 'completed')
        then coalesce(started_at, v_now)
      when p_status = 'pending'
        then null
      else started_at
    end,
    completed_at = case
      when p_status = 'completed'
        then v_now
      when p_status in ('pending', 'in_progress', 'skipped', 'canceled')
        then null
      else completed_at
    end,
    updated_at = v_now
  where id = v_task.id
  returning *
  into v_task;

  return v_task;
end;
$$;

grant execute on function public.set_study_plan_task_status(
  uuid,
  public.study_plan_task_status,
  smallint
) to authenticated;

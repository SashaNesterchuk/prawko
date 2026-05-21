create or replace function public.recompute_study_plan_day_progress(
  p_study_plan_day_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status public.study_plan_day_status;
  v_total integer := 0;
  v_completed integer := 0;
  v_minimum_completed boolean := false;
begin
  select status
  into v_current_status
  from public.study_plan_days
  where id = p_study_plan_day_id;

  if not found then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where status = 'completed')::integer,
    bool_or(
      status = 'completed'
      and lower(coalesce(metadata ->> 'counts_for_minimum', 'false')) in (
        'true',
        '1',
        'yes'
      )
    )
  into
    v_total,
    v_completed,
    v_minimum_completed
  from public.study_plan_tasks
  where study_plan_day_id = p_study_plan_day_id;

  update public.study_plan_days
  set
    tasks_total = coalesce(v_total, 0),
    tasks_completed = coalesce(v_completed, 0),
    minimum_mode_completed = coalesce(v_minimum_completed, false),
    status = case
      when v_current_status = 'skipped' and coalesce(v_completed, 0) = 0 then 'skipped'
      when coalesce(v_total, 0) > 0 and coalesce(v_completed, 0) >= v_total then 'completed'
      when coalesce(v_completed, 0) > 0 then 'in_progress'
      else 'pending'
    end,
    updated_at = timezone('utc', now())
  where id = p_study_plan_day_id;
end;
$$;

create or replace function public.sync_study_plan_day_after_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_study_plan_day_progress(old.study_plan_day_id);
    return old;
  end if;

  perform public.recompute_study_plan_day_progress(new.study_plan_day_id);

  if tg_op = 'UPDATE'
    and old.study_plan_day_id is distinct from new.study_plan_day_id
  then
    perform public.recompute_study_plan_day_progress(old.study_plan_day_id);
  end if;

  return new;
end;
$$;

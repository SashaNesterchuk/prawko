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
      when v_current_status = 'skipped' and coalesce(v_completed, 0) = 0
        then 'skipped'::public.study_plan_day_status
      when coalesce(v_total, 0) > 0 and coalesce(v_completed, 0) >= v_total
        then 'completed'::public.study_plan_day_status
      when coalesce(v_completed, 0) > 0
        then 'in_progress'::public.study_plan_day_status
      else 'pending'::public.study_plan_day_status
    end,
    updated_at = timezone('utc', now())
  where id = p_study_plan_day_id;
end;
$$;

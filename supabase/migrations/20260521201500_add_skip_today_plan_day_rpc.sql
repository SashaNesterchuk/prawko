create or replace function public.skip_today_plan_day(
  p_plan_date date default current_date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_day_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  select d.id
  into v_day_id
  from public.study_plan_days d
  join public.study_plans p
    on p.id = d.study_plan_id
  where d.user_id = v_user_id
    and d.plan_date = p_plan_date
    and p.status in ('draft', 'active', 'paused')
  order by
    case p.status
      when 'active' then 0
      when 'draft' then 1
      when 'paused' then 2
      else 3
    end,
    p.created_at desc
  limit 1
  for update;

  if v_day_id is null then
    raise exception 'Study plan day not found for current user and date %.', p_plan_date
      using errcode = 'P0002';
  end if;

  update public.study_plan_tasks
  set
    status = 'skipped',
    question_count_completed = 0,
    completed_at = null,
    updated_at = timezone('utc', now())
  where study_plan_day_id = v_day_id
    and user_id = v_user_id
    and status in ('pending', 'in_progress');

  update public.study_plan_days
  set
    status = 'skipped',
    minimum_mode_completed = false,
    updated_at = timezone('utc', now())
  where id = v_day_id
    and user_id = v_user_id;

  perform public.recompute_study_plan_day_progress(v_day_id);

  return v_day_id;
end;
$$;

grant execute on function public.skip_today_plan_day(date) to authenticated;

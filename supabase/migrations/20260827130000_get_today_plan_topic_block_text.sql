-- study_plan_tasks.topic_block is catalog topic id text; the RPC still
-- declared the old topic_block enum, so Home/Learn failed with 42P13.

drop function if exists public.get_today_plan(date);

create function public.get_today_plan(
  p_plan_date date default current_date
)
returns table (
  study_plan_id uuid,
  study_plan_day_id uuid,
  plan_date date,
  day_number smallint,
  day_status public.study_plan_day_status,
  task_id uuid,
  task_type public.study_plan_task_type,
  task_status public.study_plan_task_status,
  title text,
  description text,
  sort_order smallint,
  topic_block text,
  question_count_target smallint,
  question_count_completed smallint,
  estimated_minutes smallint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    d.study_plan_id,
    d.id as study_plan_day_id,
    d.plan_date,
    d.day_number,
    d.status as day_status,
    t.id as task_id,
    t.task_type,
    t.status as task_status,
    t.title,
    t.description,
    t.sort_order,
    t.topic_block,
    t.question_count_target,
    t.question_count_completed,
    t.estimated_minutes
  from public.study_plan_days d
  join public.study_plan_tasks t
    on t.study_plan_day_id = d.id
  join public.study_plans p
    on p.id = d.study_plan_id
  where d.user_id = auth.uid()
    and d.plan_date = p_plan_date
    and p.status in ('draft', 'active', 'paused')
  order by p.created_at desc, d.day_number asc, t.sort_order asc;
$$;

grant execute on function public.get_today_plan(date) to authenticated;
grant execute on function public.get_today_plan(date) to service_role;

notify pgrst, 'reload schema';

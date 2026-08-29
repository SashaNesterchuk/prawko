-- Scope study plans, readiness, and daily usage by national question set.
-- Existing plans are treated as Polish (`pl-v2-current`) so a Czech switch
-- cannot abandon or overwrite a live Polish plan.

alter table public.study_plans
  add column if not exists question_set_id uuid references public.question_sets(id);

update public.study_plans as plan
set question_set_id = question_set.id
from public.question_sets as question_set
where plan.question_set_id is null
  and question_set.key = 'pl-v2-current';

alter table public.study_plans
  alter column question_set_id set not null;

create index if not exists study_plans_user_set_status_idx
  on public.study_plans (user_id, question_set_id, status);

drop index if exists study_plans_one_open_per_user_set;
create unique index study_plans_one_open_per_user_set
  on public.study_plans (user_id, question_set_id)
  where status in ('draft', 'active', 'paused');

create or replace function public.resolve_active_question_set_id(
  p_question_set_key text
)
returns uuid
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_set_id uuid;
begin
  if p_question_set_key is null or btrim(p_question_set_key) = '' then
    raise exception 'Question set key is required.'
      using errcode = '22023';
  end if;

  select id
  into v_set_id
  from public.question_sets
  where key = p_question_set_key
    and is_active
  limit 1;

  if v_set_id is null then
    raise exception 'Active question set "%" was not found.', p_question_set_key
      using errcode = 'P0002';
  end if;

  return v_set_id;
end;
$$;

grant execute on function public.resolve_active_question_set_id(text) to authenticated;
grant execute on function public.resolve_active_question_set_id(text) to service_role;

drop function if exists public.save_generated_study_plan(
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
);

create function public.save_generated_study_plan(
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
  p_generation_context jsonb default '{}'::jsonb,
  p_question_set_key text default 'pl-v2-current'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid := gen_random_uuid();
  v_set_id uuid;
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

  v_set_id := public.resolve_active_question_set_id(p_question_set_key);

  update public.study_plans
  set
    status = 'abandoned',
    updated_at = timezone('utc', now())
  where user_id = v_user_id
    and question_set_id = v_set_id
    and status in ('draft', 'active', 'paused');

  insert into public.study_plans (
    id,
    user_id,
    question_set_id,
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
    v_set_id,
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
  jsonb,
  text
) to authenticated;
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
  jsonb,
  text
) to service_role;

drop function if exists public.get_today_plan(date);

create function public.get_today_plan(
  p_plan_date date default current_date,
  p_question_set_key text default 'pl-v2-current'
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
  join public.question_sets s
    on s.id = p.question_set_id
  where d.user_id = auth.uid()
    and d.plan_date = p_plan_date
    and p.status in ('draft', 'active', 'paused')
    and s.key = p_question_set_key
    and s.is_active
  order by p.created_at desc, d.day_number asc, t.sort_order asc;
$$;

grant execute on function public.get_today_plan(date, text) to authenticated;
grant execute on function public.get_today_plan(date, text) to service_role;

drop function if exists public.skip_today_plan_day(date);

create function public.skip_today_plan_day(
  p_plan_date date default current_date,
  p_question_set_key text default 'pl-v2-current'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_day_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  v_set_id := public.resolve_active_question_set_id(p_question_set_key);

  select d.id
  into v_day_id
  from public.study_plan_days d
  join public.study_plans p
    on p.id = d.study_plan_id
  where d.user_id = v_user_id
    and d.plan_date = p_plan_date
    and p.question_set_id = v_set_id
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

grant execute on function public.skip_today_plan_day(date, text) to authenticated;
grant execute on function public.skip_today_plan_day(date, text) to service_role;

drop function if exists public.get_readiness_summary();

create function public.get_readiness_summary(
  p_question_set_key text default 'pl-v2-current'
)
returns table (
  active_study_plan_id uuid,
  active_plan_status public.study_plan_status,
  exam_date date,
  days_until_exam integer,
  total_attempts bigint,
  accuracy_percent numeric,
  unresolved_weak_spots bigint,
  due_reviews bigint,
  completed_plan_days bigint,
  total_plan_days bigint,
  plan_completion_percent numeric,
  recent_exam_mode public.attempt_mode,
  recent_exam_status public.exam_session_status,
  recent_exam_finished_at timestamptz,
  recent_exam_score_percent numeric,
  accuracy_component integer,
  plan_component integer,
  recent_exam_component integer,
  review_hygiene_component integer,
  weak_spot_component integer,
  readiness_score integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with selected_set as (
    select id
    from public.question_sets
    where key = p_question_set_key
      and is_active
    limit 1
  ),
  active_plan as (
    select
      p.id,
      p.status,
      p.exam_date
    from public.study_plans p
    join selected_set s on s.id = p.question_set_id
    where p.user_id = auth.uid()
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
  ),
  attempt_stats as (
    select
      count(*)::bigint as total_attempts,
      coalesce(
        round(
          100.0 * count(*) filter (where a.is_correct)
          / nullif(count(*), 0),
          1
        ),
        0
      ) as accuracy_percent
    from public.question_attempts_v2 a
    join public.questions_v2 q on q.id = a.question_id
    join selected_set s on s.id = q.question_set_id
    where a.user_id = auth.uid()
  ),
  weak_stats as (
    select
      count(*) filter (
        where state.is_mastered = false
          and state.times_wrong > 0
      )::bigint as unresolved_weak_spots,
      count(*) filter (
        where state.review_due_at is not null
          and state.review_due_at <= timezone('utc', now())
          and state.is_mastered = false
      )::bigint as due_reviews
    from public.question_user_state_v2 state
    join public.questions_v2 q on q.id = state.question_id
    join selected_set s on s.id = q.question_set_id
    where state.user_id = auth.uid()
  ),
  day_stats as (
    select
      count(*)::bigint as total_plan_days,
      count(*) filter (where d.status = 'completed')::bigint as completed_plan_days
    from public.study_plan_days d
    join active_plan p on p.id = d.study_plan_id
  ),
  recent_exam as (
    select
      e.mode::public.attempt_mode as recent_exam_mode,
      e.status::public.exam_session_status as recent_exam_status,
      coalesce(e.finished_at, e.started_at) as recent_exam_finished_at,
      round(
        100.0 * e.score_points / nullif(e.total_points_target, 0),
        1
      ) as recent_exam_score_percent
    from public.exam_sessions_v2 e
    join selected_set s on s.id = e.question_set_id
    where e.user_id = auth.uid()
      and e.mode in ('exam', 'mini_test', 'exam_tomorrow')
      and e.status in ('completed', 'abandoned', 'expired')
      and e.total_questions_answered > 0
    order by
      coalesce(e.finished_at, e.started_at) desc,
      e.started_at desc
    limit 1
  ),
  plan_stats as (
    select
      coalesce(
        round(
          100.0 * d.completed_plan_days / nullif(d.total_plan_days, 0),
          1
        ),
        0
      ) as plan_completion_percent
    from day_stats d
  ),
  readiness_components as (
    select
      least(45, floor(coalesce(a.accuracy_percent, 0) * 0.45)::integer) as accuracy_component,
      least(25, floor(coalesce(p.plan_completion_percent, 0) * 0.25)::integer) as plan_component,
      least(20, floor(coalesce(e.recent_exam_score_percent, 0) * 0.20)::integer) as recent_exam_component,
      greatest(0, 5 - least(coalesce(w.due_reviews, 0), 5))::integer as review_hygiene_component,
      greatest(0, 5 - least(coalesce(w.unresolved_weak_spots, 0), 5))::integer as weak_spot_component
    from attempt_stats a
    cross join weak_stats w
    cross join plan_stats p
    left join recent_exam e on true
  )
  select
    p.id as active_study_plan_id,
    p.status as active_plan_status,
    p.exam_date,
    (p.exam_date - current_date)::integer as days_until_exam,
    a.total_attempts,
    a.accuracy_percent,
    w.unresolved_weak_spots,
    w.due_reviews,
    d.completed_plan_days,
    d.total_plan_days,
    ps.plan_completion_percent,
    e.recent_exam_mode,
    e.recent_exam_status,
    e.recent_exam_finished_at,
    e.recent_exam_score_percent,
    c.accuracy_component,
    c.plan_component,
    c.recent_exam_component,
    c.review_hygiene_component,
    c.weak_spot_component,
    greatest(
      0,
      least(
        100,
        c.accuracy_component +
        c.plan_component +
        c.recent_exam_component +
        c.review_hygiene_component +
        c.weak_spot_component
      )
    )::integer as readiness_score
  from active_plan p
  cross join attempt_stats a
  cross join weak_stats w
  cross join day_stats d
  cross join plan_stats ps
  cross join readiness_components c
  left join recent_exam e on true;
$$;

grant execute on function public.get_readiness_summary(text) to authenticated;
grant execute on function public.get_readiness_summary(text) to service_role;

drop function if exists public.get_daily_usage_snapshot();

create function public.get_daily_usage_snapshot(
  p_question_set_key text default 'pl-v2-current'
)
returns table (
  warsaw_date date,
  question_attempts_used_today integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_warsaw_date date;
  v_day_start timestamptz;
  v_next_day_start timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  v_set_id := public.resolve_active_question_set_id(p_question_set_key);
  v_warsaw_date := timezone('Europe/Warsaw', now())::date;
  v_day_start := v_warsaw_date::timestamp at time zone 'Europe/Warsaw';
  v_next_day_start := (v_warsaw_date + 1)::timestamp at time zone 'Europe/Warsaw';

  return query
  select
    v_warsaw_date,
    count(*) filter (where a.mode <> 'exam')::integer as question_attempts_used_today
  from public.question_attempts_v2 a
  join public.questions_v2 q on q.id = a.question_id
  where a.user_id = v_user_id
    and q.question_set_id = v_set_id
    and a.answered_at >= v_day_start
    and a.answered_at < v_next_day_start;
end;
$$;

grant execute on function public.get_daily_usage_snapshot(text) to authenticated;
grant execute on function public.get_daily_usage_snapshot(text) to service_role;

notify pgrst, 'reload schema';

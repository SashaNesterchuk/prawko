drop function if exists public.get_readiness_summary();

create function public.get_readiness_summary()
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
  with active_plan as (
    select
      p.id,
      p.status,
      p.exam_date
    from public.study_plans p
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
          100.0 * count(*) filter (where is_correct)
          / nullif(count(*), 0),
          1
        ),
        0
      ) as accuracy_percent
    from public.question_attempts
    where user_id = auth.uid()
  ),
  weak_stats as (
    select
      count(*) filter (
        where is_mastered = false
          and times_wrong > 0
      )::bigint as unresolved_weak_spots,
      count(*) filter (
        where review_due_at is not null
          and review_due_at <= timezone('utc', now())
          and is_mastered = false
      )::bigint as due_reviews
    from public.question_user_state
    where user_id = auth.uid()
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
      s.mode as recent_exam_mode,
      s.status as recent_exam_status,
      coalesce(s.finished_at, s.started_at) as recent_exam_finished_at,
      round(
        100.0 * s.score_points / nullif(s.total_points_target, 0),
        1
      ) as recent_exam_score_percent
    from public.exam_sessions s
    where s.user_id = auth.uid()
      and s.mode in ('exam', 'mini_test', 'exam_tomorrow')
      and s.status in ('completed', 'abandoned', 'expired')
      and s.total_questions_answered > 0
    order by
      coalesce(s.finished_at, s.started_at) desc,
      s.started_at desc
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

grant execute on function public.get_readiness_summary() to authenticated;

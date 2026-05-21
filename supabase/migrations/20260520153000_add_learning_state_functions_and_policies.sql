create or replace function public.recompute_question_user_state(
  p_user_id uuid,
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_times_seen integer := 0;
  v_times_correct integer := 0;
  v_times_wrong integer := 0;
  v_first_seen_at timestamptz;
  v_last_seen_at timestamptz;
  v_last_correct_at timestamptz;
  v_last_wrong_at timestamptz;
  v_recent_results boolean[];
  v_recent_result boolean;
  v_consecutive_correct integer := 0;
  v_review_due_at timestamptz;
  v_mastery_score integer := 0;
  v_is_mastered boolean := false;
  v_last_mode public.attempt_mode;
  v_is_hard boolean := false;
begin
  select
    count(*)::integer,
    count(*) filter (where is_correct)::integer,
    count(*) filter (where not is_correct)::integer,
    min(answered_at),
    max(answered_at),
    max(answered_at) filter (where is_correct),
    max(answered_at) filter (where not is_correct),
    array_agg(is_correct order by answered_at desc),
    (array_agg(mode order by answered_at desc))[1]
  into
    v_times_seen,
    v_times_correct,
    v_times_wrong,
    v_first_seen_at,
    v_last_seen_at,
    v_last_correct_at,
    v_last_wrong_at,
    v_recent_results,
    v_last_mode
  from public.question_attempts
  where user_id = p_user_id
    and question_id = p_question_id;

  if coalesce(v_times_seen, 0) = 0 then
    delete from public.question_user_state
    where user_id = p_user_id
      and question_id = p_question_id;
    return;
  end if;

  if v_recent_results is not null then
    foreach v_recent_result in array v_recent_results loop
      exit when v_recent_result is distinct from true;
      v_consecutive_correct := v_consecutive_correct + 1;
    end loop;
  end if;

  select is_hard
  into v_is_hard
  from public.question_user_state
  where user_id = p_user_id
    and question_id = p_question_id;

  v_is_hard := coalesce(v_is_hard, false);
  v_is_mastered := v_consecutive_correct >= 3 and v_times_correct >= 3;

  if v_last_seen_at is not null then
    if v_last_wrong_at is not null and (v_last_correct_at is null or v_last_wrong_at >= v_last_correct_at) then
      v_review_due_at := v_last_seen_at + interval '1 day';
    elsif v_consecutive_correct >= 3 then
      v_review_due_at := v_last_seen_at + interval '14 days';
    elsif v_consecutive_correct = 2 then
      v_review_due_at := v_last_seen_at + interval '7 days';
    elsif v_consecutive_correct = 1 then
      v_review_due_at := v_last_seen_at + interval '3 days';
    else
      v_review_due_at := v_last_seen_at;
    end if;
  end if;

  v_mastery_score := greatest(
    0,
    least(
      100,
      (v_times_correct * 12) - (v_times_wrong * 10) + (v_consecutive_correct * 15)
    )
  );

  insert into public.question_user_state (
    user_id,
    question_id,
    times_seen,
    times_correct,
    times_wrong,
    consecutive_correct,
    first_seen_at,
    last_seen_at,
    last_correct_at,
    last_wrong_at,
    review_due_at,
    last_mode,
    is_hard,
    is_mastered,
    mastery_score
  )
  values (
    p_user_id,
    p_question_id,
    v_times_seen,
    v_times_correct,
    v_times_wrong,
    v_consecutive_correct,
    v_first_seen_at,
    v_last_seen_at,
    v_last_correct_at,
    v_last_wrong_at,
    v_review_due_at,
    v_last_mode,
    v_is_hard,
    v_is_mastered,
    v_mastery_score
  )
  on conflict (user_id, question_id)
  do update set
    times_seen = excluded.times_seen,
    times_correct = excluded.times_correct,
    times_wrong = excluded.times_wrong,
    consecutive_correct = excluded.consecutive_correct,
    first_seen_at = excluded.first_seen_at,
    last_seen_at = excluded.last_seen_at,
    last_correct_at = excluded.last_correct_at,
    last_wrong_at = excluded.last_wrong_at,
    review_due_at = excluded.review_due_at,
    last_mode = excluded.last_mode,
    is_mastered = excluded.is_mastered,
    mastery_score = excluded.mastery_score,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.sync_question_user_state_after_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recompute_question_user_state(new.user_id, new.question_id);
  return new;
end;
$$;

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
      and coalesce((metadata ->> 'counts_for_minimum')::boolean, false)
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
  return new;
end;
$$;

create or replace function public.get_today_plan(
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
  topic_block public.topic_block,
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

create or replace function public.get_weak_spots_summary()
returns table (
  topic_block public.topic_block,
  total_questions bigint,
  wrong_questions bigint,
  hard_questions bigint,
  due_questions bigint,
  mastered_questions bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    q.topic_block,
    count(*)::bigint as total_questions,
    count(*) filter (where s.times_wrong > 0)::bigint as wrong_questions,
    count(*) filter (where s.is_hard = true)::bigint as hard_questions,
    count(*) filter (
      where s.review_due_at is not null
        and s.review_due_at <= timezone('utc', now())
        and s.is_mastered = false
    )::bigint as due_questions,
    count(*) filter (where s.is_mastered = true)::bigint as mastered_questions
  from public.question_user_state s
  join public.questions q
    on q.id = s.question_id
  where s.user_id = auth.uid()
    and q.is_active = true
  group by q.topic_block
  order by q.topic_block;
$$;

create or replace function public.get_readiness_summary()
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
      count(*) filter (where is_mastered = false and times_wrong > 0)::bigint as unresolved_weak_spots,
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
    greatest(
      0,
      least(
        100,
        floor(
          (coalesce(a.accuracy_percent, 0) * 0.60) +
          (coalesce(
            100.0 * d.completed_plan_days / nullif(d.total_plan_days, 0),
            0
          ) * 0.25) +
          greatest(0, 10 - least(coalesce(w.due_reviews, 0), 10)) +
          greatest(0, 5 - least(coalesce(w.unresolved_weak_spots, 0), 5))
        )::integer
      )
    )::integer as readiness_score
  from active_plan p
  cross join attempt_stats a
  cross join weak_stats w
  cross join day_stats d;
$$;

drop trigger if exists set_question_user_state_updated_at on public.question_user_state;
create trigger set_question_user_state_updated_at
  before update on public.question_user_state
  for each row execute function public.set_updated_at();

drop trigger if exists set_study_plan_days_updated_at on public.study_plan_days;
create trigger set_study_plan_days_updated_at
  before update on public.study_plan_days
  for each row execute function public.set_updated_at();

drop trigger if exists set_study_plan_tasks_updated_at on public.study_plan_tasks;
create trigger set_study_plan_tasks_updated_at
  before update on public.study_plan_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists sync_question_user_state_after_attempt_insert on public.question_attempts;
create trigger sync_question_user_state_after_attempt_insert
  after insert on public.question_attempts
  for each row execute function public.sync_question_user_state_after_attempt();

drop trigger if exists sync_study_plan_day_after_task_insert on public.study_plan_tasks;
create trigger sync_study_plan_day_after_task_insert
  after insert on public.study_plan_tasks
  for each row execute function public.sync_study_plan_day_after_task_change();

drop trigger if exists sync_study_plan_day_after_task_update on public.study_plan_tasks;
create trigger sync_study_plan_day_after_task_update
  after update on public.study_plan_tasks
  for each row execute function public.sync_study_plan_day_after_task_change();

drop trigger if exists sync_study_plan_day_after_task_delete on public.study_plan_tasks;
create trigger sync_study_plan_day_after_task_delete
  after delete on public.study_plan_tasks
  for each row execute function public.sync_study_plan_day_after_task_change();

grant select, insert, update on public.question_user_state to authenticated;
grant select, insert, update on public.study_plan_days to authenticated;
grant select, insert, update on public.study_plan_tasks to authenticated;
grant all on public.question_user_state to service_role;
grant all on public.study_plan_days to service_role;
grant all on public.study_plan_tasks to service_role;

grant execute on function public.get_today_plan(date) to authenticated;
grant execute on function public.get_weak_spots_summary() to authenticated;
grant execute on function public.get_readiness_summary() to authenticated;

alter table public.question_user_state enable row level security;
alter table public.study_plan_days enable row level security;
alter table public.study_plan_tasks enable row level security;

drop policy if exists question_user_state_select_own on public.question_user_state;
create policy question_user_state_select_own
  on public.question_user_state
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists question_user_state_insert_own on public.question_user_state;
create policy question_user_state_insert_own
  on public.question_user_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists question_user_state_update_own on public.question_user_state;
create policy question_user_state_update_own
  on public.question_user_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists study_plan_days_select_own on public.study_plan_days;
create policy study_plan_days_select_own
  on public.study_plan_days
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists study_plan_days_insert_own on public.study_plan_days;
create policy study_plan_days_insert_own
  on public.study_plan_days
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists study_plan_days_update_own on public.study_plan_days;
create policy study_plan_days_update_own
  on public.study_plan_days
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists study_plan_tasks_select_own on public.study_plan_tasks;
create policy study_plan_tasks_select_own
  on public.study_plan_tasks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists study_plan_tasks_insert_own on public.study_plan_tasks;
create policy study_plan_tasks_insert_own
  on public.study_plan_tasks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists study_plan_tasks_update_own on public.study_plan_tasks;
create policy study_plan_tasks_update_own
  on public.study_plan_tasks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

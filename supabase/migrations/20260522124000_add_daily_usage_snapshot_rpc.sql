create or replace function public.get_daily_usage_snapshot()
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
  v_warsaw_date date;
  v_day_start timestamptz;
  v_next_day_start timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  v_warsaw_date := timezone('Europe/Warsaw', now())::date;
  v_day_start := v_warsaw_date::timestamp at time zone 'Europe/Warsaw';
  v_next_day_start := (v_warsaw_date + 1)::timestamp at time zone 'Europe/Warsaw';

  return query
  select
    v_warsaw_date,
    count(*) filter (where mode <> 'exam')::integer as question_attempts_used_today
  from public.question_attempts
  where user_id = v_user_id
    and answered_at >= v_day_start
    and answered_at < v_next_day_start;
end;
$$;

grant execute on function public.get_daily_usage_snapshot() to authenticated;

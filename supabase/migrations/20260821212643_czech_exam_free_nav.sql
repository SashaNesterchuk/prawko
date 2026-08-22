-- Czech eTesty exam: official 25/50/43 mix, free navigation, no per-question timer.
-- Polish `pl-v2-current` exam_config stays unchanged; WORD sequential behaviour is the default.

update public.question_sets
set exam_config = exam_config || jsonb_build_object(
  'exam',
  coalesce(exam_config -> 'exam', '{}'::jsonb) || jsonb_build_object(
    'question_count', 25,
    'max_points', 50,
    'pass_points', 43,
    'duration_minutes', 30,
    'navigation', 'free',
    'per_question_timer', false,
    'baskets', jsonb_build_array(
      jsonb_build_object('scope_id', 9, 'count', 10, 'points', 2),
      jsonb_build_object('scope_id', 10, 'count', 4, 'points', 2),
      jsonb_build_object('scope_id', 11, 'count', 3, 'points', 1),
      jsonb_build_object('scope_id', 12, 'count', 3, 'points', 4),
      jsonb_build_object('scope_id', 13, 'count', 2, 'points', 1),
      jsonb_build_object('scope_id', 14, 'count', 2, 'points', 2),
      jsonb_build_object('scope_id', 15, 'count', 1, 'points', 1)
    )
  )
)
where key = 'cz-v2-current';

create or replace function public.select_exam_question_ids_v2(
  p_set_id uuid,
  p_user_id uuid,
  p_category text,
  p_mode text,
  p_target integer,
  p_exam_config jsonb
)
returns uuid[]
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_exam jsonb := coalesce(p_exam_config -> 'exam', '{}'::jsonb);
  v_baskets jsonb := v_exam -> 'baskets';
  v_ids uuid[] := '{}';
  v_chunk uuid[];
  v_basket record;
  v_need integer;
  v_seed text := p_user_id::text || clock_timestamp()::text || random()::text;
begin
  if p_mode = 'exam'
     and jsonb_typeof(v_baskets) = 'array'
     and jsonb_array_length(v_baskets) > 0
  then
    for v_basket in
      select *
      from jsonb_to_recordset(v_baskets) as basket(scope_id integer, count integer, points integer)
    loop
      v_need := greatest(0, coalesce(v_basket.count, 0));
      if v_need = 0 then
        continue;
      end if;

      select coalesce(array_agg(picked.id), '{}')
        into v_chunk
      from (
        select q.id
        from public.questions_v2 q
        where q.question_set_id = p_set_id
          and q.is_active
          and (coalesce(array_length(q.category_codes, 1), 0) = 0 or p_category = any(q.category_codes))
          and q.id <> all(v_ids)
          and (q.official_metadata ->> 'official_basket_scope_id')::integer = v_basket.scope_id
          and q.points = v_basket.points
        order by md5(q.id::text || v_seed)
        limit v_need
      ) picked;
      v_ids := v_ids || v_chunk;
      v_need := v_need - coalesce(array_length(v_chunk, 1), 0);

      if v_need > 0 then
        select coalesce(array_agg(picked.id), '{}')
          into v_chunk
        from (
          select q.id
          from public.questions_v2 q
          where q.question_set_id = p_set_id
            and q.is_active
            and (coalesce(array_length(q.category_codes, 1), 0) = 0 or p_category = any(q.category_codes))
            and q.id <> all(v_ids)
            and (q.official_metadata ->> 'official_basket_scope_id')::integer = v_basket.scope_id
          order by md5(q.id::text || v_seed || 'basket')
          limit v_need
        ) picked;
        v_ids := v_ids || v_chunk;
      end if;
    end loop;
  end if;

  v_need := greatest(0, p_target - coalesce(array_length(v_ids, 1), 0));
  if v_need > 0 then
    select coalesce(array_agg(picked.id), '{}')
      into v_chunk
    from (
      select q.id
      from public.questions_v2 q
      where q.question_set_id = p_set_id
        and q.is_active
        and (coalesce(array_length(q.category_codes, 1), 0) = 0 or p_category = any(q.category_codes))
        and q.id <> all(v_ids)
      order by md5(q.id::text || v_seed || 'fill')
      limit v_need
    ) picked;
    v_ids := v_ids || v_chunk;
  end if;

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return '{}';
  end if;

  select array_agg(shuffled.id order by md5(shuffled.id::text || v_seed || 'order'))
    into v_ids
  from unnest(v_ids) as shuffled(id);

  return v_ids[1:p_target];
end;
$$;

create or replace function public.recompute_exam_session_v2(p_exam_session_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_answered integer;
  v_correct integer;
  v_score integer;
  v_total integer;
  v_free boolean;
begin
  select count(*)::integer,
         count(*) filter (where is_correct)::integer,
         coalesce(sum(points_awarded), 0)::integer
    into v_answered, v_correct, v_score
  from public.exam_session_answers_v2
  where exam_session_id = p_exam_session_id;

  select total_questions_target,
         coalesce(metadata ->> 'navigation', '') = 'free'
    into v_total, v_free
  from public.exam_sessions_v2
  where id = p_exam_session_id;

  update public.exam_sessions_v2 set
    total_questions_answered = coalesce(v_answered, 0),
    correct_answers_count = coalesce(v_correct, 0),
    wrong_answers_count = coalesce(v_answered, 0) - coalesce(v_correct, 0),
    score_points = coalesce(v_score, 0),
    current_question_index = case
      when v_free then current_question_index
      else least(coalesce(v_answered, 0) + 1, v_total + 1)
    end,
    status = case
      when v_free then status
      when coalesce(v_answered, 0) >= v_total then 'completed'
      else status
    end,
    finished_at = case
      when v_free then finished_at
      when coalesce(v_answered, 0) >= v_total then coalesce(finished_at, timezone('utc', now()))
      else finished_at
    end,
    passed = case
      when v_free then passed
      when coalesce(v_answered, 0) >= v_total then coalesce(v_score, 0) >= pass_points
      else null
    end
  where id = p_exam_session_id;
end;
$$;

drop trigger if exists sync_exam_session_after_answer_v2 on public.exam_session_answers_v2;
create trigger sync_exam_session_after_answer_v2
  after insert or update on public.exam_session_answers_v2
  for each row execute function public.sync_exam_session_after_answer_v2();

create or replace function public.start_exam_session_v2(
  p_question_set_key text, p_mode text, p_session_locale text default 'ua',
  p_current_category text default 'B', p_requested_total_questions integer default null,
  p_metadata jsonb default '{}'::jsonb, p_replace_existing boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_set_id uuid;
  v_existing uuid;
  v_session_id uuid := gen_random_uuid();
  v_config jsonb;
  v_exam jsonb;
  v_target integer;
  v_official_count integer;
  v_mini_count integer;
  v_duration_minutes integer;
  v_question_ids uuid[];
  v_total_points integer;
  v_pass_points integer;
  v_pass_ratio numeric := 68.0 / 74.0;
  v_navigation text := 'forward_only';
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_mode not in ('exam', 'mini_test', 'exam_tomorrow') then raise exception 'Unsupported exam mode.' using errcode = '22023'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Exam metadata must be a JSON object.' using errcode = '22023'; end if;
  if p_requested_total_questions is not null and p_requested_total_questions not between 1 and 64 then raise exception 'Requested question count must be between 1 and 64.' using errcode = '22023'; end if;

  select id, exam_config
    into v_set_id, v_config
  from public.question_sets
  where key = p_question_set_key and is_active;
  if v_set_id is null then raise exception 'Question set "%" was not found.', p_question_set_key using errcode = 'P0002'; end if;

  v_exam := coalesce(v_config -> 'exam', '{}'::jsonb);
  v_official_count := coalesce(
    nullif(v_exam ->> 'question_count', '')::integer,
    nullif(v_config ->> 'question_count', '')::integer,
    32
  );
  v_mini_count := coalesce(nullif(v_config ->> 'mini_test_question_count', '')::integer, 12);
  v_duration_minutes := coalesce(nullif(v_exam ->> 'duration_minutes', '')::integer, 25);
  v_navigation := coalesce(nullif(v_exam ->> 'navigation', ''), 'forward_only');
  v_pass_ratio := coalesce(
    case
      when nullif(v_exam ->> 'pass_points', '') is not null
       and nullif(v_exam ->> 'max_points', '') is not null
       and (v_exam ->> 'max_points')::numeric > 0
      then (v_exam ->> 'pass_points')::numeric / (v_exam ->> 'max_points')::numeric
      else null
    end,
    nullif(v_config ->> 'pass_ratio', '')::numeric,
    v_pass_ratio
  );

  if p_mode <> 'mini_test' then
    v_target := v_official_count;
  elsif p_requested_total_questions is not null then
    v_target := p_requested_total_questions;
  else
    v_target := v_mini_count;
  end if;

  update public.exam_sessions_v2
     set status = 'expired', finished_at = coalesce(finished_at, expires_at)
   where user_id = v_user_id
     and question_set_id = v_set_id
     and status = 'active'
     and expires_at <= timezone('utc', now());

  select id into v_existing
  from public.exam_sessions_v2
  where user_id = v_user_id and question_set_id = v_set_id and mode = p_mode and status = 'active'
  order by started_at desc
  limit 1;

  if v_existing is not null and not p_replace_existing then
    return public.get_exam_session_snapshot_v2(v_existing);
  end if;
  if v_existing is not null then
    update public.exam_sessions_v2
       set status = 'abandoned', finished_at = timezone('utc', now())
     where id = v_existing;
  end if;

  v_question_ids := public.select_exam_question_ids_v2(
    v_set_id, v_user_id, p_current_category, p_mode, v_target, v_config
  );
  if coalesce(array_length(v_question_ids, 1), 0) = 0 then
    raise exception 'No active questions are available for this category.' using errcode = 'P0002';
  end if;

  select count(*)::integer, coalesce(sum(points), 0)::integer
    into v_target, v_total_points
  from public.questions_v2
  where id = any(v_question_ids);

  v_pass_points := greatest(1, round(v_total_points * v_pass_ratio)::integer);

  insert into public.exam_sessions_v2(
    id, user_id, question_set_id, question_ids, mode, current_category, session_locale,
    total_questions_target, total_points_target, pass_points, started_at, expires_at, metadata
  )
  values(
    v_session_id, v_user_id, v_set_id, v_question_ids, p_mode, p_current_category, p_session_locale,
    v_target, v_total_points, v_pass_points, timezone('utc', now()),
    timezone('utc', now()) + make_interval(mins => greatest(5, ceil(v_target * v_duration_minutes::numeric / v_official_count)::integer)),
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'question_set_key', p_question_set_key,
      'navigation', v_navigation,
      'flaggedOrders', '[]'::jsonb
    )
  );

  return public.get_exam_session_snapshot_v2(v_session_id);
end;
$$;

drop function if exists public.submit_exam_session_answer_v2(uuid, text, text, integer, jsonb);

create function public.submit_exam_session_answer_v2(
  p_exam_session_id uuid, p_answer_given text, p_question_locale text default null,
  p_answer_duration_ms integer default null, p_metadata jsonb default '{}'::jsonb,
  p_question_order smallint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_session public.exam_sessions_v2%rowtype;
  v_question public.questions_v2%rowtype;
  v_order smallint;
  v_answer text;
  v_correct boolean;
  v_attempt uuid;
  v_free boolean;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Exam answer metadata must be a JSON object.' using errcode = '22023'; end if;

  select * into v_session
  from public.exam_sessions_v2
  where id = p_exam_session_id and user_id = v_user_id
  for update;
  if not found then raise exception 'Exam session was not found for the current user.' using errcode = 'P0002'; end if;
  if v_session.status <> 'active' then return public.get_exam_session_snapshot_v2(v_session.id); end if;
  if v_session.expires_at is not null and v_session.expires_at <= timezone('utc', now()) then
    update public.exam_sessions_v2
       set status = 'expired', finished_at = timezone('utc', now())
     where id = v_session.id;
    return public.get_exam_session_snapshot_v2(v_session.id);
  end if;

  v_free := coalesce(v_session.metadata ->> 'navigation', '') = 'free';
  v_order := case
    when v_free then coalesce(p_question_order, v_session.current_question_index)
    else v_session.current_question_index
  end;
  if v_order < 1 or v_order > coalesce(array_length(v_session.question_ids, 1), 0) then
    raise exception 'Exam question order is out of range.' using errcode = '22023';
  end if;

  select * into v_question
  from public.questions_v2
  where id = v_session.question_ids[v_order] and is_active;
  if not found then raise exception 'Current exam question is not available.' using errcode = 'P0002'; end if;

  if not v_free and exists(
    select 1 from public.exam_session_answers_v2
    where exam_session_id = v_session.id and question_order = v_order
  ) then
    return public.get_exam_session_snapshot_v2(v_session.id);
  end if;

  v_answer := case
    when v_question.answer_kind = 'boolean' then lower(btrim(p_answer_given))
    else upper(btrim(p_answer_given))
  end;
  if v_answer = '' or (v_question.answer_kind = 'boolean' and v_answer not in ('true', 'false')) then
    raise exception 'Invalid answer.' using errcode = '22023';
  end if;
  v_correct := v_question.correct_option_id = v_answer;

  insert into public.question_attempts_v2(
    user_id, question_id, selected_answer, is_correct, mode, question_locale, answer_duration_ms, metadata
  )
  values (
    v_user_id, v_question.id, v_answer, v_correct, v_session.mode, p_question_locale, p_answer_duration_ms,
    p_metadata || jsonb_build_object('exam_session_id', v_session.id)
  )
  returning id into v_attempt;

  insert into public.exam_session_answers_v2(
    exam_session_id, question_id, question_attempt_id, question_order, answer_given, is_correct, points_awarded
  )
  values (
    v_session.id, v_question.id, v_attempt, v_order, v_answer, v_correct,
    case when v_correct then v_question.points else 0 end
  )
  on conflict (exam_session_id, question_order) do update set
    question_id = excluded.question_id,
    question_attempt_id = excluded.question_attempt_id,
    answer_given = excluded.answer_given,
    is_correct = excluded.is_correct,
    points_awarded = excluded.points_awarded,
    answered_at = timezone('utc', now());

  return public.get_exam_session_snapshot_v2(v_session.id);
end;
$$;

create or replace function public.set_exam_session_current_index_v2(
  p_exam_session_id uuid,
  p_question_order smallint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total integer;
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;

  select total_questions_target into v_total
  from public.exam_sessions_v2
  where id = p_exam_session_id and user_id = v_user_id and status = 'active'
  for update;
  if not found then raise exception 'Exam session was not found for the current user.' using errcode = 'P0002'; end if;
  if p_question_order < 1 or p_question_order > v_total then
    raise exception 'Exam question order is out of range.' using errcode = '22023';
  end if;

  update public.exam_sessions_v2
     set current_question_index = p_question_order
   where id = p_exam_session_id and user_id = v_user_id;

  return public.get_exam_session_snapshot_v2(p_exam_session_id);
end;
$$;

create or replace function public.set_exam_session_flags_v2(
  p_exam_session_id uuid,
  p_flagged_orders integer[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_total integer;
  v_orders integer[] := '{}';
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;

  select total_questions_target into v_total
  from public.exam_sessions_v2
  where id = p_exam_session_id and user_id = v_user_id and status = 'active'
  for update;
  if not found then raise exception 'Exam session was not found for the current user.' using errcode = 'P0002'; end if;

  select coalesce(array_agg(flagged.order_value order by flagged.order_value), '{}')
    into v_orders
  from (
    select distinct unnest(coalesce(p_flagged_orders, '{}'::integer[])) as order_value
  ) flagged
  where flagged.order_value between 1 and v_total;

  update public.exam_sessions_v2
     set metadata = metadata || jsonb_build_object('flaggedOrders', to_jsonb(v_orders))
   where id = p_exam_session_id and user_id = v_user_id;

  return public.get_exam_session_snapshot_v2(p_exam_session_id);
end;
$$;

create or replace function public.finish_exam_session_v2(
  p_exam_session_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authenticated user is required.' using errcode = '42501'; end if;
  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then raise exception 'Exam metadata must be a JSON object.' using errcode = '22023'; end if;

  update public.exam_sessions_v2
     set status = 'completed',
         finished_at = coalesce(finished_at, timezone('utc', now())),
         passed = score_points >= pass_points,
         metadata = metadata || p_metadata
   where id = p_exam_session_id
     and user_id = v_user_id
     and status = 'active';
  if not found then
    if not exists (
      select 1 from public.exam_sessions_v2
      where id = p_exam_session_id and user_id = v_user_id
    ) then
      raise exception 'Exam session was not found for the current user.' using errcode = 'P0002';
    end if;
  end if;

  return public.get_exam_session_snapshot_v2(p_exam_session_id);
end;
$$;

grant execute on function
  public.select_exam_question_ids_v2(uuid, uuid, text, text, integer, jsonb),
  public.submit_exam_session_answer_v2(uuid, text, text, integer, jsonb, smallint),
  public.set_exam_session_current_index_v2(uuid, smallint),
  public.set_exam_session_flags_v2(uuid, integer[]),
  public.finish_exam_session_v2(uuid, jsonb)
to authenticated;

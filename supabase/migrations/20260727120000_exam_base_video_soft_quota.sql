-- Soft video floor for base-scope exam picks (~55% of base slots).
-- Official WORD rules fix scope (20/12) and point buckets (3/2/1) only —
-- not film vs photo. Soft: prefer videos within each base points bucket
-- until the scaled floor is met; never fail if the bank is short on videos.
-- Specialist media is unchanged (do not force specialist videos).

create or replace function public.start_exam_session(
  p_mode public.attempt_mode,
  p_session_locale public.app_locale default 'ua',
  p_current_category public.driving_category default 'B',
  p_requested_total_questions integer default null,
  p_study_plan_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_replace_existing boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_existing_session_id uuid;
  v_new_session_id uuid := gen_random_uuid();
  v_total_questions_target integer;
  v_base_target integer;
  v_specialist_target integer;
  v_base_video_min integer := 0;
  v_question_ids uuid[];
  v_missing_bucket_count integer := 0;
  v_selected_count integer := 0;
  v_total_points integer := 0;
  v_pass_points integer := 0;
  v_duration_minutes integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_mode not in ('exam', 'mini_test', 'exam_tomorrow') then
    raise exception 'Exam mode "%" is not supported for simulator.', p_mode
      using errcode = '22023';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Exam session metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  if p_study_plan_id is not null
    and not exists (
      select 1
      from public.study_plans
      where id = p_study_plan_id
        and user_id = v_user_id
    )
  then
    raise exception 'Study plan "%" does not belong to the current user.', p_study_plan_id
      using errcode = '42501';
  end if;

  v_total_questions_target := public.get_exam_total_questions_target(
    p_mode,
    p_requested_total_questions
  );
  v_base_target := least(
    v_total_questions_target,
    greatest(
      0,
      round((v_total_questions_target::numeric * 20) / 32)::integer
    )
  );
  v_specialist_target := greatest(0, v_total_questions_target - v_base_target);
  -- Matches packages/config EXAM_RULES.baseVideoMinRatio = 0.55
  v_base_video_min := least(
    v_base_target,
    round((v_base_target::numeric * 55) / 100)::integer
  );

  update public.exam_sessions
  set
    status = 'expired',
    finished_at = coalesce(finished_at, expires_at, v_now),
    metadata = metadata || jsonb_build_object(
      'expired_at',
      v_now
    ),
    updated_at = v_now
  where user_id = v_user_id
    and status = 'active'
    and mode = p_mode
    and expires_at is not null
    and expires_at <= v_now;

  select id
  into v_existing_session_id
  from public.exam_sessions
  where user_id = v_user_id
    and status = 'active'
    and mode = p_mode
  order by started_at desc
  limit 1;

  if v_existing_session_id is not null and not p_replace_existing then
    return public.get_exam_session_snapshot(v_existing_session_id);
  end if;

  if v_existing_session_id is not null and p_replace_existing then
    update public.exam_sessions
    set
      status = 'abandoned',
      finished_at = coalesce(finished_at, v_now),
      metadata = metadata || jsonb_build_object(
        'abandoned_at',
        v_now,
        'abandoned_reason',
        'restart_requested'
      ),
      updated_at = v_now
    where id = v_existing_session_id;
  end if;

  with scope_targets as (
    select
      'base'::public.question_scope as scope,
      v_base_target as target_count,
      20::integer as official_total
    union all
    select
      'specialist'::public.question_scope as scope,
      v_specialist_target as target_count,
      12::integer as official_total
  ),
  official_mix as (
    select 'base'::public.question_scope as scope, 3::smallint as points, 10::integer as weight
    union all
    select 'base'::public.question_scope, 2::smallint, 6::integer
    union all
    select 'base'::public.question_scope, 1::smallint, 4::integer
    union all
    select 'specialist'::public.question_scope, 3::smallint, 6::integer
    union all
    select 'specialist'::public.question_scope, 2::smallint, 4::integer
    union all
    select 'specialist'::public.question_scope, 1::smallint, 2::integer
  ),
  scaled_targets as (
    select
      mix.scope,
      mix.points,
      st.target_count,
      floor(
        (st.target_count::numeric * mix.weight::numeric) / st.official_total::numeric
      )::integer as floor_count,
      (
        (st.target_count::numeric * mix.weight::numeric) / st.official_total::numeric
      ) - floor(
        (st.target_count::numeric * mix.weight::numeric) / st.official_total::numeric
      ) as remainder
    from official_mix mix
    join scope_targets st on st.scope = mix.scope
  ),
  scope_remaining as (
    select
      scope,
      max(target_count) - sum(floor_count) as remaining
    from scaled_targets
    group by scope
  ),
  bucket_targets as (
    select
      st.scope,
      st.points,
      st.floor_count + case
        when row_number() over (
          partition by st.scope
          order by st.remainder desc, st.points desc
        ) <= sr.remaining
          then 1
        else 0
      end as target_count
    from scaled_targets st
    join scope_remaining sr on sr.scope = st.scope
  ),
  base_video_scaled as (
    select
      bt.points,
      bt.target_count,
      case
        when v_base_target <= 0 then 0
        else floor(
          (bt.target_count::numeric * v_base_video_min::numeric) / v_base_target::numeric
        )::integer
      end as floor_count,
      case
        when v_base_target <= 0 then 0::numeric
        else (
          (bt.target_count::numeric * v_base_video_min::numeric) / v_base_target::numeric
        ) - floor(
          (bt.target_count::numeric * v_base_video_min::numeric) / v_base_target::numeric
        )
      end as remainder
    from bucket_targets bt
    where bt.scope = 'base'
  ),
  base_video_remaining as (
    select
      v_base_video_min - coalesce(sum(floor_count), 0) as remaining
    from base_video_scaled
  ),
  base_bucket_video_targets as (
    select
      bvs.points,
      bvs.target_count,
      least(
        bvs.target_count,
        bvs.floor_count + case
          when row_number() over (
            order by bvs.remainder desc, bvs.points desc
          ) <= greatest(0, (select remaining from base_video_remaining))
            then 1
          else 0
        end
      ) as video_min
    from base_video_scaled bvs
  ),
  candidate_pool as (
    select
      q.id,
      q.question_source_id,
      q.scope,
      q.points,
      q.media_type,
      q.difficulty_seed,
      coalesce(state.times_seen, 0) as times_seen,
      coalesce(state.times_wrong, 0) as times_wrong,
      state.review_due_at,
      (
        q.difficulty_seed
        - case
          when coalesce(state.times_seen, 0) = 0 then 50
          else 0
        end
        - case
          when state.review_due_at is not null and state.review_due_at <= v_now
            then 10
          else 0
        end
        - (coalesce(state.times_wrong, 0) * 6)
        + (coalesce(state.times_seen, 0) * 2)
      ) as priority_score
    from public.questions q
    left join public.question_user_state state
      on state.question_id = q.id
      and state.user_id = v_user_id
    where q.is_active = true
      and p_current_category::text = any(q.categories)
      and q.scope in ('base', 'specialist')
  ),
  pool_counts as (
    select
      scope,
      points,
      count(*)::integer as available_count
    from candidate_pool
    group by scope, points
  ),
  missing_bucket as (
    select
      bt.scope,
      bt.points,
      bt.target_count,
      coalesce(pc.available_count, 0) as available_count
    from bucket_targets bt
    left join pool_counts pc
      on pc.scope = bt.scope
      and pc.points = bt.points
    where bt.target_count > coalesce(pc.available_count, 0)
  ),
  ranked_base_videos as (
    select
      pool.id,
      pool.scope,
      pool.points,
      row_number() over (
        partition by pool.points
        order by
          pool.priority_score asc,
          md5(pool.question_source_id || v_user_id::text || v_now::date::text)
      ) as media_rank
    from candidate_pool pool
    where pool.scope = 'base'
      and pool.media_type = 'video'
  ),
  base_video_picks as (
    select
      ranked.id,
      ranked.scope,
      ranked.points
    from ranked_base_videos ranked
    join base_bucket_video_targets bvt
      on bvt.points = ranked.points
    where ranked.media_rank <= bvt.video_min
  ),
  base_video_picked_counts as (
    select
      bvt.points,
      bvt.target_count,
      coalesce(count(picks.id), 0)::integer as picked_count
    from base_bucket_video_targets bvt
    left join base_video_picks picks on picks.points = bvt.points
    group by bvt.points, bvt.target_count
  ),
  ranked_base_fill as (
    select
      pool.id,
      pool.scope,
      pool.points,
      row_number() over (
        partition by pool.points
        order by
          case
            when pool.media_type = 'video' then 1
            else 0
          end asc,
          pool.priority_score asc,
          md5(pool.question_source_id || v_user_id::text || v_now::date::text)
      ) as fill_rank
    from candidate_pool pool
    where pool.scope = 'base'
      and not exists (
        select 1
        from base_video_picks picks
        where picks.id = pool.id
      )
  ),
  base_fill_picks as (
    select
      ranked.id,
      ranked.scope,
      ranked.points
    from ranked_base_fill ranked
    join base_video_picked_counts vpc
      on vpc.points = ranked.points
    where ranked.fill_rank <= greatest(0, vpc.target_count - vpc.picked_count)
  ),
  ranked_specialist as (
    select
      pool.id,
      pool.scope,
      pool.points,
      row_number() over (
        partition by pool.points
        order by
          pool.priority_score asc,
          md5(pool.question_source_id || v_user_id::text || v_now::date::text)
      ) as bucket_rank
    from candidate_pool pool
    where pool.scope = 'specialist'
  ),
  specialist_picks as (
    select
      ranked.id,
      ranked.scope,
      ranked.points
    from ranked_specialist ranked
    join bucket_targets bt
      on bt.scope = ranked.scope
      and bt.points = ranked.points
    where ranked.bucket_rank <= bt.target_count
  ),
  selected_questions as (
    select
      picked.id,
      picked.scope,
      picked.points,
      row_number() over (
        order by
          case
            when picked.scope = 'base' then 0
            else 1
          end,
          picked.points desc,
          md5(picked.id::text || v_user_id::text || v_now::text)
      ) as question_order
    from (
      select id, scope, points from base_video_picks
      union all
      select id, scope, points from base_fill_picks
      union all
      select id, scope, points from specialist_picks
    ) picked
  )
  select
    array_agg(selected.id order by selected.question_order),
    count(*)::integer,
    coalesce(sum(selected.points), 0)::integer,
    (
      select count(*)::integer
      from missing_bucket
    )
  into
    v_question_ids,
    v_selected_count,
    v_total_points,
    v_missing_bucket_count
  from selected_questions selected;

  if v_missing_bucket_count > 0 then
    raise exception 'Not enough active questions to build the requested exam mix for category "%".', p_current_category
      using errcode = 'P0001';
  end if;

  if v_selected_count <> v_total_questions_target or v_question_ids is null then
    raise exception 'Exam generator produced "%" questions, expected "%".', v_selected_count, v_total_questions_target
      using errcode = 'P0001';
  end if;

  v_pass_points := greatest(
    1,
    round((v_total_points::numeric * 68) / 74)::integer
  );
  v_duration_minutes := public.get_exam_duration_minutes(v_total_questions_target);

  insert into public.exam_sessions (
    id,
    user_id,
    study_plan_id,
    mode,
    current_category,
    session_locale,
    status,
    question_ids,
    current_question_index,
    total_questions_target,
    total_questions_answered,
    total_points_target,
    pass_points,
    score_points,
    correct_answers_count,
    wrong_answers_count,
    passed,
    started_at,
    finished_at,
    expires_at,
    metadata
  )
  values (
    v_new_session_id,
    v_user_id,
    p_study_plan_id,
    p_mode,
    p_current_category,
    p_session_locale,
    'active',
    v_question_ids,
    1,
    v_total_questions_target,
    0,
    v_total_points,
    v_pass_points,
    0,
    0,
    0,
    null,
    v_now,
    null,
    v_now + make_interval(mins => v_duration_minutes),
    p_metadata || jsonb_build_object(
      'requested_total_questions',
      p_requested_total_questions,
      'generated_total_questions',
      v_total_questions_target,
      'generated_at',
      v_now,
      'base_video_min_target',
      v_base_video_min
    )
  );

  return public.get_exam_session_snapshot(v_new_session_id);
end;
$$;

create or replace function public.recompute_exam_session_progress(
  p_exam_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_questions_target smallint := 0;
  v_pass_points smallint := 0;
  v_status public.exam_session_status;
  v_answered integer := 0;
  v_correct integer := 0;
  v_wrong integer := 0;
  v_score integer := 0;
  v_last_answered_at timestamptz;
begin
  select
    total_questions_target,
    pass_points,
    status
  into
    v_total_questions_target,
    v_pass_points,
    v_status
  from public.exam_sessions
  where id = p_exam_session_id;

  if not found then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where is_correct)::integer,
    count(*) filter (where not is_correct)::integer,
    coalesce(sum(points_awarded), 0)::integer,
    max(answered_at)
  into
    v_answered,
    v_correct,
    v_wrong,
    v_score,
    v_last_answered_at
  from public.exam_session_answers
  where exam_session_id = p_exam_session_id;

  update public.exam_sessions
  set
    total_questions_answered = coalesce(v_answered, 0),
    correct_answers_count = coalesce(v_correct, 0),
    wrong_answers_count = coalesce(v_wrong, 0),
    score_points = greatest(0, least(total_points_target, coalesce(v_score, 0))),
    current_question_index = least(
      total_questions_target + 1,
      greatest(1, coalesce(v_answered, 0) + 1)
    ),
    passed = case
      when coalesce(v_answered, 0) >= v_total_questions_target
        then coalesce(v_score, 0) >= v_pass_points
      else null
    end,
    finished_at = case
      when v_status in ('abandoned', 'expired') then finished_at
      when coalesce(v_answered, 0) >= v_total_questions_target
        then coalesce(v_last_answered_at, finished_at, timezone('utc', now()))
      else null
    end,
    status = case
      when v_status in ('abandoned', 'expired') then v_status
      when coalesce(v_answered, 0) >= v_total_questions_target then 'completed'
      else 'active'
    end,
    updated_at = timezone('utc', now())
  where id = p_exam_session_id;
end;
$$;

create or replace function public.sync_exam_session_after_answer_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_exam_session_progress(old.exam_session_id);
    return old;
  end if;

  perform public.recompute_exam_session_progress(new.exam_session_id);

  if tg_op = 'UPDATE'
    and old.exam_session_id is distinct from new.exam_session_id
  then
    perform public.recompute_exam_session_progress(old.exam_session_id);
  end if;

  return new;
end;
$$;

create or replace function public.has_active_entitlement(
  p_feature public.app_feature,
  p_at timestamptz default null
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.feature_entitlements e
    where e.user_id = auth.uid()
      and e.status = 'active'
      and e.starts_at <= coalesce(p_at, timezone('utc', now()))
      and (
        e.ends_at is null
        or e.ends_at >= coalesce(p_at, timezone('utc', now()))
      )
      and (
        e.feature_key = p_feature
        or e.feature_key = 'premium_access'
      )
  );
$$;

create or replace function public.redeem_school_code(
  p_code text
)
returns table (
  school_id uuid,
  school_name text,
  school_membership_id uuid,
  school_code_id uuid,
  granted_features public.app_feature[],
  access_starts_at timestamptz,
  access_ends_at timestamptz,
  was_already_member boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_code public.school_codes%rowtype;
  v_school public.schools%rowtype;
  v_membership public.school_memberships%rowtype;
  v_feature public.app_feature;
  v_access_ends_at timestamptz;
  v_created_membership boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_code is null or length(btrim(p_code)) = 0 then
    raise exception 'School code is required';
  end if;

  select *
  into v_code
  from public.school_codes
  where code = upper(btrim(p_code))
  for update;

  if not found then
    raise exception 'School code not found';
  end if;

  if v_code.status <> 'active' then
    raise exception 'School code is not active';
  end if;

  if v_code.valid_from is not null and v_code.valid_from > v_now then
    raise exception 'School code is not active yet';
  end if;

  if v_code.valid_until is not null and v_code.valid_until < v_now then
    raise exception 'School code expired';
  end if;

  select *
  into v_school
  from public.schools
  where id = v_code.school_id;

  if not found or v_school.is_active = false then
    raise exception 'School is not available';
  end if;

  select *
  into v_membership
  from public.school_memberships
  where school_id = v_code.school_id
    and user_id = v_user_id
  for update;

  v_access_ends_at := v_now + make_interval(days => v_code.grants_days);

  if found
    and v_membership.status = 'active'
    and (
      v_membership.ends_at is null
      or v_membership.ends_at >= v_now
    )
  then
    school_id := v_school.id;
    school_name := v_school.display_name;
    school_membership_id := v_membership.id;
    school_code_id := v_code.id;
    granted_features := v_code.granted_features;
    access_starts_at := v_membership.started_at;
    access_ends_at := v_membership.ends_at;
    was_already_member := true;
    return next;
    return;
  end if;

  if not found then
    if v_code.max_redemptions is not null
      and v_code.redeemed_count >= v_code.max_redemptions
    then
      raise exception 'School code redemption limit reached';
    end if;

    insert into public.school_memberships (
      school_id,
      user_id,
      school_code_id,
      role,
      status,
      started_at,
      ends_at,
      metadata
    )
    values (
      v_code.school_id,
      v_user_id,
      v_code.id,
      'student',
      'active',
      v_now,
      v_access_ends_at,
      jsonb_build_object('redeemed_code', v_code.code)
    )
    returning *
    into v_membership;

    v_created_membership := true;
  else
    update public.school_memberships
    set
      school_code_id = v_code.id,
      role = 'student',
      status = 'active',
      started_at = v_now,
      ends_at = v_access_ends_at,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'redeemed_code',
        v_code.code,
        'reactivated_at',
        v_now
      ),
      updated_at = timezone('utc', now())
    where id = v_membership.id
    returning *
    into v_membership;
  end if;

  if v_created_membership then
    update public.school_codes
    set
      redeemed_count = redeemed_count + 1,
      status = case
        when max_redemptions is not null
          and redeemed_count + 1 >= max_redemptions
          then 'depleted'
        else status
      end,
      updated_at = timezone('utc', now())
    where id = v_code.id
    returning *
    into v_code;
  end if;

  foreach v_feature in array v_code.granted_features loop
    insert into public.feature_entitlements (
      user_id,
      feature_key,
      source_type,
      status,
      school_id,
      school_membership_id,
      school_code_id,
      starts_at,
      ends_at,
      metadata
    )
    values (
      v_user_id,
      v_feature,
      'school_code',
      'active',
      v_code.school_id,
      v_membership.id,
      v_code.id,
      v_now,
      v_access_ends_at,
      jsonb_build_object('redeemed_code', v_code.code)
    )
    on conflict (user_id, feature_key, source_type, school_id)
    do update set
      status = excluded.status,
      school_membership_id = excluded.school_membership_id,
      school_code_id = excluded.school_code_id,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      metadata = public.feature_entitlements.metadata || jsonb_build_object(
        'redeemed_code',
        v_code.code,
        'last_redeemed_at',
        v_now
      ),
      updated_at = timezone('utc', now());
  end loop;

  school_id := v_school.id;
  school_name := v_school.display_name;
  school_membership_id := v_membership.id;
  school_code_id := v_code.id;
  granted_features := v_code.granted_features;
  access_starts_at := v_membership.started_at;
  access_ends_at := v_membership.ends_at;
  was_already_member := false;
  return next;
end;
$$;

drop trigger if exists set_exam_sessions_updated_at on public.exam_sessions;
create trigger set_exam_sessions_updated_at
  before update on public.exam_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists set_exam_session_answers_updated_at on public.exam_session_answers;
create trigger set_exam_session_answers_updated_at
  before update on public.exam_session_answers
  for each row execute function public.set_updated_at();

drop trigger if exists set_bookmarks_updated_at on public.bookmarks;
create trigger set_bookmarks_updated_at
  before update on public.bookmarks
  for each row execute function public.set_updated_at();

drop trigger if exists set_schools_updated_at on public.schools;
create trigger set_schools_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

drop trigger if exists set_school_codes_updated_at on public.school_codes;
create trigger set_school_codes_updated_at
  before update on public.school_codes
  for each row execute function public.set_updated_at();

drop trigger if exists set_school_memberships_updated_at on public.school_memberships;
create trigger set_school_memberships_updated_at
  before update on public.school_memberships
  for each row execute function public.set_updated_at();

drop trigger if exists set_feature_entitlements_updated_at on public.feature_entitlements;
create trigger set_feature_entitlements_updated_at
  before update on public.feature_entitlements
  for each row execute function public.set_updated_at();

drop trigger if exists sync_exam_session_after_answer_insert on public.exam_session_answers;
create trigger sync_exam_session_after_answer_insert
  after insert on public.exam_session_answers
  for each row execute function public.sync_exam_session_after_answer_change();

drop trigger if exists sync_exam_session_after_answer_update on public.exam_session_answers;
create trigger sync_exam_session_after_answer_update
  after update on public.exam_session_answers
  for each row execute function public.sync_exam_session_after_answer_change();

drop trigger if exists sync_exam_session_after_answer_delete on public.exam_session_answers;
create trigger sync_exam_session_after_answer_delete
  after delete on public.exam_session_answers
  for each row execute function public.sync_exam_session_after_answer_change();

grant select, insert, update on public.exam_sessions to authenticated;
grant select, insert, update on public.exam_session_answers to authenticated;
grant select, insert, update, delete on public.bookmarks to authenticated;
grant select, insert on public.ai_messages to authenticated;
grant select on public.schools to authenticated;
grant select on public.school_memberships to authenticated;
grant select on public.feature_entitlements to authenticated;

grant all on public.exam_sessions to service_role;
grant all on public.exam_session_answers to service_role;
grant all on public.bookmarks to service_role;
grant all on public.ai_messages to service_role;
grant all on public.schools to service_role;
grant all on public.school_codes to service_role;
grant all on public.school_memberships to service_role;
grant all on public.feature_entitlements to service_role;

grant execute on function public.has_active_entitlement(public.app_feature, timestamptz) to authenticated;
grant execute on function public.redeem_school_code(text) to authenticated;

alter table public.exam_sessions enable row level security;
alter table public.exam_session_answers enable row level security;
alter table public.bookmarks enable row level security;
alter table public.ai_messages enable row level security;
alter table public.schools enable row level security;
alter table public.school_codes enable row level security;
alter table public.school_memberships enable row level security;
alter table public.feature_entitlements enable row level security;

drop policy if exists exam_sessions_select_own on public.exam_sessions;
create policy exam_sessions_select_own
  on public.exam_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists exam_sessions_insert_own on public.exam_sessions;
create policy exam_sessions_insert_own
  on public.exam_sessions
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (
      study_plan_id is null
      or exists (
        select 1
        from public.study_plans p
        where p.id = study_plan_id
          and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists exam_sessions_update_own on public.exam_sessions;
create policy exam_sessions_update_own
  on public.exam_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      study_plan_id is null
      or exists (
        select 1
        from public.study_plans p
        where p.id = study_plan_id
          and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists exam_session_answers_select_own on public.exam_session_answers;
create policy exam_session_answers_select_own
  on public.exam_session_answers
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists exam_session_answers_insert_own on public.exam_session_answers;
create policy exam_session_answers_insert_own
  on public.exam_session_answers
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.exam_sessions s
      where s.id = exam_session_id
        and s.user_id = auth.uid()
        and question_order <= s.total_questions_target
    )
    and (
      question_attempt_id is null
      or exists (
        select 1
        from public.question_attempts a
        where a.id = question_attempt_id
          and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists exam_session_answers_update_own on public.exam_session_answers;
create policy exam_session_answers_update_own
  on public.exam_session_answers
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.exam_sessions s
      where s.id = exam_session_id
        and s.user_id = auth.uid()
        and question_order <= s.total_questions_target
    )
    and (
      question_attempt_id is null
      or exists (
        select 1
        from public.question_attempts a
        where a.id = question_attempt_id
          and a.user_id = auth.uid()
      )
    )
  );

drop policy if exists bookmarks_select_own on public.bookmarks;
create policy bookmarks_select_own
  on public.bookmarks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists bookmarks_insert_own on public.bookmarks;
create policy bookmarks_insert_own
  on public.bookmarks
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists bookmarks_update_own on public.bookmarks;
create policy bookmarks_update_own
  on public.bookmarks
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bookmarks_delete_own on public.bookmarks;
create policy bookmarks_delete_own
  on public.bookmarks
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists ai_messages_select_own_visible on public.ai_messages;
create policy ai_messages_select_own_visible
  on public.ai_messages
  for select
  to authenticated
  using (
    auth.uid() = user_id
    and is_visible_to_user = true
  );

drop policy if exists ai_messages_insert_own_user_role on public.ai_messages;
create policy ai_messages_insert_own_user_role
  on public.ai_messages
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and message_role = 'user'
    and is_visible_to_user = true
    and (
      question_id is null
      or exists (
        select 1
        from public.questions q
        where q.id = question_id
          and q.is_active = true
      )
    )
    and (
      study_plan_id is null
      or exists (
        select 1
        from public.study_plans p
        where p.id = study_plan_id
          and p.user_id = auth.uid()
      )
    )
    and (
      exam_session_id is null
      or exists (
        select 1
        from public.exam_sessions s
        where s.id = exam_session_id
          and s.user_id = auth.uid()
      )
    )
  );

drop policy if exists schools_select_active_or_member on public.schools;
create policy schools_select_active_or_member
  on public.schools
  for select
  to authenticated
  using (
    is_active = true
    or exists (
      select 1
      from public.school_memberships m
      where m.school_id = id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists school_memberships_select_own on public.school_memberships;
create policy school_memberships_select_own
  on public.school_memberships
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists feature_entitlements_select_own on public.feature_entitlements;
create policy feature_entitlements_select_own
  on public.feature_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values
  ('question-images', 'question-images', true),
  ('question-videos', 'question-videos', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

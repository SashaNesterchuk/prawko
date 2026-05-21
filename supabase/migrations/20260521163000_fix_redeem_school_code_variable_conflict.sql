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
#variable_conflict use_column
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
  from public.school_codes sc
  where sc.code = upper(btrim(p_code))
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
  from public.schools s
  where s.id = v_code.school_id;

  if not found or v_school.is_active = false then
    raise exception 'School is not available';
  end if;

  select *
  into v_membership
  from public.school_memberships m
  where m.school_id = v_code.school_id
    and m.user_id = v_user_id
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

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'school_code_status'
  ) then
    create type public.school_code_status as enum (
      'active',
      'disabled',
      'expired',
      'depleted'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'school_membership_role'
  ) then
    create type public.school_membership_role as enum ('student', 'manager', 'owner');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'school_membership_status'
  ) then
    create type public.school_membership_status as enum (
      'active',
      'expired',
      'revoked'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'app_feature'
  ) then
    create type public.app_feature as enum (
      'premium_access',
      'ai_explanations',
      'ai_question_chat',
      'exam_simulator'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'entitlement_source_type'
  ) then
    create type public.entitlement_source_type as enum (
      'trial',
      'purchase',
      'school_code',
      'manual'
    );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'entitlement_status'
  ) then
    create type public.entitlement_status as enum (
      'active',
      'scheduled',
      'expired',
      'revoked'
    );
  end if;
end
$$;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  city text,
  supported_locales public.app_locale[] not null default array['ua'::public.app_locale],
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint schools_slug_not_blank
    check (length(btrim(slug)) > 0),
  constraint schools_display_name_not_blank
    check (length(btrim(display_name)) > 0),
  constraint schools_supported_locales_not_empty
    check (coalesce(array_length(supported_locales, 1), 0) > 0),
  constraint schools_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.school_codes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null unique,
  status public.school_code_status not null default 'active',
  max_redemptions integer check (
    max_redemptions is null
    or max_redemptions > 0
  ),
  redeemed_count integer not null default 0 check (
    redeemed_count >= 0
    and (
      max_redemptions is null
      or redeemed_count <= max_redemptions
    )
  ),
  grants_days smallint not null default 90 check (grants_days between 1 and 365),
  granted_features public.app_feature[] not null default array[
    'premium_access'::public.app_feature,
    'ai_explanations'::public.app_feature,
    'ai_question_chat'::public.app_feature,
    'exam_simulator'::public.app_feature
  ],
  valid_from timestamptz,
  valid_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_codes_code_normalized
    check (
      code = upper(btrim(code))
      and length(code) between 4 and 32
    ),
  constraint school_codes_valid_window
    check (valid_until is null or valid_from is null or valid_until >= valid_from),
  constraint school_codes_granted_features_not_empty
    check (coalesce(array_length(granted_features, 1), 0) > 0),
  constraint school_codes_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create table if not exists public.school_memberships (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  school_code_id uuid references public.school_codes(id) on delete set null,
  role public.school_membership_role not null default 'student',
  status public.school_membership_status not null default 'active',
  started_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_memberships_valid_window
    check (ends_at is null or ends_at >= started_at),
  constraint school_memberships_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint school_memberships_school_user_unique unique (school_id, user_id)
);

create table if not exists public.feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_key public.app_feature not null,
  source_type public.entitlement_source_type not null,
  status public.entitlement_status not null default 'active',
  school_id uuid references public.schools(id) on delete set null,
  school_membership_id uuid references public.school_memberships(id) on delete set null,
  school_code_id uuid references public.school_codes(id) on delete set null,
  external_reference text,
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint feature_entitlements_valid_window
    check (ends_at is null or ends_at >= starts_at),
  constraint feature_entitlements_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint feature_entitlements_school_source_refs
    check (
      source_type <> 'school_code'
      or (
        school_id is not null
        and school_membership_id is not null
        and school_code_id is not null
      )
    ),
  constraint feature_entitlements_user_feature_source_school_unique
    unique (user_id, feature_key, source_type, school_id)
);

create index if not exists schools_active_slug_idx
  on public.schools (is_active, slug);

create index if not exists school_codes_school_status_idx
  on public.school_codes (school_id, status);

create index if not exists school_memberships_user_status_idx
  on public.school_memberships (user_id, status);

create index if not exists feature_entitlements_user_feature_idx
  on public.feature_entitlements (user_id, feature_key, status);

create index if not exists feature_entitlements_user_active_window_idx
  on public.feature_entitlements (user_id, starts_at asc, ends_at asc)
  where status = 'active';

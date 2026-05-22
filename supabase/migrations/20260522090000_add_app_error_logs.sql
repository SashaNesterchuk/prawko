do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'app_log_severity'
  ) then
    create type public.app_log_severity as enum (
      'info',
      'warning',
      'error',
      'critical'
    );
  end if;
end
$$;

create table if not exists public.app_error_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null,
  area text not null,
  event_name text not null,
  severity public.app_log_severity not null default 'error',
  message text not null,
  error_name text,
  error_code text,
  auth_mode text,
  platform text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint app_error_logs_source_not_blank
    check (length(btrim(source)) > 0),
  constraint app_error_logs_area_not_blank
    check (length(btrim(area)) > 0),
  constraint app_error_logs_event_name_not_blank
    check (length(btrim(event_name)) > 0),
  constraint app_error_logs_message_not_blank
    check (length(btrim(message)) > 0),
  constraint app_error_logs_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists app_error_logs_created_at_idx
  on public.app_error_logs (created_at desc);

create index if not exists app_error_logs_severity_created_at_idx
  on public.app_error_logs (severity, created_at desc);

create index if not exists app_error_logs_area_created_at_idx
  on public.app_error_logs (area, created_at desc);

create index if not exists app_error_logs_user_created_at_idx
  on public.app_error_logs (user_id, created_at desc)
  where user_id is not null;

create or replace function public.log_client_error(
  p_source text,
  p_area text,
  p_event_name text,
  p_message text,
  p_severity public.app_log_severity default 'error',
  p_error_name text default null,
  p_error_code text default null,
  p_auth_mode text default null,
  p_platform text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_error_log_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required to log client errors.';
  end if;

  insert into public.app_error_logs (
    user_id,
    source,
    area,
    event_name,
    severity,
    message,
    error_name,
    error_code,
    auth_mode,
    platform,
    metadata
  )
  values (
    v_user_id,
    btrim(p_source),
    btrim(p_area),
    btrim(p_event_name),
    p_severity,
    btrim(p_message),
    nullif(btrim(coalesce(p_error_name, '')), ''),
    nullif(btrim(coalesce(p_error_code, '')), ''),
    nullif(btrim(coalesce(p_auth_mode, '')), ''),
    nullif(btrim(coalesce(p_platform, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_error_log_id;

  return v_error_log_id;
end;
$$;

revoke all on function public.log_client_error(
  text,
  text,
  text,
  text,
  public.app_log_severity,
  text,
  text,
  text,
  text,
  jsonb
) from public;

grant execute on function public.log_client_error(
  text,
  text,
  text,
  text,
  public.app_log_severity,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

grant all on public.app_error_logs to service_role;

alter table public.app_error_logs enable row level security;

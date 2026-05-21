create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_locale text;
  raw_category text;
begin
  raw_locale := coalesce(new.raw_user_meta_data ->> 'locale', '');
  raw_category := upper(coalesce(new.raw_user_meta_data ->> 'category', ''));

  insert into public.profiles (
    id,
    full_name,
    interface_locale,
    current_category,
    timezone
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    ),
    case
      when raw_locale in ('pl', 'ua', 'en') then raw_locale::public.app_locale
      else 'ua'::public.app_locale
    end,
    case
      when raw_category in ('AM', 'A1', 'A2', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'T')
        then raw_category::public.driving_category
      else 'B'::public.driving_category
    end,
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Europe/Warsaw')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

insert into public.profiles (
  id,
  full_name,
  interface_locale,
  current_category,
  timezone
)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name'
  ) as full_name,
  case
    when coalesce(users.raw_user_meta_data ->> 'locale', '') in ('pl', 'ua', 'en')
      then (users.raw_user_meta_data ->> 'locale')::public.app_locale
    else 'ua'::public.app_locale
  end as interface_locale,
  case
    when upper(coalesce(users.raw_user_meta_data ->> 'category', '')) in ('AM', 'A1', 'A2', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'T')
      then upper(users.raw_user_meta_data ->> 'category')::public.driving_category
    else 'B'::public.driving_category
  end as current_category,
  coalesce(users.raw_user_meta_data ->> 'timezone', 'Europe/Warsaw') as timezone
from auth.users as users
left join public.profiles as profiles
  on profiles.id = users.id
where profiles.id is null;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

drop trigger if exists set_study_plans_updated_at on public.study_plans;
create trigger set_study_plans_updated_at
  before update on public.study_plans
  for each row execute function public.set_updated_at();

grant select, insert, update on public.profiles to authenticated;
grant select on public.questions to authenticated;
grant select, insert on public.question_attempts to authenticated;
grant select, insert, update on public.study_plans to authenticated;
grant all on public.profiles to service_role;
grant all on public.questions to service_role;
grant all on public.question_attempts to service_role;
grant all on public.study_plans to service_role;

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.question_attempts enable row level security;
alter table public.study_plans enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists questions_select_authenticated on public.questions;
create policy questions_select_authenticated
  on public.questions
  for select
  to authenticated
  using (is_active = true);

drop policy if exists question_attempts_select_own on public.question_attempts;
create policy question_attempts_select_own
  on public.question_attempts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists question_attempts_insert_own on public.question_attempts;
create policy question_attempts_insert_own
  on public.question_attempts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists study_plans_select_own on public.study_plans;
create policy study_plans_select_own
  on public.study_plans
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists study_plans_insert_own on public.study_plans;
create policy study_plans_insert_own
  on public.study_plans
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists study_plans_update_own on public.study_plans;
create policy study_plans_update_own
  on public.study_plans
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

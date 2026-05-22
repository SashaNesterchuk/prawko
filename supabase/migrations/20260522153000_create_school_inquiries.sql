do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'school_inquiry_status'
  ) then
    create type public.school_inquiry_status as enum (
      'new',
      'contacted',
      'qualified',
      'won',
      'lost',
      'spam'
    );
  end if;
end
$$;

create table if not exists public.school_inquiries (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  city text,
  website_url text,
  student_locales public.app_locale[] not null,
  estimated_students integer,
  current_solution text,
  message text not null,
  source_page text not null default '/schools',
  status public.school_inquiry_status not null default 'new',
  admin_notes text,
  handled_by_email text,
  handled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_inquiries_organization_name_length
    check (length(btrim(organization_name)) between 2 and 120),
  constraint school_inquiries_contact_name_length
    check (length(btrim(contact_name)) between 2 and 120),
  constraint school_inquiries_email_shape
    check (length(btrim(email)) between 5 and 160 and position('@' in email) > 1),
  constraint school_inquiries_phone_length
    check (phone is null or length(btrim(phone)) between 6 and 40),
  constraint school_inquiries_city_length
    check (city is null or length(btrim(city)) between 2 and 120),
  constraint school_inquiries_website_length
    check (website_url is null or length(btrim(website_url)) <= 240),
  constraint school_inquiries_locales_present
    check (coalesce(array_length(student_locales, 1), 0) > 0),
  constraint school_inquiries_estimated_students_range
    check (estimated_students is null or estimated_students between 1 and 5000),
  constraint school_inquiries_current_solution_length
    check (current_solution is null or length(btrim(current_solution)) <= 160),
  constraint school_inquiries_message_length
    check (length(btrim(message)) between 10 and 2000),
  constraint school_inquiries_source_page_not_blank
    check (length(btrim(source_page)) > 0),
  constraint school_inquiries_admin_notes_length
    check (admin_notes is null or length(admin_notes) <= 2000),
  constraint school_inquiries_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists school_inquiries_status_created_at_idx
  on public.school_inquiries (status, created_at desc);

create index if not exists school_inquiries_created_at_idx
  on public.school_inquiries (created_at desc);

drop trigger if exists set_school_inquiries_updated_at on public.school_inquiries;
create trigger set_school_inquiries_updated_at
  before update on public.school_inquiries
  for each row execute function public.set_updated_at();

grant select, insert, update on public.school_inquiries to service_role;

alter table public.school_inquiries enable row level security;

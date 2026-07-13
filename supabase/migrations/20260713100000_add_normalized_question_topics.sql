create table if not exists public.question_topic_catalog (
  id text primary key,
  sort_order integer not null unique check (sort_order > 0),
  title_ua text not null,
  title_pl text not null,
  title_en text not null,
  source_label_ua text not null,
  notes_ua text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.questions
  add column if not exists primary_topic_id text references public.question_topic_catalog(id),
  add column if not exists topic_ids text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_primary_topic_in_topic_ids'
  ) then
    alter table public.questions
      add constraint questions_primary_topic_in_topic_ids
      check (
        primary_topic_id is null
        or primary_topic_id = any(topic_ids)
      );
  end if;
end
$$;

create index if not exists questions_primary_topic_idx
  on public.questions (primary_topic_id)
  where primary_topic_id is not null;

create index if not exists questions_topic_ids_gin_idx
  on public.questions using gin (topic_ids);

drop trigger if exists set_question_topic_catalog_updated_at on public.question_topic_catalog;
create trigger set_question_topic_catalog_updated_at
  before update on public.question_topic_catalog
  for each row execute function public.set_updated_at();

grant select on public.question_topic_catalog to authenticated;
grant all on public.question_topic_catalog to service_role;

alter table public.question_topic_catalog enable row level security;

drop policy if exists question_topic_catalog_select_authenticated on public.question_topic_catalog;
create policy question_topic_catalog_select_authenticated
  on public.question_topic_catalog
  for select
  to authenticated
  using (is_active = true);

grant select on public.question_topic_catalog to anon;

drop policy if exists question_topic_catalog_select_anon on public.question_topic_catalog;
create policy question_topic_catalog_select_anon
  on public.question_topic_catalog
  for select
  to anon
  using (is_active = true);

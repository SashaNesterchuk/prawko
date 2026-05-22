do $$
begin
  if not exists (
    select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'ai_review_status'
  ) then
    create type public.ai_review_status as enum (
      'pending',
      'approved',
      'flagged',
      'rejected'
    );
  end if;
end
$$;

create table if not exists public.ai_message_reviews (
  id uuid primary key default gen_random_uuid(),
  ai_message_id uuid not null unique references public.ai_messages(id) on delete cascade,
  review_status public.ai_review_status not null default 'pending',
  reviewer_email text,
  review_notes text,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ai_message_reviews_metadata_is_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint ai_message_reviews_notes_length
    check (review_notes is null or length(review_notes) <= 2000)
);

create index if not exists ai_message_reviews_status_updated_idx
  on public.ai_message_reviews (review_status, updated_at desc);

drop trigger if exists set_ai_message_reviews_updated_at on public.ai_message_reviews;
create trigger set_ai_message_reviews_updated_at
  before update on public.ai_message_reviews
  for each row execute function public.set_updated_at();

grant select, insert, update on public.ai_message_reviews to service_role;

alter table public.ai_message_reviews enable row level security;

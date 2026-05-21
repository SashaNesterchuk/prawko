create or replace function public.set_question_bookmark_state_by_source_id(
  p_question_source_id text,
  p_is_bookmarked boolean,
  p_saved_from_mode public.attempt_mode default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question_id uuid;
  v_bookmark_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  if p_metadata is null or jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'Bookmark metadata must be a JSON object.'
      using errcode = '22023';
  end if;

  select id
  into v_question_id
  from public.questions
  where question_source_id = p_question_source_id
    and is_active = true
  limit 1;

  if v_question_id is null then
    raise exception 'Question source id "%" was not found.', p_question_source_id
      using errcode = 'P0002';
  end if;

  if p_is_bookmarked then
    insert into public.bookmarks (
      user_id,
      question_id,
      saved_from_mode,
      metadata
    )
    values (
      v_user_id,
      v_question_id,
      p_saved_from_mode,
      p_metadata
    )
    on conflict (user_id, question_id)
    do update set
      saved_from_mode = excluded.saved_from_mode,
      metadata = excluded.metadata,
      updated_at = timezone('utc', now())
    returning id into v_bookmark_id;

    return v_bookmark_id;
  end if;

  delete from public.bookmarks
  where user_id = v_user_id
    and question_id = v_question_id
  returning id into v_bookmark_id;

  return v_bookmark_id;
end;
$$;

create or replace function public.set_question_hard_state_by_source_id(
  p_question_source_id text,
  p_is_hard boolean,
  p_review_due_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_question_id uuid;
  v_state_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authenticated user is required.'
      using errcode = '42501';
  end if;

  select id
  into v_question_id
  from public.questions
  where question_source_id = p_question_source_id
    and is_active = true
  limit 1;

  if v_question_id is null then
    raise exception 'Question source id "%" was not found.', p_question_source_id
      using errcode = 'P0002';
  end if;

  if p_is_hard then
    insert into public.question_user_state (
      user_id,
      question_id,
      is_hard,
      review_due_at
    )
    values (
      v_user_id,
      v_question_id,
      true,
      coalesce(p_review_due_at, timezone('utc', now()))
    )
    on conflict (user_id, question_id)
    do update set
      is_hard = true,
      review_due_at = coalesce(
        excluded.review_due_at,
        public.question_user_state.review_due_at,
        timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
    returning id into v_state_id;

    return v_state_id;
  end if;

  update public.question_user_state
  set
    is_hard = false,
    updated_at = timezone('utc', now())
  where user_id = v_user_id
    and question_id = v_question_id
  returning id into v_state_id;

  return v_state_id;
end;
$$;

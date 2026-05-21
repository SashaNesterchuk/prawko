alter table public.questions
  add column if not exists media_asset jsonb,
  add column if not exists pjm_question_asset jsonb,
  add column if not exists pjm_answer_a_asset jsonb,
  add column if not exists pjm_answer_b_asset jsonb,
  add column if not exists pjm_answer_c_asset jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_media_asset_is_object'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_media_asset_is_object
      check (media_asset is null or jsonb_typeof(media_asset) = 'object');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_pjm_question_asset_is_object'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_pjm_question_asset_is_object
      check (
        pjm_question_asset is null
        or jsonb_typeof(pjm_question_asset) = 'object'
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_pjm_answer_a_asset_is_object'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_pjm_answer_a_asset_is_object
      check (
        pjm_answer_a_asset is null
        or jsonb_typeof(pjm_answer_a_asset) = 'object'
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_pjm_answer_b_asset_is_object'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_pjm_answer_b_asset_is_object
      check (
        pjm_answer_b_asset is null
        or jsonb_typeof(pjm_answer_b_asset) = 'object'
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'questions_pjm_answer_c_asset_is_object'
      and conrelid = 'public.questions'::regclass
  ) then
    alter table public.questions
      add constraint questions_pjm_answer_c_asset_is_object
      check (
        pjm_answer_c_asset is null
        or jsonb_typeof(pjm_answer_c_asset) = 'object'
      );
  end if;
end
$$;

-- Trainer mode picker introduces two client session modes that attempts are
-- recorded against: unseen questions ("Нові питання") and 3-point questions
-- ("Складні питання"). record_question_attempt_by_source_id casts the client
-- mode to public.attempt_mode, so both labels must exist before rollout.

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typnamespace = 'public'::regnamespace
      and enum_type.typname = 'attempt_mode'
      and enum_value.enumlabel = 'new_questions'
  ) then
    alter type public.attempt_mode add value 'new_questions';
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typnamespace = 'public'::regnamespace
      and enum_type.typname = 'attempt_mode'
      and enum_value.enumlabel = 'high_points'
  ) then
    alter type public.attempt_mode add value 'high_points';
  end if;
end
$$;

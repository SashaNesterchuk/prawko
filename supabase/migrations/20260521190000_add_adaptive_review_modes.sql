do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typnamespace = 'public'::regnamespace
      and enum_type.typname = 'attempt_mode'
      and enum_value.enumlabel = 'hard_questions'
  ) then
    alter type public.attempt_mode add value 'hard_questions';
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
      and enum_value.enumlabel = 'seen_not_mastered'
  ) then
    alter type public.attempt_mode add value 'seen_not_mastered';
  end if;
end
$$;

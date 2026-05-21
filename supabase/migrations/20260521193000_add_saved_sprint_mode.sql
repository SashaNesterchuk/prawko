do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typnamespace = 'public'::regnamespace
      and enum_type.typname = 'attempt_mode'
      and enum_value.enumlabel = 'saved_sprint'
  ) then
    alter type public.attempt_mode add value 'saved_sprint';
  end if;
end
$$;

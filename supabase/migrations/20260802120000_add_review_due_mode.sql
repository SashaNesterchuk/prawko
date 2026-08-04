-- Smart review CTA opens a dedicated review_due queue. Attempts are recorded
-- with this mode via record_question_attempt_by_source_id, so the enum label
-- must exist before rollout.

do $$
begin
  if not exists (
    select 1
    from pg_enum enum_value
    join pg_type enum_type on enum_type.oid = enum_value.enumtypid
    where enum_type.typnamespace = 'public'::regnamespace
      and enum_type.typname = 'attempt_mode'
      and enum_value.enumlabel = 'review_due'
  ) then
    alter type public.attempt_mode add value 'review_due';
  end if;
end
$$;

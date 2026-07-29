-- Full exam / exam_tomorrow must always be WORD-sized (32).
-- Custom question counts are only valid for mini_test (study-plan scaling).
-- Previously any p_requested_total_questions overrode the mode default, so a
-- sticky client questionLimit from a mini test could shrink a full exam to 16.

create or replace function public.get_exam_total_questions_target(
  p_mode public.attempt_mode,
  p_requested_total_questions integer default null
)
returns integer
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_mode not in ('exam', 'mini_test', 'exam_tomorrow') then
    raise exception 'Exam mode "%" is not supported for simulator.', p_mode
      using errcode = '22023';
  end if;

  if p_mode <> 'mini_test' then
    return 32;
  end if;

  if p_requested_total_questions is not null then
    if p_requested_total_questions < 1 or p_requested_total_questions > 64 then
      raise exception 'Requested exam question count must be between 1 and 64.'
        using errcode = '22023';
    end if;

    return p_requested_total_questions;
  end if;

  return 12;
end;
$$;

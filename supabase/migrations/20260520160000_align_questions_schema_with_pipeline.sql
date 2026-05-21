alter table public.questions
  add column if not exists pjm_question_media_filename text,
  add column if not exists pjm_answer_a_media_filename text,
  add column if not exists pjm_answer_b_media_filename text,
  add column if not exists pjm_answer_c_media_filename text;

alter table public.questions
  drop constraint if exists questions_category_array_valid;

alter table public.questions
  add constraint questions_category_array_valid
  check (
    coalesce(array_length(categories, 1), 0) > 0
    and categories <@ array[
      'AM', 'A1', 'A2', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D', 'T', 'PT'
    ]::text[]
  );

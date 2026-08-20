-- Some official v1 exports reuse a display row number for distinct source ids.
-- `source_id` remains the stable per-set identity; row number is ordering only.
alter table public.questions_v2
  drop constraint if exists questions_v2_question_set_id_source_row_number_key;

create index if not exists questions_v2_set_source_row_number_idx
  on public.questions_v2(question_set_id, source_row_number);

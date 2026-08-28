-- Chat logs now point at the v2 catalogue. Legacy question_id values are
-- source ids or v1 UUIDs, neither of which exists in questions_v2.

alter table public.ai_messages
  drop constraint if exists ai_messages_question_id_fkey;

update public.ai_messages
set question_id = null
where question_id is not null
  and not exists (
    select 1
    from public.questions_v2 q
    where q.id = ai_messages.question_id
  );

alter table public.ai_messages
  add constraint ai_messages_question_id_fkey
  foreign key (question_id)
  references public.questions_v2(id)
  on delete set null;

comment on column public.ai_messages.question_id is
  'questions_v2.id; source ids stay in metadata.rawQuestionId';

-- Deactivating a country/set must hide all its catalogue children as well.
drop policy if exists question_topics_v2_read_active on public.question_topic_catalog_v2;
create policy question_topics_v2_read_active
  on public.question_topic_catalog_v2
  for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.question_sets s
      where s.id = question_set_id and s.is_active
    )
  );

drop policy if exists question_ai_explanations_v2_read_active on public.question_ai_explanations_v2;
create policy question_ai_explanations_v2_read_active
  on public.question_ai_explanations_v2
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.questions_v2 q
      join public.question_sets s on s.id = q.question_set_id
      where q.id = question_id and q.is_active and s.is_active
    )
  );

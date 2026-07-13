-- Temporary catalog access for pre-auth mobile builds.
-- Revisit when EXPO_PUBLIC_REQUIRE_AUTH_FOR_QUESTION_CATALOG is enabled.

grant select on public.questions to anon;

drop policy if exists questions_select_anon on public.questions;
create policy questions_select_anon
  on public.questions
  for select
  to anon
  using (is_active = true);

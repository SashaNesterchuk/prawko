insert into storage.buckets (id, name, public)
values
  ('question-posters', 'question-posters', true),
  ('question-pjm', 'question-pjm', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

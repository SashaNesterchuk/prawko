-- Czech content is added to v2 only.  The legacy Polish v1 catalogue remains
-- untouched and no media object or URL is stored here.
insert into public.question_sets (
  key,
  country_code,
  source_name,
  source_version,
  exam_config,
  is_active
)
values (
  'cz-v2-current',
  'CZ',
  'IS eTesty — Soubor všech otázek',
  '2026-08-19',
  '{
    "exam": {
      "question_count": 25,
      "max_points": 50,
      "pass_points": 43,
      "duration_minutes": 30
    },
    "source": {
      "publisher": "Ministerstvo dopravy České republiky",
      "landing_page": "https://etesty.md.gov.cz/ro/DLArea/Index?id=99"
    },
    "media": {
      "state": "deferred_to_r2"
    }
  }'::jsonb,
  true
)
on conflict (key) do update set
  country_code = excluded.country_code,
  source_name = excluded.source_name,
  source_version = excluded.source_version,
  exam_config = excluded.exam_config,
  is_active = excluded.is_active;

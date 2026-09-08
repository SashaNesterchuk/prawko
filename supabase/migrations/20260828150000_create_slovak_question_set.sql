-- Prepared only: do not apply until the Vodičák mirror snapshot has been
-- accepted for production use and its media plan has been approved.
--
-- This is a separate national question set. It never changes Polish or Czech
-- rows and starts inactive so public clients cannot select it prematurely.

insert into public.question_sets (
  key,
  country_code,
  source_name,
  source_version,
  exam_config,
  is_active
)
values (
  'sk-v2-current',
  'SK',
  'Vodičák catalogue mirror (MV SR attribution); licence groups cross-checked against 2023 Police Presidium PDF',
  'vodicak-snapshot-2026-09-08',
  '{
    "exam": {
      "question_count": 40,
      "max_points": 100,
      "pass_points": 90,
      "duration_minutes": 30,
      "navigation": "free",
      "answer_options_per_question": 3,
      "correct_answers_per_question": 1,
      "topic_mix": [8, 2, 8, 4, 1, 3, 2, 2, 8, 2],
      "topic_points": [3, 3, 2, 4, 2, 2, 1, 1, 3, 1],
      "baskets": [
        { "scope_id": 1, "count": 8, "points": 3 },
        { "scope_id": 2, "count": 2, "points": 3 },
        { "scope_id": 3, "count": 8, "points": 2 },
        { "scope_id": 4, "count": 4, "points": 4 },
        { "scope_id": 5, "count": 1, "points": 2 },
        { "scope_id": 6, "count": 3, "points": 2 },
        { "scope_id": 7, "count": 2, "points": 1 },
        { "scope_id": 8, "count": 2, "points": 1 },
        { "scope_id": 9, "count": 8, "points": 3 },
        { "scope_id": 10, "count": 2, "points": 1 }
      ]
    },
    "source": {
      "canonical_exam_rules": "https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2009/9/20260901",
      "canonical_question_authority": "https://www.minv.sk/?elektronicke-testy",
      "enumeration_mirror": "https://vodicak.app/otazky",
      "canonical_verification_required": true
    },
    "import_state": "prepared_locally_not_imported",
    "media": {
      "state": "r2_upload_pending",
      "delivery_path_prefix": "question-images/sk/questions/",
      "r2_upload_plan": "r2-upload-plan.json"
    }
  }'::jsonb,
  false
)
on conflict (key) do nothing;

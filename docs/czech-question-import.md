# Czech v2 question import

The Czech catalogue is imported into the existing shared `questions_v2` table.
It does not alter the Polish v1 tables or copy, upload, delete, or reference any
media object.

## Input

Use the prepared directory created from the official IS eTesty export:

```text
../czech-etesty-supabase-import-2026-08-19/
  questions.json
  question_options.json
```

For the current export this is 1,136 questions and 3,360 options. The importer
requires both files, validates each question's option count and correct answer,
and treats `question_media` and every option's `media` array as empty.

## Import order

From `prawko/`:

```bash
corepack pnpm exec supabase db push
corepack pnpm data:questions:v2:import-czech -- --dry-run --input ../czech-etesty-supabase-import-2026-08-19
corepack pnpm data:questions:v2:import-czech -- --input ../czech-etesty-supabase-import-2026-08-19 --batch-size 200
```

The first command creates/activates only `question_sets.key = 'cz-v2-current'`.
The second command is local and makes no database or R2 writes. The last command
uses `SUPABASE_SERVICE_ROLE_KEY`, upserts by `(question_set_id, source_id)`, and
is safe to run again. Its final report must contain:

```json
{
  "questionSetKey": "cz-v2-current",
  "totalQuestions": 1136,
  "totalOptions": 3360,
  "importedQuestionCount": 1136,
  "missingSourceIds": [],
  "mediaReferences": 0
}
```

`deferredMediaQuestionCount` is informational: it says how many official source
questions have media that has intentionally not been attached yet.

## Later R2 media attachment

Upload Czech files to the separate Czech R2 account using the same directory
convention you choose for that app. Keep the asset origin/base URL in the Czech
build configuration, not in Supabase. After upload, use a separate media-manifest
step to update only `questions_v2.content.question_media` or
`questions_v2.content.options[*].media`; do not rerun the text importer with
media fields. The source identity to match is `source_id` (for example,
`cz:RP1401114`).

The initial import retains `official_media_available` and official answer IDs in
`official_metadata`, so a later attachment process can match the source without
changing question text or answers.

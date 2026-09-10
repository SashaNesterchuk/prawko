# Slovak v2 question import

The prepared Slovak catalogue is a separate `question_sets` entry with key
`sk-v2-current`; it does not alter Polish or Czech question rows.

The package is generated locally at:

```text
data/sk-questions-vodicak/supabase-import/
  question_set.json
  question_topic_catalog_v2.json
  questions_v2.json
  question_media_manifest.json
  r2-upload-plan.json
  import-summary.json
```

`questions_v2.json` has 1,416 Slovak questions and 4,248 answer options. Every
row has exactly three options and one correct option. The ten official subject
areas are loaded into `question_topic_catalog_v2.json`.

Licence groups are taken from the locally stored 2023 Police Presidium Slovak
PDF, matched by its continuous topic order. A blank `pre skupinu` cell means
the question applies to all 16 licence groups, including B. This is expanded
in `category_codes` because the client filters Supabase rows by that field.

The question text and answers are a Vodičák catalogue snapshot, not a
canonical Ministry export. Each row retains mirror provenance, the MV SR
canonical URL, the source snapshot hash, and PDF group evidence in
`official_metadata`. The question set migration starts inactive.

Available question images have prepared R2 delivery assets in
`content.question_media`. Their object keys are stable and namespaced as
`question-images/sk/questions/...`; `r2-upload-plan.json` is the unique-file
upload plan. This preparation does not upload anything to R2. The media
manifest contains the local files and the eleven Vodičák paths that returned
404 during the snapshot.

## Local preparation and dry-run

```bash
node scripts/prepare-slovak-supabase-import.mjs
corepack pnpm data:questions:v2:import-slovak -- --dry-run
```

Both commands are local and do not contact Supabase.

## Deferred import order

Do not run this section without explicit approval.

```bash
corepack pnpm exec supabase db push
corepack pnpm data:questions:v2:import-slovak -- --batch-size 200
```

The migration creates the inactive `sk-v2-current` set if it is absent. The
importer inserts only missing topics and questions by their source identity;
existing rows are left untouched. Upload the R2
plan and configure the Slovak public R2 base URL before activating the country
in a client build.

To rewrite `question_ai_explanations_v2` for SK, follow
[`docs/rewrite-explanations-v2.md`](rewrite-explanations-v2.md).
Adjust the SK pack in `scripts/rewrite-explanations-v2/packs.py`; do not fork
the CLI. Apply is UPDATE-only.

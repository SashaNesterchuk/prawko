# Prawko Question Data Pipeline

This package builds the local import pipeline for the official theory question dataset.

## Commands

1. `pnpm data:questions:inspect`
2. `pnpm data:questions`
3. `pnpm data:questions:validate`
4. `pnpm data:media:audit`
5. `pnpm data:media:build`
6. `pnpm data:media:upload`
7. `pnpm data:questions:sync`
8. `pnpm data:question-topics:prepare`
9. `pnpm data:question-topics:sync`

## Expected inputs

1. workbook in `data/questions/raw/xlsx/`
2. media archives or extracted files in `data/questions/raw/media/`
3. optional overlays in `data/questions/raw/translations/`

## Outputs

1. `data/questions/interim/generated/`
2. `data/questions/normalized/generated/`
3. `data/questions/exports/generated/`
4. `data/questions/delivery/generated/`

Important exports:

1. `supabase.questions.category-b.json` now includes denormalized delivery asset JSON for primary and PJM media.
2. `supabase.question-delivery-assets.category-b.json` contains asset-only mappings by `question_source_id`.
3. `supabase.questions.category-b.with-topics.json` includes `primary_topic_id` and `topic_ids`.
4. `supabase.question-topic-catalog.category-b.json` contains the normalized 15-topic catalog for Supabase.
5. `supabase.question-topic-assignments.category-b.json` contains the flattened per-question normalized topic assignments.

## Notes

1. The core import and media audit pipeline does not require secrets.
2. The pipeline is deterministic.
3. Missing source files do not require code changes, only placement in the expected folders.
4. `media:audit` resolves primary and PJM references into a delivery build plan.
5. `media:build` expects local `ffmpeg` and writes encoded assets and posters into `delivery/generated/assets/`.
6. `media:upload` reads Supabase credentials from `.env.local`, `.env`, or `.env.example` and uploads built assets to Storage.
7. `questions:sync` upserts the enriched Category B export into `public.questions` using the service role key.
8. `media:upload` can reuse `data/questions/normalized/generated/media-build-plan.json`; it does not need the raw XLSX when generated artifacts already exist.
9. `questions:sync` can reuse `data/questions/exports/generated/supabase.questions.category-b.json`; it does not need the raw XLSX when generated artifacts already exist.
10. Pass `--input <path>` to override the generated export/build-plan file used by `questions:sync` or `media:upload`.
11. `question-topics:prepare` requires `--topic-assignments <path>` on the first run; after that it can reuse the generated flattened assignment export automatically. It also accepts the retired 30-topic assignment files and maps every assignment into the current 15-topic catalog.
12. `question-topics:sync` upserts both `public.question_topic_catalog` and `public.questions.primary_topic_id/topic_ids`.

## Normalized Topic Commands

1. Prepare export files with normalized topics:

```bash
pnpm data:question-topics:prepare \
  --topic-assignments /absolute/path/to/topic_taxonomy/review_outputs/question_topics.final.json \
  --topic-catalog /absolute/path/to/topic_taxonomy/topic_catalog.ua.normalized.json
```

2. Sync the prepared topic catalog and question assignments to Supabase:

```bash
pnpm data:question-topics:sync \
  --topic-assignments /absolute/path/to/topic_taxonomy/review_outputs/question_topics.final.json \
  --topic-catalog /absolute/path/to/topic_taxonomy/topic_catalog.ua.normalized.json
```

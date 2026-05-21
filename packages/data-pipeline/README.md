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

## Notes

1. The core import and media audit pipeline does not require secrets.
2. The pipeline is deterministic.
3. Missing source files do not require code changes, only placement in the expected folders.
4. `media:audit` resolves primary and PJM references into a delivery build plan.
5. `media:build` expects local `ffmpeg` and writes encoded assets and posters into `delivery/generated/assets/`.
6. `media:upload` reads Supabase credentials from `.env.local`, `.env`, or `.env.example` and uploads built assets to Storage.
7. `questions:sync` upserts the enriched Category B export into `public.questions` using the service role key.

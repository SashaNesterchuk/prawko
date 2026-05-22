# Prawko — Data Refresh Process

## 1. Source inputs

- Official XLSX goes into `data/questions/raw/xlsx`.
- Raw media archive stays outside the app bundle and is referenced by the data pipeline config.
- Never overwrite old source drops without keeping the dated previous version.

## 2. Refresh sequence

1. Replace or add the new source XLSX and media archive.
2. Run `pnpm data:questions:inspect` to confirm the pipeline sees the new source.
3. Run `pnpm data:questions:validate` and review warnings before syncing anything.
4. Run `pnpm data:media:audit` to verify raw media inventory and missing references.
5. Run `pnpm data:media:build` to generate normalized delivery assets and posters.
6. Run `pnpm data:questions` to regenerate normalized question outputs.
7. Run `pnpm data:questions:sync` to push question rows into Supabase.
8. Run `pnpm data:media:upload` to upload the new delivery assets to storage.

## 3. What to verify after refresh

- `data/questions/normalized/generated/summary.json` exists and reflects the expected question count.
- `data/questions/normalized/generated/validation-report.json` does not contain unexpected new errors.
- `data/questions/delivery/generated/build-report.json` shows zero failed media jobs.
- `data/questions/delivery/generated/upload-report.json` shows the expected uploaded object count.
- Admin `Import Health` reflects the latest reports and remote counts.

## 4. Rollback rule

- If validation errors spike or media uploads fail broadly, stop before `questions:sync`.
- If bad rows already landed in Supabase, fix the source or mapping logic and re-run the full refresh instead of patching rows manually in the dashboard.

## 5. Operational notes

- Raw `wmv` files are source-only and must not be served directly to clients.
- Mobile and web should consume only prebuilt delivery assets from storage.
- Keep `summary.json`, `validation-report.json`, `build-report.json`, and `upload-report.json` because admin pages read them as operational checkpoints.

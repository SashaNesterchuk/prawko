# Question data workspace

This folder contains source data, generated data, and exports for the official driving theory question bank.

## Structure

1. `raw/` for source XLSX, source media, and optional translation overlays
2. `interim/generated/` for workbook inspection and intermediate diagnostics
3. `normalized/generated/` for normalized JSON datasets
4. `exports/generated/` for downstream seed-ready outputs
5. `delivery/generated/` for client-facing encoded assets, posters, and upload reports

## Media note

1. Raw question media is source-only and should not be served directly to clients.
2. Client-facing images, videos, and posters belong to a separate media build pipeline described in [Prawko_Media_Audit.md](/home/lastday/prawko/Prawko_Media_Audit.md).
3. The question import pipeline should emit stable media keys and manifests, then hand off delivery preparation to the media pipeline.

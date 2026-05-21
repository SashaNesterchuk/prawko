# Delivery assets

This folder contains generated client-facing media assets.

Structure:

1. `generated/media-build-plan.json` for storage-ready jobs
2. `generated/delivery-manifest.json` for built local outputs
3. `generated/build-report.json` for build execution status
4. `generated/upload-report.json` for Supabase upload status
5. `generated/assets/` for encoded videos, copied images, and posters

Notes:

1. Raw `WMV` files do not belong here.
2. Client-facing assets should be built here first, then uploaded to Supabase Storage.
3. This folder is safe to regenerate from source media plus the normalized manifests.

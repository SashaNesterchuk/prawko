# Hosted Supabase Deploy

This project can run against a hosted Supabase instance. The mobile app and web app do not need a local Supabase stack once the remote project is provisioned, migrated, and seeded.

## Required secrets

1. `SUPABASE_ACCESS_TOKEN` or an authenticated `supabase login` session
2. remote project ref
3. remote database password for `supabase link` and `supabase db push`
4. remote `SUPABASE_SERVICE_ROLE_KEY` for question sync and media upload
5. remote anon key for app env files
6. optional AI provider keys for live `question-chat`

## One-time remote rollout

1. Link the CLI to the hosted project.

```bash
corepack pnpm exec supabase link --project-ref <project-ref>
```

2. Apply database migrations.

```bash
corepack pnpm exec supabase db push
```

3. Deploy the edge function.

```bash
corepack pnpm exec supabase functions deploy question-chat
```

4. Upload prepared media assets to Storage.

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
corepack pnpm data:media:upload --input data/questions/normalized/generated/media-build-plan.json
```

5. Sync prepared questions to `public.questions`.

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
corepack pnpm data:questions:sync --input data/questions/exports/generated/supabase.questions.category-b.json
```

## Runtime env switch

Update local runtime env files to the hosted project:

1. `.env.local`
2. `mobile/.env.local`
3. `web/.env.local`

Required values:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Verification

1. `public.questions` has rows
2. Storage buckets contain uploaded media
3. `question-chat` responds from the hosted function URL
4. sign up / sign in works from mobile and web
5. question catalog loads from Supabase instead of bundled fallback

## Media note

Prepared delivery assets currently occupy roughly `7.7G`. They should be uploaded once to Supabase Storage and then streamed by the clients from Storage URLs. They should not be transcoded or downloaded from the original source directory at runtime.

# Prawko Foundation

This repository now contains the `Epic 0` foundation for the Prawko product stack:

1. `mobile/` for Expo + React Native
2. `web/` for Next.js
3. `supabase/` for local infrastructure, migrations, and functions
4. `packages/config/` for shared constants
5. `packages/schemas/` for shared Zod contracts

## Current status

This scaffold is intentionally safe:

1. no real credentials are stored
2. no dependency installation was run
3. no network calls are made at startup
4. Supabase clients are lazily created only when credentials exist

The project now also includes:

1. `Epic 1` local question data pipeline
2. `Epic 1A` media processing foundation with:
   - source media inventory
   - primary and PJM media reference resolution
   - delivery build plan generation
   - local ffmpeg build command
   - Supabase Storage upload command
3. `Epic 2` first production-oriented Supabase schema
4. `Epic 3` mobile shell for Expo with:
   - onboarding route group
   - tabs route group
   - shared question screen
   - AI/paywall modal routes
   - persisted locale/category/mock session state
5. `Epic 4` onboarding and local study plan setup with:
   - deterministic plan generator
   - persisted onboarding draft
   - plan preview before entering tabs
   - today tab fed from generated plan
6. `Epic 5` local question engine and learning mode with:
   - mock-safe question bank across all topic blocks
   - persisted attempts, bookmarks, and hard-state
   - queue strategies for learning, weak spots, saved, exam tomorrow, and exam preview
   - shared question flow with immediate feedback and end-of-session summary
7. `Epic 6` AI layer foundation with:
   - shared AI request/response contracts
   - persisted local question chat history and free-tier usage tracking
   - question-aware AI modal on mobile
   - Supabase Edge Function skeleton with provider adapters, auth-aware logging, and mock fallback

## Next steps

1. Copy `.env.example` to `.env`
2. Fill in credentials when ready
3. Run `pnpm install`
4. Start local services:
   - `pnpm dev:mobile`
   - `pnpm dev:web`
   - `pnpm supabase:start`
   - `pnpm data:questions:inspect`
   - `pnpm data:questions`
   - `pnpm data:media:audit`
   - `pnpm data:media:build -- --skip-existing`
   - `pnpm data:media:upload`
   - `pnpm data:questions:sync`

## Workspace structure

```text
.
|-- mobile
|-- web
|-- supabase
`-- packages
    |-- config
    `-- schemas
```

## Notes

1. The mobile app now has a real shell plus a mock-safe onboarding and study plan flow.
2. Supabase migrations were added, but they were not yet executed locally in this workspace.
3. Shared contracts are defined early to reduce drift between mobile, web, and backend.
4. Epic 1 pipeline is local-only and does not require secrets.
5. The first study plan is generated locally and deterministically until backend plan creation is wired.
6. The current question engine is local-first and does not require Supabase or AI secrets.
7. The AI flow works without provider keys through a deterministic local fallback, and upgrades to the edge-function path once Supabase auth and secrets are wired.
8. The media pipeline expects `ffmpeg` locally and can upload built assets through Supabase service-role credentials.
9. The Supabase question export now includes delivery asset JSON fields so runtime clients can resolve storage paths without raw filename matching.

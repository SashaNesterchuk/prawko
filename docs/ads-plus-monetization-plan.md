# Ads + Plus Monetization — Implementation Plan

## Status

- **Type:** product + engineering plan
- **Target model:** free content with video ads; one-time **Plus** purchase (~18 PLN) removes ads and unlocks AI chat
- **Replaces:** current sprint/subscription-oriented paywall, daily question caps, and exam simulator gating
- **v1 scope:** mobile product flows only — **no school codes**, **no new store/RevenueCat/AdMob account setup** (see [Integration strategy](#integration-strategy-stubs-first))

---

## Goal

Move Prawko to a learner-friendly monetization model:

1. **Free:** all core learning is available — study plan, unlimited practice, exam simulator, pre-generated explanations.
2. **Ads:** free users see interstitial video ads; ad frequency grows with session length and activity.
3. **Plus (~18 PLN, one-time):** no ads + unlimited AI question chat.

**Out of v1 scope:** school codes / B2B access. Existing school tables and redeem UI stay in the codebase but are **not** part of Plus entitlement logic or this rollout. Revisit in a later phase.

The app should feel open and useful without payment. Payment is positioned as **comfort + AI**, not as unlocking the exam itself.

---

## Product Rules

### What stays free (with ads)

| Area | Free behavior |
|------|----------------|
| Study plan / Today tab | Full access |
| Topic practice | Unlimited answers |
| Quick practice modes (wrong answers, saved, seen-not-mastered) | Unlimited |
| Exam simulator (full + mini modes) | Full access |
| Pre-generated explanations | Available without AI chat |
| Bookmarks / progress | Unchanged |

### What requires Plus

| Area | Gated behavior |
|------|----------------|
| AI question chat | Hard gate — no free daily messages |
| Video ads | Hidden for Plus users |

### What we remove

| Current behavior | New behavior |
|------------------|--------------|
| `FREE_TIER_LIMITS.questionPracticePerDay` (20/day) | Remove client + product reliance on this cap |
| Paywall before exam simulator | Remove — exam opens directly |
| Paywall when daily question limit reached | Remove — replace with ad triggers |
| Multiple RevenueCat packages (sprint / monthly / etc.) | Single lifetime Plus product |
| Free AI chat quota (`AI_LIMITS.freeQuestionChatPerDay = 8`) | Remove — AI is Plus-only |

---

## Entitlement Model

### Plus access (v1)

Plus is a **client-side concept** for v1. Source of truth order:

1. **Dev override** — `FEATURE_FLAGS.devPlusAccess` or local debug toggle (for QA without store).
2. **RevenueCat purchase** — only when API keys are present and user has an active entitlement (existing SDK path in `revenuecat.ts`; no dashboard reconfiguration required for v1).
3. **Otherwise** — free user (ads on, AI gated).

Do **not** wire school membership, `schoolAccess`, or remote `feature_entitlements` into Plus for v1.

### Client helpers to add

Add focused selectors in `mobile/src/state/entitlements.ts`:

```ts
useHasPlusAccess()      // dev override OR RevenueCat entitlement
useShouldShowAds()      // !useHasPlusAccess()
useHasAiChatAccess()    // same as useHasPlusAccess() for v1
```

Map existing RevenueCat aliases in `mobile/src/features/entitlements/revenuecat.ts` — reuse `premium_access` / `ai_question_chat` checks where they already work; add `plus` as an alias when convenient:

```ts
// ai_question_chat aliases already include premium_access — enough for v1 gating
ai_question_chat: ["ai_question_chat", "ai_chat", "plus", "premium_access", "premium"]
```

---

## Integration strategy (stubs-first)

**Principle:** ship product behavior first; external monetization accounts can wait.

| Integration | v1 approach | When to configure for real |
|-------------|-------------|----------------------------|
| **RevenueCat** | Keep existing `react-native-purchases` integration. If `EXPO_PUBLIC_REVENUECAT_*` keys are empty, SDK stays unconfigured — paywall shows copy + disabled/graceful CTA (already partially handled). No new entitlement/offering setup in RevenueCat dashboard. | Before public launch / TestFlight billing test |
| **AdMob** | Build ad **policy layer** + `show-interstitial.ts` stub that no-ops when ads disabled or SDK not linked. Use Google **test unit IDs** in dev. Real app IDs only when AdMob account exists. | Before ads in production |
| **App Store / Play** | No new SKU creation in v1. Paywall displays target price/copy; purchase button stubbed or uses whatever offering RevenueCat returns (may be empty). | Pre-release |
| **School codes** | **Out of scope** — hide school redeem block on paywall/access-center or leave dormant; do not grant Plus via school. | Separate B2B phase |

Suggested feature flags in `packages/config/src/index.ts`:

```ts
export const FEATURE_FLAGS = {
  enableAds: false,           // flip on when AdMob module is in build
  enablePlusPurchase: false,  // flip on when store products exist
  devPlusAccess: false,       // local QA: treat user as Plus
} as const;
```

---

## Ad Policy

### SDK

Use **Google AdMob** via `react-native-google-mobile-ads` when `FEATURE_FLAGS.enableAds` is true.

- v1 default: **stub/no-op** — policy layer runs, no real impressions until flag + SDK are enabled.
- RevenueCat handles purchases only when configured; it does **not** show ads.
- Expo SDK 54 requires a dev client / native build for real AdMob (`expo run:ios`, `expo run:android`).

### Ad format

- **Interstitial video only** for v1.
- No banner ads in question UI.
- No rewarded ads in v1 (optional later: “watch ad for nothing” is unnecessary if content is already free).

### Placement map

| Trigger | When | Notes |
|---------|------|-------|
| `after_question_answer` | Every **12** answered questions in a practice session | Primary frequency driver |
| `after_practice_session_complete` | Session summary screen | Once per completed session |
| `after_exam_complete` | Exam result screen | Once per finished exam |
| `app_resume` | User returns after **10+ min** background | Max once per resume |

### Hard exclusions

Do **not** show ads when:

- `useHasPlusAccess()` is true
- User is inside an **active timed exam session** (`/exam/session` while timer running)
- An interstitial was shown in the last **3 minutes**
- Session ad cap (**6** interstitials) is reached
- App is in onboarding / auth / paywall / AI chat modal
- Ad inventory is not loaded (fail silently, never block learning)

### Session state

New module: `mobile/src/features/ads/ad-session-policy.ts`

Track in memory (optionally persist lightweight counters in MMKV):

```ts
type AdSessionState = {
  questionsAnsweredSinceLastAd: number;
  adsShownThisSession: number;
  lastAdShownAt: number | null;
  sessionStartedAt: number;
};
```

Reset session after **30 minutes** of inactivity.

### Config constants

Add to `packages/config/src/index.ts`:

```ts
export const AD_POLICY = {
  questionsBetweenInterstitials: 12,
  minSecondsBetweenAds: 180,
  maxAdsPerSession: 6,
  sessionInactivityResetMinutes: 30,
  appResumeBackgroundMinutes: 10,
} as const;
```

Use test ad unit IDs in dev; real IDs only when AdMob account exists (production env).

---

## Store + RevenueCat Setup (deferred)

> **Not required for v1 engineering.** Implement product gates and stubs first; configure external accounts before public release.

When ready for billing:

| Field | Value |
|-------|-------|
| Product ID | `prawko_plus_lifetime` |
| Type | Non-consumable |
| Price | **17.99 PLN** (display ~18 zł) |
| Title (PL) | Prawko Plus |
| Description (PL) | Bez reklam + AI-asystent do pytań. Jednorazowy zakup. |

Create matching products in App Store Connect + Google Play Console, then in RevenueCat: entitlement `plus`, offering `default` with one `LIFETIME` package. Existing `EXPO_PUBLIC_REVENUECAT_*` env vars stay as-is.

Optional later: RevenueCat webhook → Supabase for `feature_entitlements` reporting parity.

---

## Engineering Phases

### Phase 0 — Product decisions only (no external setup)

- [x] **School codes:** out of v1 scope
- [x] **RevenueCat / store:** defer dashboard + SKU setup; use stubs + `devPlusAccess` for QA
- [x] **AdMob account:** defer; build policy layer with test IDs / no-op stub first
- [ ] Confirm copy: Free with ads / Plus 18 zł one-time / AI is Plus-only

### Phase 1 — Open content, remove old caps (1–2 days)

**Goal:** free users can use everything except AI; no AdMob yet.

#### Config

- [ ] Deprecate `FREE_TIER_LIMITS` usage in product flows (keep constant temporarily for marketing migration)
- [ ] Document that `AI_LIMITS.freeQuestionChatPerDay` is no longer a free tier — only used if we keep a dev fallback

#### Mobile — remove gates

| File | Change |
|------|--------|
| `mobile/app/question.tsx` | Remove daily limit logic, `questionLimitReached`, paywall CTA for limits, remote daily usage fetch for caps |
| `mobile/app/exam/index.tsx` | Remove `!hasExamAccess` block; keep auth requirement |
| `mobile/app/(tabs)/index.tsx` | Remove exam paywall redirect in `handleTaskOpen` |
| `mobile/app/(tabs)/practice.tsx` | Remove exam paywall redirect in `openPracticeRoute` |
| `mobile/src/state/free-tier-usage.ts` | Deprecate or repurpose for ad counters only |
| `mobile/src/features/entitlements/supabase-daily-usage.ts` | Stop using for question caps (can keep RPC for analytics later) |

#### AI — hard gate

| File | Change |
|------|--------|
| `mobile/app/modals/ai-chat.tsx` | Gate entry on `useHasAiChatAccess()`; if false, show Plus CTA instead of chat |
| `mobile/src/features/ai/use-question-ai-chat.ts` | Remove free-message UX assumptions |
| `mobile/src/state/ai-chat.ts` | Remove free daily assistant counter for non-Plus users |

#### Server

| File | Change |
|------|--------|
| `supabase/functions/question-chat/index.ts` | Remove free daily path: if no `ai_question_chat` entitlement → `403` / `plus_required`. For v1, entitlement = RevenueCat-backed `feature_entitlements` from purchase only — **ignore school-granted** rows until B2B phase. |

#### Paywall repositioning (interim)

| File | Change |
|------|--------|
| `mobile/app/modals/paywall.tsx` | Plus copy (“No ads” + “AI chat”); remove sprint/monthly UI; **hide school code redeem**; purchase CTA graceful when `enablePlusPurchase` is false |
| `mobile/app/modals/access-center.tsx` | Update labels to “Plus — no ads + AI”; hide school section |

#### i18n

| File | Change |
|------|--------|
| `mobile/src/i18n/resources.ts` | Replace free-tier / sprint strings in PL, UA, EN |

**Exit criteria:** logged-in free user can practice unlimited and start exam; AI opens paywall; no question-limit UI remains. Plus unlock testable via `devPlusAccess`.

### Phase 2 — Ads policy + stub (1–2 days)

**Goal:** ad triggers and session policy work; real AdMob optional behind `enableAds`.

#### Dependencies

- [ ] Add `react-native-google-mobile-ads` **or** ship stub implementation first (`show-interstitial` logs + returns when `enableAds: false`)
- [ ] When enabling SDK: configure `app.json` / native projects (AdMob app IDs, SKAdNetwork on iOS)
- [ ] Add env vars to `.env.example` (optional until AdMob account exists):

```env
EXPO_PUBLIC_ADMOB_IOS_APP_ID=
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=
EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID=
EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID=
```

#### New files

```
mobile/src/features/ads/
  admob-config.ts          # env + Google test IDs; no-op when enableAds false
  AdProvider.tsx           # init SDK when enabled; otherwise pass-through
  ad-session-policy.ts       # counters + cooldown logic
  show-interstitial.ts       # showIfAllowed() — no-op stub when disabled
  use-should-show-ads.ts     # thin hook
```

#### Integration points

| File | Hook |
|------|------|
| `mobile/src/providers/AppProviders.tsx` | Wrap with `AdProvider` |
| `mobile/app/question.tsx` | After successful answer → `recordQuestionAnswered()` + `maybeShowInterstitial('after_question_answer')` |
| `mobile/app/question.tsx` | On session complete → `maybeShowInterstitial('after_practice_session_complete')` |
| `mobile/app/exam/session.tsx` (or result flow) | On exam complete only → `maybeShowInterstitial('after_exam_complete')` |
| `mobile/app/_layout.tsx` or root listener | AppState resume → `maybeShowInterstitial('app_resume')` |

#### Analytics

Track:

- `ad_interstitial_requested`
- `ad_interstitial_shown`
- `ad_interstitial_dismissed`
- `ad_interstitial_failed`
- `ad_interstitial_skipped` with `reason` (`plus_user`, `cooldown`, `cap`, `exam_active`, `not_loaded`)

**Exit criteria:** policy fires at correct triggers; with `enableAds: false` learning is never blocked; with test IDs + flag on, non-Plus user sees interstitials; Plus / `devPlusAccess` sees none.

### Phase 3 — Plus UI polish (0.5 day)

| File | Change |
|------|--------|
| `mobile/src/features/entitlements/revenuecat.ts` | When configured, prefer `LIFETIME` package; when not — empty offerings OK |
| `mobile/app/modals/paywall.tsx` | One CTA: “Kup Plus — 18 zł”; disabled state + “Wkrótce” if `!enablePlusPurchase` |
| `mobile/app/modals/ai-chat.tsx` | Primary upsell entry point |
| `mobile/app/(tabs)/profile.tsx` | Plus status + “Remove ads” if free |

**Exit criteria:** `devPlusAccess` or real purchase disables ads immediately; restore/purchase graceful when RevenueCat unconfigured.

### Phase 4 — Web copy + QA (0.5–1 day)

| File | Change |
|------|--------|
| `web/src/components/marketing/site-content.ts` | Free with ads / Plus 18 zł (no school tier in copy for now) |
| `web/src/app/pricing/page.tsx` | Match mobile model |
| `Prawko_QA_Checklist.md` | Ad + Plus scenarios; `devPlusAccess` QA path |
| `Prawko_Beta_Release_Checklist.md` | Defer AdMob + store checks to pre-release section |

---

## Copy Guidelines (PL-first)

### Free positioning

> Ucz się za darmo: plan, pytania i egzamin. Krótkie reklamy wideo finansują aplikację.

### Plus positioning

> **Prawko Plus — 18 zł jednorazowo**  
> Bez reklam + asystent AI do każdego pytania.

### AI gate

> AI-asystent jest dostępny w Prawko Plus. Wyjaśnia odpowiedzi i odpowiada na Twoje pytania.

Avoid:

- “Premium subscription”
- “Exam sprint 14 days”
- “20 questions per day”

---

## Analytics & Success Metrics

### Funnel

1. `app_open`
2. `question_answered` (count per session)
3. `ad_interstitial_shown`
4. `paywall_viewed` (`source = ai_chat | profile | settings`)
5. `purchase_started` / `purchase_succeeded`
6. `ai_chat_message_sent`

### KPIs (first 30 days)

| Metric | Notes |
|--------|-------|
| D1 / D7 retention | Ads should not crush retention; watch closely in week 1 |
| Questions per session | Should rise after removing 20/day cap |
| Ads per session (avg) | Target ~2–4 for a 30-min session |
| Paywall → purchase CR | From AI entry point (once billing enabled) |
| Plus ARPPU | ~18 zł gross (post-launch) |

---

## Legal & Compliance (pre-release)

Defer until real ads and billing ship:

- [ ] Privacy Policy: AdMob, advertising ID, UMP consent
- [ ] Terms: one-time purchase, no subscription for Plus
- [ ] App Store privacy labels / Data safety (Advertising Data)
- [ ] EU UMP consent before personalized ads
- [ ] Age rating: driving theory app; avoid “Designed for Children”
- [ ] Apple ATT not required for AdMob alone, but document IDFA usage if enabled later

---

## Testing Checklist

### Free user

- [ ] Unlimited practice answers across app restart
- [ ] Exam simulator starts without paywall
- [ ] Study plan tasks open exam and practice directly
- [ ] Interstitial appears after 12th answer (test unit)
- [ ] No ad during active exam timer
- [ ] Ad cap stops further ads in same session
- [ ] AI chat shows Plus upsell; send is blocked

### Plus user

- [ ] `devPlusAccess` unlocks AI immediately
- [ ] No interstitials in any flow
- [ ] (Post-billing) Purchase + restore on second device

### Failure modes

- [ ] Ad stub / failed load → user continues without error UI
- [ ] RevenueCat not configured → AI gate works; purchase shows “unavailable” copy, not crash
- [ ] Offline practice still works; ads skipped quietly

---

## Rollout Strategy

1. **Dev:** `devPlusAccess` + `enableAds: false` — validate gates and unlimited content
2. **Dev:** `enableAds: true` + Google test unit IDs — validate ad policy
3. **Pre-release:** AdMob account, store SKU, RevenueCat offering, flip `enablePlusPurchase`
4. **Production:** monitor retention + ad impressions for 7 days before tuning frequency

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Ads hurt retention | Conservative frequency, no ads in timed exam, session cap |
| Low Plus conversion | Strong AI upsell at moment of curiosity (after wrong answer) |
| AdMob policy rejection | No accidental clicks; no ads on media playback surface |
| RevenueCat / store review mismatch | Configure SKU copy as one-time before enabling `enablePlusPurchase` |

---

## Open Questions

1. **Guest / mock auth users:** show ads without purchase option, or require sign-in before ads/Plus?
   - Recommendation: require Supabase auth for Plus; ads can work for anonymous local sessions; purchase needs account when billing is on.
2. **Pre-generated explanations:** stay free for all users (recommended yes).
3. **Android back button during interstitial:** ensure ad SDK handles without breaking navigation stack.
4. **School codes (later):** when B2B returns, decide if school = Plus equivalent or separate tier.

---

## File Index (quick reference)

### Modify

- `packages/config/src/index.ts`
- `mobile/app/question.tsx`
- `mobile/app/exam/index.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/practice.tsx`
- `mobile/app/modals/paywall.tsx`
- `mobile/app/modals/ai-chat.tsx`
- `mobile/app/modals/access-center.tsx`
- `mobile/src/state/entitlements.ts`
- `mobile/src/features/entitlements/revenuecat.ts`
- `mobile/src/providers/AppProviders.tsx`
- `mobile/src/i18n/resources.ts`
- `supabase/functions/question-chat/index.ts`
- `web/src/components/marketing/site-content.ts`
- `.env.example`

### Add

- `mobile/src/features/ads/*`
- `docs/ads-plus-monetization-plan.md` (this document)

### Deprecate / stop using in product flows

- `mobile/src/state/free-tier-usage.ts` (question caps)
- `mobile/src/features/entitlements/supabase-daily-usage.ts` (cap enforcement)
- `supabase/migrations/.../get_daily_usage_snapshot` (optional analytics only)

---

## Suggested Implementation Order (summary)

```text
Phase 0: scope locked (no schools, stubs-first integrations)
    ↓
Phase 1: remove caps & exam paywall, hard-gate AI, simplify paywall (hide school)
    ↓
Phase 2: ad policy + stub/show layer (enableAds flag)
    ↓
Phase 3: Plus UI + devPlusAccess QA
    ↓
Phase 4: web copy + QA
    ↓
Pre-release: AdMob account + store SKU + RevenueCat + flip flags
```

Estimated v1 engineering effort: **3–5 days** (stubs, no external account setup). Add **1–2 days** when wiring real AdMob + billing before launch.

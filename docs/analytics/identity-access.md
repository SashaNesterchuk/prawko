# Identity And Access Observations

Implemented October 7, 2026. These are client observations and offline warehouse
diagnostics, not a change to authentication, RevenueCat identity, entitlements,
feature rules, quotas or navigation.

## Identity Ledger

`context.identity_links` and the `identity-links` command derive a versioned
install/account ledger from existing event partitions, including pre-window
observations:

```bash
cd analytics-engine
python -B -m prawko_analytics identity-links --start 2026-10-03 --end 2026-10-04 --out /tmp/prawko-identity-links.json
```

The exclusive date bounds use Warsaw time. Explicit
`analytics_identity_observed identity_link_version=1` events establish local
observed account context. Common `supabase_user_id` properties alone do not
establish a historical link. Guest, link, unlink, direct A-to-B switch and repeated
initial observations remain distinct from authentication outcomes.

- Install IDs remain the primary product/billing analysis grain.
- Same-account observations on two installations do not merge those installations.
- Intervals stop at the next explicit observation. Invalid/conflicting observations
  create unknown boundaries; missing transitions are never backfilled.
- Within one timestamp, a shared runtime and distinct sequence numbers can prove
  order. Otherwise conflicting account states are quarantined.
- Event context disagreements, SDK distinct-ID/install collisions, SDK person IDs
  with multiple accounts and observed legacy aliases are quality signals.
- Provider `person_id` is retained only for these diagnostics, never used as the
  analysis key or proof of a unique person.
- No SDK aliases are created or repaired. No RevenueCat logout/access transfer
  is inferred.

`history_coverage_complete` applies only to available warehouse partitions,
not an installation's entire lifetime. Time is exported event time, not a
verified historical delivery-as-of view. Late delivery, gaps and historical SDK
person merging still require examination of the actual provider configuration
and exports. Automatic account joins remain disabled.

## Feature Access

Existing gate/content events receive `access_observation_version=1` properties.
They compare a fresh local store snapshot with the original observed surface:
AI chat, offline mode, explanation, training/exam limits and specific premium
entries. They never recompute or replace product decisions.

`access_rule_version=plus-feature-observation-v1` produces `consistent`,
`not_comparable`, `blocked_despite_plus` or `premium_content_without_plus`.
The latter two are **potential mismatches**, not proven defects or evidence of
a charge. An asynchronous render/store update can also produce such a mismatch.

Regular paywall views are not access failures. Profile/Home upsells, PL free-topic
Premium marks, offline connectivity/content blocks and ambiguous roadmap
prerequisites are not treated as entitlement failures. Non-Plus free quota and
topic eligibility are not guessed from missing event context.

CustomerInfo age uses the existing RevenueCat `requestDate`, not guaranteed
server freshness. Missing/future dates stay explicit. School/remote verification
age is not available and remains null. Runtime/debug overrides are labelled;
paid/trial/restore history still comes from the financial source, not `is_plus`.

`context.feature_access` and `build_health().feature_access` provide grouped
observation/installation counts, source and age diagnostics. These are not
distinct blocker episodes or complete access-error rates. Invalid/conflicting
observations are excluded. Native acceptance and delivery remain unverified.

## Import Conflicts

PostHog reimports preserve different immutable client bodies sharing a provider
or installation-scoped client event ID. Both are marked with
`_warehouse_import_conflict`; neither is chosen by last-write-wins.
Receipt/export metadata and SDK enrichment do not create client-body conflicts.
Identical reimports remain idempotent.

Conflicts remain inspectable in raw partitions and `partition.json.conflict_rows`.
They restrict metrics, funnels, meaningful-learning outcomes, access diagnostics
and client/server transaction reconciliation. Coverage and integrity are separate:
a fully covered partition can still contain conflicting observations.
TTV retains observed/censored counts but labels invalid observations as
`limited_integrity` and withholds a clean median.

Import conflict detection is partition-local. The identity ledger also checks
observation IDs across its historical input. Universal cross-partition
critical-business dedupe, source lag monitoring and native queue acceptance are
still separate requirements, not implied by this implementation.

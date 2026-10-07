# Observation Integrity And Receipt Lag

`data-quality-v1` is an analytical source gate. It does not change client
collection policy, product operations, SDK identities or event meanings.

## Entry Points

```bash
cd analytics-engine
.venv/bin/prawko-analytics data-quality --day 2026-10-03 --out /tmp/prawko-quality.json
.venv/bin/prawko-analytics data-quality --start 2026-10-02 --end 2026-10-04
```

The command reads only quality inputs, not finance or product reports.
`context.data_quality` contains the same warehouse-backed report. Health exposes
`health.data_quality`; a supplied-row health report cannot assert that it reloaded
all warehouse history. `load_prepared_rows` returns annotated raw observations,
including historical replay/conflict markers. Use `canonical_observations` for
counting activity; retain the raw list for source-quality diagnostics.

## Source And Counting Grains

The warehouse gate reads available partitions before the exclusive report end,
including observations before the report start. It does not look beyond the
report end for conflicts. This is a retrospective available-source view, not a
historical delivery-as-of reconstruction or installation-lifetime archive.
Missing partitions and unverified metadata remain explicit. Partial-day windows
include every overlapping Warsaw partition, not only fully enclosed days.

Provider event IDs and installation-scoped client event IDs are separate.
Immutable client-body conflicts under either identity are retained and
quarantined. SDK `$...` enrichment, provider receipt metadata and derived
`_warehouse_...` fields are not immutable client-body changes.

Business rules additionally use installation-scoped operation IDs:

| Observation | Business Grain |
| --- | --- |
| Training start/completion | `app_user_id`, `training_session_id`, event |
| Training answer | `app_user_id`, `training_session_id`, `answer_id`, event |
| Exam start/completion | `app_user_id`, `exam_session_id`, event |
| Exam answer submission | `app_user_id`, `exam_session_id`, `answer_revision_id`, event |
| Checkout native/access observations | `app_user_id`, `purchase_attempt_id`, event |
| Restore helper observations | `app_user_id`, `restore_attempt_id`, event |
| Onboarding completion/Home arrival | `app_user_id`, `onboarding_attempt_id`, event |
| Reminder helper outcome | `app_user_id`, `operation_id`, event |
| Offer availability cycle | `app_user_id`, `paywall_view_id`, `offer_load_id`, event |
| Trial eligibility start/terminal | `app_user_id`, `eligibility_request_id`, event |
| Trial eligibility product outcome | `app_user_id`, `eligibility_request_id`, `eligibility_product_id`, event |
| Offline operation | `app_user_id`, `operation_id`, event |
| Progress-reset operation | `app_user_id`, `reset_operation_id`, event |
| Media ready/playback start/end | `app_user_id`, `media_load_id`, event |

No account, SDK person or time-only business join is introduced. Missing legacy
IDs stay unjoinable; they are not reconstructed from timestamp coincidence.
Resume/abandon episodes and repeated status checks are not deduplicated solely
by session/purchase ID. Distinct exam answer revisions remain distinct
submissions, not new logical answer slots.

Known incompatible immutable fields, reused answer/revision bindings and
contradictory definitive terminals quarantine affected scopes. Offer refreshes
have different load IDs. Pending checkout and subsequent access confirmation
are not contradictory native terminals; access confirmation is not another
charge. Answer revision/provenance/selection disagreements are not silently
removed as harmless duplicates.

Eligibility request/view, platform and product-count bindings remain immutable
across stages/available partitions. Unknown/missing SDK responses are not
ineligible; duplicate product callbacks add no outcomes. Strict observation-v1
payload gates do not accept boolean/string versions or inconsistent normalized
outcome/query evidence. The separate count-only eligibility/origin consumer
retains missing stages and detached responses without manufacturing display,
trial start or money. See [paywall-observations.md](./paywall-observations.md).

## Raw, Canonical And Diagnostic Views

`raw_observation_rows` counts retained warehouse rows after provider/client
import merge, not every attempted SDK delivery. `analysis_observation_rows`
counts canonical rows, including quarantine evidence; the separate
`usable_analysis_observation_rows` excludes known integrity failures.

Equivalent business replays retain the earliest observation. Optional unknown
metadata is not backfilled from a later replay. Tied incompatible partial
metadata or unproven cross-runtime order stays limited instead of selecting a
fabricated first event. The actual sequence key is `app_run_id`.

Dataset, interpretation/version counts and raw diagnostics retain observed
rows. Funnels, metric counts and health activity use canonical observations.
The specialized content/repeat/external-entry/rewarded reports retain same-window
duplicate and conflict evidence for their own diagnostics. Replays whose
original observation precedes the window do not become new learning, purchase
or comparison activity. That exclusion remains effective when annotated rows
are later reprocessed without reloading history.

Metric passports expose `business_conflict_rows`, `invalid_business_rows` and
`business_order_uncertain_rows` separately from client payload/import failures.
These reasons prohibit dependent fractions and remove their values/lead
visibility. An independent offline-operation conflict does not prohibit a clean
paywall funnel solely because both appear in the same slice. Health's aggregate
rates, ranked drops and transition fractions require clean activity-source
integrity. The new eligibility diagnostics are not activity, so their own
defects do not restrict independent activity metrics.

Identity source conflicts create unknown link boundaries. Client reconciliation
reports business-integrity restrictions and pre-window replays separately; it
never changes RevenueCat source-reported currency totals.

## Client Payload Annotations

`client_payload_validation` separately reports bounded legacy/v1/v2,
valid/invalid/not-defined, unreported, unsupported-version and malformed
annotation counts at retained-observation grain. It is source-reported QA,
not warehouse schema revalidation or SDK acknowledgement. Old rows are not
retrospectively validated with v2; `not_defined` never becomes defined coverage.

Explicit invalid flags and contradictory/malformed/unsupported declared
annotations restrict dependent observations without overwriting the source.
Paywall conversion, meaningful-learning D7/TTV and client financial matching
retain their own dependencies. A checkout defect with an independently
confirmed matching root cannot erase clean learning, while bad learning
roots/outcomes and uncertain anchor evidence still restrict that report.
Generic calendar return keeps its broader product-event source gate.
RevenueCat monetary totals remain independent of client QA.
See [critical payload contracts and acceptance](./payload-contracts.md).

## Receipt-Lag Passport

The primary diagnostic is explicit provider receipt minus client occurrence.
Median, nearest-rank p95, maximum and half-open buckets (`<60s`, `[60s,1h)`,
`[1h,24h)`, `>=24h`) use only valid, nonnegative client/receipt pairs.

Missing, invalid and negative clocks are counted separately.
`receipt - provider event timestamp` is a separately labelled proxy only when
client occurrence is unavailable, not malformed. Event/client-time drift is
another diagnostic. Export time is never a receipt fallback. No native
acknowledgement, queue loss, delivery SLO or settled money is inferred.

## Local Acceptance And Remaining Gates

`test_data_quality.py` covers history replay, inherited quarantine, immutable
metadata, definitive terminals, install isolation, revision scope, partial-day
reads, half-open horizons, clock diagnostics and CLI/context/health consumption.
Identity and RevenueCat tests check unknown boundaries and unchanged money.
Malformed huge-number fixtures cover learning, access, content, entries and
rewarded SDK amounts.

The operator must inspect `status`, raw/canonical/usable counts, missing-ID
diagnostics and receipt-clock availability before consuming fractions. Inspect
producer IDs and retained source bodies in the private warehouse to resolve
conflicts; do not repair them by first/last-write overwrite or by claiming old
exports are complete. Re-run the same report after a verified source correction.

Native queue/revocation acceptance, production delivery evidence, the missing
October 3 dump, dashboard ingestion and owner-approved retention/purpose policy
remain separate gates in [the A-R ledger](./handbook-implementation.md).

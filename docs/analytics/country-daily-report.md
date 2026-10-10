# PL / CZ / SK daily report

Separate report requested October 9, 2026. The existing growth report/automation and Slack message are preserved. This report is Ukrainian, at 10:00 Europe/Warsaw, channel `C0C8WKPM3G8` (#prawko-daily).

## Run

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/prawko-country-daily.py --env-file /private/path/dashboard.env.local
```

Default: previous calendar day in Warsaw. Use `--day YYYY-MM-DD` to rerun. `--reuse-engine` is for a manual checked same-day export; scheduled runs must obtain fresh input. Source raw JSON and deterministic engine results are under ignored `analytics-engine/warehouse/daily/YYYY-MM-DD/`. Country output: `country-summary.json` and Ukrainian `country-report.txt`. Neither contains user IDs. API credentials remain in the existing private env file, never in the repo or Slack.

The runner first performs PostHog export → engine ingest → context/data-quality/paywall-observations via the existing exporter, then issues a fresh whole-history aggregation to PostHog. The scheduled agent reads those outputs and adds an evidence-based interpretation; the numbers do not come from prose generation.

## Metric contract

- Scope: events with native namespace `com.mindjar.prawko`, production_candidate or legacy missing analytics_environment. Explicit nonproduction environments are excluded. This is observed telemetry, not a census of all downloads/users.
- Users: current canonical PostHog `person_id`, not unmerged distinct IDs or number of events. Multiple IDs merged by PostHog count once; different devices/person profiles can still represent one human. No extra inferred account merging.
- Active user: has a foreground/product action during the day: Application Opened, screen_viewed, screen_visit_started, training/exam/sign-test answer, purchase_started or purchase_succeeded. Background sync errors, heartbeat checkpoints and notification scheduling alone do not make a user active. These metrics may differ from a default PostHog insight that counts every event.
- New user: active that day and earliest retained event in this app namespace for that canonical person falls in the day. Full retained history is queried every run, not only the 3-day export or first record in a local warehouse. This is first observed, not a native install timestamp. Data deletions/retention, merges and late delivery can revise it.
- Country: last known valid exam_country among active events that day. Each active user is assigned once to PL/CZ/SK, otherwise UNKNOWN. User country changes therefore do not make country totals exceed overall DAU. Country is NOT IP country, UI language, ASC storefront or RevenueCat country.
- Sessions: unique PostHog SDK `$session_id` with those actions during the day, attributed to that user's day country. Session spanning midnight can be active on both days. Training/exam session IDs and app runs are not interchangeable with SDK sessions. A shared SDK session across different people is an integrity failure, not silently counted; users without a session ID are disclosed. Counts are observed sessions, not inferred duration/session starts.
- Windows: [00:00, next 00:00) Europe/Warsaw including DST transitions. Counts provisional as-of export; no verified delivery watermark is invented.

## Revenue: connected October 9, 2026

The runner loads the RevenueCat V2 read-only key and project ID from ignored `/Users/sashanesterchuk/prawko/.env.local` (or `--revenue-env-file`). PostHog credentials remain in the dashboard private env. Never print either key.

`scripts/prawko_daily_revenue.py` reads all customer pages and all production customer event pages through authenticated API GET requests. Only verified iOS/Android production apps are included; Test Store and sandbox are excluded. Raw financial events and user identifiers remain in ignored private warehouse files. Scheduled runs must refresh both sources; `--reuse-revenue` is only for a manual checked archive.

Daily money is RevenueCat source gross charges plus supported signed refund adjustments in USD, before store commissions/taxes; it is not net proceeds. Charge timestamps define the exact Warsaw day; refund event timestamps define adjustment days. Trials contribute no money. Each transaction is counted once, rounded to cents. Ambiguous/unsupported monetary adjustments make finance unavailable rather than silently reporting zero.

Country is linked from valid PostHog purchase_succeeded events using the exact app_user_id plus transaction_id, or original_transaction_id for renewal lineage. This is purchase exam country, while active users use their day's exam country. Conflicting or missing joins go to UNKNOWN. RevenueCat location/store country and UI language are never substituted. The current client does not send exam_country to RevenueCat.

Validation: all 623 customer profiles and 14 production source events were fetched. For October 1–7 UTC, 8 paid transactions totaled USD 54.02, matching the RevenueCat revenue chart; exact joins assigned PL USD 12.89, CZ USD 41.13, SK USD 0.00, UNKNOWN USD 0.00. That UTC reconciliation is distinct from daily Warsaw reporting. October 8 Warsaw had no paid transactions: each country USD 0.00. These observations are as of October 9 and may be revised by late events/refunds.

`country-summary.json` exposes revenue_source status, source as-of, positive transaction count and unattributed transaction count. A verified complete source observation can produce a true zero; API/attribution-source failures produce unavailable fields. Completeness means pagination finished as of the source fetch, not a guaranteed delivery watermark.

Optional `--revenue-file` still accepts a reviewed snapshot with exact day, timezone Europe/Warsaw, source RevenueCat, country_basis exam_country, complete true and all PL/CZ/SK/UNKNOWN currency buckets. It is a manual override, not the scheduled path.

References: [PostHog people](https://posthog.com/docs/data/persons), [PostHog sessions](https://posthog.com/docs/data/sessions), [RevenueCat API auth](https://www.revenuecat.com/docs/api-v2), [Customer resources](https://www.revenuecat.com/docs/api-v2/customer/resources), [Subscription transactions](https://www.revenuecat.com/docs/api-v2/subscription-transactions).

## Agent interpretation and delivery

After counts, agent reads engine JSON for that exact date and report policy. Report includes 2–3 factual observations and one next action. Client purchase successes are not money. Exclude prohibited rates/small-cell causal conclusions. State versions; old build errors cannot be asserted against a new release. Main message under 2000 characters, plain text, blank lines and one country block each. Detailed explanations in a thread if useful. Search for “Prawko · показники за DD.MM.YYYY” before sending; if it already exists do not send a second parent message. Revisions can be disclosed in the existing thread. Failure: send a concise truthful source-failure message, without raw identifiers or credentials. This report cannot change ads, prices or production code. Advertising focus stays CZ/PL, no SK ads.

## Facts versus interpretation (updated October 9)

After the country metric blocks, use three explicit Ukrainian sections:
- ФАКТИ З ДАНИХ: only verified observations, with source/date and relevant version or segment per item.
- МОЇ ВИСНОВКИ: agent interpretation linked to those facts; hypotheses/uncertainty explicit. Never attribute an agent recommendation to engine.
- НАСТУПНА ДІЯ: one concrete proposed action.

RevenueCat credentials and the automatic adapter are now validated. Financial facts must include the source as-of and identify gross USD amounts; uncertain country attribution remains separate.

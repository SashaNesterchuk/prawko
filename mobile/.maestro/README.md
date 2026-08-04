# Maestro E2E (BDD-style UI flows)

Clickable end-to-end flows for Prawko mobile. Selectors use `testID` so tests stay stable across `pl` / `ua` / `en`.

## Prerequisites

1. App installed on a simulator/emulator (or device):
   - `pnpm ios` / `pnpm android` from `mobile/`, or an EAS `e2e-test` build
2. [Maestro CLI](https://docs.maestro.dev/getting-started/installing-maestro)

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

## Run locally

From `mobile/`:

```bash
pnpm test:e2e
# or one flow:
pnpm test:e2e -- .maestro/onboarding_completes_and_lands_on_home.yaml
# interactive recorder / inspector:
pnpm test:e2e:studio
```

## Flows

| Flow | What it covers |
| --- | --- |
| `onboarding_completes_and_lands_on_home.yaml` | Category → exam date → skip notifications → Home |
| `tabs_are_navigable.yaml` | Tab bar: Home / Learn / Signs / Profile |
| `home_opens_trainer_modes.yaml` | Home → Trainer tile |

Shared steps live in `subflows/complete_onboarding.yaml`.

## Writing new flows

1. Add a stable `testID` on the interactive element (prefer `id:` selectors).
2. Describe the scenario in a short comment (`Feature` / `Scenario`).
3. Prefer `runFlow` for repeated setup instead of copy-paste.
4. Use `clearState: true` for fresh-install scenarios.

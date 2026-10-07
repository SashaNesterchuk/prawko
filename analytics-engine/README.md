# Prawko analytics engine

Deterministic layer for Prawko product analytics. The design is fixed in [docs/analytics/engine.md](../docs/analytics/engine.md). This package does not call a model.

```bash
cd analytics-engine
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
.venv/bin/pytest

.venv/bin/prawko-analytics ingest ../docs/analytics/prawko-posthog-dump-2026-10-03.json
.venv/bin/prawko-analytics context --day 2026-10-03 --out /tmp/prawko-2026-10-03.json
```

`ingest` writes `warehouse/events/day=YYYY-MM-DD/events.parquet`. That directory is gitignored. Re-ingesting a day replaces the partition. `context` reads the partitions that cover the window and prints a validated context. `compare` reads two context files and marks attribution `limited`, `prohibited`, or `not_applicable`.

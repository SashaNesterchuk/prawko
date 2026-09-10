# Rewrite v2 AI explanations

**Front door (start here if you forgot):** [`docs/rewrite-explanations-v2.md`](../../docs/rewrite-explanations-v2.md)

Standalone CLI. Not imported by the app. One script, one pack per country.

It rewrites `question_ai_explanations_v2` into learner text: why the correct
option is right, and what the others get wrong. It does **not** insert or
delete rows. Apply is `UPDATE … SET explanations = explanations || patch`
for the pack’s write locales only.

CZ (`cz-v2-current`, 1,136 rows, version `cz-learner-explanation-v1`) already
ran this path. SK/PL packs exist in `packs.py`; fill the remaining fields and
follow the same loop.

## Do not

- Fork this folder per country. Add a `CountryPack` in `packs.py`.
- Call `apply` until you have sampled `state.json`.
- Point dump/apply at the dashboard Supabase project. Prawko is
  `ybqoporhnnbaluhaoppo`, via the local Supabase CLI token (macOS keyring).
- Put the mobile PostHog `phc_…` key, or dashboard `SUPABASE_*`, into this
  script’s env. OpenAI may come from the dashboard `.env`; Supabase may not.

## Layout

| Path | Role |
| --- | --- |
| `rewrite.py` | CLI: dump, prepare-law, generate, preview, apply |
| `packs.py` | Country config. This is the only file you fill for SK/PL. |
| `generate.py` | Prompts, OpenAI, resume/`--rerun` |
| `media.py` | When to attach a still; ffmpeg for video |
| `law.py` | Download/parse statutes; local retrieval |
| `validate.py` | Header, length, banned phrases, sign codes, invented `§` |
| `db.py` | Dump + UPDATE. Never DELETE. |

Work files (gitignored under `supabase/backups/`):

```text
supabase/backups/rewrite-explanations-v2/<country>/
  questions.jsonl      dump
  dump-meta.json
  state.json           generated texts; apply reads this
  cache/media|frames   downloaded stills / ffmpeg frames
  prompts/             --dry-run only
```

Law cache (also gitignored): `data/legal/<country>/raw/*.html` and `articles.json`.

## Prerequisites

1. Python 3. Dump/apply need `supabase login` so
   `supabase/backups/_dump_remote.py` can read the CLI token.
2. `OPENAI_API_KEY` — first hit in `prawko/.env.local`, `mobile/.env.local`,
   then `mindjar-dashboard/.env` (OpenAI keys only).
3. Optional `EXPLANATION_REWRITE_MODEL` (default `gpt-4.1-mini`; visual rerun
   defaults to `gpt-4.1`).
4. Media CDN in `mobile/.env.local`: `EXPO_PUBLIC_CZECH_MEDIA_BASE_URL` /
   `EXPO_PUBLIC_SLOVAK_MEDIA_BASE_URL` / `EXPO_PUBLIC_MEDIA_BASE_URL`.
5. `ffmpeg` on PATH if the country has question videos.
6. Sign catalogue JSON at `pack.sign_catalog_path` (`id` / `code` + `name`).

Dump selects active `questions_v2` in `pack.question_set_key` that already have
an explanation in `pack.locale`. No explanation row → skipped, never inserted.

## Commands

From the repo root. Replace `cz` with `sk` / `pl`.

```bash
python3 scripts/rewrite-explanations-v2/rewrite.py --country cz dump
python3 scripts/rewrite-explanations-v2/rewrite.py --country cz prepare-law
python3 scripts/rewrite-explanations-v2/rewrite.py --country cz generate --dry-run
python3 scripts/rewrite-explanations-v2/rewrite.py --country cz generate
python3 scripts/rewrite-explanations-v2/rewrite.py --country cz preview --limit 12
python3 scripts/rewrite-explanations-v2/rewrite.py --country cz generate --rerun visual --model gpt-4.1
python3 scripts/rewrite-explanations-v2/rewrite.py --country cz apply
```

`all` = dump + prepare-law + generate. It never applies.

| Flag | Meaning |
| --- | --- |
| `--limit N` | First N selected rows |
| `--source-id cz:RP…` | One item |
| `--source-ids a,b` or `@file` | Several ids |
| `--skip-reviewed` | Leave `keep_explanation_versions` (CZ manuals) alone |
| `--force` | Rewrite even if already in `state.json` |
| `--media auto` | Default. Picture only if the prompt is a generic scene and stored scene/signs cannot replace it |
| `--media off` | Text only |
| `--media on` | Picture when context is thin |
| `--media force` | Picture whenever the question has media |
| `--rerun visual` | Official-text picture items already in state. Implies `--force` and `--media force`. Uses `gpt-4.1` unless `--model` is set |
| `--workers 3` | Parallel batches |
| `--refresh-law` | Re-download statutes |

Generate resumes: ids already in `state.json` are skipped unless `--force` /
`--rerun`. Failed batches keep the previous text.

Copy `state.json` before a visual rerun (`state.pre-visual-rerun.json`).

## Quality loop (what CZ needed)

1. **Dump and look at old versions.** CZ was 856 tautological
   `cz-official-text-explanation-v1` templates plus 280 short useful
   `cz-manual-explanation-v1` rows. Put useful versions in
   `keep_explanation_versions`. Generate still rewrites them by default, but
   sends the old text as context when it looks useful (≥ 80 chars, no banned
   phrase). `--skip-reviewed` leaves those versions untouched on generate/apply.
2. **Cheap pass:** `generate` with `gpt-4.1-mini` and `--media auto`.
3. **Sample 10–15** with `preview` (and by opening media URLs). Check validity,
   grammar, and whether wrong options are taught — not “does not match the
   assignment”.
4. **Visual rerun:** `--rerun visual --model gpt-4.1`. Mini + a still still
   invents layout (vedlejší, semafory) and wrong `§`. Selection is: not a kept
   manual, and (`usedMedia` or generic/scene prompt + assets).
5. **Hand-fix the remaining traps** in `state.json` against the photo. CZ
   example: tram leaving a pedestrian zone (`cz:RP2110013`) is `§ 23`, not
   “car has priority over an oncoming tram”.
6. **Apply** only after that. Then spot-check a few `source_id`s in SQL.

`needsManualReview` is noisy. Soft validation (`too_long`, `uncoded_sign`,
`missing_wrong_options`, unknown sign code) sets the flag but still accepts
the row. Hard failures (empty, too short, bad header, banned phrase, invented
paragraph, no diacritics) skip the item.

Wrong `§` is worse than none. Cite only from `retrievedLaw`. Wrong catalogue
codes (P-7 vs B-28a) are common on vision items — check signs against the
photo, not the model’s `signCodes`.

## Apply contract

```sql
UPDATE public.question_ai_explanations_v2 AS e
SET
  explanations = e.explanations || v.patch,  -- write_locales only
  available_locales = union(old, write_locales),
  explanation_version = pack.explanation_version,
  provider, model, confidence, needs_manual_review, reason
WHERE e.question_id = v.question_id
  AND question set key = pack.question_set_key
```

- No `DELETE`. No `INSERT`. Missing `question_id` → chunk count mismatch, abort.
- `protected_locales` are never in the patch (PL: `ua`, `en`, `de`, `es`).
- Without `--skip-reviewed`, kept manuals are updated too (CZ did this).
- CZ apply (2026-09-10): 1,136/1,136, still 1,136 rows, version
  `cz-learner-explanation-v1`.

## Fill a pack (SK next)

Copy the CZ `CountryPack` shape in `packs.py`. SK is already stubbed
(`sk-v2-current`, locale `sk`, signs `data/sk-road-signs-wikimedia/manifest.json`,
law 8/2009 + 30/2020). Before generate:

1. **Dump** and count rows / `explanation_version`s. Set
   `keep_explanation_versions` if some SK rows are already good manuals.
2. **Banned phrases** — grep current `sk` text for the template filler and add
   those strings.
3. **Headers** — `start_correct` / `start_yes` / `start_no` must match how you
   want the first sentence (`Správne je A.` / `áno` / `nie`).
4. **Signs** — Slovak codes are numeric (`101`, `110-10`). `validate.py`
   already has `SK_SIGN_RE`. Catalogue `id` must match what the model should
   write.
5. **Law** — `prepare-law` fetches HTML. If slov-lex blocks or returns a
   shell page, save the full HTML to `data/legal/sk/raw/<source-id>.html` and
   rerun. Parser splits on `paragraph_marker` (`§` or `art.`).
6. **Media** — `EXPO_PUBLIC_SLOVAK_MEDIA_BASE_URL` + `media_local_roots`.
   Object keys follow the Slovak import (`question-images/sk/…`).
7. **Prompts** — `generic_prompt_re` + `scene_prompt_re` decide “this item is
   the picture” (`--media auto` and `--rerun visual`). Tune after reading 20
   real prompts.
8. **`topic_query_extra`** — Slovak keywords per `primary_topic_id` for law
   retrieval. Stub is already there; extend from dump topics.
9. **`write_locales`** — SK is `("sk",)` only. Add `"en"` only if you want a
   second locale in the same patch.
10. Run `--limit 8` then `--rerun visual` on that slice before the full set.

Do not reuse CZ `banned_phrases` or `citation_example`. Do not cite 361/2000
on SK items.

PL is the same, except `protected_locales` must stay out of `write_locales`,
and the marker is `art.` not `§`.

## Env and cost

| Key | Where | Used for |
| --- | --- | --- |
| OpenAI | prawko / mobile / dashboard `.env*` | generate only |
| Supabase CLI token | macOS keyring | dump + apply |
| Media base URL | `mobile/.env.local` | vision stills |

Default generate: `gpt-4.1-mini`, `--media auto`, law 3 hits × ~600 chars,
image `detail: low`. Visual rerun: `gpt-4.1`, `--media force`, `detail: high`.
CZ visual slice was ~172 items.

## Related

- Czech questions: `docs/czech-question-import.md`
- Slovak questions: `docs/slovak-question-import.md`
- Dump helper: `supabase/backups/_dump_remote.py`

# Road signs feature

Hybrid catalog: all Polish signs are browsable from `data/pl-road-signs-wikimedia/urls.json`, while curated entries add name, description, local SVG, and practice questions.

## Pilot flow

1. Tab `/(tabs)/signs`
2. Category `A` → sign `A-1`
3. Detail with name, description, practice CTA
4. `/signs/A-1/practice` — 3 MCQ questions

Browse-only signs (no curated content) still open from search/category grids and show a generic description template.

## Add a new curated sign

### 1. SVG asset

Add one file to `mobile/assets/pl-road-signs-wikimedia/`:

```text
PL_road_sign_B-1.svg
```

Commit only the signs you curate. Do not bulk-add the full Wikimedia folder.

### 2. Register the asset

In `content/signAssets.ts`:

```ts
import PlRoadSignB1 from "../../../../assets/pl-road-signs-wikimedia/PL_road_sign_B-1.svg";

export type SignAssetKey = "A-1" | "B-1";

export const signAssets: Record<SignAssetKey, ComponentType<SvgProps>> = {
  "A-1": PlRoadSignA1,
  "B-1": PlRoadSignB1,
};
```

The `assetKey` must match the sign code (e.g. `"B-1"`).

### 3. Sign content

Create `content/signs/B-1.ts`:

```ts
import { B1_PRACTICES } from "../practices/B-1";
import type { RoadSignContent } from "../types";

export const B1_CONTENT: RoadSignContent = {
  id: "B-1",
  categoryId: "B",
  assetKey: "B-1",
  name: { pl: "...", ua: "...", en: "..." },
  description: { pl: "...", ua: "...", en: "..." },
  practices: B1_PRACTICES,
};
```

### 4. Practice questions

Create `content/practices/B-1.ts` with 2–4 `SignPractice` items (prompt, options, `correctOptionId`, optional `explanation`).

### 5. Register in catalog

In `content/registry.ts`:

```ts
import { B1_CONTENT } from "./signs/B-1";

const CURATED_SIGNS: Record<string, RoadSignContent> = {
  "A-1": A1_CONTENT,
  "B-1": B1_CONTENT,
};
```

Search automatically includes curated names via `matchesCuratedSearch()`.

### 6. Verify

- Category grid shows local SVG and curated name (if applicable)
- Detail: name, description, practice block
- Practice screen completes with score
- Search finds the sign by code and localized name

## Key files

| File | Role |
|------|------|
| `catalog.ts` | Browse catalog from `urls.json` |
| `content/registry.ts` | Curated lookup API |
| `SignImage.tsx` | Local SVG or CDN fallback |
| `app/signs/[signId]/index.tsx` | Sign detail |
| `app/signs/[signId]/practice.tsx` | Sign practice flow |

## Figma / design screens

Reference mocks live in [`des/`](../../../../des/) at repo root.

| Mock file | Route |
|-----------|-------|
| `signs-list · Знаки.png` | `/(tabs)/signs` — summary card + category progress list |
| `signs-category · Категорія знаків.png` | `/signs/category/[categoryId]` — vertical catalog cards + sticky **Тренувати** |
| `signs-detail · Деталі знака*.png` | `/signs/[signId]` — close header, status badge, prev/next within category |
| `test-sign · Тест по знакам.png` | `/signs/category/[categoryId]/test` — numbered pills, A/B/C options |

Per-sign practice (`/signs/[signId]/practice`) remains for curated single-sign drills; category test is the primary training entry from the category screen.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import signUrls from "../../../../../data/pl-road-signs-wikimedia/urls.json";
import dlakierowcyMetadata from "../../../../../data/pl-road-signs-wikimedia/dlakierowcy.metadata.json";
import generatedMetadata from "../../../../../data/pl-road-signs-wikimedia/metadata.generated.json";
import { resources } from "../../../i18n/resources";
import { GENERATED_SIGN_PRACTICE_CONTENT } from "../content/generatedPractices";
import { buildSearchText, pickLocalized } from "../content/localized";
import type { LocalizedString } from "../content/types";
import type { RoadSignCategoryId } from "../types";

const repoRoot = resolve(__dirname, "../../../../../");
const dataDir = join(repoRoot, "data/pl-road-signs-wikimedia");
const mobileAssetDir = join(repoRoot, "mobile/assets/pl-road-signs-wikimedia");
const categoryIconDir = join(repoRoot, "mobile/assets/sign-category-icons");

const CATEGORY_ORDER: RoadSignCategoryId[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "T",
  "G",
  "P",
  "S",
  "W",
];

const FIGMA_TITLES = {
  pl: {
    A: "Znaki ostrzegawcze",
    B: "Znaki zakazu",
    C: "Znaki nakazu",
    D: "Znaki informacyjne",
    E: "Znaki kierunku i miejscowości",
    F: "Znaki uzupełniające",
    T: "Tabliczki do znaków drogowych",
    G: "Znaki dodatkowe",
    P: "Znaki drogowe poziome",
    S: "Znaki świetlne",
  },
  en: {
    E: "Directional signs",
    P: "Road markings",
    S: "Traffic signals",
  },
} as const;

type GeneratedEntry = {
  id: string;
  categoryId: string;
  name: LocalizedString | string;
  description: LocalizedString | string;
};

function parseSignCode(filename: string): string {
  return filename.replace(/^PL_road_sign_/, "").replace(/\.(svg|png|jpe?g)$/i, "");
}

function asLocalized(value: LocalizedString | string): LocalizedString {
  if (typeof value === "string") {
    return { pl: value, ua: value, en: value };
  }

  return value;
}

const metadata = generatedMetadata as Record<string, GeneratedEntry>;

describe("road sign catalog integrity", () => {
  it("keeps data and mobile url maps in sync with files on disk", () => {
    const dataUrls = JSON.parse(
      readFileSync(join(dataDir, "urls.json"), "utf8")
    ) as Record<string, string>;

    expect(dataUrls).toEqual(signUrls);
    expect(Object.keys(signUrls).some((name) => name.includes("%28"))).toBe(
      false
    );

    for (const filename of Object.keys(signUrls)) {
      expect(existsSync(join(dataDir, filename))).toBe(true);
      expect(existsSync(join(mobileAssetDir, filename))).toBe(true);
    }
  });

  it("includes every dlakierowcy sign and the official extras with SVGs", () => {
    const catalogIds = new Set(Object.keys(signUrls).map(parseSignCode));

    for (const signId of Object.keys(dlakierowcyMetadata)) {
      expect(catalogIds.has(signId)).toBe(true);
    }

    expect(catalogIds.has("F-23")).toBe(true);
    expect(catalogIds.has("F-24")).toBe(true);
    expect(catalogIds.has("P-27")).toBe(true);
    expect(catalogIds.has("D-39")).toBe(true);
    expect(signUrls["PL_road_sign_D-39.svg"]).toContain("wikimedia");
    expect(signUrls["PL_road_sign_D-39.jpg"]).toBeUndefined();
  });

  it("has localized metadata for every catalog sign", () => {
    const catalogIds = Object.keys(signUrls).map(parseSignCode);

    expect(Object.keys(metadata).sort()).toEqual([...catalogIds].sort());

    for (const signId of catalogIds) {
      const entry = metadata[signId];
      const name = asLocalized(entry.name);
      const description = asLocalized(entry.description);

      expect(entry.categoryId).toBe(signId.split("-")[0]);
      expect(name.pl.trim().length).toBeGreaterThan(0);
      expect(name.ua.trim().length).toBeGreaterThan(0);
      expect(name.en.trim().length).toBeGreaterThan(0);
      expect(description.pl.trim().length).toBeGreaterThan(0);
      expect(description.ua.trim().length).toBeGreaterThan(0);
      expect(description.en.trim().length).toBeGreaterThan(0);

      if (name.pl !== "STOP" && name.pl !== "BUS") {
        expect(name.ua).toMatch(/[А-Яа-яІіЇїЄєҐґ]/);
        expect(name.ua).not.toBe(name.pl);
      }
    }
  });

  it("keeps only E-17b and E-18b as raster fallbacks", () => {
    const rasterFiles = readdirSync(mobileAssetDir).filter((name) =>
      /\.(png|jpe?g)$/i.test(name)
    );

    expect(rasterFiles.sort()).toEqual([
      "PL_road_sign_E-17b.png",
      "PL_road_sign_E-18b.png",
    ]);
  });

  it("ships a unique category icon for every catalog group", () => {
    const iconContents = CATEGORY_ORDER.map((categoryId) => {
      const iconPath = join(categoryIconDir, `SignCategory-${categoryId}.svg`);
      expect(existsSync(iconPath)).toBe(true);
      const contents = readFileSync(iconPath, "utf8");
      expect(contents).toContain("<svg");
      return contents;
    });

    expect(new Set(iconContents).size).toBe(CATEGORY_ORDER.length);
  });

  it("exposes Figma category titles in all interface languages", () => {
    for (const locale of ["pl", "ua", "en"] as const) {
      const categories = resources[locale].translation.signs.categories;

      expect(Object.keys(categories)).toEqual(CATEGORY_ORDER);

      for (const categoryId of CATEGORY_ORDER) {
        expect(categories[categoryId].title.trim().length).toBeGreaterThan(0);
        expect(categories[categoryId].subtitle.trim().length).toBeGreaterThan(0);
      }
    }

    const pl = resources.pl.translation.signs.categories;
    for (const [categoryId, title] of Object.entries(FIGMA_TITLES.pl)) {
      expect(pl[categoryId as keyof typeof pl].title).toBe(title);
    }

    expect(resources.en.translation.signs.categories.E.title).toBe(
      FIGMA_TITLES.en.E
    );
    expect(resources.en.translation.signs.categories.P.title).toBe(
      FIGMA_TITLES.en.P
    );
    expect(resources.en.translation.signs.categories.S.title).toBe(
      FIGMA_TITLES.en.S
    );
  });

  it("localizes A-1 and searches across languages", () => {
    const a1 = asLocalized(metadata["A-1"].name);
    const description = asLocalized(metadata["A-1"].description);

    expect(a1).toEqual({
      pl: "Niebezpieczny zakręt w prawo",
      ua: "Небезпечний поворот праворуч",
      en: "Dangerous bend to the right",
    });
    expect(pickLocalized(a1, "ua")).toBe("Небезпечний поворот праворуч");
    expect(pickLocalized(a1, "de")).toBe("Dangerous bend to the right");

    const searchText = buildSearchText("A-1", a1, description);
    expect(searchText).toContain("поворот");
    expect(searchText).toContain("dangerous bend");
  });

  it("builds localized name quizzes for new categories", () => {
    for (const signId of ["A-1", "E-1", "P-1", "S-1", "F-23", "P-27"]) {
      const content = GENERATED_SIGN_PRACTICE_CONTENT[signId];
      expect(content?.id).toBe(signId);

      const nameQuestion = content.practices.find(
        (practice) => practice.id === `${signId}-name`
      );
      expect(nameQuestion).toBeDefined();
      expect(nameQuestion?.options[0]?.label.ua).toMatch(/[А-Яа-яІіЇїЄєҐґ]/);
      expect(nameQuestion?.options[0]?.label.en).not.toBe(
        nameQuestion?.options[0]?.label.pl
      );
    }
  });

  it("does not leave Polish names as the raw sign code", () => {
    for (const [signId, entry] of Object.entries(metadata)) {
      const name = asLocalized(entry.name);
      const description = asLocalized(entry.description);

      expect(name.pl.trim()).not.toBe(signId);
      expect(description.pl.trim()).not.toBe(".");
      expect(description.pl.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses the official W-3 and W-5 names from the regulation", () => {
    expect(asLocalized(metadata["W-3"].name).pl).toBe(
      "klasa obciążenia mostu o ruchu jednokierunkowym dla pojazdów kołowych i gąsienicowych"
    );
    expect(asLocalized(metadata["W-5"].name).pl).toBe(
      "klasa obciążenia mostu o ruchu dwukierunkowym dla pojazdów gąsienicowych"
    );
    expect(asLocalized(metadata["W-5"].description).pl).not.toBe(".");
  });

  it("registers an SVG or raster asset for every catalog sign", () => {
    const svgRegistry = readFileSync(
      join(repoRoot, "mobile/src/features/road-signs/content/generatedSignAssets.ts"),
      "utf8"
    );
    const rasterRegistry = readFileSync(
      join(
        repoRoot,
        "mobile/src/features/road-signs/content/generatedRasterSignAssets.ts"
      ),
      "utf8"
    );

    for (const filename of Object.keys(signUrls)) {
      const signId = parseSignCode(filename);
      if (filename.endsWith(".svg")) {
        expect(svgRegistry).toContain(`"${signId}":`);
      } else {
        expect(rasterRegistry).toContain(`"${signId}":`);
      }
    }
  });
});

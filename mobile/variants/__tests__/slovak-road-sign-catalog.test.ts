import czManifest from "../../../data/cz-road-signs-dopravni-znaceni-eu/manifest.json";
import skManifest from "../slovak/source-manifest.json";

import { pickLocalized } from "../../src/features/road-signs/content/localized";
import { CZECH_RASTER_ALIASES } from "../slovak/cz-raster-aliases";
import { roadSignCatalog } from "../slovak/road-sign-catalog";
import {
  getSignDescription,
  getSignDisplayName,
  getSignPractices,
} from "../slovak/road-sign-content";

const czechIds = new Set(
  (czManifest.signs as Array<{ id: string }>).map((sign) => sign.id)
);
const slovakIds = new Set(roadSignCatalog.signs.map((sign) => sign.id));

describe("Slovak road-sign catalogue", () => {
  it("uses Slovak legal codes and Commons previews, not PL/CZ ids", () => {
    expect(roadSignCatalog.signs).toHaveLength(621);
    expect(roadSignCatalog.categories.map((category) => category.id)).toEqual([
      "A",
      "G",
      "B",
      "C",
      "E",
      "D",
      "T",
    ]);
    expect(roadSignCatalog.signs.some((sign) => sign.id.startsWith("A-"))).toBe(
      false
    );
    expect(roadSignCatalog.signs.every((sign) => /^\d/.test(sign.code))).toBe(
      true
    );
    expect(
      roadSignCatalog.signs.every((sign) =>
        sign.previewUrl.startsWith("https://")
      )
    ).toBe(true);
  });

  it("names STOP in Slovak and keeps it searchable", () => {
    expect(getSignDisplayName("202", "sk")).toBe("Stoj, daj prednosť v jazde!");
    expect(pickLocalized({ pl: "x", ua: "x", en: "Stop", sk: "Stoj" }, "sk")).toBe(
      "Stoj"
    );
    expect(getSignDisplayName("202", "en")).toBe("Stoj, daj prednosť v jazde!");
  });

  it("has a Slovak description and a name-recognition question for each sign", () => {
    for (const sign of roadSignCatalog.signs) {
      const description = getSignDescription(sign.id, "sk");
      const practice = getSignPractices(sign.id)[0];

      expect(description).toBeTruthy();
      expect(practice?.options).toHaveLength(4);
      expect(
        practice?.options.some((option) => option.id === practice.correctOptionId)
      ).toBe(true);
    }
  });

  it("reuses only pictogram-identical Czech rasters", () => {
    expect(CZECH_RASTER_ALIASES["202"]).toBe("P-6");
    expect(CZECH_RASTER_ALIASES["201"]).toBe("P-4");
    expect(CZECH_RASTER_ALIASES["230"]).toBe("B-2");
    expect(CZECH_RASTER_ALIASES["110-10"]).toBeUndefined();
    expect(CZECH_RASTER_ALIASES["A-1a"]).toBeUndefined();

    for (const [slovakId, czechId] of Object.entries(CZECH_RASTER_ALIASES)) {
      expect(slovakIds.has(slovakId)).toBe(true);
      expect(czechIds.has(czechId)).toBe(true);
    }
  });

  it("keeps Commons names in the source manifest", () => {
    const stop = (skManifest.signs as Array<{ id: string; name: string }>).find(
      (sign) => sign.id === "202"
    );
    expect(stop?.name).toBe("Stoj, daj prednosť v jazde!");
  });
});

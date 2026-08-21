import { roadSignCatalog } from "../czech/road-sign-catalog";
import {
  getSignDescription,
  getSignPractices,
} from "../czech/road-sign-content";

describe("Czech road-sign catalogue", () => {
  it("contains every downloaded sign in Czech learning groups", () => {
    expect(roadSignCatalog.signs).toHaveLength(360);
    expect(roadSignCatalog.categories.map((category) => category.id)).toEqual([
      "A", "G", "B", "C", "E", "D", "T", "P", "S", "F",
    ]);
    expect(roadSignCatalog.signs.every((sign) => sign.previewUrl.startsWith("http"))).toBe(true);
  });

  it("has a Czech description and a name-recognition question for each sign", () => {
    for (const sign of roadSignCatalog.signs) {
      const description = getSignDescription(sign.id, "cs");
      const practice = getSignPractices(sign.id)[0];

      expect(description).toBeTruthy();
      expect(practice?.options).toHaveLength(4);
      expect(practice?.options.some((option) => option.id === practice.correctOptionId)).toBe(true);
    }
  });
});

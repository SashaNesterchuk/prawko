import { extractExplanationSignCodes } from "../explanation-sign-codes";

describe("extractExplanationSignCodes", () => {
  it("returns normalized, unique Polish sign identifiers in source order", () => {
    expect(
      extractExplanationSignCodes(
        "Діє знак b-20, а попередження дає знак A-11A. Повтор: B-20."
      )
    ).toEqual(["B-20", "A-11a"]);
  });

  it("keeps sign variants and ignores measurements without a sign category", () => {
    expect(
      extractExplanationSignCodes(
        "Знак C-13-16b діє на цій ділянці, а відстань становить 50 м."
      )
    ).toEqual(["C-13-16b"]);
  });

  it("does not treat horizontal road-marking codes as sign images", () => {
    expect(
      extractExplanationSignCodes(
        "Розмітка P-12 визначає місце зупинки."
      )
    ).toEqual([]);
  });
});

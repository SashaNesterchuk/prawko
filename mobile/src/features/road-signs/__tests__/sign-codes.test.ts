import { extractSignReferences } from "../sign-codes";

/** Verbatim shape of the `2026-08-17-ua-decision-reasoning-v3` explanations. */
const UA_EXPLANATION =
  'Відповідь «так». Знак C-12 наказує рух по кільцю, але без знака A-7 не надає ' +
  "переваги автомобілям, які вже рухаються кільцем. За art. 25 ust. 1 Prawa o ruchu " +
  "drogowym ви маєте дати дорогу транспортному засобу, що в’їжджає справа.";

describe("extractSignReferences", () => {
  it("picks up every sign code mentioned in an explanation", () => {
    expect(extractSignReferences(UA_EXPLANATION).map((sign) => sign.code)).toEqual(
      ["C-12", "A-7"]
    );
  });

  it("leaves legal citations alone", () => {
    expect(extractSignReferences("Zgodnie z art. 25 ust. 1 ustawy.")).toEqual([]);
  });

  it("returns each sign once, in first-appearance order", () => {
    const codes = extractSignReferences(
      "Znak B-20 oznacza stop. Za znakiem B-20 stoi A-7."
    ).map((sign) => sign.code);

    expect(codes).toEqual(["B-20", "A-7"]);
  });

  it("resolves codes with a letter suffix", () => {
    expect(
      extractSignReferences("Uwaga na A-12a oraz A-18b.").map((sign) => sign.code)
    ).toEqual(["A-12a", "A-18b"]);
  });

  it("drops codes that have no sign in the catalog", () => {
    expect(extractSignReferences("Tabliczka D-47a nie istnieje.")).toEqual([]);
  });

  it("skips the sign already shown in the question body", () => {
    expect(
      extractSignReferences("Porównaj B-20 z A-7.", "B-20").map(
        (sign) => sign.code
      )
    ).toEqual(["A-7"]);
  });

  it("handles missing text", () => {
    expect(extractSignReferences(null)).toEqual([]);
    expect(extractSignReferences(undefined)).toEqual([]);
    expect(extractSignReferences("")).toEqual([]);
  });
});

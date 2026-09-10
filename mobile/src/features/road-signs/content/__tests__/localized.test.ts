import { buildSearchText, pickLocalized } from "../localized";

describe("pickLocalized", () => {
  const value = {
    pl: "polski",
    ua: "українська",
    en: "english",
    cs: "česky",
    sk: "slovensky",
  };

  it("keeps Polish, Ukrainian, Czech, and English lookups unchanged", () => {
    expect(pickLocalized(value, "pl")).toBe("polski");
    expect(pickLocalized(value, "ua")).toBe("українська");
    expect(pickLocalized(value, "en")).toBe("english");
    expect(pickLocalized(value, "cs")).toBe("česky");
    expect(pickLocalized(value, "de")).toBe("english");
  });

  it("uses Slovak copy when present and English otherwise", () => {
    expect(pickLocalized(value, "sk")).toBe("slovensky");
    expect(pickLocalized({ pl: "pl", ua: "ua", en: "english" }, "sk")).toBe(
      "english"
    );
  });

  it("indexes Slovak names in search text", () => {
    const search = buildSearchText("202", value);
    expect(search).toContain("slovensky");
    expect(search).toContain("česky");
  });
});

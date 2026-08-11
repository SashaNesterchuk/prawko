import {
  resolveMistakeRate,
  resolveMistakeRateStatus,
} from "../mistakes-rate";

describe("resolveMistakeRate", () => {
  it("returns 0 for empty totals", () => {
    expect(resolveMistakeRate(0, 0)).toBe(0);
    expect(resolveMistakeRate(5, 0)).toBe(0);
  });

  it("rounds wrong / total to a percent", () => {
    expect(resolveMistakeRate(143, 682)).toBe(21);
    expect(resolveMistakeRate(12, 32)).toBe(38);
    expect(resolveMistakeRate(15, 95)).toBe(16);
    expect(resolveMistakeRate(8, 110)).toBe(7);
    expect(resolveMistakeRate(4, 110)).toBe(4);
  });

  it("clamps out-of-range inputs", () => {
    expect(resolveMistakeRate(-3, 10)).toBe(0);
    expect(resolveMistakeRate(20, 10)).toBe(100);
  });
});

describe("resolveMistakeRateStatus", () => {
  it("maps Figma severity bands", () => {
    expect(resolveMistakeRateStatus(37)).toBe("bad");
    expect(resolveMistakeRateStatus(30)).toBe("bad");
    expect(resolveMistakeRateStatus(29)).toBe("normal");
    expect(resolveMistakeRateStatus(15)).toBe("normal");
    expect(resolveMistakeRateStatus(10)).toBe("normal");
    expect(resolveMistakeRateStatus(9)).toBe("good");
    expect(resolveMistakeRateStatus(7)).toBe("good");
    expect(resolveMistakeRateStatus(0)).toBe("good");
  });
});

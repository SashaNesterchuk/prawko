import {
  holesAreClose,
  holeRelativeToOverlay,
  paddedHole,
  spotlightCutoutPath,
} from "../spotlight-cutout";

describe("spotlight cutout", () => {
  it("maps the anchor into the overlay's coordinate space", () => {
    expect(
      holeRelativeToOverlay({ x: 0, y: 59 }, { x: 24, y: 83, width: 350, height: 140 })
    ).toEqual({ x: 24, y: 24, width: 350, height: 140 });
  });

  it("expands the hole with padding", () => {
    expect(paddedHole({ x: 24, y: 80, width: 300, height: 120 }, 8)).toEqual({
      x: 16,
      y: 72,
      width: 316,
      height: 136,
    });
  });

  it("punches a rounded hole out of the full overlay", () => {
    const path = spotlightCutoutPath({
      windowWidth: 400,
      windowHeight: 800,
      hole: { x: 20, y: 80, width: 360, height: 140 },
      radius: 20,
    });

    expect(path.startsWith("M0 0 H400 V800 H0 Z")).toBe(true);
    expect(path).toContain("M40 80");
    expect(path).toContain("H360");
  });

  it("treats two holes as stable only when they match", () => {
    const hole = { x: 24, y: 80, width: 300, height: 120 };

    expect(holesAreClose(null, hole)).toBe(false);
    expect(holesAreClose(hole, { ...hole, y: 80.4 })).toBe(true);
    expect(holesAreClose(hole, { ...hole, y: 96 })).toBe(false);
  });
});

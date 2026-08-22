import { getQuestionStillImageResizeMode } from "../question-image-fit";

describe("getQuestionStillImageResizeMode", () => {
  it("keeps Prawko photos cropped to the media frame", () => {
    expect(getQuestionStillImageResizeMode("prawko")).toBe("cover");
    expect(getQuestionStillImageResizeMode("greece")).toBe("cover");
  });

  it("letterboxes Czech eTesty GIFs instead of upscaling a crop", () => {
    expect(getQuestionStillImageResizeMode("czech")).toBe("contain");
  });
});

import { getCountryConfig } from "@prawko/config";

import { getQuestionStillImageResizeMode } from "../question-image-fit";

describe("question still image fit", () => {
  it("crops Polish delivery photos to the media frame", () => {
    expect(getCountryConfig("PL").questionImageResizeMode).toBe("cover");
    expect(getQuestionStillImageResizeMode()).toBe("cover");
  });

  it("letterboxes Czech eTesty GIFs instead of upscaling a crop", () => {
    expect(getCountryConfig("CZ").questionImageResizeMode).toBe("contain");
  });
});

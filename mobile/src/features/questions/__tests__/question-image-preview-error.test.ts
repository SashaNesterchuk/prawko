import { getQuestionImagePreviewErrorCode } from "../question-image-preview-error";

describe("getQuestionImagePreviewErrorCode", () => {
  it("maps HTTP statuses out of the native error text", () => {
    expect(
      getQuestionImagePreviewErrorCode({
        error: "Failed to load https://cdn.example/q.gif (400)",
      })
    ).toBe("400");
    expect(
      getQuestionImagePreviewErrorCode({ error: "HTTP 404 Not Found" })
    ).toBe("404");
    expect(getQuestionImagePreviewErrorCode({ error: "403 Forbidden" })).toBe(
      "403"
    );
  });

  it("maps timeout and network failures", () => {
    expect(getQuestionImagePreviewErrorCode({ error: "The request timed out" })).toBe(
      "timeout"
    );
    expect(
      getQuestionImagePreviewErrorCode({ error: "A network error occurred" })
    ).toBe("network");
  });

  it("does not use the raw native string as the code", () => {
    expect(getQuestionImagePreviewErrorCode(undefined)).toBe("image_load_failed");
    expect(getQuestionImagePreviewErrorCode({})).toBe("image_load_failed");
    expect(
      getQuestionImagePreviewErrorCode({
        error:
          "The operation couldn’t be completed. https://cdn.example/very-long-path.gif",
      })
    ).toBe("image_load_failed");
  });
});

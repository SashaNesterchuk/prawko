import { normalizeCapturedError } from "../error-logging";

jest.mock("expo-secure-store", () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

describe("normalizeCapturedError", () => {
  it("puts a provided error code on client_error_logged", () => {
    const normalized = normalizeCapturedError(
      {
        area: "question_media",
        error: { code: "400" },
        eventName: "question_media_preview_failed",
        message: "Question media preview failed to load.",
        metadata: {
          preview_url: "https://cdn.example/q.gif",
          why: "400",
        },
        severity: "warning",
      },
      {
        authMode: "guest",
        category: "B",
        locale: "cs",
      }
    );

    expect(normalized.analyticsPayload.error_code).toBe("400");
    expect(normalized.analyticsPayload.why).toBe("400");
    expect(normalized.persistedLog.errorCode).toBe("400");
  });
});

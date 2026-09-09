import {
  getRevenueCatDiagnostic,
  getRevenueCatErrorCode,
  getRevenueCatErrorMessage,
  getRevenueCatWhy,
  isRevenueCatOfflineConnectionError,
  isRevenueCatPurchaseCancelled,
} from "../revenuecat-errors";

describe("getRevenueCatErrorMessage", () => {
  it("maps missing SDK configuration", () => {
    expect(getRevenueCatErrorMessage(new Error("RevenueCat is not configured for this build."))).toBe(
      "Direct purchase is not configured in this build yet."
    );
  });

  it("maps store configuration failures from underlying errors", () => {
    expect(
      getRevenueCatErrorMessage({
        message: "Purchase was not completed.",
        underlyingErrorMessage:
          "There is an issue with your configuration. Check the underlying error for more details.",
      })
    ).toBe(
      "The App Store could not start this purchase. Check the product is available for this build and try again."
    );
  });

  it("maps missing store products", () => {
    expect(
      getRevenueCatErrorMessage(
        new Error("None of the products could be fetched from App Store Connect")
      )
    ).toBe(
      "The App Store could not load the Plus product. Try again in a moment."
    );
  });

  it("maps offer load timeouts", () => {
    expect(
      getRevenueCatErrorMessage(
        new Error("Timed out loading Plus offers from the store.")
      )
    ).toBe(
      "Loading the Plus offer timed out. Check the connection and try again."
    );
  });

  it("maps RevenueCat error 35 as offline even without offline in the message", () => {
    expect(
      getRevenueCatErrorMessage({
        code: "35",
        message: "Error performing request.",
        readableErrorCode: "OFFLINE_CONNECTION_ERROR",
      })
    ).toBe("The purchase request failed because the device is offline.");
  });

  it("returns a fallback for empty errors", () => {
    expect(getRevenueCatErrorMessage({})).toBe(
      "The purchase action could not be completed."
    );
  });
});

describe("isRevenueCatPurchaseCancelled", () => {
  it("detects StoreKit cancellation", () => {
    expect(isRevenueCatPurchaseCancelled({ userCancelled: true })).toBe(true);
    expect(isRevenueCatPurchaseCancelled(new Error("failed"))).toBe(false);
  });
});

describe("RevenueCat error codes", () => {
  it("reads numeric and string codes including 35", () => {
    expect(getRevenueCatErrorCode({ code: 35 })).toBe("35");
    expect(getRevenueCatErrorCode({ code: "35" })).toBe("35");
    expect(isRevenueCatOfflineConnectionError({ code: 23 })).toBe(false);
    expect(
      isRevenueCatOfflineConnectionError({
        code: "35",
        readableErrorCode: "OFFLINE_CONNECTION_ERROR",
      })
    ).toBe(true);
  });

  it("builds a why string from code plus readable code", () => {
    expect(
      getRevenueCatWhy({
        code: 35,
        readableErrorCode: "OFFLINE_CONNECTION_ERROR",
      })
    ).toBe("35:OFFLINE_CONNECTION_ERROR");
    expect(getRevenueCatWhy(new Error("secret"))).toBe("Error");
    expect(getRevenueCatWhy("nope")).toBe("unknown");
  });

  it("puts step and why into detail without a message key", () => {
    expect(
      getRevenueCatDiagnostic({
        extra: { source: "paywall" },
        kind: "retry",
        step: "get_offerings",
        why: "35:OFFLINE_CONNECTION_ERROR",
      })
    ).toEqual({
      detail:
        "step=get_offerings why=35:OFFLINE_CONNECTION_ERROR kind=retry source=paywall",
      kind: "retry",
      source: "paywall",
      step: "get_offerings",
      why: "35:OFFLINE_CONNECTION_ERROR",
    });
  });
});

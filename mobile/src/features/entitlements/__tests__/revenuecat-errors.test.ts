import {
  getRevenueCatErrorMessage,
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

import {
  STORE_OFFERS_TIMEOUT_MESSAGE,
  STORE_REQUEST_TIMEOUT_MS,
  withStoreRequestTimeout,
} from "../store-request-timeout";

describe("withStoreRequestTimeout", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rejects with a plain Error after the store budget, matching PostHog hydration failures", async () => {
    const pending = withStoreRequestTimeout(
      new Promise(() => undefined),
      STORE_REQUEST_TIMEOUT_MS,
      STORE_OFFERS_TIMEOUT_MESSAGE
    );
    const expected = expect(pending).rejects.toMatchObject({
      name: "Error",
      message: STORE_OFFERS_TIMEOUT_MESSAGE,
    });

    await jest.advanceTimersByTimeAsync(STORE_REQUEST_TIMEOUT_MS);
    await expected;
  });

  it("resolves when the store answers before the budget", async () => {
    const pending = withStoreRequestTimeout(
      Promise.resolve("ok"),
      STORE_REQUEST_TIMEOUT_MS,
      STORE_OFFERS_TIMEOUT_MESSAGE
    );

    await expect(pending).resolves.toBe("ok");
  });
});

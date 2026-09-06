export const STORE_REQUEST_TIMEOUT_MS = 20_000;
export const STORE_OFFERS_TIMEOUT_MESSAGE =
  "Timed out loading Plus offers from the store.";

export async function withStoreRequestTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function isRevenueCatPurchaseCancelled(error: unknown) {
  return Boolean((error as { userCancelled?: unknown })?.userCancelled);
}

export function getRevenueCatErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  const underlying = getUnderlyingErrorMessage(error);
  const combined = [message, underlying].filter(Boolean).join(" ");

  if (!combined) {
    return "The purchase action could not be completed.";
  }

  if (/not configured/i.test(combined)) {
    return "Direct purchase is not configured in this build yet.";
  }

  if (/timed out loading plus offers/i.test(combined)) {
    return "Loading the Plus offer timed out. Check the connection and try again.";
  }

  if (/network/i.test(combined) || /offline/i.test(combined)) {
    return "The purchase request failed because the device is offline.";
  }

  if (/package is no longer available/i.test(combined)) {
    return "The selected offer is no longer available.";
  }

  if (
    /none of the products could be fetched/i.test(combined) ||
    /could not be fetched from app store/i.test(combined) ||
    /product not available/i.test(combined) ||
    /store product not available/i.test(combined)
  ) {
    return "The App Store could not load the Plus product. Try again in a moment.";
  }

  if (
    /issue with your configuration/i.test(combined) ||
    /store problem/i.test(combined)
  ) {
    return "The App Store could not start this purchase. Check the product is available for this build and try again.";
  }

  if (/already.*subscribed/i.test(combined)) {
    return "This subscription is already active on this account.";
  }

  return message ?? combined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim() ? message.trim() : null;
}

function getUnderlyingErrorMessage(error: unknown) {
  const underlying = (error as { underlyingErrorMessage?: unknown })
    ?.underlyingErrorMessage;

  return typeof underlying === "string" && underlying.trim()
    ? underlying.trim()
    : null;
}

/** Low-cardinality code for Image.onError. Do not send the raw native message. */
export function getQuestionImagePreviewErrorCode(nativeEvent: unknown) {
  const record =
    nativeEvent && typeof nativeEvent === "object"
      ? (nativeEvent as Record<string, unknown>)
      : null;
  const raw =
    (typeof record?.error === "string" && record.error) ||
    (typeof record?.message === "string" && record.message) ||
    (typeof nativeEvent === "string" ? nativeEvent : "");
  const text = raw.toLowerCase();

  if (!text) {
    return "image_load_failed";
  }

  if (text.includes("404") || text.includes("not found")) {
    return "404";
  }

  if (text.includes("403") || text.includes("forbidden")) {
    return "403";
  }

  if (text.includes("400") || text.includes("bad request")) {
    return "400";
  }

  if (text.includes("timeout") || text.includes("timed out")) {
    return "timeout";
  }

  if (
    text.includes("network") ||
    text.includes("offline") ||
    text.includes("internet")
  ) {
    return "network";
  }

  return "image_load_failed";
}

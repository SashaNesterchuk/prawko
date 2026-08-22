/**
 * Czech eTesty assets are small GIFs (~200×300). Cover upscales and crops them.
 * Prawko delivery photos are large enough that cover is the intended crop.
 */
export function getQuestionStillImageResizeMode(
  variantId: string
): "cover" | "contain" {
  return variantId === "czech" ? "contain" : "cover";
}

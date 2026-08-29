/**
 * Czech eTesty assets are small GIFs (~200×300). Cover upscales and crops them.
 * Polish delivery photos are large enough that cover is the intended crop.
 */
import { getActiveCountryConfig } from "../../countries/runtime";

export function getQuestionStillImageResizeMode(): "cover" | "contain" {
  return getActiveCountryConfig().questionImageResizeMode;
}

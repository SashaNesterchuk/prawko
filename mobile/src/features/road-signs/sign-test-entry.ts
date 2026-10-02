export const SIGN_TEST_ENTRIES = [
  "signs_home",
  "category",
  "statistics",
  "sign_detail",
] as const;

export type SignTestEntry = (typeof SIGN_TEST_ENTRIES)[number];

export function signTestAnalytics(input: {
  categoryId?: string | null;
  entry: SignTestEntry;
}) {
  return {
    category_id: input.categoryId ?? null,
    sign_test_entry: input.entry,
  };
}

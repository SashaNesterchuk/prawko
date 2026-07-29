/** Matches PostgREST default `max_rows`; page until a short batch. */
export const POSTGREST_PAGE_SIZE = 1000;

type SupabasePageResult<T> = {
  data: T[] | null;
  error: unknown;
};

/**
 * Fetches every row from a PostgREST query by walking `.range()` pages.
 * Call sites must keep filters/order stable across pages (include a unique order).
 */
export async function fetchAllSupabasePages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>,
  pageSize: number = POSTGREST_PAGE_SIZE
): Promise<T[]> {
  const records: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) {
      throw error;
    }

    const page = data ?? [];
    records.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return records;
}

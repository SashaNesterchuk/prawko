import type { CountryCode } from "@prawko/config";

import { getExamCountry, useAppShellStore } from "../../state/app-shell";
import { loadPersistedExamHistory } from "./exam-snapshot-cache";
import type { RemoteExamSession } from "./types";

/** Local results are authoritative; cloud imports are cached in the same index. */
export async function fetchRecentExamSessions(
  limit = 5,
  country: CountryCode = getExamCountry()
): Promise<RemoteExamSession[]> {
  const userId = useAppShellStore.getState().supabaseUser?.id ?? null;
  const history = await loadPersistedExamHistory(country);
  return history.filter((session) => {
    const owner = session.metadata.owner_user_id;
    return session.status !== "active" && session.totalQuestionsAnswered > 0 &&
      (typeof owner !== "string" || owner === userId);
  }).slice(0, Math.max(1, Math.floor(limit)));
}

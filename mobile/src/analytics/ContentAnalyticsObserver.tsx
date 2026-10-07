import { useEffect } from "react";

import { getQuestionBank } from "../features/questions/question-bank";
import type { LocalQuestion } from "../features/questions/types";
import { useQuestionCatalogVersion } from "../state/question-catalog";
import { contentFingerprint, getQuestionRevision } from "./content-revisions";

let observedBank: LocalQuestion[] | null = null;
let revision: string | null = null;

export function getObservedBankRevision() {
  return observedBank === getQuestionBank() ? revision : null;
}

/** Yield while hashing a large catalogue; the observer never blocks hydration. */
export function ContentAnalyticsObserver() {
  const version = useQuestionCatalogVersion();
  useEffect(() => {
    let cancelled = false;
    const bank = getQuestionBank();
    const collect = async () => {
      const entries: Array<[string, string]> = [];
      for (let index = 0; index < bank.length; index += 1) {
        if (cancelled) return;
        const question = bank[index];
        entries.push([question.id, contentFingerprint({
          question: getQuestionRevision(question), explanation: question.explanation,
          media: question.media,
        })]);
        if (index % 100 === 99) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
      if (!cancelled && bank === getQuestionBank()) {
        revision = contentFingerprint(entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
        observedBank = bank;
      }
    };
    void collect().catch(() => undefined);
    return () => { cancelled = true; };
  }, [version]);
  return null;
}

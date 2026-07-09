import { isUuidString } from "../questions/question-routes";

const LOCAL_EXAM_PREFIX = "local-";

export function isLocalExamSessionId(
  sessionId: string | null | undefined
): sessionId is string {
  return (
    typeof sessionId === "string" &&
    sessionId.startsWith(LOCAL_EXAM_PREFIX) &&
    sessionId.length > LOCAL_EXAM_PREFIX.length
  );
}

export function isExamSessionId(
  value: string | null | undefined
): value is string {
  if (!value?.trim()) {
    return false;
  }

  return isUuidString(value) || isLocalExamSessionId(value);
}

export function createLocalExamSessionId() {
  return `${LOCAL_EXAM_PREFIX}${createShortId()}`;
}

function createShortId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}

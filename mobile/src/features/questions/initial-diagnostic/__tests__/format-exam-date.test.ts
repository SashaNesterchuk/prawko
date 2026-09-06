import { formatDiagnosticExamDate } from "../format-exam-date";

describe("formatDiagnosticExamDate", () => {
  it("formats a long month date for the reminder prompt", () => {
    expect(formatDiagnosticExamDate("2026-09-24", "pl")).toMatch(/24.*września/i);
    expect(formatDiagnosticExamDate(null, "en")).toBeNull();
  });
});

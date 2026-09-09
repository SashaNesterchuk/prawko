import { buildDiagnosticDetail } from "../diagnostic-detail";

describe("buildDiagnosticDetail", () => {
  it("joins defined keys as token strings and skips empties", () => {
    expect(
      buildDiagnosticDetail({
        after: "after_question_answer",
        should_show: "no",
        loaded: true,
        wait: false,
        route: null,
        why: "",
        elapsed: undefined,
        answers: "3/12",
      })
    ).toBe(
      "after=after_question_answer should_show=no loaded=yes wait=no answers=3/12"
    );
  });
});

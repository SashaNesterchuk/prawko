import {
  consumeDiagnosticReminderPrompt,
  hasConsumedDiagnosticReminderPrompt,
  resetDiagnosticReminderPromptForTests,
} from "../reminder-prompt";

describe("diagnostic reminder prompt", () => {
  afterEach(() => {
    resetDiagnosticReminderPromptForTests();
  });

  it("is shown once per JS session", () => {
    expect(hasConsumedDiagnosticReminderPrompt()).toBe(false);
    consumeDiagnosticReminderPrompt();
    expect(hasConsumedDiagnosticReminderPrompt()).toBe(true);
  });
});

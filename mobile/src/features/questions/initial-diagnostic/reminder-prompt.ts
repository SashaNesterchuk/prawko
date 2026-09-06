let reminderPromptConsumed = false;

export function hasConsumedDiagnosticReminderPrompt() {
  return reminderPromptConsumed;
}

export function consumeDiagnosticReminderPrompt() {
  reminderPromptConsumed = true;
}

export function resetDiagnosticReminderPromptForTests() {
  reminderPromptConsumed = false;
}

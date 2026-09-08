import type { GeneratedStudyPlan } from "@prawko/schemas";

import { applyExamDateChange } from "../exam-date";
import { generateAdjustedStudyPlan } from "../generate-local-study-plan";
import { saveGeneratedStudyPlanRemotely } from "../supabase-study-plan";

jest.mock("../../../config/env", () => ({
  isMobileSupabaseConfigured: true,
}));

jest.mock("../generate-local-study-plan", () => ({
  generateAdjustedStudyPlan: jest.fn(),
  getDaysUntilExamFromDate: jest.fn(() => 22),
}));

jest.mock("../supabase-study-plan", () => ({
  saveGeneratedStudyPlanRemotely: jest.fn(),
}));

const generateAdjustedStudyPlanMock = jest.mocked(generateAdjustedStudyPlan);
const saveGeneratedStudyPlanRemotelyMock = jest.mocked(
  saveGeneratedStudyPlanRemotely
);

const nextPlan = {
  id: "next-plan",
  examDate: "2026-09-28",
  daysPlanned: 22,
  minutesPerDay: 20,
  level: "beginner",
} as GeneratedStudyPlan;

const currentStudyPlan = {
  id: "current-plan",
  examDate: "2026-10-01",
  daysPlanned: 25,
  minutesPerDay: 20,
  level: "beginner",
  category: "B",
  locale: "cs",
  schoolCode: "",
} as GeneratedStudyPlan;

describe("applyExamDateChange", () => {
  beforeEach(() => {
    generateAdjustedStudyPlanMock.mockReturnValue(nextPlan);
    saveGeneratedStudyPlanRemotelyMock.mockResolvedValue("remote-next");
  });

  it("still applies the rebuilt plan locally when remote save fails", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    saveGeneratedStudyPlanRemotelyMock.mockRejectedValue(
      Object.assign(new Error("missing overload"), { code: "PGRST202" })
    );
    const hydrateRemoteStudyPlan = jest.fn();
    const patchExamDate = jest.fn();

    await applyExamDateChange({
      authMode: "supabase",
      currentStudyPlan,
      currentStudyPlanRemoteId: "remote-current",
      examDate: "2026-09-28",
      hydrateRemoteStudyPlan,
      preferredCategory: "B",
      preferredLocale: "cs",
      patchExamDate,
      schoolCode: "",
    });

    expect(hydrateRemoteStudyPlan).toHaveBeenCalledWith({
      plan: nextPlan,
      remoteId: "remote-current",
    });
    expect(patchExamDate).not.toHaveBeenCalled();
  });
});

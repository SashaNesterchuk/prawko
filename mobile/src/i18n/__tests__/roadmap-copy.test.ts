import { getQuestionTopicCatalogEntry } from "@prawko/config";

import { getRoadmap } from "../../features/home/roadmap";
import {
  roadmapCopyCs,
  roadmapCopyEn,
  roadmapCopyPl,
  roadmapCopySk,
  roadmapCopyUa,
  type RoadmapCopy,
} from "../../i18n/roadmap-copy";

const copies: RoadmapCopy[] = [
  roadmapCopyEn,
  roadmapCopyUa,
  roadmapCopyPl,
  roadmapCopyCs,
  roadmapCopySk,
];

describe("roadmap copy", () => {
  it.each(["PL", "CZ", "SK"] as const)(
    "matches every %s section in each language",
    (country) => {
      const key = country.toLowerCase() as "pl" | "cz" | "sk";
      const sections = getRoadmap(country);

      for (const copy of copies) {
        expect(copy[key]).toHaveLength(sections.length);
        sections.forEach((section, index) => {
          expect(copy[key][index]?.steps).toHaveLength(section.steps.length);
          expect(copy[key][index]?.title.length).toBeGreaterThan(0);
        });
      }
    }
  );
});

describe("roadmap final step", () => {
  it("names the exam simulator in every language", () => {
    for (const copy of copies) {
      expect(copy.finalStepEyebrow.length).toBeGreaterThan(0);
      expect(copy.finalStepTitle.length).toBeGreaterThan(0);
      expect(copy.finalStepBadge).toContain("{{count}}");
    }
  });
});

describe("Slovak topic titles", () => {
  it("names Polish topics in Slovak", () => {
    const signs = getQuestionTopicCatalogEntry("signs_signals");

    expect("titleSk" in signs ? signs.titleSk : "").toBe(
      "Dopravné značky a signály"
    );
  });
});

import signUrls from "../../../../../data/pl-road-signs-wikimedia/urls.json";
import generatedMetadata from "../../../../../data/pl-road-signs-wikimedia/metadata.generated.json";

import type { RoadSignCategoryId } from "../types";
import type {
  LocalizedString,
  RoadSignPracticeContent,
  SignPractice,
  SignPracticeOption,
} from "./types";

type GeneratedRoadSignMetadata = {
  id: string;
  categoryId: RoadSignCategoryId;
  name: string;
  description: string;
};

const CATEGORY_ORDER: RoadSignCategoryId[] = ["A", "B", "C", "D", "F", "G", "T", "W"];

const CATEGORY_OPTION_GROUPS: RoadSignCategoryId[][] = [
  ["A", "B", "C", "D"],
  ["F", "G", "T", "W"],
];

const CATEGORY_LABELS: Record<RoadSignCategoryId, LocalizedString> = {
  A: {
    pl: "Znaki ostrzegawcze",
    ua: "Попереджувальні знаки",
    en: "Warning signs",
  },
  B: {
    pl: "Znaki zakazu",
    ua: "Заборонні знаки",
    en: "Prohibition signs",
  },
  C: {
    pl: "Znaki nakazu",
    ua: "Наказові знаки",
    en: "Mandatory signs",
  },
  D: {
    pl: "Znaki informacyjne",
    ua: "Інформаційні знаки",
    en: "Information signs",
  },
  F: {
    pl: "Znaki uzupelniajace",
    ua: "Додаткові знаки",
    en: "Supplementary signs",
  },
  G: {
    pl: "Znaki kolejowe i tramwajowe",
    ua: "Знаки залізничних і трамвайних переїздів",
    en: "Railway and tram signs",
  },
  T: {
    pl: "Tabliczki dodatkowe",
    ua: "Додаткові таблички",
    en: "Additional plates",
  },
  W: {
    pl: "Znaki wojskowe",
    ua: "Військові знаки",
    en: "Military signs",
  },
};

const GENERATED_METADATA = generatedMetadata as Record<
  string,
  GeneratedRoadSignMetadata
>;

const ALL_SIGN_IDS = Object.keys(signUrls)
  .map((filename) => parseSignCode(filename))
  .sort(compareSignCodes);

const ALL_METADATA_IDS = ALL_SIGN_IDS.filter(
  (signId) => GENERATED_METADATA[signId] != null
);

const SIGN_IDS_BY_CATEGORY = CATEGORY_ORDER.reduce(
  (accumulator, categoryId) => {
    accumulator[categoryId] = ALL_SIGN_IDS.filter(
      (signId) => getCategoryId(signId) === categoryId
    );
    return accumulator;
  },
  {} as Record<RoadSignCategoryId, string[]>
);

const METADATA_IDS_BY_CATEGORY = CATEGORY_ORDER.reduce(
  (accumulator, categoryId) => {
    accumulator[categoryId] = ALL_METADATA_IDS.filter(
      (signId) => GENERATED_METADATA[signId]?.categoryId === categoryId
    );
    return accumulator;
  },
  {} as Record<RoadSignCategoryId, string[]>
);

export const GENERATED_SIGN_PRACTICE_CONTENT: Record<
  string,
  RoadSignPracticeContent
> = Object.fromEntries(
  ALL_SIGN_IDS.map((signId) => [
    signId,
    buildPracticeContent(signId),
  ])
);

function parseSignCode(filename: string): string {
  return filename.replace(/^PL_road_sign_/, "").replace(/\.svg$/, "");
}

function getCategoryId(signId: string): RoadSignCategoryId {
  return signId[0] as RoadSignCategoryId;
}

function compareSignCodes(left: string, right: string): number {
  const leftParts = left.split("-");
  const rightParts = right.split("-");

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);

    if (
      !Number.isNaN(leftNumber) &&
      !Number.isNaN(rightNumber) &&
      leftPart !== "" &&
      rightPart !== ""
    ) {
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }
      continue;
    }

    const result = leftPart.localeCompare(rightPart, "pl", {
      numeric: true,
      sensitivity: "base",
    });

    if (result !== 0) {
      return result;
    }
  }

  return 0;
}

function toLocalizedString(value: string): LocalizedString {
  return {
    pl: value,
    ua: value,
    en: value,
  };
}

function summarizeDescription(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  const sentenceMatch = compact.match(/^(.{1,220}?[.!?])(?:\s|$)/u);

  if (sentenceMatch?.[1]) {
    return sentenceMatch[1];
  }

  if (compact.length <= 220) {
    return compact;
  }

  return `${compact.slice(0, 217).trimEnd()}...`;
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function getOrderedNeighborIds(signId: string, candidateIds: string[]): string[] {
  const index = candidateIds.indexOf(signId);

  if (index === -1) {
    return candidateIds.filter((candidateId) => candidateId !== signId);
  }

  const ordered: string[] = [];

  for (let distance = 1; distance < candidateIds.length; distance += 1) {
    const right = candidateIds[index + distance];
    const left = candidateIds[index - distance];

    if (right) {
      ordered.push(right);
    }

    if (left) {
      ordered.push(left);
    }
  }

  return ordered;
}

function selectDistractorIds(
  signId: string,
  primaryCandidateIds: string[],
  fallbackCandidateIds: string[],
  count: number,
  getLabel: (candidateId: string) => string
): string[] {
  const selectedIds: string[] = [];
  const usedLabels = new Set<string>([normalizeLabel(getLabel(signId))]);

  const collect = (candidateIds: string[]) => {
    for (const candidateId of candidateIds) {
      if (candidateId === signId || selectedIds.includes(candidateId)) {
        continue;
      }

      const label = normalizeLabel(getLabel(candidateId));

      if (usedLabels.has(label)) {
        continue;
      }

      usedLabels.add(label);
      selectedIds.push(candidateId);

      if (selectedIds.length >= count) {
        return;
      }
    }
  };

  collect(getOrderedNeighborIds(signId, primaryCandidateIds));

  if (selectedIds.length < count) {
    collect(fallbackCandidateIds);
  }

  return selectedIds.slice(0, count);
}

function orderOptions(
  seed: string,
  options: SignPracticeOption[],
  correctOptionId: string
): SignPracticeOption[] {
  const correctIndex = options.findIndex(
    (option) => option.id === correctOptionId
  );

  if (correctIndex === -1 || options.length < 2) {
    return options;
  }

  const ordered = [...options];
  const [correctOption] = ordered.splice(correctIndex, 1);
  const targetIndex = hashString(seed) % options.length;
  ordered.splice(targetIndex, 0, correctOption);
  return ordered;
}

function buildSignExplanation(
  signId: string,
  categoryId: RoadSignCategoryId,
  metadata?: GeneratedRoadSignMetadata
): LocalizedString {
  if (!metadata) {
    return {
      pl: `To znak ${signId} z kategorii ${CATEGORY_LABELS[categoryId].pl}.`,
      ua: `Це знак ${signId} з категорії ${CATEGORY_LABELS[categoryId].ua}.`,
      en: `This is sign ${signId} from the ${CATEGORY_LABELS[categoryId].en} category.`,
    };
  }

  const summary = summarizeDescription(metadata.description);

  return {
    pl: `To znak ${metadata.name}. ${summary}`,
    ua: `Це знак ${metadata.name}. ${summary}`,
    en: `This is sign ${metadata.name}. ${summary}`,
  };
}

function buildCategoryExplanation(
  signId: string,
  categoryId: RoadSignCategoryId,
  metadata?: GeneratedRoadSignMetadata
): LocalizedString {
  const base = {
    pl: `To znak z kategorii ${CATEGORY_LABELS[categoryId].pl}.`,
    ua: `Це знак з категорії ${CATEGORY_LABELS[categoryId].ua}.`,
    en: `This sign belongs to the ${CATEGORY_LABELS[categoryId].en} category.`,
  };

  if (!metadata) {
    return base;
  }

  return {
    pl: `${base.pl} ${metadata.name}.`,
    ua: `${base.ua} ${metadata.name}.`,
    en: `${base.en} ${metadata.name}.`,
  };
}

function buildNameQuestion(
  signId: string,
  metadata: GeneratedRoadSignMetadata
): SignPractice | null {
  const distractorIds = selectDistractorIds(
    signId,
    METADATA_IDS_BY_CATEGORY[metadata.categoryId],
    ALL_METADATA_IDS,
    3,
    (candidateId) => GENERATED_METADATA[candidateId]?.name ?? candidateId
  );

  if (distractorIds.length < 2) {
    return null;
  }

  const options = orderOptions(
    `${signId}-name`,
    [
      {
        id: signId,
        label: toLocalizedString(metadata.name),
      },
      ...distractorIds.map((distractorId) => ({
        id: distractorId,
        label: toLocalizedString(
          GENERATED_METADATA[distractorId]?.name ?? distractorId
        ),
      })),
    ],
    signId
  );

  return {
    id: `${signId}-name`,
    prompt: {
      pl: "Jak nazywa sie ten znak?",
      ua: "Як називається цей знак?",
      en: "What is the name of this sign?",
    },
    options,
    correctOptionId: signId,
    explanation: buildSignExplanation(signId, metadata.categoryId, metadata),
  };
}

function buildCodeQuestion(
  signId: string,
  categoryId: RoadSignCategoryId,
  metadata?: GeneratedRoadSignMetadata
): SignPractice {
  const distractorIds = selectDistractorIds(
    signId,
    SIGN_IDS_BY_CATEGORY[categoryId],
    ALL_SIGN_IDS,
    3,
    (candidateId) => candidateId
  );

  const options = orderOptions(
    `${signId}-code`,
    [
      {
        id: signId,
        label: toLocalizedString(signId),
      },
      ...distractorIds.map((distractorId) => ({
        id: distractorId,
        label: toLocalizedString(distractorId),
      })),
    ],
    signId
  );

  return {
    id: `${signId}-code`,
    prompt: {
      pl: "Ktory kod odpowiada temu znakowi?",
      ua: "Який код відповідає цьому знаку?",
      en: "Which code matches this sign?",
    },
    options,
    correctOptionId: signId,
    explanation: buildSignExplanation(signId, categoryId, metadata),
  };
}

function buildCategoryQuestion(
  signId: string,
  categoryId: RoadSignCategoryId,
  metadata?: GeneratedRoadSignMetadata
): SignPractice {
  const categoryOptionIds =
    CATEGORY_OPTION_GROUPS.find((group) => group.includes(categoryId)) ??
    CATEGORY_ORDER.slice(0, 4);

  const options = orderOptions(
    `${signId}-category`,
    categoryOptionIds.map((optionCategoryId) => ({
      id: optionCategoryId,
      label: CATEGORY_LABELS[optionCategoryId],
    })),
    categoryId
  );

  return {
    id: `${signId}-category`,
    prompt: {
      pl: "Do jakiej kategorii nalezy ten znak?",
      ua: "До якої категорії належить цей знак?",
      en: "Which category does this sign belong to?",
    },
    options,
    correctOptionId: categoryId,
    explanation: buildCategoryExplanation(signId, categoryId, metadata),
  };
}

function buildPracticeContent(signId: string): RoadSignPracticeContent {
  const categoryId = getCategoryId(signId);
  const metadata = GENERATED_METADATA[signId];
  const practices: SignPractice[] = [];

  if (metadata) {
    const nameQuestion = buildNameQuestion(signId, metadata);

    if (nameQuestion) {
      practices.push(nameQuestion);
    }
  }

  practices.push(buildCodeQuestion(signId, categoryId, metadata));
  practices.push(buildCategoryQuestion(signId, categoryId, metadata));

  return {
    id: signId,
    categoryId,
    practices,
  };
}

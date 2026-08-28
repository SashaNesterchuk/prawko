import {
  CZECH_QUESTION_TOPIC_IDS,
  getQuestionTopicCatalogEntry,
  type CzechQuestionTopicId,
  type QuestionTopicId,
} from "@prawko/config";

export type CzechTopicClassificationInput = {
  answersCs?: string[];
  basketScopeId: number;
  factsCs?: string[];
  promptCs: string;
  sceneCs?: string;
  signCodes?: string[];
};

const LOCKED_BASKET_TOPICS: Partial<Record<number, CzechQuestionTopicId>> = {
  11: "signs_signals",
  12: "intersections_priority",
  13: "vehicle_equipment",
  14: "documents_responsibility",
  15: "accidents_first_aid",
};

export const CZECH_TOPIC_SOURCE_LABELS: Record<CzechQuestionTopicId, string> = {
  signs_signals:
    "Dopravní značky, vodorovné značení, semafory a pokyny policisty.",
  intersections_priority:
    "Přednost, křižovatky, kruhový objezd a pořadí projetí.",
  driving_maneuvers:
    "Pruhy, předjíždění, odbočování, zastavení, stání a otáčení.",
  other_road_users:
    "Chodci, cyklisté, děti, tramvaje a ostatní zranitelní účastníci.",
  attention_risks:
    "Rychlost, odstup, únava, alkohol, počasí a defenzivní jízda.",
  vehicle_equipment:
    "Výbava, světla, pneumatiky, technická prohlídka a označení nákladu.",
  documents_responsibility:
    "Řidičský průkaz, oprávnění, pojištění a povinnosti řidiče.",
  accidents_first_aid:
    "Dopravní nehody, přivolání pomoci a první pomoc.",
};

export function getCzechQuestionTopicCatalogRows() {
  return CZECH_QUESTION_TOPIC_IDS.map((topicId, index) => {
    const topic = getQuestionTopicCatalogEntry(topicId);
    return {
      topic_id: topicId,
      sort_order: index + 1,
      titles: {
        cs: topic.titleCs,
        en: topic.titleEn,
      },
      source_label: CZECH_TOPIC_SOURCE_LABELS[topicId],
      is_active: true,
    };
  });
}

function normalize(value: string | null | undefined) {
  return value?.normalize("NFC").toLocaleLowerCase("cs") ?? "";
}

function matches(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function combinedText(input: CzechTopicClassificationInput) {
  return [
    input.promptCs,
    ...(input.answersCs ?? []),
    ...(input.factsCs ?? []),
    input.sceneCs ?? "",
    ...(input.signCodes ?? []),
  ]
    .map(normalize)
    .join(" \n ");
}

export function classifyCzechQuestionTopic(
  input: CzechTopicClassificationInput
): QuestionTopicId {
  const locked = LOCKED_BASKET_TOPICS[input.basketScopeId];
  if (locked) {
    return locked;
  }

  const text = combinedText(input);
  const prompt = normalize(input.promptCs);
  const hasVerifiedSigns = (input.signCodes ?? []).length > 0;

  if (
    matches(text, [
      /první pomoc/,
      /srdeční masáž/,
      /resuscit/,
      /krvác/,
      /poraněn/,
      /zraněn/,
      /záchrann/,
      /\b155\b/,
      /\b112\b/,
      /dopravní nehod/,
    ])
  ) {
    return "accidents_first_aid";
  }

  if (
    matches(text, [
      /řidičsk(?:ý|ého|ém) (?:průkaz|oprávněn)/,
      /zelená karta/,
      /pojištěn/,
      /\bL17\b/i,
      /mentor/,
      /evidenční kart/,
      /bodov/,
      /pokut/,
      /skupin[ay] [a-d]\b/,
      /smíte řídit/,
      /nesmíte řídit/,
      /je řidičem/,
      /nemotorové vozidlo je/,
      /jezdec na koni/,
      /vozka/,
      /strážník/,
      /celník/,
      /antiradar/,
      /zadržet řidičský/,
    ])
  ) {
    return "documents_responsibility";
  }

  if (
    matches(prompt, [
      /tato (dopravní )?značka/,
      /vyobrazen[áé] dopravní značk/,
      /která z vyobrazených dopravních značek/,
      /svisl[áé] dopravní značk/,
      /vodorovn/,
    ]) ||
    matches(text, [
      /světeln/,
      /signál se (?:zeleným|červeným|žlutým|současně)/,
      /kruhovým světlem/,
      /semafor/,
      /pokynu policist/,
      /policista.*(pokyn|paž|signál)/,
    ]) ||
    (hasVerifiedSigns &&
      !matches(text, [/křižovat/, /pořadí projed/, /dopravní situaci/]))
  ) {
    return "signs_signals";
  }

  if (
    matches(text, [
      /křižovat/,
      /pořadí projed/,
      /přednost v jízdě/,
      /dej(?:te)? přednost/,
      /kruhov(?:ý|ého) objezd/,
      /hlavní pozemní komunikace/,
      /vedlejší pozemní/,
      /vjíždějící na pozemní komunikaci/,
    ])
  ) {
    return "intersections_priority";
  }

  if (
    matches(prompt, [
      /předjížd/,
      /odboč/,
      /couv/,
      /jízdní pruh/,
      /objížd/,
      /parkov/,
      /zastavit/,
      /stání/,
    ])
  ) {
    return "driving_maneuvers";
  }

  if (
    matches(text, [
      /chodc/,
      /přechod pro chodce/,
      /cyklist/,
      /tramvaj/,
      /dět(?:i|í|e)\b/,
      /autobus.*dět/,
      /osob[ay] na vozík/,
      /invalid/,
      /koloběž/,
      /jezdec na koni/,
      /jízdním kole/,
    ])
  ) {
    return "other_road_users";
  }

  if (
    matches(text, [
      /pneumatik/,
      /světlomet/,
      /tlumič/,
      /hasicí přístroj/,
      /lékárnič/,
      /výstražn[ýé] troj/,
      /airbag/,
      /sdělovač/,
      /kontrolk/,
      /ostřikovač/,
      /technick(?:á|é) prohlíd/,
      /\bstk\b/,
      /registrační značk/,
      /náklad/,
      /přívěs/,
      /střešní nosič/,
      /bezpečnostní pás/,
      /dětsk(?:á|é|ou) sedač/,
      /zádržn/,
      /spolujezdec na motocyklu/,
    ])
  ) {
    return "vehicle_equipment";
  }

  if (
    input.basketScopeId === 10 ||
    matches(text, [
      /alkohol/,
      /únav/,
      /lék/,
      /telefon/,
      /handsfree/,
      /mlha/,
      /náledí/,
      /smyk/,
      /viditelnost/,
      /déšť/,
      /sníh/,
      /boční vítr/,
      /defenziv/,
      /reakční dob/,
      /bezpečn(?:ou|á|é) vzdálenost/,
      /brzdn/,
      /km\/h/,
      /rychlost/,
      /čerpací stanice/,
      /kouřit/,
      /autoškol/,
    ])
  ) {
    return "attention_risks";
  }

  if (
    matches(text, [
      /předjížd/,
      /odboč/,
      /couv/,
      /zastavit/,
      /stání/,
      /\bstát\b/,
      /parkov/,
      /jízdní pruh/,
      /objížd/,
      /vyhýb/,
      /míjen/,
      /otočit/,
      /otáčet/,
      /změnit směr/,
      /znamení o změně směru/,
      /železničn(?:í|ího) přejezd/,
      /dálnic/,
      /tunel/,
      /krajnice/,
    ])
  ) {
    return "driving_maneuvers";
  }

  return input.basketScopeId === 10 ? "attention_risks" : "driving_maneuvers";
}

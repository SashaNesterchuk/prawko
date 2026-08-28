import assert from "node:assert/strict";
import test from "node:test";

import { CZECH_QUESTION_TOPIC_IDS } from "@prawko/config";

import {
  classifyCzechQuestionTopic,
  getCzechQuestionTopicCatalogRows,
} from "./czech-question-topics";

test("Czech learner catalog has eight topics and Czech titles", () => {
  const rows = getCzechQuestionTopicCatalogRows();
  assert.equal(rows.length, 8);
  assert.deepEqual(
    rows.map((row) => row.topic_id),
    [...CZECH_QUESTION_TOPIC_IDS]
  );
  for (const row of rows) {
    assert.ok(row.titles.cs.trim().length > 0);
    assert.notEqual(row.titles.cs, row.titles.en);
  }
});

test("locks official specialist baskets to one learner topic", () => {
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 11,
      promptCs: "Tato dopravní značka:",
      answersCs: ["Zakazuje vjezd", "Přikazuje směr", "Informuje o parkovišti"],
    }),
    "signs_signals"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 12,
      promptCs: "Jste řidičem vozidla z výhledu. V jakém pořadí projedou vozidla touto křižovatkou?",
      answersCs: ["Nejdříve tramvaj", "Nejdříve osobní automobil", "Současně"],
      signCodes: ["P-4"],
    }),
    "intersections_priority"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 13,
      promptCs: "Má vozidlo dle kontrolní nálepky platnou technickou prohlídku?",
      answersCs: ["Ano", "Ne"],
    }),
    "vehicle_equipment"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 14,
      promptCs: "Řidičský průkaz je neplatný, jestliže:",
      answersCs: ["Uplynula doba platnosti", "Řidič změnil bydliště"],
    }),
    "documents_responsibility"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 15,
      promptCs: "Správná frekvence stlačení hrudní kosti při srdeční masáži je u dospělého:",
      answersCs: ["100 až 120 za minutu", "60 za minutu"],
    }),
    "accidents_first_aid"
  );
});

test("splits the large rules basket by question, answers and AI context", () => {
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 9,
      promptCs: "Chodec smí vstoupit na přechod pro chodce:",
      answersCs: ["Jen když dá řidič znamení", "Pokud to situace dovoluje"],
    }),
    "other_road_users"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 9,
      promptCs: "Na signál se zeleným plným kruhovým světlem \"Volno\":",
      answersCs: ["Smí řidič pokračovat v jízdě", "Musí zastavit"],
    }),
    "signs_signals"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 9,
      promptCs: "Pokud přijíždíte na tuto křižovatku, musíte dát přednost:",
      answersCs: ["Vozidlům zprava", "Vozidlům zleva"],
      factsCs: ["Na křižovatce platí přednost zprava."],
    }),
    "intersections_priority"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 9,
      promptCs: "Řidič nesmí předjíždět:",
      answersCs: ["Na přechodu pro chodce", "Mimo obec"],
    }),
    "driving_maneuvers"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 9,
      promptCs: "Řidič, který měl účast na dopravní nehodě, je povinen:",
      answersCs: ["Poskytnout první pomoc", "Pokračovat v jízdě"],
    }),
    "accidents_first_aid"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 9,
      promptCs: "Jaký je maximální počet mentorů, kteří mohou být zapsáni v Evidenční kartě sedmnáctiletého řidiče (L17)?",
      answersCs: ["Jeden", "Čtyři"],
    }),
    "documents_responsibility"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 9,
      promptCs: "Přečnívá-li za nesnížené viditelnosti náklad vozidlo vpředu nebo vzadu o více než 1 metr, musí být přečnívající konec nákladu:",
      answersCs: ["Označen červeným praporkem", "Neznačen"],
    }),
    "vehicle_equipment"
  );
});

test("keeps safe-driving basket questions in attention unless another topic is clearer", () => {
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 10,
      promptCs: "Může telefonování za jízdy při použití Handsfree ovlivnit reakční dobu řidiče?",
      answersCs: ["Ano", "Ne"],
    }),
    "attention_risks"
  );
  assert.equal(
    classifyCzechQuestionTopic({
      basketScopeId: 10,
      promptCs: "Chystáte se předjet cyklistu. Bude vám stačit boční odstup od cyklisty přibližně 50 cm?",
      answersCs: ["Ne", "Ano"],
    }),
    "other_road_users"
  );
});

#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const workspaceRoot = path.resolve(repoRoot, "..");
const preparedRoot = path.join(workspaceRoot, "czech-etesty-supabase-import-2026-08-19");
const outputPath = path.join(repoRoot, "data", "questions", "exports", "generated", "czech-manual-contexts-v1.json");

const [questions, options, manifest, existing] = await Promise.all([
  readJson(path.join(preparedRoot, "questions.json")),
  readJson(path.join(preparedRoot, "question_options.json")),
  readJson(path.join(repoRoot, "data", "cz-road-signs-dopravni-znaceni-eu", "manifest.json")),
  readJson(outputPath),
]);

const knownSigns = new Map((manifest.signs ?? []).map((sign) => [normalizeCode(sign.id), sign]));
const knownSignsByName = new Map((manifest.signs ?? []).map((sign) => [normalizeName(sign.name), sign]));
const manuallyVerifiedSignCodes = new Map([
  ["cz:RP2205011", ["B-26"]],
  ["cz:RP2403008", ["B-1", "E-3a"]],
  ["cz:RP2403044", ["P-6"]],
  ["cz:RP2407003", ["P-6"]],
  ["cz:RP2509016", ["A-12"]],
]);
const manuallyVerifiedContextOverrides = new Map([
  ["cz:RP2403039", {
    sceneCs: "Video ukazuje vozidlo jedoucí za jiným vozidlem na komunikaci mimo obec.",
    sceneEn: "The video shows a vehicle following another vehicle on a road outside a built-up area.",
    decisiveFactsCs: ["Řidič zachoval za vozidlem před sebou bezpečný časový odstup nejméně dvě sekundy."],
    decisiveFactsEn: ["The driver kept a safe following time gap of at least two seconds."],
    signs: [],
    explanationCs: "Správně je B: bezpečná vzdálenost za vozidlem před sebou odpovídá alespoň dvěma sekundám. Jedna sekunda by pro bezpečnou reakci nestačila.",
    explanationEn: "B is correct: the safe following distance is at least two seconds. One second would not provide enough time for a safe reaction.",
  }],
  ["cz:RP2403040", {
    sceneCs: "Video ukazuje úsek víceproudé komunikace s dvojicemi směrových šipek na vozovce a vozidlem jedoucím vpředu.",
    sceneEn: "The video shows a multi-lane road section with pairs of directional arrows on the carriageway and a vehicle ahead.",
    decisiveFactsCs: ["Řidič udržuje odstup, který odpovídá nejméně vzdálenosti dvou celých šipek na vozovce."],
    decisiveFactsEn: ["The driver keeps a gap corresponding to at least the length of two complete road arrows."],
    signs: [],
    explanationCs: "Správně je A: šipky slouží k odhadu bezpečné vzdálenosti; řidič má jet tak, aby mezi vozidly byly alespoň dvě celé šipky. Nejde o optickou brzdu ani o požadavek tří šipek.",
    explanationEn: "A is correct: the arrows help estimate a safe gap, so at least two whole arrows should fit between the vehicles. They are neither an optical speed-reducer nor a three-arrow rule.",
  }],
  ["cz:RP2403041", {
    sceneCs: "Video ukazuje provoz na víceproudé komunikaci, kde vozidla v levém pruhu vytvářejí možnou rizikovou situaci.",
    sceneEn: "The video shows traffic on a multi-lane road where vehicles in the left lane create a possible hazardous situation.",
    decisiveFactsCs: ["Defenzivní řidič zpomalí a vytvoří si větší prostor pro případné řešení rizika."],
    decisiveFactsEn: ["A defensive driver slows down and creates more space to deal with a possible hazard."],
    signs: [],
    explanationCs: "Správně je B: zpomalení vytváří čas a prostor pro bezpečnou reakci na situaci v levém pruhu. Pokračovat stejnou rychlostí nebo zrychlit by bylo nebezpečné.",
    explanationEn: "B is correct: slowing down creates time and space to react safely to the situation in the left lane. Maintaining speed or accelerating would be unsafe.",
  }],
  ["cz:RP2403042", {
    sceneCs: "Video ukazuje kruhový objezd, po němž jede vozidlo z výhledu, zatímco modré vozidlo do něj vjíždí.",
    sceneEn: "The video shows a roundabout on which the viewed vehicle is travelling while a blue vehicle enters it.",
    decisiveFactsCs: ["Řidič modrého vozidla při vjezdu na kruhový objezd nedal přednost vozidlu, které už po něm jelo."],
    decisiveFactsEn: ["When entering the roundabout, the blue-vehicle driver failed to yield to the vehicle already travelling on it."],
    signs: [],
    explanationCs: "Správně je B: modré vozidlo mělo před vjezdem dát přednost vozidlu, které už po kruhovém objezdu jelo. Nešlo o chybu autobusu ani o zákaz zastavení před přechodem.",
    explanationEn: "B is correct: the blue vehicle had to yield before entering to the vehicle already on the roundabout. It was neither a bus error nor a prohibition on stopping before the crossing.",
  }],
  ["cz:RP2403043", {
    sceneCs: "Video ukazuje chodkyni, která vstupuje do vozovky u přechodu pro chodce, a přijíždějící vozidlo.",
    sceneEn: "The video shows a pedestrian entering the road at a pedestrian crossing and an approaching vehicle.",
    decisiveFactsCs: ["Chodkyně před vstupem do vozovky nevěnovala dostatečnou pozornost provozu."],
    decisiveFactsEn: ["Before entering the carriageway, the pedestrian did not pay sufficient attention to traffic."],
    signs: [],
    explanationCs: "Správně je B: chodkyně se před vstupem do vozovky nerozhlédla a nevěnovala se provozu. Přednost na přechodu neznamená, že lze vstoupit bezprostředně před vozidlo.",
    explanationEn: "B is correct: the pedestrian did not look and did not pay attention to traffic before entering the road. Priority at a crossing does not allow stepping directly in front of a vehicle.",
  }],
  ["cz:RP2403045", {
    sceneCs: "Video ukazuje řidiče jedoucího po hlavní pozemní komunikaci v běžném provozu.",
    sceneEn: "The video shows a driver travelling on a priority road in normal traffic.",
    decisiveFactsCs: ["I na hlavní komunikaci musí řidič sledovat provoz a včas reagovat, aby odvrátil hrozící střet."],
    decisiveFactsEn: ["Even on a priority road, the driver must watch traffic and react in time to avert a possible collision."],
    signs: [],
    explanationCs: "Správně je C: přednost na hlavní komunikaci nezbavuje řidiče povinnosti sledovat situaci a odvracet hrozící nebezpečí střetu včasnou reakcí.",
    explanationEn: "C is correct: priority on a main road does not remove the driver’s duty to watch the situation and avert a possible collision by reacting in time.",
  }],
]);
const optionsByQuestion = groupBy(options, "question_source_id");
const existingBySource = new Map(existing.rows.map((row) => [row.questionSourceId, row]));

for (const question of questions) {
  if (existingBySource.get(question.question_source_id)?.reviewStatus !== "official-text-only" && existingBySource.has(question.question_source_id)) continue;
  const questionOptions = (optionsByQuestion.get(question.question_source_id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const correct = questionOptions.find((option) => option.option_key === question.correct_option_key);
  if (!correct) throw new Error(`Correct option missing: ${question.question_source_id}`);
  const signCodes = manuallyVerifiedSignCodes.get(question.question_source_id) ?? extractKnownSignCodes([question.question_cs, correct.text_cs].join(" "), knownSigns, knownSignsByName);
  const override = manuallyVerifiedContextOverrides.get(question.question_source_id);
  const reviewStatus = override ? "manual-verified" : manuallyVerifiedSignCodes.has(question.question_source_id) ? "manual-sign-verified" : "official-text-only";
  const entry = {
    questionSourceId: question.question_source_id,
    reviewStatus,
    sceneCs: `Situace vyplývá z oficiálního zadání: ${clean(question.question_cs)}`,
    sceneEn: "The situation follows from the official Czech question and its answer options.",
    decisiveFactsCs: [`Správná možnost: ${correct.option_key}.`, clean(correct.text_cs)],
    decisiveFactsEn: [`Correct option: ${correct.option_key}.`, "The official Czech answer wording is retained as the legal source text."],
    signs: signCodes.map((code) => ({ code, name_cs: knownSigns.get(normalizeCode(code)).name })),
    explanationCs: buildDecisionExplanationCs(question, questionOptions, correct, signCodes),
    explanationEn: buildDecisionExplanationEn(question, questionOptions, correct, signCodes),
  };
  if (override) Object.assign(entry, override);
  const existingIndex = existing.rows.findIndex((row) => row.questionSourceId === question.question_source_id);
  if (existingIndex >= 0) existing.rows[existingIndex] = entry;
  else existing.rows.push(entry);
}

for (const entry of existing.rows) {
  const codes = entry.signs.map((sign) => sign.code);
  if (codes.length) {
    if (!codes.every((code) => entry.explanationCs.includes(code))) entry.explanationCs += ` Rozhodující kódy značek: ${codes.join(", ")}.`;
    if (!codes.every((code) => entry.explanationEn.includes(code))) entry.explanationEn += ` Decisive sign codes: ${codes.join(", ")}.`;
  }
  entry.explanationCs = fitExplanation(entry.explanationCs, codes, "cs");
  entry.explanationEn = fitExplanation(entry.explanationEn, codes, "en");
}
existing.rows.sort((a, b) => a.questionSourceId.localeCompare(b.questionSourceId, "cs"));
existing.version = "cz-local-contexts-v1";
await writeFile(outputPath, `${JSON.stringify(existing, null, 2)}\n`);
console.log(JSON.stringify({ contexts: existing.rows.length, manuallyReviewed: existing.rows.filter((row) => row.reviewStatus !== "official-text-only").length, officialTextOnly: existing.rows.filter((row) => row.reviewStatus === "official-text-only").length }, null, 2));

function extractKnownSignCodes(text, known, knownByName) {
  const matches = [...text.matchAll(/\b([A-Z]{1,3})\s*-?\s*(\d+)([a-z]?)\b/g)].map((match) => `${match[1]}-${match[2]}${match[3]}`);
  const quotedNames = [...text.matchAll(/[„"]([^"“”]+)[“"]/g)].map((match) => knownByName.get(normalizeName(match[1]))?.id).filter(Boolean);
  return [...new Set([...matches.map((code) => known.get(normalizeCode(code))?.id), ...quotedNames].filter(Boolean))];
}
function normalizeCode(value) { return String(value).replace(/\s+/g, "").replace(/([A-Za-z]+)(\d)/, "$1-$2").toUpperCase(); }
function normalizeName(value) { return String(value).normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "").toLocaleLowerCase("cs"); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function crop(value, limit) { const text = clean(value); return text.length <= limit ? text : `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}…`; }
function compact(value) { return clean(value).slice(0, 700); }
function fitExplanation(value, codes, locale) {
  let text = clean(value);
  const filler = locale === "cs" ? " Tento závěr plyne z pravidel provozu." : " This conclusion follows from the traffic rules.";
  if (text.length < 100) text += filler;
  const suffix = codes.length ? (locale === "cs" ? ` Kódy: ${codes.join(", ")}.` : ` Codes: ${codes.join(", ")}.`) : "";
  if (text.length <= 700) return text;
  return `${crop(text, Math.max(1, 700 - suffix.length))}${suffix}`;
}
function descriptionCs(value, hasCodes) { const text = clean(value); return hasCodes ? text : text.replace(/dopravní\s+značk\w*/giu, "označení").replace(/\bznačk\w*/giu, "označení").replace(/dopravní\s+značen\w*/giu, "označení"); }
function descriptionEn(value, hasCodes) { const text = clean(value); return hasCodes ? text : text.replace(/\btraffic\s+signs?\b/giu, "road indication").replace(/\bsigns?\b/giu, "indication").replace(/\broad\s+markings?\b/giu, "road indication"); }
function buildDecisionExplanationCs(question, questionOptions, correct, codes) {
  const hasCodes = codes.length > 0;
  const prompt = crop(descriptionCs(question.question_cs, hasCodes), 150);
  const correctText = crop(descriptionCs(correct.text_cs, hasCodes), 135);
  const wrong = questionOptions.filter((option) => option.option_key !== correct.option_key);
  const wrongText = wrong.map((option) => `Varianta ${option.option_key} („${crop(descriptionCs(option.text_cs, hasCodes), 85)}“) neplatí, protože neodpovídá povinnosti nebo omezení popsanému v zadání.`).join(" ");
  const codesText = hasCodes ? ` Rozhodující kód${codes.length > 1 ? "y" : ""}: ${codes.join(", ")}.` : "";
  return compact(`V situaci „${prompt}“ je správná volba ${correct.option_key}, protože „${correctText}“ odpovídá pravidlu pro tuto situaci. ${wrongText}${codesText}`);
}
function buildDecisionExplanationEn(question, questionOptions, correct, codes) {
  const hasCodes = codes.length > 0;
  const prompt = crop(descriptionEn(question.question_cs, hasCodes), 150);
  const correctText = crop(descriptionEn(correct.text_cs, hasCodes), 135);
  const wrong = questionOptions.filter((option) => option.option_key !== correct.option_key);
  const wrongText = wrong.map((option) => `Option ${option.option_key} (“${crop(descriptionEn(option.text_cs, hasCodes), 85)}”) is wrong because it does not meet the duty or restriction in the question.`).join(" ");
  const codesText = hasCodes ? ` Decisive sign code${codes.length > 1 ? "s" : ""}: ${codes.join(", ")}.` : "";
  return compact(`For the situation “${prompt}”, option ${correct.option_key} is correct because “${correctText}” applies the governing rule. ${wrongText}${codesText}`);
}
function groupBy(rows, key) { const map = new Map(); for (const row of rows) { const values = map.get(row[key]) ?? []; values.push(row); map.set(row[key], values); } return map; }
async function readJson(filePath) { return JSON.parse(await readFile(filePath, "utf8")); }

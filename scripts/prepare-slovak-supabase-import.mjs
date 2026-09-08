#!/usr/bin/env node

/**
 * Produces a local, reviewable Supabase-v2 import package for the Slovak
 * catalogue. It only reads local source files and writes JSON under data/;
 * it deliberately has no Supabase client and cannot make a database request.
 */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const execFileAsync = promisify(execFile);
const repoRoot = new URL("..", import.meta.url).pathname;
const sourceRoot = join(repoRoot, "data", "sk-questions-vodicak");
const preparedRoot = join(sourceRoot, "supabase-import");
const questionSetKey = "sk-v2-current";
const allLicenceGroups = ["AM", "A1", "A2", "A", "B1", "B", "BE", "C1", "C1E", "C", "CE", "D1", "D1E", "D", "DE", "T"];

const topics = [
  ["road_traffic_rules", "Pravidlá cestnej premávky", "Road traffic rules"],
  ["priority_and_speed_limits", "Uplatňovanie pravidiel prednosti v jazde a rýchlostné obmedzenia", "Priority rules and speed limits"],
  ["road_signs_and_traffic_devices", "Dopravné značky a dopravné zariadenia", "Road signs and traffic devices"],
  ["intersection_traffic_situations", "Dopravné situácie na križovatkách", "Traffic situations at intersections"],
  ["road_accident_duties", "Povinnosti vodiča pri dopravnej nehode", "Driver duties in a road accident"],
  ["vehicle_driving_theory", "Teória vedenia vozidla", "Vehicle driving theory"],
  ["documents_and_transport_time", "Predpisy o dokladoch a organizácia času v doprave", "Vehicle documents and transport-time rules"],
  ["vehicle_operation_requirements", "Podmienky prevádzky vozidiel v premávke na pozemných komunikáciách", "Vehicle operation requirements"],
  ["safe_driving_principles", "Zásady bezpečnej jazdy", "Safe-driving principles"],
  ["vehicle_construction_and_maintenance", "Konštrukcia vozidiel a ich údržba", "Vehicle construction and maintenance"],
].map(([topic_id, sk, en], index) => ({
  topic_id,
  sort_order: index + 1,
  titles: { sk, en },
  source_label: sk,
  is_active: true,
}));

const topicIdBySourceBlock = new Map(topics.map((topic) => [topic.titles.sk, topic.topic_id]));
const pdfHeaders = [
  "1. Pravidlá cestnej premávky",
  "2. Uplatňovanie pravidiel prednosti",
  "3. Dopravné značky a dopravné zariadenia",
  "4. Dopravné situácie na križovatkách",
  "5. Všeobecné pravidlá správania",
  "6. Teória vedenia vozidla",
  "7. Predpisy týkajúce sa dokladov",
  "8. Podmienky prevádzky vozidiel",
  "9. Zásady bezpečnej jazdy",
  "10. Konštrukcia vozidiel",
];
const expectedQuestionsByTopic = [525, 75, 188, 80, 28, 92, 69, 59, 158, 142];
const groupToken = /\b(?:AM|A1|A2|B1|BE|C1E|C1|CE|D1E|D1|DE|A|B|C|D|T)\b/g;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function localMediaPath(sourcePath) {
  return `media/${sourcePath.replace(/^\/+/, "")}`;
}

function deliveryAssetFor(sourcePath, media) {
  if (media.status !== "downloaded") return null;
  const originalFilename = sourcePath.split("/").at(-1);
  if (!originalFilename) throw new Error(`Invalid media source path: ${sourcePath}`);
  const storagePath = `sk/${sourcePath.replace(/^\/+/, "")}`;
  return {
    mediaKey: `sk-vodicak-${media.sha256.slice(0, 24)}`,
    sourceKind: "primary",
    mediaType: "image",
    originalFilename,
    resolvedFilename: originalFilename,
    matchStrategy: "exact",
    // `storageBucket` is the stable URL segment used by the client. The
    // physical R2 bucket/public base URL belongs to deployment configuration.
    storageBucket: "question-images",
    storagePath,
    posterStorageBucket: null,
    posterStoragePath: null,
  };
}

function groupRowsFromOfficialPdfText(text) {
  const rows = [];
  let section = -1;
  let expectedNumber = 0;
  let current = null;
  const flush = () => {
    if (current) rows.push(current);
    current = null;
  };

  for (const line of text.split(/\r?\n/)) {
    const nextSection = pdfHeaders.findIndex((header) => line.includes(header));
    if (nextSection >= 0 && nextSection > section) {
      flush();
      section = nextSection;
      expectedNumber = 0;
      continue;
    }
    if (section < 0) continue;

    const questionStart = line.match(/^\s*(\d{1,3})\.\s*(.*)$/);
    if (questionStart && Number(questionStart[1]) === expectedNumber + 1) {
      flush();
      expectedNumber += 1;
      // The PDF's licence-group column starts around character 115. Start a
      // little earlier because a wrapped group can shift left on some pages.
      current = { section, localNumber: expectedNumber, rightColumn: [line.slice(108)] };
    } else if (current) {
      current.rightColumn.push(line.slice(108));
    }
  }
  flush();

  if (rows.length !== 1416) throw new Error(`Expected 1,416 official PDF rows, found ${rows.length}.`);
  for (let sectionIndex = 0; sectionIndex < expectedQuestionsByTopic.length; sectionIndex += 1) {
    const count = rows.filter((row) => row.section === sectionIndex).length;
    if (count !== expectedQuestionsByTopic[sectionIndex]) {
      throw new Error(`Official PDF section ${sectionIndex + 1} has ${count} rows; expected ${expectedQuestionsByTopic[sectionIndex]}.`);
    }
  }

  return rows.map((row, index) => {
    const found = [...row.rightColumn.join(" ").matchAll(groupToken)].map((match) => match[0]);
    const licenceGroups = allLicenceGroups.filter((group) => found.includes(group));
    return {
      sourceRowNumber: index + 1,
      officialPdfSection: row.section + 1,
      officialPdfLocalNumber: row.localNumber,
      licenceGroups,
      appliesToAllLicenceGroups: licenceGroups.length === 0,
    };
  });
}

const [catalogue, manifest] = await Promise.all([
  readFile(join(sourceRoot, "questions.vodicak.sk.json"), "utf8").then(JSON.parse),
  readFile(join(sourceRoot, "manifest.json"), "utf8").then(JSON.parse),
]);
if (!Array.isArray(catalogue.questions) || catalogue.questions.length !== 1416) {
  throw new Error("Vodičák source snapshot must contain exactly 1,416 questions.");
}

const rootFiles = await readdir(repoRoot);
const officialPdfName = rootFiles.find((name) => name.startsWith("Testove otazky na teoreticku skusku") && name.includes("Slovenskom"));
if (!officialPdfName) throw new Error("The Slovak official question PDF was not found in the repository root.");
const officialPdfPath = join(repoRoot, officialPdfName);
const officialPdfBytes = await readFile(officialPdfPath);
const { stdout: officialPdfText } = await execFileAsync("pdftotext", ["-layout", officialPdfPath, "-"]);
const groupRows = groupRowsFromOfficialPdfText(officialPdfText);

const mediaBySourcePath = new Map(manifest.media.map((media) => [media.sourcePath, media]));
const sourceSnapshotHash = sha256(JSON.stringify(catalogue.questions));
const preparedQuestions = catalogue.questions.map((question, index) => {
  const sourceRowNumber = index + 1;
  if (Number(question.sourceId) !== sourceRowNumber) throw new Error(`Unexpected Vodičák question order at row ${sourceRowNumber}.`);
  if (question.answers.length !== 3 || !question.correctAnswerKey) throw new Error(`Invalid options at question ${question.sourceId}.`);
  const groupRow = groupRows[index];
  const primaryTopicId = topicIdBySourceBlock.get(question.block);
  if (!primaryTopicId) throw new Error(`Unmapped Slovak topic: ${question.block}`);
  const categoryCodes = groupRow.appliesToAllLicenceGroups ? allLicenceGroups : groupRow.licenceGroups;
  const media = question.imageSourcePaths.map((sourcePath) => mediaBySourcePath.get(sourcePath) ?? {
    status: "not_in_catalogue_manifest", sourcePath,
  });
  const questionMedia = media.flatMap((item) => {
    const asset = deliveryAssetFor(item.sourcePath, item);
    return asset ? [{ role: "primary", asset }] : [];
  });

  return {
    question_set_key: questionSetKey,
    source_id: `sk:${question.sourceId}`,
    source_row_number: sourceRowNumber,
    points: question.points,
    answer_kind: "choice",
    correct_option_id: question.correctAnswerKey,
    category_codes: categoryCodes,
    primary_topic_id: primaryTopicId,
    topic_ids: [primaryTopicId],
    scope: null,
    difficulty_seed: null,
    is_active: true,
    content: {
      prompt: { sk: question.questionSk },
      options: question.answers.map((answer) => ({ id: answer.key, text: { sk: answer.text }, media: [] })),
      // References use the R2 delivery-key convention. This preparation step
      // does not upload an object or contact either R2 or Supabase.
      question_media: questionMedia,
    },
    official_metadata: {
      source_question_number: sourceRowNumber,
      source_hash: question.sourceHash,
      source: question.source,
      source_block: question.block,
      official_pdf: {
        filename: officialPdfName,
        sha256: sha256(officialPdfBytes),
        section: groupRow.officialPdfSection,
        local_question_number: groupRow.officialPdfLocalNumber,
        applies_to_all_licence_groups: groupRow.appliesToAllLicenceGroups,
        explicit_licence_groups: groupRow.licenceGroups,
      },
      // This allows the existing basket-based exam engine to select the
      // statutory 8/2/8/4/1/3/2/2/8/2 mix once an SK client is enabled.
      official_basket_scope_id: groupRow.officialPdfSection,
      official_basket_scope_order: groupRow.officialPdfLocalNumber,
      media_expected: media.length > 0,
      media_available_at_snapshot: questionMedia.length > 0,
    },
  };
});

const questionMedia = preparedQuestions.flatMap((question, index) => {
  const sourceQuestion = catalogue.questions[index];
  return sourceQuestion.imageSourcePaths.map((sourcePath) => ({
    question_set_key: questionSetKey,
    source_id: question.source_id,
    source_row_number: question.source_row_number,
    source_path: sourcePath,
    ...(mediaBySourcePath.get(sourcePath) ?? { status: "not_in_catalogue_manifest", sourcePath }),
    local_path: localMediaPath(sourcePath),
    delivery_asset: deliveryAssetFor(sourcePath, mediaBySourcePath.get(sourcePath) ?? { status: "not_in_catalogue_manifest", sourcePath }),
  }));
});

const r2UploadPlan = [...new Map(questionMedia
  .filter((item) => item.status === "downloaded")
  .map((item) => [item.source_path, item]))
  .values()]
  .map((item) => ({
    source_path: item.source_path,
    local_path: item.local_path,
    bytes: item.bytes,
    content_type: item.contentType,
    sha256: item.sha256,
    r2_object_key: `${item.delivery_asset.storageBucket}/${item.delivery_asset.storagePath}`,
    delivery_asset: item.delivery_asset,
  }))
  .sort((left, right) => left.r2_object_key.localeCompare(right.r2_object_key));

const questionSet = {
  key: questionSetKey,
  country_code: "SK",
  source_name: "Vodičák catalogue mirror (MV SR attribution); licence groups cross-checked against 2023 Police Presidium PDF",
  source_version: `vodicak-snapshot-${catalogue.snapshotAt.slice(0, 10)}`,
  is_active: false,
  exam_config: {
    exam: {
      question_count: 40,
      max_points: 100,
      pass_points: 90,
      duration_minutes: 30,
      navigation: "free",
      answer_options_per_question: 3,
      correct_answers_per_question: 1,
      topic_mix: [8, 2, 8, 4, 1, 3, 2, 2, 8, 2],
      topic_points: [3, 3, 2, 4, 2, 2, 1, 1, 3, 1],
      baskets: [
        { scope_id: 1, count: 8, points: 3 },
        { scope_id: 2, count: 2, points: 3 },
        { scope_id: 3, count: 8, points: 2 },
        { scope_id: 4, count: 4, points: 4 },
        { scope_id: 5, count: 1, points: 2 },
        { scope_id: 6, count: 3, points: 2 },
        { scope_id: 7, count: 2, points: 1 },
        { scope_id: 8, count: 2, points: 1 },
        { scope_id: 9, count: 8, points: 3 },
        { scope_id: 10, count: 2, points: 1 },
      ],
    },
    source: {
      canonical_exam_rules: "https://www.slov-lex.sk/pravne-predpisy/SK/ZZ/2009/9/20260901",
      canonical_question_authority: "https://www.minv.sk/?elektronicke-testy",
      enumeration_mirror: "https://vodicak.app/otazky",
      canonical_verification_required: true,
    },
    import_state: "prepared_locally_not_imported",
    media: {
      state: "r2_upload_pending",
      delivery_path_prefix: "question-images/sk/questions/",
      r2_upload_plan: "r2-upload-plan.json",
    },
  },
};

const summary = {
  questionSetKey,
  preparedAt: new Date().toISOString(),
  sourceSnapshotAt: catalogue.snapshotAt,
  sourceSnapshotHash,
  questionCount: preparedQuestions.length,
  optionCount: preparedQuestions.length * 3,
  topicCount: topics.length,
  categoryCounts: Object.fromEntries(allLicenceGroups.map((group) => [group, preparedQuestions.filter((question) => question.category_codes.includes(group)).length])),
  universalQuestionCount: groupRows.filter((row) => row.appliesToAllLicenceGroups).length,
  categorySource: { pdf: officialPdfName, sha256: sha256(officialPdfBytes), mappedRows: groupRows.length },
  media: {
    questionRowsWithMedia: preparedQuestions.filter((question) => question.official_metadata.media_expected).length,
    references: questionMedia.length,
    downloadedReferences: questionMedia.filter((item) => item.status === "downloaded").length,
    unavailableReferences: questionMedia.filter((item) => item.status === "unavailable_at_snapshot").length,
    r2ObjectsPlanned: r2UploadPlan.length,
  },
  databaseTouched: false,
};

await mkdir(preparedRoot, { recursive: true });
await Promise.all([
  writeFile(join(preparedRoot, "question_set.json"), `${JSON.stringify(questionSet, null, 2)}\n`),
  writeFile(join(preparedRoot, "question_topic_catalog_v2.json"), `${JSON.stringify(topics, null, 2)}\n`),
  writeFile(join(preparedRoot, "questions_v2.json"), `${JSON.stringify(preparedQuestions, null, 2)}\n`),
  writeFile(join(preparedRoot, "question_media_manifest.json"), `${JSON.stringify(questionMedia, null, 2)}\n`),
  writeFile(join(preparedRoot, "r2-upload-plan.json"), `${JSON.stringify(r2UploadPlan, null, 2)}\n`),
  writeFile(join(preparedRoot, "import-summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
]);

console.log(JSON.stringify(summary, null, 2));

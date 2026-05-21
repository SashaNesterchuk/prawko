import path from "node:path";
import { fileURLToPath } from "node:url";

import type { TopicBlockId } from "@prawko/config";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = path.resolve(currentDir, "../../../");
export const DATA_ROOT = path.join(REPO_ROOT, "data", "questions");
export const RAW_ROOT = path.join(DATA_ROOT, "raw");
export const RAW_XLSX_DIR = path.join(RAW_ROOT, "xlsx");
export const RAW_MEDIA_DIR = path.join(RAW_ROOT, "media");
export const RAW_MEDIA_ALIASES_PATH = path.join(RAW_MEDIA_DIR, "aliases.json");
export const RAW_TRANSLATIONS_DIR = path.join(RAW_ROOT, "translations");
export const INTERIM_GENERATED_DIR = path.join(
  DATA_ROOT,
  "interim",
  "generated"
);
export const NORMALIZED_GENERATED_DIR = path.join(
  DATA_ROOT,
  "normalized",
  "generated"
);
export const EXPORTS_GENERATED_DIR = path.join(
  DATA_ROOT,
  "exports",
  "generated"
);
export const DELIVERY_ROOT = path.join(DATA_ROOT, "delivery");
export const DELIVERY_GENERATED_DIR = path.join(DELIVERY_ROOT, "generated");
export const DELIVERY_ASSETS_DIR = path.join(DELIVERY_GENERATED_DIR, "assets");

export const DEFAULT_MEDIA_ALIASES = {
  "5-9.2021.wmv": "5-9.2021 bis.wmv",
} as const;

export const FIELD_ALIASES = {
  questionSourceId: [
    "id",
    "nr pytania",
    "numer pytania",
    "pytanie id",
    "question id",
    "lp",
    "l p",
    "nr",
  ],
  questionPl: [
    "pytanie",
    "tresc pytania",
    "treść pytania",
    "tekst pytania",
    "question",
    "question pl",
    "question_pl",
  ],
  questionEn: [
    "pytanie en",
    "pytanie [en]",
    "question en",
    "question_en",
  ],
  questionUa: [
    "pytanie ua",
    "pytanie [ua]",
    "question ua",
    "question_ua",
  ],
  optionA: ["a", "odp a", "odpowiedz a", "odpowiedź a", "answer a"],
  optionB: ["b", "odp b", "odpowiedz b", "odpowiedź b", "answer b"],
  optionC: ["c", "odp c", "odpowiedz c", "odpowiedź c", "answer c"],
  correctAnswer: [
    "poprawna odp",
    "poprawna odp.",
    "poprawna odpowiedz",
    "poprawna odpowiedź",
    "prawidlowa odpowiedz",
    "prawidłowa odpowiedź",
    "odpowiedz prawidlowa",
    "odpowiedź prawidłowa",
    "correct answer",
    "correct_answer",
  ],
  mediaFilename: [
    "media",
    "nazwa pliku",
    "plik",
    "filename",
    "media filename",
  ],
  pjmQuestionMediaFilename: [
    "nazwa media t umaczenie migowe pjm tresc pyt",
    "nazwa media tlumaczenie migowe pjm tresc pyt",
    "nazwa media tłumaczenie migowe pjm treść pyt",
    "pjm pytanie",
    "pjm question media",
  ],
  pjmAnswerAMediaFilename: [
    "nazwa media t umaczenie migowe pjm tresc odp a",
    "nazwa media tlumaczenie migowe pjm tresc odp a",
    "nazwa media tłumaczenie migowe pjm treść odp a",
    "pjm odpowiedz a",
    "pjm odpowiedź a",
    "pjm answer a media",
  ],
  pjmAnswerBMediaFilename: [
    "nazwa media t umaczenie migowe pjm tresc odp b",
    "nazwa media tlumaczenie migowe pjm tresc odp b",
    "nazwa media tłumaczenie migowe pjm treść odp b",
    "pjm odpowiedz b",
    "pjm odpowiedź b",
    "pjm answer b media",
  ],
  pjmAnswerCMediaFilename: [
    "nazwa media t umaczenie migowe pjm tresc odp c",
    "nazwa media tlumaczenie migowe pjm tresc odp c",
    "nazwa media tłumaczenie migowe pjm treść odp c",
    "pjm odpowiedz c",
    "pjm odpowiedź c",
    "pjm answer c media",
  ],
  points: ["punkty", "punktacja", "points", "liczba punktow", "liczba punktów"],
  scope: ["zakres", "scope", "typ zakresu"],
  categories: ["kategorie", "kategoria", "categories", "category"],
} as const;

export const HEADER_DETECTION_FIELDS = [
  "questionPl",
  "correctAnswer",
  "points",
  "scope",
  "categories",
  "mediaFilename",
] as const;

export const TRUE_ANSWER_ALIASES = [
  "t",
  "tak",
  "true",
  "prawda",
  "yes",
] as const;

export const FALSE_ANSWER_ALIASES = [
  "n",
  "nie",
  "false",
  "falsz",
  "fałsz",
  "no",
] as const;

export const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
]);

export const VIDEO_EXTENSIONS = new Set([
  ".wmv",
  ".mp4",
  ".mov",
  ".avi",
  ".mpeg",
  ".mpg",
  ".webm",
  ".m4v",
]);

export const TOPIC_KEYWORDS: Record<TopicBlockId, string[]> = {
  signs: ["znak", "znaki", "sygnal", "sygnał", "tabliczk"],
  intersections: ["skrzyz", "skrzyż", "rondo", "skręt", "skret"],
  overtaking: ["wyprzedz", "omij", "wymij", "pas ruchu", "zmiana pasa"],
  pedestrians: ["pieszy", "pieszych", "przejsc", "przejść", "rowerzyst"],
  first_aid: ["pierwsz", "ratown", "krwotok", "resuscyt", "wypadk"],
  priority: ["pierwszen", "pierwszeń", "ustap", "ustąp", "wlaczanie"],
  safety: ["bezpieczen", "bezpieczeń", "predkos", "prędkoś", "hamowan"],
  technical: ["pojazd", "opona", "hamulec", "silnik", "swiatl", "światł"],
};

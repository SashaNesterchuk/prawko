import type { TopicBlockId } from "./index";

/**
 * The official categorized workbook provides one learner-facing category per
 * question. Keep this catalog aligned with its category_legend worksheet.
 */
export const QUESTION_TOPIC_CATALOG = [
  {
    id: "signs_signals",
    sortOrder: 1,
    titleUa: "Знаки та сигнали",
    titlePl: "Znaki i sygnały drogowe",
    titleEn: "Signs & Signals",
    titleDe: "Verkehrszeichen und Signale",
    titleEs: "Señalización vial",
    titleCs: "Značky a signalizace",
    sourceLabelUa:
      "Дорожні знаки, таблички, дорожня розмітка, світлофори та сигнали регулювальника.",
  },
  {
    id: "intersections_priority",
    sortOrder: 2,
    titleUa: "Перехрестя та пріоритет",
    titlePl: "Skrzyżowania i pierwszeństwo",
    titleEn: "Intersections & Right of Way",
    titleDe: "Kreuzungen und Vorfahrt",
    titleEs: "Intersecciones y prioridad",
    titleCs: "Křižovatky a přednost",
    sourceLabelUa:
      "Черговість проїзду, рівнозначні й нерівнозначні перехрестя, круговий рух і правила пріоритету.",
  },
  {
    id: "driving_maneuvers",
    sortOrder: 3,
    titleUa: "Керування та маневри",
    titlePl: "Jazda i manewry",
    titleEn: "Driving & Maneuvers",
    titleDe: "Fahren und Manövrieren",
    titleEs: "Conducción y maniobras",
    titleCs: "Jízda a manévry",
    sourceLabelUa:
      "Розташування на дорозі, смуги, початок руху, повороти, розвороти, зміна смуги, обгін, об’їзд, рух заднім ходом, зупинка та стоянка.",
  },
  {
    id: "speed_distance",
    sortOrder: 4,
    titleUa: "Швидкість і дистанція",
    titlePl: "Prędkość i odstęp",
    titleEn: "Speed & Distance",
    titleDe: "Geschwindigkeit und Abstand",
    titleEs: "Velocidad y distancia",
    titleCs: "Rychlost a odstup",
    sourceLabelUa:
      "Обмеження та вибір швидкості, інтервали, дистанція, шлях реакції, гальмівний і зупинний шлях.",
  },
  {
    id: "other_road_users",
    sortOrder: 5,
    titleUa: "Вразливі учасники руху",
    titlePl: "Niechronieni uczestnicy ruchu",
    titleEn: "Vulnerable Road Users",
    titleDe: "Ungeschützte Verkehrsteilnehmer",
    titleEs: "Usuarios vulnerables",
    titleCs: "Chodci, cyklisté a MHD",
    sourceLabelUa:
      "Пішоходи, велосипедисти, електросамокати, діти, люди з інвалідністю та правила взаємодії з ними.",
  },
  {
    id: "roads_zones_crossings",
    sortOrder: 6,
    titleUa: "Дороги, зони та переїзди",
    titlePl: "Drogi, strefy i przejazdy",
    titleEn: "Roads, Zones & Rail Crossings",
    titleDe: "Straßen, Zonen und Bahnübergänge",
    titleEs: "Vías, zonas y pasos a nivel",
    titleCs: "Dálnice, zóny a přejezdy",
    sourceLabelUa:
      "Автомагістралі, швидкісні дороги, тунелі, житлові та інші спеціальні зони, автобусні смуги, залізничні й трамвайні переїзди.",
  },
  {
    id: "vehicle_equipment",
    sortOrder: 7,
    titleUa: "Транспортний засіб і обладнання",
    titlePl: "Pojazd i wyposażenie",
    titleEn: "Vehicle & Equipment",
    titleDe: "Fahrzeug und Ausstattung",
    titleEs: "Vehículo y equipamiento",
    titleCs: "Vozidlo a výbava",
    sourceLabelUa:
      "Будова, шини, гальма, рідини, системи безпеки, контрольні лампи, освітлення, сигнали та обов’язкове обладнання транспортного засобу.",
  },
  {
    id: "attention_risks",
    sortOrder: 8,
    titleUa: "Уважність і ризики",
    titlePl: "Uwaga i zagrożenia",
    titleEn: "Awareness & Hazards",
    titleDe: "Aufmerksamkeit und Gefahren",
    titleEs: "Atención y riesgos",
    titleCs: "Bezpečná jízda",
    sourceLabelUa:
      "Погода, видимість, стан покриття, алкоголь, ліки, втома, відволікання, час реакції та розпізнавання небезпек.",
  },
  {
    id: "accidents_first_aid",
    sortOrder: 9,
    titleUa: "ДТП і перша допомога",
    titlePl: "Wypadki i pierwsza pomoc",
    titleEn: "Accidents & First Aid",
    titleDe: "Unfälle und Erste Hilfe",
    titleEs: "Accidentes y primeros auxilios",
    titleCs: "Nehody a první pomoc",
    sourceLabelUa:
      "Дії при ДТП, поломці чи пожежі, захист місця події, виклик служб, евакуація та домедична допомога.",
  },
  {
    id: "transport",
    sortOrder: 10,
    titleUa: "Перевезення",
    titlePl: "Przewóz i holowanie",
    titleEn: "Passengers & Cargo",
    titleDe: "Personen- und Gütertransport",
    titleEs: "Pasajeros, carga y remolque",
    titleCs: "Přeprava a náklad",
    sourceLabelUa:
      "Пасажири, ремені, дитячі крісла, вантажі, причепи, буксирування, маси, габарити та правила професійних перевезень.",
  },
  {
    id: "documents_responsibility",
    sortOrder: 11,
    titleUa: "Документи та відповідальність",
    titlePl: "Dokumenty i obowiązki",
    titleEn: "Documents & Responsibility",
    titleDe: "Dokumente und Pflichten",
    titleEs: "Documentos y obligaciones",
    titleCs: "Doklady a povinnosti",
    sourceLabelUa:
      "Посвідчення, право керування, реєстрація, страхування, техогляд, санкції, дозволи, тахограф і час роботи водія.",
  },
] as const;

export type QuestionTopicCatalogEntry = (typeof QUESTION_TOPIC_CATALOG)[number];
export type QuestionTopicId = QuestionTopicCatalogEntry["id"];

export const QUESTION_TOPIC_IDS = QUESTION_TOPIC_CATALOG.map(
  (topic) => topic.id
) as QuestionTopicId[];

/**
 * Learner-facing Czech catalogue. Official eTesty baskets stay on
 * `official_metadata.official_basket_scope_id` and are not Learn topics.
 * Keep this a subset of QUESTION_TOPIC_IDS so Prawko's 11-topic catalog
 * and TypeScript contract stay unchanged.
 */
export const CZECH_QUESTION_TOPIC_IDS = [
  "signs_signals",
  "intersections_priority",
  "driving_maneuvers",
  "other_road_users",
  "attention_risks",
  "vehicle_equipment",
  "documents_responsibility",
  "accidents_first_aid",
] as const satisfies readonly QuestionTopicId[];

export type CzechQuestionTopicId = (typeof CZECH_QUESTION_TOPIC_IDS)[number];

export function getQuestionTopicIdsForCountry(
  countryCode: string | null | undefined
): QuestionTopicId[] {
  return countryCode === "CZ"
    ? [...CZECH_QUESTION_TOPIC_IDS]
    : QUESTION_TOPIC_IDS;
}

export type LearningTopicId = TopicBlockId | QuestionTopicId;

export function isQuestionTopicId(value: string): value is QuestionTopicId {
  return QUESTION_TOPIC_IDS.includes(value as QuestionTopicId);
}

/**
 * Historic topic IDs are retained solely to read old plans and local progress.
 * New assignments must always use the official categorized workbook IDs above.
 */
export const LEGACY_QUESTION_TOPIC_ID_MAP = {
  road_markings_and_warning_signs: "signs_signals",
  road_signs_and_regulations: "signs_signals",
  traffic_control_and_lights: "signs_signals",
  right_of_way_and_intersections: "intersections_priority",
  road_position_lanes_and_parking: "driving_maneuvers",
  overtaking_and_maneuvers: "driving_maneuvers",
  pedestrians_cyclists_and_children: "other_road_users",
  railway_crossings_and_vehicle_security: "roads_zones_crossings",
  vehicle_lighting_and_visibility: "vehicle_equipment",
  speed_distance_and_braking: "speed_distance",
  safe_driving_and_hazard_awareness: "attention_risks",
  occupant_and_cargo_safety: "transport",
  vehicle_maintenance_and_tyres: "vehicle_equipment",
  documents_insurance_and_owner_responsibilities: "documents_responsibility",
  breakdowns_accidents_and_first_aid: "accidents_first_aid",
  horizontal_road_markings: "signs_signals",
  traffic_lights_and_controller_signals: "signs_signals",
  external_lighting: "vehicle_equipment",
  warning_signs: "signs_signals",
  prohibition_and_mandatory_signs: "signs_signals",
  information_direction_and_auxiliary_signs: "signs_signals",
  right_of_way_entering_traffic_equal_intersections: "intersections_priority",
  lane_use_and_priority_signed_intersections: "intersections_priority",
  priority_at_signalized_intersections: "intersections_priority",
  regulated_intersections_and_public_transport_stops: "intersections_priority",
  vehicle_position_entry_exit_stopping_parking: "driving_maneuvers",
  lane_changes_and_direction: "driving_maneuvers",
  overtaking: "driving_maneuvers",
  passing_avoiding_reversing: "driving_maneuvers",
  special_caution: "attention_risks",
  pedestrians_and_persons_with_disabilities: "other_road_users",
  cyclists_and_children: "other_road_users",
  dropoff_vehicle_security_railway_crossings: "roads_zones_crossings",
  breakdown_and_accident_response: "accidents_first_aid",
  perception_situation_assessment_reaction_time: "attention_risks",
  speed_limits: "speed_distance",
  occupant_restraints_and_seating: "transport",
  following_distance_and_braking: "speed_distance",
  risk_factors_weather_time_road_type: "attention_risks",
  driver_fields_of_view: "attention_risks",
  driving_technique: "attention_risks",
  vehicle_cargo_and_passenger_safety: "transport",
  owner_insurance_and_required_documents: "documents_responsibility",
  tyre_tread_and_mechanical_safety: "vehicle_equipment",
  rescue_operations: "accidents_first_aid",
} as const satisfies Record<string, QuestionTopicId>;

export const LEGACY_TOPIC_BLOCK_TOPIC_FALLBACKS: Record<
  TopicBlockId,
  {
    primaryTopicId: QuestionTopicId;
    topicIds: QuestionTopicId[];
  }
> = {
  signs: {
    primaryTopicId: "signs_signals",
    topicIds: ["signs_signals"],
  },
  intersections: {
    primaryTopicId: "intersections_priority",
    topicIds: ["intersections_priority"],
  },
  overtaking: {
    primaryTopicId: "driving_maneuvers",
    topicIds: ["driving_maneuvers"],
  },
  pedestrians: {
    primaryTopicId: "other_road_users",
    topicIds: ["other_road_users"],
  },
  first_aid: {
    primaryTopicId: "accidents_first_aid",
    topicIds: ["accidents_first_aid"],
  },
  priority: {
    primaryTopicId: "intersections_priority",
    topicIds: ["intersections_priority"],
  },
  safety: {
    primaryTopicId: "attention_risks",
    topicIds: ["attention_risks"],
  },
  technical: {
    primaryTopicId: "vehicle_equipment",
    topicIds: ["vehicle_equipment"],
  },
};

/**
 * Returns a current catalog ID for official IDs and historic local values.
 */
export function normalizeQuestionTopicId(
  value: string | null | undefined
): QuestionTopicId | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  if (isQuestionTopicId(normalized)) {
    return normalized;
  }

  return (
    LEGACY_QUESTION_TOPIC_ID_MAP[
      normalized as keyof typeof LEGACY_QUESTION_TOPIC_ID_MAP
    ] ?? null
  );
}

export function normalizeQuestionTopicIds(
  values: readonly (string | null | undefined)[]
): QuestionTopicId[] {
  return [
    ...new Set(
      values.flatMap((value) => {
        const topicId = normalizeQuestionTopicId(value);
        return topicId ? [topicId] : [];
      })
    ),
  ];
}

export function getQuestionTopicCatalogEntry(
  topicId: QuestionTopicId
): QuestionTopicCatalogEntry {
  const topic = QUESTION_TOPIC_CATALOG.find((entry) => entry.id === topicId);

  if (!topic) {
    throw new Error(`Unknown question topic id "${topicId}".`);
  }

  return topic;
}

export function getQuestionTopicFallbackFromTopicBlock(topicBlock: TopicBlockId) {
  return LEGACY_TOPIC_BLOCK_TOPIC_FALLBACKS[topicBlock];
}

import type { TopicBlockId } from "./index";

export const QUESTION_TOPIC_CATALOG = [
  {
    id: "road_markings_and_warning_signs",
    sortOrder: 1,
    titleUa: "Розмітка й попереджувальні знаки",
    titlePl: "Oznakowanie i znaki ostrzegawcze",
    titleEn: "Road markings and warning signs",
    sourceLabelUa: "Горизонтальна розмітка та попереджувальні знаки",
  },
  {
    id: "road_signs_and_regulations",
    sortOrder: 2,
    titleUa: "Знаки та дорожні обмеження",
    titlePl: "Znaki drogowe i ograniczenia",
    titleEn: "Road signs and restrictions",
    sourceLabelUa: "Заборонні, наказові, інформаційні та напрямні знаки",
  },
  {
    id: "traffic_control_and_lights",
    sortOrder: 3,
    titleUa: "Сигнали та регулювання руху",
    titlePl: "Sygnalizacja i kierowanie ruchem",
    titleEn: "Traffic control and lights",
    sourceLabelUa: "Світлові сигнали та сигнали особи, що керує рухом",
  },
  {
    id: "right_of_way_and_intersections",
    sortOrder: 4,
    titleUa: "Перевага та перехрестя",
    titlePl: "Pierwszeństwo i skrzyżowania",
    titleEn: "Right of way and intersections",
    sourceLabelUa: "Перевага, смуги руху та перехрестя",
  },
  {
    id: "road_position_lanes_and_parking",
    sortOrder: 5,
    titleUa: "Смуги, положення та паркування",
    titlePl: "Pasy, pozycja i parkowanie",
    titleEn: "Lanes, road position and parking",
    sourceLabelUa: "Положення автомобіля, зміна смуги, зупинка і стоянка",
  },
  {
    id: "overtaking_and_maneuvers",
    sortOrder: 6,
    titleUa: "Обгін і маневри",
    titlePl: "Wyprzedzanie i manewry",
    titleEn: "Overtaking and maneuvers",
    sourceLabelUa: "Обгін, об'їзд, уникнення та рух заднім ходом",
  },
  {
    id: "pedestrians_cyclists_and_children",
    sortOrder: 7,
    titleUa: "Пішоходи, велосипедисти й діти",
    titlePl: "Piesi, rowerzyści i dzieci",
    titleEn: "Pedestrians, cyclists and children",
    sourceLabelUa: "Поведінка щодо пішоходів, велосипедистів, дітей і людей з інвалідністю",
  },
  {
    id: "railway_crossings_and_vehicle_security",
    sortOrder: 8,
    titleUa: "Переїзди та безпека автомобіля",
    titlePl: "Przejazdy kolejowe i zabezpieczenie pojazdu",
    titleEn: "Rail crossings and vehicle security",
    sourceLabelUa: "Висадка пасажирів, захист автомобіля та залізничні переїзди",
  },
  {
    id: "vehicle_lighting_and_visibility",
    sortOrder: 9,
    titleUa: "Світло та оглядовість",
    titlePl: "Oświetlenie i widoczność",
    titleEn: "Vehicle lighting and visibility",
    sourceLabelUa: "Зовнішнє освітлення та поле зору водія",
  },
  {
    id: "speed_distance_and_braking",
    sortOrder: 10,
    titleUa: "Швидкість, дистанція й гальмування",
    titlePl: "Prędkość, odstęp i hamowanie",
    titleEn: "Speed, distance and braking",
    sourceLabelUa: "Обмеження швидкості, дистанція та гальмування",
  },
  {
    id: "safe_driving_and_hazard_awareness",
    sortOrder: 11,
    titleUa: "Безпечне водіння та ризики",
    titlePl: "Bezpieczna jazda i zagrożenia",
    titleEn: "Safe driving and hazards",
    sourceLabelUa: "Особлива обережність, сприйняття, ризики й техніка водіння",
  },
  {
    id: "occupant_and_cargo_safety",
    sortOrder: 12,
    titleUa: "Безпека пасажирів і вантажу",
    titlePl: "Bezpieczeństwo pasażerów i ładunku",
    titleEn: "Occupant and cargo safety",
    sourceLabelUa: "Ремені, сидіння, вантаж і безпека пасажирів",
  },
  {
    id: "vehicle_maintenance_and_tyres",
    sortOrder: 13,
    titleUa: "Технічний стан і шини",
    titlePl: "Stan techniczny i opony",
    titleEn: "Vehicle maintenance and tyres",
    sourceLabelUa: "Механічна безпека, технічний стан і протектори шин",
  },
  {
    id: "documents_insurance_and_owner_responsibilities",
    sortOrder: 14,
    titleUa: "Документи, страхування та обов'язки",
    titlePl: "Dokumenty, ubezpieczenie i obowiązki właściciela",
    titleEn: "Documents, insurance and owner responsibilities",
    sourceLabelUa: "Обов'язки власника, страхування та необхідні документи",
  },
  {
    id: "breakdowns_accidents_and_first_aid",
    sortOrder: 15,
    titleUa: "Аварії, поломки та допомога",
    titlePl: "Awarie, wypadki i pomoc",
    titleEn: "Breakdowns, accidents and first aid",
    sourceLabelUa: "Дії у разі поломки, аварії та рятувальні роботи",
  },
] as const;

export type QuestionTopicCatalogEntry = (typeof QUESTION_TOPIC_CATALOG)[number];
export type QuestionTopicId = QuestionTopicCatalogEntry["id"];

export const QUESTION_TOPIC_IDS = QUESTION_TOPIC_CATALOG.map(
  (topic) => topic.id
) as QuestionTopicId[];

export type LearningTopicId = TopicBlockId | QuestionTopicId;

/**
 * Maps every ID from the retired 30-topic catalog into the compact catalog.
 * Keep this until all locally stored catalogs and historic exports are replaced.
 */
export const LEGACY_QUESTION_TOPIC_ID_MAP = {
  horizontal_road_markings: "road_markings_and_warning_signs",
  traffic_lights_and_controller_signals: "traffic_control_and_lights",
  external_lighting: "vehicle_lighting_and_visibility",
  warning_signs: "road_markings_and_warning_signs",
  prohibition_and_mandatory_signs: "road_signs_and_regulations",
  information_direction_and_auxiliary_signs: "road_signs_and_regulations",
  right_of_way_entering_traffic_equal_intersections:
    "right_of_way_and_intersections",
  lane_use_and_priority_signed_intersections:
    "right_of_way_and_intersections",
  priority_at_signalized_intersections: "right_of_way_and_intersections",
  regulated_intersections_and_public_transport_stops:
    "right_of_way_and_intersections",
  vehicle_position_entry_exit_stopping_parking:
    "road_position_lanes_and_parking",
  lane_changes_and_direction: "road_position_lanes_and_parking",
  overtaking: "overtaking_and_maneuvers",
  passing_avoiding_reversing: "overtaking_and_maneuvers",
  special_caution: "safe_driving_and_hazard_awareness",
  pedestrians_and_persons_with_disabilities:
    "pedestrians_cyclists_and_children",
  cyclists_and_children: "pedestrians_cyclists_and_children",
  dropoff_vehicle_security_railway_crossings:
    "railway_crossings_and_vehicle_security",
  breakdown_and_accident_response: "breakdowns_accidents_and_first_aid",
  perception_situation_assessment_reaction_time:
    "safe_driving_and_hazard_awareness",
  speed_limits: "speed_distance_and_braking",
  occupant_restraints_and_seating: "occupant_and_cargo_safety",
  following_distance_and_braking: "speed_distance_and_braking",
  risk_factors_weather_time_road_type: "safe_driving_and_hazard_awareness",
  driver_fields_of_view: "vehicle_lighting_and_visibility",
  driving_technique: "safe_driving_and_hazard_awareness",
  vehicle_cargo_and_passenger_safety: "occupant_and_cargo_safety",
  owner_insurance_and_required_documents:
    "documents_insurance_and_owner_responsibilities",
  tyre_tread_and_mechanical_safety: "vehicle_maintenance_and_tyres",
  rescue_operations: "breakdowns_accidents_and_first_aid",
} as const satisfies Record<string, QuestionTopicId>;

export const LEGACY_TOPIC_BLOCK_TOPIC_FALLBACKS: Record<
  TopicBlockId,
  {
    primaryTopicId: QuestionTopicId;
    topicIds: QuestionTopicId[];
  }
> = {
  signs: {
    primaryTopicId: "road_markings_and_warning_signs",
    topicIds: [
      "road_markings_and_warning_signs",
      "road_signs_and_regulations",
      "traffic_control_and_lights",
    ],
  },
  intersections: {
    primaryTopicId: "right_of_way_and_intersections",
    topicIds: ["right_of_way_and_intersections"],
  },
  overtaking: {
    primaryTopicId: "overtaking_and_maneuvers",
    topicIds: ["overtaking_and_maneuvers"],
  },
  pedestrians: {
    primaryTopicId: "pedestrians_cyclists_and_children",
    topicIds: ["pedestrians_cyclists_and_children"],
  },
  first_aid: {
    primaryTopicId: "breakdowns_accidents_and_first_aid",
    topicIds: ["breakdowns_accidents_and_first_aid"],
  },
  priority: {
    primaryTopicId: "right_of_way_and_intersections",
    topicIds: ["right_of_way_and_intersections"],
  },
  safety: {
    primaryTopicId: "safe_driving_and_hazard_awareness",
    topicIds: [
      "safe_driving_and_hazard_awareness",
      "speed_distance_and_braking",
      "vehicle_lighting_and_visibility",
    ],
  },
  technical: {
    primaryTopicId: "vehicle_maintenance_and_tyres",
    topicIds: [
      "vehicle_maintenance_and_tyres",
      "occupant_and_cargo_safety",
      "documents_insurance_and_owner_responsibilities",
    ],
  },
};

const QUESTION_TOPIC_ID_SET = new Set<string>(QUESTION_TOPIC_IDS);

export function isQuestionTopicId(value: string): value is QuestionTopicId {
  return QUESTION_TOPIC_ID_SET.has(value);
}

/**
 * Returns a current catalog ID for both current and retired topic identifiers.
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

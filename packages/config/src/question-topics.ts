import type { TopicBlockId } from "./index";

export const QUESTION_TOPIC_CATALOG = [
  {
    id: "horizontal_road_markings",
    sortOrder: 1,
    titleUa: "Дорожня розмітка",
    titlePl: "Oznakowanie poziome",
    titleEn: "Road markings",
    sourceLabelUa: "Горизонтальні дорожні знаки",
    notesUa: "Нормалізовано як дорожня розмітка.",
  },
  {
    id: "traffic_lights_and_controller_signals",
    sortOrder: 2,
    titleUa: "Сигнали регулювання",
    titlePl: "Sygnały drogowe",
    titleEn: "Traffic signals",
    sourceLabelUa: "Світлові сигнали, сигнали регулювання дорожного руху",
  },
  {
    id: "external_lighting",
    sortOrder: 3,
    titleUa: "Зовнішнє освітлення",
    titlePl: "Światła zewnętrzne",
    titleEn: "Exterior lights",
    sourceLabelUa: "Використання зовнішніх світильників",
  },
  {
    id: "warning_signs",
    sortOrder: 4,
    titleUa: "Попереджувальні знаки",
    titlePl: "Znaki ostrzegawcze",
    titleEn: "Warning signs",
    sourceLabelUa: "Вертикальні попереджувальні знаки",
  },
  {
    id: "prohibition_and_mandatory_signs",
    sortOrder: 5,
    titleUa: "Знаки заборони й наказу",
    titlePl: "Znaki zakazu i nakazu",
    titleEn: "Restriction signs",
    sourceLabelUa: "Заборонні та наказові знаки",
  },
  {
    id: "information_direction_and_auxiliary_signs",
    sortOrder: 6,
    titleUa: "Інформаційні знаки",
    titlePl: "Znaki informacyjne",
    titleEn: "Information signs",
    sourceLabelUa:
      "Інформаційні вертикальні покажчики, покажчики напрямків, вказівники міст, допоміжні покажчики",
  },
  {
    id: "right_of_way_entering_traffic_equal_intersections",
    sortOrder: 7,
    titleUa: "Перевага та перехрестя",
    titlePl: "Pierwszeństwo i skrzyżowania",
    titleEn: "Right of way",
    sourceLabelUa:
      "Перевага транспортних засобів, включення в рух, паралельні перехрестя",
  },
  {
    id: "lane_use_and_priority_signed_intersections",
    sortOrder: 8,
    titleUa: "Смуги та пріоритет",
    titlePl: "Pasy i pierwszeństwo",
    titleEn: "Lanes and priority",
    sourceLabelUa:
      "Смуга проїзду, перехрестя зі знаками, що вказують на перевагу",
  },
  {
    id: "priority_at_signalized_intersections",
    sortOrder: 9,
    titleUa: "Світлофори й пріоритет",
    titlePl: "Sygnalizacja i pierwszeństwo",
    titleEn: "Traffic-light priority",
    sourceLabelUa: "Перевага - перехрестя зі світлофорами",
  },
  {
    id: "regulated_intersections_and_public_transport_stops",
    sortOrder: 10,
    titleUa: "Регульовані перехрестя",
    titlePl: "Skrzyżowania i przystanki",
    titleEn: "Controlled intersections",
    sourceLabelUa:
      "Смуга проїзду - перехрестя з регулюючим рухом, місця зупинок громадського транспорту",
  },
  {
    id: "vehicle_position_entry_exit_stopping_parking",
    sortOrder: 11,
    titleUa: "Розміщення та зупинка",
    titlePl: "Pozycja, postój i parkowanie",
    titleEn: "Position and parking",
    sourceLabelUa:
      "Положення автомобіля на дорозі, вʼїзд і виїзд, зупинка і стоянка",
  },
  {
    id: "lane_changes_and_direction",
    sortOrder: 12,
    titleUa: "Зміна смуги й напрямку",
    titlePl: "Zmiana pasa i kierunku",
    titleEn: "Lane changes",
    sourceLabelUa: "Зміна смуги, напрямок руху",
  },
  {
    id: "overtaking",
    sortOrder: 13,
    titleUa: "Обгін",
    titlePl: "Wyprzedzanie",
    titleEn: "Overtaking",
    sourceLabelUa: "Обгін",
  },
  {
    id: "passing_avoiding_reversing",
    sortOrder: 14,
    titleUa: "Маневри та задній хід",
    titlePl: "Manewry i cofanie",
    titleEn: "Maneuvers and reversing",
    sourceLabelUa: "Уникнення, обʼїзд, рух заднім ходом",
    notesUa: "Формулювання нормалізовано під дорожні маневри.",
  },
  {
    id: "special_caution",
    sortOrder: 15,
    titleUa: "Особлива обережність",
    titlePl: "Szczególna ostrożność",
    titleEn: "Special caution",
    sourceLabelUa: "Будьте особливо обережні",
  },
  {
    id: "pedestrians_and_persons_with_disabilities",
    sortOrder: 16,
    titleUa: "Пішоходи",
    titlePl: "Piesi",
    titleEn: "Pedestrians",
    sourceLabelUa: "Поведінка до пішоходів та людей з обмеженими можливостями",
  },
  {
    id: "cyclists_and_children",
    sortOrder: 17,
    titleUa: "Велосипедисти та діти",
    titlePl: "Rowerzyści i dzieci",
    titleEn: "Cyclists and children",
    sourceLabelUa: "Поведінка по відношенню до велосипедистів і дітей",
  },
  {
    id: "dropoff_vehicle_security_railway_crossings",
    sortOrder: 18,
    titleUa: "Пасажири та переїзди",
    titlePl: "Pasażerowie i przejazdy",
    titleEn: "Passengers and rail crossings",
    sourceLabelUa: "Висадка, охорона автомобіля, залізничні переїзди",
  },
  {
    id: "breakdown_and_accident_response",
    sortOrder: 19,
    titleUa: "Поломка та аварія",
    titlePl: "Awaria i wypadek",
    titleEn: "Breakdowns and accidents",
    sourceLabelUa: "Поведінка в разі поломки або аварії",
  },
  {
    id: "perception_situation_assessment_reaction_time",
    sortOrder: 20,
    titleUa: "Сприйняття й реакція",
    titlePl: "Percepcja i reakcja",
    titleEn: "Perception and reaction",
    sourceLabelUa: "Сприйняття, оцінка ситуації, час реакції",
  },
  {
    id: "speed_limits",
    sortOrder: 21,
    titleUa: "Швидкість і обмеження",
    titlePl: "Prędkość i ograniczenia",
    titleEn: "Speed limits",
    sourceLabelUa: "Допустима швидкість транспортного засобу, обмеження",
  },
  {
    id: "occupant_restraints_and_seating",
    sortOrder: 22,
    titleUa: "Ремені та сидіння",
    titlePl: "Pasy i siedzenia",
    titleEn: "Seat belts and seating",
    sourceLabelUa: "Обладнання автомобіля (ремні, підголівники, сидіння)",
  },
  {
    id: "following_distance_and_braking",
    sortOrder: 23,
    titleUa: "Дистанція й гальмування",
    titlePl: "Odstęp i hamowanie",
    titleEn: "Distance and braking",
    sourceLabelUa: "Відстань між автомобілями та гальмування",
  },
  {
    id: "risk_factors_weather_time_road_type",
    sortOrder: 24,
    titleUa: "Фактори ризику",
    titlePl: "Czynniki ryzyka",
    titleEn: "Risk factors",
    sourceLabelUa:
      "Фактори ризику (погодні та дорожні умови, час доби, тип доріг)",
  },
  {
    id: "driver_fields_of_view",
    sortOrder: 25,
    titleUa: "Поле зору водія",
    titlePl: "Pole widzenia kierowcy",
    titleEn: "Field of vision",
    sourceLabelUa: "Різні поля зору для водіїв",
  },
  {
    id: "driving_technique",
    sortOrder: 26,
    titleUa: "Техніка водіння",
    titlePl: "Technika jazdy",
    titleEn: "Driving technique",
    sourceLabelUa: "Техніка водіння",
  },
  {
    id: "vehicle_cargo_and_passenger_safety",
    sortOrder: 27,
    titleUa: "Безпека автомобіля",
    titlePl: "Bezpieczeństwo pojazdu",
    titleEn: "Vehicle safety",
    sourceLabelUa:
      "Фактори безпеки, що стосуються транспортного засобу, вантажу та осіб, що перевозяться",
  },
  {
    id: "owner_insurance_and_required_documents",
    sortOrder: 28,
    titleUa: "Страховка й документи",
    titlePl: "Ubezpieczenie i dokumenty",
    titleEn: "Insurance and documents",
    sourceLabelUa:
      "Обов'язки власника/власника транспортного засобу, страховка, необхідні документи",
  },
  {
    id: "tyre_tread_and_mechanical_safety",
    sortOrder: 29,
    titleUa: "Шини й протектор",
    titlePl: "Opony i bieżnik",
    titleEn: "Tyres and tread",
    sourceLabelUa: "Механічні аспекти безпеки дорожнього руху (протектори шин)",
  },
  {
    id: "rescue_operations",
    sortOrder: 30,
    titleUa: "Рятувальні роботи",
    titlePl: "Czynności ratunkowe",
    titleEn: "Rescue operations",
    sourceLabelUa: "Рятувальні роботи",
  },
] as const;

export type QuestionTopicCatalogEntry = (typeof QUESTION_TOPIC_CATALOG)[number];
export type QuestionTopicId = QuestionTopicCatalogEntry["id"];

export const QUESTION_TOPIC_IDS = QUESTION_TOPIC_CATALOG.map(
  (topic) => topic.id
) as QuestionTopicId[];

export type LearningTopicId = TopicBlockId | QuestionTopicId;

export const LEGACY_TOPIC_BLOCK_TOPIC_FALLBACKS: Record<
  TopicBlockId,
  {
    primaryTopicId: QuestionTopicId;
    topicIds: QuestionTopicId[];
  }
> = {
  signs: {
    primaryTopicId: "warning_signs",
    topicIds: [
      "warning_signs",
      "prohibition_and_mandatory_signs",
      "information_direction_and_auxiliary_signs",
      "horizontal_road_markings",
      "traffic_lights_and_controller_signals",
    ],
  },
  intersections: {
    primaryTopicId: "lane_use_and_priority_signed_intersections",
    topicIds: [
      "lane_use_and_priority_signed_intersections",
      "right_of_way_entering_traffic_equal_intersections",
      "priority_at_signalized_intersections",
      "regulated_intersections_and_public_transport_stops",
    ],
  },
  overtaking: {
    primaryTopicId: "overtaking",
    topicIds: ["overtaking"],
  },
  pedestrians: {
    primaryTopicId: "pedestrians_and_persons_with_disabilities",
    topicIds: [
      "pedestrians_and_persons_with_disabilities",
      "cyclists_and_children",
      "special_caution",
    ],
  },
  first_aid: {
    primaryTopicId: "rescue_operations",
    topicIds: ["rescue_operations", "breakdown_and_accident_response"],
  },
  priority: {
    primaryTopicId: "right_of_way_entering_traffic_equal_intersections",
    topicIds: [
      "right_of_way_entering_traffic_equal_intersections",
      "lane_use_and_priority_signed_intersections",
      "priority_at_signalized_intersections",
    ],
  },
  safety: {
    primaryTopicId: "risk_factors_weather_time_road_type",
    topicIds: [
      "risk_factors_weather_time_road_type",
      "following_distance_and_braking",
      "driving_technique",
      "special_caution",
    ],
  },
  technical: {
    primaryTopicId: "tyre_tread_and_mechanical_safety",
    topicIds: [
      "tyre_tread_and_mechanical_safety",
      "vehicle_cargo_and_passenger_safety",
      "occupant_restraints_and_seating",
      "owner_insurance_and_required_documents",
    ],
  },
};

const QUESTION_TOPIC_ID_SET = new Set<string>(QUESTION_TOPIC_IDS);

export function isQuestionTopicId(value: string): value is QuestionTopicId {
  return QUESTION_TOPIC_ID_SET.has(value);
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

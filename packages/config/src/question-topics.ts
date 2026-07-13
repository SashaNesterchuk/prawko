import type { TopicBlockId } from "./index";

export const QUESTION_TOPIC_CATALOG = [
  {
    id: "horizontal_road_markings",
    sortOrder: 1,
    titleUa: "Горизонтальна дорожня розмітка",
    titlePl: "Oznakowanie poziome",
    titleEn: "Horizontal road markings",
    sourceLabelUa: "Горизонтальні дорожні знаки",
    notesUa: "Нормалізовано як дорожня розмітка.",
  },
  {
    id: "traffic_lights_and_controller_signals",
    sortOrder: 2,
    titleUa: "Світлові сигнали та сигнали регулювальника",
    titlePl: "Sygnały świetlne i sygnały osoby kierującej ruchem",
    titleEn: "Traffic lights and controller signals",
    sourceLabelUa: "Світлові сигнали, сигнали регулювання дорожного руху",
  },
  {
    id: "external_lighting",
    sortOrder: 3,
    titleUa: "Використання зовнішніх світлових приладів",
    titlePl: "Używanie świateł zewnętrznych",
    titleEn: "Use of external lighting",
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
    titleUa: "Заборонні та наказові знаки",
    titlePl: "Znaki zakazu i nakazu",
    titleEn: "Prohibition and mandatory signs",
    sourceLabelUa: "Заборонні та наказові знаки",
  },
  {
    id: "information_direction_and_auxiliary_signs",
    sortOrder: 6,
    titleUa: "Інформаційні знаки, покажчики напрямків і міст, допоміжні таблички",
    titlePl: "Znaki informacyjne, kierunkowe i tabliczki",
    titleEn: "Information, direction and auxiliary signs",
    sourceLabelUa:
      "Інформаційні вертикальні покажчики, покажчики напрямків, вказівники міст, допоміжні покажчики",
  },
  {
    id: "right_of_way_entering_traffic_equal_intersections",
    sortOrder: 7,
    titleUa: "Перевага в русі, включення в рух, перехрестя рівнозначних доріг",
    titlePl: "Pierwszeństwo, włączanie się do ruchu i skrzyżowania równorzędne",
    titleEn: "Right of way, entering traffic and equal intersections",
    sourceLabelUa:
      "Перевага транспортних засобів, включення в рух, паралельні перехрестя",
  },
  {
    id: "lane_use_and_priority_signed_intersections",
    sortOrder: 8,
    titleUa: "Смуги руху та перехрестя зі знаками пріоритету",
    titlePl: "Pasy ruchu i skrzyżowania ze znakami pierwszeństwa",
    titleEn: "Lane use and priority-signed intersections",
    sourceLabelUa:
      "Смуга проїзду, перехрестя зі знаками, що вказують на перевагу",
  },
  {
    id: "priority_at_signalized_intersections",
    sortOrder: 9,
    titleUa: "Перевага на перехрестях зі світлофорами",
    titlePl: "Pierwszeństwo na skrzyżowaniach z sygnalizacją",
    titleEn: "Priority at signalized intersections",
    sourceLabelUa: "Перевага - перехрестя зі світлофорами",
  },
  {
    id: "regulated_intersections_and_public_transport_stops",
    sortOrder: 10,
    titleUa: "Регульовані перехрестя та зупинки громадського транспорту",
    titlePl: "Skrzyżowania kierowane ruchem i przystanki komunikacji",
    titleEn: "Regulated intersections and public transport stops",
    sourceLabelUa:
      "Смуга проїзду - перехрестя з регулюючим рухом, місця зупинок громадського транспорту",
  },
  {
    id: "vehicle_position_entry_exit_stopping_parking",
    sortOrder: 11,
    titleUa: "Розташування автомобіля на дорозі, в'їзд і виїзд, зупинка і стоянка",
    titlePl: "Położenie pojazdu, wjazd i wyjazd, zatrzymanie i postój",
    titleEn: "Vehicle position, entry and exit, stopping and parking",
    sourceLabelUa:
      "Положення автомобіля на дорозі, вʼїзд і виїзд, зупинка і стоянка",
  },
  {
    id: "lane_changes_and_direction",
    sortOrder: 12,
    titleUa: "Зміна смуги та напрямок руху",
    titlePl: "Zmiana pasa i kierunek jazdy",
    titleEn: "Lane changes and direction",
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
    titleUa: "Оминання, об'їзд і рух заднім ходом",
    titlePl: "Omijanie, wymijanie i cofanie",
    titleEn: "Passing, avoiding and reversing",
    sourceLabelUa: "Уникнення, обʼїзд, рух заднім ходом",
    notesUa: "Формулювання нормалізовано під дорожні маневри.",
  },
  {
    id: "special_caution",
    sortOrder: 15,
    titleUa: "Ситуації, що потребують особливої обережності",
    titlePl: "Szczególna ostrożność",
    titleEn: "Special caution",
    sourceLabelUa: "Будьте особливо обережні",
  },
  {
    id: "pedestrians_and_persons_with_disabilities",
    sortOrder: 16,
    titleUa: "Поведінка щодо пішоходів та осіб з інвалідністю",
    titlePl: "Piesi i osoby z niepełnosprawnościami",
    titleEn: "Pedestrians and persons with disabilities",
    sourceLabelUa: "Поведінка до пішоходів та людей з обмеженими можливостями",
  },
  {
    id: "cyclists_and_children",
    sortOrder: 17,
    titleUa: "Поведінка щодо велосипедистів і дітей",
    titlePl: "Rowerzyści i dzieci",
    titleEn: "Cyclists and children",
    sourceLabelUa: "Поведінка по відношенню до велосипедистів і дітей",
  },
  {
    id: "dropoff_vehicle_security_railway_crossings",
    sortOrder: 18,
    titleUa: "Висадка пасажирів, безпека автомобіля, залізничні переїзди",
    titlePl: "Wysadzanie pasażerów, zabezpieczenie pojazdu i przejazdy kolejowe",
    titleEn: "Passenger drop-off, vehicle security and railway crossings",
    sourceLabelUa: "Висадка, охорона автомобіля, залізничні переїзди",
  },
  {
    id: "breakdown_and_accident_response",
    sortOrder: 19,
    titleUa: "Поведінка в разі поломки або аварії",
    titlePl: "Awaria i wypadek",
    titleEn: "Breakdown and accident response",
    sourceLabelUa: "Поведінка в разі поломки або аварії",
  },
  {
    id: "perception_situation_assessment_reaction_time",
    sortOrder: 20,
    titleUa: "Сприйняття, оцінка ситуації, час реакції",
    titlePl: "Percepcja, ocena sytuacji i czas reakcji",
    titleEn: "Perception, situation assessment and reaction time",
    sourceLabelUa: "Сприйняття, оцінка ситуації, час реакції",
  },
  {
    id: "speed_limits",
    sortOrder: 21,
    titleUa: "Допустима швидкість транспортного засобу та обмеження",
    titlePl: "Dopuszczalne prędkości i ograniczenia",
    titleEn: "Speed limits",
    sourceLabelUa: "Допустима швидкість транспортного засобу, обмеження",
  },
  {
    id: "occupant_restraints_and_seating",
    sortOrder: 22,
    titleUa: "Обладнання автомобіля: ремені, підголівники, сидіння",
    titlePl: "Pasy, zagłówki i siedzenia",
    titleEn: "Seat belts, head restraints and seating",
    sourceLabelUa: "Обладнання автомобіля (ремні, підголівники, сидіння)",
  },
  {
    id: "following_distance_and_braking",
    sortOrder: 23,
    titleUa: "Відстань між автомобілями та гальмування",
    titlePl: "Odstęp i hamowanie",
    titleEn: "Following distance and braking",
    sourceLabelUa: "Відстань між автомобілями та гальмування",
  },
  {
    id: "risk_factors_weather_time_road_type",
    sortOrder: 24,
    titleUa: "Фактори ризику: погодні та дорожні умови, час доби, тип дороги",
    titlePl: "Czynniki ryzyka: pogoda, pora i rodzaj drogi",
    titleEn: "Risk factors: weather, time and road type",
    sourceLabelUa:
      "Фактори ризику (погодні та дорожні умови, час доби, тип доріг)",
  },
  {
    id: "driver_fields_of_view",
    sortOrder: 25,
    titleUa: "Різні поля зору водія",
    titlePl: "Pola widzenia kierowcy",
    titleEn: "Driver fields of view",
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
    titleUa: "Фактори безпеки транспортного засобу, вантажу та пасажирів",
    titlePl: "Bezpieczeństwo pojazdu, ładunku i pasażerów",
    titleEn: "Vehicle, cargo and passenger safety",
    sourceLabelUa:
      "Фактори безпеки, що стосуються транспортного засобу, вантажу та осіб, що перевозяться",
  },
  {
    id: "owner_insurance_and_required_documents",
    sortOrder: 28,
    titleUa: "Обов'язки власника транспортного засобу, страховка, необхідні документи",
    titlePl: "Obowiązki właściciela, ubezpieczenie i dokumenty",
    titleEn: "Owner duties, insurance and required documents",
    sourceLabelUa:
      "Обов'язки власника/власника транспортного засобу, страховка, необхідні документи",
  },
  {
    id: "tyre_tread_and_mechanical_safety",
    sortOrder: 29,
    titleUa: "Механічні аспекти безпеки дорожнього руху: шини та протектор",
    titlePl: "Opony, bieżnik i bezpieczeństwo mechaniczne",
    titleEn: "Tyres, tread and mechanical safety",
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

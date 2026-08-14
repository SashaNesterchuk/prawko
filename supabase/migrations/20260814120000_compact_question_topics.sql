-- Reduce the learner-facing topic catalog from 30 narrow topics to 15 broad
-- topics. Questions are reassigned in place; no rows are deleted.

begin;

-- Move retired sort positions out of the way before inserting the compact
-- catalog. Retired rows stay for historic foreign-key references.
update public.question_topic_catalog
set
  is_active = false,
  sort_order = sort_order + 1000
where id in (
  'horizontal_road_markings',
  'traffic_lights_and_controller_signals',
  'external_lighting',
  'warning_signs',
  'prohibition_and_mandatory_signs',
  'information_direction_and_auxiliary_signs',
  'right_of_way_entering_traffic_equal_intersections',
  'lane_use_and_priority_signed_intersections',
  'priority_at_signalized_intersections',
  'regulated_intersections_and_public_transport_stops',
  'vehicle_position_entry_exit_stopping_parking',
  'lane_changes_and_direction',
  'overtaking',
  'passing_avoiding_reversing',
  'special_caution',
  'pedestrians_and_persons_with_disabilities',
  'cyclists_and_children',
  'dropoff_vehicle_security_railway_crossings',
  'breakdown_and_accident_response',
  'perception_situation_assessment_reaction_time',
  'speed_limits',
  'occupant_restraints_and_seating',
  'following_distance_and_braking',
  'risk_factors_weather_time_road_type',
  'driver_fields_of_view',
  'driving_technique',
  'vehicle_cargo_and_passenger_safety',
  'owner_insurance_and_required_documents',
  'tyre_tread_and_mechanical_safety',
  'rescue_operations'
);

insert into public.question_topic_catalog (
  id,
  sort_order,
  title_ua,
  title_pl,
  title_en,
  source_label_ua,
  notes_ua,
  is_active
)
values
  (
    'road_markings_and_warning_signs',
    1,
    'Розмітка й попереджувальні знаки',
    'Oznakowanie i znaki ostrzegawcze',
    'Road markings and warning signs',
    'Горизонтальна розмітка та попереджувальні знаки',
    null,
    true
  ),
  (
    'road_signs_and_regulations',
    2,
    'Знаки та дорожні обмеження',
    'Znaki drogowe i ograniczenia',
    'Road signs and restrictions',
    'Заборонні, наказові, інформаційні та напрямні знаки',
    null,
    true
  ),
  (
    'traffic_control_and_lights',
    3,
    'Сигнали та регулювання руху',
    'Sygnalizacja i kierowanie ruchem',
    'Traffic control and lights',
    'Світлові сигнали та сигнали особи, що керує рухом',
    null,
    true
  ),
  (
    'right_of_way_and_intersections',
    4,
    'Перевага та перехрестя',
    'Pierwszeństwo i skrzyżowania',
    'Right of way and intersections',
    'Перевага, смуги руху та перехрестя',
    null,
    true
  ),
  (
    'road_position_lanes_and_parking',
    5,
    'Смуги, положення та паркування',
    'Pasy, pozycja i parkowanie',
    'Lanes, road position and parking',
    'Положення автомобіля, зміна смуги, зупинка і стоянка',
    null,
    true
  ),
  (
    'overtaking_and_maneuvers',
    6,
    'Обгін і маневри',
    'Wyprzedzanie i manewry',
    'Overtaking and maneuvers',
    'Обгін, об''їзд, уникнення та рух заднім ходом',
    null,
    true
  ),
  (
    'pedestrians_cyclists_and_children',
    7,
    'Пішоходи, велосипедисти й діти',
    'Piesi, rowerzyści i dzieci',
    'Pedestrians, cyclists and children',
    'Поведінка щодо пішоходів, велосипедистів, дітей і людей з інвалідністю',
    null,
    true
  ),
  (
    'railway_crossings_and_vehicle_security',
    8,
    'Переїзди та безпека автомобіля',
    'Przejazdy kolejowe i zabezpieczenie pojazdu',
    'Rail crossings and vehicle security',
    'Висадка пасажирів, захист автомобіля та залізничні переїзди',
    null,
    true
  ),
  (
    'vehicle_lighting_and_visibility',
    9,
    'Світло та оглядовість',
    'Oświetlenie i widoczność',
    'Vehicle lighting and visibility',
    'Зовнішнє освітлення та поле зору водія',
    null,
    true
  ),
  (
    'speed_distance_and_braking',
    10,
    'Швидкість, дистанція й гальмування',
    'Prędkość, odstęp i hamowanie',
    'Speed, distance and braking',
    'Обмеження швидкості, дистанція та гальмування',
    null,
    true
  ),
  (
    'safe_driving_and_hazard_awareness',
    11,
    'Безпечне водіння та ризики',
    'Bezpieczna jazda i zagrożenia',
    'Safe driving and hazards',
    'Особлива обережність, сприйняття, ризики й техніка водіння',
    null,
    true
  ),
  (
    'occupant_and_cargo_safety',
    12,
    'Безпека пасажирів і вантажу',
    'Bezpieczeństwo pasażerów i ładunku',
    'Occupant and cargo safety',
    'Ремені, сидіння, вантаж і безпека пасажирів',
    null,
    true
  ),
  (
    'vehicle_maintenance_and_tyres',
    13,
    'Технічний стан і шини',
    'Stan techniczny i opony',
    'Vehicle maintenance and tyres',
    'Механічна безпека, технічний стан і протектори шин',
    null,
    true
  ),
  (
    'documents_insurance_and_owner_responsibilities',
    14,
    'Документи, страхування та обов''язки',
    'Dokumenty, ubezpieczenie i obowiązki właściciela',
    'Documents, insurance and owner responsibilities',
    'Обов''язки власника, страхування та необхідні документи',
    null,
    true
  ),
  (
    'breakdowns_accidents_and_first_aid',
    15,
    'Аварії, поломки та допомога',
    'Awarie, wypadki i pomoc',
    'Breakdowns, accidents and first aid',
    'Дії у разі поломки, аварії та рятувальні роботи',
    null,
    true
  )
on conflict (id) do update
set
  sort_order = excluded.sort_order,
  title_ua = excluded.title_ua,
  title_pl = excluded.title_pl,
  title_en = excluded.title_en,
  source_label_ua = excluded.source_label_ua,
  notes_ua = excluded.notes_ua,
  is_active = true;

with topic_map (old_id, new_id) as (
  values
    ('horizontal_road_markings', 'road_markings_and_warning_signs'),
    ('traffic_lights_and_controller_signals', 'traffic_control_and_lights'),
    ('external_lighting', 'vehicle_lighting_and_visibility'),
    ('warning_signs', 'road_markings_and_warning_signs'),
    ('prohibition_and_mandatory_signs', 'road_signs_and_regulations'),
    ('information_direction_and_auxiliary_signs', 'road_signs_and_regulations'),
    ('right_of_way_entering_traffic_equal_intersections', 'right_of_way_and_intersections'),
    ('lane_use_and_priority_signed_intersections', 'right_of_way_and_intersections'),
    ('priority_at_signalized_intersections', 'right_of_way_and_intersections'),
    ('regulated_intersections_and_public_transport_stops', 'right_of_way_and_intersections'),
    ('vehicle_position_entry_exit_stopping_parking', 'road_position_lanes_and_parking'),
    ('lane_changes_and_direction', 'road_position_lanes_and_parking'),
    ('overtaking', 'overtaking_and_maneuvers'),
    ('passing_avoiding_reversing', 'overtaking_and_maneuvers'),
    ('special_caution', 'safe_driving_and_hazard_awareness'),
    ('pedestrians_and_persons_with_disabilities', 'pedestrians_cyclists_and_children'),
    ('cyclists_and_children', 'pedestrians_cyclists_and_children'),
    ('dropoff_vehicle_security_railway_crossings', 'railway_crossings_and_vehicle_security'),
    ('breakdown_and_accident_response', 'breakdowns_accidents_and_first_aid'),
    ('perception_situation_assessment_reaction_time', 'safe_driving_and_hazard_awareness'),
    ('speed_limits', 'speed_distance_and_braking'),
    ('occupant_restraints_and_seating', 'occupant_and_cargo_safety'),
    ('following_distance_and_braking', 'speed_distance_and_braking'),
    ('risk_factors_weather_time_road_type', 'safe_driving_and_hazard_awareness'),
    ('driver_fields_of_view', 'vehicle_lighting_and_visibility'),
    ('driving_technique', 'safe_driving_and_hazard_awareness'),
    ('vehicle_cargo_and_passenger_safety', 'occupant_and_cargo_safety'),
    ('owner_insurance_and_required_documents', 'documents_insurance_and_owner_responsibilities'),
    ('tyre_tread_and_mechanical_safety', 'vehicle_maintenance_and_tyres'),
    ('rescue_operations', 'breakdowns_accidents_and_first_aid')
)
update public.questions as question
set
  primary_topic_id = primary_map.new_id,
  topic_ids = array(
    select distinct coalesce(topic_map.new_id, old_topic.id)
    from unnest(question.topic_ids) as old_topic(id)
    left join topic_map on topic_map.old_id = old_topic.id
  )
from topic_map as primary_map
where question.primary_topic_id = primary_map.old_id;

with topic_map (old_id, new_id) as (
  values
    ('horizontal_road_markings', 'road_markings_and_warning_signs'),
    ('traffic_lights_and_controller_signals', 'traffic_control_and_lights'),
    ('external_lighting', 'vehicle_lighting_and_visibility'),
    ('warning_signs', 'road_markings_and_warning_signs'),
    ('prohibition_and_mandatory_signs', 'road_signs_and_regulations'),
    ('information_direction_and_auxiliary_signs', 'road_signs_and_regulations'),
    ('right_of_way_entering_traffic_equal_intersections', 'right_of_way_and_intersections'),
    ('lane_use_and_priority_signed_intersections', 'right_of_way_and_intersections'),
    ('priority_at_signalized_intersections', 'right_of_way_and_intersections'),
    ('regulated_intersections_and_public_transport_stops', 'right_of_way_and_intersections'),
    ('vehicle_position_entry_exit_stopping_parking', 'road_position_lanes_and_parking'),
    ('lane_changes_and_direction', 'road_position_lanes_and_parking'),
    ('overtaking', 'overtaking_and_maneuvers'),
    ('passing_avoiding_reversing', 'overtaking_and_maneuvers'),
    ('special_caution', 'safe_driving_and_hazard_awareness'),
    ('pedestrians_and_persons_with_disabilities', 'pedestrians_cyclists_and_children'),
    ('cyclists_and_children', 'pedestrians_cyclists_and_children'),
    ('dropoff_vehicle_security_railway_crossings', 'railway_crossings_and_vehicle_security'),
    ('breakdown_and_accident_response', 'breakdowns_accidents_and_first_aid'),
    ('perception_situation_assessment_reaction_time', 'safe_driving_and_hazard_awareness'),
    ('speed_limits', 'speed_distance_and_braking'),
    ('occupant_restraints_and_seating', 'occupant_and_cargo_safety'),
    ('following_distance_and_braking', 'speed_distance_and_braking'),
    ('risk_factors_weather_time_road_type', 'safe_driving_and_hazard_awareness'),
    ('driver_fields_of_view', 'vehicle_lighting_and_visibility'),
    ('driving_technique', 'safe_driving_and_hazard_awareness'),
    ('vehicle_cargo_and_passenger_safety', 'occupant_and_cargo_safety'),
    ('owner_insurance_and_required_documents', 'documents_insurance_and_owner_responsibilities'),
    ('tyre_tread_and_mechanical_safety', 'vehicle_maintenance_and_tyres'),
    ('rescue_operations', 'breakdowns_accidents_and_first_aid')
)
update public.study_plan_days as day
set focus_topic = topic_map.new_id
from topic_map
where day.focus_topic = topic_map.old_id;

with topic_map (old_id, new_id) as (
  values
    ('horizontal_road_markings', 'road_markings_and_warning_signs'),
    ('traffic_lights_and_controller_signals', 'traffic_control_and_lights'),
    ('external_lighting', 'vehicle_lighting_and_visibility'),
    ('warning_signs', 'road_markings_and_warning_signs'),
    ('prohibition_and_mandatory_signs', 'road_signs_and_regulations'),
    ('information_direction_and_auxiliary_signs', 'road_signs_and_regulations'),
    ('right_of_way_entering_traffic_equal_intersections', 'right_of_way_and_intersections'),
    ('lane_use_and_priority_signed_intersections', 'right_of_way_and_intersections'),
    ('priority_at_signalized_intersections', 'right_of_way_and_intersections'),
    ('regulated_intersections_and_public_transport_stops', 'right_of_way_and_intersections'),
    ('vehicle_position_entry_exit_stopping_parking', 'road_position_lanes_and_parking'),
    ('lane_changes_and_direction', 'road_position_lanes_and_parking'),
    ('overtaking', 'overtaking_and_maneuvers'),
    ('passing_avoiding_reversing', 'overtaking_and_maneuvers'),
    ('special_caution', 'safe_driving_and_hazard_awareness'),
    ('pedestrians_and_persons_with_disabilities', 'pedestrians_cyclists_and_children'),
    ('cyclists_and_children', 'pedestrians_cyclists_and_children'),
    ('dropoff_vehicle_security_railway_crossings', 'railway_crossings_and_vehicle_security'),
    ('breakdown_and_accident_response', 'breakdowns_accidents_and_first_aid'),
    ('perception_situation_assessment_reaction_time', 'safe_driving_and_hazard_awareness'),
    ('speed_limits', 'speed_distance_and_braking'),
    ('occupant_restraints_and_seating', 'occupant_and_cargo_safety'),
    ('following_distance_and_braking', 'speed_distance_and_braking'),
    ('risk_factors_weather_time_road_type', 'safe_driving_and_hazard_awareness'),
    ('driver_fields_of_view', 'vehicle_lighting_and_visibility'),
    ('driving_technique', 'safe_driving_and_hazard_awareness'),
    ('vehicle_cargo_and_passenger_safety', 'occupant_and_cargo_safety'),
    ('owner_insurance_and_required_documents', 'documents_insurance_and_owner_responsibilities'),
    ('tyre_tread_and_mechanical_safety', 'vehicle_maintenance_and_tyres'),
    ('rescue_operations', 'breakdowns_accidents_and_first_aid')
)
update public.study_plan_tasks as task
set topic_block = topic_map.new_id
from topic_map
where task.topic_block = topic_map.old_id;

commit;

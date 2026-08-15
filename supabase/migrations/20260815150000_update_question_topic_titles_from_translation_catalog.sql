-- Synchronize learner-facing topic titles with kategorii-perklad-final.md.
-- Question assignments are not changed.

begin;

do $$
declare
  v_updated_count integer;
begin
  with translations(id, title_ua, title_pl, title_en) as (
    values
      ('signs_signals', 'Знаки та сигнали', 'Znaki i sygnały drogowe', 'Signs & Signals'),
      ('intersections_priority', 'Перехрестя та пріоритет', 'Skrzyżowania i pierwszeństwo', 'Intersections & Right of Way'),
      ('driving_maneuvers', 'Керування та маневри', 'Jazda i manewry', 'Driving & Maneuvers'),
      ('speed_distance', 'Швидкість і дистанція', 'Prędkość i odstęp', 'Speed & Distance'),
      ('other_road_users', 'Вразливі учасники руху', 'Niechronieni uczestnicy ruchu', 'Vulnerable Road Users'),
      ('roads_zones_crossings', 'Дороги, зони та переїзди', 'Drogi, strefy i przejazdy', 'Roads, Zones & Rail Crossings'),
      ('vehicle_equipment', 'Транспортний засіб і обладнання', 'Pojazd i wyposażenie', 'Vehicle & Equipment'),
      ('attention_risks', 'Уважність і ризики', 'Uwaga i zagrożenia', 'Awareness & Hazards'),
      ('accidents_first_aid', 'ДТП і перша допомога', 'Wypadki i pierwsza pomoc', 'Accidents & First Aid'),
      ('transport', 'Перевезення', 'Przewóz i holowanie', 'Passengers & Cargo'),
      ('documents_responsibility', 'Документи та відповідальність', 'Dokumenty i obowiązki', 'Documents & Responsibility')
  )
  update public.question_topic_catalog as topic
  set
    title_ua = translations.title_ua,
    title_pl = translations.title_pl,
    title_en = translations.title_en
  from translations
  where topic.id = translations.id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 11 then
    raise exception
      'Expected to update 11 current topic titles, updated %.',
      v_updated_count;
  end if;
end
$$;

commit;

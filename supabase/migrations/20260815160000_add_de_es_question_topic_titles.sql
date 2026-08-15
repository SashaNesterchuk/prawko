-- Store and serve the German and Spanish topic titles from
-- kategorii-perklad-final.md. Question assignments remain unchanged.

begin;

alter table public.question_topic_catalog
  add column if not exists title_de text,
  add column if not exists title_es text;

do $$
declare
  v_updated_count integer;
begin
  with translations(id, title_de, title_es) as (
    values
      ('signs_signals', 'Verkehrszeichen und Signale', 'Señalización vial'),
      ('intersections_priority', 'Kreuzungen und Vorfahrt', 'Intersecciones y prioridad'),
      ('driving_maneuvers', 'Fahren und Manövrieren', 'Conducción y maniobras'),
      ('speed_distance', 'Geschwindigkeit und Abstand', 'Velocidad y distancia'),
      ('other_road_users', 'Ungeschützte Verkehrsteilnehmer', 'Usuarios vulnerables'),
      ('roads_zones_crossings', 'Straßen, Zonen und Bahnübergänge', 'Vías, zonas y pasos a nivel'),
      ('vehicle_equipment', 'Fahrzeug und Ausstattung', 'Vehículo y equipamiento'),
      ('attention_risks', 'Aufmerksamkeit und Gefahren', 'Atención y riesgos'),
      ('accidents_first_aid', 'Unfälle und Erste Hilfe', 'Accidentes y primeros auxilios'),
      ('transport', 'Personen- und Gütertransport', 'Pasajeros, carga y remolque'),
      ('documents_responsibility', 'Dokumente und Pflichten', 'Documentos y obligaciones')
  )
  update public.question_topic_catalog as topic
  set
    title_de = translations.title_de,
    title_es = translations.title_es
  from translations
  where topic.id = translations.id;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 11 then
    raise exception
      'Expected to update 11 German and Spanish topic titles, updated %.',
      v_updated_count;
  end if;
end
$$;

commit;

-- Add the three Category B questions newly present in the official 07/2026 catalog.
--
-- This migration is intentionally insert-only:
-- - Existing question rows are never updated, deactivated, or deleted.
-- - Re-running the SQL leaves already-present source IDs unchanged.
-- - Question 14108 reuses the existing delivery asset from equivalent question 13462.

begin;

do $$
declare
  v_existing_media_asset jsonb;
  v_present_count integer;
begin
  select media_asset
  into v_existing_media_asset
  from public.questions
  where question_source_id = '13462';

  if v_existing_media_asset is null then
    raise exception
      'Cannot add question 14108: source question 13462 has no reusable media asset.';
  end if;

  insert into public.questions (
    question_source_id,
    source_row_number,
    question_pl,
    question_ua,
    question_en,
    question_de,
    answer_type,
    correct_answer,
    option_a,
    option_b,
    option_c,
    option_a_ua,
    option_b_ua,
    option_c_ua,
    option_a_en,
    option_b_en,
    option_c_en,
    option_a_de,
    option_b_de,
    option_c_de,
    points,
    scope,
    categories,
    topic_block,
    difficulty_seed,
    has_media,
    is_active,
    primary_topic_id,
    topic_ids
  )
  values
    (
      '14064',
      3517,
      'Policjant zatrzyma wydane w kraju prawo jazdy za pokwitowaniem, w przypadku ujawnienia czynu polegającego na przewożeniu osób samochodem osobowym, w liczbie przekraczającej liczbę miejsc określoną w dowodzie rejestracyjnym o:',
      null,
      'A Police officer will retain a driving licence issued in the country against a receipt if proven that the driver is transporting persons in a passenger car in excess of the number of seats specified in the registration document by:',
      'Der Polizist behält den im Inland ausgestellten Führerschein gegen Quittung ein, falls er die Tat entdeckt, die auf dem Personentransport im PkW beruht, deren Anzahl die Anzahl der im Fahrzeugschein festgelegten Plätze um ... überschreitet.',
      'abc',
      'C',
      '1 osobę.',
      '2 osoby.',
      '3 osoby.',
      null,
      null,
      null,
      '1 person.',
      '2 persons.',
      '3 persons.',
      '1 Person.',
      '2 Personen.',
      '3 Personen.',
      2,
      'specialist',
      array['B'],
      'safety',
      8,
      false,
      true,
      'documents_responsibility',
      array['documents_responsibility']
    )
  on conflict (question_source_id) do nothing;

  insert into public.questions (
    question_source_id,
    source_row_number,
    question_pl,
    question_ua,
    question_en,
    question_de,
    answer_type,
    correct_answer,
    points,
    scope,
    categories,
    topic_block,
    difficulty_seed,
    has_media,
    is_active,
    primary_topic_id,
    topic_ids
  )
  values (
    '14107',
    3518,
    'Czy kierujący urządzeniem transportu osobistego może przejeżdżać wzdłuż po przejściu dla pieszych?',
    'Чи може особа, яка керує засобом індивідуальної мобільності (наприклад електросамокатом) проїжджати по пішохідному переходу вздовж нього?',
    'Is it permissible for someone using a personal transport device to cross along at a pedestrian crossing?',
    'Darf der Fahrer eines persönlichen Transportgerät einen Fußgängerüberweg entlang überqueren?',
    'boolean',
    'false',
    2,
    'base',
    array['A', 'B', 'C', 'D', 'T', 'AM', 'A1', 'A2', 'B1', 'C1', 'D1'],
    'pedestrians',
    73,
    false,
    true,
    'other_road_users',
    array['other_road_users']
  )
  on conflict (question_source_id) do nothing;

  insert into public.questions (
    question_source_id,
    source_row_number,
    question_pl,
    question_ua,
    question_en,
    question_de,
    answer_type,
    correct_answer,
    media_filename,
    media_type,
    points,
    scope,
    categories,
    topic_block,
    difficulty_seed,
    has_media,
    is_active,
    media_asset,
    primary_topic_id,
    topic_ids
  )
  values (
    '14108',
    3519,
    'Czy podanie numeru przejazdu kolejowego operatorowi telefonu 112 wskaże dokładnie położenie przejazdu kolejowego, na którym pojazd uległ awarii?',
    'Чи дозволить повідомлення номера залізничного переїзду оператору служби 112 точно визначити місцезнаходження переїзду, на якому транспортний засіб вийшов з ладу?',
    'Will giving the level crossing number to the 112 operator help pinpoint the exact location of the level crossing where the vehicle has broken down?',
    'Wird durch die Angabe der Bahnübergangsnummer an den 112-Mitarbeiter der genaue Standort des Bahnübergangs angezeigt, an dem das Fahrzeug eine Panne hatte?',
    'boolean',
    'true',
    'MW 18(159).jpg',
    'image',
    3,
    'base',
    array['A', 'B', 'C', 'D', 'T', 'AM', 'A1', 'A2', 'B1', 'C1', 'D1'],
    'technical',
    91,
    true,
    true,
    v_existing_media_asset,
    'roads_zones_crossings',
    array['roads_zones_crossings']
  )
  on conflict (question_source_id) do nothing;

  select count(*)
  into v_present_count
  from public.questions
  where question_source_id in ('14064', '14107', '14108');

  if v_present_count <> 3 then
    raise exception
      'Expected all three official catalog questions after insert, found %.',
      v_present_count;
  end if;
end
$$;

commit;

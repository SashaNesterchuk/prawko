import type { QuestionDeliveryAsset } from "@prawko/schemas";

import type {
  LocalQuestion,
  LocalizedQuestionText,
  QuestionChoice,
  QuestionMedia,
} from "./types";

const txt = (
  pl: string,
  ua: string,
  en: string,
  de: string = en
): LocalizedQuestionText => ({
  pl,
  ua,
  en,
  de,
});

const choice = (
  id: QuestionChoice["id"],
  pl: string,
  ua: string,
  en: string,
  de: string = en
): QuestionChoice => ({
  id,
  text: txt(pl, ua, en, de),
});

const deliveryAsset = ({
  mediaKey,
  mediaType,
  originalFilename,
  posterStoragePath,
  sourceKind = "primary",
  storageBucket,
  storagePath,
}: {
  mediaKey: string;
  mediaType: "image" | "video";
  originalFilename: string;
  posterStoragePath?: string;
  sourceKind?: "primary" | "pjm_question" | "pjm_answer";
  storageBucket: "question-images" | "question-videos" | "question-posters" | "question-pjm";
  storagePath: string;
}): QuestionDeliveryAsset => ({
  mediaKey,
  sourceKind,
  mediaType,
  originalFilename,
  resolvedFilename: originalFilename,
  matchStrategy: "exact",
  storageBucket,
  storagePath,
  posterStorageBucket: posterStoragePath ? "question-posters" : null,
  posterStoragePath: posterStoragePath ?? null,
});

const media = ({
  asset,
  pjm,
  type,
}: {
  asset: QuestionDeliveryAsset;
  pjm?: QuestionMedia["pjm"];
  type: "image" | "video";
}): QuestionMedia => ({
  type,
  asset,
  pjm: pjm ?? null,
});

export const MOCK_QUESTION_BANK: LocalQuestion[] = [
  {
    id: "b-signs-001",
    sourceRowNumber: 1,
    prompt: txt(
      "Na ilustracji widzisz trojkat ostrzegawczy z dziecmi. Co oznacza ten znak?",
      "На ілюстрації бачиш попереджувальний трикутник з дітьми. Що означає цей знак?",
      "You see a warning triangle with children. What does this sign mean?"
    ),
    explanation: txt(
      "Ten znak ostrzega o miejscu, gdzie dzieci moga nagle wejsc na jezdnie, dlatego trzeba zachowac szczegolna ostroznosc.",
      "Цей знак попереджає про місце, де діти можуть раптово вийти на дорогу, тому потрібно бути особливо уважним.",
      "This sign warns about a place where children may enter the road unexpectedly, so you should be extra cautious."
    ),
    answerType: "abc",
    correctAnswer: "A",
    choices: [
      choice(
        "A",
        "Miejsce czestego przechodzenia dzieci",
        "Місце частого переходу дітей",
        "An area where children often cross"
      ),
      choice(
        "B",
        "Przejscie dla pieszych",
        "Пішохідний перехід",
        "A pedestrian crossing"
      ),
      choice("C", "Roboty drogowe", "Дорожні роботи", "Road works"),
    ],
    media: media({
      type: "image",
      asset: deliveryAsset({
        mediaKey: "primary-signs-001",
        mediaType: "image",
        originalFilename: "mock-sign-children.jpg",
        storageBucket: "question-images",
        storagePath: "primary/mock-sign-children.jpg",
      }),
      pjm: {
        questionAsset: deliveryAsset({
          mediaKey: "pjm-signs-001-question",
          mediaType: "video",
          originalFilename: "mock-signs-001-question.wmv",
          sourceKind: "pjm_question",
          storageBucket: "question-pjm",
          storagePath: "question/mock-signs-001-question.mp4",
          posterStoragePath: "pjm-question/mock-signs-001-question.jpg",
        }),
        answerAssets: {
          A: deliveryAsset({
            mediaKey: "pjm-signs-001-answer-a",
            mediaType: "video",
            originalFilename: "mock-signs-001-answer-a.wmv",
            sourceKind: "pjm_answer",
            storageBucket: "question-pjm",
            storagePath: "answer/mock-signs-001-answer-a.mp4",
            posterStoragePath: "pjm-answer/mock-signs-001-answer-a.jpg",
          }),
          B: deliveryAsset({
            mediaKey: "pjm-signs-001-answer-b",
            mediaType: "video",
            originalFilename: "mock-signs-001-answer-b.wmv",
            sourceKind: "pjm_answer",
            storageBucket: "question-pjm",
            storagePath: "answer/mock-signs-001-answer-b.mp4",
            posterStoragePath: "pjm-answer/mock-signs-001-answer-b.jpg",
          }),
          C: deliveryAsset({
            mediaKey: "pjm-signs-001-answer-c",
            mediaType: "video",
            originalFilename: "mock-signs-001-answer-c.wmv",
            sourceKind: "pjm_answer",
            storageBucket: "question-pjm",
            storagePath: "answer/mock-signs-001-answer-c.mp4",
            posterStoragePath: "pjm-answer/mock-signs-001-answer-c.jpg",
          }),
        },
      },
    }),
    points: 2,
    scope: "base",
    topicBlock: "signs",
    difficultySeed: 41,
  },
  {
    id: "b-signs-002",
    sourceRowNumber: 2,
    prompt: txt(
      "Niebieski okragly znak z biala strzalka w prawo oznacza nakaz jazdy w prawo.",
      "Синій круглий знак з білою стрілкою праворуч означає обов'язковий рух праворуч.",
      "A blue circular sign with a white arrow to the right means mandatory driving to the right."
    ),
    explanation: txt(
      "Niebieskie okragle znaki nakazu wskazuja obowiazkowy kierunek lub sposob jazdy.",
      "Сині круглі наказові знаки показують обов'язковий напрямок або спосіб руху.",
      "Blue circular mandatory signs indicate a required direction or driving behavior."
    ),
    answerType: "boolean",
    correctAnswer: "true",
    media: media({
      type: "image",
      asset: deliveryAsset({
        mediaKey: "primary-signs-002",
        mediaType: "image",
        originalFilename: "mock-mandatory-right.jpg",
        storageBucket: "question-images",
        storagePath: "primary/mock-mandatory-right.jpg",
      }),
    }),
    points: 1,
    scope: "base",
    topicBlock: "signs",
    difficultySeed: 18,
  },
  {
    id: "b-intersections-001",
    sourceRowNumber: 3,
    prompt: txt(
      "Dojezdzasz do skrzyzowania, a na Twojej drodze jest zolty romb. Co to oznacza?",
      "Ти під'їжджаєш до перехрестя, а на твоїй дорозі є жовтий ромб. Що це означає?",
      "You approach an intersection and there is a yellow diamond sign on your road. What does it mean?"
    ),
    explanation: txt(
      "Zolty romb oznacza droge z pierwszenstwem, wiec to Ty masz pierwszenstwo wobec drog podporzadkowanych.",
      "Жовтий ромб означає головну дорогу, тому ти маєш пріоритет над другорядними дорогами.",
      "The yellow diamond means you are on the priority road, so you have priority over vehicles coming from subordinate roads."
    ),
    answerType: "abc",
    correctAnswer: "A",
    choices: [
      choice(
        "A",
        "Jedziesz droga z pierwszenstwem",
        "Ти їдеш головною дорогою",
        "You are on the priority road"
      ),
      choice(
        "B",
        "Musisz ustapic pojazdom z prawej",
        "Треба дати дорогу транспорту праворуч",
        "You must yield to vehicles from the right"
      ),
      choice(
        "C",
        "Musisz zatrzymac sie przed wjazdem",
        "Потрібно повністю зупинитися перед в'їздом",
        "You must stop before entering"
      ),
    ],
    media: media({
      type: "image",
      asset: deliveryAsset({
        mediaKey: "primary-intersections-001",
        mediaType: "image",
        originalFilename: "mock-priority-road.jpg",
        storageBucket: "question-images",
        storagePath: "primary/mock-priority-road.jpg",
      }),
    }),
    points: 2,
    scope: "base",
    topicBlock: "intersections",
    difficultySeed: 54,
  },
  {
    id: "b-intersections-002",
    sourceRowNumber: 4,
    prompt: txt(
      "Na skrzyzowaniu rownorzednym bez znakow ustapiasz pojazdom nadjezdzajacym z prawej strony.",
      "На рівнозначному перехресті без знаків ти даєш дорогу транспортним засобам праворуч.",
      "At an equal intersection without signs, you yield to vehicles coming from the right."
    ),
    explanation: txt(
      "Na skrzyzowaniu rownorzednym obowiazuje zasada prawej reki, jesli znaki nie mowia inaczej.",
      "На рівнозначному перехресті діє правило правої руки, якщо знаки не вказують інакше.",
      "At an equal intersection, the right-hand rule applies unless signs indicate otherwise."
    ),
    answerType: "boolean",
    correctAnswer: "true",
    points: 2,
    scope: "base",
    topicBlock: "intersections",
    difficultySeed: 22,
  },
  {
    id: "b-overtaking-001",
    sourceRowNumber: 5,
    prompt: txt(
      "Wyprzedzanie bezposrednio przed przejsciem dla pieszych jest dozwolone, jesli na przejsciu nikogo nie ma.",
      "Обгін безпосередньо перед пішохідним переходом дозволений, якщо на ньому нікого немає.",
      "Overtaking directly before a pedestrian crossing is allowed if no pedestrian is on it."
    ),
    explanation: txt(
      "To falsz. Wyprzedzanie przed przejsciem dla pieszych jest co do zasady zabronione, bo ogranicza widocznosc i zwieksza ryzyko.",
      "Це неправда. Обгін перед пішохідним переходом зазвичай заборонений, бо зменшує огляд і підвищує ризик.",
      "This is false. Overtaking before a pedestrian crossing is generally prohibited because it reduces visibility and raises risk."
    ),
    answerType: "boolean",
    correctAnswer: "false",
    media: media({
      type: "video",
      asset: deliveryAsset({
        mediaKey: "primary-overtaking-001",
        mediaType: "video",
        originalFilename: "mock-overtaking-crossing.wmv",
        storageBucket: "question-videos",
        storagePath: "primary/mock-overtaking-crossing.mp4",
        posterStoragePath: "primary/mock-overtaking-crossing.jpg",
      }),
    }),
    points: 3,
    scope: "base",
    topicBlock: "overtaking",
    difficultySeed: 73,
  },
  {
    id: "b-overtaking-002",
    sourceRowNumber: 6,
    prompt: txt(
      "Co powinienes sprawdzic przed rozpoczeciem wyprzedzania?",
      "Що треба перевірити перед початком обгону?",
      "What should you check before starting an overtake?"
    ),
    explanation: txt(
      "Przed wyprzedzaniem trzeba upewnic sie, ze pas i odcinek drogi przed Tobą sa wystarczajaco widoczne i wolne.",
      "Перед обгоном треба переконатися, що смуга і відрізок дороги попереду достатньо видимі та вільні.",
      "Before overtaking, you must make sure the lane and stretch of road ahead are clearly visible and free."
    ),
    answerType: "abc",
    correctAnswer: "B",
    choices: [
      choice(
        "A",
        "Tylko czy wlaczyles kierunkowskaz",
        "Лише чи ввімкнув поворотник",
        "Only whether your turn signal is on"
      ),
      choice(
        "B",
        "Czy masz wystarczajaca widocznosc i wolna droge",
        "Чи достатня видимість і вільна дорога попереду",
        "Whether visibility is sufficient and the road ahead is clear"
      ),
      choice(
        "C",
        "Tylko aktualna predkosc na liczniku",
        "Лише поточну швидкість на спідометрі",
        "Only your current speed on the speedometer"
      ),
    ],
    points: 2,
    scope: "base",
    topicBlock: "overtaking",
    difficultySeed: 37,
  },
  {
    id: "b-pedestrians-001",
    sourceRowNumber: 7,
    prompt: txt(
      "Pieszy wszedl na oznakowane przejscie. Co powinienes zrobic?",
      "Пішохід уже ступив на позначений перехід. Що ти повинен зробити?",
      "A pedestrian has stepped onto a marked crossing. What should you do?"
    ),
    explanation: txt(
      "Gdy pieszy jest na przejsciu, kierowca ma obowiazek zatrzymac sie i pozwolic mu bezpiecznie przejsc.",
      "Коли пішохід уже на переході, водій повинен зупинитися і дати йому безпечно пройти.",
      "When a pedestrian is on the crossing, the driver must stop and let the pedestrian pass safely."
    ),
    answerType: "abc",
    correctAnswer: "B",
    choices: [
      choice(
        "A",
        "Przyspieszyc, zeby szybciej opuscic przejscie",
        "Прискоритись, щоб швидше проїхати перехід",
        "Accelerate to clear the crossing faster"
      ),
      choice(
        "B",
        "Zatrzymac sie i przepuscic pieszego",
        "Зупинитися і пропустити пішохода",
        "Stop and let the pedestrian pass"
      ),
      choice(
        "C",
        "Zatrabic i jechac dalej",
        "Посигналити і продовжити рух",
        "Honk and keep driving"
      ),
    ],
    media: media({
      type: "video",
      asset: deliveryAsset({
        mediaKey: "primary-pedestrians-001",
        mediaType: "video",
        originalFilename: "mock-pedestrian-crossing.wmv",
        storageBucket: "question-videos",
        storagePath: "primary/mock-pedestrian-crossing.mp4",
        posterStoragePath: "primary/mock-pedestrian-crossing.jpg",
      }),
    }),
    points: 3,
    scope: "base",
    topicBlock: "pedestrians",
    difficultySeed: 67,
  },
  {
    id: "b-pedestrians-002",
    sourceRowNumber: 8,
    prompt: txt(
      "Zblizajac sie do przejscia dla pieszych, powinienes zmniejszyc predkosc i byc gotowym do zatrzymania.",
      "Наближаючись до пішохідного переходу, треба зменшити швидкість і бути готовим зупинитися.",
      "When approaching a pedestrian crossing, you should reduce speed and be ready to stop."
    ),
    explanation: txt(
      "To prawda. Samo zblizanie sie do przejscia wymaga wiekszej uwagi, nawet jesli jeszcze nie widzisz pieszego na pasach.",
      "Це правда. Сам під'їзд до переходу вимагає підвищеної уваги, навіть якщо пішохода на ньому ще не видно.",
      "This is true. Simply approaching a crossing requires more caution even if no pedestrian is on it yet."
    ),
    answerType: "boolean",
    correctAnswer: "true",
    points: 2,
    scope: "base",
    topicBlock: "pedestrians",
    difficultySeed: 29,
  },
  {
    id: "b-first-aid-001",
    sourceRowNumber: 9,
    prompt: txt(
      "Po zabezpieczeniu miejsca zdarzenia jaki numer alarmowy mozesz wybrac w Polsce?",
      "Після убезпечення місця події який номер екстреної допомоги можна набрати в Польщі?",
      "After securing the scene, which emergency number can you call in Poland?"
    ),
    explanation: txt(
      "Numer 112 jest ogolnym numerem alarmowym i pozwala wezwac odpowiednie sluzby.",
      "Номер 112 є загальним номером екстреної допомоги і дозволяє викликати потрібні служби.",
      "112 is the general emergency number and connects you to the right emergency service."
    ),
    answerType: "abc",
    correctAnswer: "A",
    choices: [
      choice("A", "112", "112", "112"),
      choice("B", "991", "991", "991"),
      choice("C", "997", "997", "997"),
    ],
    points: 1,
    scope: "specialist",
    topicBlock: "first_aid",
    difficultySeed: 16,
  },
  {
    id: "b-first-aid-002",
    sourceRowNumber: 10,
    prompt: txt(
      "Osobe nieprzytomna, ale oddychajaca, nalezy ulozyc w pozycji bocznej bezpiecznej.",
      "Людину без свідомості, але з диханням, треба покласти у стабільне бокове положення.",
      "An unconscious but breathing person should be placed in the recovery position."
    ),
    explanation: txt(
      "Pozycja boczna bezpieczna pomaga utrzymac droznosc drog oddechowych do czasu przyjazdu pomocy.",
      "Стабільне бокове положення допомагає зберегти прохідність дихальних шляхів до приїзду допомоги.",
      "The recovery position helps keep the airway open until help arrives."
    ),
    answerType: "boolean",
    correctAnswer: "true",
    points: 2,
    scope: "specialist",
    topicBlock: "first_aid",
    difficultySeed: 34,
  },
  {
    id: "b-priority-001",
    sourceRowNumber: 11,
    prompt: txt(
      "Gdy zbliza sie pojazd uprzywilejowany z niebieskimi swiatlami i sygnalem dzwiekowym, musisz ulatwic mu przejazd.",
      "Коли наближається спецтранспорт із синіми маячками та звуковим сигналом, ти повинен дати йому проїхати.",
      "When an emergency vehicle approaches with blue lights and a siren, you must facilitate its passage."
    ),
    explanation: txt(
      "To prawda. Kierowca ma obowiazek niezwlocznie stworzyc warunki do bezpiecznego przejazdu pojazdu uprzywilejowanego.",
      "Це правда. Водій зобов'язаний негайно створити умови для безпечного проїзду спецтранспорту.",
      "This is true. A driver must immediately create safe space for an emergency vehicle to pass."
    ),
    answerType: "boolean",
    correctAnswer: "true",
    media: media({
      type: "video",
      asset: deliveryAsset({
        mediaKey: "primary-priority-001",
        mediaType: "video",
        originalFilename: "mock-emergency-vehicle.wmv",
        storageBucket: "question-videos",
        storagePath: "primary/mock-emergency-vehicle.mp4",
        posterStoragePath: "primary/mock-emergency-vehicle.jpg",
      }),
    }),
    points: 2,
    scope: "base",
    topicBlock: "priority",
    difficultySeed: 46,
  },
  {
    id: "b-priority-002",
    sourceRowNumber: 12,
    prompt: txt(
      "Czego wymaga znak STOP?",
      "Що вимагає знак STOP?",
      "What does a STOP sign require?"
    ),
    explanation: txt(
      "Znak STOP wymaga pelnego zatrzymania i upewnienia sie, ze mozna bezpiecznie ruszyc dalej.",
      "Знак STOP вимагає повної зупинки і переконання, що можна безпечно продовжити рух.",
      "A STOP sign requires a full stop and a check that it is safe to proceed."
    ),
    answerType: "abc",
    correctAnswer: "B",
    choices: [
      choice(
        "A",
        "Wystarczy zwolnic",
        "Достатньо просто зменшити швидкість",
        "It is enough to slow down"
      ),
      choice(
        "B",
        "Pelnego zatrzymania i ustapienia pierwszenstwa",
        "Повної зупинки і надання переваги",
        "A full stop and yielding where required"
      ),
      choice(
        "C",
        "Mozesz jechac dalej, jesli nikogo nie widzisz",
        "Можна їхати далі, якщо нікого не видно",
        "You may continue if you do not see anyone"
      ),
    ],
    points: 3,
    scope: "base",
    topicBlock: "priority",
    difficultySeed: 78,
  },
  {
    id: "b-safety-001",
    sourceRowNumber: 13,
    prompt: txt(
      "Mokra nawierzchnia moze wydluzyc droge hamowania.",
      "Мокре покриття може збільшити гальмівний шлях.",
      "A wet road can increase braking distance."
    ),
    explanation: txt(
      "To prawda. Gorsza przyczepnosc oznacza, ze auto potrzebuje wiecej czasu i miejsca, aby sie zatrzymac.",
      "Це правда. Менше зчеплення означає, що авто потребує більше часу і відстані для зупинки.",
      "This is true. Reduced grip means the car needs more time and distance to stop."
    ),
    answerType: "boolean",
    correctAnswer: "true",
    points: 1,
    scope: "base",
    topicBlock: "safety",
    difficultySeed: 24,
  },
  {
    id: "b-safety-002",
    sourceRowNumber: 14,
    prompt: txt(
      "Co jest najbezpieczniejsza pierwsza reakcja, gdy samochod zaczyna wpadac w poslizg?",
      "Яка найправильніша перша реакція, якщо авто починає входити в занос?",
      "What is the safest first reaction if your car starts to skid?"
    ),
    explanation: txt(
      "Najwazniejsze jest zachowanie spokoju i plynne zmniejszenie predkosci. Gwałtowne ruchy kierownica lub ostre hamowanie pogarszaja sytuacje.",
      "Найважливіше зберігати спокій і плавно зменшувати швидкість. Різкі рухи кермом або жорстке гальмування погіршують ситуацію.",
      "The safest first step is to stay calm and reduce speed smoothly. Sharp steering or hard braking can make the skid worse."
    ),
    answerType: "abc",
    correctAnswer: "B",
    choices: [
      choice(
        "A",
        "Mocno zahamowac i ostro skrecic",
        "Різко загальмувати і сильно повернути кермо",
        "Brake hard and steer sharply"
      ),
      choice(
        "B",
        "Zachowac spokoj i plynnie zmniejszyc predkosc",
        "Зберігати спокій і плавно зменшувати швидкість",
        "Stay calm and reduce speed smoothly"
      ),
      choice(
        "C",
        "Wylaczyc silnik",
        "Вимкнути двигун",
        "Turn off the engine"
      ),
    ],
    points: 3,
    scope: "specialist",
    topicBlock: "safety",
    difficultySeed: 69,
  },
  {
    id: "b-technical-001",
    sourceRowNumber: 15,
    prompt: txt(
      "Czerwona kontrolka cisnienia oleju oznacza, ze trzeba zatrzymac pojazd i sprawdzic silnik, gdy tylko bedzie to bezpieczne.",
      "Червона лампа тиску масла означає, що треба зупинити авто і перевірити двигун, щойно це буде безпечно.",
      "The red oil pressure warning light means you should stop the vehicle and check the engine as soon as it is safe."
    ),
    explanation: txt(
      "To prawda. Jazda z takim ostrzezeniem moze doprowadzic do powaznego uszkodzenia silnika.",
      "Це правда. Рух з таким попередженням може призвести до серйозного пошкодження двигуна.",
      "This is true. Continuing to drive with that warning can cause serious engine damage."
    ),
    answerType: "boolean",
    correctAnswer: "true",
    media: media({
      type: "image",
      asset: deliveryAsset({
        mediaKey: "primary-technical-001",
        mediaType: "image",
        originalFilename: "mock-oil-warning.jpg",
        storageBucket: "question-images",
        storagePath: "primary/mock-oil-warning.jpg",
      }),
    }),
    points: 2,
    scope: "specialist",
    topicBlock: "technical",
    difficultySeed: 58,
  },
  {
    id: "b-technical-002",
    sourceRowNumber: 16,
    prompt: txt(
      "Niskie cisnienie w oponach zwykle powoduje:",
      "Низький тиск у шинах зазвичай спричиняє:",
      "Low tire pressure usually causes:"
    ),
    explanation: txt(
      "Zbyt niskie cisnienie pogarsza stabilnosc auta, wydluza droge hamowania i moze zwiekszyc zuzycie paliwa.",
      "Занадто низький тиск погіршує стабільність авто, збільшує гальмівний шлях і може підвищити витрату пального.",
      "Pressure that is too low reduces stability, increases braking distance, and can raise fuel consumption."
    ),
    answerType: "abc",
    correctAnswer: "B",
    choices: [
      choice(
        "A",
        "Lepsza przyczepnosc na zakretach",
        "Краще зчеплення в поворотах",
        "Better grip in corners"
      ),
      choice(
        "B",
        "Dluzsza droge hamowania i gorsza stabilnosc",
        "Довший гальмівний шлях і гіршу стабільність",
        "Longer braking distance and worse stability"
      ),
      choice(
        "C",
        "Mniejsze zuzycie paliwa",
        "Меншу витрату пального",
        "Lower fuel consumption"
      ),
    ],
    points: 2,
    scope: "specialist",
    topicBlock: "technical",
    difficultySeed: 63,
  },
];

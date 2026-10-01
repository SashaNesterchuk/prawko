type RoadmapSectionCopy = {
  title: string;
  steps: string[];
};

export type RoadmapCopy = {
  unlockTitle: string;
  unlockBody: string;
  unlockCta: string;
  perkLifetime: string;
  perkTopics: string;
  perkPrice: string;
  ratingTitle: string;
  ratingNo: string;
  ratingYes: string;
  finalStepEyebrow: string;
  finalStepTitle: string;
  finalStepBadge: string;
  pl: RoadmapSectionCopy[];
  cz: RoadmapSectionCopy[];
  sk: RoadmapSectionCopy[];
};

export const roadmapCopyEn: RoadmapCopy = {
  unlockTitle: "Unlock the full roadmap",
  unlockBody: "Get access to all topics, practice tests and more. Pay once, use forever.",
  unlockCta: "Unlock now",
  perkLifetime: "Lifetime access",
  perkTopics: "All topics and practice tests",
  perkPrice: "Cheaper than competitors",
  ratingTitle: "Enjoying Prawko?",
  ratingNo: "No",
  ratingYes: "Yes",
  finalStepEyebrow: "Final step",
  finalStepTitle: "Exam simulator",
  finalStepBadge: "{{count}} questions",
  pl: [
    {
      title: "Signs and signals",
      steps: [
        "Traffic lights",
        "Warning signs",
        "Prohibitions and orders",
        "Priority signs",
        "Lines and road markings",
        "Zones and rail crossings",
        "Left turn",
        "Turning and U-turns",
        "Signs in traffic situations",
      ],
    },
    {
      title: "Priority at intersections",
      steps: [
        "Equal intersections",
        "Priority when turning left",
        "Trams and right turns",
        "Priority when going straight",
        "Priority road",
        "Entering an intersection",
      ],
    },
    {
      title: "Road maneuvers",
      steps: [
        "Overtaking on the right",
        "Safe overtaking",
        "Choosing a lane",
        "Changing lanes",
        "Turning and U-turns",
        "Stopping and parking",
        "Reversing and joining traffic",
        "Correct driving path",
      ],
    },
    {
      title: "Speed and road users",
      steps: [
        "Speed limits",
        "Speed in a built-up area",
        "Safe gap and braking",
        "Pedestrians on a crossing",
        "Pedestrians off the crossing",
        "Cyclists",
        "Scooters, children and others",
      ],
    },
    {
      title: "Motorways, crossings and accidents",
      steps: [
        "Rail crossings",
        "Motorways, tunnels and zones",
        "First aid",
        "What to do after an accident",
      ],
    },
    {
      title: "The car and driver duties",
      steps: [
        "Dipped and main beams",
        "Other lights",
        "Indicators",
        "Horn",
        "Tyres and brakes",
        "Vehicle condition",
        "Seat belts",
        "Towing and load",
        "Driving licence and documents",
        "Roadside check",
      ],
    },
    {
      title: "Safe driving and hazards",
      steps: [
        "Alcohol, fatigue and medicines",
        "Weather and visibility",
        "Special care",
        "Spotting hazards",
      ],
    },
    {
      title: "Exam preparation",
      steps: ["Mixed test 1", "Mixed test 2", "Practice exam"],
    },
  ],
  cz: [
    {
      title: "Signs and signals",
      steps: [
        "Traffic lights and a police officer",
        "Prohibitions, priority and speed",
        "Warning signs",
        "A sign in a traffic situation",
        "What the signs mean",
        "Signs in practice",
      ],
    },
    {
      title: "Priority at intersections",
      steps: [
        "Priority and order of passage",
        "Crossings, cyclists and turns",
        "Intersections",
        "Passing through an intersection",
      ],
    },
    {
      title: "Driving and maneuvers",
      steps: ["Overtaking, lanes and signals", "Stopping and parking", "Driving in traffic"],
    },
    {
      title: "Safe driving and other road users",
      steps: [
        "Pedestrians, cyclists and children",
        "Other road users",
        "Speed and distance",
        "Alcohol, fatigue and motorcycles",
        "Defensive driving",
      ],
    },
    {
      title: "Vehicle, documents and accidents",
      steps: [
        "Load and trailer",
        "Lights, tyres and condition",
        "Vehicle equipment",
        "Licence categories",
        "Driving licence",
        "Driver duties",
        "First aid",
        "Traffic accident",
      ],
    },
    {
      title: "Exam preparation",
      steps: ["Mixed test 1", "Mixed test 2", "Practice test"],
    },
  ],
  sk: [
    {
      title: "Road traffic rules",
      steps: [
        "Stopping and parking",
        "A police officer and signals",
        "Overtaking, pedestrians and cyclists",
        "Turning and lanes",
        "Railway and motorway",
        "Equipment and vehicle markings",
        "Lights and basic terms",
        "Driver duties",
        "Prohibitions in traffic",
        "Orders in traffic",
      ],
    },
    {
      title: "Signs and traffic devices",
      steps: [
        "Prohibitory and warning signs",
        "What the symbols mean",
        "What a sign marks",
        "Vertical traffic signs",
      ],
    },
    {
      title: "Priority at intersections",
      steps: [
        "Speed limits",
        "Priority and restrictions",
        "Order of passage",
        "Passing through an intersection",
      ],
    },
    {
      title: "Safe driving",
      steps: ["Alcohol, skids and weather", "Risky situations", "Safe decisions"],
    },
    {
      title: "Vehicle and its condition",
      steps: [
        "Warning lights and the clutch",
        "Controlling the vehicle",
        "Condition and equipment",
        "Construction and maintenance",
      ],
    },
    {
      title: "Documents and accidents",
      steps: ["Documents and the licence", "Duties at an accident"],
    },
    {
      title: "Exam preparation",
      steps: ["Mixed test 1", "Mixed test 2", "Practice test"],
    },
  ],
};

export const roadmapCopyUa: RoadmapCopy = {
  unlockTitle: "Відкрий увесь шлях",
  unlockBody: "Усі теми, пробні тести й інше. Одна оплата — назавжди.",
  unlockCta: "Відкрити",
  perkLifetime: "Доступ назавжди",
  perkTopics: "Усі теми і пробні тести",
  perkPrice: "Дешевше за конкурентів",
  ratingTitle: "Подобається Prawko?",
  ratingNo: "Ні",
  ratingYes: "Так",
  finalStepEyebrow: "Фінальний крок",
  finalStepTitle: "Симулятор іспиту",
  finalStepBadge: "{{count}} питань",
  pl: [
    {
      title: "Знаки та сигнали",
      steps: [
        "Світлофори",
        "Попереджувальні знаки",
        "Заборони та накази",
        "Знаки пріоритету",
        "Лінії та розмітка",
        "Зони та залізничні переїзди",
        "Поворот ліворуч",
        "Поворот і розворот",
        "Знаки в дорожніх ситуаціях",
      ],
    },
    {
      title: "Пріоритет на перехрестях",
      steps: [
        "Рівнозначні перехрестя",
        "Пріоритет при повороті ліворуч",
        "Трамваї та поворот праворуч",
        "Пріоритет при русі прямо",
        "Дорога з пріоритетом",
        "В'їзд на перехрестя",
      ],
    },
    {
      title: "Маневри на дорозі",
      steps: [
        "Обгін справа",
        "Безпечний обгін",
        "Вибір смуги",
        "Зміна смуги",
        "Поворот і розворот",
        "Зупинка і стоянка",
        "Задній хід і початок руху",
        "Правильна траєкторія",
      ],
    },
    {
      title: "Швидкість і учасники руху",
      steps: [
        "Обмеження швидкості",
        "Швидкість у населеному пункті",
        "Безпечна дистанція і гальмування",
        "Пішоходи на переході",
        "Пішоходи поза переходом",
        "Велосипедисти",
        "Самокати, діти та інші",
      ],
    },
    {
      title: "Автомагістралі, переїзди та ДТП",
      steps: [
        "Залізничні переїзди",
        "Автомагістралі, тунелі та зони",
        "Перша допомога",
        "Що робити після ДТП",
      ],
    },
    {
      title: "Автомобіль і обов'язки водія",
      steps: [
        "Ближнє та дальнє світло",
        "Інші вогні",
        "Покажчики повороту",
        "Звуковий сигнал",
        "Шини та гальма",
        "Технічний стан",
        "Ремені безпеки",
        "Буксирування і вантаж",
        "Посвідчення і документи",
        "Дорожній контроль",
      ],
    },
    {
      title: "Безпечна їзда і небезпеки",
      steps: [
        "Алкоголь, втома і ліки",
        "Погода і видимість",
        "Особлива обережність",
        "Розпізнавання небезпек",
      ],
    },
    {
      title: "Підготовка до іспиту",
      steps: ["Змішаний тест 1", "Змішаний тест 2", "Пробний іспит"],
    },
  ],
  cz: [
    {
      title: "Знаки та сигналізація",
      steps: [
        "Світлофор і поліцейський",
        "Заборони, пріоритет і швидкість",
        "Попереджувальні знаки",
        "Знак у дорожній ситуації",
        "Значення дорожніх знаків",
        "Знаки на практиці",
      ],
    },
    {
      title: "Пріоритет на перехрестях",
      steps: [
        "Пріоритет і порядок проїзду",
        "Переїзди, велосипедисти і поворот",
        "Перехрестя",
        "Проїзд перехрестя",
      ],
    },
    {
      title: "Їзда і маневри",
      steps: ["Обгін, смуги і сигнали", "Зупинка і стоянка", "Рух у потоці"],
    },
    {
      title: "Безпечна їзда та інші учасники",
      steps: [
        "Пішоходи, велосипедисти і діти",
        "Інші учасники руху",
        "Швидкість і дистанція",
        "Алкоголь, втома і мотоцикл",
        "Захисна їзда",
      ],
    },
    {
      title: "Транспорт, документи і ДТП",
      steps: [
        "Вантаж і причіп",
        "Світло, шини і технічний стан",
        "Обладнання авто",
        "Категорії посвідчення",
        "Посвідчення водія",
        "Обов'язки водія",
        "Перша допомога",
        "ДТП",
      ],
    },
    {
      title: "Підготовка до іспиту",
      steps: ["Змішаний тест 1", "Змішаний тест 2", "Пробний тест"],
    },
  ],
  sk: [
    {
      title: "Правила дорожнього руху",
      steps: [
        "Зупинка і стоянка",
        "Поліцейський і сигнали",
        "Обгін, пішоходи і велосипедисти",
        "Повороти і смуги",
        "Залізниця і автомагістраль",
        "Обладнання і позначення авто",
        "Світло і базові поняття",
        "Обов'язки водія",
        "Заборони в русі",
        "Накази в русі",
      ],
    },
    {
      title: "Знаки і дорожні пристрої",
      steps: [
        "Заборонні і попереджувальні знаки",
        "Значення символів",
        "Що позначає знак",
        "Вертикальні дорожні знаки",
      ],
    },
    {
      title: "Пріоритет на перехрестях",
      steps: [
        "Обмеження швидкості",
        "Пріоритет і обмеження",
        "Порядок проїзду",
        "Проїзд перехрестя",
      ],
    },
    {
      title: "Безпечна їзда",
      steps: ["Алкоголь, занос і погода", "Ризикові ситуації", "Безпечні рішення"],
    },
    {
      title: "Авто і технічний стан",
      steps: [
        "Контрольні лампи і зчеплення",
        "Керування авто",
        "Технічний стан і обладнання",
        "Будова і обслуговування",
      ],
    },
    {
      title: "Документи і ДТП",
      steps: ["Документи і право керування", "Обов'язки при ДТП"],
    },
    {
      title: "Підготовка до іспиту",
      steps: ["Змішаний тест 1", "Змішаний тест 2", "Пробний тест"],
    },
  ],
};

export const roadmapCopyPl: RoadmapCopy = {
  unlockTitle: "Odblokuj całą ścieżkę",
  unlockBody: "Wszystkie tematy, testy próbne i więcej. Płacisz raz, korzystasz na zawsze.",
  unlockCta: "Odblokuj",
  perkLifetime: "Dostęp na zawsze",
  perkTopics: "Wszystkie tematy i testy próbne",
  perkPrice: "Taniej niż u konkurencji",
  ratingTitle: "Podoba Ci się Prawko?",
  ratingNo: "Nie",
  ratingYes: "Tak",
  finalStepEyebrow: "Ostatni krok",
  finalStepTitle: "Symulator egzaminu",
  finalStepBadge: "{{count}} pytań",
  pl: [
    {
      title: "Znaki i sygnały",
      steps: [
        "Sygnalizacja świetlna",
        "Znaki ostrzegawcze",
        "Zakazy i nakazy",
        "Znaki pierwszeństwa",
        "Linie i oznakowanie poziome",
        "Strefy i przejazdy kolejowe",
        "Skręt w lewo",
        "Skręt i zawracanie",
        "Znaki w sytuacjach drogowych",
      ],
    },
    {
      title: "Pierwszeństwo na skrzyżowaniach",
      steps: [
        "Skrzyżowania równorzędne",
        "Pierwszeństwo przy skręcie w lewo",
        "Tramwaje i skręt w prawo",
        "Pierwszeństwo przy jeździe na wprost",
        "Droga z pierwszeństwem",
        "Wjazd na skrzyżowanie",
      ],
    },
    {
      title: "Manewry na drodze",
      steps: [
        "Wyprzedzanie z prawej",
        "Bezpieczne wyprzedzanie",
        "Wybór pasa",
        "Zmiana pasa",
        "Skręt i zawracanie",
        "Zatrzymanie i postój",
        "Cofanie i włączanie się do ruchu",
        "Prawidłowy tor jazdy",
      ],
    },
    {
      title: "Prędkość i uczestnicy ruchu",
      steps: [
        "Limity prędkości",
        "Prędkość w obszarze zabudowanym",
        "Bezpieczny odstęp i hamowanie",
        "Piesi na przejściu",
        "Piesi poza przejściem",
        "Rowerzyści",
        "Hulajnogi, dzieci i inni",
      ],
    },
    {
      title: "Autostrady, przejazdy i wypadki",
      steps: [
        "Przejazdy kolejowe",
        "Autostrady, tunele i strefy",
        "Pierwsza pomoc",
        "Co zrobić po wypadku",
      ],
    },
    {
      title: "Samochód i obowiązki kierowcy",
      steps: [
        "Światła mijania i drogowe",
        "Pozostałe światła",
        "Kierunkowskazy",
        "Sygnał dźwiękowy",
        "Opony i hamulce",
        "Stan techniczny pojazdu",
        "Pasy bezpieczeństwa",
        "Holowanie i ładunek",
        "Prawo jazdy i dokumenty",
        "Kontrola drogowa",
      ],
    },
    {
      title: "Bezpieczna jazda i zagrożenia",
      steps: [
        "Alkohol, zmęczenie i leki",
        "Pogoda i widoczność",
        "Szczególna ostrożność",
        "Rozpoznawanie zagrożeń",
      ],
    },
    {
      title: "Przygotowanie do egzaminu",
      steps: ["Test mieszany 1", "Test mieszany 2", "Egzamin próbny"],
    },
  ],
  cz: [
    {
      title: "Znaki i sygnały",
      steps: [
        "Sygnalizacja i policjant",
        "Zakazy, pierwszeństwo i prędkość",
        "Znaki ostrzegawcze",
        "Znak w sytuacji drogowej",
        "Znaczenie znaków",
        "Znaki w praktyce",
      ],
    },
    {
      title: "Pierwszeństwo na skrzyżowaniach",
      steps: [
        "Pierwszeństwo i kolejność przejazdu",
        "Przejazdy, rowerzyści i skręt",
        "Skrzyżowania",
        "Przejazd przez skrzyżowanie",
      ],
    },
    {
      title: "Jazda i manewry",
      steps: ["Wyprzedzanie, pasy i sygnały", "Zatrzymanie i postój", "Jazda w ruchu"],
    },
    {
      title: "Bezpieczna jazda i inni uczestnicy",
      steps: [
        "Piesi, rowerzyści i dzieci",
        "Inni uczestnicy ruchu",
        "Prędkość i odstęp",
        "Alkohol, zmęczenie i motocykl",
        "Jazda defensywna",
      ],
    },
    {
      title: "Pojazd, dokumenty i wypadki",
      steps: [
        "Ładunek i przyczepa",
        "Światła, opony i stan techniczny",
        "Wyposażenie pojazdu",
        "Kategorie prawa jazdy",
        "Prawo jazdy",
        "Obowiązki kierowcy",
        "Pierwsza pomoc",
        "Wypadek drogowy",
      ],
    },
    {
      title: "Przygotowanie do egzaminu",
      steps: ["Test mieszany 1", "Test mieszany 2", "Egzamin próbny"],
    },
  ],
  sk: [
    {
      title: "Przepisy ruchu drogowego",
      steps: [
        "Zatrzymanie i postój",
        "Policjant i sygnały",
        "Wyprzedzanie, piesi i rowerzyści",
        "Skręcanie i pasy ruchu",
        "Kolej i autostrada",
        "Wyposażenie i oznakowanie pojazdu",
        "Światła i podstawowe pojęcia",
        "Obowiązki kierowcy",
        "Zakazy w ruchu",
        "Nakazy w ruchu",
      ],
    },
    {
      title: "Znaki i urządzenia drogowe",
      steps: [
        "Znaki zakazu i ostrzegawcze",
        "Znaczenie symboli",
        "Co oznacza znak",
        "Pionowe znaki drogowe",
      ],
    },
    {
      title: "Pierwszeństwo na skrzyżowaniach",
      steps: [
        "Limity prędkości",
        "Pierwszeństwo i ograniczenia",
        "Kolejność przejazdu",
        "Przejazd przez skrzyżowanie",
      ],
    },
    {
      title: "Bezpieczna jazda",
      steps: ["Alkohol, poślizg i pogoda", "Sytuacje ryzykowne", "Bezpieczne decyzje"],
    },
    {
      title: "Pojazd i stan techniczny",
      steps: [
        "Kontrolki i sprzęgło",
        "Prowadzenie pojazdu",
        "Stan techniczny i wyposażenie",
        "Budowa i obsługa",
      ],
    },
    {
      title: "Dokumenty i wypadki",
      steps: ["Dokumenty i uprawnienia", "Obowiązki przy wypadku"],
    },
    {
      title: "Przygotowanie do egzaminu",
      steps: ["Test mieszany 1", "Test mieszany 2", "Egzamin próbny"],
    },
  ],
};

export const roadmapCopyCs: RoadmapCopy = {
  unlockTitle: "Odemkni celou cestu",
  unlockBody: "Všechna témata, zkušební testy a další. Zaplatíš jednou, používáš navždy.",
  unlockCta: "Odemknout",
  perkLifetime: "Přístup navždy",
  perkTopics: "Všechna témata a zkušební testy",
  perkPrice: "Levnější než konkurence",
  ratingTitle: "Líbí se vám Prawko?",
  ratingNo: "Ne",
  ratingYes: "Ano",
  finalStepEyebrow: "Poslední krok",
  finalStepTitle: "Simulátor zkoušky",
  finalStepBadge: "{{count}} otázek",
  pl: [
    {
      title: "Značky a signály",
      steps: [
        "Semafory",
        "Výstražné značky",
        "Zákazy a příkazy",
        "Značky přednosti",
        "Čáry a vodorovné značení",
        "Zóny a železniční přejezdy",
        "Odbočení vlevo",
        "Odbočení a otáčení",
        "Značky v dopravních situacích",
      ],
    },
    {
      title: "Přednost na křižovatkách",
      steps: [
        "Rovnocenné křižovatky",
        "Přednost při odbočení vlevo",
        "Tramvaje a odbočení vpravo",
        "Přednost při jízdě přímo",
        "Silnice s předností",
        "Vjezd na křižovatku",
      ],
    },
    {
      title: "Manévry na silnici",
      steps: [
        "Předjíždění zprava",
        "Bezpečné předjíždění",
        "Volba pruhu",
        "Změna pruhu",
        "Odbočení a otáčení",
        "Zastavení a stání",
        "Couvání a zařazení do provozu",
        "Správná jízdní stopa",
      ],
    },
    {
      title: "Rychlost a účastníci provozu",
      steps: [
        "Rychlostní limity",
        "Rychlost v obci",
        "Bezpečný odstup a brzdění",
        "Chodci na přechodu",
        "Chodci mimo přechod",
        "Cyklisté",
        "Koloběžky, děti a ostatní",
      ],
    },
    {
      title: "Dálnice, přejezdy a nehody",
      steps: [
        "Železniční přejezdy",
        "Dálnice, tunely a zóny",
        "První pomoc",
        "Co dělat po nehodě",
      ],
    },
    {
      title: "Auto a povinnosti řidiče",
      steps: [
        "Potkávací a dálková světla",
        "Ostatní světla",
        "Blinkry",
        "Zvukové znamení",
        "Pneumatiky a brzdy",
        "Technický stav vozidla",
        "Bezpečnostní pásy",
        "Vlečení a náklad",
        "Řidičský průkaz a doklady",
        "Silniční kontrola",
      ],
    },
    {
      title: "Bezpečná jízda a rizika",
      steps: [
        "Alkohol, únava a léky",
        "Počasí a viditelnost",
        "Zvýšená opatrnost",
        "Rozpoznání rizik",
      ],
    },
    {
      title: "Příprava na zkoušku",
      steps: ["Smíšený test 1", "Smíšený test 2", "Zkušební test"],
    },
  ],
  cz: [
    {
      title: "Značky a signalizace",
      steps: [
        "Semafory a policista",
        "Zákazy, přednost a rychlost",
        "Výstražné značky",
        "Značka v dopravní situaci",
        "Význam dopravních značek",
        "Dopravní značky v praxi",
      ],
    },
    {
      title: "Přednost na křižovatkách",
      steps: [
        "Přednost a pořadí průjezdu",
        "Přejezdy, cyklisté a odbočení",
        "Křižovatky",
        "Průjezd křižovatkou",
      ],
    },
    {
      title: "Jízda a manévry",
      steps: ["Předjíždění, pruhy a znamení", "Zastavení a stání", "Jízda v provozu"],
    },
    {
      title: "Bezpečná jízda a ostatní účastníci",
      steps: [
        "Chodci, cyklisté a děti",
        "Ostatní účastníci provozu",
        "Rychlost a odstup",
        "Alkohol, únava a motocykl",
        "Defenzivní jízda",
      ],
    },
    {
      title: "Vozidlo, doklady a nehody",
      steps: [
        "Náklad a přívěs",
        "Světla, pneumatiky a technický stav",
        "Výbava vozidla",
        "Skupiny řidičského oprávnění",
        "Řidičský průkaz",
        "Povinnosti řidiče",
        "První pomoc",
        "Dopravní nehoda",
      ],
    },
    {
      title: "Příprava na zkoušku",
      steps: ["Smíšený test 1", "Smíšený test 2", "Zkušební test"],
    },
  ],
  sk: [
    {
      title: "Pravidla silničního provozu",
      steps: [
        "Zastavení a stání",
        "Policista a znamení",
        "Předjíždění, chodci a cyklisté",
        "Odbočování a jízdní pruhy",
        "Železnice a dálnice",
        "Výbava a označení vozidla",
        "Světla a základní pojmy",
        "Povinnosti řidiče",
        "Zákazy v provozu",
        "Příkazy v provozu",
      ],
    },
    {
      title: "Značky a dopravní zařízení",
      steps: [
        "Zákazové a výstražné značky",
        "Význam symbolů",
        "Co značka označuje",
        "Svislé dopravní značky",
      ],
    },
    {
      title: "Přednost na křižovatkách",
      steps: [
        "Rychlostní limity",
        "Přednost a omezení",
        "Pořadí průjezdu",
        "Průjezd křižovatkou",
      ],
    },
    {
      title: "Bezpečná jízda",
      steps: ["Alkohol, smyk a počasí", "Rizikové situace", "Bezpečné rozhodování"],
    },
    {
      title: "Vozidlo a technický stav",
      steps: [
        "Kontrolky a spojka",
        "Vedení vozidla",
        "Technický stav a výbava",
        "Konstrukce a údržba",
      ],
    },
    {
      title: "Doklady a nehody",
      steps: ["Doklady a oprávnění", "Povinnosti při nehodě"],
    },
    {
      title: "Příprava na zkoušku",
      steps: ["Smíšený test 1", "Smíšený test 2", "Zkušební test"],
    },
  ],
};

export const roadmapCopySk: RoadmapCopy = {
  unlockTitle: "Odomkni celú cestu",
  unlockBody: "Všetky témy, skúšobné testy a ďalšie. Zaplatíš raz, používaš navždy.",
  unlockCta: "Odomknúť",
  perkLifetime: "Prístup navždy",
  perkTopics: "Všetky témy a skúšobné testy",
  perkPrice: "Lacnejšie ako konkurencia",
  ratingTitle: "Páči sa vám Prawko?",
  ratingNo: "Nie",
  ratingYes: "Áno",
  finalStepEyebrow: "Posledný krok",
  finalStepTitle: "Simulátor skúšky",
  finalStepBadge: "{{count}} otázok",
  pl: [
    {
      title: "Značky a signály",
      steps: [
        "Semafory",
        "Výstražné značky",
        "Zákazy a príkazy",
        "Značky prednosti",
        "Čiary a vodorovné značenie",
        "Zóny a železničné priecestia",
        "Odbočenie vľavo",
        "Odbočenie a otáčanie",
        "Značky v dopravných situáciách",
      ],
    },
    {
      title: "Prednosť na križovatkách",
      steps: [
        "Rovnocenné križovatky",
        "Prednosť pri odbočení vľavo",
        "Električky a odbočenie vpravo",
        "Prednosť pri jazde rovno",
        "Cesta s prednosťou",
        "Vjazd na križovatku",
      ],
    },
    {
      title: "Manévre na ceste",
      steps: [
        "Predchádzanie sprava",
        "Bezpečné predchádzanie",
        "Výber pruhu",
        "Zmena pruhu",
        "Odbočenie a otáčanie",
        "Zastavenie a státie",
        "Cúvanie a zaradenie do premávky",
        "Správna jazdná stopa",
      ],
    },
    {
      title: "Rýchlosť a účastníci premávky",
      steps: [
        "Rýchlostné limity",
        "Rýchlosť v obci",
        "Bezpečný odstup a brzdenie",
        "Chodci na priechode",
        "Chodci mimo priechod",
        "Cyklisti",
        "Kolobežky, deti a ostatní",
      ],
    },
    {
      title: "Diaľnice, priecestia a nehody",
      steps: [
        "Železničné priecestia",
        "Diaľnice, tunely a zóny",
        "Prvá pomoc",
        "Čo robiť po nehode",
      ],
    },
    {
      title: "Auto a povinnosti vodiča",
      steps: [
        "Stretávacie a diaľkové svetlá",
        "Ostatné svetlá",
        "Smerovky",
        "Zvukové znamenie",
        "Pneumatiky a brzdy",
        "Technický stav vozidla",
        "Bezpečnostné pásy",
        "Ťahanie a náklad",
        "Vodičský preukaz a doklady",
        "Cestná kontrola",
      ],
    },
    {
      title: "Bezpečná jazda a riziká",
      steps: [
        "Alkohol, únava a lieky",
        "Počasie a viditeľnosť",
        "Zvýšená opatrnosť",
        "Rozpoznanie rizík",
      ],
    },
    {
      title: "Príprava na skúšku",
      steps: ["Zmiešaný test 1", "Zmiešaný test 2", "Skúšobný test"],
    },
  ],
  cz: [
    {
      title: "Značky a signalizácia",
      steps: [
        "Semafory a policajt",
        "Zákazy, prednosť a rýchlosť",
        "Výstražné značky",
        "Značka v dopravnej situácii",
        "Význam dopravných značiek",
        "Dopravné značky v praxi",
      ],
    },
    {
      title: "Prednosť na križovatkách",
      steps: [
        "Prednosť a poradie prejazdu",
        "Priecestia, cyklisti a odbočenie",
        "Križovatky",
        "Prejazd križovatkou",
      ],
    },
    {
      title: "Jazda a manévre",
      steps: ["Predchádzanie, pruhy a znamenia", "Zastavenie a státie", "Jazda v premávke"],
    },
    {
      title: "Bezpečná jazda a ostatní účastníci",
      steps: [
        "Chodci, cyklisti a deti",
        "Ostatní účastníci premávky",
        "Rýchlosť a odstup",
        "Alkohol, únava a motocykel",
        "Defenzívna jazda",
      ],
    },
    {
      title: "Vozidlo, doklady a nehody",
      steps: [
        "Náklad a príves",
        "Svetlá, pneumatiky a technický stav",
        "Výbava vozidla",
        "Skupiny vodičského oprávnenia",
        "Vodičský preukaz",
        "Povinnosti vodiča",
        "Prvá pomoc",
        "Dopravná nehoda",
      ],
    },
    {
      title: "Príprava na skúšku",
      steps: ["Zmiešaný test 1", "Zmiešaný test 2", "Skúšobný test"],
    },
  ],
  sk: [
    {
      title: "Pravidlá cestnej premávky",
      steps: [
        "Zastavenie a státie",
        "Policajt a znamenia",
        "Predchádzanie, chodci a cyklisti",
        "Odbočovanie a jazdné pruhy",
        "Železnica a diaľnica",
        "Výbava a označenie vozidla",
        "Svetlá a základné pojmy",
        "Povinnosti vodiča",
        "Zákazy v premávke",
        "Príkazy v premávke",
      ],
    },
    {
      title: "Značky a dopravné zariadenia",
      steps: [
        "Zákazové a výstražné značky",
        "Význam symbolov",
        "Čo značka označuje",
        "Zvislé dopravné značky",
      ],
    },
    {
      title: "Prednosť na križovatkách",
      steps: [
        "Rýchlostné limity",
        "Prednosť a obmedzenia",
        "Poradie prejazdu",
        "Prejazd križovatkou",
      ],
    },
    {
      title: "Bezpečná jazda",
      steps: ["Alkohol, šmyk a počasie", "Rizikové situácie", "Bezpečné rozhodovanie"],
    },
    {
      title: "Vozidlo a technický stav",
      steps: [
        "Kontrolky a spojka",
        "Vedenie vozidla",
        "Technický stav a výbava",
        "Konštrukcia a údržba",
      ],
    },
    {
      title: "Doklady a nehody",
      steps: ["Doklady a oprávnenie", "Povinnosti pri nehode"],
    },
    {
      title: "Príprava na skúšku",
      steps: ["Zmiešaný test 1", "Zmiešaný test 2", "Skúšobný test"],
    },
  ],
};

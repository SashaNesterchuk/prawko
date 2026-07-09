import type { SignPractice } from "../types";

export const A1_PRACTICES: SignPractice[] = [
  {
    id: "a-1-name",
    prompt: {
      pl: "Jak nazywa się ten znak?",
      ua: "Як називається цей знак?",
      en: "What is the name of this sign?",
    },
    options: [
      {
        id: "a",
        label: {
          pl: "Niebezpieczny zakręt w prawo",
          ua: "Небезпечний поворот праворуч",
          en: "Dangerous bend to the right",
        },
      },
      {
        id: "b",
        label: {
          pl: "Niebezpieczny zakręt w lewo",
          ua: "Небезпечний поворот ліворуч",
          en: "Dangerous bend to the left",
        },
      },
      {
        id: "c",
        label: {
          pl: "Droga kręta",
          ua: "Звивиста дорога",
          en: "Winding road",
        },
      },
    ],
    correctOptionId: "a",
    explanation: {
      pl: "Znak A-1 ostrzega o niebezpiecznym zakręcie w prawo.",
      ua: "Знак A-1 попереджає про небезпечний поворот праворуч.",
      en: "Sign A-1 warns about a dangerous bend to the right.",
    },
  },
  {
    id: "a-1-action",
    prompt: {
      pl: "Co powinien zrobić kierowca widząc znak A-1?",
      ua: "Що має зробити водій, побачивши знак A-1?",
      en: "What should a driver do when seeing sign A-1?",
    },
    options: [
      {
        id: "a",
        label: {
          pl: "Zmniejszyć prędkość i zachować szczególną ostrożność",
          ua: "Зменшити швидкість і бути особливо обережним",
          en: "Reduce speed and drive with extra caution",
        },
      },
      {
        id: "b",
        label: {
          pl: "Przyspieszyć, aby szybciej minąć zakręt",
          ua: "Прискоритися, щоб швидше пройти поворот",
          en: "Speed up to pass the bend faster",
        },
      },
      {
        id: "c",
        label: {
          pl: "Zatrzymać się natychmiast na jezdni",
          ua: "Негайно зупинитися на проїжджій частині",
          en: "Stop immediately on the road",
        },
      },
    ],
    correctOptionId: "a",
    explanation: {
      pl: "Znak ostrzegawczy wymaga ostrożnej jazdy i dostosowania prędkości.",
      ua: "Попереджувальний знак вимагає обережної їзди та зниження швидкості.",
      en: "A warning sign requires cautious driving and adjusted speed.",
    },
  },
  {
    id: "a-1-category",
    prompt: {
      pl: "Do jakiej kategorii należy znak A-1?",
      ua: "До якої категорії належить знак A-1?",
      en: "Which category does sign A-1 belong to?",
    },
    options: [
      {
        id: "a",
        label: {
          pl: "Znaki ostrzegawcze",
          ua: "Попереджувальні знаки",
          en: "Warning signs",
        },
      },
      {
        id: "b",
        label: {
          pl: "Znaki zakazu",
          ua: "Заборонні знаки",
          en: "Prohibition signs",
        },
      },
      {
        id: "c",
        label: {
          pl: "Znaki informacyjne",
          ua: "Інформаційні знаки",
          en: "Information signs",
        },
      },
    ],
    correctOptionId: "a",
    explanation: {
      pl: "A-1 to trójkątny znak ostrzegawczy (grupa A).",
      ua: "A-1 — трикутний попереджувальний знак (група A).",
      en: "A-1 is a triangular warning sign (group A).",
    },
  },
];

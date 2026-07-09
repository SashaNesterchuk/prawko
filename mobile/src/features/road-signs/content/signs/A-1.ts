import { A1_PRACTICES } from "../practices/A-1";
import type { RoadSignContent } from "../types";

export const A1_CONTENT: RoadSignContent = {
  id: "A-1",
  categoryId: "A",
  assetKey: "A-1",
  name: {
    pl: "Niebezpieczny zakręt w prawo",
    ua: "Небезпечний поворот праворуч",
    en: "Dangerous bend to the right",
  },
  description: {
    pl: "Ostrzega o niebezpiecznym zakręcie w kierunku wskazanym na znaku. Kierowca powinien zmniejszyć prędkość, utrzymać właściwy tor jazdy i zachować szczególną ostrożność.",
    ua: "Попереджає про небезпечний поворот у напрямку, зазначеному на знаку. Водій має зменшити швидкість, тримати правильну траєкторію та бути особливо обережним.",
    en: "Warns about a dangerous bend in the direction shown on the sign. The driver should reduce speed, keep a proper line, and drive with extra caution.",
  },
  practices: A1_PRACTICES,
};

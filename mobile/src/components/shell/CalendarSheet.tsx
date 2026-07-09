import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type CalendarSheetProps = {
  visible: boolean;
  locale: string;
  initialDate?: Date | null;
  confirmLabel: string;
  clearLabel: string;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  onClear: () => void;
};

const MONTH_NAMES: Record<string, string[]> = {
  ua: [
    "Січень",
    "Лютий",
    "Березень",
    "Квітень",
    "Травень",
    "Червень",
    "Липень",
    "Серпень",
    "Вересень",
    "Жовтень",
    "Листопад",
    "Грудень",
  ],
  pl: [
    "Styczen",
    "Luty",
    "Marzec",
    "Kwiecien",
    "Maj",
    "Czerwiec",
    "Lipiec",
    "Sierpien",
    "Wrzesien",
    "Pazdziernik",
    "Listopad",
    "Grudzien",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

const WEEKDAY_NAMES: Record<string, string[]> = {
  ua: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"],
  pl: ["Pn", "Wt", "Sr", "Cz", "Pt", "So", "Nd"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildMonthMatrix(viewMonth: Date): (Date | null)[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let index = 0; index < startWeekday; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function CalendarSheet({
  visible,
  locale,
  initialDate,
  confirmLabel,
  clearLabel,
  onClose,
  onConfirm,
  onClear,
}: CalendarSheetProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const months = MONTH_NAMES[locale] ?? MONTH_NAMES.ua;
  const weekdays = WEEKDAY_NAMES[locale] ?? WEEKDAY_NAMES.ua;

  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selected, setSelected] = useState<Date | null>(initialDate ?? null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const base = initialDate ? startOfDay(initialDate) : today;
    setSelected(initialDate ? startOfDay(initialDate) : null);
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [visible, initialDate, today]);

  const matrix = useMemo(() => buildMonthMatrix(viewMonth), [viewMonth]);
  const canGoPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() &&
      viewMonth.getMonth() > today.getMonth());

  const shiftMonth = (delta: number) => {
    setViewMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1)
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            disabled={!canGoPrev}
            onPress={() => shiftMonth(-1)}
            hitSlop={10}
            style={[styles.navButton, !canGoPrev ? styles.navDisabled : null]}
          >
            <View style={[styles.chevron, styles.chevronLeft]} />
          </Pressable>

          <Text style={styles.monthLabel}>
            {`${months[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => shiftMonth(1)}
            hitSlop={10}
            style={styles.navButton}
          >
            <View style={[styles.chevron, styles.chevronRight]} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {weekdays.map((weekday) => (
            <Text key={weekday} style={styles.weekday}>
              {weekday}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {matrix.map((cell, index) => {
            if (!cell) {
              return <View key={`empty-${index}`} style={styles.cell} />;
            }

            const isPast = cell.getTime() < today.getTime();
            const isSelected = selected ? isSameDay(cell, selected) : false;
            const isToday = isSameDay(cell, today);

            return (
              <Pressable
                key={cell.toISOString()}
                accessibilityRole="button"
                disabled={isPast}
                onPress={() => setSelected(cell)}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.dayPill,
                    isSelected ? styles.dayPillSelected : null,
                    isToday && !isSelected ? styles.dayPillToday : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isPast ? styles.dayTextPast : null,
                      isSelected ? styles.dayTextSelected : null,
                    ]}
                  >
                    {cell.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            style={({ pressed }) => [
              styles.clearButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={styles.clearLabel}>{clearLabel}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={!selected}
            onPress={() => {
              if (selected) {
                onConfirm(selected);
              }
            }}
            style={({ pressed }) => [
              styles.confirmButton,
              !selected ? styles.confirmDisabled : null,
              pressed && selected ? styles.pressed : null,
            ]}
          >
            <Text style={styles.confirmLabel}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,45,33,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: greenWave.spacing.xl,
    paddingTop: greenWave.spacing.md,
    paddingBottom: 32,
    backgroundColor: greenWave.color.paper,
    borderTopLeftRadius: greenWave.radius.xxl,
    borderTopRightRadius: greenWave.radius.xxl,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: greenWave.color.line,
    marginBottom: greenWave.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: greenWave.spacing.md,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: greenWave.color.surface,
  },
  navDisabled: {
    opacity: 0.35,
  },
  chevron: {
    width: 9,
    height: 9,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: greenWave.color.ink,
  },
  chevronLeft: {
    transform: [{ rotate: "225deg" }],
    marginLeft: 4,
  },
  chevronRight: {
    transform: [{ rotate: "45deg" }],
    marginRight: 4,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: greenWave.color.ink,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: greenWave.spacing.sm,
  },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: greenWave.color.inkMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillSelected: {
    backgroundColor: greenWaveAccent.green.fill,
  },
  dayPillToday: {
    borderWidth: 1.5,
    borderColor: greenWaveAccent.green.fill,
  },
  dayText: {
    fontSize: 16,
    fontWeight: "500",
    color: greenWave.color.ink,
  },
  dayTextPast: {
    color: greenWave.color.inkMuted,
    opacity: 0.5,
  },
  dayTextSelected: {
    color: greenWave.color.onAccent,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    gap: greenWave.spacing.md,
    marginTop: greenWave.spacing.lg,
  },
  clearButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.lg,
    borderRadius: greenWave.radius.pill,
    borderWidth: 1,
    borderColor: greenWave.color.line,
  },
  clearLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: greenWave.color.inkSecondary,
  },
  confirmButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: greenWave.spacing.lg,
    borderRadius: greenWave.radius.pill,
    backgroundColor: greenWaveAccent.green.fill,
  },
  confirmDisabled: {
    opacity: 0.45,
  },
  confirmLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: greenWave.color.onAccent,
  },
  pressed: {
    opacity: 0.85,
  },
});

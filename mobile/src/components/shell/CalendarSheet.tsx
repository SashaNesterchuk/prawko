import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  View,
} from "react-native";

import { CText, getFontFamily, useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

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
  const theme = useTheme();
  const styles = useStyles();
  const today = useMemo(() => startOfDay(new Date()), []);
  const months = MONTH_NAMES[locale] ?? MONTH_NAMES.en;
  const weekdays = WEEKDAY_NAMES[locale] ?? WEEKDAY_NAMES.en;

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

          <CText style={styles.monthLabel}>
            {`${months[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`}
          </CText>

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
            <CText key={weekday} style={styles.weekday}>
              {weekday}
            </CText>
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
                  <CText
                    style={[
                      styles.dayText,
                      isPast ? styles.dayTextPast : null,
                      isSelected ? styles.dayTextSelected : null,
                    ]}
                  >
                    {cell.getDate()}
                  </CText>
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
            <CText style={styles.clearLabel}>{clearLabel}</CText>
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
            <CText style={styles.confirmLabel}>{confirmLabel}</CText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.overlayScrim,
    },
    sheet: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.exact(32),
      backgroundColor: colors.paper,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
    },
    grabber: {
      alignSelf: "center",
      width: spacing.exact(40),
      height: spacing.exact(5),
      borderRadius: radius.pill,
      backgroundColor: colors.line,
      marginBottom: spacing.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.md,
    },
    navButton: {
      width: spacing.exact(36),
      height: spacing.exact(36),
      borderRadius: spacing.exact(18),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    navDisabled: {
      opacity: 0.35,
    },
    chevron: {
      width: spacing.exact(9),
      height: spacing.exact(9),
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderColor: colors.ink,
    },
    chevronLeft: {
      transform: [{ rotate: "225deg" }],
      marginLeft: spacing.exact(4),
    },
    chevronRight: {
      transform: [{ rotate: "45deg" }],
      marginRight: spacing.exact(4),
    },
    monthLabel: {
      fontSize: responsiveFont(18),
      fontFamily: getFontFamily("bold"),
      letterSpacing: -0.2,
      color: colors.ink,
    },
    weekRow: {
      flexDirection: "row",
      marginBottom: spacing.sm,
    },
    weekday: {
      flex: 1,
      textAlign: "center",
      fontSize: responsiveFont(12),
      fontFamily: getFontFamily("semiBold"),
      color: colors.inkMuted,
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
      width: spacing.exact(40),
      height: spacing.exact(40),
      borderRadius: spacing.exact(20),
      alignItems: "center",
      justifyContent: "center",
    },
    dayPillSelected: {
      backgroundColor: theme.accents.green.fill,
    },
    dayPillToday: {
      borderWidth: 1.5,
      borderColor: theme.accents.green.fill,
    },
    dayText: {
      fontSize: responsiveFont(16),
      fontFamily: getFontFamily("medium"),
      color: colors.ink,
    },
    dayTextPast: {
      color: colors.inkMuted,
      opacity: 0.5,
    },
    dayTextSelected: {
      color: colors.onAccent,
      fontFamily: getFontFamily("bold"),
    },
    footer: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    clearButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
    },
    clearLabel: {
      fontSize: responsiveFont(16),
      fontFamily: getFontFamily("semiBold"),
      color: colors.inkSecondary,
    },
    confirmButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: theme.accents.green.fill,
    },
    confirmDisabled: {
      opacity: 0.45,
    },
    confirmLabel: {
      fontSize: responsiveFont(16),
      fontFamily: getFontFamily("bold"),
      color: colors.onAccent,
    },
    pressed: {
      opacity: 0.85,
    },
  }));
}

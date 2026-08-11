import { View } from "react-native";

import { Icon } from "../icons";
import {
  CText,
  getFontFamily,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import type { WeekDayActivity } from "../../features/profile/profile-stats";

type StatisticsActivityCardProps = {
  learningDays: number;
  sessions: number;
  streak: number;
  weekDays: WeekDayActivity[];
  labels: {
    learningDays: string;
    sessions: string;
    streak: string;
  };
};

export function StatisticsActivityCard({
  learningDays,
  sessions,
  streak,
  weekDays,
  labels,
}: StatisticsActivityCardProps) {
  const theme = useTheme();
  const styles = useStyles();
  const metrics = [
    { key: "learningDays", value: String(learningDays), label: labels.learningDays },
    { key: "sessions", value: String(sessions), label: labels.sessions },
    { key: "streak", value: String(streak), label: labels.streak },
  ] as const;
  const flameSize = 12;

  return (
    <View style={styles.card}>
      <View style={styles.metricsRow}>
        {metrics.map((metric) => (
          <View key={metric.key} style={styles.metric}>
            <CText style={styles.metricValue}>{metric.value}</CText>
            <CText style={styles.metricLabel}>{metric.label}</CText>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.weekSection}>
        <View style={styles.weekRow}>
          {weekDays.map((day) => (
            <View
              key={day.isoDate}
              style={[styles.dayCell, day.isToday ? styles.dayCellToday : null]}
            >
              <CText style={styles.weekdayLabel}>{day.weekdayLabel}</CText>
              <CText
                style={[
                  styles.dayNumber,
                  day.isToday ? styles.dayNumberToday : null,
                  day.isFuture ? styles.dayNumberMuted : null,
                ]}
              >
                {day.dayOfMonth}
              </CText>
              <View style={[styles.dayIconSlot, { width: flameSize, height: flameSize }]}>
                {day.hasActivity ? (
                  <Icon
                    color={theme.accents.amber.fill}
                    name="flame"
                    size={flameSize}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ colors, elevation, radius, responsiveFont }) => ({
      card: {
        width: "100%",
        height: 161,
        borderRadius: radius.xxl,
        backgroundColor: colors.white,
        overflow: "hidden",
        ...elevation.card,
      },
      metricsRow: {
        height: 77,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: colors.white,
      },
      metric: {
        flex: 1,
        alignItems: "center",
      },
      metricValue: {
        fontFamily: getFontFamily("semiBold"),
        fontSize: responsiveFont(20),
        lineHeight: responsiveFont(28),
        fontWeight: "600",
        letterSpacing: -0.2,
        color: colors.ink,
        textAlign: "center",
      },
      metricLabel: {
        fontFamily: getFontFamily("regular"),
        fontSize: responsiveFont(12),
        lineHeight: responsiveFont(16),
        fontWeight: "400",
        textAlign: "center",
        color: colors.inkSecondary,
      },
      divider: {
        position: "absolute",
        top: 77,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: colors.line,
        zIndex: 1,
      },
      weekSection: {
        height: 84,
        paddingHorizontal: 32,
        paddingVertical: 16,
      },
      weekRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      dayCell: {
        width: 25,
        height: 52,
        alignItems: "center",
        padding: 4,
        borderRadius: radius.lg,
        overflow: "hidden",
      },
      dayCellToday: {
        backgroundColor: colors.surface2,
      },
      weekdayLabel: {
        fontFamily: getFontFamily("medium"),
        fontSize: responsiveFont(11),
        lineHeight: responsiveFont(12),
        fontWeight: "500",
        color: colors.inkMuted,
        textAlign: "center",
      },
      dayNumber: {
        fontFamily: getFontFamily("mono"),
        fontSize: responsiveFont(14),
        lineHeight: responsiveFont(20),
        fontWeight: "400",
        letterSpacing: -0.14,
        color: colors.ink,
        textAlign: "center",
      },
      dayNumberToday: {
        fontWeight: "500",
      },
      dayNumberMuted: {
        color: colors.inkMuted,
      },
      dayIconSlot: {
        alignItems: "center",
        justifyContent: "center",
      },
    })
  );
}

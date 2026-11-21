// Month calendar for picking a due date. Dates are local "YYYY-MM-DD"
// strings so a day never shifts across time zones. `markers` puts dots
// under days that already have work due, so busy days are easy to avoid.

import * as React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, SlideInLeft, SlideInRight } from "react-native-reanimated";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { colors, hairline, radii, shadows } from "@/theme/tokens";
import { Text } from "./text";

export function toLocalISO(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Midday local time, so the date survives conversion to UTC either way. */
export function fromLocalISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}

export function addDaysISO(days: number, from = new Date()) {
  return toLocalISO(new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, 12));
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface CalendarProps {
  value: string;
  onChange: (iso: string) => void;
  /** Earliest selectable day (inclusive). */
  min?: string;
  /** Number of things already due per day, e.g. { "2026-12-04": 2 }. */
  markers?: Record<string, number>;
  style?: StyleProp<ViewStyle>;
}

export function Calendar({ value, onChange, min, markers, style }: CalendarProps) {
  const selected = value ? fromLocalISO(value) : null;
  const today = toLocalISO(new Date());
  const [month, setMonth] = React.useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [dir, setDir] = React.useState(0);

  // Follow the value when it moves to another month (e.g. a preset chip).
  const [shownFor, setShownFor] = React.useState(value);
  if (value !== shownFor) {
    setShownFor(value);
    if (selected && (selected.getMonth() !== month.getMonth() || selected.getFullYear() !== month.getFullYear())) {
      setDir(selected > month ? 1 : -1);
      setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    }
  }

  const minMonth = min ? new Date(fromLocalISO(min).getFullYear(), fromLocalISO(min).getMonth(), 1) : null;
  const canGoBack = !minMonth || month > minMonth;
  const shift = (d: number) => {
    setDir(d);
    setMonth(m => new Date(m.getFullYear(), m.getMonth() + d, 1));
  };

  const lead = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => toLocalISO(new Date(month.getFullYear(), month.getMonth(), i + 1, 12))),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthLabel = month.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const entering = dir > 0 ? SlideInRight.springify().stiffness(420).damping(36) : dir < 0 ? SlideInLeft.springify().stiffness(420).damping(36) : FadeIn;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <Text size={15} weight="semibold" accessibilityLiveRegion="polite">
          {monthLabel}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <Pressable
            onPress={() => shift(-1)}
            disabled={!canGoBack}
            accessibilityLabel="Previous month"
            style={({ pressed }) => [styles.nav, pressed && { backgroundColor: colors.surfaceSunken }, !canGoBack && { opacity: 0.3 }]}
          >
            <ChevronLeft size={18} strokeWidth={2} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => shift(1)} accessibilityLabel="Next month" style={({ pressed }) => [styles.nav, pressed && { backgroundColor: colors.surfaceSunken }]}>
            <ChevronRight size={18} strokeWidth={2} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      <View style={styles.week}>
        {WEEKDAYS.map(d => (
          <Text key={d} size={11} weight="semibold" color={colors.textTertiary} align="center" style={styles.weekday}>
            {d.toUpperCase()}
          </Text>
        ))}
      </View>

      <View style={{ overflow: "hidden" }}>
        <Animated.View key={monthLabel} entering={entering} style={{ gap: 4 }}>
          {weeks.map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((iso, i) => {
                if (!iso) return <View key={`pad-${w}-${i}`} style={styles.dayCell} />;
                const disabled = !!min && iso < min;
                const isSelected = iso === value;
                const isToday = iso === today;
                const count = markers?.[iso] ?? 0;
                const day = Number(iso.slice(8));
                const weekend = i >= 5;
                return (
                  <View key={iso} style={styles.dayCell}>
                    <Pressable
                      disabled={disabled}
                      onPress={() => onChange(iso)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled }}
                      accessibilityLabel={`${fromLocalISO(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}${
                        count ? `, ${count} order${count > 1 ? "s" : ""} already due` : ""
                      }`}
                      style={({ pressed }) => [
                        styles.day,
                        isSelected && { backgroundColor: colors.olive, boxShadow: shadows.xs },
                        !isSelected && pressed && !disabled && { backgroundColor: colors.surfaceSunken },
                        isToday && !isSelected && { borderWidth: 1, borderColor: colors.borderStrong },
                      ]}
                    >
                      <Text
                        tabular
                        size={15}
                        weight={isSelected ? "semibold" : "medium"}
                        color={isSelected ? colors.textInverse : disabled ? colors.borderStrong : weekend ? colors.textSecondary : colors.ink}
                      >
                        {day}
                      </Text>
                      {count > 0 && !disabled && (
                        <View style={styles.dots}>
                          {Array.from({ length: Math.min(count, 3) }, (_, k) => (
                            <View key={k} style={[styles.dot, { backgroundColor: isSelected ? "rgba(251,250,247,0.8)" : colors.warning }]} />
                          ))}
                        </View>
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radii.card, borderWidth: 1, borderColor: hairline, backgroundColor: colors.surface, padding: 16 },
  head: { marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row" },
  weekday: { flex: 1, paddingBottom: 8, letterSpacing: 0.4 },
  dayCell: { flex: 1, alignItems: "center" },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: 4, flexDirection: "row", gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});

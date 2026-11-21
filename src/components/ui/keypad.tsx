import * as React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { Delete } from "lucide-react-native";
import { colors, radii, shadows } from "@/theme/tokens";
import { Button } from "./button";
import { Text } from "./text";

interface KeypadProps {
  value: string;
  onChange: (value: string) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  showPrevious?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Imperial uses tailor fractions (¼ ½ ¾); metric uses decimal precision instead. */
  unit?: "imperial" | "metric";
}

const IMPERIAL = [
  ["1", "2", "3", "¼"],
  ["4", "5", "6", "½"],
  ["7", "8", "9", "¾"],
  [".", "0", "⌫", "Skip"],
];
const METRIC = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];
const FRACTIONS = ["¼", "½", "¾"];

/** Tape keypad — identical input rules to the web keypad. */
export function Keypad({ value, onChange, onNext, onPrevious, onSkip, nextLabel = "Next", showPrevious = true, style, unit = "imperial" }: KeypadProps) {
  const rows = unit === "metric" ? METRIC : IMPERIAL;

  const press = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    switch (key) {
      case "⌫":
        onChange(value.slice(0, -1));
        break;
      case "Skip":
        onSkip?.();
        break;
      case ".":
        if (!value.includes(".") && !FRACTIONS.some(f => value.includes(f))) onChange(value + ".");
        break;
      case "¼":
      case "½":
      case "¾": {
        const whole = value.replace(/[¼½¾]/g, "").replace(/\.\d*$/, "");
        onChange(whole + key);
        break;
      }
      default:
        if (FRACTIONS.some(f => value.includes(f))) return;
        if (value.replace(".", "").length >= 5) return;
        onChange(value + key);
    }
  };

  return (
    <View style={[{ gap: 12 }, style]}>
      <View style={{ gap: 8 }}>
        {rows.map((row, r) => (
          <View key={r} style={{ flexDirection: "row", gap: 8 }}>
            {row.map(key => {
              const isFraction = FRACTIONS.includes(key);
              const isUtility = key === "⌫" || key === "Skip";
              return (
                <Pressable
                  key={key}
                  onPress={() => press(key)}
                  accessibilityRole="button"
                  accessibilityLabel={key === "⌫" ? "Delete" : key === "Skip" ? "Skip this measurement" : key}
                  style={({ pressed }) => [
                    styles.key,
                    isUtility
                      ? { backgroundColor: pressed ? colors.surfaceSunken : "transparent" }
                      : isFraction
                        ? { backgroundColor: pressed ? colors.oliveSoftPressed : colors.oliveSoft }
                        : { backgroundColor: pressed ? colors.beigeLight : colors.surfaceRaised, boxShadow: shadows.xs },
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}
                >
                  {key === "⌫" ? (
                    <Delete size={22} strokeWidth={1.75} color={colors.textSecondary} />
                  ) : isUtility ? (
                    <Text variant="label" weight="semibold" color={colors.textSecondary}>
                      {key}
                    </Text>
                  ) : (
                    <Text size={22} weight={isFraction ? "semibold" : "medium"} color={isFraction ? colors.oliveDeep : colors.ink}>
                      {key}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {unit === "metric" && onSkip && (
        <Pressable onPress={onSkip} style={({ pressed }) => [styles.skip, pressed && { backgroundColor: colors.surfaceSunken }]}>
          <Text variant="label" weight="semibold" color={colors.textTertiary}>
            Skip this measurement
          </Text>
        </Pressable>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        {showPrevious && (
          <Button variant="secondary" size="lg" onPress={onPrevious} style={{ flex: 1 }}>
            Previous
          </Button>
        )}
        <Button size="lg" onPress={onNext} style={showPrevious ? { flex: 2, minWidth: 0 } : { flex: 1 }}>
          {nextLabel}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  key: { flex: 1, height: 56, borderRadius: radii.control, alignItems: "center", justifyContent: "center" },
  skip: { alignSelf: "center", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});

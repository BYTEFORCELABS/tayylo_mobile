import * as React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  useReducedMotion,
  withDelay,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle } from "lucide-react-native";
import type { MeasurementSet, MeasurementTemplate, TemplateField, UnitSystem } from "@/types";
import { colors, GUTTER, hairline, radii } from "@/theme/tokens";
import { measurementValue } from "@/theme/typography";
import { Button } from "@/components/ui/button";
import { Keypad } from "@/components/ui/keypad";
import { MeasurementCell, MeasurementGrid } from "@/components/ui/measurement";
import { Text } from "@/components/ui/text";
import { MeasurementFigure, measurementMethod } from "@/components/brand/measurement-icon";
import { formatDate } from "@/lib/format";
import type { BodySex } from "@/lib/measurement-art";
import type { Delta } from "./measure-logic";

// ------------------------------------------------------------ progress

/** One segment per measurement point, under the header title. */
export function CaptureProgress({ fields, fieldIndex, values }: { fields: TemplateField[]; fieldIndex: number; values: Record<string, string> }) {
  return (
    <View style={{ paddingBottom: 12 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={{ flexDirection: "row", height: 4, gap: 3 }}>
        {fields.map((f, i) => (
          <View
            key={f.key}
            style={{
              flex: 1,
              height: "100%",
              borderRadius: 999,
              backgroundColor: i === fieldIndex ? colors.ink : values[f.key] ? colors.olive : colors.surfaceSunken,
            }}
          />
        ))}
      </View>
    </View>
  );
}

// ------------------------------------------------------------ overview grid

interface CaptureGridProps {
  fields: TemplateField[];
  values: Record<string, string>;
  fieldIndex: number;
  recordedCount: number;
  unitText: string;
  deltaFor: (key: string, raw: string) => Delta | undefined;
  onPickField: (index: number) => void;
  onReview: () => void;
}

export function CaptureGrid({ fields, values, fieldIndex, recordedCount, unitText, deltaFor, onPickField, onReview }: CaptureGridProps) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: GUTTER,
          paddingTop: 8,
          paddingBottom: 40 + insets.bottom,
        }}
      >
        <Text variant="label" color={colors.textTertiary} style={{ marginBottom: 12 }}>
          <Text variant="label" tabular color={colors.textTertiary}>
            {recordedCount}
          </Text>{" "}
          of {fields.length} recorded · tap any to edit
        </Text>
        <MeasurementGrid>
          {fields.map((f, i) => (
            <MeasurementCell
              key={f.key}
              label={f.label}
              fieldKey={f.key}
              value={values[f.key] || ""}
              empty={!values[f.key]}
              unit={unitText}
              active={i === fieldIndex}
              delta={deltaFor(f.key, values[f.key] || "")}
              onPress={() => onPickField(i)}
            />
          ))}
        </MeasurementGrid>
        <Button block size="lg" style={{ marginTop: 24 }} onPress={onReview}>
          Review and save
        </Button>
      </ScrollView>
    </Animated.View>
  );
}

// ------------------------------------------------------------ one at a time

interface CaptureFocusProps {
  template: MeasurementTemplate | null;
  fields: TemplateField[];
  fieldIndex: number;
  currentValue: string;
  bodySex: BodySex;
  unit: UnitSystem;
  unitText: string;
  previousSet: MeasurementSet | null;
  prevVal?: string;
  warning?: string;
  /** +1 heading forward, -1 heading back; read by the slide animations. */
  slideDir: SharedValue<number>;
  onChange: (v: string) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function CaptureFocus({
  template,
  fields,
  fieldIndex,
  currentValue,
  bodySex,
  unit,
  unitText,
  previousSet,
  prevVal,
  warning,
  slideDir,
  onChange,
  onNext,
  onPrevious,
}: CaptureFocusProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const currentField = fields[fieldIndex];
  const nextField = fields[fieldIndex + 1];
  const method = currentField
    ? measurementMethod({
        key: currentField.key,
        label: currentField.label,
        templateName: template?.name,
      })
    : undefined;

  // Like the web's AnimatePresence initial={false}: the first card appears
  // in place; every later card slides in.
  const firstKey = React.useRef(currentField?.key);
  const slid = React.useRef(false);
  if (currentField?.key !== firstKey.current) slid.current = true;
  const animate = slid.current;

  const cardEntering = animate ? (reduceMotion ? FadeIn.duration(200) : slideCardIn(slideDir)) : undefined;
  const cardExiting = reduceMotion ? FadeOut.duration(160) : slideCardOut(slideDir);

  return (
    // Leaving capture (grid, review) drops the card without its exit slide, as on the web.
    <LayoutAnimationConfig skipExiting>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: GUTTER }} keyboardShouldPersistTaps="handled">
        {/* Field in focus — slides to the next body part (or back) */}
        <View style={styles.stage}>
          <Animated.View key={currentField?.key} entering={cardEntering} exiting={cardExiting}>
            <View style={styles.row}>
              <Animated.View entering={animate && !reduceMotion ? figureIn(slideDir) : undefined} style={{ flexShrink: 0 }}>
                <MeasurementFigure
                  fieldKey={currentField?.key}
                  label={currentField?.label}
                  templateName={template?.name}
                  sex={bodySex}
                  height={196}
                  style={styles.figureCard}
                />
              </Animated.View>
              <Animated.View entering={animate && !reduceMotion ? detailsIn(slideDir) : undefined} style={styles.details}>
                <View style={styles.groupPill}>
                  <Text variant="overline" color={colors.textSecondary}>
                    {currentField?.group} · {fieldIndex + 1}/{fields.length}
                  </Text>
                </View>
                <Text accessibilityRole="header" variant="title" style={{ marginTop: 12 }}>
                  {currentField?.label}
                </Text>

                <View style={styles.valueRow} accessibilityLiveRegion="polite" accessible accessibilityLabel={`${currentValue || 0} ${unitText}`}>
                  <Animated.View
                    key={currentValue || "empty"}
                    entering={reduceMotion || !currentValue ? undefined : valuePop}
                    style={{ transformOrigin: "left bottom" }}
                  >
                    <Text weight="semibold" size={60} style={[measurementValue, { lineHeight: 60 }]} color={currentValue ? colors.ink : colors.borderStrong}>
                      {currentValue || "0"}
                    </Text>
                  </Animated.View>
                  <Text size={18} weight="medium" color={colors.textTertiary}>
                    {unitText}
                  </Text>
                </View>

                {prevVal ? (
                  <Text variant="label" color={colors.textTertiary} style={{ marginTop: 8 }}>
                    Last time{" "}
                    <Text variant="label" tabular weight="semibold" color={colors.textSecondary}>
                      {prevVal} {unitText}
                    </Text>
                    {previousSet ? ` · ${formatDate(previousSet.takenAt, { year: false })}` : null}
                  </Text>
                ) : null}
              </Animated.View>
            </View>

            <View style={styles.hints}>
              {method ? (
                <Text numberOfLines={2} variant="caption" color={colors.textTertiary} align="center" style={{ maxWidth: 448 }}>
                  {method}
                </Text>
              ) : null}
              {warning ? (
                <Animated.View entering={riseIn} accessibilityRole="alert" style={styles.warning}>
                  <AlertTriangle size={14} strokeWidth={2} color={colors.warning} />
                  <Text variant="caption" weight="semibold" color={colors.warning} style={{ flexShrink: 1 }}>
                    {warning}
                  </Text>
                </Animated.View>
              ) : null}
            </View>
          </Animated.View>
        </View>

        <View style={{ paddingBottom: Math.max(16, insets.bottom) }}>
          <Keypad
            value={currentValue}
            onChange={onChange}
            onNext={onNext}
            onPrevious={onPrevious}
            onSkip={onNext}
            showPrevious={fieldIndex > 0}
            nextLabel={nextField ? `Next · ${nextField.label}` : "Review"}
            unit={unit}
          />
        </View>
      </ScrollView>
    </LayoutAnimationConfig>
  );
}

// ---------------------------------------------------- measurement slides

const SLIDE_SPRING = { stiffness: 320, damping: 32, mass: 0.9 };
const EASE_EMPHASIZED = Easing.bezier(0.2, 0, 0, 1);

/** The whole card glides in from the side you're heading towards. */
function slideCardIn(dir: SharedValue<number>): EntryExitAnimationFunction {
  return () => {
    "worklet";
    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateX: dir.value * 72 }],
      },
      animations: {
        opacity: withTiming(1, { duration: 220 }),
        transform: [{ translateX: withSpring(0, SLIDE_SPRING) }],
      },
    };
  };
}

function slideCardOut(dir: SharedValue<number>): EntryExitAnimationFunction {
  return () => {
    "worklet";
    const cfg = { duration: 160, easing: Easing.in(Easing.ease) };
    return {
      initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
      animations: {
        opacity: withTiming(0, cfg),
        transform: [{ translateX: withTiming(dir.value * -72, cfg) }],
      },
    };
  };
}

/** The body figure turns in slightly behind the card for depth. */
function figureIn(dir: SharedValue<number>): EntryExitAnimationFunction {
  return () => {
    "worklet";
    return {
      initialValues: {
        transform: [{ translateX: dir.value * 28 }, { scale: 0.94 }, { rotate: `${dir.value * 2}deg` }],
      },
      animations: {
        transform: [{ translateX: withSpring(0, SLIDE_SPRING) }, { scale: withSpring(1, SLIDE_SPRING) }, { rotate: withSpring("0deg", SLIDE_SPRING) }],
      },
    };
  };
}

/** Name and value follow a beat later. */
function detailsIn(dir: SharedValue<number>): EntryExitAnimationFunction {
  return () => {
    "worklet";
    return {
      initialValues: {
        opacity: 0,
        transform: [{ translateX: dir.value * 44 }],
      },
      animations: {
        opacity: withDelay(40, withTiming(1, { duration: 220 })),
        transform: [{ translateX: withDelay(40, withSpring(0, SLIDE_SPRING)) }],
      },
    };
  };
}

/** Each keypress pops the hero value up from its baseline. */
const valuePop: EntryExitAnimationFunction = () => {
  "worklet";
  const spring = { stiffness: 600, damping: 26 };
  return {
    initialValues: { transform: [{ scale: 0.9 }, { translateY: 4 }] },
    animations: {
      transform: [{ scale: withSpring(1, spring) }, { translateY: withSpring(0, spring) }],
    },
  };
};

/** `animate-rise-in`: 8px up with a fade, slow emphasized easing. */
const riseIn: EntryExitAnimationFunction = () => {
  "worklet";
  const cfg = { duration: 320, easing: EASE_EMPHASIZED };
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 8 }] },
    animations: {
      opacity: withTiming(1, cfg),
      transform: [{ translateY: withTiming(0, cfg) }],
    },
  };
};

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    paddingVertical: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  figureCard: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: hairline,
  },
  details: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  groupPill: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  valueRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  hints: { marginTop: 12, minHeight: 28, alignItems: "center", gap: 8 },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: colors.warningBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});

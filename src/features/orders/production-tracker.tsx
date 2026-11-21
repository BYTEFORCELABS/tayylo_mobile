// Live production status, animated like a delivery tracker: the progress
// line fills with a spring, finished stages draw their tick, the current
// stage pulses, and the headline rolls to the new stage.
// Port of the web's src/components/order/production-tracker.tsx.

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type EntryExitAnimationFunction,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleHelp,
  CircleX,
  Clock,
  PackageCheck,
  Ruler,
  Scissors,
  Spool,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { colors, hairline, radii } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { PRODUCTION_PATH, normalizeStatus, statusLabel } from "@/lib/orders";
import type { OrderStatusName } from "@/types";

const STAGE: Record<OrderStatusName, { icon: LucideIcon; line: string }> = {
  pending: { icon: Clock, line: "Order received — waiting to be cut" },
  cutting: { icon: Scissors, line: "Fabric is being marked and cut" },
  sewing: { icon: Spool, line: "Panels are being stitched together" },
  fitting: { icon: Ruler, line: "Ready for the client to try on" },
  alterations: { icon: Wrench, line: "Adjusting after the fitting" },
  ready: { icon: PackageCheck, line: "Finished and waiting for pickup" },
  delivered: { icon: BadgeCheck, line: "Collected by the client" },
  cancelled: { icon: CircleX, line: "This order was cancelled" },
};

/** The web's `{ type: "spring", stiffness: 260, damping: 26 }`. */
const SPRING = { stiffness: 260, damping: 26, mass: 1 };
/** Delivered: vivid green, as on the web (`bg-[#16A34A]`). */
const DELIVERED_GREEN = "#16A34A";

// ------------------------------------------------- keyed enter / exit motion

const iconEnter: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.4 }, { rotate: "-30deg" }] },
    animations: {
      opacity: withSpring(1, SPRING),
      transform: [{ scale: withSpring(1, SPRING) }, { rotate: withSpring("0deg", SPRING) }],
    },
  };
};
const iconExit: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }, { rotate: "0deg" }] },
    animations: {
      opacity: withSpring(0, SPRING),
      transform: [{ scale: withSpring(0.4, SPRING) }, { rotate: withSpring("30deg", SPRING) }],
    },
  };
};

/** Vertical roll: in from `from`, out towards `-from`. */
function rollIn(from: number): EntryExitAnimationFunction {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 0, transform: [{ translateY: from }] },
      animations: { opacity: withSpring(1, SPRING), transform: [{ translateY: withSpring(0, SPRING) }] },
    };
  };
}
function rollOut(to: number): EntryExitAnimationFunction {
  return () => {
    "worklet";
    return {
      initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
      animations: { opacity: withSpring(0, SPRING), transform: [{ translateY: withSpring(to, SPRING) }] },
    };
  };
}
const headlineIn = rollIn(28);
const headlineOut = rollOut(-28);
const nextIn = rollIn(20);
const nextOut = rollOut(-20);

interface Props {
  /** Stored status; unknown values are shown safely rather than crashing. */
  status: OrderStatusName | string;
  /** Persist a new status. The tracker updates immediately (optimistic). */
  onChange: (next: OrderStatusName) => Promise<void>;
  onOpenAll: () => void;
  updating?: boolean;
}

export function ProductionTracker({ status, onChange, onOpenAll, updating }: Props) {
  const reduce = useReducedMotion();

  const known = normalizeStatus(status);
  // Alterations sit on the "Fitting" step of the track.
  const trackStatus = known === "alterations" ? "fitting" : known;
  const index = trackStatus ? PRODUCTION_PATH.indexOf(trackStatus) : -1;
  const last = PRODUCTION_PATH.length - 1;
  // Unknown status: offer to start the production path from the beginning.
  const next = !known ? "pending" : index >= 0 && index < last ? PRODUCTION_PATH[index + 1] : undefined;
  // Mistakes happen: the previous stage is always one tap away.
  const prev = index > 0 ? PRODUCTION_PATH[index - 1] : undefined;
  const cancelled = known === "cancelled";
  const stage = known
    ? STAGE[known]
    : { icon: CircleHelp, line: "This status isn't one Tayylo tracks — choose one under All statuses." };
  const Icon = stage.icon;
  const label = statusLabel(String(status));

  // Celebrate forward moves with a small burst + haptic tick. Tracked with
  // render-time state (React's "adjust state on prop change" pattern).
  const [prevIndex, setPrevIndex] = React.useState(index);
  const [burst, setBurst] = React.useState(0);
  if (index !== prevIndex) {
    if (index > prevIndex) setBurst(b => b + 1);
    setPrevIndex(index);
  }
  React.useEffect(() => {
    if (burst === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [burst]);

  const fillPct = index <= 0 ? 0 : (index / last) * 100;
  const fill = useSharedValue(fillPct);
  React.useEffect(() => {
    fill.value = reduce ? fillPct : withSpring(fillPct, { stiffness: 90, damping: 18, mass: 1 });
  }, [fillPct, reduce, fill]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value}%` }));

  const iconBg = cancelled ? colors.dangerBg : known === "delivered" ? DELIVERED_GREEN : !known ? colors.surfaceSunken : colors.ink;
  const iconFg = cancelled ? colors.danger : known === "delivered" ? colors.white : !known ? colors.textSecondary : colors.textInverse;

  return (
    <View style={styles.card}>
      {/* Headline */}
      <View style={styles.headline}>
        <View style={styles.iconBox}>
          <Animated.View
            key={String(status)}
            entering={reduce ? undefined : iconEnter}
            exiting={reduce ? undefined : iconExit}
            style={[styles.icon, { backgroundColor: iconBg }]}
          >
            <Icon size={22} strokeWidth={1.75} color={iconFg} />
          </Animated.View>
        </View>
        <View style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <Text variant="caption" weight="medium" color={colors.textTertiary}>
            {cancelled || index < 0 ? "Production" : `Stage ${index + 1} of ${PRODUCTION_PATH.length}`}
          </Text>
          <View style={styles.titleBox}>
            <Animated.View
              key={String(status)}
              entering={reduce ? undefined : headlineIn}
              exiting={reduce ? undefined : headlineOut}
              style={styles.titleRoll}
            >
              <Text accessibilityRole="header" numberOfLines={1} size={24} weight="semibold" style={styles.title}>
                {label}
              </Text>
            </Animated.View>
          </View>
          <Animated.View key={String(status)} entering={reduce ? undefined : FadeIn.duration(180)}>
            <Text variant="label" color={colors.textSecondary}>
              {stage.line}
            </Text>
          </Animated.View>
        </View>
        <Button variant="ghost" size="sm" onPress={onOpenAll} style={{ marginRight: -8, marginTop: -4 }}>
          All statuses
        </Button>
      </View>

      {/* Track */}
      {!cancelled && (
        <View style={styles.trackWrap}>
          <View>
            {/* Base line and animated fill, from first to last node centre */}
            <View style={styles.baseLine} pointerEvents="none">
              <Animated.View style={[styles.fill, fillStyle]} />
            </View>

            <View accessibilityLabel="Production stages" style={styles.stages}>
              {PRODUCTION_PATH.map((s, i) => {
                const done = i < index;
                const current = i === index;
                return (
                  <View key={s} style={styles.stageCol}>
                    <Pressable
                      disabled={current || updating}
                      onPress={() => onChange(s)}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: current || !!updating, selected: current }}
                      accessibilityLabel={current ? `${statusLabel(s)} (current stage)` : `Set stage to ${statusLabel(s).toLowerCase()}`}
                      style={({ pressed }) => [styles.stageButton, pressed && !current && !updating && { transform: [{ scale: 0.95 }] }]}
                    >
                      <View style={styles.nodeBox}>
                        {current && !reduce && <Pulse />}
                        {current && burst > 0 && !reduce && <Burst key={burst} />}
                        <Node done={done} current={current} reduce={reduce} />
                      </View>
                      <Text
                        align="center"
                        size={11}
                        weight={current ? "semibold" : "regular"}
                        color={current ? colors.ink : done ? colors.textSecondary : colors.textTertiary}
                        style={{ lineHeight: 14 }}
                      >
                        {current && known === "alterations" ? "Alterations" : statusLabel(s)}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* Step back / move forward */}
      {(next || prev) && (
        <View style={styles.actions}>
          {prev && (
            <Button
              variant="secondary"
              onPress={() => onChange(prev)}
              disabled={updating}
              accessibilityLabel={`Move back to ${statusLabel(prev).toLowerCase()}`}
              icon={ArrowLeft}
              style={next ? { width: 48, paddingHorizontal: 0 } : { flex: 1, minWidth: 0 }}
            >
              {/* Phones show only the arrow when both buttons are present (web: max-sm:hidden). */}
              {next ? undefined : `Back to ${statusLabel(prev).toLowerCase()}`}
            </Button>
          )}
          {next && (
            <Button variant="primary" onPress={() => onChange(next)} disabled={updating} style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <View style={styles.nextLabel}>
                <Animated.View key={next} entering={reduce ? undefined : nextIn} exiting={reduce ? undefined : nextOut}>
                  <Text numberOfLines={1} style={styles.nextText}>
                    {known ? `Move to ${statusLabel(next).toLowerCase()}` : "Start at pending"}
                  </Text>
                </Animated.View>
              </View>
              <ArrowRight size={18} strokeWidth={2} color={colors.textInverse} />
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ nodes

const AnimatedPath = Animated.createAnimatedComponent(Path);
/** Length of "M5 12.5l4.5 4.5L19 7.5" (≈ 6.4 + 16.9). */
const TICK_LENGTH = 24;

function Node({ done, current, reduce }: { done: boolean; current: boolean; reduce: boolean }) {
  const target = done ? colors.olive : current ? colors.ink : colors.surfaceSunken;
  const scale = useSharedValue(current ? 1.15 : 1);
  const bg = useSharedValue<string>(target);
  React.useEffect(() => {
    const delay = done ? 0 : 150;
    scale.value = reduce ? (current ? 1.15 : 1) : withDelay(delay, withSpring(current ? 1.15 : 1, SPRING));
    bg.value = reduce ? target : withDelay(delay, withTiming(target, { duration: 260 }));
  }, [current, done, target, reduce, scale, bg]);
  const style = useAnimatedStyle(() => ({ backgroundColor: bg.value, transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.node, style]}>
      {done && <Tick reduce={reduce} />}
      {current && <View style={styles.currentDot} />}
    </Animated.View>
  );
}

/** The finished-stage tick draws itself in. */
function Tick({ reduce }: { reduce: boolean }) {
  const offset = useSharedValue(reduce ? 0 : TICK_LENGTH);
  React.useEffect(() => {
    if (!reduce) offset.value = withDelay(100, withTiming(0, { duration: 350 }));
  }, [reduce, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <Svg viewBox="0 0 24 24" width={14} height={14}>
      <AnimatedPath
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke={colors.textInverse}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={TICK_LENGTH}
        animatedProps={props}
      />
    </Svg>
  );
}

/** The current stage's soft olive ring, pulsing outwards. */
function Pulse() {
  const t = useSharedValue(0);
  React.useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 * (1 - t.value), transform: [{ scale: 1 + 1.1 * t.value }] }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.pulse, style]} />;
}

/** Eight dots that fly out from the newly reached stage. */
function Burst() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 8 }).map((_, k) => (
        <BurstDot key={k} angle={(k / 8) * Math.PI * 2} />
      ))}
    </View>
  );
}

function BurstDot({ angle }: { angle: number }) {
  const t = useSharedValue(0);
  React.useEffect(() => {
    t.value = withDelay(250, withTiming(1, { duration: 700, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }));
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * 26 * t.value },
      { translateY: Math.sin(angle) * 26 * t.value },
      { scale: 1 - 0.6 * t.value },
    ],
  }));
  return <Animated.View style={[styles.burstDot, style]} />;
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.surface,
  },
  headline: { flexDirection: "row", alignItems: "flex-start", gap: 16, paddingHorizontal: 20, paddingTop: 20 },
  iconBox: { width: 48, height: 48 },
  icon: { position: "absolute", width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  titleBox: { height: 32, overflow: "hidden" },
  titleRoll: { position: "absolute", left: 0, right: 0 },
  title: { lineHeight: 32, letterSpacing: -0.5 },
  trackWrap: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  baseLine: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 10,
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: colors.surfaceSunken,
  },
  fill: { height: "100%", borderRadius: 999, backgroundColor: colors.olive },
  stages: { flexDirection: "row", justifyContent: "space-between" },
  stageCol: { width: 48, alignItems: "center" },
  stageButton: { alignItems: "center", gap: 8, paddingHorizontal: 4, borderRadius: radii.control },
  nodeBox: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  node: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  currentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textInverse },
  pulse: { borderRadius: 12, backgroundColor: colors.olive },
  burstDot: {
    position: "absolute",
    left: 9,
    top: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.olive,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  nextLabel: { height: 20, overflow: "hidden", justifyContent: "center", flexShrink: 1 },
  nextText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.textInverse },
});

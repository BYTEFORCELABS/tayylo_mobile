// Tayylo's "done" mark: an olive seal with a stitched ring sewn around it
// and a cream tick drawn in, like a finished hem. Animated for big moments
// (saved, password updated); static at small sizes (toasts, list rows).
// Same artwork, timings and easing as the web component.

import * as React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Mask, Path, RadialGradient, Stop } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const OLIVE = "#454F2C";
const OLIVE_DEEP = "#2E3420";
const CREAM = "#F3EFE3";
const RING = 2 * Math.PI * 24.5;
const TICK = 32.6;

interface SuccessMarkProps {
  size?: number;
  /** Plays the sewing + tick animation once on mount. */
  animated?: boolean;
  /** `light` for dark surfaces (toasts on ink). */
  tone?: "olive" | "light";
  label?: string;
}

let uid = 0;

export function SuccessMark({ size = 64, animated = true, tone = "olive", label }: SuccessMarkProps) {
  const light = tone === "light";
  const mark = light ? "#1E2019" : CREAM;
  const reduce = useReducedMotion();
  const play = animated && !reduce;
  const small = size < 28;
  const id = React.useMemo(() => `sm${uid++}`, []);

  const sew = useSharedValue(play ? 0 : 1);
  const tick = useSharedValue(play ? 0 : 1);
  const seal = useSharedValue(play ? 0 : 1);
  const halo = useSharedValue(0);
  const spark = useSharedValue(0);

  React.useEffect(() => {
    if (!play) return;
    seal.value = withSpring(1, { stiffness: 380, damping: 22 });
    sew.value = withTiming(1, { duration: 550, easing: Easing.bezier(0.4, 0, 0.2, 1) });
    tick.value = withDelay(420, withTiming(1, { duration: 380, easing: Easing.bezier(0.65, 0, 0.35, 1) }));
    halo.value = withDelay(350, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
    spark.value = withDelay(700, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: RING * (1 - sew.value) }));
  const tickProps = useAnimatedProps(() => ({ strokeDashoffset: TICK * (1 - tick.value) }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, seal.value * 1.4),
    transform: [{ scale: 0.5 + 0.5 * seal.value }, { rotate: `${-20 * (1 - seal.value)}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - halo.value),
    transform: [{ scale: 0.6 + 1.1 * halo.value }],
  }));

  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? "image" : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? "yes" : "no-hide-descendants"}
      style={{ width: size, height: size }}
    >
      {play && <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: OLIVE }, haloStyle]} />}

      <Animated.View style={sealStyle}>
        <Svg viewBox="0 0 64 64" width={size} height={size}>
          <Defs>
            <RadialGradient id={`${id}-dome`} cx="50%" cy="22%" r="80%">
              <Stop offset="0%" stopColor={light ? "#DCE5BF" : "#5C6A3B"} />
              <Stop offset="60%" stopColor={light ? "#B7C49A" : OLIVE} />
              <Stop offset="100%" stopColor={light ? "#93A26E" : OLIVE_DEEP} />
            </RadialGradient>
            <Mask id={`${id}-sew`}>
              <AnimatedCircle
                cx="32"
                cy="32"
                r="24.5"
                fill="none"
                stroke="#fff"
                strokeWidth={5}
                strokeDasharray={`${RING} ${RING}`}
                transform="rotate(-90 32 32)"
                animatedProps={ringProps}
              />
            </Mask>
          </Defs>
          <Circle cx="32" cy="32" r="31" fill={`url(#${id}-dome)`} />
          <Circle cx="32" cy="32" r="30.5" fill="none" stroke="#fff" strokeOpacity={0.14} />
          <Circle
            cx="32"
            cy="32"
            r="24.5"
            fill="none"
            stroke={mark}
            strokeOpacity={small ? 0.5 : 0.75}
            strokeWidth={small ? 2 : 1.6}
            strokeLinecap="round"
            strokeDasharray={small ? undefined : "3.2 3.4"}
            mask={`url(#${id}-sew)`}
          />
          <AnimatedPath
            d="M21 33.5l7.5 7.5L44 25.5"
            fill="none"
            stroke={mark}
            strokeWidth={small ? 5.5 : 4.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${TICK} ${TICK}`}
            animatedProps={tickProps}
          />
        </Svg>
      </Animated.View>

      {play && Array.from({ length: 6 }).map((_, i) => <Spark key={i} index={i} size={size} progress={spark} />)}
    </View>
  );
}

function Spark({ index, size, progress }: { index: number; size: number; progress: { value: number } }) {
  const a = (index / 6) * Math.PI * 2 - Math.PI / 2;
  const r = size * 0.72;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.5 ? p * 2 : (1 - p) * 2,
      transform: [{ translateX: Math.cos(a) * r * p }, { translateY: Math.sin(a) * r * p }, { rotate: `${(a * 180) / Math.PI}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        { position: "absolute", left: size / 2 - 3.5, top: size / 2 - 1, width: 7, height: 2, borderRadius: 2, backgroundColor: OLIVE },
        style,
      ]}
    />
  );
}


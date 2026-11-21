import * as React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { motion } from "@/theme/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Scale while pressed — the web's `active:scale-[0.97]` (0.9 for icon buttons). */
  scaleTo?: number;
  /** Light haptic tick on press (keypad keys, toggles). */
  haptic?: boolean;
}

/** Touch target with the product's press feedback: a quick 120ms scale-down. */
export function PressableScale({ scaleTo = motion.pressScale, haptic, style, onPressIn, onPressOut, onPress, disabled, ...props }: PressableScaleProps) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = React.useState(false);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={e => {
        scale.value = withTiming(scaleTo, { duration: motion.fast });
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        scale.value = withTiming(1, { duration: motion.fast });
        setPressed(false);
        onPressOut?.(e);
      }}
      onPress={e => {
        if (haptic) Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={[typeof style === "function" ? style({ pressed }) : style, animated]}
      {...props}
    />
  );
}

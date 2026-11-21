// Brand loading state for auth buttons: a needle pulls a dashed thread
// across the button — a tailor "stitching you in" — instead of a spinner.

import * as React from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Line } from "react-native-svg";
import { colors } from "@/theme/tokens";
import { Text } from "@/components/ui/text";

export function StitchLoader({ label, color = colors.textInverse }: { label: string; color?: string }) {
  const [width, setWidth] = React.useState(0);
  const travel = useSharedValue(0);
  const bob = useSharedValue(0);

  React.useEffect(() => {
    travel.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.linear }), -1, false);
    bob.value = withRepeat(withTiming(1, { duration: 450, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [travel, bob]);

  const thread = useAnimatedStyle(() => ({
    width: Math.min(1, travel.value / 0.85) * width,
    opacity: travel.value > 0.85 ? 1 - (travel.value - 0.85) / 0.15 : 1,
  }));
  const needle = useAnimatedStyle(() => ({
    transform: [{ translateX: travel.value * width - 11 }, { translateY: bob.value * 5 - 2.5 }, { rotate: `${-35 + bob.value * 70}deg` }],
  }));

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ alignSelf: "stretch", alignItems: "center", gap: 6, paddingHorizontal: 40 }}>
      <Text size={15} weight="semibold" color={color}>
        {label}
      </Text>
      <View style={{ height: 12, alignSelf: "stretch" }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[{ position: "absolute", left: 0, top: 5, height: 0, borderTopWidth: 2, borderStyle: "dashed", borderColor: color }, thread]} />
        <Animated.View style={[{ position: "absolute", left: 0, top: -5 }, needle]}>
          <Svg width={22} height={22} viewBox="0 0 22 22">
            <Line x1={3} y1={19} x2={19} y2={3} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={17.2} cy={4.8} r={1.4} fill={colors.olive} />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

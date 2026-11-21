// Plays the lockup reveal once per cold start over deep olive, then
// dissolves into the app — the native counterpart of the web's per-session
// SplashScreen. Tapping skips it; reduced-motion users skip it entirely.

import * as React from "react";
import { Pressable, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { FadeOut, useReducedMotion } from "react-native-reanimated";
import LottieView from "lottie-react-native";
import { colors } from "@/theme/tokens";

const lockup = require("../../assets/lottie/tayylo-lockup-cream.json");

/** Hard ceiling — the brand reveal never holds the user longer than this. */
const SAFETY_TIMEOUT_MS = 2600;

export function BrandSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const reduce = useReducedMotion();
  const { width } = useWindowDimensions();
  const [visible, setVisible] = React.useState(!reduce);
  const finish = React.useCallback(() => setVisible(false), []);

  React.useEffect(() => {
    if (!visible) onDone();
  }, [visible, onDone]);

  React.useEffect(() => {
    if (!visible) return;
    const t = setTimeout(finish, SAFETY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [visible, finish]);

  if (!visible) return null;
  const size = Math.min(width * 0.52, 220);
  return (
    <Animated.View exiting={FadeOut.duration(380)} style={[StyleSheet.absoluteFill, styles.wrap]}>
      <Pressable style={styles.center} onPress={finish} accessibilityLabel="Skip intro">
        {ready && <LottieView source={lockup} autoPlay loop={false} onAnimationFinish={finish} style={{ width: size, height: size * (450 / 1872) * 1.6 }} resizeMode="contain" />}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.panel, zIndex: 9999 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});

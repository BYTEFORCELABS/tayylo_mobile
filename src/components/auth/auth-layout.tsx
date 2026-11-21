// Shared frame for sign-in, sign-up, password reset and onboarding — the
// web's single calm phone column: logo (or progress) on top, a quiet
// tailor's-tape ruler under it, then the form.

import * as React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/brand/logo";
import { alpha, colors } from "@/theme/tokens";

export function AuthLayout({ children, top }: { children: React.ReactNode; /** Replaces the logo row (e.g. onboarding progress). */ top?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: Math.max(24, insets.bottom) }]}
      >
        <View style={styles.column}>
          <View style={styles.top}>
            {top ?? (
              <Pressable onPress={() => router.replace("/welcome")} accessibilityLabel="Tayylo" accessibilityRole="link">
                <Logo height={26} />
              </Pressable>
            )}
          </View>
          {!top && <TapeStrip />}
          <View style={styles.main}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A tailor's tape: minor ticks every 8px, major every 40px, fading at both ends. */
function TapeStrip() {
  const [width, setWidth] = React.useState(0);
  const color = alpha(colors.olive, 0.35);
  const ticks: React.ReactNode[] = [];
  for (let x = 0; x < width; x += 8) {
    const major = x % 40 === 0;
    ticks.push(<Line key={x} x1={x + 0.5} x2={x + 0.5} y1={0} y2={major ? 10 : 4} stroke={color} strokeWidth={major ? 1.5 : 1} />);
  }
  return (
    <View importantForAccessibility="no-hide-descendants" style={styles.tape} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={10}>
          {ticks}
        </Svg>
      )}
      {/* Fade the ends into the canvas, like the web's mask-image. */}
      <LinearGradient
        pointerEvents="none"
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        colors={[colors.canvas, alpha(colors.canvas, 0), alpha(colors.canvas, 0), colors.canvas]}
        locations={[0, 0.15, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: 24 },
  column: { flex: 1, width: "100%", maxWidth: 400, alignSelf: "center" },
  top: { height: 80, alignItems: "center", justifyContent: "center" },
  tape: { height: 10, width: "100%" },
  main: { flex: 1, paddingTop: 16 },
});

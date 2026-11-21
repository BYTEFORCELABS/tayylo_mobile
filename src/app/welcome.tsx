// Welcome — the web's three-slide introduction: brand photography in a
// rounded olive frame, auto-advancing progress segments, swipe between
// slides, then "Get started" / "Sign in".

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { Easing, FadeInDown, FadeOutUp, cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { resolveImage } from "@/lib/static-images";
import { colors, radii } from "@/theme/tokens";

const slides = [
  {
    image: "/pictures/tailorwithtablet.jpg",
    headline: "Find any client in two seconds",
    caption: "Every measurement, order and fitting note searchable the moment they call.",
  },
  {
    image: "/pictures/tailorpic2.jpg",
    headline: "Measure at the speed of a tape",
    caption: "A keypad built for tailor fractions, so recording a fitting is as fast as taking one.",
  },
  {
    image: "/pictures/suittailorimage.jpg",
    headline: "Every measurement, kept as a dated version",
    caption: "Nothing is overwritten. See exactly how a client's fit has changed, visit to visit.",
  },
];

const AUTO_ADVANCE_MS = 5000;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const [index, setIndex] = React.useState(0);
  const isLast = index === slides.length - 1;

  React.useEffect(() => {
    if (isLast) return;
    const t = setTimeout(() => setIndex(i => Math.min(i + 1, slides.length - 1)), AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [index, isLast]);

  const goTo = React.useCallback((i: number) => setIndex(Math.max(0, Math.min(slides.length - 1, i))), []);
  const step = React.useCallback((d: number) => setIndex(i => Math.max(0, Math.min(slides.length - 1, i + d))), []);

  const swipe = usePanGesture({
    activeOffsetX: [-12, 12],
    onDeactivate: e => {
      "worklet";
      if (e.translationX < -60) scheduleOnRN(step, 1);
      else if (e.translationX > 60) scheduleOnRN(step, -1);
    },
  });

  const slide = slides[index];

  return (
    <View style={styles.screen}>
      {/* Photo */}
      <View style={[styles.photoWrap, { paddingTop: Math.max(12, insets.top) }]}>
        <GestureDetector gesture={swipe}>
          <View style={styles.photo}>
            {slides.map((s, i) => (
              <Image
                key={s.image}
                source={resolveImage(s.image)}
                style={[StyleSheet.absoluteFill, { opacity: i === index ? 1 : 0 }]}
                contentFit="cover"
                transition={500}
                priority="high"
              />
            ))}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(46,52,32,0.7)", "rgba(46,52,32,0)", "rgba(46,52,32,0)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.logo} pointerEvents="none">
              <Logo tone="cream" height={26} />
            </View>
          </View>
        </GestureDetector>
      </View>

      {/* Copy and actions */}
      <View style={[styles.copy, { paddingBottom: Math.max(24, insets.bottom) }]}>
        <View accessibilityRole="tablist" accessibilityLabel="Introduction" style={styles.progress}>
          {slides.map((s, i) => (
            <Pressable
              key={s.image}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === index }}
              accessibilityLabel={`Slide ${i + 1} of ${slides.length}`}
              onPress={() => goTo(i)}
              style={styles.segmentHit}
            >
              <View style={styles.segment}>
                <Segment state={i < index || (i === index && isLast) ? "full" : i === index ? "running" : "empty"} runKey={index} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ minHeight: 148 }} accessibilityLiveRegion="polite">
          <Animated.View key={index} entering={FadeInDown.duration(250)} exiting={FadeOutUp.duration(200)}>
            <Text size={30} weight="semibold" style={{ lineHeight: 33, letterSpacing: -0.75 }}>
              {slide.headline}
            </Text>
            <Text variant="body" color={colors.textSecondary} style={{ marginTop: 12 }}>
              {slide.caption}
            </Text>
          </Animated.View>
        </View>

        <View style={{ marginTop: 24, gap: 12 }}>
          {isLast ? (
            <Button size="lg" block onPress={() => router.push("/auth?mode=signup")}>
              Get started
            </Button>
          ) : (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                size="lg"
                variant="ghost"
                color={colors.oliveDeep}
                style={{ flex: 1, borderWidth: 2, borderColor: colors.olive }}
                onPress={() => goTo(slides.length - 1)}
              >
                Skip
              </Button>
              <Button size="lg" style={{ flex: 1 }} onPress={() => goTo(index + 1)}>
                Next
              </Button>
            </View>
          )}
          <View style={styles.signInRow}>
            <Text variant="label" color={colors.textTertiary}>
              Already have an account?{" "}
            </Text>
            <Pressable onPress={() => router.push("/auth?mode=signin")} accessibilityRole="link" hitSlop={8}>
              <Text variant="label" weight="semibold">
                Sign in
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/** One progress segment; the current one fills over AUTO_ADVANCE_MS. */
function Segment({ state, runKey }: { state: "full" | "running" | "empty"; runKey: number }) {
  const progress = useSharedValue(state === "full" ? 1 : 0);
  React.useEffect(() => {
    cancelAnimation(progress);
    if (state === "running") {
      progress.value = 0;
      progress.value = withTiming(1, { duration: AUTO_ADVANCE_MS, easing: Easing.linear });
    } else progress.value = state === "full" ? 1 : 0;
  }, [state, runKey, progress]);
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return <Animated.View style={[styles.segmentFill, fill]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  photoWrap: { flex: 1, paddingHorizontal: 12, paddingBottom: 0 },
  photo: { flex: 1, minHeight: 320, overflow: "hidden", borderRadius: radii.panel, backgroundColor: colors.panel },
  logo: { position: "absolute", left: 24, top: 24 },
  copy: { paddingHorizontal: 24, paddingTop: 20 },
  progress: { marginBottom: 24, flexDirection: "row", gap: 6 },
  segmentHit: { flex: 1, height: 24, justifyContent: "center" },
  segment: { height: 4, overflow: "hidden", borderRadius: 999, backgroundColor: colors.surfaceSunken },
  segmentFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: colors.ink },
  signInRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
});

import * as React from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, WifiOff } from "lucide-react-native";
import { colors, hairline, radii, shadows } from "@/theme/tokens";
import { Button } from "./button";
import { Text } from "./text";

// --------------------------------------------------------------- Skeleton

interface SkeletonProps {
  variant?: "text" | "circular" | "rectangular";
  width?: DimensionValue;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
}

/** Shimmering placeholder — surface-sunken → beige-light sweep, 1.6s. */
export function Skeleton({ variant = "text", width, height, style }: SkeletonProps) {
  const x = useSharedValue(0);
  React.useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [x]);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: `${-100 + x.value * 200}%` }] }));
  const radius = variant === "rectangular" ? radii.card : variant === "circular" ? 9999 : 9999;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: width ?? "100%", height: height ?? (variant === "text" ? 16 : undefined), borderRadius: radius },
        styles.skeleton,
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, sweep]}>
        <LinearGradient
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          colors={[colors.surfaceSunken, colors.beigeLight, colors.surfaceSunken]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Wraps skeleton blocks; fades in after a short delay so quick loads never flash. */
export function LoadingRegion({ label = "Loading", children, style }: { label?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.delay(180).duration(200)} accessibilityLabel={label} accessibilityRole="progressbar" style={style}>
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------- EmptyState

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

interface EmptyStateProps {
  icon?: IconComponent;
  /** Custom illustration instead of a lucide icon (garment art, success mark). */
  art?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** `inset` sits inside a card/tab; `page` fills a screen. */
  variant?: "page" | "inset";
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon: Icon, art, title, description, action, variant = "page", style }: EmptyStateProps) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={[styles.empty, variant === "page" ? styles.emptyPage : styles.emptyInset, style]}>
      {art ??
        (Icon ? (
          <View style={styles.emptyIcon}>
            <Icon size={24} strokeWidth={1.75} color={colors.textSecondary} />
          </View>
        ) : null)}
      <Text variant="headline" align="center">
        {title}
      </Text>
      {description ? (
        typeof description === "string" ? (
          <Text variant="label" color={colors.textSecondary} align="center" style={styles.emptyDesc}>
            {description}
          </Text>
        ) : (
          description
        )
      ) : null}
      {action ? <View style={{ marginTop: 20 }}>{action}</View> : null}
    </Animated.View>
  );
}

// ------------------------------------------------------------- ErrorState

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn’t load this. Check your connection and try again.",
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} accessibilityRole="alert" style={[styles.empty, styles.emptyPage, style]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerBg }]}>
        <AlertCircle size={24} strokeWidth={1.75} color={colors.danger} />
      </View>
      <Text variant="headline" align="center">
        {title}
      </Text>
      <Text variant="label" color={colors.textSecondary} align="center" style={styles.emptyDesc}>
        {description}
      </Text>
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry} style={{ marginTop: 20 }}>
          Try again
        </Button>
      ) : null}
    </Animated.View>
  );
}

// ---------------------------------------------------------- Offline banner

export function useOnline() {
  const [online, setOnline] = React.useState(true);
  React.useEffect(
    () =>
      NetInfo.addEventListener(s => {
        setOnline(s.isConnected !== false);
      }),
    []
  );
  return online;
}

/** Self-managing: renders only while the device reports it is offline. */
export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.offline, { top: Math.max(12, insets.top) }]}
    >
      <WifiOff size={16} strokeWidth={1.75} color={colors.textInverse} />
      <Text variant="label" weight="medium" color={colors.textInverse} style={{ flexShrink: 1 }}>
        You&apos;re offline. Changes won&apos;t save until you reconnect.
      </Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------- Skeleton sets

export function ListSkeleton({ count = 5, avatar = true }: { count?: number; avatar?: boolean }) {
  return (
    <LoadingRegion>
      <View style={styles.listSkel}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={[styles.listSkelRow, i > 0 && styles.listSkelDivider]}>
            {avatar && <Skeleton variant="circular" width={40} height={40} />}
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width={`${55 - (i % 3) * 10}%`} height={14} />
              <Skeleton width="35%" height={12} />
            </View>
            <Skeleton width={56} height={12} />
          </View>
        ))}
      </View>
    </LoadingRegion>
  );
}

export const ClientListSkeleton = ListSkeleton;

export function MeasurementGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <LoadingRegion>
      <View style={styles.gridSkel}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.gridSkelCell}>
            <Skeleton width="50%" height={12} />
            <Skeleton width="40%" height={24} />
          </View>
        ))}
      </View>
    </LoadingRegion>
  );
}

const styles = StyleSheet.create({
  skeleton: { overflow: "hidden", backgroundColor: colors.surfaceSunken },
  empty: { alignItems: "center" },
  emptyPage: { paddingVertical: 64, paddingHorizontal: 24 },
  emptyInset: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(207,203,190,0.7)",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  emptyIcon: {
    marginBottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyDesc: { marginTop: 6, maxWidth: 320 },
  offline: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    boxShadow: shadows.float,
  },
  listSkel: { overflow: "hidden", borderRadius: radii.card, borderWidth: 1, borderColor: hairline, backgroundColor: colors.surface },
  listSkelRow: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, paddingHorizontal: 16, paddingVertical: 14 },
  listSkelDivider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.divider },
  gridSkel: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1,
    overflow: "hidden",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.divider,
  },
  gridSkelCell: { width: "49.8%", flexGrow: 1, gap: 8, backgroundColor: colors.surface, padding: 16 },
});

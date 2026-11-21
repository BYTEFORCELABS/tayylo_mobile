import * as React from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { alpha, colors, shadows } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { PressableScale } from "./pressable";
import { Text } from "./text";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tonal"
  | "ghost"
  | "tertiary"
  | "inverse"
  | "inverse-ghost"
  | "destructive"
  | "destructive-filled";

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-lg";

interface VariantStyle {
  bg: string;
  pressedBg: string;
  fg: string;
  border?: string;
  shadow?: string;
  pressedShadow?: string;
  /** Top highlight gradient (.btn-raised / .btn-raised-light). */
  sheen?: [string, string, number];
}

// Same palette as the web's buttonVariants (src/components/ui/button.tsx).
const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: {
    bg: colors.olive,
    pressedBg: colors.oliveDeep,
    fg: colors.textInverse,
    shadow: shadows.raised,
    pressedShadow: shadows.raisedPressed,
    sheen: ["rgba(255,255,255,0.16)", "rgba(255,255,255,0)", 0.55],
  },
  secondary: {
    bg: colors.surfaceRaised,
    pressedBg: colors.surface,
    fg: colors.ink,
    border: alpha(colors.border, 0.8),
    shadow: shadows.raisedLight,
    pressedShadow: shadows.raisedLightPressed,
    sheen: ["rgba(255,255,255,0.9)", "rgba(255,255,255,0)", 0.7],
  },
  tonal: { bg: colors.oliveSoft, pressedBg: colors.oliveSoftPressed, fg: colors.oliveDeep },
  ghost: { bg: "transparent", pressedBg: alpha(colors.surfaceSunken, 0.7), fg: colors.ink },
  tertiary: { bg: "transparent", pressedBg: alpha(colors.oliveSoft, 0.6), fg: colors.olive },
  inverse: { bg: colors.textInverse, pressedBg: colors.white, fg: colors.oliveDeep },
  "inverse-ghost": { bg: "rgba(255,255,255,0.10)", pressedBg: "rgba(255,255,255,0.16)", fg: colors.textInverse },
  destructive: { bg: "transparent", pressedBg: colors.dangerBg, fg: colors.danger },
  "destructive-filled": {
    bg: colors.danger,
    pressedBg: colors.dangerPressed,
    fg: colors.textInverse,
    shadow: shadows.raised,
    pressedShadow: shadows.raisedPressed,
    sheen: ["rgba(255,255,255,0.16)", "rgba(255,255,255,0)", 0.55],
  },
};

const SIZES: Record<ButtonSize, { height: number; px: number; font: number; icon: number; square?: boolean }> = {
  sm: { height: 36, px: 16, font: 13, icon: 16 },
  md: { height: 44, px: 20, font: 14, icon: 18 },
  lg: { height: 52, px: 24, font: 15, icon: 20 },
  icon: { height: 44, px: 0, font: 14, icon: 20, square: true },
  "icon-sm": { height: 36, px: 0, font: 13, icon: 18, square: true },
  "icon-lg": { height: 52, px: 0, font: 15, icon: 22, square: true },
};

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  /** Shows a spinner, keeps the width, and disables the button. */
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Lucide icon before the label (or alone for icon sizes). */
  icon?: LucideIcon;
  /** Lucide icon after the label. */
  iconRight?: LucideIcon;
  /** Custom leading element (brand marks such as the Google "G"). */
  leading?: React.ReactNode;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** Overrides the label colour (rare: e.g. the welcome screen's outlined Skip). */
  color?: string;
  testID?: string;
}

/** Every button is a pill. Same variants and sizes as the web. */
export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  disabled,
  onPress,
  icon: Icon,
  iconRight: IconRight,
  leading,
  children,
  accessibilityLabel,
  style,
  color,
  testID,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const fg = color ?? v.fg;
  const inactive = disabled || loading;

  const label =
    typeof children === "string" || typeof children === "number" ? (
      <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: s.font, lineHeight: s.font * 1.15, color: fg }}>
        {children}
      </Text>
    ) : (
      children
    );

  const content = (
    <>
      {leading}
      {Icon && <Icon size={s.icon} color={fg} strokeWidth={2} />}
      {label}
      {IconRight && <IconRight size={s.icon} color={fg} strokeWidth={2} />}
    </>
  );

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={accessibilityLabel ?? (typeof children === "string" ? children : undefined)}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.height,
          minWidth: s.square ? s.height : undefined,
          width: s.square ? s.height : undefined,
          paddingHorizontal: s.px,
          backgroundColor: pressed ? v.pressedBg : v.bg,
          borderWidth: v.border ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: v.border,
          boxShadow: pressed ? v.pressedShadow : v.shadow,
          opacity: disabled && !loading ? 0.45 : 1,
        },
        block && styles.block,
        style,
      ]}
    >
      {v.sheen && (
        <LinearGradient
          pointerEvents="none"
          colors={[v.sheen[0], v.sheen[1]]}
          locations={[0, v.sheen[2]]}
          style={[StyleSheet.absoluteFill, styles.sheen]}
        />
      )}
      <View style={[styles.row, loading && styles.hidden]}>{content}</View>
      {loading && (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <ActivityIndicator size="small" color={fg} />
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    overflow: "visible",
  },
  block: { alignSelf: "stretch" },
  sheen: { borderRadius: 9999 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  hidden: { opacity: 0 },
  center: { alignItems: "center", justifyContent: "center" },
});

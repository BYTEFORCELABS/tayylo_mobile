import * as React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { X } from "lucide-react-native";
import { colors } from "@/theme/tokens";
import { normalizeStatus, statusLabel } from "@/lib/orders";
import { Text } from "./text";

type TagVariant = "default" | "beige" | "olive" | "solid" | "success" | "warning" | "danger" | "info" | "outline";

const TAG: Record<TagVariant, { bg: string; fg: string; border?: string }> = {
  default: { bg: colors.surfaceSunken, fg: colors.textSecondary },
  beige: { bg: colors.beigeLight, fg: colors.textSecondary },
  olive: { bg: colors.oliveSoft, fg: colors.oliveDeep },
  solid: { bg: colors.ink, fg: colors.textInverse },
  success: { bg: colors.successBg, fg: colors.success },
  warning: { bg: colors.warningBg, fg: colors.warning },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  info: { bg: colors.infoBg, fg: colors.info },
  outline: { bg: "transparent", fg: colors.textSecondary, border: colors.border },
};

const TAG_SIZE = { sm: { h: 24, px: 10, font: 11 }, md: { h: 28, px: 12, font: 12 }, lg: { h: 32, px: 14, font: 13 } };

export interface TagProps {
  variant?: TagVariant;
  size?: keyof typeof TAG_SIZE;
  children: React.ReactNode;
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Tag({ variant = "default", size = "md", children, onRemove, style }: TagProps) {
  const v = TAG[variant];
  const s = TAG_SIZE[size];
  return (
    <View
      style={[
        styles.tag,
        { height: s.h, paddingHorizontal: s.px, backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border ? 1 : 0 },
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text numberOfLines={1} size={s.font} weight="semibold" color={v.fg}>
          {children}
        </Text>
      ) : (
        children
      )}
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove" style={styles.remove}>
          <X size={11} strokeWidth={2.25} color={v.fg} />
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- Status

type Tone = "neutral" | "info" | "progress" | "olive" | "success" | "bright" | "pending" | "danger" | "muted";

const statusTone: Record<string, Tone> = {
  pending: "pending",
  cutting: "info",
  sewing: "info",
  fitting: "olive",
  alterations: "progress",
  ready: "success",
  delivered: "bright",
  overdue: "danger",
  cancelled: "muted",
};

const TONES: Record<Tone, { dot: string; text: string; bg: string }> = {
  neutral: { dot: colors.textTertiary, text: colors.textSecondary, bg: colors.surfaceSunken },
  info: { dot: colors.info, text: colors.info, bg: colors.infoBg },
  progress: { dot: colors.warning, text: colors.warning, bg: colors.warningBg },
  olive: { dot: colors.olive, text: colors.oliveDeep, bg: colors.oliveSoft },
  success: { dot: colors.success, text: colors.success, bg: colors.successBg },
  /** Vivid green — the job is done and handed over. */
  bright: { dot: "#16A34A", text: "#13803A", bg: "#D9F7E1" },
  /** Warm yellow — received, not started yet. */
  pending: { dot: "#E0A800", text: "#8A6400", bg: "#FFF3C4" },
  danger: { dot: colors.danger, text: colors.danger, bg: colors.dangerBg },
  muted: { dot: colors.borderStrong, text: colors.textTertiary, bg: colors.surfaceSunken },
};

export function statusColors(status: string) {
  const key = status === "overdue" ? "overdue" : (normalizeStatus(status) ?? "");
  return TONES[statusTone[key] ?? "neutral"];
}

interface StatusTagProps {
  status: string;
  label?: string;
  /** `pill` = tinted background; `dot` = text with a dot only (dense lists). */
  appearance?: "pill" | "dot";
  size?: "sm" | "md";
  style?: StyleProp<ViewStyle>;
}

export function StatusTag({ status, label, appearance = "pill", size = "md", style }: StatusTagProps) {
  const t = statusColors(status);
  const text = label ?? statusLabel(status);
  return (
    <View
      accessibilityLabel={`Status: ${text}`}
      style={[
        styles.status,
        appearance === "pill" && { backgroundColor: t.bg, height: size === "sm" ? 20 : 24, paddingHorizontal: size === "sm" ? 8 : 10 },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: t.dot }]} />
      <Text numberOfLines={1} size={size === "sm" ? 11 : 12} weight="semibold" color={t.text}>
        {text}
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------- Delta

export function DeltaChip({ label, direction, style }: { label: string; direction: "up" | "down"; style?: StyleProp<ViewStyle> }) {
  const up = direction === "up";
  return (
    <View style={[styles.delta, { backgroundColor: up ? colors.oliveSoft : colors.warningBg }, style]}>
      <Text tabular size={11} weight="semibold" color={up ? colors.oliveDeep : colors.warning}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, alignSelf: "flex-start" },
  remove: { marginRight: -4, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  status: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 3 },
  delta: { height: 20, borderRadius: 999, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
});

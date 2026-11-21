// Grouped list: one rounded surface with hairline dividers between rows.
// Used for clients, orders, settings rows, balances — anything scannable.

import * as React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { alpha, colors, hairline, radii } from "@/theme/tokens";
import { Text } from "./text";

export function List({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View accessibilityRole="list" style={[styles.list, style]}>
      {items.map((child, i) => (
        <React.Fragment key={(child as React.ReactElement).key ?? i}>
          {i > 0 && <View style={styles.divider} />}
          {child}
        </React.Fragment>
      ))}
    </View>
  );
}

export interface ListItemProps {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned value (money, date, status). */
  trailing?: React.ReactNode;
  /** Small text under trailing. */
  trailingSub?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  /** Extra content under the title row. */
  children?: React.ReactNode;
  tone?: "default" | "danger";
  /** Called on touch-down, to start loading the destination early. */
  onPrefetch?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  trailingSub,
  onPress,
  onLongPress,
  chevron,
  children,
  tone = "default",
  onPrefetch,
  style,
  accessibilityLabel,
}: ListItemProps) {
  const content = (
    <>
      {leading ? <View style={{ flexShrink: 0 }}>{leading}</View> : null}
      <View style={styles.main}>
        {typeof title === "string" ? (
          <Text numberOfLines={1} size={15} weight="semibold" color={tone === "danger" ? colors.danger : colors.ink}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle ? (
          typeof subtitle === "string" ? (
            <Text numberOfLines={1} variant="label" color={colors.textTertiary} style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : (
            <View style={{ marginTop: 2 }}>{subtitle}</View>
          )
        ) : null}
        {children}
      </View>
      {trailing || trailingSub ? (
        <View style={styles.trailing}>
          {typeof trailing === "string" ? <Text variant="label">{trailing}</Text> : trailing}
          {trailingSub ? (
            typeof trailingSub === "string" ? (
              <Text variant="caption" color={colors.textTertiary}>
                {trailingSub}
              </Text>
            ) : (
              trailingSub
            )
          ) : null}
        </View>
      ) : null}
      {chevron ? <ChevronRight size={18} strokeWidth={1.75} color={colors.textTertiary} /> : null}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPrefetch}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.beigeLight }, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, style]}>{content}</View>;
}

const ICON_TILE_TONES = {
  neutral: { bg: colors.surfaceSunken, fg: colors.textSecondary },
  olive: { bg: colors.oliveSoft, fg: colors.oliveDeep },
  danger: { bg: colors.dangerBg, fg: colors.danger },
  warning: { bg: colors.warningBg, fg: colors.warning },
  success: { bg: colors.successBg, fg: colors.success },
} as const;

const ICON_TILE_SIZES = { sm: [32, 16], md: [40, 18], lg: [48, 20] } as const;

/** Round icon tile used as a list leading element. Pass a lucide icon component. */
export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "md",
  style,
}: {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  tone?: keyof typeof ICON_TILE_TONES;
  size?: keyof typeof ICON_TILE_SIZES;
  style?: StyleProp<ViewStyle>;
}) {
  const t = ICON_TILE_TONES[tone];
  const [px, icon] = ICON_TILE_SIZES[size];
  return (
    <View style={[{ width: px, height: px, borderRadius: px / 2, backgroundColor: t.bg, alignItems: "center", justifyContent: "center" }, style]}>
      <Icon size={icon} color={t.fg} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    overflow: "hidden",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.surface,
  },
  divider: { height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.divider },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 64,
  },
  main: { flex: 1, minWidth: 0 },
  trailing: { flexShrink: 0, alignItems: "flex-end", gap: 2 },
});

export const pressedRow = alpha(colors.beigeLight, 0.6);

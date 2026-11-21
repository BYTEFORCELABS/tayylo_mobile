import * as React from "react";
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { colors } from "@/theme/tokens";
import { Text } from "./text";

interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  items: TabItem<T>[];
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/** Underlined, horizontally scrollable section tabs for detail screens. */
export function Tabs<T extends string>({ value, onChange, items, accessibilityLabel, style }: TabsProps<T>) {
  const [layouts, setLayouts] = React.useState<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const first = React.useRef(true);
  const current = layouts[value];

  React.useEffect(() => {
    if (!current) return;
    // Underline sits inset 12px from each side (inset-x-3 on the web).
    const tx = current.x + 12;
    const tw = Math.max(0, current.width - 24);
    if (first.current) {
      x.value = tx;
      w.value = tw;
      first.current = false;
    } else {
      x.value = withSpring(tx, { stiffness: 500, damping: 40 });
      w.value = withSpring(tw, { stiffness: 500, damping: 40 });
    }
  }, [current, x, w]);

  const underline = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));

  return (
    <View style={[styles.bar, style]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
        {items.map(t => {
          const selected = t.value === value;
          return (
            <Pressable
              key={t.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(t.value)}
              onLayout={(e: LayoutChangeEvent) => {
                const { x: lx, width } = e.nativeEvent.layout;
                setLayouts(l => (l[t.value]?.x === lx && l[t.value]?.width === width ? l : { ...l, [t.value]: { x: lx, width } }));
              }}
              style={styles.tab}
            >
              <Text variant="label" weight={selected ? "semibold" : "medium"} color={selected ? colors.ink : colors.textTertiary}>
                {t.label}
              </Text>
              {t.count !== undefined && t.count > 0 && (
                <View style={[styles.count, { backgroundColor: selected ? colors.ink : colors.surfaceSunken }]}>
                  <Text tabular size={11} color={selected ? colors.textInverse : colors.textTertiary} style={{ lineHeight: 20 }}>
                    {t.count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
        {current && <Animated.View style={[styles.underline, underline]} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1, borderBottomColor: colors.border, marginHorizontal: -16 },
  row: { paddingHorizontal: 16, gap: 4 },
  tab: { height: 48, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
  count: { borderRadius: 999, paddingHorizontal: 6, minWidth: 20, alignItems: "center" },
  underline: { position: "absolute", left: 0, bottom: -1, height: 2, borderRadius: 999, backgroundColor: colors.ink },
});

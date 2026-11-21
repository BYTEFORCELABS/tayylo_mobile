// Selection controls: SegmentedControl (2–4 mutually exclusive options),
// Chip (filter / pick from many), and SearchField.

import * as React from "react";
import { Pressable, StyleSheet, TextInput, View, type LayoutChangeEvent, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Search, X } from "lucide-react-native";
import { colors, shadows } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { PressableScale } from "./pressable";
import { Text } from "./text";

// ------------------------------------------------------- SegmentedControl

interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  accessibilityLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: "sm" | "md";
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}

const SPRING = { stiffness: 500, damping: 38, mass: 1 };

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  block,
  style,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const [layouts, setLayouts] = React.useState<Record<string, { x: number; width: number }>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const ready = React.useRef(false);

  const current = layouts[value];
  React.useEffect(() => {
    if (!current) return;
    if (!ready.current) {
      x.value = current.x;
      w.value = current.width;
      ready.current = true;
    } else {
      x.value = withSpring(current.x, SPRING);
      w.value = withSpring(current.width, SPRING);
    }
  }, [current, x, w]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));
  const h = size === "sm" ? 32 : 40;

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.segTrack, block ? styles.segBlock : styles.segInline, style]}>
      {current && <Animated.View style={[styles.segThumb, { height: h }, thumb]} />}
      {options.map(opt => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={opt.accessibilityLabel}
            onPress={() => onChange(opt.value)}
            onLayout={(e: LayoutChangeEvent) => {
              const { x: lx, width } = e.nativeEvent.layout;
              setLayouts(l => (l[opt.value]?.x === lx && l[opt.value]?.width === width ? l : { ...l, [opt.value]: { x: lx, width } }));
            }}
            style={[styles.segItem, { height: h, paddingHorizontal: size === "sm" ? 14 : 16 }, block && { flex: 1 }]}
          >
            {typeof opt.label === "string" ? (
              <Text numberOfLines={1} size={size === "sm" ? 12 : 13} weight="semibold" color={selected ? colors.ink : colors.textTertiary}>
                {opt.label}
              </Text>
            ) : (
              opt.label
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------------- Chip

interface ChipProps {
  selected?: boolean;
  count?: number;
  size?: "sm" | "md";
  leading?: React.ReactNode;
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Chip({ selected, count, size = "md", leading, children, onPress, style, accessibilityLabel }: ChipProps) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.chip,
        { height: size === "sm" ? 32 : 40, paddingHorizontal: size === "sm" ? 12 : 16 },
        selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        style,
      ]}
    >
      {leading}
      {typeof children === "string" ? (
        <Text numberOfLines={1} size={size === "sm" ? 12 : 13} weight="semibold" color={selected ? colors.textInverse : colors.textSecondary}>
          {children}
        </Text>
      ) : (
        children
      )}
      {count !== undefined && (
        <View style={[styles.chipCount, { backgroundColor: selected ? "rgba(255,255,255,0.15)" : colors.surfaceSunken }]}>
          <Text tabular size={11} color={selected ? colors.textInverse : colors.textTertiary} style={{ lineHeight: 20 }}>
            {count}
          </Text>
        </View>
      )}
    </PressableScale>
  );
}

// ------------------------------------------------------------ SearchField

interface SearchFieldProps extends Omit<TextInputProps, "onChange" | "value" | "style"> {
  value: string;
  onValueChange: (value: string) => void;
  size?: "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

export const SearchField = React.forwardRef<React.ComponentRef<typeof TextInput>, SearchFieldProps>(function SearchField(
  { value, onValueChange, size = "md", placeholder = "Search", style, onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={style}>
      <View
        style={[
          styles.search,
          { height: size === "lg" ? 48 : 44 },
          focused && { backgroundColor: colors.surfaceRaised, borderColor: colors.olive, boxShadow: "0px 0px 0px 4px rgba(69,79,44,0.12)" },
        ]}
      >
        <Search size={18} strokeWidth={1.75} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onValueChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={props.accessibilityLabel ?? placeholder}
          selectionColor={colors.olive}
          cursorColor={colors.olive}
          returnKeyType="search"
          autoCorrect={false}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={styles.searchInput}
          {...props}
        />
        {value ? (
          <Pressable onPress={() => onValueChange("")} accessibilityLabel="Clear search" hitSlop={6} style={styles.searchClear}>
            <X size={16} strokeWidth={2} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  segTrack: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: colors.surfaceSunken, padding: 4 },
  segBlock: { alignSelf: "stretch" },
  segInline: { alignSelf: "flex-start" },
  segThumb: { position: "absolute", left: 0, top: 4, borderRadius: 999, backgroundColor: colors.surfaceRaised, boxShadow: shadows.xs },
  segItem: { borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, flexShrink: 0 },
  chipCount: { minWidth: 20, borderRadius: 999, paddingHorizontal: 6, alignItems: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: colors.surfaceSunken,
  },
  searchIcon: { marginLeft: 16 },
  searchInput: { flex: 1, height: "100%", paddingLeft: 10, paddingRight: 44, fontSize: 16, fontFamily: fonts.regular, color: colors.ink },
  searchClear: { position: "absolute", right: 8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});

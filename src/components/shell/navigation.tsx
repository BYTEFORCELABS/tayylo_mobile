// Phone navigation, mirroring the web's FloatingNav: a floating, rounded
// tab bar with a raised centre "+" sitting in a groove cut out of the bar.
// Only the current tab is labelled; it turns green on a soft green pill.

import * as React from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Mask, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import type { BottomTabBarProps } from "expo-router/tabs";
import { ChevronRight, CircleUserRound, ClipboardList, Compass, House, IdCard, Plus, Ruler, ShoppingCart, UserPlus, UserRound, type LucideIcon } from "lucide-react-native";
import { colors, shadows } from "@/theme/tokens";
import { Text } from "@/components/ui/text";
import { PressableScale } from "@/components/ui/pressable";
import { BottomSheet } from "@/components/ui/sheet";
import { IconTile } from "@/components/ui/list";
import { useShell } from "./shell-context";

/** Phone tab bar wording and icons (route name → label/icon). */
const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  today: { label: "Home", icon: House },
  clients: { label: "Contact", icon: IdCard },
  orders: { label: "Orders", icon: ShoppingCart },
  settings: { label: "Profile", icon: CircleUserRound },
  discover: { label: "Explore", icon: Compass },
  account: { label: "Account", icon: UserRound },
};

const BAR_HEIGHT = 64;
const FAB = 64;
const GROOVE_R = 40.5;

/** Custom tabBar for expo-router Tabs. `withCreate` adds the centre "+" (tailors). */
export function FloatingNav({ state, emitter, navigateToTab, withCreate }: BottomTabBarProps & { withCreate?: boolean }) {
  const insets = useSafeAreaInsets();
  const openQuickAdd = useShell(s => s.openQuickAdd);
  const [width, setWidth] = React.useState(0);
  const routes = state.routes.filter(r => TABS[r.name]);
  const left = withCreate ? routes.slice(0, 2) : routes;
  const right = withCreate ? routes.slice(2) : [];

  const tab = (route: (typeof routes)[number]) => {
    const index = state.routes.indexOf(route);
    const active = state.index === index;
    const meta = TABS[route.name];
    const Icon = meta.icon;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={meta.label}
        onPress={() => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!active && !event.defaultPrevented) navigateToTab(route.key);
        }}
        style={styles.tab}
      >
        <View style={styles.pillWrap}>
          {active && <Animated.View entering={FadeIn.duration(160)} style={styles.pill} />}
          <Icon size={23} strokeWidth={active ? 2.1 : 1.6} color={active ? colors.navActive : colors.textSecondary} />
        </View>
        {active && (
          <Animated.View entering={FadeIn.duration(180)} layout={LinearTransition}>
            <Text size={11} weight="semibold" color={colors.navActive} style={{ lineHeight: 12 }}>
              {meta.label}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(12, insets.bottom) }]}>
      <View style={styles.inner} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.barShadow, !withCreate && { backgroundColor: colors.surfaceRaised }]}>
          {withCreate && width > 0 && (
            <Svg width={width} height={BAR_HEIGHT} style={StyleSheet.absoluteFill}>
              <Defs>
                <Mask id="groove">
                  <Rect x={0} y={0} width={width} height={BAR_HEIGHT} rx={BAR_HEIGHT / 2} fill="#fff" />
                  <Circle cx={width / 2} cy={4} r={GROOVE_R} fill="#000" />
                </Mask>
              </Defs>
              <Rect x={0} y={0} width={width} height={BAR_HEIGHT} rx={BAR_HEIGHT / 2} fill={colors.surfaceRaised} mask="url(#groove)" />
            </Svg>
          )}
          <View style={styles.row}>
            {left.map(tab)}
            {withCreate && <View style={{ width: 84 }} />}
            {right.map(tab)}
          </View>
        </View>

        {withCreate && (
          <PressableScale
            scaleTo={0.92}
            onPress={openQuickAdd}
            accessibilityLabel="Create: add client, record measurements or new order"
            style={({ pressed }) => [styles.fab, { backgroundColor: pressed ? colors.oliveDeep : colors.olive }]}
          >
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0)", "rgba(0,0,0,0.18)"]}
              locations={[0, 0.55, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: FAB / 2 }]}
            />
            <Plus size={28} strokeWidth={2.25} color={colors.textInverse} />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------- Create sheet

const QUICK_ACTIONS = [
  { icon: Ruler, label: "Record measurements", desc: "Take a client's measurements with the tape keypad", href: "/measure" },
  { icon: ClipboardList, label: "New order", desc: "Start a garment order with price and due date", href: "/orders/new" },
  { icon: UserPlus, label: "Add client", desc: "Save a new client's contact details", href: "/clients?add=true" },
] as const;

export function CreateSheet() {
  const open = useShell(s => s.quickAddOpen);
  const setOpen = useShell(s => s.setQuickAddOpen);
  return (
    <BottomSheet open={open} onOpenChange={setOpen} title="Create">
      <View style={{ marginHorizontal: -8, gap: 4 }}>
        {QUICK_ACTIONS.map(item => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={() => {
              setOpen(false);
              router.push(item.href as never);
            }}
            style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.beigeLight }]}
          >
            <IconTile icon={item.icon} tone="olive" size="lg" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight="semibold">
                {item.label}
              </Text>
              <Text variant="label" color={colors.textTertiary}>
                {item.desc}
              </Text>
            </View>
            <ChevronRight size={18} strokeWidth={1.75} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  inner: { width: "100%", maxWidth: 448, alignSelf: "center" },
  barShadow: { height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, boxShadow: shadows.navBar },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  tab: { flex: 1, height: "100%", alignItems: "center", justifyContent: "center", gap: 4 },
  pillWrap: { width: 56, height: 32, alignItems: "center", justifyContent: "center" },
  pill: { position: "absolute", inset: 0, borderRadius: 999, backgroundColor: colors.navActiveBg },
  fab: {
    position: "absolute",
    top: 4 - FAB / 2,
    left: "50%",
    marginLeft: -FAB / 2,
    width: FAB,
    height: FAB,
    borderRadius: FAB / 2,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadows.fabRaised,
  },
  action: { flexDirection: "row", alignItems: "center", gap: 16, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 12 },
});

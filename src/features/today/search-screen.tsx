// Global search — the web's command palette (src/components/ui/command-palette.tsx)
// as a transparent modal route: a top-docked card over the ink scrim with the
// same groups (clients, orders, actions, pages) and cmdk's fuzzy filtering.

import * as React from "react";
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { router } from "expo-router";
import { ClipboardList, House, Ruler, Search, Settings, ShoppingBag, UserPlus, Users } from "lucide-react-native";
import { Avatar } from "@/components/ui/avatar";
import { StatusTag } from "@/components/ui/tag";
import { Text } from "@/components/ui/text";
import { GarmentIcon } from "@/components/brand/garment-icon";
import { useCustomers, useOrders } from "@/lib/api/query";
import { displayStatus, garmentOf, isActive } from "@/lib/orders";
import { resolveImage } from "@/lib/static-images";
import { colors, radii, shadows } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { commandScore } from "./command-score";

interface PaletteItem {
  id: string;
  /** Text matched against the query (cmdk `value`). */
  value: string;
  path: string;
  icon: React.ReactNode;
  label: React.ReactNode;
  meta?: React.ReactNode;
}

interface PaletteGroup {
  heading: string;
  items: PaletteItem[];
}

const ICON = { size: 18, strokeWidth: 1.75, color: colors.textSecondary };

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const keyboardH = useKeyboardHeight();
  const clientsQ = useCustomers();
  const ordersQ = useOrders();
  const clients = clientsQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const loading = !clientsQ.data || !ordersQ.data ? clientsQ.isPending || ordersQ.isPending : false;
  const failed = clientsQ.status === "error" || ordersQ.status === "error";
  const [query, setQuery] = React.useState("");

  // Same scale-in as the web palette (scale .96 → 1, fade).
  const enter = useSharedValue(0);
  React.useEffect(() => {
    enter.value = withTiming(1, { duration: 200, easing: Easing.bezier(0.2, 0, 0, 1) });
  }, [enter]);
  const cardStyle = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ scale: 0.96 + enter.value * 0.04 }] }));

  const close = () => {
    Keyboard.dismiss();
    router.back();
  };
  const go = (path: string) => {
    Keyboard.dismiss();
    router.back();
    router.push(path as never);
  };

  const hasQuery = query.trim().length > 0;
  const visibleOrders = hasQuery ? orders : orders.filter(isActive);

  const groups: PaletteGroup[] = [];
  if (clients.length > 0) {
    groups.push({
      heading: "Clients",
      items: (hasQuery ? clients : clients.slice(0, 5)).map(c => ({
        id: `c:${c.id}`,
        value: `client ${c.fullName} ${c.phones.join(" ")} ${c.email ?? ""}`,
        path: `/clients/${c.id}`,
        icon: <Avatar name={c.fullName} src={c.photoUrl} size="sm" />,
        label: c.fullName,
        meta: c.phones[0],
      })),
    });
  }
  if (visibleOrders.length > 0) {
    groups.push({
      heading: hasQuery ? "Orders" : "Active orders",
      items: (hasQuery ? visibleOrders : visibleOrders.slice(0, 5)).map(o => ({
        id: `o:${o.id}`,
        value: `order ${o.number} ${o.customerName} ${garmentOf(o)}`,
        path: `/orders/${o.id}`,
        icon: o.items[0]?.imageUrl ? (
          <Image source={resolveImage(o.items[0].imageUrl)} style={styles.thumb} contentFit="cover" />
        ) : (
          <GarmentIcon garment={garmentOf(o)} size={24} label="" color={colors.ink} />
        ),
        label: (
          <>
            {garmentOf(o)}{" "}
            <Text color={colors.textTertiary} size={15}>
              · {o.customerName} · #{o.number}
            </Text>
          </>
        ),
        meta: <StatusTag status={displayStatus(o)} appearance="dot" />,
      })),
    });
  }
  groups.push({
    heading: "Actions",
    items: [
      { id: "a:client", value: "add new client", path: "/clients?add=true", icon: <UserPlus {...ICON} />, label: "Add client" },
      { id: "a:measure", value: "record measurements measure", path: "/measure", icon: <Ruler {...ICON} />, label: "Record measurements" },
      { id: "a:order", value: "create new order", path: "/orders/new", icon: <ClipboardList {...ICON} />, label: "New order" },
    ],
  });
  groups.push({
    heading: "Go to",
    items: [
      { id: "p:home", value: "home today dashboard", path: "/today", icon: <House {...ICON} />, label: "Home" },
      { id: "p:clients", value: "clients list", path: "/clients", icon: <Users {...ICON} />, label: "Clients" },
      { id: "p:orders", value: "orders list", path: "/orders", icon: <ShoppingBag {...ICON} />, label: "Orders" },
      { id: "p:settings", value: "settings account preferences", path: "/settings", icon: <Settings {...ICON} />, label: "Settings" },
    ],
  });

  // cmdk: with a search, hide zero-score items, sort items by score and
  // groups by their best item (stable, so ties keep their order).
  const shown = query
    ? groups
        .map(g => {
          const scored = g.items.map(item => ({ item, score: commandScore(item.value.trim(), query) })).filter(s => s.score > 0);
          scored.sort((a, b) => b.score - a.score);
          return { group: { heading: g.heading, items: scored.map(s => s.item) }, best: scored[0]?.score ?? 0 };
        })
        .filter(g => g.group.items.length > 0)
        .sort((a, b) => b.best - a.best)
        .map(g => g.group)
    : groups;
  const firstItem = shown[0]?.items[0];
  const total = shown.reduce((n, g) => n + g.items.length, 0);

  const top = Math.max(12, insets.top);
  const inputH = 56;
  const listMax = Math.max(120, Math.min(screenH * 0.6, 480, screenH - keyboardH - top - inputH - 12));

  return (
    <View style={styles.root}>
      <Pressable accessibilityLabel="Close search" onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} />
      <Animated.View accessibilityViewIsModal style={[styles.card, { top }, cardStyle]}>
        <View style={styles.inputRow}>
          <Search size={20} strokeWidth={1.75} color={colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search clients, orders or actions"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Search Tayylo"
            selectionColor={colors.olive}
            cursorColor={colors.olive}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            returnKeyType="go"
            onSubmitEditing={() => firstItem && go(firstItem.path)}
            style={styles.input}
          />
        </View>

        <ScrollView style={{ maxHeight: listMax }} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {loading && (
            <Text variant="label" color={colors.textTertiary} align="center" style={{ paddingHorizontal: 12, paddingVertical: 24 }}>
              Loading your workspace…
            </Text>
          )}
          {failed && (
            <Text variant="label" color={colors.danger} style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
              Couldn&apos;t load clients and orders. Actions still work.
            </Text>
          )}
          {total === 0 && (
            <View style={{ paddingHorizontal: 12, paddingVertical: 40 }}>
              <Text size={15} weight="semibold" align="center">
                No results
              </Text>
              <Text variant="label" color={colors.textTertiary} align="center" style={{ marginTop: 4 }}>
                Try a client name, phone number or order number.
              </Text>
            </View>
          )}
          {shown.map(g => (
            <View key={g.heading} accessibilityRole="list">
              <Text variant="overline" color={colors.textTertiary} style={styles.heading}>
                {g.heading}
              </Text>
              {g.items.map(item => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  onPress={() => go(item.path)}
                  style={({ pressed }) => [styles.item, (pressed || item === firstItem) && { backgroundColor: colors.beigeLight }]}
                >
                  <View style={styles.itemIcon}>{item.icon}</View>
                  <Text numberOfLines={1} size={15} style={{ flex: 1, minWidth: 0 }}>
                    {item.label}
                  </Text>
                  {item.meta ? (
                    typeof item.meta === "string" ? (
                      <Text variant="caption" color={colors.textTertiary} style={{ flexShrink: 0 }}>
                        {item.meta}
                      </Text>
                    ) : (
                      <View style={{ flexShrink: 0 }}>{item.meta}</View>
                    )
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

/** Current software-keyboard height, so the results never sit under it. */
function useKeyboardHeight() {
  const [h, setH] = React.useState(0);
  React.useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const a = Keyboard.addListener(showEvt, e => setH(e.endCoordinates.height));
    const b = Keyboard.addListener(hideEvt, () => setH(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return h;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: {
    position: "absolute",
    left: 12,
    right: 12,
    alignSelf: "center",
    maxWidth: 576,
    overflow: "hidden",
    borderRadius: radii.dialog,
    backgroundColor: colors.surfaceRaised,
    boxShadow: shadows.dialog,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingHorizontal: 20,
  },
  input: { height: 56, flex: 1, fontSize: 16, fontFamily: fonts.regular, color: colors.ink, padding: 0 },
  list: { padding: 8 },
  heading: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 },
  item: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  itemIcon: { width: 32, height: 32, flexShrink: 0, alignItems: "center", justifyContent: "center" },
  thumb: { width: 32, height: 32, borderRadius: radii.xs },
});

// Today (Home tab) — the phone layout of the web's src/app/(app)/today/page.tsx.

import * as React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Bell, ChevronRight, ClipboardList, Ruler, Search, ShoppingCart, UserPlus } from "lucide-react-native";
import type { Customer, Order } from "@/types";
import { Panel, TapeRule } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconTile, List, ListItem } from "@/components/ui/list";
import { Screen } from "@/components/ui/page";
import { PressableScale } from "@/components/ui/pressable";
import { ErrorState, ListSkeleton, LoadingRegion, Skeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { OrderRow } from "@/components/order-list-item";
import { useShell } from "@/components/shell/shell-context";
import { useCustomers, useOrders } from "@/lib/api/query";
import { useBusiness } from "@/lib/use-business";
import { formatMoney, formatWeekday, greeting } from "@/lib/format";
import { balanceMinor, collectedInMonth, isActive, normalizeStatus } from "@/lib/orders";
import { deriveNotifications } from "@/lib/notifications";
import { resolveImage } from "@/lib/static-images";
import { alpha, colors, GUTTER, radii } from "@/theme/tokens";
import { NotificationsSheet, useUnreadCount } from "./notifications-sheet";

/** Garment categories with photos, for the Home "Category" row. */
const CATEGORIES = [
  { key: "suit", label: "Suits", image: "/garments/suit.jpg" },
  { key: "agbada", label: "Agbada", image: "/garments/agbada.jpg" },
  { key: "senator", label: "Senator", image: "/garments/senator.jpg" },
  { key: "kaftan", label: "Kaftan", image: "/garments/kaftan.jpg" },
  { key: "blazer", label: "Blazers", image: "/garments/blazer.jpg" },
  { key: "dress", label: "Dresses", image: "/garments/dress.jpg" },
  { key: "shirt", label: "Shirts", image: "/garments/shirt.jpg" },
  { key: "trousers", label: "Trousers", image: "/garments/trousers.jpg" },
];

/** The web's notification badge red (`bg-[#D93A2B]`), a one-off literal there too. */
const BADGE_RED = colors.badge;

const go = (path: string) => router.push(path as never);

export function TodayScreen() {
  const { openSearch } = useShell();
  const { business, currency } = useBusiness();

  const ordersQ = useOrders();
  const clientsQ = useCustomers();
  const orders = React.useMemo(() => ordersQ.data ?? [], [ordersQ.data]);
  const clients = clientsQ.data ?? [];
  // Show cached data immediately; skeleton only on a true first load.
  const status: "loading" | "ready" | "error" =
    ordersQ.data && clientsQ.data ? "ready" : ordersQ.status === "error" || clientsQ.status === "error" ? "error" : "loading";
  const [notifOpen, setNotifOpen] = React.useState(false);

  const notifications = React.useMemo(() => deriveNotifications(orders), [orders]);
  const { unread, refresh: refreshUnread } = useUnreadCount(notifications);

  const retry = () => {
    ordersQ.refetch();
    clientsQ.refetch();
  };
  const onRefresh = async () => {
    await Promise.all([ordersQ.refetch(), clientsQ.refetch()]);
    refreshUnread();
  };

  // ---- derived figures (all from real orders) ----
  const now = new Date();
  const active = orders.filter(isActive).sort((a, b) => +new Date(a.dueAt) - +new Date(b.dueAt));
  const owing = orders.filter(o => normalizeStatus(o.statusName) !== "cancelled" && balanceMinor(o) > 0);
  const outstanding = owing.reduce((s, o) => s + balanceMinor(o), 0);
  const collected = collectedInMonth(orders, now);
  const monthName = now.toLocaleDateString("en-GB", { month: "long" });
  const firstName = business?.ownerName?.trim().split(/\s+/)[0];

  const header = {
    eyebrow: formatWeekday(now),
    title: firstName ? `${greeting(now)}, ${firstName}` : greeting(now),
    actions: (
      <>
        <Button variant="ghost" size="icon" icon={Search} onPress={openSearch} accessibilityLabel="Search" />
        <View>
          <Button
            variant="ghost"
            size="icon"
            icon={Bell}
            onPress={() => setNotifOpen(true)}
            accessibilityLabel={unread > 0 ? `Notifications, ${unread} new` : "Notifications"}
          />
          {unread > 0 && (
            <Animated.View entering={FadeInDown.duration(200)} pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.badge}>
              <Text tabular size={10.5} weight="bold" color={colors.white} style={{ lineHeight: 12 }}>
                {unread > 9 ? "9+" : unread}
              </Text>
            </Animated.View>
          )}
        </View>
      </>
    ),
  };

  let body: React.ReactNode;
  if (status === "loading") {
    body = (
      <LoadingRegion label="Loading home">
        <View style={{ gap: 32 }}>
          <Skeleton variant="rectangular" height={232} style={{ borderRadius: radii.panel }} />
          <ListSkeleton count={3} />
          <ListSkeleton count={3} />
        </View>
      </LoadingRegion>
    );
  } else if (status === "error") {
    body = <ErrorState title="Couldn't load home" onRetry={retry} />;
  } else if (clients.length === 0 && orders.length === 0) {
    body = <GettingStarted businessName={business?.name} />;
  } else {
    body = (
      <MobileHome
        collected={collected}
        outstanding={outstanding}
        currency={currency}
        monthName={monthName}
        active={active}
        orders={orders}
        clients={clients}
        onMeasure={() => go("/measure")}
        onNewOrder={() => go("/orders/new")}
      />
    );
  }

  return (
    <>
      <Screen header={header} tabBar onRefresh={onRefresh} contentStyle={{ paddingTop: 4 }}>
        {body}
      </Screen>
      <NotificationsSheet open={notifOpen} onOpenChange={setNotifOpen} items={notifications} onSeen={refreshUnread} />
    </>
  );
}

/** First-run: real next steps instead of an empty dashboard. */
function GettingStarted({ businessName }: { businessName?: string }) {
  const steps = [
    { icon: UserPlus, title: "Add your first client", desc: "Name and phone number is all you need", href: "/clients?add=true" },
    { icon: Ruler, title: "Record their measurements", desc: "Fast keypad with tailor fractions", href: "/measure" },
    { icon: ClipboardList, title: "Create an order", desc: "Price, deposit and due date in one place", href: "/orders/new" },
  ];
  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      <Panel>
        <Text variant="label" weight="medium" color={colors.textOnPanelMuted}>
          Welcome to Tayylo
        </Text>
        <Text variant="title" color={colors.textInverse} style={{ marginTop: 8 }}>
          {businessName ? `${businessName} is ready.` : "Your workspace is ready."}
        </Text>
        <Text variant="label" color={colors.textOnPanelMuted} style={{ marginTop: 8 }}>
          Three steps and you&apos;ll never search a notebook for a measurement again.
        </Text>
      </Panel>
      <List style={{ marginTop: 24 }}>
        {steps.map((s, i) => (
          <ListItem
            key={s.title}
            onPress={() => go(s.href)}
            leading={<IconTile icon={s.icon} tone="olive" size="lg" />}
            title={`${i + 1}. ${s.title}`}
            subtitle={s.desc}
            chevron
          />
        ))}
      </List>
    </Animated.View>
  );
}

// ------------------------------------------------------------ phone layout

function MobileHome({
  collected,
  outstanding,
  currency,
  monthName,
  active,
  orders,
  clients,
  onMeasure,
  onNewOrder,
}: {
  collected: number;
  outstanding: number;
  currency: string;
  monthName: string;
  active: Order[];
  orders: Order[];
  clients: Customer[];
  onMeasure: () => void;
  onNewOrder: () => void;
}) {
  const photos = Object.fromEntries(clients.map(c => [c.id, c.photoUrl])) as Record<string, string | undefined>;
  // Categories the studio actually sews come first.
  const used = (key: string) => orders.filter(o => o.items.some(i => i.garmentType.toLowerCase().includes(key))).length;
  const categories = [...CATEGORIES].sort((a, b) => used(b.key) - used(a.key));

  return (
    <Animated.View entering={FadeInDown.duration(320)}>
      {/* Summary: this month's takings on a white card inside the dark panel */}
      <View style={styles.summary}>
        <View style={styles.summaryCard}>
          <TapeRule color={colors.ink} style={{ height: 24, opacity: 0.25 }} />
          <Text variant="label" color={colors.textSecondary} align="center">
            Collected in {monthName}
          </Text>
          <Text tabular size={32} weight="semibold" align="center" style={styles.collected}>
            {formatMoney(collected, currency)}
          </Text>
        </View>
        <View style={styles.stats}>
          <PanelStat href="/orders?filter=owing" label="Outstanding balance" value={formatMoney(outstanding, currency)} />
          <PanelStat
            href="/orders?filter=active"
            label="In production"
            value={`${active.length} ${active.length === 1 ? "order" : "orders"}`}
          />
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Button size="lg" icon={Ruler} onPress={onMeasure} style={{ flex: 1 }}>
          Measure
        </Button>
        <Button size="lg" variant="secondary" icon={ShoppingCart} onPress={onNewOrder} style={{ flex: 1 }}>
          New order
        </Button>
      </View>

      {/* Category */}
      <View style={{ marginTop: 28 }} accessibilityLabel="Category">
        <Pressable accessibilityRole="link" onPress={() => go("/orders")} style={[styles.sectionHead, { marginBottom: 12 }]}>
          <Text accessibilityRole="header" size={17} weight="medium" color={colors.textSecondary}>
            Category
          </Text>
          <ChevronRight size={20} strokeWidth={1.75} color={colors.textTertiary} />
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -GUTTER }}
          contentContainerStyle={styles.categories}
        >
          {categories.map(c => (
            <PressableScale
              key={c.key}
              scaleTo={0.98}
              accessibilityRole="link"
              accessibilityLabel={c.label}
              onPress={() => go(`/orders?q=${encodeURIComponent(c.label.replace(/e?s$/, ""))}`)}
              style={styles.category}
            >
              <Image source={resolveImage(c.image)} style={styles.categoryImage} contentFit="cover" />
              <Text size={14} color={colors.textSecondary} style={styles.categoryLabel}>
                {c.label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      </View>

      {/* Active orders */}
      <View style={{ marginTop: 28 }} accessibilityLabel="Active orders">
        <Pressable accessibilityRole="link" onPress={() => go("/orders")} style={[styles.sectionHead, { marginBottom: 4 }]}>
          <View style={styles.titleWithCount}>
            <Text accessibilityRole="header" size={17} weight="medium" color={colors.textSecondary}>
              Active orders
            </Text>
            <View style={styles.count}>
              <Text tabular size={12} color={colors.textSecondary} style={{ lineHeight: 20 }}>
                {active.length}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} strokeWidth={1.75} color={colors.textTertiary} />
        </Pressable>
        {active.length === 0 ? (
          <View style={styles.emptyActive}>
            <Text variant="label" color={colors.textSecondary}>
              No active orders. Tap New order to start one.
            </Text>
          </View>
        ) : (
          <View>
            {active.slice(0, 6).map((o, i) => (
              <View key={o.id} style={i > 0 ? styles.rowDivider : undefined}>
                <OrderRow order={o} clientPhoto={photos[o.customerId]} />
              </View>
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/** A tappable figure on the dark summary card. */
function PanelStat({ href, label, value }: { href: string; label: string; value: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => go(href)}
      style={({ pressed }) => [styles.stat, pressed && { backgroundColor: "rgba(255,255,255,0.10)" }]}
    >
      <View style={styles.statLabel}>
        <Text numberOfLines={1} variant="caption" color={colors.textOnPanelMuted} style={{ flexShrink: 1 }}>
          {label}
        </Text>
        <ChevronRight size={15} strokeWidth={2} color={colors.textOnPanelMuted} style={{ opacity: 0.6, flexShrink: 0 }} />
      </View>
      <Text numberOfLines={1} tabular size={19} weight="semibold" color={colors.textInverse} style={{ marginTop: 4 }}>
        {value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    // 18px badge plus the web's 2px canvas ring drawn outside it.
    right: -4,
    top: -4,
    height: 22,
    minWidth: 22,
    borderRadius: 11,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BADGE_RED,
    borderWidth: 2,
    borderColor: colors.canvas,
  },
  summary: { borderRadius: 28, backgroundColor: colors.panel, padding: 8 },
  summaryCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 20,
  },
  collected: { marginTop: 4, lineHeight: 40, letterSpacing: -0.8 },
  stats: { flexDirection: "row", gap: 4, paddingHorizontal: 4, paddingTop: 4 },
  stat: { flex: 1, minWidth: 0, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 12 },
  statLabel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  actionsRow: { marginTop: 16, flexDirection: "row", gap: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  titleWithCount: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: { borderRadius: radii.xs, backgroundColor: colors.surfaceSunken, paddingHorizontal: 6 },
  categories: { gap: 12, paddingHorizontal: GUTTER, paddingBottom: 4 },
  category: {
    width: 124,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.6),
    backgroundColor: colors.surfaceRaised,
    padding: 6,
  },
  categoryImage: { width: "100%", aspectRatio: 1, borderRadius: 13 },
  categoryLabel: { paddingHorizontal: 4, paddingTop: 6, paddingBottom: 2 },
  emptyActive: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.7),
    backgroundColor: colors.surface,
    padding: 16,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: alpha(colors.divider, 0.7) },
});

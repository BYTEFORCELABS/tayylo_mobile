// Orders tab — port of the web's src/app/(app)/orders/page.tsx (phone layout):
// search, status filters with counts, newest-first list grouped by the day
// the order was taken, and the same empty / error states.

import * as React from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ClipboardList, Plus, Search } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/choice";
import { Screen, useScreenScroll, useTabBarInset } from "@/components/ui/page";
import { PressableScale } from "@/components/ui/pressable";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { OrderRow } from "@/components/order-list-item";
import { useCustomers, useOrders } from "@/lib/api/query";
import { formatMoney } from "@/lib/format";
import { balanceMinor, isActive, isOverdue, normalizeStatus } from "@/lib/orders";
import { useBusiness } from "@/lib/use-business";
import { alpha, colors, GUTTER, shadows } from "@/theme/tokens";
import type { Order, OrderStatusName } from "@/types";

type Filter = "active" | "overdue" | "owing" | OrderStatusName | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All orders" },
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "cutting", label: "Cutting" },
  { key: "overdue", label: "Overdue" },
  { key: "owing", label: "Balance due" },
  { key: "sewing", label: "Sewing" },
  { key: "fitting", label: "Fitting" },
  { key: "alterations", label: "Alterations" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

/** Tabs that always show, even at zero (like the design's "Cutting 0"). */
const CORE_TABS: Filter[] = ["all", "active", "pending", "cutting"];

function dayKey(d: string) {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}

/** "Today", "Yesterday" or "23rd Aug, 2026". */
function dayLabel(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(d) === dayKey(today.toISOString())) return "Today";
  if (dayKey(d) === dayKey(yesterday.toISOString())) return "Yesterday";
  const n = date.getDate();
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix} ${date.toLocaleDateString("en-GB", { month: "short" })}, ${date.getFullYear()}`;
}

function matches(o: Order, f: Filter) {
  switch (f) {
    case "all":
      return true;
    case "active":
      return isActive(o);
    case "overdue":
      return isOverdue(o);
    case "owing":
      return normalizeStatus(o.statusName) !== "cancelled" && balanceMinor(o) > 0;
    default:
      return normalizeStatus(o.statusName) === f;
  }
}

const isFilter = (v: unknown): v is Filter => typeof v === "string" && FILTERS.some(f => f.key === v);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type Row =
  | { type: "summary"; key: string }
  | { type: "group"; key: string; label: string; first: boolean }
  | { type: "order"; key: string; order: Order; divider: boolean }
  | { type: "footer"; key: string };

export function OrdersScreen() {
  const params = useLocalSearchParams<{ q?: string | string[]; filter?: string | string[] }>();
  const { currency } = useBusiness();
  const ordersQ = useOrders();
  const customersQ = useCustomers();
  const clientPhotos = React.useMemo(
    () => Object.fromEntries((customersQ.data ?? []).map(c => [c.id, c.photoUrl])) as Record<string, string | undefined>,
    [customersQ.data]
  );
  const orders = React.useMemo(() => ordersQ.data ?? [], [ordersQ.data]);
  const status: "loading" | "ready" | "error" = ordersQ.data ? "ready" : ordersQ.status === "error" ? "error" : "loading";
  const initialQ = first(params.q) ?? "";
  // `?filter=owing` / `?filter=active` (from Today's summary card) opens on that tab.
  const filterParam = first(params.filter);
  const [filter, setFilter] = React.useState<Filter>(isFilter(filterParam) ? filterParam : "all");
  const [search, setSearch] = React.useState(initialQ);
  const [searchOpen, setSearchOpen] = React.useState(!!initialQ);

  // The tab stays mounted, so a later link with new params must re-apply them
  // (on the web each navigation mounts the page afresh).
  const [seenParams, setSeenParams] = React.useState({ q: initialQ, filter: filterParam });
  if (seenParams.q !== initialQ || seenParams.filter !== filterParam) {
    setSeenParams({ q: initialQ, filter: filterParam });
    if (filterParam !== seenParams.filter) setFilter(isFilter(filterParam) ? filterParam : "all");
    if (initialQ !== seenParams.q) {
      setSearch(initialQ);
      if (initialQ) setSearchOpen(true);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = orders
    .filter(o => matches(o, filter))
    .filter(
      o =>
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        o.number.toLowerCase().includes(q) ||
        o.items.some(i => i.garmentType.toLowerCase().includes(q) || i.styleNotes?.toLowerCase().includes(q))
    )
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  // Grouped by the day each order was taken: Today, Yesterday, 23rd Aug…
  const groups: { label: string; orders: Order[] }[] = [];
  for (const o of filtered) {
    const label = dayLabel(o.createdAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.orders.push(o);
    else groups.push({ label, orders: [o] });
  }

  const counts = React.useMemo(() => {
    const c: Partial<Record<Filter, number>> = {};
    FILTERS.forEach(f => (c[f.key] = orders.filter(o => matches(o, f.key)).length));
    return c;
  }, [orders]);

  const visibleFilters = FILTERS.filter(f => CORE_TABS.includes(f.key) || (counts[f.key] ?? 0) > 0 || f.key === filter);
  const filteredBalance = filtered.reduce((s, o) => s + (normalizeStatus(o.statusName) === "cancelled" ? 0 : balanceMinor(o)), 0);

  const rows: Row[] = [];
  if (status === "ready" && filtered.length > 0) {
    if (filteredBalance > 0) rows.push({ type: "summary", key: "summary" });
    groups.forEach((g, gi) => {
      rows.push({ type: "group", key: `g:${g.label}`, label: g.label, first: gi === 0 });
      g.orders.forEach((o, i) => rows.push({ type: "order", key: o.id, order: o, divider: i > 0 }));
    });
    if (filter === "active" && counts.delivered) rows.push({ type: "footer", key: "footer" });
  }

  const newOrder = () => router.push("/orders/new");

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.type) {
      case "summary":
        return (
          <Text variant="label" color={colors.textTertiary} style={styles.summary}>
            <Text tabular variant="label" color={colors.textTertiary}>
              {filtered.length}
            </Text>{" "}
            {filtered.length === 1 ? "order" : "orders"} ·{" "}
            <Text tabular variant="label" weight="semibold">
              {formatMoney(filteredBalance, currency)}
            </Text>{" "}
            still to collect
          </Text>
        );
      case "group":
        return (
          <Text accessibilityRole="header" size={14} weight="medium" color={colors.textSecondary} style={[styles.groupLabel, !item.first && { marginTop: 20 }]}>
            {item.label}
          </Text>
        );
      case "order":
        return (
          <View style={item.divider ? styles.divider : undefined}>
            <OrderRow order={item.order} clientPhoto={clientPhotos[item.order.customerId]} />
          </View>
        );
      case "footer":
        return (
          <Text variant="caption" color={colors.textTertiary} align="center" style={{ marginTop: 16 }}>
            Delivered and cancelled orders are under{" "}
            <Text variant="caption" weight="semibold" color={colors.olive} onPress={() => setFilter("all")} suppressHighlighting={false}>
              All orders
            </Text>
            .
          </Text>
        );
    }
  };

  const emptyContent =
    status === "loading" ? (
      <ListSkeleton count={6} />
    ) : status === "error" ? (
      <ErrorState title="Couldn't load orders" onRetry={() => ordersQ.refetch()} />
    ) : orders.length === 0 ? (
      <EmptyState
        icon={ClipboardList}
        title="No orders yet"
        description="Create an order to track a garment from cutting to delivery, with payments and fittings."
        action={
          <Button icon={Plus} onPress={newOrder}>
            Create your first order
          </Button>
        }
      />
    ) : (
      <EmptyState
        title={q ? `No orders match “${search}”` : `No ${FILTERS.find(f => f.key === filter)?.label.toLowerCase()} orders`}
        description={q ? "Try a client name, order number or garment." : "Orders in this state will show here."}
        action={
          <Button
            variant="secondary"
            onPress={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Show all orders
          </Button>
        }
      />
    );

  return (
    <Screen
      scroll={false}
      tabBar
      header={{
        title: "Orders",
        description:
          status === "ready" && orders.length > 0 ? `${counts.active ?? 0} active${counts.overdue ? ` · ${counts.overdue} overdue` : ""}` : undefined,
        actions: (
          <>
            {orders.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                icon={Search}
                accessibilityLabel="Search orders"
                onPress={() => setSearchOpen(o => !o)}
                style={searchOpen ? { backgroundColor: alpha(colors.surfaceSunken, 0.7) } : undefined}
              />
            )}
            <Button icon={Plus} onPress={newOrder}>
              New order
            </Button>
          </>
        ),
        children:
          orders.length > 0 ? (
            <View style={styles.headerExtras}>
              {searchOpen && (
                <SearchField value={search} onValueChange={setSearch} placeholder="Search client, order or garment" autoFocus={!initialQ} />
              )}
              <FilterTabs filters={visibleFilters} counts={counts} value={filter} onChange={setFilter} />
            </View>
          ) : undefined,
      }}
    >
      <OrdersList rows={rows} renderRow={renderRow} empty={emptyContent} onRefresh={() => Promise.all([ordersQ.refetch(), customersQ.refetch()])} />
    </Screen>
  );
}

/** The list itself — a child of Screen so it can use the header's scroll hook. */
function OrdersList({
  rows,
  renderRow,
  empty,
  onRefresh,
}: {
  rows: Row[];
  renderRow: ({ item }: { item: Row }) => React.ReactElement;
  empty: React.ReactElement;
  onRefresh: () => Promise<unknown>;
}) {
  const onScroll = useScreenScroll();
  const bottom = useTabBarInset();
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <FlatList
      data={rows}
      keyExtractor={r => r.key}
      renderItem={renderRow}
      ListEmptyComponent={empty}
      onScroll={onScroll}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: bottom }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.olive} colors={[colors.olive]} />}
    />
  );
}

function FilterTabs({
  filters,
  counts,
  value,
  onChange,
}: {
  filters: { key: Filter; label: string }[];
  counts: Partial<Record<Filter, number>>;
  value: Filter;
  onChange: (f: Filter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel="Filter orders"
      style={{ marginHorizontal: -GUTTER }}
      contentContainerStyle={{ paddingHorizontal: GUTTER }}
    >
      <View style={styles.tabs}>
        {filters.map(f => {
          const selected = value === f.key;
          return (
            <PressableScale
              key={f.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(f.key)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text numberOfLines={1} size={13.5} weight={selected ? "semibold" : "medium"} color={selected ? colors.ink : colors.textSecondary}>
                {f.label}
              </Text>
              <View style={[styles.count, { backgroundColor: selected ? colors.surfaceSunken : alpha(colors.surfaceRaised, 0.7) }]}>
                <Text tabular size={11} align="center" color={selected ? colors.ink : colors.textTertiary} style={{ lineHeight: 20 }}>
                  {counts[f.key] ?? 0}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerExtras: { gap: 12, paddingBottom: 12 },
  tabs: { flexDirection: "row", gap: 4, borderRadius: 999, backgroundColor: colors.surfaceSunken, padding: 4 },
  tab: { height: 36, flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 14 },
  tabSelected: { backgroundColor: colors.surfaceRaised, boxShadow: shadows.xs },
  count: { minWidth: 20, borderRadius: 6, paddingHorizontal: 4 },
  summary: { marginBottom: 12, paddingHorizontal: 4 },
  groupLabel: { paddingHorizontal: 4, paddingBottom: 4 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: alpha(colors.divider, 0.7) },
});

// Clients tab: search, recents, A–Z list and the "New client" sheet.
// Mirrors the web's src/app/(app)/clients/page.tsx (phone layout).

import * as React from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight, Plus, Search, UserPlus, Users } from "lucide-react-native";
import type { Customer } from "@/types";
import { AddClientSheet } from "@/components/add-client-sheet";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/choice";
import { Screen, useScreenScroll, useTabBarInset } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { prefetchClient, useCustomers } from "@/lib/api/query";
import { timeAgo } from "@/lib/format";
import { colors, GUTTER, radii } from "@/theme/tokens";

type Row =
  | { type: "recents"; key: string }
  | { type: "letter"; key: string; letter: string; first: boolean }
  | { type: "client"; key: string; client: Customer };

export function ClientsScreen() {
  const params = useLocalSearchParams<{ add?: string }>();
  const clientsQ = useCustomers();
  const clients = React.useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const status: "loading" | "ready" | "error" = clientsQ.data ? "ready" : clientsQ.isError ? "error" : "loading";
  const [search, setSearch] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [prefillName, setPrefillName] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const recents = React.useMemo(
    () => [...clients].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 10),
    [clients]
  );

  // `?add=true` (from quick actions / search) opens the sheet directly.
  React.useEffect(() => {
    if (params.add === "true") {
      setAddOpen(true);
      router.setParams({ add: undefined });
    }
  }, [params.add]);

  const q = search.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      q
        ? clients.filter(
            c =>
              c.fullName.toLowerCase().includes(q) ||
              c.phones.some(p => p.replace(/\s/g, "").includes(q.replace(/\s/g, ""))) ||
              c.email?.toLowerCase().includes(q) ||
              c.notes?.toLowerCase().includes(q) ||
              c.tags.some(t => t.toLowerCase().includes(q))
          )
        : clients,
    [clients, q]
  );

  const grouped = React.useMemo(() => {
    const map: Record<string, Customer[]> = {};
    [...filtered]
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .forEach(c => {
        const ch = c.fullName.charAt(0).toUpperCase();
        const letter = /[A-Z]/.test(ch) ? ch : "#";
        (map[letter] ||= []).push(c);
      });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const rows = React.useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (!q && recents.length > 1) out.push({ type: "recents", key: "recents" });
    grouped.forEach(([letter, list], i) => {
      out.push({ type: "letter", key: `letter:${letter}`, letter, first: i === 0 });
      list.forEach(c => out.push({ type: "client", key: c.id, client: c }));
    });
    return out;
  }, [q, recents.length, grouped]);

  const openAdd = () => setAddOpen(true);

  let empty: React.ReactNode = null;
  if (status === "loading") empty = <ListSkeleton count={8} />;
  else if (status === "error") empty = <ErrorState title="Couldn't load clients" onRetry={() => clientsQ.refetch()} />;
  else if (clients.length === 0)
    empty = (
      <EmptyState
        icon={Users}
        title="Your client book is empty"
        description="Add a client to start keeping their measurements, orders and fittings in one place."
        action={
          <Button icon={UserPlus} onPress={openAdd}>
            Add your first client
          </Button>
        }
      />
    );
  else if (filtered.length === 0)
    empty = (
      <EmptyState
        title={`No clients match “${search}”`}
        description="Try part of their name or phone number."
        action={
          <Button
            variant="secondary"
            icon={UserPlus}
            onPress={() => {
              setPrefillName(search);
              setAddOpen(true);
            }}
          >
            {`Add “${search}”`}
          </Button>
        }
      />
    );

  return (
    <Screen
      tabBar
      scroll={false}
      header={{
        title: "Clients",
        actions: (
          <>
            {clients.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                icon={Search}
                accessibilityLabel="Search clients"
                onPress={() => setSearchOpen(o => !o)}
              />
            )}
            <Button size="md" icon={Plus} onPress={openAdd}>
              Add client
            </Button>
          </>
        ),
        children:
          clients.length > 0 && searchOpen ? (
            <SearchField
              value={search}
              onValueChange={setSearch}
              placeholder="Search name, phone, tag or note"
              autoFocus
              style={{ paddingBottom: 16 }}
            />
          ) : undefined,
      }}
    >
      <ClientList
        rows={empty ? [] : rows}
        empty={empty}
        recents={recents}
        onRefresh={() => clientsQ.refetch()}
      />

      <AddClientSheet
        open={addOpen}
        onOpenChange={open => {
          setAddOpen(open);
          if (!open) setPrefillName("");
        }}
        initialName={prefillName}
        onCreated={customer => {
          toast.success(`${customer.fullName} added`);
          router.push(`/clients/${customer.id}`);
        }}
      />
    </Screen>
  );
}

function ClientList({
  rows,
  empty,
  recents,
  onRefresh,
}: {
  rows: Row[];
  empty: React.ReactNode;
  recents: Customer[];
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
      onScroll={onScroll}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: bottom }}
      ListEmptyComponent={<>{empty}</>}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.olive} colors={[colors.olive]} />}
      renderItem={({ item }) => {
        if (item.type === "recents") return <Recents recents={recents} />;
        if (item.type === "letter")
          return (
            <Text
              accessibilityRole="header"
              size={14}
              weight="medium"
              color={colors.textSecondary}
              style={[styles.letter, !item.first && { marginTop: 20 }]}
            >
              {item.letter}
            </Text>
          );
        return <ClientRow client={item.client} />;
      }}
    />
  );
}

/** Recents — the clients you've worked with lately. */
function Recents({ recents }: { recents: Customer[] }) {
  return (
    <View accessibilityLabel="Recent clients" style={{ marginBottom: 24 }}>
      <View style={styles.recentsHead}>
        <Text size={16} weight="medium" color={colors.textSecondary}>
          Recents
        </Text>
        <ChevronRight size={18} strokeWidth={1.75} color={colors.textTertiary} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -GUTTER }}
        contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 4, gap: 12 }}
      >
        {recents.map(c => {
          const [first, ...rest] = c.fullName.split(" ");
          return (
            <Pressable
              key={c.id}
              accessibilityRole="link"
              accessibilityLabel={c.fullName}
              onPressIn={() => prefetchClient(c.id)}
              onPress={() => router.push(`/clients/${c.id}`)}
              style={({ pressed }) => [styles.recent, pressed && { opacity: 0.7 }]}
            >
              <Avatar name={c.fullName} src={c.photoUrl} size="lg" shape="rounded" px={64} fontSize={20} fontWeight="medium" />
              <View style={{ width: "100%" }}>
                <Text numberOfLines={1} size={12.5} weight="medium" color={colors.textSecondary} align="center" style={styles.recentName}>
                  {first}
                </Text>
                {rest.length > 0 && (
                  <Text numberOfLines={1} size={12.5} weight="medium" color={colors.textSecondary} align="center" style={styles.recentName}>
                    {rest.join(" ")}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ClientRow = React.memo(function ClientRow({ client: c }: { client: Customer }) {
  const measuredAt = c.lastMeasuredAt;
  return (
    <Pressable
      accessibilityRole="link"
      onPressIn={() => prefetchClient(c.id)}
      onPress={() => router.push(`/clients/${c.id}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
    >
      <Avatar name={c.fullName} src={c.photoUrl} size="md" shape="rounded" px={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} size={15.5} weight="medium">
          {c.fullName}
        </Text>
        <Text numberOfLines={1} size={13} color={colors.textSecondary}>
          {c.phones[0] || c.email || "No contact details"}
        </Text>
      </View>
      <Text size={11.5} color={colors.textTertiary} style={{ flexShrink: 0 }}>
        {measuredAt ? `Measured ${timeAgo(measuredAt)}` : "Not measured"}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  letter: { paddingHorizontal: 4, paddingBottom: 4 },
  recentsHead: { marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
  recent: { width: 64, flexShrink: 0, alignItems: "center", gap: 8 },
  // Web: size-16 (64px) rounded avatar.
  recentName: { width: "100%", lineHeight: 12.5 * 1.25 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: radii.card, paddingHorizontal: 4, paddingVertical: 10 },
  // Web: size-11 (44px) with the md avatar's 12px corners.
});

// Explore: a calm, Pinterest-style board of styles shared by tailors around
// the world. Browse by country and category, save what inspires you. No
// comments, followers or chat — just the work.
// Port of tayylo/src/app/(app)/explore/page.tsx.

import * as React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Compass, Plus } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Chip, SearchField, SegmentedControl } from "@/components/ui/choice";
import { Screen, useScreenScroll, useTabBarInset } from "@/components/ui/page";
import { PressableScale } from "@/components/ui/pressable";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { exploreRepo } from "@/lib/api/repos";
import { useSession } from "@/lib/auth/session";
import { EXPLORE_CATEGORIES, type ExplorePage, type ExplorePost } from "@/lib/explore";
import { resolveImage } from "@/lib/static-images";
import { alpha, colors, GUTTER, radii } from "@/theme/tokens";
import { AddStyleSheet } from "./add-style-sheet";
import { PostViewer } from "./post-viewer";

const STALE_MS = 30_000;
const GAP = 12;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Height-per-unit-width of a post (3:4 when the size is unknown, as on the web). */
const ratioOf = (p: ExplorePost) => (p.width && p.height ? p.width / p.height : 3 / 4);

/** Two balanced columns (the web's `columns-2` on phones), keeping each photo's aspect ratio. */
function Masonry<T>({ items, height, render }: { items: T[]; height: (item: T) => number; render: (item: T) => React.ReactNode }) {
  const cols: [T[], T[]] = [[], []];
  const sums = [0, 0];
  for (const item of items) {
    const i = sums[0] <= sums[1] ? 0 : 1;
    cols[i].push(item);
    sums[i] += height(item);
  }
  return (
    <View style={styles.masonry}>
      {cols.map((col, i) => (
        <View key={i} style={styles.column}>
          {col.map(render)}
        </View>
      ))}
    </View>
  );
}

function MasonrySkeleton() {
  const heights = [220, 300, 260, 340, 240, 280, 320, 230];
  return (
    <Masonry
      items={heights.map((h, i) => ({ h, i }))}
      height={x => x.h}
      render={x => <Skeleton key={x.i} variant="rectangular" height={x.h} style={{ marginBottom: GAP }} />}
    />
  );
}

function PostCard({ post, saved, onOpen, onToggleSave }: { post: ExplorePost; saved: boolean; onOpen: () => void; onToggleSave: () => void }) {
  return (
    <View style={styles.card}>
      <PressableScale scaleTo={0.98} onPress={onOpen} accessibilityLabel={`Open style from ${post.country}`}>
        <Image
          source={resolveImage(post.imageUrl)}
          accessibilityLabel={post.caption || `${post.category} style from ${post.country}`}
          contentFit="cover"
          transition={200}
          recyclingKey={post.id}
          style={{ width: "100%", aspectRatio: ratioOf(post) }}
        />
        <LinearGradient colors={[alpha(colors.black, 0.7), alpha(colors.black, 0)]} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={styles.cardShade}>
          <Text numberOfLines={1} size={12} weight="semibold" color={colors.white}>
            {post.authorName}
          </Text>
          <Text numberOfLines={1} size={11} color={alpha(colors.white, 0.8)}>
            {post.country} · {post.category}
          </Text>
        </LinearGradient>
      </PressableScale>
      <PressableScale
        scaleTo={0.9}
        onPress={onToggleSave}
        accessibilityLabel={saved ? "Remove from saved" : "Save"}
        accessibilityState={{ selected: saved }}
        hitSlop={4}
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: saved ? colors.white : alpha(colors.black, pressed ? 0.55 : 0.4) },
        ]}
      >
        <Bookmark size={18} strokeWidth={1.75} color={saved ? colors.olive : colors.white} fill={saved ? colors.olive : "none"} />
      </PressableScale>
    </View>
  );
}

export function ExploreScreen() {
  const role = useSession(s => s.me?.role);
  const isCustomer = role === "customer";
  const [tab, setTab] = React.useState<"discover" | "saved">("discover");
  const [country, setCountry] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search.trim());
  const [addOpen, setAddOpen] = React.useState(false);
  const [open, setOpen] = React.useState<ExplorePost | null>(null);
  const [override, setOverride] = React.useState<Record<string, boolean>>({});
  const queryClient = useQueryClient();

  const feed = useInfiniteQuery({
    queryKey: ["explore", country, category, q],
    queryFn: ({ pageParam }) => exploreRepo.list({ country, category, q, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: ExplorePage) => last.nextCursor ?? undefined,
    staleTime: STALE_MS,
  });
  const savedQ = useQuery({ queryKey: ["explore", "saved"], queryFn: exploreRepo.saved, staleTime: STALE_MS });

  const posts = React.useMemo(() => feed.data?.pages.flatMap(p => p.posts) ?? [], [feed.data]);
  const countries = feed.data?.pages[0]?.countries ?? [];
  const hasMore = !!feed.hasNextPage;

  const loadingMore = React.useRef(false);
  const loadMore = async () => {
    if (!hasMore || loadingMore.current || feed.isFetching) return;
    loadingMore.current = true;
    try {
      const r = await feed.fetchNextPage({ cancelRefetch: false });
      if (r.isFetchNextPageError) toast.error("Couldn't load more styles");
    } finally {
      loadingMore.current = false;
    }
  };

  const isSaved = (p: ExplorePost) => override[p.id] ?? p.saved;
  const savedFor = (p: ExplorePost) => (tab === "saved" ? override[p.id] !== false : isSaved(p));

  const toggleSave = async (p: ExplorePost) => {
    const next = !savedFor(p);
    setOverride(o => ({ ...o, [p.id]: next }));
    try {
      await exploreRepo.setSaved(p.id, next);
      queryClient.invalidateQueries({ queryKey: ["explore", "saved"] });
    } catch {
      setOverride(o => ({ ...o, [p.id]: !next }));
      toast.error("Couldn't update your saved styles");
    }
  };

  const remove = async (p: ExplorePost) => {
    try {
      await exploreRepo.remove(p.id);
      setOpen(null);
      toast.success("Post deleted");
    } catch {
      toast.error("Couldn't delete this post");
    }
  };

  const list = tab === "saved" ? (savedQ.data ?? []) : posts;
  const status =
    tab === "saved"
      ? savedQ.data
        ? "ready"
        : savedQ.isError
          ? "error"
          : "loading"
      : feed.data
        ? "ready"
        : feed.isError
          ? "error"
          : "loading";
  const refetch = () => (tab === "saved" ? savedQ.refetch() : feed.refetch());
  const filtered = !!(country || category || q);

  const header = (
    <View style={styles.headerRows}>
      <SegmentedControl
        accessibilityLabel="Explore view"
        block
        value={tab}
        onChange={setTab}
        options={[
          { value: "discover", label: "Discover" },
          { value: "saved", label: "Saved" },
        ]}
      />
      {tab === "discover" && (
        <>
          <SearchField value={search} onValueChange={setSearch} placeholder="Search styles, tags or studios" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
            <Chip size="sm" selected={!country} onPress={() => setCountry("")}>
              All countries
            </Chip>
            {countries.map(c => (
              <Chip key={c.name} size="sm" selected={country === c.name} count={c.count} onPress={() => setCountry(country === c.name ? "" : c.name)}>
                {c.name}
              </Chip>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
            <Chip size="sm" selected={!category} onPress={() => setCategory("")}>
              All styles
            </Chip>
            {EXPLORE_CATEGORIES.map(c => (
              <Chip key={c} size="sm" selected={category === c} onPress={() => setCategory(category === c ? "" : c)}>
                {c}
              </Chip>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );

  let body: React.ReactNode;
  if (status === "loading") body = <MasonrySkeleton />;
  else if (status === "error") body = <ErrorState title="Couldn't load Explore" onRetry={() => refetch()} />;
  else if (list.length === 0)
    body =
      tab === "saved" ? (
        <EmptyState icon={Bookmark} title="Nothing saved yet" description="Tap the bookmark on any style to keep it here for later." />
      ) : (
        <EmptyState
          icon={Compass}
          title={filtered ? "No styles match" : "Be the first to share a style"}
          description={
            filtered
              ? "Try a different country, category or search."
              : role === "tailor"
                ? "Post a design and inspire tailors around the world."
                : "Tailors haven't posted yet — check back soon."
          }
          action={
            role === "tailor" && !filtered ? (
              <Button icon={Plus} onPress={() => setAddOpen(true)}>
                Share a style
              </Button>
            ) : undefined
          }
        />
      );
  else
    body = (
      <>
        <Masonry
          items={list}
          height={p => 1 / ratioOf(p)}
          render={p => <PostCard key={p.id} post={p} saved={savedFor(p)} onOpen={() => setOpen(p)} onToggleSave={() => toggleSave(p)} />}
        />
        {tab === "discover" && hasMore && (
          <View style={styles.more}>
            <Button variant="secondary" loading={feed.isFetchingNextPage} onPress={loadMore}>
              Show more
            </Button>
          </View>
        )}
      </>
    );

  return (
    <Screen
      scroll={false}
      tabBar={isCustomer}
      header={{
        title: "Explore",
        description: "Style inspiration from tailors around the world",
        back: isCustomer ? undefined : "/today",
        actions:
          role === "tailor" ? (
            <Button size="icon" icon={Plus} accessibilityLabel="Share a style" onPress={() => setAddOpen(true)} />
          ) : undefined,
        children: header,
      }}
    >
      <Feed tabBar={isCustomer} onRefresh={refetch} onEndReached={tab === "discover" ? loadMore : undefined}>
        {body}
      </Feed>

      <PostViewer post={open} saved={open ? savedFor(open) : false} onClose={() => setOpen(null)} onToggleSave={toggleSave} onDelete={remove} />
      {role === "tailor" && <AddStyleSheet open={addOpen} onOpenChange={setAddOpen} />}
    </Screen>
  );
}

/** The scrolling board: pull to refresh, loads the next page near the end, collapses the header. */
function Feed({
  children,
  tabBar,
  onRefresh,
  onEndReached,
}: {
  children: React.ReactNode;
  tabBar: boolean;
  onRefresh: () => Promise<unknown>;
  onEndReached?: () => void;
}) {
  const onHeaderScroll = useScreenScroll();
  const tabInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onHeaderScroll(e);
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (onEndReached && layoutMeasurement.height + contentOffset.y >= contentSize.height - 600) onEndReached();
  };

  return (
    <ScrollView
      style={styles.fill}
      onScroll={onScroll}
      scrollEventThrottle={32}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: tabBar ? tabInset : 32 + insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.olive}
          colors={[colors.olive]}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await onRefresh();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerRows: { gap: 12, paddingBottom: 16 },
  chipScroll: { marginHorizontal: -GUTTER, flexGrow: 0 },
  chipRow: { gap: 8, paddingHorizontal: GUTTER, paddingBottom: 4 },
  masonry: { flexDirection: "row", gap: GAP, alignItems: "flex-start" },
  column: { flex: 1, minWidth: 0 },
  card: { marginBottom: GAP, overflow: "hidden", borderRadius: radii.card, backgroundColor: colors.surfaceSunken },
  cardShade: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingTop: 32, paddingBottom: 10 },
  saveBtn: { position: "absolute", right: 8, top: 8, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  more: { alignItems: "center", paddingVertical: 24 },
});

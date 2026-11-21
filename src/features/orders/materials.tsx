// Fabric & material photos for an order: the hero image that makes a job
// instantly recognisable, a strip of all photos, an add sheet (camera,
// gallery or built-in swatch library) and a full-screen viewer.
// Port of the web's src/components/order/materials.tsx (same API).

import * as React from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeOut, LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Camera, Check, ChevronDown, ImagePlus, Plus, Sparkles, Star, Trash2, X } from "lucide-react-native";
import { GarmentIcon } from "@/components/brand/garment-icon";
import { StitchLoader } from "@/components/brand/stitch-loader";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { PressableScale } from "@/components/ui/pressable";
import { BottomSheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { toast, ToastHost } from "@/components/ui/toast";
import { orderRepo } from "@/lib/api/repos";
import { compressPhoto, pickImage } from "@/lib/images";
import { FABRIC_LIBRARY, MATERIAL_KINDS, type MaterialKind, makeCaption, parseCaption } from "@/lib/fabrics";
import { resolveImage } from "@/lib/static-images";
import { alpha, colors, radii } from "@/theme/tokens";
import type { Media, Order } from "@/types";
import { materialThumbnail } from "./materials-thumbnail";

export { materialThumbnail };

// ------------------------------------------------------------------ state

export function coverOf(order: Order): Media | undefined {
  const media = order.media ?? [];
  const pinned = order.items[0]?.photos?.[0];
  return media.find(m => m.id === pinned) ?? media[0];
}

/** All photo operations for one order, keeping the list cover in sync. */
export function useOrderMaterials(order: Order, onOrder: (o: Order) => void) {
  const [busy, setBusy] = React.useState(false);

  const applyCover = async (m: Media | null) => {
    const thumbUrl = m ? await materialThumbnail(m.url).catch(() => m.url) : "";
    const updated = await orderRepo.setCover(order.id, m ? { mediaId: m.id, thumbUrl } : null);
    if (updated) onOrder(updated);
  };

  const add = async (url: string, caption: string) => {
    setBusy(true);
    try {
      const created = await orderRepo.addMedia(order.id, { url, caption });
      if (!created) throw new Error();
      const media = [created, ...(order.media ?? [])];
      onOrder({ ...order, media });
      // The first photo — or the first fabric photo — becomes the cover.
      const current = coverOf(order);
      const isFabric = parseCaption(caption).kind === "Fabric";
      if (!current || (isFabric && parseCaption(current.caption).kind !== "Fabric")) await applyCover(created);
      toast.success(`${parseCaption(caption).kind} photo added`);
    } catch {
      toast.error("Couldn't add this photo");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: Media) => {
    setBusy(true);
    try {
      await orderRepo.deleteMedia(order.id, m.id);
      const media = (order.media ?? []).filter(x => x.id !== m.id);
      const wasCover = coverOf(order)?.id === m.id;
      onOrder({ ...order, media });
      if (wasCover) await applyCover(media[0] ?? null);
      toast.success("Photo removed");
    } catch {
      toast.error("Couldn't remove this photo");
    } finally {
      setBusy(false);
    }
  };

  const makeCover = async (m: Media) => {
    setBusy(true);
    try {
      await applyCover(m);
      toast.success("Set as the order's cover");
    } catch {
      toast.error("Couldn't update the cover");
    } finally {
      setBusy(false);
    }
  };

  return { busy, add, remove, makeCover };
}

// ------------------------------------------------------------------- hero

export interface MaterialHeroProps {
  order: Order;
  clientPhoto?: string;
  subtitle: React.ReactNode;
  subtitleTone?: "default" | "danger";
  onAdd: () => void;
  onOpen: (index: number) => void;
}

/** Large fabric image with the garment and client written over it. */
export function MaterialHero({ order, clientPhoto, subtitle, subtitleTone = "default", onAdd, onOpen }: MaterialHeroProps) {
  const media = order.media ?? [];
  const cover = coverOf(order);
  const garment = order.items[0]?.garmentType || "Garment";

  // Photos haven't arrived yet (screen opened from the list copy): show the
  // small list thumbnail blurred, or a shimmer, instead of the empty state.
  if (order.media === undefined) {
    const thumb = order.items[0]?.imageUrl;
    return (
      <View style={[styles.hero, { backgroundColor: colors.surfaceSunken }]}>
        {thumb ? (
          <Image source={resolveImage(thumb)} blurRadius={24} contentFit="cover" style={[StyleSheet.absoluteFill, { transform: [{ scale: 1.1 }] }]} />
        ) : (
          <Skeleton variant="rectangular" style={[StyleSheet.absoluteFill, { borderRadius: 0 }]} />
        )}
      </View>
    );
  }

  if (!cover) {
    return (
      <View style={styles.heroEmpty}>
        <View style={styles.heroEmptyInner}>
          <View style={styles.heroEmptyIcon}>
            <GarmentIcon garment={garment} size={44} label="" />
          </View>
          <Text variant="title" align="center" style={{ marginTop: 16 }}>
            {garment}
          </Text>
          <View style={styles.heroEmptyClient}>
            <Avatar name={order.customerName} src={clientPhoto} size="xs" />
            <Text variant="label" color={colors.textTertiary}>
              {order.customerName}
            </Text>
          </View>
          {typeof subtitle === "string" || typeof subtitle === "number" ? (
            <Text variant="label" weight="medium" align="center" color={subtitleTone === "danger" ? colors.danger : colors.textTertiary} style={{ marginTop: 4 }}>
              {subtitle}
            </Text>
          ) : (
            <View style={{ marginTop: 4 }}>{subtitle}</View>
          )}
          <Text variant="label" align="center" color={colors.textSecondary} style={{ marginTop: 20, maxWidth: 320 }}>
            Add a photo of the client&apos;s fabric so anyone in the workshop can match it to this job.
          </Text>
          <Button icon={Camera} onPress={onAdd} style={{ marginTop: 16 }}>
            Add fabric
          </Button>
        </View>
      </View>
    );
  }

  const { kind, detail } = parseCaption(cover.caption);
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={() => onOpen(Math.max(0, media.findIndex(m => m.id === cover.id)))}
      accessibilityLabel={`View ${kind.toLowerCase()} photo for ${garment}`}
      style={[styles.hero, { backgroundColor: colors.panel }]}
    >
      <Image source={resolveImage(cover.url)} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.75)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0)"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.heroPill, { left: 16 }]}>
        <Text variant="caption" weight="semibold" color={colors.white} numberOfLines={1}>
          {kind}
          {detail ? (
            <Text variant="caption" weight="medium" color="rgba(255,255,255,0.8)">
              {" "}
              · {detail}
            </Text>
          ) : null}
        </Text>
      </View>
      {media.length > 1 && (
        <View style={[styles.heroPill, { right: 16, paddingHorizontal: 10 }]}>
          <Text variant="caption" weight="semibold" color={colors.white} tabular>
            1 / {media.length}
          </Text>
        </View>
      )}
      <View style={styles.heroBottom} pointerEvents="none">
        <Text size={28} weight="semibold" color={colors.white} style={{ letterSpacing: -0.6, lineHeight: 34 }} numberOfLines={2}>
          {garment}
        </Text>
        <View style={styles.heroMeta}>
          <View style={styles.heroAvatarRing}>
            <Avatar name={order.customerName} src={clientPhoto} size="xs" />
          </View>
          <Text variant="label" weight="semibold" color={colors.white}>
            {order.customerName}
          </Text>
          <Text variant="label" color="rgba(255,255,255,0.85)">
            ·
          </Text>
          {typeof subtitle === "string" || typeof subtitle === "number" ? (
            <Text
              variant="label"
              weight={subtitleTone === "danger" ? "semibold" : undefined}
              color={subtitleTone === "danger" ? "#FFB4A3" : "rgba(255,255,255,0.85)"}
            >
              {subtitle}
            </Text>
          ) : (
            subtitle
          )}
        </View>
      </View>
    </PressableScale>
  );
}

// ------------------------------------------------------------------ strip

export interface MaterialStripProps {
  order: Order;
  onAdd: () => void;
  /** Shortcut for the client's style references, right beside the photos. */
  onAddStyle?: () => void;
  onOpen: (i: number) => void;
}

/** Thumbnails of every photo plus an add tile. */
export function MaterialStrip({ order, onAdd, onAddStyle, onOpen }: MaterialStripProps) {
  const media = order.media ?? [];
  if (media.length === 0 && !onAddStyle) return null;
  const cover = coverOf(order);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
      contentContainerStyle={styles.stripContent}
    >
      {media.map((m, i) => {
        const kind = parseCaption(m.caption).kind;
        const isCover = m.id === cover?.id;
        return (
          <Animated.View
            key={m.id}
            entering={ZoomIn.springify().stiffness(420).damping(32)}
            exiting={ZoomOut.duration(160)}
            layout={LinearTransition.springify().stiffness(420).damping(32)}
            style={isCover ? styles.coverRing : null}
          >
            <PressableScale onPress={() => onOpen(i)} accessibilityLabel={`Open ${m.caption || "photo"}`} style={styles.thumb}>
              <Image source={resolveImage(m.url)} contentFit="cover" style={StyleSheet.absoluteFill} />
              {kind !== "Fabric" && (
                <View style={styles.thumbKind}>
                  <Text size={9} weight="semibold" color={colors.white} align="center" style={styles.kindLabel}>
                    {kind}
                  </Text>
                </View>
              )}
            </PressableScale>
          </Animated.View>
        );
      })}
      {media.length > 0 && (
        <PressableScale onPress={onAdd} accessibilityLabel="Add photo" style={[styles.thumb, styles.addTile]}>
          <Plus size={18} strokeWidth={2} color={colors.textTertiary} />
          <Text size={10} weight="semibold" color={colors.textTertiary}>
            Add
          </Text>
        </PressableScale>
      )}
      {onAddStyle && (
        <PressableScale onPress={onAddStyle} accessibilityLabel="Add the style the client wants" style={[styles.thumb, styles.addTile, styles.addStyleTile]}>
          <Sparkles size={17} strokeWidth={2} color={colors.olive} />
          <Text size={10} weight="semibold" color={colors.olive}>
            Add style
          </Text>
        </PressableScale>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------- style gallery

export interface StyleGalleryProps {
  order: Order;
  onAdd: () => void;
  onOpen: (i: number) => void;
}

/** The looks the client asked for, kept with the order for review at fittings. */
export function StyleGallery({ order, onAdd, onOpen }: StyleGalleryProps) {
  const [width, setWidth] = React.useState(0);
  const media = order.media ?? [];
  const styleItems = media.map((m, i) => ({ m, i })).filter(x => parseCaption(x.m.caption).kind === "Style");

  if (order.media === undefined) {
    return <Skeleton variant="rectangular" height={112} style={{ borderRadius: radii.card }} />;
  }

  if (styleItems.length === 0) {
    return (
      <PressableScale scaleTo={0.99} onPress={onAdd} style={styles.styleEmpty}>
        <View style={styles.styleEmptyIcon}>
          <Sparkles size={20} strokeWidth={1.75} color={colors.ink} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size={15} weight="semibold">
            Add the style the client wants
          </Text>
          <Text variant="label" color={colors.textTertiary}>
            Screenshots, magazine pages or sketches, kept with this order.
          </Text>
        </View>
        <Plus size={20} strokeWidth={1.75} color={colors.textTertiary} />
      </PressableScale>
    );
  }

  const GAP = 8;
  const cell = width > 0 ? (width - GAP * 2) / 3 : 0;

  return (
    <View style={styles.grid} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {cell > 0 &&
        styleItems.map(({ m, i }) => {
          const { detail } = parseCaption(m.caption);
          return (
            <Animated.View
              key={m.id}
              entering={ZoomIn.duration(200).withInitialValues({ transform: [{ scale: 0.9 }] })}
              exiting={FadeOut.duration(160)}
              layout={LinearTransition}
              style={{ width: cell }}
            >
              <PressableScale
                onPress={() => onOpen(i)}
                accessibilityLabel={`Open style photo${detail ? `: ${detail}` : ""}`}
                style={styles.styleCell}
              >
                <Image source={resolveImage(m.url)} contentFit="cover" style={StyleSheet.absoluteFill} />
                {detail ? (
                  <LinearGradient colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.7)"]} style={styles.styleCaption} pointerEvents="none">
                    <Text size={11} weight="medium" color={colors.white} numberOfLines={2} style={{ lineHeight: 13 }}>
                      {detail}
                    </Text>
                  </LinearGradient>
                ) : null}
              </PressableScale>
            </Animated.View>
          );
        })}
      {cell > 0 && (
        <Animated.View layout={LinearTransition} style={{ width: cell }}>
          <PressableScale onPress={onAdd} accessibilityLabel="Add style photo" style={[styles.styleCell, styles.styleAdd]}>
            <Plus size={20} strokeWidth={2} color={colors.textTertiary} />
            <Text variant="caption" weight="semibold" color={colors.textTertiary}>
              Add style
            </Text>
          </PressableScale>
        </Animated.View>
      )}
    </View>
  );
}

// ------------------------------------------------------------- add sheet

export interface AddMaterialSheetProps {
  open: boolean;
  /** Which kind of photo the sheet starts on. */
  initialKind?: MaterialKind;
  onOpenChange: (open: boolean) => void;
  /** Receives a ready-to-store image URL and caption. */
  onPick: (url: string, caption: string) => void | Promise<void>;
  busy?: boolean;
}

export function AddMaterialSheet({ open, onOpenChange, onPick, busy, initialKind = "Fabric" }: AddMaterialSheetProps) {
  const style = initialKind === "Style";
  const [working, setWorking] = React.useState(false);
  const locked = working || !!busy;
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      dismissible={!locked}
      title={style ? "Add a style photo" : "Add a photo"}
      description={
        style
          ? "Save the look the client wants (a screenshot, magazine page or sketch) so you can check the finished garment against it."
          : "Snap the client's fabric, or pick the closest swatch from the library."
      }
    >
      <AddMaterialBody
        key={open ? `open-${initialKind}` : "closed"}
        initialKind={initialKind}
        onPick={onPick}
        busy={busy}
        onWorking={setWorking}
        onDone={() => onOpenChange(false)}
      />
    </BottomSheet>
  );
}

function AddMaterialBody({
  onPick,
  busy,
  onDone,
  onWorking,
  initialKind,
}: {
  onPick: AddMaterialSheetProps["onPick"];
  busy?: boolean;
  onDone: () => void;
  onWorking: (w: boolean) => void;
  initialKind: MaterialKind;
}) {
  const [kind, setKind] = React.useState<MaterialKind>(initialKind);
  const [note, setNote] = React.useState("");
  const [working, setWorkingState] = React.useState(false);
  const [showCredits, setShowCredits] = React.useState(false);
  const [gridWidth, setGridWidth] = React.useState(0);

  const setWorking = (w: boolean) => {
    setWorkingState(w);
    onWorking(w);
  };

  const fromSource = async (source: "camera" | "library") => {
    try {
      const img = await pickImage(source);
      if (!img) return;
      setWorking(true);
      const url = await compressPhoto(img);
      await onPick(url, makeCaption(kind, note));
      onDone();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't use this photo");
    } finally {
      setWorking(false);
    }
  };

  const fromLibrary = async (src: string, name: string) => {
    setWorking(true);
    try {
      await onPick(src, makeCaption("Fabric", note.trim() ? `${name}, ${note.trim()}` : name));
      onDone();
    } finally {
      setWorking(false);
    }
  };

  const disabled = working || !!busy;
  const SWATCH_GAP = 12;
  const swatch = gridWidth > 0 ? (gridWidth - SWATCH_GAP * 2) / 3 : 0;

  return (
    <View accessibilityState={{ busy: disabled }} style={{ gap: 20 }}>
      <SegmentedControl
        accessibilityLabel="Photo type"
        block
        value={kind}
        onChange={setKind}
        options={MATERIAL_KINDS.map(k => ({ value: k.value, label: k.label }))}
      />
      <Input
        label="Note"
        hint="Optional"
        value={note}
        onChangeText={setNote}
        placeholder={kind === "Fabric" ? "e.g. 6 yards, brought by client" : kind === "Style" ? "e.g. Copy the neckline and sleeves" : "e.g. After 1st fitting"}
      />

      <View style={styles.sourceRow}>
        <PressableScale scaleTo={0.98} disabled={disabled} onPress={() => fromSource("camera")} style={[styles.sourceBtn, styles.sourceCamera, disabled && styles.disabled]}>
          <Camera size={22} strokeWidth={1.75} color={colors.textInverse} />
          <View>
            <Text size={15} weight="semibold" color={colors.textInverse}>
              Take photo
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.7)">
              Use the camera
            </Text>
          </View>
        </PressableScale>
        <PressableScale scaleTo={0.98} disabled={disabled} onPress={() => fromSource("library")} style={[styles.sourceBtn, styles.sourceGallery, disabled && styles.disabled]}>
          <ImagePlus size={22} strokeWidth={1.75} color={colors.ink} />
          <View>
            <Text size={15} weight="semibold">
              From gallery
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Pick an existing photo
            </Text>
          </View>
        </PressableScale>
      </View>

      {kind === "Fabric" && (
        <View>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text variant="caption" color={colors.textTertiary}>
              or choose a swatch
            </Text>
            <View style={styles.dividerLine} />
          </View>
          <View style={[styles.grid, { gap: SWATCH_GAP }]} onLayout={e => setGridWidth(e.nativeEvent.layout.width)}>
            {swatch > 0 &&
              FABRIC_LIBRARY.map(f => (
                <PressableScale
                  key={f.slug}
                  disabled={disabled}
                  onPress={() => fromLibrary(f.src, f.name)}
                  accessibilityLabel={f.name}
                  style={[{ width: swatch }, disabled && styles.disabled]}
                >
                  <View style={styles.swatch}>
                    <Image source={resolveImage(f.src)} contentFit="cover" style={StyleSheet.absoluteFill} />
                  </View>
                  <Text variant="caption" weight="medium" color={colors.textSecondary} numberOfLines={1} style={{ marginTop: 6 }}>
                    {f.name}
                  </Text>
                </PressableScale>
              ))}
          </View>
          <Pressable
            onPress={() => setShowCredits(s => !s)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showCredits }}
            style={styles.creditsToggle}
          >
            <ChevronDown size={12} strokeWidth={2} color={colors.textTertiary} style={{ transform: [{ rotate: showCredits ? "0deg" : "-90deg" }] }} />
            <Text size={11} weight="medium" color={colors.textTertiary}>
              Swatch photo credits
            </Text>
          </Pressable>
          {showCredits && (
            <View style={{ marginTop: 8, gap: 2 }}>
              {FABRIC_LIBRARY.map(f => (
                <Text key={f.slug} size={11} color={colors.textTertiary}>
                  {f.name}: {f.credit}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Clear "something is happening" state: covers the sheet while the photo uploads. */}
      {disabled && (
        <Animated.View entering={FadeIn.duration(160)} style={styles.busyOverlay}>
          <View style={styles.busyInner}>
            <View style={{ width: 224 }}>
              <StitchLoader
                color={colors.olive}
                label={kind === "Style" ? "Adding your style" : kind === "Fabric" ? "Adding your fabric" : "Adding your photo"}
              />
            </View>
            <Text variant="label" color={colors.textSecondary} align="center">
              This only takes a moment — please keep this open.
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------- viewer

export interface MaterialViewerProps {
  order: Order;
  index: number | null;
  onIndex: (i: number | null) => void;
  onRemove: (m: Media) => Promise<void>;
  onCover: (m: Media) => Promise<void>;
  busy?: boolean;
}

/** Full-screen photo viewer with cover / remove actions; swipe between photos. */
export function MaterialViewer({ order, index, onIndex, onRemove, onCover, busy }: MaterialViewerProps) {
  const media = order.media ?? [];
  const open = index !== null && media.length > 0;
  const i = Math.min(index ?? 0, Math.max(0, media.length - 1));
  const m = media[i];
  const [confirming, setConfirming] = React.useState(false);
  const isCover = !!m && coverOf(order)?.id === m.id;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = React.useRef<FlatList<Media>>(null);
  const page = React.useRef(i);

  // Keep the pager on the requested photo when the index changes from outside.
  React.useEffect(() => {
    if (!open || page.current === i) return;
    page.current = i;
    listRef.current?.scrollToOffset({ offset: i * width, animated: false });
  }, [open, i, width]);

  const close = () => {
    onIndex(null);
    setConfirming(false);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page.current && next >= 0 && next < media.length) {
      page.current = next;
      setConfirming(false);
      onIndex(next);
    }
  };

  const { kind, detail } = parseCaption(m?.caption);

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <View style={[styles.viewer, { paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(16, insets.bottom) }]}>
        <View style={styles.viewerHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text accessibilityRole="header" size={15} weight="semibold" color={colors.white} numberOfLines={1}>
              {kind}
              {detail ? (
                <Text size={15} color="rgba(255,255,255,0.7)">
                  {" "}
                  · {detail}
                </Text>
              ) : null}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.6)" tabular numberOfLines={1}>
              {i + 1} of {media.length} · {order.items[0]?.garmentType} for {order.customerName}
            </Text>
          </View>
          <PressableScale scaleTo={0.9} onPress={close} accessibilityLabel="Close" style={styles.viewerClose}>
            <X size={20} strokeWidth={1.75} color={colors.white} />
          </PressableScale>
        </View>

        <View style={{ flex: 1, paddingVertical: 16 }}>
          {open && (
            <FlatList
              ref={listRef}
              data={media}
              keyExtractor={x => x.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={i}
              getItemLayout={(_, idx) => ({ length: width, offset: width * idx, index: idx })}
              onMomentumScrollEnd={onMomentumEnd}
              scrollEnabled={media.length > 1}
              renderItem={({ item }) => (
                <View style={{ width, flex: 1, paddingHorizontal: 8 }}>
                  <Image
                    source={resolveImage(item.url)}
                    contentFit="contain"
                    accessibilityLabel={item.caption || "Order photo"}
                    style={{ flex: 1, borderRadius: radii.card }}
                  />
                </View>
              )}
            />
          )}
        </View>

        <View style={styles.viewerActions}>
          {confirming ? (
            <>
              <Button variant="inverse-ghost" style={{ flex: 1 }} onPress={() => setConfirming(false)}>
                Keep
              </Button>
              <Button
                variant="destructive-filled"
                style={{ flex: 1 }}
                loading={busy}
                onPress={async () => {
                  if (!m) return;
                  await onRemove(m);
                  setConfirming(false);
                  if (media.length <= 1) onIndex(null);
                  else onIndex(Math.max(0, i - 1));
                }}
              >
                Remove photo
              </Button>
            </>
          ) : (
            <>
              <Button variant="inverse-ghost" style={{ flex: 1 }} disabled={isCover || busy} icon={isCover ? Check : Star} onPress={() => m && onCover(m)}>
                {isCover ? "Cover photo" : "Set as cover"}
              </Button>
              <Button variant="inverse-ghost" style={{ flex: 1 }} icon={Trash2} onPress={() => setConfirming(true)}>
                Remove
              </Button>
            </>
          )}
        </View>
      </View>
      {/* Toasts raised from the viewer (cover / remove) must render above it. */}
      <ToastHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", aspectRatio: 4 / 3, borderRadius: radii.panel, overflow: "hidden" },
  heroEmpty: {
    overflow: "hidden",
    borderRadius: radii.panel,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  heroEmptyInner: { alignItems: "center", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  heroEmptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceSunken, alignItems: "center", justifyContent: "center" },
  heroEmptyClient: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 },
  heroPill: {
    position: "absolute",
    top: 16,
    maxWidth: "70%",
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 20 },
  heroMeta: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 },
  heroAvatarRing: { borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },

  strip: { marginHorizontal: -16, marginTop: 12 },
  stripContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: radii.control, overflow: "hidden", backgroundColor: colors.surfaceSunken },
  coverRing: { borderRadius: radii.control, boxShadow: `0px 0px 0px 2px ${colors.canvas}, 0px 0px 0px 4px ${colors.ink}`, marginHorizontal: 4 },
  thumbKind: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 2 },
  kindLabel: { textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 12 },
  addTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: "transparent",
  },
  addStyleTile: { borderColor: alpha(colors.olive, 0.5), backgroundColor: alpha(colors.oliveSoft, 0.4) },

  styleEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 16,
  },
  styleEmptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceSunken, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  styleCell: { aspectRatio: 3 / 4, borderRadius: radii.control, overflow: "hidden", backgroundColor: colors.surfaceSunken },
  styleCaption: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingTop: 24, paddingBottom: 6 },
  styleAdd: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: "transparent",
  },

  sourceRow: { flexDirection: "row", gap: 12 },
  sourceBtn: { flex: 1, alignItems: "flex-start", gap: 12, borderRadius: radii.card, padding: 16 },
  sourceCamera: { backgroundColor: colors.ink },
  sourceGallery: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  disabled: { opacity: 0.5 },
  dividerRow: { marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { height: 1, flex: 1, backgroundColor: colors.divider },
  swatch: { aspectRatio: 1, borderRadius: radii.control, overflow: "hidden", backgroundColor: colors.surfaceSunken },
  creditsToggle: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 4 },
  busyOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10,
    borderRadius: radii.card,
    backgroundColor: alpha(colors.surfaceRaised, 0.92),
  },
  busyInner: { alignItems: "center", gap: 8, paddingHorizontal: 24, paddingTop: 96 },

  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)" },
  viewerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16 },
  viewerClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  viewerActions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, width: "100%", maxWidth: 448, alignSelf: "center" },
});

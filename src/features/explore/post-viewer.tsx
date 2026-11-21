// Full-screen viewer for one Explore post: photo, author, caption, tags,
// save and (for your own posts) delete with an inline confirm.
// Port of tayylo/src/components/explore/post-viewer.tsx.

import * as React from "react";
import { Modal, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Bookmark, MapPin, Trash2, X } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { PressableScale } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { ToastHost } from "@/components/ui/toast";
import type { ExplorePost } from "@/lib/explore";
import { resolveImage } from "@/lib/static-images";
import { alpha, colors, radii } from "@/theme/tokens";

interface Props {
  post: ExplorePost | null;
  saved: boolean;
  onClose: () => void;
  onToggleSave: (post: ExplorePost) => void;
  onDelete: (post: ExplorePost) => Promise<void>;
}

export function PostViewer({ post, saved, onClose, onToggleSave, onDelete }: Props) {
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [area, setArea] = React.useState<{ width: number; height: number } | null>(null);
  // Keep the last post on screen while the modal fades out.
  const [shown, setShown] = React.useState<ExplorePost | null>(post);
  if (post && post !== shown) setShown(post);

  const close = () => {
    setConfirming(false);
    onClose();
  };

  const onArea = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea(a => (a && a.width === width && a.height === height ? a : { width, height }));
  };

  // `max-h-full max-w-full object-contain` with rounded corners: size the
  // image box to the photo so the rounding follows the picture.
  let imageSize: { width: number; height: number } | null = null;
  if (shown && area) {
    const ratio = shown.width && shown.height ? shown.width / shown.height : null;
    if (ratio) {
      const scale = Math.min(area.width / ratio, area.height);
      imageSize = { width: scale * ratio, height: scale };
      if (imageSize.width > area.width) imageSize = { width: area.width, height: area.width / ratio };
    } else imageSize = area;
  }

  return (
    <Modal visible={!!post} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <View
        accessibilityViewIsModal
        style={[styles.root, { paddingTop: Math.max(12, insets.top), paddingBottom: Math.max(16, insets.bottom) }]}
      >
        <View style={styles.top}>
          <View style={styles.topText}>
            <Text accessibilityRole="header" numberOfLines={1} size={15} weight="semibold" color={colors.white}>
              {shown?.authorName}
            </Text>
            <View style={styles.meta}>
              <MapPin size={12} strokeWidth={1.75} color={alpha(colors.white, 0.7)} />
              <Text variant="caption" numberOfLines={1} color={alpha(colors.white, 0.7)} style={{ flexShrink: 1 }}>
                {shown?.country} · {shown?.category}
              </Text>
            </View>
          </View>
          <PressableScale
            scaleTo={0.9}
            onPress={close}
            accessibilityLabel="Close"
            style={({ pressed }) => [styles.close, { backgroundColor: alpha(colors.white, pressed ? 0.2 : 0.1) }]}
          >
            <X size={20} strokeWidth={1.75} color={colors.white} />
          </PressableScale>
        </View>

        <View style={styles.stage}>
          <View style={styles.fill} onLayout={onArea}>
            {shown && imageSize ? (
              <View style={styles.center}>
                <Image
                  source={resolveImage(shown.imageUrl)}
                  accessibilityLabel={shown.caption || `Style from ${shown.country}`}
                  contentFit="contain"
                  transition={150}
                  style={[imageSize, { borderRadius: radii.card }]}
                />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.bottom}>
          {shown?.caption ? (
            <Text size={15} color={colors.white}>
              {shown.caption}
            </Text>
          ) : null}
          {shown && shown.tags.length > 0 ? (
            <Text variant="label" color={alpha(colors.white, 0.7)}>
              {shown.tags.map(t => `#${t}`).join("  ")}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {confirming ? (
              <>
                <Button variant="inverse-ghost" style={styles.flex1} onPress={() => setConfirming(false)}>
                  Keep
                </Button>
                <Button
                  variant="destructive-filled"
                  style={styles.flex1}
                  loading={deleting}
                  onPress={async () => {
                    if (!shown) return;
                    setDeleting(true);
                    await onDelete(shown).finally(() => setDeleting(false));
                    setConfirming(false);
                  }}
                >
                  Delete post
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="inverse-ghost"
                  style={styles.flex1}
                  accessibilityLabel={saved ? "Saved" : "Save"}
                  leading={<Bookmark size={18} strokeWidth={2} color={colors.textInverse} fill={saved ? colors.textInverse : "none"} />}
                  onPress={() => shown && onToggleSave(shown)}
                >
                  {saved ? "Saved" : "Save"}
                </Button>
                {shown?.mine && (
                  <Button variant="inverse-ghost" style={styles.flex1} icon={Trash2} onPress={() => setConfirming(true)}>
                    Delete
                  </Button>
                )}
              </>
            )}
          </View>
        </View>
      </View>
      {/* Toasts raised while the viewer is open must render above it. */}
      <ToastHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: alpha(colors.black, 0.9) },
  fill: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16 },
  topText: { flex: 1, minWidth: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stage: { flex: 1, paddingHorizontal: 8, paddingVertical: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bottom: { width: "100%", maxWidth: 448, alignSelf: "center", gap: 12, paddingHorizontal: 16 },
  actions: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },
});

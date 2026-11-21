// Client photos: fabric swatches, style references and fitting photos.
// Mirrors the web's src/components/client/photos-tab.tsx; photos come from
// the camera or library and are stored as JPEG data URLs like the web.

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Camera, ImagePlus, Trash2 } from "lucide-react-native";
import type { Media } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { customerRepo } from "@/lib/api/repos";
import { chooseImageSource, compressPhoto, pickImage } from "@/lib/images";
import { resolveImage } from "@/lib/static-images";
import { alpha, colors, radii, shadows } from "@/theme/tokens";

interface Props {
  clientId: string;
  media: Media[];
  onChange: (media: Media[]) => void;
}

export function PhotosTab({ clientId, media, onChange }: Props) {
  const [uploading, setUploading] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Media | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const upload = async () => {
    const source = await chooseImageSource();
    if (!source) return;
    const picked = await pickImage(source);
    if (!picked) return;
    setUploading(true);
    let url: string;
    try {
      url = await compressPhoto(picked);
    } catch {
      setUploading(false);
      toast.error("Couldn't read this file");
      return;
    }
    try {
      const item = await customerRepo.addMedia(clientId, {
        url,
        caption: `Style reference · ${new Date().toLocaleDateString("en-GB")}`,
      });
      if (item) {
        onChange([item, ...media]);
        toast.success("Photo added");
      }
    } catch {
      toast.error("Couldn't upload this photo");
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await customerRepo.deleteMedia(clientId, toDelete.id);
      onChange(media.filter(m => m.id !== toDelete.id));
      toast.success("Photo removed");
      setToDelete(null);
    } catch {
      toast.error("Couldn't remove this photo");
    } finally {
      setDeleting(false);
    }
  };

  const rows: Media[][] = [];
  for (let i = 0; i < media.length; i += 2) rows.push(media.slice(i, i + 2));

  return (
    <View>
      {media.length === 0 ? (
        <EmptyState
          variant="inset"
          icon={Camera}
          title="No photos yet"
          description="Keep fabric swatches, style references and fitting photos with the client."
          action={
            <Button icon={ImagePlus} onPress={upload} loading={uploading}>
              Add photo
            </Button>
          }
        />
      ) : (
        <>
          <View style={styles.head}>
            <Text variant="label" color={colors.textTertiary}>
              {media.length} {media.length === 1 ? "photo" : "photos"}
            </Text>
            <Button variant="secondary" size="sm" icon={ImagePlus} onPress={upload} loading={uploading}>
              Add photo
            </Button>
          </View>
          <View style={{ gap: 12 }}>
            {rows.map((row, ri) => (
              <View key={ri} style={styles.row}>
                {row.map(m => (
                  <View key={m.id} style={styles.figure}>
                    <Image
                      source={resolveImage(m.url)}
                      accessibilityLabel={m.caption || "Client photo"}
                      contentFit="cover"
                      style={StyleSheet.absoluteFill}
                    />
                    {m.caption ? (
                      <LinearGradient colors={[alpha(colors.ink, 0), alpha(colors.ink, 0.7)]} style={styles.caption}>
                        <Text numberOfLines={1} variant="caption" color={colors.textInverse}>
                          {m.caption}
                        </Text>
                      </LinearGradient>
                    ) : null}
                    <Pressable
                      onPress={() => setToDelete(m)}
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      hitSlop={4}
                      style={({ pressed }) => [styles.remove, pressed && { backgroundColor: colors.danger }]}
                    >
                      {({ pressed }) => <Trash2 size={16} strokeWidth={1.75} color={pressed ? colors.textInverse : colors.ink} />}
                    </Pressable>
                  </View>
                ))}
                {row.length < 2 && <View style={{ flex: 1 }} />}
              </View>
            ))}
          </View>
        </>
      )}

      <Dialog
        open={!!toDelete}
        onOpenChange={o => !o && setToDelete(null)}
        title="Remove this photo?"
        description="It will be deleted from the client's profile."
        dismissible={!deleting}
      >
        <DialogFooter style={{ marginTop: 8 }}>
          <Button variant="secondary" onPress={() => setToDelete(null)}>
            Keep
          </Button>
          <Button variant="destructive-filled" onPress={confirmDelete} loading={deleting}>
            Remove photo
          </Button>
        </DialogFooter>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  row: { flexDirection: "row", gap: 12 },
  figure: {
    flex: 1,
    aspectRatio: 4 / 5,
    overflow: "hidden",
    borderRadius: radii.card,
    backgroundColor: colors.surfaceSunken,
  },
  caption: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 24 },
  remove: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: alpha(colors.surfaceRaised, 0.9),
    boxShadow: shadows.xs,
  },
});

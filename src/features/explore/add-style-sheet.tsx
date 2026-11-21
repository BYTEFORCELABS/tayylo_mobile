// Share a style to Explore. While the photo uploads and the post is created,
// a stitching animation covers the sheet so it's clear the app is working.
// Port of tayylo/src/components/explore/add-style-sheet.tsx.

import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Camera, ImagePlus, RefreshCw } from "lucide-react-native";
import { StitchLoader } from "@/components/brand/stitch-loader";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/choice";
import { Input, Select } from "@/components/ui/input";
import { PressableScale } from "@/components/ui/pressable";
import { BottomSheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { exploreRepo } from "@/lib/api/repos";
import { EXPLORE_CATEGORIES, EXPLORE_COUNTRIES } from "@/lib/explore";
import { pickImage, preparePhoto } from "@/lib/images";
import { useBusiness } from "@/lib/use-business";
import { alpha, colors, radii } from "@/theme/tokens";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStyleSheet({ open, onOpenChange }: Props) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Share a style"
      description="Post a design to Explore so tailors around the world can get inspired. Only share work you made or have permission to share."
    >
      {open && <Body onDone={() => onOpenChange(false)} />}
    </BottomSheet>
  );
}

const COUNTRY_OPTIONS = EXPLORE_COUNTRIES.map(c => ({ value: c as string, label: c as string }));

function Body({ onDone }: { onDone: () => void }) {
  const { business } = useBusiness();
  const [photo, setPhoto] = React.useState<{ uri: string; width: number; height: number } | null>(null);
  const [category, setCategory] = React.useState<string>("");
  const [country, setCountry] = React.useState<string>(
    (EXPLORE_COUNTRIES as readonly string[]).includes(business?.country ?? "") ? business!.country : ""
  );
  const [caption, setCaption] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [preparing, setPreparing] = React.useState(false);
  const [posting, setPosting] = React.useState(false);
  const [previewWidth, setPreviewWidth] = React.useState(0);

  const choose = async (source: "camera" | "library") => {
    let picked;
    try {
      picked = await pickImage(source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't use this photo");
      return;
    }
    if (!picked) return;
    setPreparing(true);
    try {
      setPhoto(await preparePhoto(picked));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't use this photo");
    } finally {
      setPreparing(false);
    }
  };

  const ready = !!photo && !!category && !!country;

  const post = async () => {
    if (!photo || !ready || posting) return;
    setPosting(true);
    try {
      const imageUrl = await exploreRepo.upload(photo.uri);
      await exploreRepo.create({
        imageUrl,
        caption: caption.trim() || undefined,
        country,
        category,
        tags: tags.split(/[,\s#]+/).filter(Boolean).slice(0, 8),
        width: photo.width,
        height: photo.height,
      });
      toast.success("Your style is live on Explore");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't share this style");
      setPosting(false);
    }
  };

  // `max-h-72 w-full object-contain`: full width, natural height up to 288.
  const previewHeight = photo && previewWidth ? Math.min(288, (previewWidth * photo.height) / photo.width) : 0;

  return (
    <View style={styles.body} accessibilityState={{ busy: posting }}>
      {photo ? (
        <View style={styles.preview} onLayout={e => setPreviewWidth(e.nativeEvent.layout.width)}>
          {previewHeight ? (
            <Image source={{ uri: photo.uri }} accessibilityLabel="Selected style" contentFit="contain" style={{ width: "100%", height: previewHeight }} />
          ) : null}
          <Button variant="secondary" size="sm" icon={RefreshCw} style={styles.change} onPress={() => choose("library")}>
            Change
          </Button>
        </View>
      ) : (
        <View style={styles.sources}>
          <PressableScale
            disabled={preparing}
            onPress={() => choose("camera")}
            accessibilityLabel="Take photo"
            style={[styles.source, { backgroundColor: colors.ink }, preparing && styles.disabled]}
          >
            <Camera size={22} strokeWidth={1.75} color={colors.textInverse} />
            <Text size={15} weight="semibold" color={colors.textInverse}>
              Take photo
            </Text>
          </PressableScale>
          <PressableScale
            disabled={preparing}
            onPress={() => choose("library")}
            accessibilityLabel="From gallery"
            style={[styles.source, styles.sourceLight, preparing && styles.disabled]}
          >
            <ImagePlus size={22} strokeWidth={1.75} color={colors.ink} />
            <Text size={15} weight="semibold">
              From gallery
            </Text>
          </PressableScale>
        </View>
      )}
      {preparing && (
        <Text variant="label" align="center" color={colors.textSecondary}>
          Preparing photo…
        </Text>
      )}

      <View>
        <Text variant="label" weight="semibold" style={{ marginBottom: 8 }}>
          Category
        </Text>
        <View style={styles.wrap}>
          {EXPLORE_CATEGORIES.map(c => (
            <Chip key={c} size="sm" selected={category === c} onPress={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </View>
      </View>

      <Select label="Country" value={country} onChange={setCountry} options={COUNTRY_OPTIONS} placeholder="Choose a country" />

      <Input label="Caption" hint="Optional" value={caption} onChangeText={setCaption} maxLength={280} placeholder="e.g. Hand-beaded aso-oke gown" />
      <Input label="Tags" hint="Optional" value={tags} onChangeText={setTags} autoCapitalize="none" placeholder="e.g. agbada, lace, wedding" />

      <Button block size="lg" disabled={!ready || posting} onPress={post}>
        Share to Explore
      </Button>

      {posting && (
        <View style={styles.overlay} accessibilityLiveRegion="polite">
          <View style={styles.overlayInner}>
            <View style={{ width: 224 }}>
              <StitchLoader label="Publishing your style" color={colors.olive} />
            </View>
            <Text variant="label" align="center" color={colors.textSecondary}>
              Uploading your photo — please keep this open.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20 },
  preview: { overflow: "hidden", borderRadius: radii.card, backgroundColor: colors.surfaceSunken },
  change: { position: "absolute", right: 12, top: 12 },
  sources: { flexDirection: "row", gap: 12 },
  source: { flex: 1, alignItems: "flex-start", gap: 12, borderRadius: radii.card, padding: 16 },
  sourceLight: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised },
  disabled: { opacity: 0.5 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, borderRadius: radii.card, backgroundColor: alpha(colors.surfaceRaised, 0.9) },
  overlayInner: { alignItems: "center", gap: 8, paddingHorizontal: 24, paddingTop: 96 },
});

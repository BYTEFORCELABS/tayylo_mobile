// Share a client's measurements as a branded image card (Tayylo mark,
// who took the measurements and when), with the plain text alongside for
// chats that can't take a file. Mirrors the web's
// src/components/client/share-dialog.tsx; the card is rendered to a PNG with
// react-native-view-shot instead of html-to-image.

import * as React from "react";
import { Linking, Platform, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { captureRef } from "react-native-view-shot";
import Svg, { Path } from "react-native-svg";
import { Copy, Download } from "lucide-react-native";
import type { MeasurementSet, UnitSystem } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { TapeRule } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { Logo } from "@/components/brand/logo";
import { MeasurementIcon } from "@/components/brand/measurement-icon";
import { formatDate, formatMeasurement, unitLabel } from "@/lib/format";
import { shareText } from "@/lib/measurements";
import { alpha, colors } from "@/theme/tokens";
import { saveToPhotos } from "@/lib/save-to-photos";
import { measurementValue } from "@/theme/typography";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  phone?: string;
  businessName?: string;
  set?: MeasurementSet;
  unit: UnitSystem;
}

export function whatsappLink(phone: string, text: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** WhatsApp's brand green, as on the web's glyph. */
const WHATSAPP_GREEN = colors.whatsapp;

function WhatsAppGlyph({ size = 20 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill={WHATSAPP_GREEN}>
      <Path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.22-.16-.47-.29Z" />
    </Svg>
  );
}

export function ShareMeasurementsDialog({ open, onOpenChange, clientName, phone, businessName, set, unit }: ShareDialogProps) {
  const cardRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const [busy, setBusy] = React.useState<"image" | "whatsapp" | null>(null);
  const { height: screenH } = useWindowDimensions();
  if (!set) return null;

  const dateLabel = formatDate(set.takenAt);
  const text = shareText({ businessName, clientName, set, unit, dateLabel });
  const takenBy = businessName?.trim() || "your tailor";
  const fileName = `${clientName.replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-measurements`;

  /** Renders the fixed-width card to a PNG file and returns its URI. */
  const makeImage = async () => {
    if (!cardRef.current) throw new Error("Card not ready");
    return captureRef(cardRef.current, { format: "png", quality: 1, result: "tmpfile", fileName });
  };

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      toast.success("Measurements copied as text");
    } catch {
      toast.error("Couldn't copy the measurements");
    }
  };

  /** Saves the PNG card to Photos — the web's image download. */
  const saveImage = async () => {
    setBusy("image");
    try {
      const uri = await makeImage();
      if (await saveToPhotos(uri)) toast.success("Measurement card saved");
    } catch {
      toast.error("Couldn't create the image");
    } finally {
      setBusy(null);
    }
  };

  /** Share sheet with the image (pick WhatsApp); falls back to a WhatsApp text chat. */
  const sendWhatsApp = async () => {
    setBusy("whatsapp");
    try {
      const uri = await makeImage().catch(() => null);
      if (uri) {
        const message = `${clientName}'s measurements — taken by ${takenBy}`;
        if (Platform.OS === "ios") {
          await Share.share({ url: uri, message });
          return;
        }
        // Android's share sheet drops text next to a file: save the card, then open the chat with the text.
        const saved = await saveToPhotos(uri).catch(() => false);
        await Linking.openURL(phone ? whatsappLink(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`);
        if (saved) toast.success("Image saved — attach it in the chat");
        return;
      }
      await Linking.openURL(phone ? whatsappLink(phone, text) : `https://wa.me/?text=${encodeURIComponent(text)}`);
    } catch {
      toast.error("Couldn't share the measurements");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Share measurements" description="Sent as a branded image card, with the text included.">
      {/* Preview — the image is rendered from the fixed-width copy below */}
      <ScrollView nestedScrollEnabled style={{ maxHeight: screenH * 0.52 }} showsVerticalScrollIndicator={false}>
        <MeasurementCardArt clientName={clientName} takenBy={takenBy} dateLabel={dateLabel} set={set} unit={unit} />
      </ScrollView>

      {/* Off-screen, fixed-width card used for the image so it looks the same from any device */}
      <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.offscreen}>
        <View ref={cardRef} collapsable={false} style={styles.capture}>
          <MeasurementCardArt clientName={clientName} takenBy={takenBy} dateLabel={dateLabel} set={set} unit={unit} wide />
        </View>
      </View>

      <DialogFooter>
        <Button variant="ghost" icon={Copy} onPress={copy} disabled={!!busy}>
          Copy text
        </Button>
        <Button variant="secondary" icon={Download} onPress={saveImage} loading={busy === "image"} disabled={!!busy}>
          Save image
        </Button>
        <Button
          variant="secondary"
          leading={<WhatsAppGlyph />}
          onPress={sendWhatsApp}
          loading={busy === "whatsapp"}
          disabled={!!busy}
        >
          Send on WhatsApp
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

// ------------------------------------------------------------ card art

/** The branded measurement card: shown as a preview and rendered to the shared image. */
function MeasurementCardArt({
  clientName,
  takenBy,
  dateLabel,
  set,
  unit,
  wide,
}: {
  clientName: string;
  takenBy: string;
  dateLabel: string;
  set: MeasurementSet;
  unit: UnitSystem;
  /** Fixed two-column layout for the exported image. */
  wide?: boolean;
}) {
  const u = unitLabel(unit);
  const { width: screenW } = useWindowDimensions();
  // Web: one column on phones, two from 420px wide (always two in the image).
  const cols = wide || screenW >= 420 ? 2 : 1;
  const rows: (typeof set.values)[] = [];
  for (let i = 0; i < set.values.length; i += cols) rows.push(set.values.slice(i, i + cols));

  return (
    <View style={styles.card}>
      {/* Brand band with the tape-measure edge */}
      <View style={styles.band}>
        <TapeRule style={{ opacity: 0.3, height: 24 }} />
        <View style={styles.bandRow}>
          <Logo tone="cream" height={wide ? 26 : 22} />
          <Text numberOfLines={1} size={10.5} weight="semibold" color={colors.textOnPanelMuted} style={styles.bandLabel}>
            MEASUREMENT CARD
          </Text>
        </View>
      </View>

      <View style={[styles.body, wide && { paddingHorizontal: 28 }]}>
        <Text weight="semibold" size={wide ? 28 : 22} style={{ letterSpacing: -0.4, lineHeight: (wide ? 28 : 22) * 1.25 }}>
          {clientName}
        </Text>
        <Text variant="label" color={colors.textSecondary} style={{ marginTop: 6, lineHeight: 13 * 1.6 }}>
          {set.templateName} measurements taken by{" "}
          <Text variant="label" weight="semibold">
            {takenBy}
          </Text>{" "}
          on {dateLabel}.
        </Text>

        <View style={styles.values}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.valueRow}>
              {row.map(v => (
                <View key={v.fieldKey} style={styles.valueItem}>
                  <MeasurementIcon fieldKey={v.fieldKey} label={v.labelSnapshot} templateName={set.templateName} size={30} />
                  <Text size={13.5} color={colors.textSecondary} style={{ flex: 1, minWidth: 0, lineHeight: 13.5 * 1.375 }}>
                    {v.labelSnapshot}
                  </Text>
                  <Text numberOfLines={1} style={{ flexShrink: 0, textAlign: "right" }}>
                    <Text size={19} weight="semibold" style={measurementValue}>
                      {formatMeasurement(v.valueMm, unit)}
                    </Text>
                    <Text size={12} weight="medium" color={colors.textTertiary}>
                      {" "}
                      {u}
                    </Text>
                  </Text>
                </View>
              ))}
              {row.length < cols && <View style={{ flex: 1 }} />}
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Logo variant="symbol" height={14} />
            <Text variant="caption" color={colors.textTertiary} style={{ flexShrink: 1 }}>
              Measured and recorded with Tayylo
            </Text>
          </View>
          <Text tabular variant="caption" color={colors.textTertiary}>
            {set.values.length} measurements
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: "absolute", top: 0, left: -10000, width: 640 },
  capture: { width: 640, backgroundColor: colors.canvas },
  card: { overflow: "hidden", borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  band: { position: "relative", overflow: "hidden", backgroundColor: colors.panel, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 20 },
  bandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  bandLabel: { letterSpacing: 10.5 * 0.18 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  values: { marginTop: 20, gap: 8 },
  valueRow: { flexDirection: "row", gap: 8 },
  valueItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.7),
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  footer: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 16,
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
});

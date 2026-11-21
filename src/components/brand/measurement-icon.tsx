// Tayylo measurement artwork: the close-up icon for a body part, and the
// full body figure with that measurement highlighted. The same static SVGs
// the web serves from public/pictures/tayylo-measurement-icons, bundled via
// src/generated/measurement-svgs.ts (body in ink, tape in copper).

import * as React from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { SvgXml } from "react-native-svg";
import { Ruler } from "lucide-react-native";
import { colors, radii, shadows } from "@/theme/tokens";
import { bodyMapFor, measurementIconSrc, resolveMeasurementArt, type BodySex, type BodyView } from "@/lib/measurement-art";
import { MEASUREMENT_SVGS } from "@/generated/measurement-svgs";
import { Text } from "@/components/ui/text";

interface MeasurementIconProps {
  /** Template field key, e.g. "trouser_waist". */
  fieldKey?: string;
  /** Field label, used when the key isn't recognised. */
  label?: string;
  templateName?: string;
  size?: number;
  /** Draw on a soft rounded tile. */
  tile?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const MeasurementIcon = React.memo(function MeasurementIcon({ fieldKey, label, templateName, size = 32, tile = false, style }: MeasurementIconProps) {
  const art = resolveMeasurementArt({ key: fieldKey, label, templateName });
  const xml = art ? MEASUREMENT_SVGS[measurementIconSrc(art)] : undefined;
  const icon = xml ? (
    <SvgXml xml={xml} width={size} height={size} color={colors.ink} />
  ) : (
    <Ruler size={Math.round(size * 0.6)} strokeWidth={1.75} color={colors.textTertiary} />
  );
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[
        { alignItems: "center", justifyContent: "center" },
        tile ? { width: size + 12, height: size + 12, borderRadius: radii.sm, backgroundColor: colors.surfaceSunken } : { width: size, height: size },
        style,
      ]}
    >
      {icon}
    </View>
  );
});

interface MeasurementFigureProps {
  fieldKey?: string;
  label?: string;
  templateName?: string;
  sex: BodySex;
  /** Rendered height in px; the figure is 240 × 520. */
  height?: number;
  /** Show front / back / side chips when the measurement has several views. */
  showViews?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Full figure with the measurement drawn on it, with view switching. */
export function MeasurementFigure({ fieldKey, label, templateName, sex, height = 220, showViews = true, style }: MeasurementFigureProps) {
  const art = resolveMeasurementArt({ key: fieldKey, label, templateName });
  const [view, setView] = React.useState<BodyView | undefined>(undefined);
  // A new measurement starts on its primary view.
  const [forId, setForId] = React.useState(art?.id);
  if (forId !== art?.id) {
    setForId(art?.id);
    setView(undefined);
  }

  if (!art) {
    return (
      <View style={[{ height, alignItems: "center", justifyContent: "center" }, style]}>
        <Ruler size={40} strokeWidth={1.5} color={colors.textTertiary} />
      </View>
    );
  }

  const b = bodyMapFor(art, sex, view);
  const width = Math.round((height * 240) / 520);
  const map = MEASUREMENT_SVGS[b.map];
  const overlay = MEASUREMENT_SVGS[b.overlay];

  return (
    <View style={[{ alignItems: "center" }, style]}>
      <View style={{ width, height }} accessibilityRole="image" accessibilityLabel={`Where to measure ${art.name.toLowerCase()}`}>
        {map ? (
          <View style={{ position: "absolute", inset: 0, opacity: 0.9 }}>
            <SvgXml xml={map} width={width} height={height} color={colors.ink} />
          </View>
        ) : null}
        {overlay ? (
          <Animated.View key={b.overlay} entering={FadeIn.duration(200)} style={{ position: "absolute", inset: 0 }}>
            <SvgXml xml={overlay} width={width} height={height} color={colors.ink} />
          </Animated.View>
        ) : null}
      </View>
      {showViews && art.views.length > 1 && (
        <View accessibilityRole="radiogroup" accessibilityLabel="Figure view" style={{ marginTop: 8, flexDirection: "row", gap: 4, borderRadius: 999, backgroundColor: colors.surfaceSunken, padding: 2 }}>
          {art.views.map(v => {
            const on = b.view === v;
            return (
              <Pressable
                key={v}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setView(v)}
                style={[{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }, on && { backgroundColor: colors.surfaceRaised, boxShadow: shadows.xs }]}
              >
                <Text size={11} weight="semibold" color={on ? colors.ink : colors.textTertiary} style={{ textTransform: "capitalize" }}>
                  {v}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** How-to-measure text for a field, when the library has one. */
export function measurementMethod(field: { key?: string; label?: string; templateName?: string }) {
  return resolveMeasurementArt(field)?.method;
}

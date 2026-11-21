import * as React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Check, PenLine } from "lucide-react-native";
import { colors, radii, shadows } from "@/theme/tokens";
import { Chip, SearchField } from "@/components/ui/choice";
import { Text } from "@/components/ui/text";
import { GarmentIcon, resolveGarmentIcon } from "@/components/brand/garment-icon";
import { GARMENT_ICONS, type GarmentCategory, type GarmentIconMeta } from "@/lib/garment-icons";

const CATEGORIES: { key: GarmentCategory; label: string }[] = [
  { key: "traditional", label: "Traditional" },
  { key: "formal", label: "Formal" },
  { key: "womenswear", label: "Womenswear" },
  { key: "menswear", label: "Menswear" },
  { key: "outerwear", label: "Outerwear" },
  { key: "accessories", label: "Accessories" },
];

type Tab = "studio" | GarmentCategory;

interface GarmentPickerProps {
  /** Selected garment name ("Agbada", "Senator Wear"…) or "" for none. */
  value: string;
  onChange: (name: string) => void;
  /** Garments the studio said it makes during onboarding. */
  studioGarments?: string[];
  /** Called when the tailor wants to type a garment that isn't in the set. */
  onCustom: () => void;
  customActive?: boolean;
  error?: string;
}

/** Icon grid for choosing what is being made (3 per row, as on phones). */
export function GarmentPicker({ value, onChange, studioGarments = [], onCustom, customActive, error }: GarmentPickerProps) {
  const all = React.useMemo(() => Object.values(GARMENT_ICONS), []);
  const studio = React.useMemo(() => {
    const seen = new Set<string>();
    return studioGarments
      .map(g => resolveGarmentIcon(g))
      .filter(i => i.id !== "t-shirt" || studioGarments.some(g => /t-?shirt|tee/i.test(g)))
      .filter(i => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  }, [studioGarments]);

  const [tab, setTab] = React.useState<Tab>(studio.length ? "studio" : "traditional");
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();

  const shown: GarmentIconMeta[] = q
    ? all.filter(i => i.name.toLowerCase().includes(q) || i.id.includes(q.replace(/\s+/g, "-")))
    : tab === "studio"
      ? studio
      : all.filter(i => i.category === tab);

  const selectedId = value && !customActive ? resolveGarmentIcon(value).id : null;

  return (
    <View>
      <SearchField value={query} onValueChange={setQuery} placeholder="Search garments" />

      {!q && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 12 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
          {studio.length > 0 && (
            <Chip size="sm" selected={tab === "studio"} onPress={() => setTab("studio")}>
              Your garments
            </Chip>
          )}
          {CATEGORIES.map(c => (
            <Chip key={c.key} size="sm" selected={tab === c.key} onPress={() => setTab(c.key)}>
              {c.label}
            </Chip>
          ))}
        </ScrollView>
      )}

      <View accessibilityRole="list" accessibilityLabel="Garment" style={styles.grid}>
        {shown.map(icon => {
          const selected = icon.id === selectedId;
          return (
            <Pressable
              key={icon.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={icon.name}
              onPress={() => onChange(icon.name)}
              style={({ pressed }) => [
                styles.cell,
                selected ? styles.cellSelected : null,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
            >
              <GarmentIcon garment={icon.id} size={36} label="" color={selected ? colors.ink : colors.textSecondary} />
              <Text numberOfLines={2} variant="caption" weight="medium" align="center" color={selected ? colors.ink : colors.textSecondary} style={{ lineHeight: 15 }}>
                {icon.name}
              </Text>
              {selected && (
                <Animated.View entering={ZoomIn.duration(200)} style={styles.check}>
                  <Check size={12} strokeWidth={3} color={colors.textInverse} />
                </Animated.View>
              )}
            </Pressable>
          );
        })}
        <Pressable
          onPress={onCustom}
          accessibilityRole="button"
          accessibilityState={{ selected: !!customActive }}
          style={[styles.cell, styles.custom, customActive && { borderColor: colors.ink }]}
        >
          <PenLine size={26} strokeWidth={1.5} color={customActive ? colors.ink : colors.textTertiary} />
          <Text variant="caption" weight="medium" color={customActive ? colors.ink : colors.textTertiary}>
            Something else
          </Text>
        </Pressable>
      </View>

      {q && shown.length === 0 && (
        <Text variant="label" color={colors.textTertiary} style={{ marginTop: 12 }}>
          No garment called “{query}”. Use “Something else” to type it.
        </Text>
      )}
      {error ? (
        <Text accessibilityRole="alert" variant="caption" weight="medium" color={colors.danger} style={{ marginTop: 8 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: {
    width: "31.9%",
    flexGrow: 0,
    alignItems: "center",
    gap: 8,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: "rgba(227,224,214,0.8)",
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cellSelected: { borderColor: colors.ink, backgroundColor: colors.surfaceRaised, boxShadow: shadows.selectedRing },
  custom: { justifyContent: "center", borderStyle: "dashed", borderColor: colors.borderStrong, backgroundColor: "transparent" },
  check: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
});

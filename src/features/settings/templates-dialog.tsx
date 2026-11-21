// Read-only browser for the measurement templates (fields per garment).
// Port of the web's src/components/settings/templates-dialog.tsx.

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";
import { Dialog } from "@/components/ui/sheet";
import { SegmentedControl } from "@/components/ui/choice";
import { ErrorState, ListSkeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { MeasurementIcon } from "@/components/brand/measurement-icon";
import { useTemplates } from "@/lib/api/query";
import { alpha, colors, hairline, radii } from "@/theme/tokens";

export function TemplatesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Measurement templates"
      description="The fields Tayylo asks for when you measure each garment."
    >
      <TemplatesBody />
    </Dialog>
  );
}

function TemplatesBody() {
  const templatesQ = useTemplates();
  const templates = templatesQ.data ?? null;
  const failed = !templates && templatesQ.status === "error";
  const load = () => templatesQ.refetch();
  const [category, setCategory] = React.useState("All");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const categories = ["All", ...Array.from(new Set((templates ?? []).map(t => t.category)))];
  const shown = (templates ?? []).filter(t => category === "All" || t.category === category);

  return (
    <>
      {categories.length > 2 && (
        <SegmentedControl
          accessibilityLabel="Category"
          block
          size="sm"
          style={{ marginBottom: 16 }}
          value={category}
          onChange={setCategory}
          options={categories.map(c => ({ value: c, label: c }))}
        />
      )}

      {failed ? (
        <ErrorState title="Couldn't load templates" onRetry={load} style={{ paddingVertical: 32 }} />
      ) : !templates ? (
        <ListSkeleton count={5} avatar={false} />
      ) : (
        <View style={styles.list}>
          {shown.map((t, i) => {
            const isOpen = expanded === t.id;
            const groups = Array.from(new Set(t.fields.map(f => f.group)));
            return (
              <View key={t.id} style={i > 0 && styles.divider}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => setExpanded(isOpen ? null : t.id)}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: alpha(colors.beigeLight, 0.6) }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text size={15} weight="semibold">
                      {t.name}
                    </Text>
                    <Text variant="label" color={colors.textTertiary}>
                      {t.category} · {t.fields.length} measurements
                    </Text>
                  </View>
                  <View style={isOpen && { transform: [{ rotate: "180deg" }] }}>
                    <ChevronDown size={18} strokeWidth={1.75} color={colors.textTertiary} />
                  </View>
                </Pressable>
                {isOpen && (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.groups}>
                    {groups.map(g => (
                      <View key={g}>
                        <Text variant="overline" color={colors.textTertiary} style={{ marginBottom: 6 }}>
                          {g}
                        </Text>
                        <View style={styles.chips}>
                          {t.fields
                            .filter(f => f.group === g)
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .map(f => (
                              <View key={f.id} style={styles.chip}>
                                <MeasurementIcon fieldKey={f.key} label={f.label} templateName={t.name} size={22} />
                                <Text variant="caption" weight="medium" color={colors.textSecondary}>
                                  {f.label}
                                </Text>
                              </View>
                            ))}
                        </View>
                      </View>
                    ))}
                  </Animated.View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    overflow: "hidden",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.surface,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.divider },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  groups: { gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 2,
    paddingLeft: 4,
    paddingRight: 10,
  },
});

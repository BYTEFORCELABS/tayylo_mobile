import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Ruler } from "lucide-react-native";
import type { Customer, MeasurementTemplate } from "@/types";
import { colors, hairline, radii } from "@/theme/tokens";
import { Avatar } from "@/components/ui/avatar";
import { SegmentedControl } from "@/components/ui/choice";
import { List, ListItem } from "@/components/ui/list";
import { EmptyState, ListSkeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { GarmentIcon } from "@/components/brand/garment-icon";

interface TemplateStepProps {
  client: Customer | null;
  templates: MeasurementTemplate[];
  loading: boolean;
  category: string;
  onCategoryChange: (c: string) => void;
  onSelect: (t: MeasurementTemplate) => void;
}

/** Step 2: who is being measured, then which template. */
export function TemplateStep({ client, templates, loading, category, onCategoryChange, onSelect }: TemplateStepProps) {
  const categories = ["All", ...Array.from(new Set(templates.map(t => t.category)))];
  const shown = templates.filter(t => category === "All" || t.category === category);

  return (
    <View>
      {client && (
        <View style={styles.clientCard}>
          <Avatar name={client.fullName} src={client.photoUrl} size="sm" />
          <Text numberOfLines={1} variant="label" color={colors.textSecondary} style={{ flex: 1, minWidth: 0 }}>
            Measuring{" "}
            <Text variant="label" weight="semibold">
              {client.fullName}
            </Text>
          </Text>
        </View>
      )}
      {categories.length > 2 && (
        <SegmentedControl
          accessibilityLabel="Template category"
          block
          style={{ marginBottom: 20 }}
          value={category}
          onChange={onCategoryChange}
          options={categories.map(c => ({ value: c, label: c }))}
        />
      )}
      {loading ? (
        <ListSkeleton count={6} />
      ) : shown.length === 0 ? (
        <EmptyState variant="inset" icon={Ruler} title="No templates available" description="Measurement templates couldn't be found for your workspace." />
      ) : (
        <List>
          {shown.map(t => {
            const groups = Array.from(new Set(t.fields.map(f => f.group)))
              .slice(0, 3)
              .join(", ");
            return (
              <ListItem
                key={t.id}
                onPress={() => onSelect(t)}
                leading={
                  <View style={styles.garmentTile}>
                    <GarmentIcon garment={t.name} size={32} label="" />
                  </View>
                }
                title={t.name}
                subtitle={`${t.fields.length} measurements · ${groups}`}
                chevron
              />
            );
          })}
        </List>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  clientCard: {
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: hairline,
  },
  garmentTile: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceSunken,
  },
});

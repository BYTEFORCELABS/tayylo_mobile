// Measurement presentation. Values are always tabular, right-aligned, with
// the unit set smaller and muted so the number reads first.

import * as React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, hairline, radii } from "@/theme/tokens";
import { measurementValue } from "@/theme/typography";
import { MeasurementIcon } from "@/components/brand/measurement-icon";
import { DeltaChip } from "./tag";
import { Text } from "./text";

// ------------------------------------------------------- Hero value

interface MeasurementDisplayProps {
  fieldName: string;
  value: string;
  unit: string;
  previousValue?: string;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}

export function MeasurementDisplay({ fieldName, value, unit, previousValue, size = "lg", style }: MeasurementDisplayProps) {
  const valueSize = { sm: 36, md: 48, lg: 64 }[size];
  return (
    <View style={[{ alignItems: "center" }, style]}>
      <Text variant="overline" color={colors.textTertiary}>
        {fieldName}
      </Text>
      <View style={styles.heroRow} accessibilityLiveRegion="polite">
        <Text weight="semibold" size={valueSize} style={[measurementValue, { lineHeight: valueSize * 1.05 }]} color={value ? colors.ink : colors.borderStrong}>
          {value || "0"}
        </Text>
        <Text size={17} weight="medium" color={colors.textTertiary}>
          {unit}
        </Text>
      </View>
      {previousValue ? (
        <Text variant="label" color={colors.textTertiary} style={{ marginTop: 12 }}>
          Last time{" "}
          <Text tabular variant="label" weight="semibold" color={colors.textSecondary}>
            {previousValue} {unit}
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------- Grid cell

interface MeasurementCellProps {
  label: string;
  /** Template field key; shows the body-part illustration. */
  fieldKey?: string;
  value: string;
  unit: string;
  delta?: { label: string; direction: "up" | "down" };
  active?: boolean;
  empty?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Compact tile used in grids (capture overview). */
export function MeasurementCell({ label, fieldKey, value, unit, delta, active, empty, onPress, style }: MeasurementCellProps) {
  const body = (
    <>
      <View style={styles.cellLabel}>
        {fieldKey !== undefined && <MeasurementIcon fieldKey={fieldKey} label={label} size={22} />}
        <Text numberOfLines={1} variant="caption" weight="medium" color={colors.textTertiary} style={{ flexShrink: 1 }}>
          {label}
        </Text>
      </View>
      <View style={styles.cellValue}>
        <Text weight="semibold" size={22} style={[measurementValue, { lineHeight: 24 }]} color={empty ? colors.borderStrong : colors.ink}>
          {empty ? "—" : value}
        </Text>
        {!empty && (
          <Text variant="caption" weight="medium" color={colors.textTertiary}>
            {unit}
          </Text>
        )}
        {delta && <DeltaChip label={delta.label} direction={delta.direction} style={{ marginLeft: "auto" }} />}
      </View>
    </>
  );
  const base = [styles.cell, active && { backgroundColor: colors.oliveSoft }, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${empty ? "not taken" : `${value} ${unit}`}`}
        style={({ pressed }) => [...base, pressed && !active && { backgroundColor: colors.beigeLight }]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={base}>{body}</View>;
}

/** Container that draws hairlines between MeasurementCells (2 columns on phones). */
export function MeasurementGrid({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={[styles.grid, style]}>
      {rows.map((row, r) => (
        <View key={r} style={[styles.gridRow, r > 0 && { marginTop: 1 }]}>
          {row.map((cell, c) => (
            <View key={c} style={[{ flex: 1 }, c > 0 && { marginLeft: 1 }]}>
              {cell}
            </View>
          ))}
          {row.length === 1 && <View style={{ flex: 1, marginLeft: 1, backgroundColor: colors.surface }} />}
        </View>
      ))}
    </View>
  );
}

// ------------------------------------------------------- Spec sheet

export interface MeasurementRow {
  key: string;
  label: string;
  group?: string;
  value: string;
  unit: string;
  delta?: { label: string; direction: "up" | "down" };
  /** Secondary value (e.g. older version in a comparison). */
  compare?: string;
}

/**
 * Spec-sheet layout: rows grouped by body area, label on the left, aligned
 * value on the right. Reads like a tailor's measurement card.
 */
export function MeasurementSheet({
  rows,
  compareLabel,
  templateName,
  icons = true,
  style,
}: {
  rows: MeasurementRow[];
  compareLabel?: string;
  templateName?: string;
  icons?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const groups = React.useMemo(() => {
    const map = new Map<string, MeasurementRow[]>();
    for (const r of rows) {
      const g = r.group || "Measurements";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(r);
    }
    return Array.from(map.entries());
  }, [rows]);
  const showGroupTitles = groups.length > 1;

  return (
    <View style={[{ gap: 16 }, style]}>
      {groups.map(([group, items]) => (
        <View key={group} style={styles.sheetCard}>
          {showGroupTitles && (
            <View style={styles.sheetGroup}>
              <Text variant="overline" color={colors.textTertiary}>
                {group}
              </Text>
              {compareLabel ? (
                <Text variant="overline" color={colors.textTertiary}>
                  {compareLabel}
                </Text>
              ) : null}
            </View>
          )}
          {items.map((r, i) => (
            <View key={r.key} style={[styles.sheetRow, i > 0 && styles.sheetDivider]}>
              {icons && <MeasurementIcon fieldKey={r.key} label={r.label} templateName={templateName} size={30} tile />}
              <Text numberOfLines={1} size={15} color={colors.textSecondary} style={{ flex: 1, minWidth: 0 }}>
                {r.label}
              </Text>
              {r.delta && <DeltaChip label={r.delta.label} direction={r.delta.direction} />}
              {r.compare !== undefined && (
                <Text variant="label" color={colors.textTertiary} style={[measurementValue, { width: 64, textAlign: "right" }]}>
                  {r.compare}
                </Text>
              )}
              <View style={styles.sheetValue}>
                <Text weight="semibold" size={17} style={measurementValue}>
                  {r.value}
                </Text>
                <Text variant="caption" weight="medium" color={colors.textTertiary}>
                  {r.unit}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: { marginTop: 8, flexDirection: "row", alignItems: "baseline", gap: 8 },
  cell: { gap: 6, backgroundColor: colors.surface, padding: 16 },
  cellLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  cellValue: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  grid: { overflow: "hidden", borderRadius: radii.card, borderWidth: 1, borderColor: hairline, backgroundColor: colors.divider },
  gridRow: { flexDirection: "row" },
  sheetCard: { overflow: "hidden", borderRadius: radii.card, borderWidth: 1, borderColor: hairline, backgroundColor: colors.surface },
  sheetGroup: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  sheetDivider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.divider },
  sheetValue: { width: 80, flexDirection: "row", alignItems: "baseline", justifyContent: "flex-end", gap: 4 },
});

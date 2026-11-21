// A client's measurements: the current set as a spec sheet, the version
// history, and a compare/restore dialog. Mirrors the web's
// src/components/client/measurements-tab.tsx.

import * as React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { RotateCcw, Ruler, Share2 } from "lucide-react-native";
import type { MeasurementSet, MeasurementTemplate, UnitSystem } from "@/types";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { IconTile, List, ListItem } from "@/components/ui/list";
import { MeasurementSheet, type MeasurementRow } from "@/components/ui/measurement";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { measurementRepo } from "@/lib/api/repos";
import { formatDate, formatDelta, formatMeasurement, measurementDelta, unitLabel } from "@/lib/format";
import { buildRows, fieldInfoFor } from "@/lib/measurements";
import { colors } from "@/theme/tokens";

interface Props {
  clientId: string;
  measurements: MeasurementSet[];
  templates: MeasurementTemplate[];
  unit: UnitSystem;
  onChanged: (sets: MeasurementSet[]) => void;
  onShare: () => void;
}

export function MeasurementsTab({ clientId, measurements, templates, unit, onChanged, onShare }: Props) {
  const [view, setView] = React.useState<"current" | "history">("current");
  const [compareSet, setCompareSet] = React.useState<MeasurementSet | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  const current = measurements[0];
  const previous = measurements.find((m, i) => i > 0 && m.templateId === current?.templateId);

  if (!current) {
    return (
      <EmptyState
        variant="inset"
        icon={Ruler}
        title="No measurements yet"
        description="Use the tape keypad to capture a full set in about a minute."
        action={
          <Button icon={Ruler} onPress={() => router.push(`/measure?clientId=${clientId}`)}>
            Record measurements
          </Button>
        }
      />
    );
  }

  const rows = buildRows(current, unit, fieldInfoFor(templates, current.templateId), previous);

  const handleRestore = async (id: string) => {
    setRestoring(true);
    try {
      const restored = await measurementRepo.restoreVersion(id);
      if (restored) {
        onChanged(await measurementRepo.listByCustomer(clientId));
        setCompareSet(null);
        setView("current");
        toast.success("Restored as the current set");
      }
    } catch {
      toast.error("Couldn't restore this version");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View>
      <View style={styles.toolbar}>
        <SegmentedControl
          accessibilityLabel="Measurement view"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "current", label: "Current" },
            { value: "history", label: `History · ${measurements.length}` },
          ]}
        />
        <Button variant="ghost" size="sm" icon={Share2} onPress={onShare}>
          Share
        </Button>
      </View>

      {view === "current" ? (
        <View>
          <View style={styles.setHead}>
            <Text variant="headline">{current.templateName}</Text>
            <Text variant="label" color={colors.textTertiary}>
              {formatDate(current.takenAt)} · {current.values.length} measurements · {unitLabel(unit)}
            </Text>
            {current.note ? (
              <Text variant="label" color={colors.textSecondary} style={{ width: "100%" }}>
                “{current.note}”
              </Text>
            ) : null}
          </View>
          <MeasurementSheet rows={rows} templateName={current.templateName} />
          {previous && (
            <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 12, paddingHorizontal: 4 }}>
              Changes are compared with the {current.templateName.toLowerCase()} set from {formatDate(previous.takenAt)}.
            </Text>
          )}
        </View>
      ) : (
        <List>
          {measurements.map((ms, idx) => (
            <ListItem
              key={ms.id}
              onPress={() => setCompareSet(ms)}
              leading={<IconTile icon={Ruler} tone={idx === 0 ? "olive" : "neutral"} />}
              title={
                <View style={styles.titleRow}>
                  <Text numberOfLines={1} size={15} weight="semibold" style={{ flexShrink: 1 }}>
                    {ms.templateName}
                  </Text>
                  {idx === 0 && (
                    <Tag size="sm" variant="olive">
                      Current
                    </Tag>
                  )}
                  {ms.source === "restored" && (
                    <Tag size="sm" variant="default">
                      Restored
                    </Tag>
                  )}
                </View>
              }
              subtitle={`${formatDate(ms.takenAt)}${ms.note ? ` · ${ms.note}` : ""}`}
              chevron
            />
          ))}
        </List>
      )}

      <CompareDialog
        set={compareSet}
        current={current}
        unit={unit}
        templates={templates}
        restoring={restoring}
        onClose={() => setCompareSet(null)}
        onRestore={handleRestore}
      />
    </View>
  );
}

function CompareDialog({
  set,
  current,
  unit,
  templates,
  restoring,
  onClose,
  onRestore,
}: {
  set: MeasurementSet | null;
  current: MeasurementSet;
  unit: UnitSystem;
  templates: MeasurementTemplate[];
  restoring: boolean;
  onClose: () => void;
  onRestore: (id: string) => void;
}) {
  // Keep the last shown set while the dialog animates closed.
  const [shown, setShown] = React.useState(set);
  React.useEffect(() => {
    if (set) setShown(set);
  }, [set]);
  const s = set ?? shown;

  const isCurrent = s?.id === current.id;
  const info = s ? fieldInfoFor(templates, s.templateId) : {};
  const u = unitLabel(unit);

  // Rows show the selected version's value, with the current value for comparison.
  const rows: MeasurementRow[] = (s?.values ?? []).map(v => {
    const cur = current.values.find(c => c.fieldKey === v.fieldKey);
    const d = cur && !isCurrent ? measurementDelta(cur.valueMm, v.valueMm, unit) : 0;
    return {
      key: v.fieldKey,
      label: v.labelSnapshot,
      group: info[v.fieldKey]?.group,
      value: formatMeasurement(v.valueMm, unit),
      unit: u,
      compare: isCurrent ? undefined : cur ? formatMeasurement(cur.valueMm, unit) : "—",
      delta: d !== 0 ? { label: formatDelta(d, unit), direction: d > 0 ? ("up" as const) : ("down" as const) } : undefined,
    };
  });

  return (
    <Dialog
      open={!!set}
      onOpenChange={o => !o && onClose()}
      title={`${s?.templateName ?? ""} · ${s ? formatDate(s.takenAt) : ""}`}
      description={
        isCurrent
          ? "This is the current set."
          : "This version on the right, today's current value in grey. Changes show how the current set differs."
      }
    >
      <MeasurementSheet rows={rows} templateName={s?.templateName} compareLabel={isCurrent ? undefined : "Now"} />
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          Close
        </Button>
        {s && !isCurrent ? (
          <Button icon={RotateCcw} onPress={() => onRestore(s.id)} loading={restoring}>
            Restore as current
          </Button>
        ) : null}
      </DialogFooter>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  toolbar: { marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  setHead: { marginBottom: 12, flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8, rowGap: 4, paddingHorizontal: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});

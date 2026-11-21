// Record a fitting: outcome, measurement adjustments and notes.
// Port of the web's src/components/order/fitting-dialog.tsx.

import * as React from "react";
import { StyleSheet, View } from "react-native";
import { Plus } from "lucide-react-native";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { Select, Textarea } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { MeasurementIcon } from "@/components/brand/measurement-icon";
import { orderRepo } from "@/lib/api/repos";
import { unitLabel } from "@/lib/format";
import { alpha, colors, radii } from "@/theme/tokens";
import type { FittingAdjustment, UnitSystem } from "@/types";

const FALLBACK_FIELDS = ["Waist", "Trouser length", "Chest", "Sleeve length", "Shoulder", "Hips", "Neck", "Crotch rise"];

const IMPERIAL_DELTAS = [-1, -0.75, -0.5, -0.25, 0.25, 0.5, 0.75, 1];
const METRIC_DELTAS = [-3, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 3];

function deltaText(v: number, unit: UnitSystem) {
  const sign = v > 0 ? "+" : "−";
  const abs = Math.abs(v);
  if (unit === "metric") return `${sign}${abs} cm`;
  const whole = Math.floor(abs);
  const frac = abs - whole;
  const f = frac === 0.25 ? "¼" : frac === 0.5 ? "½" : frac === 0.75 ? "¾" : "";
  return `${sign}${whole > 0 ? whole : ""}${f || (whole === 0 ? "0" : "")} in`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  fittingNumber: number;
  unit: UnitSystem;
  /** Labels from the client's measurement set, when one is linked. */
  fieldOptions?: { key: string; label: string }[];
  onRecorded: () => void | Promise<void>;
}

export function RecordFittingDialog(props: Props) {
  // A fresh form every time the dialog opens (the web mounts it only while open).
  const [session, setSession] = React.useState(0);
  const [wasOpen, setWasOpen] = React.useState(props.open);
  if (props.open !== wasOpen) {
    if (props.open) setSession(s => s + 1);
    setWasOpen(props.open);
  }
  // Keep the title steady while the sheet animates closed.
  const [shownNumber, setShownNumber] = React.useState(props.fittingNumber);
  if (props.open && props.fittingNumber !== shownNumber) setShownNumber(props.fittingNumber);

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`Fitting ${shownNumber}`}
      description="Record how the garment fitted and any changes to make."
    >
      <FittingForm key={session} {...props} fittingNumber={shownNumber} />
    </Dialog>
  );
}

function FittingForm({ onOpenChange, orderId, fittingNumber, unit, fieldOptions, onRecorded }: Props) {
  const fields = fieldOptions?.length ? fieldOptions : FALLBACK_FIELDS.map(l => ({ key: l.toLowerCase().replace(/\s/g, "_"), label: l }));
  const deltas = unit === "metric" ? METRIC_DELTAS : IMPERIAL_DELTAS;

  const [outcome, setOutcome] = React.useState<"approved" | "adjustments_needed">("adjustments_needed");
  const [fieldKey, setFieldKey] = React.useState(fields[0].key);
  const [delta, setDelta] = React.useState<number>(unit === "metric" ? -1 : -0.5);
  const [adjustments, setAdjustments] = React.useState<FittingAdjustment[]>([]);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const add = () => {
    const field = fields.find(f => f.key === fieldKey);
    if (!field) return;
    const deltaMm = unit === "metric" ? delta * 10 : delta * 25.4;
    setAdjustments(prev => [
      ...prev.filter(a => a.fieldKey !== field.key),
      { fieldKey: field.key, label: field.label, deltaMm: Math.round(deltaMm * 10) / 10, rawDelta: deltaText(delta, unit) },
    ]);
  };

  const save = async () => {
    setSaving(true);
    try {
      await orderRepo.addFitting(orderId, {
        outcome,
        adjustments: outcome === "approved" ? [] : adjustments,
        notes: notes.trim() || undefined,
      });
      await onRecorded();
      toast.success(`Fitting ${fittingNumber} recorded`);
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save this fitting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={{ gap: 20 }}>
        <SegmentedControl
          accessibilityLabel="Fitting outcome"
          block
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "adjustments_needed", label: "Needs adjustments" },
            { value: "approved", label: "Approved" },
          ]}
        />

        {outcome === "adjustments_needed" && (
          <View style={styles.adjustBox}>
            <Text variant="label" weight="semibold" style={{ marginBottom: 12 }}>
              Adjustments
            </Text>
            <View style={[styles.row, { marginBottom: 8 }]}>
              <MeasurementIcon
                fieldKey={fieldKey}
                label={fields.find(f => f.key === fieldKey)?.label}
                size={36}
                tile
                style={{ backgroundColor: colors.surfaceRaised }}
              />
              <Select
                sheetTitle="Measurement"
                containerStyle={{ flex: 1, minWidth: 0 }}
                value={fieldKey}
                onChange={setFieldKey}
                options={fields.map(f => ({ value: f.key, label: f.label }))}
              />
            </View>
            <View style={styles.row}>
              <Select
                sheetTitle={`Change in ${unitLabel(unit)}`}
                containerStyle={{ flex: 1, minWidth: 0 }}
                value={String(delta)}
                onChange={v => setDelta(parseFloat(v))}
                options={deltas.map(d => ({ value: String(d), label: deltaText(d, unit) }))}
              />
              <Button variant="secondary" size="icon" onPress={add} accessibilityLabel="Add adjustment" icon={Plus} style={{ width: 48, height: 48 }} />
            </View>
            {adjustments.length > 0 ? (
              <View style={styles.tags}>
                {adjustments.map(a => (
                  <Tag key={a.fieldKey} variant="olive" onRemove={() => setAdjustments(prev => prev.filter(x => x.fieldKey !== a.fieldKey))} style={{ gap: 4 }}>
                    <MeasurementIcon fieldKey={a.fieldKey} label={a.label} size={18} />
                    <Text tabular size={12} weight="semibold" color={colors.oliveDeep}>
                      {a.label} {a.rawDelta}
                    </Text>
                  </Tag>
                ))}
              </View>
            ) : (
              <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 12 }}>
                Pick a measurement and change, then add it.
              </Text>
            )}
          </View>
        )}

        <Textarea
          label="Notes"
          hint="Optional"
          rows={3}
          value={notes}
          onChangeText={setNotes}
          placeholder="e.g. Taper trouser from the knee. Client happy with the shoulder."
        />
      </View>

      <DialogFooter>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onPress={save} loading={saving}>
          Save fitting
        </Button>
      </DialogFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  adjustBox: { borderRadius: radii.card, backgroundColor: alpha(colors.surfaceSunken, 0.6), padding: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  tags: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
});

import * as React from "react";
import { View } from "react-native";
import { Check, ClipboardList, User } from "lucide-react-native";
import type { Customer, MeasurementSet, MeasurementTemplate, TemplateField } from "@/types";
import { colors } from "@/theme/tokens";
import { measurementValue } from "@/theme/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { List, ListItem } from "@/components/ui/list";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { DeltaChip } from "@/components/ui/tag";
import { Text } from "@/components/ui/text";
import { MeasurementIcon } from "@/components/brand/measurement-icon";
import { SuccessMark } from "@/components/brand/success-mark";
import { formatDate } from "@/lib/format";
import type { Delta } from "./measure-logic";

interface ReviewStepProps {
  client: Customer | null;
  template: MeasurementTemplate | null;
  fields: TemplateField[];
  values: Record<string, string>;
  unitText: string;
  recordedCount: number;
  note: string;
  onNoteChange: (v: string) => void;
  deltaFor: (key: string, raw: string) => Delta | undefined;
  onEditField: (index: number) => void;
}

/** Step 3: every field with its value and change since last time, plus a version note. */
export function ReviewStep({ client, template, fields, values, unitText, recordedCount, note, onNoteChange, deltaFor, onEditField }: ReviewStepProps) {
  return (
    <View>
      <View style={{ marginBottom: 16, paddingHorizontal: 4 }}>
        <Text variant="label" color={colors.textSecondary}>
          <Text variant="label" weight="semibold">
            {template?.name}
          </Text>{" "}
          for {client?.fullName} ·{" "}
          <Text variant="label" tabular color={colors.textSecondary}>
            {recordedCount} of {fields.length}
          </Text>{" "}
          recorded
        </Text>
      </View>

      <List>
        {fields.map((f, i) => {
          const v = values[f.key];
          const delta = deltaFor(f.key, v || "");
          return (
            <ListItem
              key={f.key}
              onPress={() => onEditField(i)}
              leading={<MeasurementIcon fieldKey={f.key} label={f.label} templateName={template?.name} size={30} tile />}
              title={
                <Text numberOfLines={1} size={15} weight="medium" color={colors.textSecondary}>
                  {f.label}
                </Text>
              }
              subtitle={f.group}
              trailing={
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {delta && <DeltaChip label={delta.label} direction={delta.direction} />}
                  <Text size={17} weight="semibold" style={measurementValue} color={v ? colors.ink : colors.borderStrong}>
                    {v || "—"}
                  </Text>
                  {v ? (
                    <Text variant="caption" weight="medium" color={colors.textTertiary}>
                      {unitText}
                    </Text>
                  ) : null}
                </View>
              }
            />
          );
        })}
      </List>

      <Input
        containerStyle={{ marginTop: 24 }}
        label="Version note"
        hint="Optional"
        value={note}
        onChangeText={onNoteChange}
        placeholder="e.g. Added 1 in ease for wedding agbada"
      />
    </View>
  );
}

/** Sticky footer: Edit (back to the first field) and Save. */
export function ReviewFooter({ onEdit, onSave, saving, disabled }: { onEdit: () => void; onSave: () => void; saving: boolean; disabled: boolean }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Button variant="secondary" size="lg" onPress={onEdit}>
        Edit
      </Button>
      <Button size="lg" icon={Check} style={{ flex: 1 }} onPress={onSave} loading={saving} disabled={disabled}>
        Save measurements
      </Button>
    </View>
  );
}

interface SavedDialogProps {
  savedSet: MeasurementSet | null;
  client: Customer | null;
  template: MeasurementTemplate | null;
  onClose: () => void;
  onViewClient: () => void;
  onCreateOrder: () => void;
}

/** Success state after saving, with the two follow-up actions. */
export function SavedDialog({ savedSet, client, template, onClose, onViewClient, onCreateOrder }: SavedDialogProps) {
  return (
    <Dialog
      open={!!savedSet}
      hideClose
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <View style={{ alignItems: "center" }}>
        <View style={{ marginBottom: 12 }}>
          <SuccessMark size={72} label="Saved" />
        </View>
        <Text accessibilityRole="header" size={20} weight="semibold" align="center" style={{ letterSpacing: -0.4, lineHeight: 24 }}>
          Measurements saved
        </Text>
        <Text variant="label" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
          {template?.name} for {client?.fullName} is saved as a dated version
          {savedSet ? ` (${formatDate(savedSet.takenAt)})` : ""}. Earlier versions are kept.
        </Text>
      </View>
      <DialogFooter>
        <Button variant="secondary" icon={User} onPress={onViewClient}>
          View client
        </Button>
        <Button icon={ClipboardList} onPress={onCreateOrder}>
          Create an order
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

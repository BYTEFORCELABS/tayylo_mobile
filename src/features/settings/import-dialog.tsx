// Import clients from a CSV file or pasted rows.
// Port of the web's src/components/settings/import-dialog.tsx.

import * as React from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { FileUp } from "lucide-react-native";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { customerRepo } from "@/lib/api/repos";
import { colors } from "@/theme/tokens";

type Row = { fullName: string; phone?: string; email?: string; notes?: string };

/** Splits one CSV line, honouring quoted fields that contain commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseCsv(text: string): Row[] {
  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .map(splitCsvLine)
    .map(p => ({ fullName: p[0] || "", phone: p[1] || undefined, email: p[2] || undefined, notes: p[3] || undefined }))
    .filter(r => r.fullName && r.fullName.toLowerCase() !== "full name" && r.fullName.toLowerCase() !== "name");
}

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import clients"
      description="One client per row: name, phone, email, notes. Only the name is required."
    >
      <ImportForm onOpenChange={onOpenChange} />
    </Dialog>
  );
}

function ImportForm({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const [csv, setCsv] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const rows = React.useMemo(() => parseCsv(csv), [csv]);

  const chooseFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      setCsv(await new File(res.assets[0].uri).text());
    } catch {
      toast.error("Couldn't read that file");
    }
  };

  const run = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const count = await customerRepo.importCustomers(rows);
      toast.success(`Imported ${count} ${count === 1 ? "client" : "clients"}`);
      onOpenChange(false);
    } catch {
      toast.error("Import failed. Nothing was added.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="secondary" block icon={FileUp} onPress={chooseFile}>
        Choose a CSV file
      </Button>

      <View style={styles.or}>
        <View style={styles.rule} />
        <Text variant="caption" color={colors.textTertiary}>
          or paste rows
        </Text>
        <View style={styles.rule} />
      </View>

      <Textarea
        accessibilityLabel="CSV rows"
        rows={5}
        value={csv}
        onChangeText={setCsv}
        autoCapitalize="none"
        autoCorrect={false}
        inputStyle={{ fontFamily: MONO, fontSize: 13, lineHeight: 20 }}
        placeholder={"Chioma Adebayo, +234 803 999 1122, chioma@mail.com, Wedding guest\nEmeka Okafor, +234 812 555 7788, , Prefers kaftans"}
        helperText={csv.trim() ? `${rows.length} ${rows.length === 1 ? "client" : "clients"} ready to import` : undefined}
      />

      <DialogFooter>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onPress={run} loading={busy} disabled={rows.length === 0}>
          {`Import ${rows.length > 0 ? rows.length : ""}`.trim()}
        </Button>
      </DialogFooter>
    </>
  );
}

const styles = StyleSheet.create({
  or: { marginVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { height: 1, flex: 1, backgroundColor: colors.divider },
});

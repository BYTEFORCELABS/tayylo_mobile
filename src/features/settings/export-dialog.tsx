// Export the workspace as a clients CSV or a full JSON backup. The web
// downloads the file; here it is written to the cache directory and handed
// to the system share sheet (Save to Files, Drive, mail…).
// Port of the web's src/components/settings/export-dialog.tsx.

import * as React from "react";
import { ActivityIndicator } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Archive, Download, Sheet } from "lucide-react-native";
import { Dialog } from "@/components/ui/sheet";
import { IconTile, List, ListItem } from "@/components/ui/list";
import { toast } from "@/components/ui/toast";
import { exportData } from "@/lib/api/repos";
import { colors } from "@/theme/tokens";

async function download(content: string, mimeType: string, uti: string, filename: string) {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing unavailable");
  await Sharing.shareAsync(file.uri, { mimeType, UTI: uti, dialogTitle: filename });
}

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [busy, setBusy] = React.useState<"csv" | "json" | null>(null);
  const date = new Date().toISOString().slice(0, 10);

  const run = async (kind: "csv" | "json") => {
    setBusy(kind);
    try {
      const { csvStr, jsonStr } = await exportData();
      if (kind === "csv") {
        await download(csvStr, "text/csv", "public.comma-separated-values-text", `tayylo-clients-${date}.csv`);
        toast.success("Clients spreadsheet downloaded");
      } else {
        await download(jsonStr, "application/json", "public.json", `tayylo-backup-${date}.json`);
        toast.success("Full backup downloaded");
      }
    } catch {
      toast.error("Export failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const trailing = (kind: "csv" | "json") =>
    busy === kind ? <ActivityIndicator size="small" color={colors.ink} /> : <Download size={18} strokeWidth={1.75} color={colors.textTertiary} />;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Export data" description="Your records belong to you. Download a copy any time.">
      <List>
        <ListItem
          onPress={() => !busy && run("csv")}
          leading={<IconTile icon={Sheet} />}
          title="Clients spreadsheet"
          subtitle="CSV · opens in Excel, Sheets or Numbers"
          trailing={trailing("csv")}
        />
        <ListItem
          onPress={() => !busy && run("json")}
          leading={<IconTile icon={Archive} />}
          title="Full backup"
          subtitle="JSON · clients, measurement history and orders"
          trailing={trailing("json")}
        />
      </List>
    </Dialog>
  );
}

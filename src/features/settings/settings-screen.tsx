// Profile tab: studio identity, invoice branding, preferences, data tools
// and account. Port of the web's src/app/(app)/settings/page.tsx (phone layout).

import * as React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import { Coins, FileDown, FileUp, Landmark, Layers, LogOut, Mail, PenLine, RotateCcw, Ruler, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { Input, Select, type SelectOption } from "@/components/ui/input";
import { IconTile, List, ListItem } from "@/components/ui/list";
import { Overline, Screen } from "@/components/ui/page";
import { PressableScale } from "@/components/ui/pressable";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { accountRepo, businessRepo, resetWorkspace } from "@/lib/api/repos";
import { endLocalSession, signOut, useSession } from "@/lib/auth/session";
import { setCachedBusiness, useBusiness } from "@/lib/use-business";
import { CURRENCIES, currencySymbol, initials } from "@/lib/format";
import { alpha, colors, hairline, radii, shadows } from "@/theme/tokens";
import type { Business, UnitSystem } from "@/types";
import { TemplatesDialog } from "./templates-dialog";
import { ImportDialog } from "./import-dialog";
import { ExportDialog } from "./export-dialog";
import { BankAccountsDialog, BrandMark, LogoPicker, bankAccountsOf } from "./branding";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

export function SettingsScreen() {
  const email = useSession(s => s.me?.email);
  const { business, loading } = useBusiness();

  const [profileOpen, setProfileOpen] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [banksOpen, setBanksOpen] = React.useState(false);
  const accounts = bankAccountsOf(business);
  const defaultAccount = accounts.find(a => a.isDefault) ?? accounts[0];

  const updateUnit = async (unitSystem: UnitSystem) => {
    try {
      const updated = await businessRepo.update({ unitSystem });
      setCachedBusiness(updated);
      toast.success(unitSystem === "metric" ? "Measurements now in centimetres" : "Measurements now in inches");
    } catch {
      toast.error("Couldn't change the unit");
    }
  };

  // The root layout's route guards return to Welcome once the session ends.
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <Screen
      tabBar
      header={{
        title: "Profile",
        actions: (
          <Button
            variant="ghost"
            size="icon"
            icon={PenLine}
            accessibilityLabel="Edit studio profile"
            onPress={() => setProfileOpen(true)}
            disabled={!business}
          />
        ),
      }}
      contentStyle={{ gap: 24 }}
    >
      {/* Studio */}
      {loading || !business ? (
        <View style={styles.studioSkeleton}>
          <Skeleton variant="rectangular" width={104} height={104} style={{ borderRadius: 28 }} />
          <Skeleton width={140} height={22} />
        </View>
      ) : (
        <View accessibilityLabel="Studio" style={styles.studio}>
          <PressableScale
            onPress={() => setProfileOpen(true)}
            accessibilityLabel="Edit studio profile"
            style={[styles.studioMark, business.logoUrl ? styles.studioMarkLogo : styles.studioMarkInitials]}
          >
            {business.logoUrl ? (
              <BrandMark business={business} height={44} maxWidth={78} maxHeight={78} />
            ) : (
              <>
                <LinearGradient
                  pointerEvents="none"
                  colors={["rgba(255,255,255,0.16)", "rgba(255,255,255,0)"]}
                  locations={[0, 0.55]}
                  style={StyleSheet.absoluteFill}
                />
                <Text size={34} weight="semibold" color={colors.textInverse} style={{ letterSpacing: -0.85 }} importantForAccessibility="no">
                  {initials(business.name)}
                </Text>
              </>
            )}
          </PressableScale>
          <Text size={22} weight="medium" align="center" style={{ marginTop: 16, lineHeight: 27 }}>
            {business.name}
          </Text>
          <Text variant="label" color={colors.textTertiary} align="center" style={{ marginTop: 4 }}>
            {[business.ownerName || "Tailor", business.currency].filter(Boolean).join("  ·  ")}
          </Text>
        </View>
      )}

      <View style={styles.card}>
        {/* Invoices & receipts */}
        <View>
          <SectionLabel>Invoices &amp; receipts</SectionLabel>
          <List style={styles.flatList}>
            <LogoPicker />
            <ListItem
              onPress={() => setBanksOpen(true)}
              leading={<IconTile icon={Landmark} />}
              title="Bank accounts"
              subtitle={
                defaultAccount
                  ? `${defaultAccount.bankName} · ${defaultAccount.accountNumber}${accounts.length > 1 ? ` · +${accounts.length - 1} more` : ""}`
                  : "Add where clients should pay you"
              }
              chevron
            />
          </List>
        </View>

        {/* Preferences */}
        <View>
          <SectionLabel>Preferences</SectionLabel>
          <List style={styles.flatList}>
            <ListItem leading={<IconTile icon={Ruler} />} title="Measurement unit" subtitle="Used for capture, display and sharing">
              <SegmentedControl
                accessibilityLabel="Measurement unit"
                size="sm"
                style={{ marginTop: 12 }}
                value={business?.unitSystem ?? "imperial"}
                onChange={updateUnit}
                options={[
                  { value: "imperial", label: "Inches · ¼ ½ ¾" },
                  { value: "metric", label: "Centimetres" },
                ]}
              />
            </ListItem>
            <ListItem
              onPress={() => setProfileOpen(true)}
              leading={<IconTile icon={Coins} />}
              title="Currency"
              subtitle="For prices, deposits and balances"
              trailing={
                <Text variant="label" weight="semibold" color={colors.textSecondary}>
                  {business ? `${business.currency} ${currencySymbol(business.currency)}` : "—"}
                </Text>
              }
              chevron
            />
            <ListItem
              onPress={() => setTemplatesOpen(true)}
              leading={<IconTile icon={Layers} />}
              title="Measurement templates"
              subtitle="Fields used for each garment"
              chevron
            />
          </List>
        </View>

        {/* Data */}
        <View>
          <SectionLabel>Your data</SectionLabel>
          <List style={styles.flatList}>
            <ListItem
              onPress={() => setImportOpen(true)}
              leading={<IconTile icon={FileUp} />}
              title="Import clients"
              subtitle="From a CSV file or spreadsheet"
              chevron
            />
            <ListItem
              onPress={() => setExportOpen(true)}
              leading={<IconTile icon={FileDown} />}
              title="Export data"
              subtitle="Clients CSV or a full backup"
              chevron
            />
          </List>
        </View>

        {/* Account */}
        <View>
          <SectionLabel>Account</SectionLabel>
          <List style={styles.flatList}>
            {email ? <ListItem leading={<IconTile icon={Mail} />} title="Signed in as" subtitle={email} /> : null}
            <ListItem onPress={handleSignOut} leading={<IconTile icon={LogOut} />} title="Sign out" />
          </List>
        </View>
      </View>

      {/* Danger zone */}
      <View>
        <Overline style={{ marginBottom: 12, paddingHorizontal: 4 }}>Danger zone</Overline>
        <List>
          <ListItem
            onPress={() => setResetOpen(true)}
            leading={<IconTile icon={RotateCcw} tone="danger" />}
            title="Reset workspace data"
            subtitle="Deletes all clients, orders and measurements"
            tone="danger"
          />
          <ListItem
            onPress={() => setDeleteOpen(true)}
            leading={<IconTile icon={Trash2} tone="danger" />}
            title="Delete account"
            subtitle="Removes your login and everything in it"
            tone="danger"
          />
        </List>
      </View>

      <View style={styles.footer}>
        <Text variant="caption" color={colors.textTertiary}>
          {`Tayylo · Version ${Constants.expoConfig?.version ?? "1.0.0"}`}
        </Text>
      </View>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <BankAccountsDialog open={banksOpen} onOpenChange={setBanksOpen} />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset workspace data?"
        description="Every client, order, payment and measurement in this workspace will be permanently deleted. Your sign-in and studio profile stay."
        confirmWord="RESET"
        confirmLabel="Reset workspace"
        onConfirm={async () => {
          await resetWorkspace();
          toast.success("Workspace data cleared");
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete your account?"
        description="Your login, studio, clients, orders and measurements will be permanently deleted. Export your data first if you may need it."
        confirmWord="DELETE"
        confirmLabel="Delete account"
        onConfirm={async () => {
          await accountRepo.delete();
          await endLocalSession();
        }}
      />
    </Screen>
  );
}

// ------------------------------------------------------------- Profile

function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { business } = useBusiness();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Studio profile"
      description="Shown on shared measurement cards and across your workspace."
    >
      {business ? <ProfileForm business={business} onOpenChange={onOpenChange} /> : null}
    </Dialog>
  );
}

function ProfileForm({ business, onOpenChange }: { business: Business; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = React.useState(business.name);
  const [owner, setOwner] = React.useState(business.ownerName);
  const [country, setCountry] = React.useState(business.country);
  const [currency, setCurrency] = React.useState(business.currency);
  const [error, setError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError("Your studio needs a name");
      return;
    }
    setSaving(true);
    try {
      const updated = await businessRepo.update({
        name: name.trim(),
        ownerName: owner.trim(),
        country: country.trim(),
        currency,
      });
      setCachedBusiness(updated);
      toast.success("Studio profile saved");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't save your profile");
    } finally {
      setSaving(false);
    }
  };

  const knownCurrency = CURRENCIES.some(c => c.code === currency);
  const currencyOptions: SelectOption[] = [
    ...(knownCurrency ? [] : [{ value: currency, label: currency }]),
    ...CURRENCIES.map(c => ({ value: c.code, label: `${c.code} · ${currencySymbol(c.code)} · ${c.name}` })),
  ];

  return (
    <>
      <View style={{ gap: 20 }}>
        <Input
          label="Studio name"
          value={name}
          onChangeText={v => {
            setName(v);
            setError(undefined);
          }}
          error={error}
        />
        <Input label="Your name" hint="Optional" value={owner} onChangeText={setOwner} placeholder="Used in your greeting" />
        <Input label="Country" hint="Optional" value={country} onChangeText={setCountry} placeholder="e.g. Nigeria" />
        <Select label="Currency" value={currency} onChange={setCurrency} options={currencyOptions} />
      </View>
      <DialogFooter>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onPress={save} loading={saving}>
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

// ------------------------------------------------------------- Confirm

interface ConfirmProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmWord: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}

function ConfirmDialog(props: ConfirmProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <ConfirmBody {...props} />
    </Dialog>
  );
}

function ConfirmBody({ onOpenChange, title, description, confirmWord, confirmLabel, onConfirm }: ConfirmProps) {
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      toast.error("Something went wrong. Nothing was deleted.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <>
      <View style={styles.confirmHeader}>
        <View style={styles.confirmIcon}>
          <Trash2 size={22} strokeWidth={1.75} color={colors.danger} />
        </View>
        <Text accessibilityRole="header" size={20} weight="semibold" style={{ letterSpacing: -0.4, lineHeight: 24 }}>
          {title}
        </Text>
        <Text variant="label" color={colors.textSecondary}>
          {description}
        </Text>
      </View>
      <Input
        label={
          <Text variant="label" weight="semibold">
            Type{" "}
            <Text variant="label" weight="semibold" color={colors.danger} style={{ fontFamily: MONO }}>
              {confirmWord}
            </Text>{" "}
            to confirm
          </Text>
        }
        accessibilityLabel={`Type ${confirmWord} to confirm`}
        value={typed}
        onChangeText={setTyped}
        autoCapitalize="characters"
        autoComplete="off"
        autoCorrect={false}
      />
      <DialogFooter>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button variant="destructive-filled" onPress={run} loading={busy} disabled={typed.trim().toUpperCase() !== confirmWord}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Section heading inside the grouped Profile card. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 4 }}>
      <Text accessibilityRole="header" size={14} weight="medium" color={colors.textSecondary}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  studioSkeleton: { alignItems: "center", gap: 12, paddingTop: 8 },
  studio: { alignItems: "center", paddingTop: 8 },
  studioMark: {
    width: 104,
    height: 104,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  studioMarkLogo: {
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.6),
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    boxShadow: shadows.xs,
  },
  studioMarkInitials: { backgroundColor: colors.olive, boxShadow: shadows.raised },
  card: {
    overflow: "hidden",
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  flatList: { borderRadius: 0, borderWidth: 0, backgroundColor: "transparent" },
  footer: { alignItems: "center", gap: 8, paddingBottom: 16, paddingTop: 8 },
  confirmHeader: { gap: 6, paddingTop: 4, paddingBottom: 20, paddingRight: 40 },
  confirmIcon: {
    marginBottom: 8,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
});

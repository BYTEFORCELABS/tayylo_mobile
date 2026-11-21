// Studio branding and payment details used on invoices and receipts:
// the studio's own logo (falls back to the Tayylo mark) and the bank
// accounts clients pay into, one of which is the default.
// Port of the web's src/components/settings/branding.tsx.

import * as React from "react";
import { Pressable, StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";
import { Image } from "expo-image";
import { Landmark, Plus, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { businessRepo } from "@/lib/api/repos";
import { setCachedBusiness, useBusiness } from "@/lib/use-business";
import { chooseImageSource, pickImage, prepareLogo } from "@/lib/images";
import { resolveImage } from "@/lib/static-images";
import { alpha, colors, hairline, radii } from "@/theme/tokens";
import type { BankAccount, Business } from "@/types";

/** The studio's logo if it has one, otherwise the Tayylo lockup. */
export function BrandMark({
  business,
  height = 30,
  maxWidth,
  maxHeight,
  style,
}: {
  business: Business | null;
  height?: number;
  /** Extra bounds from the container (the web's `max-w-full` / `max-h-full`). */
  maxWidth?: number;
  maxHeight?: number;
  style?: StyleProp<ImageStyle>;
}) {
  // Natural aspect ratio of the uploaded logo, so the width follows it (`width: auto`).
  const [ratio, setRatio] = React.useState<number | null>(null);
  const logoUrl = business?.logoUrl;
  React.useEffect(() => setRatio(null), [logoUrl]);

  if (logoUrl) {
    const h = Math.min(Math.round(height * 1.5), maxHeight ?? Infinity);
    const capW = Math.min(height * 6, maxWidth ?? Infinity);
    const w = Math.min(h * (ratio ?? 1), capW);
    return (
      <Image
        source={resolveImage(logoUrl)}
        accessibilityLabel={business?.name}
        contentFit="contain"
        onLoad={e => {
          const { width, height: ih } = e.source;
          if (width > 0 && ih > 0) setRatio(width / ih);
        }}
        style={[{ height: h, width: w, flexShrink: 0 }, style]}
      />
    );
  }
  return <Logo height={height} style={style} />;
}

export function bankAccountsOf(business: Business | null): BankAccount[] {
  return Array.isArray(business?.bankAccounts) ? business.bankAccounts : [];
}

/** Account shown on an invoice: the order's choice if it still exists, else the default. */
export function invoiceAccount(business: Business | null, chosenId?: string | null) {
  const accounts = bankAccountsOf(business);
  return accounts.find(a => a.id === chosenId) ?? accounts.find(a => a.isDefault) ?? accounts[0] ?? null;
}

/** RFC 4122 v4 id (the web uses crypto.randomUUID). */
function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ------------------------------------------------------------------ logo

export function LogoPicker() {
  const { business } = useBusiness();
  const [busy, setBusy] = React.useState(false);

  const save = async (logoUrl: string | null) => {
    setBusy(true);
    try {
      setCachedBusiness(await businessRepo.update({ logoUrl }));
      toast.success(logoUrl ? "Logo updated" : "Logo removed — documents use the Tayylo mark");
    } catch {
      toast.error("Couldn't save the logo");
    } finally {
      setBusy(false);
    }
  };

  const choose = async () => {
    const source = await chooseImageSource(business?.logoUrl ? "Replace logo" : "Upload logo");
    if (!source) return;
    try {
      const img = await pickImage(source);
      if (!img) return;
      setBusy(true);
      const url = await prepareLogo(img);
      await save(url);
    } catch (e) {
      setBusy(false);
      toast.error((e as Error).message || "Couldn't read that image");
    }
  };

  return (
    <View style={styles.logoRow}>
      <View style={styles.logoBox}>
        <BrandMark business={business} height={24} />
      </View>
      <View style={{ minWidth: 0 }}>
        <Text size={15} weight="semibold">
          Brand logo
        </Text>
        <Text variant="label" color={colors.textSecondary}>
          {business?.logoUrl ? "Shown on your invoices and receipts." : "Using the Tayylo logo. Add yours to brand invoices and receipts."}
        </Text>
        <View style={styles.logoActions}>
          <Button size="sm" variant="secondary" loading={busy} onPress={choose}>
            {business?.logoUrl ? "Replace" : "Upload logo"}
          </Button>
          {business?.logoUrl ? (
            <Button size="sm" variant="ghost" disabled={busy} onPress={() => save(null)}>
              Remove
            </Button>
          ) : null}
        </View>
      </View>
    </View>
  );
}

// --------------------------------------------------------- bank accounts

export function BankAccountsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bank accounts"
      description="Clients see the default account on invoices. You can pick a different one on any invoice."
    >
      <BankAccountsBody onDone={() => onOpenChange(false)} />
    </Dialog>
  );
}

function BankAccountsBody({ onDone }: { onDone: () => void }) {
  const { business } = useBusiness();
  const accounts = bankAccountsOf(business);
  const [adding, setAdding] = React.useState(accounts.length === 0);
  const [busy, setBusy] = React.useState<string | null>(null);

  const persist = async (next: BankAccount[], key: string, message: string) => {
    setBusy(key);
    try {
      setCachedBusiness(await businessRepo.update({ bankAccounts: next }));
      toast.success(message);
      return true;
    } catch {
      toast.error("Couldn't save bank accounts");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const makeDefault = (id: string) =>
    persist(
      accounts.map(a => ({ ...a, isDefault: a.id === id })),
      `default:${id}`,
      "Default account updated"
    );

  const remove = (id: string) => {
    const rest = accounts.filter(a => a.id !== id);
    // The server promotes the first remaining account if the default was removed.
    return persist(rest, `delete:${id}`, "Account removed");
  };

  return (
    <>
      {accounts.length > 0 && (
        <View accessibilityRole="list" style={{ gap: 10 }}>
          {accounts.map(a => (
            <View
              key={a.id}
              style={[
                styles.account,
                a.isDefault
                  ? { borderColor: alpha(colors.olive, 0.5), backgroundColor: alpha(colors.oliveSoft, 0.4) }
                  : { borderColor: hairline, backgroundColor: colors.surface },
              ]}
            >
              <View style={styles.accountIcon}>
                <Landmark size={18} strokeWidth={1.75} color={colors.ink} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.accountTitle}>
                  <Text size={15} weight="semibold">
                    {a.bankName}
                  </Text>
                  {a.isDefault && (
                    <View style={styles.defaultPill}>
                      <Text size={11} weight="semibold" color={colors.textInverse}>
                        Default
                      </Text>
                    </View>
                  )}
                </View>
                <Text variant="label" tabular>
                  {a.accountNumber}
                </Text>
                <Text variant="label" color={colors.textSecondary} numberOfLines={1}>
                  {a.accountName}
                </Text>
                {!a.isDefault && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={!!busy}
                    onPress={() => makeDefault(a.id)}
                    hitSlop={6}
                    style={({ pressed }) => [{ marginTop: 6, alignSelf: "flex-start" }, (pressed || !!busy) && { opacity: busy ? 0.5 : 0.7 }]}
                  >
                    <Text variant="label" weight="semibold" color={colors.olive}>
                      Make default
                    </Text>
                  </Pressable>
                )}
              </View>
              <Button
                variant="ghost"
                size="icon"
                icon={Trash2}
                color={colors.danger}
                accessibilityLabel={`Delete ${a.bankName} account`}
                loading={busy === `delete:${a.id}`}
                disabled={!!busy}
                onPress={() => remove(a.id)}
                style={{ marginRight: -8, marginTop: -6 }}
              />
            </View>
          ))}
        </View>
      )}

      {adding ? (
        <AddAccountForm
          saving={busy === "add"}
          onCancel={accounts.length ? () => setAdding(false) : undefined}
          onSave={async acc => {
            const next = [...accounts, { ...acc, id: newId(), isDefault: accounts.length === 0 }];
            if (await persist(next, "add", "Bank account added")) setAdding(false);
          }}
        />
      ) : (
        <Button variant="secondary" block icon={Plus} onPress={() => setAdding(true)} disabled={accounts.length >= 10}>
          Add bank account
        </Button>
      )}

      <DialogFooter>
        <Button onPress={onDone}>Done</Button>
      </DialogFooter>
    </>
  );
}

function AddAccountForm({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: (a: Pick<BankAccount, "bankName" | "accountName" | "accountNumber">) => void;
  onCancel?: () => void;
}) {
  const [bankName, setBankName] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [accountName, setAccountName] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const submit = () => {
    const e: Record<string, string> = {};
    if (!bankName.trim()) e.bankName = "Enter the bank name";
    if (!accountNumber.trim()) e.accountNumber = "Enter the account number";
    if (!accountName.trim()) e.accountName = "Enter the account name";
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim() });
  };

  return (
    <View style={styles.form}>
      <Input label="Bank" value={bankName} onChangeText={setBankName} placeholder="e.g. GTBank" error={errors.bankName} />
      <Input
        label="Account number"
        value={accountNumber}
        onChangeText={setAccountNumber}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="0123456789"
        error={errors.accountNumber}
      />
      <Input
        label="Account name"
        value={accountName}
        onChangeText={setAccountName}
        placeholder="Name on the account"
        error={errors.accountName}
      />
      <View style={styles.formActions}>
        {onCancel && (
          <Button variant="ghost" onPress={onCancel}>
            Cancel
          </Button>
        )}
        <Button variant="tonal" onPress={submit} loading={saving}>
          Save account
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoRow: { flexDirection: "column", gap: 16, paddingHorizontal: 16, paddingVertical: 16 },
  logoBox: {
    height: 80,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    overflow: "hidden",
  },
  logoActions: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  account: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accountIcon: {
    marginTop: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  accountTitle: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8 },
  defaultPill: { borderRadius: radii.pill, backgroundColor: colors.olive, paddingHorizontal: 8, paddingVertical: 2 },
  form: {
    gap: 16,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});

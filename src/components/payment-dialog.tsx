// The single payment-recording flow used from Today and Order detail —
// same rules, chips and messages as the web's payment-dialog.tsx.

import * as React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import type { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { orderRepo } from "@/lib/api/repos";
import { currencySymbol, formatMoney } from "@/lib/format";
import { balanceMinor, PAYMENT_METHODS } from "@/lib/orders";

interface RecordPaymentDialogProps {
  order: Order | null;
  onOpenChange: (open: boolean) => void;
  /** Called after the payment is saved, so the caller can refetch. */
  onRecorded?: () => void | Promise<void>;
}

export function RecordPaymentDialog({ order, onOpenChange, onRecorded }: RecordPaymentDialogProps) {
  // Keep the last order while the sheet animates closed.
  const [shown, setShown] = React.useState(order);
  if (order && order !== shown) setShown(order);
  const balance = shown ? balanceMinor(shown) : 0;
  const currency = shown?.currency || "NGN";

  return (
    <Dialog
      open={!!order}
      onOpenChange={onOpenChange}
      title="Record payment"
      description={
        shown ? (
          <>
            {shown.customerName} · Order #{shown.number}
            {balance > 0 ? (
              <>
                {" · "}
                <Text tabular variant="label" weight="semibold">
                  {formatMoney(balance, currency)}
                </Text>{" "}
                outstanding
              </>
            ) : null}
          </>
        ) : undefined
      }
    >
      {/* Keyed by order, so every opening starts with a fresh form. */}
      {shown && <PaymentForm key={shown.id + String(!!order)} order={shown} onOpenChange={onOpenChange} onRecorded={onRecorded} />}
    </Dialog>
  );
}

function PaymentForm({ order, onOpenChange, onRecorded }: RecordPaymentDialogProps & { order: Order }) {
  const balance = balanceMinor(order);
  const currency = order.currency || "NGN";
  const [amount, setAmount] = React.useState(balance > 0 ? String(balance / 100) : "");
  const [method, setMethod] = React.useState<string>(PAYMENT_METHODS[0]);
  const [reference, setReference] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const handleSave = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    setSaving(true);
    try {
      const amountMinor = Math.round(num * 100);
      await orderRepo.addPayment(order.id, { amountMinor, method, reference: reference.trim() || undefined });
      await onRecorded?.();
      if (order.priceMinor > 0 && balance > 0 && amountMinor >= balance) {
        // This payment settles the order: the receipt is now generated.
        toast.success(`Paid in full — receipt ready for ${order.customerName}`, {
          action: { label: "View receipt", onClick: () => router.push(`/orders/${order.id}/receipt`) },
          duration: 8000,
        });
      } else {
        toast.success(`${formatMoney(amountMinor, currency)} recorded for ${order.customerName}`);
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save this payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={{ gap: 20 }}>
        <View>
          <Input
            label="Amount"
            keyboardType="decimal-pad"
            prefix={currencySymbol(currency)}
            value={amount}
            onChangeText={t => {
              setAmount(t.replace(/[^0-9.]/g, ""));
              setError(undefined);
            }}
            error={error}
            inputStyle={{ fontSize: 17, fontFamily: "Urbanist_600SemiBold", fontVariant: ["tabular-nums"] }}
          />
          {balance > 0 && (
            <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Chip size="sm" selected={amount === String(balance / 100)} onPress={() => setAmount(String(balance / 100))}>
                Full balance
              </Chip>
              <Chip size="sm" selected={amount === String(Math.round(balance / 200))} onPress={() => setAmount(String(Math.round(balance / 200)))}>
                {`Half · ${formatMoney(Math.round(balance / 2), currency)}`}
              </Chip>
            </View>
          )}
        </View>

        <View>
          <Text variant="label" weight="semibold" style={{ marginBottom: 8 }}>
            Method
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {PAYMENT_METHODS.map(m => (
              <Chip key={m} selected={method === m} onPress={() => setMethod(m)}>
                {m}
              </Chip>
            ))}
          </View>
        </View>

        <Input label="Reference" hint="Optional" value={reference} onChangeText={setReference} placeholder="Transfer ref or receipt number" />
      </View>

      <DialogFooter>
        <Button variant="secondary" onPress={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onPress={handleSave} loading={saving}>
          Save payment
        </Button>
      </DialogFooter>
    </View>
  );
}

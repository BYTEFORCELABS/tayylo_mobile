// Invoice and receipt for an order, generated from the order's own data:
// garment, services, agreed price and payments. Port of the web's
// src/components/order/order-document.tsx. The web's browser print becomes
// expo-print (print or share a PDF); the image share captures this view.

import * as React from "react";
import { ActionSheetIOS, Alert, Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { Check, Copy, FileQuestion, Landmark, Lock, MessageCircle, Printer, Share2 } from "lucide-react-native";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/page";
import { PressableScale } from "@/components/ui/pressable";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { orderRepo } from "@/lib/api/repos";
import { getQueryData, qk, useCustomer, useOrder } from "@/lib/api/query";
import { useBusiness } from "@/lib/use-business";
import { formatDate, formatMoney } from "@/lib/format";
import { balanceMinor, paidMinor } from "@/lib/orders";
import { alpha, colors, hairline, radii, shadows } from "@/theme/tokens";
import type { BankAccount, Business, Customer, Order } from "@/types";
import {
  bankAccountsOf,
  documentNumber,
  documentStatus,
  footerMessage,
  invoiceAccount,
  lastPaymentDate,
  linesFor,
  receiptAvailable,
  shareText,
  whatsappDigits,
  type DocumentKind,
} from "./document-model";
import { captureDocumentImage, printDocument, shareDocumentImage, shareDocumentPdf } from "./document-export";
import { saveToPhotos } from "@/lib/save-to-photos";

export { documentNumber, receiptAvailable, bankAccountsOf, invoiceAccount, type DocumentKind };

// ------------------------------------------------------------------ screen

export function OrderDocumentScreen({ orderId, kind }: { orderId: string; kind: DocumentKind }) {
  const { business } = useBusiness();
  const orderQ = useOrder(orderId);
  const listCopy = React.useMemo(() => getQueryData<Order[]>(qk.orders)?.find(o => o.id === orderId), [orderId]);
  // Pay-to account picked on this screen, shown instantly while it saves.
  const [payTo, setPayTo] = React.useState<string | undefined>(undefined);
  const loaded = orderQ.data !== undefined ? orderQ.data : (listCopy ?? null);
  const order = loaded && payTo !== undefined ? { ...loaded, bankAccountId: payTo } : loaded;
  const customer = useCustomer(order?.customerId ?? null).data ?? null;
  const title = kind === "invoice" ? "Invoice" : "Receipt";
  const docRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const [sharing, setSharing] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  // While capturing the image, on-screen helpers ("Copy") are hidden.
  const [capturing, setCapturing] = React.useState(false);
  const waDigits = order ? whatsappDigits(customer?.phones[0], order.currency) : null;

  /** Share the document itself (image) through the phone's share sheet — WhatsApp, Mail, Messages… */
  const share = async () => {
    if (!order || sharing) return;
    const name = documentNumber(kind, order);
    setSharing(true);
    setCapturing(true);
    try {
      // Let the "Copy" button disappear before the capture.
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 60)));
      await shareDocumentImage(docRef, name, title, shareText(kind, order, business));
    } catch {
      toast.error("Couldn't share this document");
    } finally {
      setCapturing(false);
      setSharing(false);
    }
  };

  /** WhatsApp links can't carry files: save the image, open the chat with the summary (as on the web). */
  const whatsapp = async () => {
    if (!order || !waDigits || sharing) return;
    const url = `https://wa.me/${waDigits}?text=${encodeURIComponent(shareText(kind, order, business))}`;
    setSharing(true);
    setCapturing(true);
    try {
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 60)));
      const file = await captureDocumentImage(docRef, documentNumber(kind, order)).catch(() => null);
      setCapturing(false);
      const saved = file ? await saveToPhotos(file).catch(() => false) : false;
      await Linking.openURL(url);
      if (saved) toast.success(`${title} image saved — attach it in the chat`);
    } catch {
      toast.error("Couldn't share this document");
    } finally {
      setCapturing(false);
      setSharing(false);
    }
  };

  const runPrint = async (mode: "print" | "pdf") => {
    if (!order || printing) return;
    setPrinting(true);
    try {
      if (mode === "print") await printDocument(kind, order, business, customer);
      else await shareDocumentPdf(kind, order, business, customer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // Dismissing the print dialog isn't an error.
      if (!/cancel/i.test(msg)) toast.error(mode === "print" ? "Couldn't print this document" : "Couldn't create the PDF");
    } finally {
      setPrinting(false);
    }
  };

  const printOrPdf = () => {
    const options = ["Print", "Save as PDF", "Cancel"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 2, title: `${title} ${order ? documentNumber(kind, order) : ""}` }, i => {
        if (i === 0) runPrint("print");
        if (i === 1) runPrint("pdf");
      });
    } else {
      Alert.alert("Print / PDF", undefined, [
        { text: "Print", onPress: () => runPrint("print") },
        { text: "Save as PDF", onPress: () => runPrint("pdf") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const actions =
    order && (kind === "invoice" || receiptAvailable(order)) ? (
      <>
        {waDigits && (
          <Button variant="secondary" size="icon-sm" icon={MessageCircle} disabled={sharing} onPress={whatsapp} accessibilityLabel="Send to client on WhatsApp" />
        )}
        <Button variant="secondary" size="icon-sm" icon={Share2} loading={sharing} onPress={share} accessibilityLabel="Share" />
        <Button size="icon-sm" icon={Printer} loading={printing} onPress={printOrPdf} accessibilityLabel="Print or save as PDF" />
      </>
    ) : null;

  const header = {
    variant: "compact" as const,
    back: `/orders/${orderId}`,
    backLabel: "Back to order",
    title: (
      <>
        {title}
        {order ? (
          <Text variant="headline" weight="medium" color={colors.textTertiary}>
            {" "}
            · {documentNumber(kind, order)}
          </Text>
        ) : null}
      </>
    ),
    actions,
  };

  if (!order) {
    return (
      <Screen header={header} scroll={orderQ.data === null || orderQ.status === "error" ? false : true}>
        {orderQ.data === null ? (
          <EmptyState icon={FileQuestion} title="Order not found" description="It may have been removed, or the link is incorrect." />
        ) : orderQ.status === "error" ? (
          <ErrorState title={`Couldn't load this ${title.toLowerCase()}`} onRetry={() => orderQ.refetch()} />
        ) : (
          <LoadingRegion label={`Loading ${title.toLowerCase()}`} style={{ paddingTop: 16 }}>
            <Skeleton variant="rectangular" height={520} style={{ borderRadius: radii.panel }} />
          </LoadingRegion>
        )}
      </Screen>
    );
  }

  if (kind === "receipt" && !receiptAvailable(order)) {
    const balance = balanceMinor(order);
    return (
      <Screen header={header} scroll={false}>
        <EmptyState
          icon={Lock}
          title="Receipt not ready yet"
          description={
            order.priceMinor > 0
              ? `The receipt is generated automatically once the order is paid in full. ${formatMoney(balance, order.currency)} is still outstanding.`
              : "Set a price on this order and record payment to generate a receipt."
          }
          action={
            <Button variant="secondary" onPress={() => router.push(`/orders/${order.id}/invoice`)}>
              View invoice instead
            </Button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} onRefresh={() => orderQ.refetch()} contentStyle={{ paddingHorizontal: 12, paddingTop: 16, paddingBottom: 64 }}>
      {kind === "invoice" && <PayToPicker order={order} business={business} onPick={setPayTo} />}
      <View ref={docRef} collapsable={false} style={{ backgroundColor: colors.white }}>
        <OrderDocument kind={kind} order={order} business={business} customer={customer} capturing={capturing} />
      </View>
    </Screen>
  );
}

// ------------------------------------------------------------- brand mark

/** The studio's logo when it has one, otherwise the Tayylo mark. */
function BrandMark({ business, height = 30 }: { business: Business | null; height?: number }) {
  const [ratio, setRatio] = React.useState<number | null>(null);
  if (business?.logoUrl) {
    const h = Math.round(height * 1.5);
    const w = Math.min(height * 6, h * (ratio ?? 1));
    return (
      <Image
        source={{ uri: business.logoUrl }}
        accessibilityLabel={business.name}
        contentFit="contain"
        contentPosition="left"
        onLoad={e => e.source.height > 0 && setRatio(e.source.width / e.source.height)}
        style={{ height: h, width: w, maxWidth: "100%" }}
      />
    );
  }
  return <Logo height={height} />;
}

// -------------------------------------------------------------- document

export function OrderDocument({
  kind,
  order,
  business,
  customer,
  capturing,
}: {
  kind: DocumentKind;
  order: Order;
  business: Business | null;
  customer: Customer | null;
  /** Hides on-screen helpers while the document is captured as an image. */
  capturing?: boolean;
}) {
  const paid = paidMinor(order);
  const balance = balanceMinor(order);
  const money = (m: number) => formatMoney(m, order.currency);
  const lines = linesFor(order);
  const payments = [...order.payments].sort((a, b) => +new Date(a.paidAt) - +new Date(b.paidAt));
  const issued = kind === "invoice" ? new Date(order.createdAt) : lastPaymentDate(order);
  const status = documentStatus(order);
  const account = invoiceAccount(business, order.bankAccountId);
  const statusTone =
    status === "Paid"
      ? { bg: colors.successBg, fg: colors.success }
      : status === "Part paid"
        ? { bg: colors.warningBg, fg: colors.warning }
        : { bg: colors.dangerBg, fg: colors.danger };

  return (
    <View style={styles.article}>
      {/* Brand band */}
      <View style={styles.band} />

      <View style={styles.inner}>
        <View>
          <View style={styles.headTop}>
            <View style={{ maxWidth: "55%", flexShrink: 1 }}>
              <BrandMark business={business} height={26} />
            </View>
            <View style={{ flexShrink: 0, alignItems: "flex-end" }}>
              <Text size={22} weight="semibold" color={colors.olive} style={styles.docTitle}>
                {kind === "invoice" ? "Invoice" : "Receipt"}
              </Text>
              <Text variant="caption" weight="semibold" tabular style={{ marginTop: 6 }}>
                {documentNumber(kind, order)}
              </Text>
            </View>
          </View>
          <View style={styles.headBottom}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={17} weight="semibold" style={{ lineHeight: 21 }}>
                {business?.name || "Your studio"}
              </Text>
              <Text variant="label" color={colors.textTertiary}>
                {[business?.ownerName, business?.country].filter(Boolean).join(" · ") || "Tailoring studio"}
              </Text>
            </View>
            <View style={[styles.status, { backgroundColor: statusTone.bg }]}>
              <Text variant="caption" weight="semibold" color={statusTone.fg}>
                {status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.meta}>
          <View style={{ width: "100%" }}>
            <Text variant="overline" color={colors.textTertiary}>
              {kind === "invoice" ? "Bill to" : "Received from"}
            </Text>
            <Text size={15} weight="semibold" style={{ marginTop: 6 }}>
              {order.customerName}
            </Text>
            {customer?.phones[0] ? (
              <Text variant="label" color={colors.textSecondary}>
                {customer.phones[0]}
              </Text>
            ) : null}
            {customer?.email ? (
              <Text variant="label" color={colors.textSecondary} numberOfLines={1}>
                {customer.email}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaCell}>
            <Text variant="overline" color={colors.textTertiary}>
              {kind === "invoice" ? "Issued" : "Date paid"}
            </Text>
            <Text size={15} weight="semibold" style={{ marginTop: 6 }}>
              {formatDate(issued)}
            </Text>
            <Text variant="label" color={colors.textSecondary}>
              Order #{order.number}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text variant="overline" color={colors.textTertiary}>
              {kind === "invoice" ? "Ready by" : "Delivery"}
            </Text>
            <Text size={15} weight="semibold" style={{ marginTop: 6 }}>
              {formatDate(order.dueAt)}
            </Text>
            <Text variant="label" color={colors.textSecondary} style={{ textTransform: "capitalize" }}>
              {order.statusName.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        {/* Line items — stacked rows on phones */}
        <View style={styles.lines}>
          {lines.map((l, i) => (
            <View key={i} style={[styles.line, i > 0 && styles.lineDivider]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text size={15} weight="semibold">
                  {l.description}
                </Text>
                {l.detail ? (
                  <Text variant="label" color={colors.textSecondary} style={{ marginTop: 2 }}>
                    {l.detail}
                  </Text>
                ) : null}
                <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 2 }}>
                  Qty {l.qty}
                </Text>
              </View>
              {l.amount !== undefined ? (
                <Text size={15} weight="medium" tabular align="right">
                  {money(l.amount)}
                </Text>
              ) : (
                <Text size={15} weight="medium" color={colors.textTertiary} align="right">
                  Included
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Totals (with the paid stamp under them on receipts) */}
        <View style={styles.totalsWrap}>
          <View style={{ width: "100%", gap: 8 }}>
            <View style={styles.totalRow}>
              <Text size={15} color={colors.textSecondary}>
                Total
              </Text>
              <Text size={15} weight="semibold" tabular>
                {money(order.priceMinor)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text size={15} color={colors.textSecondary}>
                {kind === "invoice" ? "Paid to date" : "Amount paid"}
              </Text>
              <Text size={15} weight="semibold" tabular>
                {money(paid)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.balanceRow]}>
              <Text size={15} weight="semibold" color={colors.textInverse}>
                {kind === "invoice" ? "Balance due" : "Balance"}
              </Text>
              <Text size={18} weight="semibold" tabular color={colors.textInverse}>
                {money(Math.max(0, balance))}
              </Text>
            </View>
          </View>
          {kind === "receipt" && (
            <View style={styles.stamp} pointerEvents="none">
              <Text size={18} weight="bold" color={alpha(colors.success, 0.7)} style={{ letterSpacing: 2.2, textTransform: "uppercase" }}>
                Paid in full
              </Text>
            </View>
          )}
        </View>

        {/* Where to pay */}
        {kind === "invoice" && account && balance > 0 && <PayToBox account={account} hideCopy={capturing} />}

        {/* Payments */}
        {payments.length > 0 && (
          <View style={{ marginTop: 32 }}>
            <Text variant="overline" color={colors.textTertiary}>
              Payments
            </Text>
            <View style={styles.payments}>
              {payments.map((p, i) => (
                <View key={p.id} style={[styles.payment, i > 0 && styles.lineDivider]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="label" weight="semibold">
                      {p.method}
                    </Text>
                    <Text variant="label" color={colors.textTertiary}>
                      {formatDate(p.paidAt)}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </Text>
                  </View>
                  <Text variant="label" weight="semibold" tabular>
                    {money(p.amountMinor)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {order.note && kind === "invoice" ? (
          <View style={styles.note}>
            <Text variant="overline" color={colors.textTertiary}>
              Note
            </Text>
            <Text variant="label" color={colors.textSecondary} style={{ marginTop: 4 }}>
              {order.note}
            </Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text variant="label" color={colors.textSecondary} style={{ maxWidth: 384 }}>
            {footerMessage(kind, order)}
          </Text>
          <View style={styles.generated}>
            <Logo variant="symbol" height={16} />
            <Text variant="caption" color={colors.textTertiary}>
              Generated with Tayylo
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ----------------------------------------------------------- pay-to box

function PayToBox({ account, hideCopy }: { account: BankAccount; hideCopy?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(account.accountNumber.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <View style={styles.payTo}>
      <View style={styles.payToLabel}>
        <Landmark size={13} strokeWidth={2} color={colors.olive} />
        <Text variant="overline" color={colors.olive}>
          Pay to
        </Text>
      </View>
      <View style={styles.payToRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" weight="semibold" color={colors.textSecondary}>
            {account.bankName}
          </Text>
          <Text size={22} weight="semibold" tabular style={{ lineHeight: 28, letterSpacing: 0.5 }}>
            {account.accountNumber}
          </Text>
          <Text variant="label">{account.accountName}</Text>
        </View>
        {!hideCopy && (
          <PressableScale scaleTo={0.95} onPress={copy} accessibilityLabel="Copy account number" style={styles.copy}>
            {copied ? <Check size={14} strokeWidth={1.75} color={colors.ink} /> : <Copy size={14} strokeWidth={1.75} color={colors.ink} />}
            <Text variant="caption" weight="semibold">
              {copied ? "Copied" : "Copy"}
            </Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

/** On-screen only: choose which bank account this invoice shows. */
function PayToPicker({ order, business, onPick }: { order: Order; business: Business | null; onPick: (id: string) => void }) {
  const accounts = bankAccountsOf(business);
  const chosen = invoiceAccount(business, order.bankAccountId)?.id ?? null;
  const [saving, setSaving] = React.useState(false);

  if (accounts.length === 0) {
    return (
      <View style={styles.noAccount}>
        <Landmark size={18} strokeWidth={1.75} color={colors.textSecondary} />
        <Text variant="label" color={colors.textSecondary} style={{ flex: 1, minWidth: 0 }}>
          Add a bank account so clients know where to pay.
        </Text>
        <Button size="sm" variant="secondary" onPress={() => router.push("/settings")}>
          Add
        </Button>
      </View>
    );
  }
  if (accounts.length < 2) return null;

  const pick = async (id: string) => {
    if (id === chosen || saving) return;
    const prev = chosen;
    onPick(id);
    setSaving(true);
    try {
      await orderRepo.setBankAccount(order.id, id);
    } catch {
      if (prev) onPick(prev);
      toast.error("Couldn't change the account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text variant="caption" weight="semibold" color={colors.textTertiary} style={{ marginBottom: 8, paddingHorizontal: 4 }}>
        Pay-to account on this invoice
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={styles.accounts}>
        {accounts.map(a => {
          const active = a.id === chosen;
          return (
            <PressableScale
              key={a.id}
              onPress={() => pick(a.id)}
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${a.bankName} ending ${a.accountNumber.slice(-4)}`}
              style={[styles.account, active ? styles.accountActive : styles.accountIdle]}
            >
              {active && <Check size={14} strokeWidth={2.5} color={colors.textInverse} />}
              <Text variant="label" weight="semibold" color={active ? colors.textInverse : colors.ink}>
                {a.bankName}
              </Text>
              <Text variant="label" tabular color={active ? alpha(colors.textInverse, 0.8) : colors.textTertiary}>
                ···{a.accountNumber.slice(-4)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  article: {
    overflow: "hidden",
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.surfaceRaised,
    boxShadow: shadows.xs,
  },
  band: { height: 6, backgroundColor: colors.olive },
  inner: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 },
  headTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  docTitle: { textTransform: "uppercase", letterSpacing: 1.76, lineHeight: 24 },
  headBottom: { marginTop: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  status: { flexShrink: 0, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  meta: {
    marginTop: 24,
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 20,
  },
  metaCell: { flex: 1, minWidth: 0 },
  lines: { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.divider },
  line: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 14 },
  lineDivider: { borderTopWidth: 1, borderTopColor: colors.divider },
  totalsWrap: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16, alignItems: "center", gap: 20 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  balanceRow: { alignItems: "center", borderRadius: radii.control, backgroundColor: colors.olive, paddingHorizontal: 12, paddingVertical: 10 },
  stamp: {
    transform: [{ rotate: "-8deg" }],
    borderRadius: radii.control,
    borderWidth: 3,
    borderColor: alpha(colors.success, 0.7),
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  payTo: {
    marginTop: 24,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: alpha(colors.olive, 0.3),
    backgroundColor: alpha(colors.oliveSoft, 0.4),
    padding: 16,
  },
  payToLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  payToRow: { marginTop: 8, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  copy: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  payments: { marginTop: 8, borderRadius: radii.card, borderWidth: 1, borderColor: hairline },
  payment: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  note: { marginTop: 32, borderRadius: radii.card, backgroundColor: alpha(colors.surfaceSunken, 0.6), paddingHorizontal: 16, paddingVertical: 12 },
  footer: { marginTop: 32, gap: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 20 },
  generated: { flexDirection: "row", alignItems: "center", gap: 8 },
  noAccount: {
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  accounts: { gap: 8, paddingHorizontal: 12, paddingBottom: 4 },
  account: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  accountActive: { borderColor: colors.olive, backgroundColor: colors.olive },
  accountIdle: { borderColor: colors.border, backgroundColor: colors.surfaceRaised },
});

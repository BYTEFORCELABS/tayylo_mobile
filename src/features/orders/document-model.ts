// Pure data for the invoice / receipt: numbers, line items, status, the
// pay-to account and the text summary. Same rules as the web's
// src/components/order/order-document.tsx and settings/branding.tsx.

import { formatDate, formatMoney } from "@/lib/format";
import { balanceMinor, garmentOf, paidMinor } from "@/lib/orders";
import type { BankAccount, Business, Order } from "@/types";

export type DocumentKind = "invoice" | "receipt";

export const documentNumber = (kind: DocumentKind, order: Pick<Order, "number">) =>
  `${kind === "invoice" ? "INV" : "RCT"}-${order.number}`;

/** A receipt confirms payment, so it exists once the order is paid in full. */
export const receiptAvailable = (order: Order) => order.priceMinor > 0 && balanceMinor(order) <= 0;

export function lastPaymentDate(order: Order) {
  const dates = order.payments.map(p => +new Date(p.paidAt));
  return dates.length ? new Date(Math.max(...dates)) : new Date(order.updatedAt);
}

export interface DocumentLine {
  description: string;
  detail?: string;
  qty: number;
  amount?: number;
}

export function linesFor(order: Order): DocumentLine[] {
  const lines: DocumentLine[] = order.items.map((item, i) => ({
    description: `${item.garmentType} — tailoring`,
    detail: item.styleNotes || "Cut, sew and finish to the client's measurements",
    qty: 1,
    // Orders carry one agreed price; it sits on the first garment.
    amount: i === 0 ? order.priceMinor : undefined,
  }));
  if (order.fittings.length > 0) {
    lines.push({
      description: "Fittings and alterations",
      detail: `${order.fittings.length} fitting${order.fittings.length > 1 ? "s" : ""} recorded`,
      qty: order.fittings.length,
    });
  }
  return lines;
}

export type DocumentStatus = "Paid" | "Part paid" | "Unpaid";

export function documentStatus(order: Order): DocumentStatus {
  const balance = balanceMinor(order);
  return balance <= 0 && order.priceMinor > 0 ? "Paid" : paidMinor(order) > 0 ? "Part paid" : "Unpaid";
}

export function bankAccountsOf(business: Business | null): BankAccount[] {
  return Array.isArray(business?.bankAccounts) ? business.bankAccounts : [];
}

/** Account shown on an invoice: the order's choice if it still exists, else the default. */
export function invoiceAccount(business: Business | null, chosenId?: string | null) {
  const accounts = bankAccountsOf(business);
  return accounts.find(a => a.id === chosenId) ?? accounts.find(a => a.isDefault) ?? accounts[0] ?? null;
}

export function shareText(kind: DocumentKind, order: Order, business: Business | null) {
  const paid = paidMinor(order);
  const balance = balanceMinor(order);
  const account = kind === "invoice" && balance > 0 ? invoiceAccount(business, order.bankAccountId) : null;
  const money = (m: number) => formatMoney(m, order.currency);
  const lines = [
    `*${business?.name || "Tayylo"}*`,
    `${kind === "invoice" ? "Invoice" : "Receipt"} ${documentNumber(kind, order)}`,
    "",
    `Client: ${order.customerName}`,
    `Order #${order.number}: ${garmentOf(order)}`,
    `Total: ${money(order.priceMinor)}`,
    `Paid: ${money(paid)}`,
    kind === "invoice" ? `Balance due: ${money(balance)}` : "Status: PAID IN FULL",
    kind === "invoice" ? `Ready by: ${formatDate(order.dueAt)}` : `Paid on: ${formatDate(lastPaymentDate(order))}`,
    ...(account ? ["", "*Pay to*", account.bankName, account.accountNumber, account.accountName] : []),
    "",
    kind === "invoice" ? "Thank you for your order." : "Thank you for your patronage.",
    "_Generated with Tayylo_",
  ];
  return lines.join("\n");
}

/** wa.me needs digits with country code; local Nigerian numbers start with 0. */
export function whatsappDigits(phone: string | undefined, currency: string) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0") && currency === "NGN") d = `234${d.slice(1)}`;
  return d.length >= 8 ? d : null;
}

/** Closing line under the document. */
export function footerMessage(kind: DocumentKind, order: Order) {
  const balance = balanceMinor(order);
  return kind === "invoice"
    ? balance > 0
      ? `Please pay the balance of ${formatMoney(balance, order.currency)} on or before collection. Thank you for your order.`
      : "This order is fully paid. Thank you for your order."
    : "Payment received with thanks. We hope you love your garment — thank you for your patronage.";
}

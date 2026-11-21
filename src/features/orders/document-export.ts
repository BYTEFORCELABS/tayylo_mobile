// Native export for the invoice / receipt:
//  - Print / Save as PDF → expo-print with an HTML version of the same document
//    (the web's print stylesheet layout), logos inlined as data URLs
//  - Share as image → react-native-view-shot capture of the on-screen document
// Both go out through expo-sharing (the phone's share sheet).

import type * as React from "react";
import { Share, type View } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Image as ExpoImage } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { captureRef } from "react-native-view-shot";
import { formatDate, formatMoney } from "@/lib/format";
import { balanceMinor, paidMinor } from "@/lib/orders";
import { colors } from "@/theme/tokens";
import type { Business, Customer, Order } from "@/types";
import {
  documentNumber,
  documentStatus,
  footerMessage,
  invoiceAccount,
  lastPaymentDate,
  linesFor,
  type DocumentKind,
} from "./document-model";

const LOCKUP = require("../../../assets/brand/lockup_olive.png");
const SYMBOL = require("../../../assets/brand/symbol_olive.png");

const cache: Record<string, string> = {};

/** A bundled PNG → data URL, so the printed HTML never needs the network. */
async function bundledDataUrl(key: string, module: number) {
  if (cache[key]) return cache[key];
  const ref = await ExpoImage.loadAsync(module);
  const out = await (await ImageManipulator.manipulate(ref).renderAsync()).saveAsync({ format: SaveFormat.PNG, base64: true });
  if (!out.base64) throw new Error("Couldn't read the logo");
  cache[key] = `data:image/png;base64,${out.base64}`;
  return cache[key];
}

async function logos(business: Business | null) {
  const [lockup, symbol] = await Promise.all([
    business?.logoUrl ? Promise.resolve(business.logoUrl) : bundledDataUrl("lockup", LOCKUP).catch(() => ""),
    bundledDataUrl("symbol", SYMBOL).catch(() => ""),
  ]);
  return { brand: lockup, symbol, custom: !!business?.logoUrl };
}

const esc = (s: string | number | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The printable document as HTML — the web's wide (sm:) layout, as printed. */
export async function documentHtml(kind: DocumentKind, order: Order, business: Business | null, customer: Customer | null) {
  const { brand, symbol, custom } = await logos(business);
  const paid = paidMinor(order);
  const balance = balanceMinor(order);
  const money = (m: number) => formatMoney(m, order.currency);
  const lines = linesFor(order);
  const payments = [...order.payments].sort((a, b) => +new Date(a.paidAt) - +new Date(b.paidAt));
  const issued = kind === "invoice" ? new Date(order.createdAt) : lastPaymentDate(order);
  const status = documentStatus(order);
  const account = invoiceAccount(business, order.bankAccountId);
  const statusColors =
    status === "Paid" ? [colors.successBg, colors.success] : status === "Part paid" ? [colors.warningBg, colors.warning] : [colors.dangerBg, colors.danger];
  const title = kind === "invoice" ? "Invoice" : "Receipt";
  const brandImg = brand
    ? `<img src="${brand}" alt="${esc(business?.name || "Tayylo")}" style="${custom ? "height:39px;max-width:156px" : "height:26px"};width:auto;object-fit:contain" />`
    : `<span style="font-size:22px;font-weight:700;color:${colors.olive}">Tayylo</span>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} ${esc(documentNumber(kind, order))}</title>
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Urbanist, -apple-system, "Helvetica Neue", Roboto, Arial, sans-serif; color: ${colors.ink}; background: #fff; font-size: 15px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .tab { font-variant-numeric: tabular-nums; }
  .band { height: 6px; background: ${colors.olive}; }
  .wrap { padding: 32px 8px 24px; }
  .row { display: flex; justify-content: space-between; gap: 16px; }
  .over { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: ${colors.textTertiary}; }
  .label { font-size: 13px; }
  .muted { color: ${colors.textSecondary}; }
  .faint { color: ${colors.textTertiary}; }
  .semi { font-weight: 600; }
  .doc-title { font-size: 34px; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: ${colors.olive}; line-height: 1; text-align: right; }
  .status { display: inline-block; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 600; background: ${statusColors[0]}; color: ${statusColors[1]}; }
  .meta { margin-top: 32px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; border-top: 1px solid ${colors.divider}; border-bottom: 1px solid ${colors.divider}; padding: 20px 0; }
  .meta .v { margin-top: 6px; font-size: 15px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { text-align: left; padding-bottom: 8px; }
  td { border-top: 1px solid ${colors.divider}; padding: 14px 0; vertical-align: top; }
  .totals { margin-top: 8px; border-top: 1px solid ${colors.divider}; padding-top: 16px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .totals dl { width: 320px; }
  .totals dl > div { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .due { background: ${colors.olive}; color: ${colors.textInverse}; border-radius: 12px; padding: 10px 12px; align-items: center; }
  .stamp { margin-left: 16px; transform: rotate(-8deg); border: 3px solid rgba(61,107,72,.7); color: rgba(61,107,72,.7); border-radius: 12px; padding: 6px 16px; font-size: 22px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .payto { margin-top: 24px; border: 1px solid rgba(69,79,44,.3); background: rgba(230,232,218,.4); border-radius: 20px; padding: 16px 20px; }
  .payments { margin-top: 8px; border: 1px solid rgba(227,224,214,.7); border-radius: 20px; }
  .payments > div { display: flex; justify-content: space-between; gap: 12px; padding: 10px 16px; font-size: 13px; }
  .payments > div + div { border-top: 1px solid ${colors.divider}; }
  .note { margin-top: 32px; background: rgba(236,233,225,.6); border-radius: 20px; padding: 12px 16px; }
  footer { margin-top: 40px; border-top: 1px solid ${colors.divider}; padding-top: 20px; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; }
</style></head>
<body>
<div class="band"></div>
<div class="wrap">
  <header>
    <div class="row" style="align-items:flex-start">
      <div style="max-width:55%">${brandImg}</div>
      <div>
        <p class="doc-title">${title}</p>
        <p class="tab label semi" style="margin-top:8px;text-align:right">${esc(documentNumber(kind, order))}</p>
      </div>
    </div>
    <div class="row" style="margin-top:16px;align-items:flex-end">
      <div>
        <p style="font-size:17px;font-weight:600;line-height:1.25">${esc(business?.name || "Your studio")}</p>
        <p class="label faint">${esc([business?.ownerName, business?.country].filter(Boolean).join(" · ") || "Tailoring studio")}</p>
      </div>
      <span class="status">${status}</span>
    </div>
  </header>

  <div class="meta">
    <div>
      <p class="over">${kind === "invoice" ? "Bill to" : "Received from"}</p>
      <p class="v">${esc(order.customerName)}</p>
      ${customer?.phones[0] ? `<p class="label muted">${esc(customer.phones[0])}</p>` : ""}
      ${customer?.email ? `<p class="label muted">${esc(customer.email)}</p>` : ""}
    </div>
    <div>
      <p class="over">${kind === "invoice" ? "Issued" : "Date paid"}</p>
      <p class="v">${esc(formatDate(issued))}</p>
      <p class="label muted">Order #${esc(order.number)}</p>
    </div>
    <div>
      <p class="over">${kind === "invoice" ? "Ready by" : "Delivery"}</p>
      <p class="v">${esc(formatDate(order.dueAt))}</p>
      <p class="label muted" style="text-transform:capitalize">${esc(order.statusName.replace(/_/g, " "))}</p>
    </div>
  </div>

  <table>
    <thead><tr>
      <th class="over">Description</th>
      <th class="over" style="width:48px;text-align:center">Qty</th>
      <th class="over" style="width:128px;text-align:right">Amount</th>
    </tr></thead>
    <tbody>
      ${lines
        .map(
          l => `<tr>
        <td style="padding-right:12px"><p class="semi">${esc(l.description)}</p>${l.detail ? `<p class="label muted" style="margin-top:2px">${esc(l.detail)}</p>` : ""}</td>
        <td class="tab" style="text-align:center">${l.qty}</td>
        <td class="tab" style="text-align:right;font-weight:500">${l.amount !== undefined ? esc(money(l.amount)) : `<span class="faint">Included</span>`}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table>

  <div class="totals">
    ${kind === "receipt" ? `<div class="stamp">Paid in full</div>` : `<span></span>`}
    <dl>
      <div><dt class="muted">Total</dt><dd class="tab semi">${esc(money(order.priceMinor))}</dd></div>
      <div><dt class="muted">${kind === "invoice" ? "Paid to date" : "Amount paid"}</dt><dd class="tab semi">${esc(money(paid))}</dd></div>
      <div class="due"><dt class="semi">${kind === "invoice" ? "Balance due" : "Balance"}</dt><dd class="tab semi" style="font-size:18px">${esc(money(Math.max(0, balance)))}</dd></div>
    </dl>
  </div>

  ${
    kind === "invoice" && account && balance > 0
      ? `<section class="payto">
    <p class="over" style="color:${colors.olive}">Pay to</p>
    <p class="label semi muted" style="margin-top:8px">${esc(account.bankName)}</p>
    <p class="tab" style="font-size:24px;font-weight:600;line-height:1.25;letter-spacing:.025em">${esc(account.accountNumber)}</p>
    <p class="label">${esc(account.accountName)}</p>
  </section>`
      : ""
  }

  ${
    payments.length
      ? `<section style="margin-top:32px">
    <p class="over">Payments</p>
    <div class="payments">
      ${payments
        .map(
          p => `<div><span><span class="semi">${esc(p.method)}</span><span class="faint"> · ${esc(formatDate(p.paidAt))}${p.reference ? ` · ${esc(p.reference)}` : ""}</span></span><span class="tab semi">${esc(money(p.amountMinor))}</span></div>`
        )
        .join("")}
    </div>
  </section>`
      : ""
  }

  ${order.note && kind === "invoice" ? `<section class="note"><p class="over">Note</p><p class="label muted" style="margin-top:4px">${esc(order.note)}</p></section>` : ""}

  <footer>
    <p class="label muted" style="max-width:384px">${esc(footerMessage(kind, order))}</p>
    <p class="faint" style="font-size:12px;display:flex;align-items:center;gap:8px">${symbol ? `<img src="${symbol}" alt="" style="height:16px;width:auto" />` : ""}Generated with Tayylo</p>
  </footer>
</div>
</body></html>`;
}

/** Gives a temp file a readable name (INV-1042.pdf) before it's shared; falls back to the original. */
async function named(uri: string, filename: string) {
  try {
    const src = new File(uri);
    const dest = new File(Paths.cache, filename);
    if (dest.exists) dest.delete();
    await src.move(dest);
    return src.uri;
  } catch {
    return uri;
  }
}

/** Opens the system print dialog (which also offers Save to Files / PDF on iOS). */
export async function printDocument(kind: DocumentKind, order: Order, business: Business | null, customer: Customer | null) {
  await Print.printAsync({ html: await documentHtml(kind, order, business, customer) });
}

/** Renders the document to a PDF file and opens the share sheet with it. */
export async function shareDocumentPdf(kind: DocumentKind, order: Order, business: Business | null, customer: Customer | null) {
  const name = documentNumber(kind, order);
  const { uri } = await Print.printToFileAsync({ html: await documentHtml(kind, order, business, customer) });
  const file = await named(uri, `${name}.pdf`);
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device");
  await Sharing.shareAsync(file, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: `${kind === "invoice" ? "Invoice" : "Receipt"} ${name}` });
}

/** Captures the on-screen document as a PNG file named after the document. */
export async function captureDocumentImage(target: React.RefObject<React.ComponentRef<typeof View> | null>, name: string) {
  const uri = await captureRef(target, { format: "png", quality: 1, result: "tmpfile" });
  return named(uri, `${name}.png`);
}

/**
 * Captures the on-screen document as a PNG and shares the file; when files
 * can't be shared, falls back to the text summary.
 */
export async function shareDocumentImage(target: React.RefObject<React.ComponentRef<typeof View> | null>, name: string, title: string, text: string) {
  const uri = await captureRef(target, { format: "png", quality: 1, result: "tmpfile" }).catch(() => null);
  if (uri && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(await named(uri, `${name}.png`), { mimeType: "image/png", UTI: "public.png", dialogTitle: `${title} ${name}` });
    return;
  }
  await Share.share({ title: `${title} ${name}`, message: text });
}

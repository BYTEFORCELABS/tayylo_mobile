// ============================================================
// Data layer — the same repositories, endpoints and payloads as the web
// app's src/lib/data/store.ts, talking to the same Next.js /api routes.
// Authorization (one business never sees another's data) is enforced by
// the server; this file only shapes requests and responses.
//
// Like the web, every write invalidates the cached queries it affects.
// ============================================================

import type { Business, Customer, Fitting, Media, MeasurementSet, MeasurementTemplate, Order, Payment } from "@/types";
import type { ExplorePage, ExplorePost } from "@/lib/explore";
import { api, ApiRequestError, rawRequest } from "./http";
import { clearQueries, invalidate, queryClient } from "./query-client";

/** Run a write, then mark the affected cached queries stale (as on the web). */
async function mutating<T>(run: Promise<T>, ...keys: string[]): Promise<T> {
  const result = await run;
  await invalidate(...keys);
  return result;
}

// ---- business ----

export const businessRepo = {
  get: () => api<Business | null>("/api/business"),
  update: (partial: Partial<Business>) =>
    mutating(api<Business>("/api/business", { method: "PATCH", body: JSON.stringify(partial) }), "business"),
};

// ---- customers ----

export type NewCustomer = Omit<Customer, "id" | "businessId" | "createdAt" | "updatedAt">;

export const customerRepo = {
  list: async () => (await api<Customer[]>("/api/customers")) ?? [],
  /** Includes every client's photos (large) — used by export only. */
  listWithMedia: async () => (await api<Customer[]>("/api/customers?include=media")) ?? [],
  search: async (query: string) => (await api<Customer[]>(`/api/customers?q=${encodeURIComponent(query)}`)) ?? [],
  getById: (id: string) => api<Customer | null>(`/api/customers/${id}`),
  create: (data: NewCustomer) => mutating(api<Customer>("/api/customers", { method: "POST", body: JSON.stringify(data) }), "customers"),
  update: (id: string, partial: Partial<Customer>) =>
    mutating(
      api<Customer | null>(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(partial) }),
      "customers",
      `customer:${id}`
    ),
  addMedia: (customerId: string, item: { url: string; caption?: string }) =>
    mutating(
      api<Media | null>(`/api/customers/${customerId}/media`, { method: "POST", body: JSON.stringify(item) }),
      `customer:${customerId}`
    ),
  deleteMedia: async (customerId: string, mediaId: string) =>
    (
      await mutating(
        api<{ ok: boolean }>(`/api/customers/${customerId}/media/${mediaId}`, { method: "DELETE" }),
        `customer:${customerId}`
      )
    )?.ok ?? false,
  importCustomers: async (items: Array<{ fullName: string; phone?: string; email?: string; notes?: string }>) =>
    (await mutating(api<{ count: number }>("/api/customers/import", { method: "POST", body: JSON.stringify(items) }), "customers"))
      ?.count ?? 0,
};

/** Same check as the web: any other client already using this number? */
export function isDuplicatePhone(all: Customer[], phone: string, excludeId?: string) {
  const normalized = phone.replace(/\s/g, "");
  if (!normalized) return false;
  return all.some(c => c.id !== excludeId && c.phones.some(p => p.replace(/\s/g, "") === normalized));
}

// ---- measurement sets ----

export type NewMeasurementSet = Omit<MeasurementSet, "id" | "businessId" | "takenAt" | "status">;

export const measurementRepo = {
  listByCustomer: async (customerId: string) => (await api<MeasurementSet[]>(`/api/customers/${customerId}/measurements`)) ?? [],
  getById: (id: string) => api<MeasurementSet | null>(`/api/measurements/${id}`),
  getLatest: (customerId: string, templateId?: string) => {
    const q = templateId ? `?latest=true&templateId=${encodeURIComponent(templateId)}` : "?latest=true";
    return api<MeasurementSet | null>(`/api/customers/${customerId}/measurements${q}`);
  },
  createVersion: (data: NewMeasurementSet) =>
    mutating(
      api<MeasurementSet>("/api/measurements", { method: "POST", body: JSON.stringify(data) }),
      `measurements:${data.customerId}`,
      "customers"
    ),
  restoreVersion: (versionId: string, note?: string) =>
    mutating(
      api<MeasurementSet | null>(`/api/measurements/${versionId}/restore`, { method: "POST", body: JSON.stringify({ note }) }),
      "measurements",
      "customers"
    ),
};

// ---- measurement templates ----

export const templateRepo = {
  list: async () => (await api<MeasurementTemplate[]>("/api/templates")) ?? [],
};

// ---- orders ----

export type NewOrder = Omit<Order, "id" | "businessId" | "createdAt" | "updatedAt">;
type OrderPatch = {
  statusName?: Order["statusName"];
  priceMinor?: number;
  bankAccountId?: string | null;
  cover?: { mediaId: string; thumbUrl: string } | null;
};

export const orderRepo = {
  list: async () => (await api<Order[]>("/api/orders")) ?? [],
  getById: (id: string) => api<Order | null>(`/api/orders/${id}`),
  getByCustomer: async (customerId: string) => (await api<Order[]>(`/api/orders?customerId=${encodeURIComponent(customerId)}`)) ?? [],
  create: (data: NewOrder) => mutating(api<Order>("/api/orders", { method: "POST", body: JSON.stringify(data) }), "orders"),
  patch: (id: string, patch: OrderPatch) =>
    mutating(api<Order | null>(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(patch) }), "orders", `order:${id}`),
  updateStatus: (id: string, statusName: Order["statusName"]) => orderRepo.patch(id, { statusName }),
  updatePrice: (id: string, priceMinor: number) => orderRepo.patch(id, { priceMinor }),
  /** Picks which bank account this order's invoice shows (null = the default). */
  setBankAccount: (id: string, bankAccountId: string | null) => orderRepo.patch(id, { bankAccountId }),
  /** Chooses which photo represents the order in lists (null clears it). */
  setCover: (id: string, cover: { mediaId: string; thumbUrl: string } | null) => orderRepo.patch(id, { cover }),
  delete: async (id: string) =>
    (await mutating(api<{ ok: boolean }>(`/api/orders/${id}`, { method: "DELETE" }), "orders", `order:${id}`))?.ok ?? false,
  addPayment: (orderId: string, payment: { amountMinor: number; method: string; reference?: string; paidAt?: string }) =>
    mutating(
      api<Payment | null>(`/api/orders/${orderId}/payments`, { method: "POST", body: JSON.stringify(payment) }),
      "orders",
      `order:${orderId}`
    ),
  addMedia: (orderId: string, item: { url: string; caption?: string }) =>
    mutating(api<Media | null>(`/api/orders/${orderId}/media`, { method: "POST", body: JSON.stringify(item) }), `order:${orderId}`),
  deleteMedia: async (orderId: string, mediaId: string) =>
    (await mutating(api<{ ok: boolean }>(`/api/orders/${orderId}/media/${mediaId}`, { method: "DELETE" }), `order:${orderId}`))?.ok ??
    false,
  addFitting: (
    orderId: string,
    fitting: { outcome: "adjustments_needed" | "approved"; adjustments: Fitting["adjustments"]; notes?: string; fittedAt?: string }
  ) =>
    mutating(
      api<Fitting | null>(`/api/orders/${orderId}/fittings`, { method: "POST", body: JSON.stringify(fitting) }),
      "orders",
      `order:${orderId}`
    ),
  /** Removes a fitting logged by mistake; later fittings are renumbered. */
  deleteFitting: async (orderId: string, fittingId: string) =>
    (
      await mutating(
        api<{ ok: boolean }>(`/api/orders/${orderId}/fittings/${fittingId}`, { method: "DELETE" }),
        "orders",
        `order:${orderId}`
      )
    )?.ok ?? false,
};

// ---- export / reset / account ----

/** Same snapshot and CSV the web's Settings → Export produces. */
export async function exportData(): Promise<{ jsonStr: string; csvStr: string }> {
  const [business, customers, orders] = await Promise.all([businessRepo.get(), customerRepo.listWithMedia(), orderRepo.list()]);
  const measurementSets = (await Promise.all(customers.map(c => measurementRepo.listByCustomer(c.id)))).flat();

  const jsonStr = JSON.stringify({ business, customers, measurementSets, orders }, null, 2);
  const headers = ["Full Name", "Phone", "Email", "Tags", "Notes", "Created At"];
  const rows = customers.map(c => [
    `"${c.fullName.replace(/"/g, '""')}"`,
    `"${c.phones.join(", ")}"`,
    `"${c.email || ""}"`,
    `"${c.tags.join(", ")}"`,
    `"${(c.notes || "").replace(/"/g, '""')}"`,
    `"${c.createdAt}"`,
  ]);
  const csvStr = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  return { jsonStr, csvStr };
}

/** Wipes clients, orders and measurements — not the business profile. */
export async function resetWorkspace() {
  await api("/api/reset", { method: "POST" });
  // Like the web's reload: every open screen starts again from fresh data.
  await queryClient.resetQueries();
}

export const accountRepo = {
  /** Permanently deletes the user and everything that cascades from it. */
  delete: async () => {
    await api("/api/account", { method: "DELETE" });
    clearQueries();
  },
};

// ---- me / explore ----

export interface Me {
  id: string;
  email: string;
  role: "tailor" | "customer";
}

export const meRepo = {
  get: () => api<Me | null>("/api/me"),
};

export const exploreRepo = {
  list: async (params: { country?: string; category?: string; q?: string; cursor?: string }) => {
    const qs = Object.entries(params)
      .filter(([, v]) => !!v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
      .join("&");
    return (await api<ExplorePage>(`/api/explore?${qs}`)) ?? { posts: [], nextCursor: null, countries: [] };
  },
  saved: async () => (await api<ExplorePost[]>("/api/explore/saved")) ?? [],
  /** Uploads a (pre-compressed) JPEG from a local file URI; returns its public URL. */
  upload: async (fileUri: string) => {
    const form = new FormData();
    // React Native's FormData takes a { uri, name, type } descriptor for files.
    form.append("file", { uri: fileUri, name: "style.jpg", type: "image/jpeg" } as unknown as Blob);
    const res = await rawRequest("/api/explore/upload", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiRequestError(res.status, (body as { error?: string }).error || "Couldn't upload the photo");
    }
    return ((await res.json()) as { url: string }).url;
  },
  create: (data: { imageUrl: string; caption?: string; country: string; category: string; tags: string[]; width?: number; height?: number }) =>
    mutating(api<ExplorePost>("/api/explore", { method: "POST", body: JSON.stringify(data) }), "explore"),
  remove: (id: string) => mutating(api(`/api/explore/${id}`, { method: "DELETE" }), "explore"),
  setSaved: (id: string, saved: boolean) => api(`/api/explore/${id}/save`, { method: saved ? "POST" : "DELETE" }),
};

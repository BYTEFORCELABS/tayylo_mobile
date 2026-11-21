// Shared, cached access to the signed-in business so every screen can read
// currency / unit system without re-fetching /api/business (as on the web).

import type { Business } from "@/types";
import { setQueryData, useBusinessQuery } from "./api/query";
import { useSession } from "./auth/session";

/** Call after updating the business so all mounted screens refresh. */
export function setCachedBusiness(b: Business | null) {
  setQueryData<Business | null>("business", b);
}

export function useBusiness() {
  const signedIn = useSession(s => s.status === "signedIn");
  const q = useBusinessQuery(signedIn);
  const business = q.data ?? null;
  return {
    business,
    loading: q.isPending,
    error: q.error,
    status: q.isPending ? ("loading" as const) : q.isError ? ("error" as const) : ("ready" as const),
    currency: business?.currency || "NGN",
    unit: business?.unitSystem === "metric" ? ("metric" as const) : ("imperial" as const),
    refresh: q.refetch,
  };
}

/** The signed-in account and its role. */
export function useMe() {
  const me = useSession(s => s.me);
  return { me, role: me?.role };
}

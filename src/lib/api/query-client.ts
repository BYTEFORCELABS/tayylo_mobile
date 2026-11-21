// The single TanStack QueryClient and cache helpers. Kept free of repo
// imports so repositories can invalidate keys without a circular import.
//
// Keys mirror the web app's string keys ("customers", "customer:<id>",
// "orders:customer:<id>"…) split on ":" — so invalidating "orders" also
// refreshes "orders:customer:<id>", exactly like the web's prefix rule.

import { focusManager, MutationCache, onlineManager, QueryCache, QueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { ApiRequestError } from "./http";

let onUnauthorized: () => void = () => {};

/** Called for any request answered with 401 (the session expired). */
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

const check401 = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status === 401) onUnauthorized();
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: check401 }),
  mutationCache: new MutationCache({ onError: check401 }),
  defaultOptions: {
    queries: {
      // Same freshness as the web's useQuery default (10s).
      staleTime: 10_000,
      gcTime: 30 * 60_000,
      retry: (count, error) => !(error instanceof ApiRequestError && error.status < 500) && count < 2,
    },
  },
});

// Refetch on reconnect / when the app returns to the foreground.
onlineManager.setEventListener(setOnline => NetInfo.addEventListener(s => setOnline(!!s.isConnected)));
AppState.addEventListener("change", (status: AppStateStatus) => {
  if (Platform.OS !== "web") focusManager.setFocused(status === "active");
});

export const toKey = (key: string) => key.split(":");

/** Mark every query under these prefixes stale; mounted screens refetch. */
export function invalidate(...prefixes: string[]) {
  return Promise.all(prefixes.map(p => queryClient.invalidateQueries({ queryKey: toKey(p) })));
}

export function setQueryData<T>(key: string, data: T | ((old: T | undefined) => T)) {
  queryClient.setQueryData<T>(toKey(key), data as T);
}

export function getQueryData<T>(key: string) {
  return queryClient.getQueryData<T>(toKey(key));
}

/** Forget everything (sign-out, workspace reset, account deletion). */
export function clearQueries() {
  queryClient.clear();
}


// ============================================================
// Session — sign in / sign up / sign out against the backend's Auth.js
// endpoints, the same ones next-auth/react uses on the web:
//
//   GET  /api/auth/csrf                    → { csrfToken } (+ csrf cookie)
//   POST /api/auth/callback/credentials    → session cookie
//   POST /api/auth/signout                 → clears the session cookie
//   POST /api/auth/register | forgot-password | reset-password
//
// With `X-Auth-Return-Redirect: 1` Auth.js answers with JSON { url }
// instead of a 302, so the outcome (and the Set-Cookie) is readable here.
// ============================================================

import { create } from "zustand";
import { api, ApiRequestError, clearCookies, hasSessionCookie, NetworkError, onCookiesCleared, rawRequest } from "../api/http";
import { meRepo, type Me } from "../api/repos";
import { clearQueries, setQueryData, setUnauthorizedHandler } from "../api/query-client";

export type SessionStatus = "loading" | "signedOut" | "signedIn" | "error";

interface SessionState {
  status: SessionStatus;
  me: Me | null;
}

export const useSession = create<SessionState>(() => ({ status: "loading", me: null }));

const set = (s: Partial<SessionState>) => useSession.setState(s);

async function csrfToken(): Promise<string> {
  const res = await rawRequest("/api/auth/csrf");
  if (!res.ok) throw new ApiRequestError(res.status, "Couldn't start signing in");
  const body = (await res.json()) as { csrfToken?: string };
  if (!body.csrfToken) throw new ApiRequestError(500, "Couldn't start signing in");
  return body.csrfToken;
}

function form(data: Record<string, string>) {
  return Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** Who is signed in. Resolves null (and clears local state) when the session is gone. */
async function loadMe(): Promise<Me | null> {
  try {
    const me = await meRepo.get();
    if (me) setQueryData("me", me);
    return me;
  } catch (e) {
    if (e instanceof ApiRequestError && e.status === 401) return null;
    throw e;
  }
}

/** On launch: restore the stored session if the server still accepts it. */
export async function bootstrapSession() {
  set({ status: "loading" });
  if (!(await hasSessionCookie())) {
    set({ status: "signedOut", me: null });
    return;
  }
  try {
    const me = await loadMe();
    if (me) set({ status: "signedIn", me });
    else {
      await clearCookies();
      set({ status: "signedOut", me: null });
    }
  } catch {
    // Offline or server down: the web shows "Couldn't open your workspace" + retry.
    set({ status: "error" });
  }
}

export class SignInError extends Error {}

/** Credentials sign-in. Throws SignInError with the same copy as the web. */
export async function signIn(email: string, password: string): Promise<Me> {
  clearQueries();
  const token = await csrfToken();
  const res = await rawRequest("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: form({ email, password, csrfToken: token, callbackUrl: "/today" }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string };
  const failed = !res.ok || !body.url || /[?&]error=/.test(body.url);
  if (failed) throw new SignInError("That email and password don't match an account.");

  const me = await loadMe();
  if (!me) throw new SignInError("That email and password don't match an account.");
  set({ status: "signedIn", me });
  return me;
}

/** Creates the account (POST /api/auth/register) — call signIn afterwards. */
export async function register(email: string, password: string, role: "tailor" | "customer") {
  await api("/api/auth/register", { method: "POST", body: JSON.stringify({ email, password, role }) });
}

export async function requestPasswordReset(email: string) {
  await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, password: string) {
  await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
}

/** Ends the session on the server (best effort) and forgets everything locally. */
export async function signOut() {
  try {
    const token = await csrfToken();
    await rawRequest("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
      body: form({ csrfToken: token, callbackUrl: "/welcome" }),
    });
  } catch {
    // Offline — the local session is still removed below.
  }
  await endLocalSession();
}

/** Forget the session locally (after account deletion, or when the server rejects it). */
export async function endLocalSession() {
  await clearCookies();
  clearQueries();
  set({ status: "signedOut", me: null });
}

/** A 401 from any request while signed in means the session expired. */
export function handleUnauthorized() {
  if (useSession.getState().status === "signedIn") endLocalSession();
}

setUnauthorizedHandler(handleUnauthorized);

onCookiesCleared(() => {
  if (useSession.getState().status === "signedIn") {
    clearQueries();
    set({ status: "signedOut", me: null });
  }
});

export { NetworkError };

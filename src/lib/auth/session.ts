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
//
// Sign in with Apple (iOS, native sheet):
//   POST /api/auth/apple/nonce             → { nonce } + signed nonce cookie
//   AppleAuthentication.signInAsync({ nonce })
//   POST /api/auth/callback/apple-native   → session cookie (same as above)
// The session cookie lives in the Keychain-backed jar (see ../api/http.ts).
// ============================================================

import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as SecureStore from "expo-secure-store";
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
  // Signed in with Apple and the user has since stopped using their Apple ID
  // with Tayylo (iOS Settings → Sign in with Apple) → sign out, per Apple.
  if (await appleCredentialRevoked()) {
    await signOut();
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

// ---------------------------------------------------------------- Apple

const APPLE_USER_KEY = "tayylo.apple-user.v1";
const APPLE_PENDING_NAME_KEY = "tayylo.apple-pending-name.v1";

/** The user closed the Apple sheet — not an error to show. */
export class AppleSignInCancelled extends Error {}

const APPLE_ERRORS: Record<string, string> = {
  email_in_use: "An account with this email already exists. Sign in with your email and password, then connect Apple in Settings.",
  no_email: "Apple didn't share an email address. Try again and allow Tayylo to see your email (you can still hide it).",
  identity_taken: "This Apple ID is already connected to another Tayylo account.",
  nonce_expired: "That took too long. Please try again.",
  invalid_token: "Apple couldn't confirm it's you. Please try again.",
  not_configured: "Sign in with Apple isn't available yet. Use your email and password for now.",
};
const APPLE_FALLBACK = "Apple sign-in didn't finish. Please try again.";

/** True on iOS 13+ devices where the native Apple sheet is available. */
export async function isAppleSignInAvailable() {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Server nonce → native Apple sheet. Returns the credential and its name (kept until the server has it). */
async function appleCredential() {
  const nonceRes = await rawRequest("/api/auth/apple/nonce", { method: "POST" });
  if (!nonceRes.ok) throw new SignInError(nonceRes.status === 503 ? APPLE_ERRORS.not_configured : APPLE_FALLBACK);
  const { nonce } = (await nonceRes.json()) as { nonce?: string };
  if (!nonce) throw new SignInError(APPLE_FALLBACK);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") throw new AppleSignInCancelled();
    throw new SignInError(APPLE_FALLBACK);
  }
  if (!credential.identityToken) throw new SignInError(APPLE_FALLBACK);

  // Apple shares the name ONLY on the first authorization. If the request
  // below fails (offline), keep it on the device so the retry can send it.
  let givenName = credential.fullName?.givenName ?? "";
  let familyName = credential.fullName?.familyName ?? "";
  try {
    if (givenName || familyName) {
      await SecureStore.setItemAsync(APPLE_PENDING_NAME_KEY, JSON.stringify({ user: credential.user, givenName, familyName }));
    } else {
      const pending = JSON.parse((await SecureStore.getItemAsync(APPLE_PENDING_NAME_KEY)) ?? "null") as
        | { user: string; givenName: string; familyName: string }
        | null;
      if (pending?.user === credential.user) ({ givenName, familyName } = pending);
    }
  } catch {
    // Keychain unavailable — the name is a nice-to-have.
  }
  return { credential, givenName, familyName };
}

async function appleSucceeded(appleUser: string) {
  try {
    await SecureStore.setItemAsync(APPLE_USER_KEY, appleUser);
    await SecureStore.deleteItemAsync(APPLE_PENDING_NAME_KEY);
  } catch {
    // Non-critical.
  }
}

/**
 * Native Sign in with Apple. Signs in, or creates the account (with `role`)
 * the first time this Apple ID is seen. Throws AppleSignInCancelled when the
 * user closes the sheet, SignInError (user-facing copy) otherwise, and
 * NetworkError when offline.
 */
export async function signInWithApple(role: "tailor" | "customer"): Promise<Me> {
  clearQueries();
  const { credential, givenName, familyName } = await appleCredential();

  const token = await csrfToken();
  const res = await rawRequest("/api/auth/callback/apple-native", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
    body: form({
      identityToken: credential.identityToken!,
      authorizationCode: credential.authorizationCode ?? "",
      givenName,
      familyName,
      role,
      csrfToken: token,
      callbackUrl: "/today",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string };
  if (!res.ok || !body.url || /[?&]error=/.test(body.url)) {
    const code = body.url ? new URL(body.url, "https://x.invalid").searchParams.get("code") : null;
    throw new SignInError(APPLE_ERRORS[code ?? ""] ?? APPLE_FALLBACK);
  }

  const me = await loadMe();
  if (!me) throw new SignInError(APPLE_FALLBACK);
  await appleSucceeded(credential.user);
  set({ status: "signedIn", me });
  return me;
}

/** Connects Apple to the signed-in account (Settings). */
export async function linkApple() {
  const { credential, givenName, familyName } = await appleCredential();
  await api("/api/me/identities/apple", {
    method: "POST",
    body: JSON.stringify({ identityToken: credential.identityToken, authorizationCode: credential.authorizationCode, givenName, familyName }),
  });
  await appleSucceeded(credential.user);
}

/** Apple says this device's Apple credential was revoked (or the Apple ID is gone). */
async function appleCredentialRevoked() {
  if (Platform.OS !== "ios") return false;
  try {
    const appleUser = await SecureStore.getItemAsync(APPLE_USER_KEY);
    if (!appleUser) return false;
    const state = await AppleAuthentication.getCredentialStateAsync(appleUser);
    return (
      state === AppleAuthentication.AppleAuthenticationCredentialState.REVOKED ||
      state === AppleAuthentication.AppleAuthenticationCredentialState.NOT_FOUND
    );
  } catch {
    return false; // Simulator / offline: don't sign anyone out on a guess.
  }
}

if (Platform.OS === "ios") {
  try {
    // Revoked while the app is open.
    AppleAuthentication.addRevokeListener(async () => {
      // Only sessions that came from Apple end with the Apple credential.
      const appleUser = await SecureStore.getItemAsync(APPLE_USER_KEY).catch(() => null);
      if (appleUser && useSession.getState().status === "signedIn") signOut();
    });
  } catch {
    // Native module missing (e.g. Expo Go) — the launch check still applies.
  }
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
  try {
    await SecureStore.deleteItemAsync(APPLE_USER_KEY);
  } catch {
    // Non-critical.
  }
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

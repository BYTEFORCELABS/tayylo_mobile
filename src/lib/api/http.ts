// ============================================================
// HTTP client for the Tayylo backend.
//
// The backend authenticates with Auth.js session cookies (a signed JWT in
// `authjs.session-token`, or `__Secure-authjs.session-token` over HTTPS).
// Rather than relying on the platform's shared cookie store, the app keeps
// its own small cookie jar in the device keychain / keystore
// (expo-secure-store) and sends it explicitly on every request. That keeps
// the session encrypted at rest, survives app restarts, and is cleared
// deterministically on sign-out.
// ============================================================

import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config";

const JAR_KEY = "tayylo.cookies.v1";

/** Error carrying the HTTP status, so callers can tell "signed out" (401) apart. */
export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Thrown when the request never reached the server (offline, DNS, timeout). */
export class NetworkError extends Error {
  constructor(message = "Couldn't reach Tayylo. Check your connection and try again.") {
    super(message);
  }
}

// ---------------------------------------------------------------- cookie jar

let jar: Record<string, string> = {};
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadJar() {
  if (!loaded) {
    loaded = SecureStore.getItemAsync(JAR_KEY)
      .then(raw => {
        jar = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      })
      .catch(() => {
        jar = {};
      });
  }
  return loaded;
}

async function persistJar() {
  try {
    if (Object.keys(jar).length) await SecureStore.setItemAsync(JAR_KEY, JSON.stringify(jar));
    else await SecureStore.deleteItemAsync(JAR_KEY);
  } catch {
    // Keychain unavailable — the session still works until the app closes.
  }
}

/** True when a session cookie is held (it may still be expired server-side). */
export async function hasSessionCookie() {
  await loadJar();
  return Object.keys(jar).some(k => k.endsWith("authjs.session-token") || k.includes("authjs.session-token."));
}

export async function clearCookies() {
  await loadJar();
  jar = {};
  await persistJar();
  listeners.forEach(l => l());
}

/** Notified whenever the session cookie disappears (sign-out, expiry). */
export function onCookiesCleared(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Splits a (possibly comma-joined) Set-Cookie header into cookies. Commas
 * also appear inside `Expires=Wed, 21 Oct …`, so only split on a comma that
 * is followed by a `name=` pair.
 */
function splitSetCookie(header: string): string[] {
  return header.split(/,(?=\s*[^;,=\s]+=)/).map(s => s.trim()).filter(Boolean);
}

async function absorbCookies(res: Response) {
  const header = res.headers.get("set-cookie");
  if (!header) return;
  await loadJar();
  let changed = false;
  for (const cookie of splitSetCookie(header)) {
    const [pair, ...attrs] = cookie.split(";");
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const attr = attrs.map(a => a.trim().toLowerCase());
    const maxAge = attr.find(a => a.startsWith("max-age="));
    const expires = attrs.map(a => a.trim()).find(a => a.toLowerCase().startsWith("expires="));
    const expired =
      !value ||
      (maxAge !== undefined && Number(maxAge.split("=")[1]) <= 0) ||
      (expires !== undefined && new Date(expires.slice(8)).getTime() < Date.now());
    if (expired) {
      if (name in jar) {
        delete jar[name];
        changed = true;
      }
    } else if (jar[name] !== value) {
      jar[name] = value;
      changed = true;
    }
  }
  if (changed) {
    await persistJar();
    if (!Object.keys(jar).some(k => k.includes("authjs.session-token"))) listeners.forEach(l => l());
  }
}

function cookieHeader() {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// ---------------------------------------------------------------- requests

const TIMEOUT_MS = 30_000;

/** Low-level fetch against the backend with the session attached. */
export async function rawRequest(path: string, init: RequestInit = {}): Promise<Response> {
  await loadJar();
  const headers = new Headers(init.headers);
  const cookies = cookieHeader();
  if (cookies) headers.set("Cookie", cookies);
  headers.set("Accept", headers.get("Accept") ?? "application/json");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      // The jar above is the only cookie source — never the shared store.
      credentials: "omit",
      signal: init.signal ?? controller.signal,
    });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
  await absorbCookies(res);
  return res;
}

/**
 * JSON API call with the same contract as the web's `api()` in
 * src/lib/data/store.ts: 404 resolves to null, other failures throw an
 * ApiRequestError carrying the server's `error` message.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await rawRequest(path, { ...init, headers });
  if (res.status === 404) return null as T;
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiRequestError(res.status, (body as { error?: string }).error || `Request to ${path} failed (${res.status})`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export const isSignedOutError = (e: unknown) => e instanceof ApiRequestError && e.status === 401;

// Where the Tayylo backend (the Next.js web app's /api routes) lives.
//
// Set EXPO_PUBLIC_API_URL in .env (see .env.example), e.g.
//   EXPO_PUBLIC_API_URL=https://app.tayylo.com
// In development it defaults to the machine running Metro on port 3000, so
// `npm run dev` in the web repo is all a simulator or phone on the same
// network needs.

import Constants from "expo-constants";
import { Platform } from "react-native";

function devHost(): string {
  // "192.168.1.20:8081" when served by Metro to a device or simulator.
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.split(":")[0];
  if (host) return host;
  return Platform.OS === "android" ? "10.0.2.2" : "localhost";
}

const configured = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");

export const API_URL = configured || `http://${devHost()}:3000`;

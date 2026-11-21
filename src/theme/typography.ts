// Type scale — mirrors the --text-* tokens in the web globals.css.
// Urbanist is the single brand family (next/font on the web,
// @expo-google-fonts/urbanist here). React Native can't pick a weight
// from one family name on Android, so each weight is its own family.

import type { TextStyle } from "react-native";

export const fonts = {
  regular: "Urbanist_400Regular",
  medium: "Urbanist_500Medium",
  semibold: "Urbanist_600SemiBold",
  bold: "Urbanist_700Bold",
} as const;

export type FontWeight = keyof typeof fonts;

const em = (size: number, v: number) => size * v;

export const type = {
  /** 36 — hero numbers */
  display: { fontSize: 36, lineHeight: 36 * 1.05, letterSpacing: em(36, -0.025), fontFamily: fonts.semibold },
  /** 26 — page titles */
  title: { fontSize: 26, lineHeight: 26 * 1.15, letterSpacing: em(26, -0.02), fontFamily: fonts.semibold },
  /** 17 — section / card titles */
  headline: { fontSize: 17, lineHeight: 17 * 1.3, letterSpacing: em(17, -0.01), fontFamily: fonts.semibold },
  /** 15 — body */
  body: { fontSize: 15, lineHeight: 15 * 1.5, fontFamily: fonts.regular },
  /** 13 — labels, meta */
  label: { fontSize: 13, lineHeight: 13 * 1.35, fontFamily: fonts.regular },
  /** 12 — captions */
  caption: { fontSize: 12, lineHeight: 12 * 1.4, fontFamily: fonts.regular },
  /** 11 — group overlines (render uppercase) */
  overline: { fontSize: 11, lineHeight: 11 * 1.3, letterSpacing: em(11, 0.08), fontFamily: fonts.semibold },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** `.tabular` — aligned figures for money, dates and measurements. */
export const tabular: TextStyle = { fontVariant: ["tabular-nums"] };

/** `.measurement-value` */
export const measurementValue: TextStyle = { fontVariant: ["tabular-nums"], letterSpacing: -0.02 * 16 };

// ============================================================
// Tayylo design tokens — a 1:1 mirror of the web app's @theme block
// (tayylo/src/app/globals.css) and src/lib/tokens.ts. The web CSS is the
// source of truth; keep these values identical to it.
//
// Direction: premium minimalism, soft warm monochrome surfaces, olive as
// the one brand accent, pill actions, restrained elevation.
// ============================================================

export const colors = {
  // Brand
  olive: "#454F2C",
  oliveDeep: "#2E3420",
  oliveLight: "#6B7A45",
  oliveSoft: "#E6E8DA",
  oliveSoftPressed: "#DCE0CC",
  beige: "#E8E2D4",
  beigeLight: "#F0EDE5",

  // Surfaces (light → elevated)
  canvas: "#F4F2EC",
  surface: "#FBFAF7",
  surfaceRaised: "#FFFFFF",
  surfaceSunken: "#ECE9E1",
  panel: "#2E3420",
  panelMuted: "#3B4229",

  // Text
  ink: "#1E2019",
  textSecondary: "#55574C",
  textTertiary: "#6B6D62",
  textInverse: "#FBFAF7",
  textOnPanelMuted: "#C9CDB8",

  // Lines
  border: "#E3E0D6",
  borderStrong: "#CFCBBE",
  divider: "#ECE9E1",

  // Status (muted, never shouting)
  success: "#3D6B48",
  successBg: "#E5EEE4",
  warning: "#8F6220",
  warningBg: "#F4EBDA",
  danger: "#9C3D2C",
  dangerBg: "#F5E4DF",
  dangerPressed: "#86321F",
  info: "#3F6175",
  infoBg: "#E2EAEE",

  // One-off accents the web hard-codes (notification badge, WhatsApp)
  badge: "#D93A2B",
  whatsapp: "#25D366",

  // Tab bar active green (navigation.tsx)
  navActive: "#3F8A2A",
  navActiveBg: "rgba(63,138,42,0.12)",

  // Overlays
  scrim: "rgba(30,32,25,0.40)",
  white: "#FFFFFF",
  black: "#000000",
} as const;

/** `rgba()` helper for the few places the web uses colour/opacity (e.g. border-border/70). */
export function alpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Card / list hairline: `border-border/70` on the web. */
export const hairline = alpha(colors.border, 0.7);

export const radii = {
  xs: 6,
  sm: 10,
  control: 12,
  input: 14,
  card: 20,
  panel: 28,
  dialog: 28,
  sheet: 28,
  pill: 9999,
} as const;

/** Tailwind's 4px spacing base. Use 1,2,3,4,5,6,8,10,12,16 steps only. */
export const space = (n: number) => n * 4;

/** Screen side gutter (`px-4` on phones). */
export const GUTTER = 16;

// Elevation — CSS box-shadow strings, supported natively by React Native's
// `boxShadow` style (New Architecture). Values copied from globals.css.
export const shadows = {
  xs: "0px 1px 2px rgba(30,32,25,0.05)",
  float: "0px 10px 30px -8px rgba(30,32,25,0.22), 0px 2px 6px rgba(30,32,25,0.06)",
  fab: "0px 8px 20px -4px rgba(46,52,32,0.45)",
  dialog: "0px 24px 64px -16px rgba(30,32,25,0.28)",
  sheet: "0px -12px 40px -12px rgba(30,32,25,0.18)",
  // .btn-raised (primary / destructive-filled)
  raised:
    "inset 0px 1px 0px rgba(255,255,255,0.22), inset 0px -2px 0px rgba(0,0,0,0.14), 0px 1px 2px rgba(30,32,25,0.18), 0px 8px 18px -8px rgba(46,52,28,0.55)",
  raisedPressed: "inset 0px 1px 0px rgba(255,255,255,0.12), inset 0px 1px 3px rgba(0,0,0,0.2), 0px 1px 2px rgba(30,32,25,0.14)",
  // .btn-raised-light (secondary)
  raisedLight:
    "inset 0px 1px 0px rgba(255,255,255,1), inset 0px -1.5px 0px rgba(30,32,25,0.05), 0px 1px 2px rgba(30,32,25,0.06), 0px 6px 14px -8px rgba(30,32,25,0.22)",
  raisedLightPressed: "inset 0px 1px 2px rgba(30,32,25,0.08), 0px 1px 1px rgba(30,32,25,0.05)",
  // .fab-raised — the centre "+" on the tab bar
  fabRaised:
    "inset 0px 1px 0px rgba(255,255,255,0.3), inset 0px -3px 6px rgba(0,0,0,0.22), 0px 2px 4px rgba(30,32,25,0.2), 0px 12px 24px -8px rgba(46,52,28,0.6)",
  navBar: "0px 10px 22px rgba(30,32,25,0.16)",
  headerScrolled: "0px 6px 20px -12px rgba(30,32,25,0.25)",
  selectedRing: `0px 0px 0px 1px ${colors.ink}`,
} as const;

export const motion = {
  fast: 120,
  normal: 200,
  slow: 320,
  pressScale: 0.97,
} as const;

/** One stroke weight for every lucide icon in the product. */
export const ICON_STROKE = 1.75;

import * as React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

// The only way the Tayylo mark is placed in the UI. Ratios come from the
// supplied artwork (lockup 1872×450, symbol 630×450) so it can never be
// stretched. Olive on light surfaces, cream on dark ones.

const LOCKUP_RATIO = 1872 / 450;
const SYMBOL_RATIO = 630 / 450;

const SOURCES = {
  lockup: {
    olive: require("../../../assets/brand/lockup_olive.png"),
    cream: require("../../../assets/brand/lockup_cream.png"),
    ink: require("../../../assets/brand/lockup_ink.png"),
    beige: require("../../../assets/brand/lockup_beige.png"),
  },
  symbol: {
    olive: require("../../../assets/brand/symbol_olive.png"),
    cream: require("../../../assets/brand/symbol_cream.png"),
    ink: require("../../../assets/brand/symbol_ink.png"),
    beige: require("../../../assets/brand/symbol_beige.png"),
  },
} as const;

interface LogoProps {
  variant?: "lockup" | "symbol";
  tone?: "olive" | "cream" | "ink" | "beige";
  /** Rendered height in px; width follows the artwork's ratio. */
  height?: number;
  style?: StyleProp<ImageStyle>;
}

export function Logo({ variant = "lockup", tone = "olive", height = 28, style }: LogoProps) {
  const ratio = variant === "lockup" ? LOCKUP_RATIO : SYMBOL_RATIO;
  return (
    <Image
      source={SOURCES[variant][tone]}
      accessibilityLabel="Tayylo"
      resizeMode="contain"
      style={[{ height, width: Math.round(height * ratio) }, style]}
    />
  );
}

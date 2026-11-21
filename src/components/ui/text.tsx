import * as React from "react";
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { colors } from "@/theme/tokens";
import { fonts, type FontWeight, tabular as tabularStyle, type as typeScale, type TypeVariant } from "@/theme/typography";

export interface TextProps extends RNTextProps {
  /** Type scale step (display, title, headline, body, label, caption, overline). */
  variant?: TypeVariant;
  /** Overrides the variant's weight. */
  weight?: FontWeight;
  color?: string;
  /** Tabular figures for money, dates and measurements. */
  tabular?: boolean;
  /** Font size override (for the web's one-off `text-[22px]` sizes). */
  size?: number;
  align?: TextStyle["textAlign"];
}

/** The only text primitive: Urbanist, ink by default, on the Tayylo type scale. */
export const Text = React.forwardRef<React.ComponentRef<typeof RNText>, TextProps>(function Text(
  { variant = "body", weight, color = colors.ink, tabular, size, align, style, ...props },
  ref
) {
  const base = typeScale[variant];
  const fontSize = size ?? base.fontSize;
  return (
    <RNText
      ref={ref}
      allowFontScaling
      maxFontSizeMultiplier={1.4}
      style={[
        base,
        size ? { fontSize, lineHeight: Math.round(fontSize * ((base.lineHeight ?? fontSize * 1.4) / base.fontSize)) } : null,
        weight ? { fontFamily: fonts[weight] } : null,
        variant === "overline" ? { textTransform: "uppercase" } : null,
        { color },
        align ? { textAlign: align } : null,
        tabular ? tabularStyle : null,
        style,
      ]}
      {...props}
    />
  );
});

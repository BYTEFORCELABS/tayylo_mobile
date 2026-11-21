import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/theme/tokens";
import { initials } from "@/lib/format";
import { resolveImage } from "@/lib/static-images";
import { Text } from "./text";

// Muted, warm initials backgrounds — deterministic per name so a client
// always looks the same, without introducing off-brand colours.
const TINTS = [
  { bg: colors.oliveSoft, fg: colors.oliveDeep },
  { bg: colors.beige, fg: "#5B5240" },
  { bg: "#E3E6E0", fg: "#3E4A44" },
  { bg: "#EDE3DA", fg: "#6A4E3A" },
  { bg: colors.surfaceSunken, fg: colors.textSecondary },
];

function tintFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TINTS[Math.abs(hash) % TINTS.length];
}

const SIZES = { xs: [24, 10], sm: [32, 11], md: [40, 13], lg: [48, 15], xl: [80, 24] } as const;

export interface AvatarProps {
  name: string;
  size?: keyof typeof SIZES;
  src?: string | null;
  /** `rounded` = soft square (client lists and recents). */
  shape?: "circle" | "rounded";
  /** Exact pixel size + initials size, for the web's one-off `size-16 text-[20px]` avatars. */
  px?: number;
  fontSize?: number;
  /** Initials weight (the web's Recents strip uses medium). */
  fontWeight?: "medium" | "semibold";
  style?: StyleProp<ViewStyle>;
}

export function Avatar({ name, size = "md", src, shape = "circle", px: pxOverride, fontSize, fontWeight = "semibold", style }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const px = pxOverride ?? SIZES[size][0];
  const font = fontSize ?? SIZES[size][1];
  const radius = shape === "circle" ? px / 2 : size === "xs" || size === "sm" ? 8 : size === "md" ? 12 : 18;
  const showImage = !!src && !failed;
  const tint = tintFor(name);
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        { width: px, height: px, borderRadius: radius, overflow: "hidden", alignItems: "center", justifyContent: "center" },
        !showImage && { backgroundColor: tint.bg },
        style,
      ]}
    >
      {showImage ? (
        <Image source={resolveImage(src)} style={{ width: px, height: px }} contentFit="cover" onError={() => setFailed(true)} />
      ) : (
        <Text size={font} weight={fontWeight} color={tint.fg} style={{ letterSpacing: -0.2 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

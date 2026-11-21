import * as React from "react";
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import Svg, { Line } from "react-native-svg";
import { colors, hairline, radii } from "@/theme/tokens";
import { PressableScale } from "./pressable";
import { Text } from "./text";

const PADDING = { none: 0, sm: 16, md: 20, lg: 24 } as const;

interface CardProps extends ViewProps {
  padding?: keyof typeof PADDING;
  /** Makes the card pressable with the subtle card press feedback. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The default container. Flat surface on the canvas, no shadow — depth
 * comes from the surface/canvas contrast, not from elevation.
 */
export function Card({ padding = "md", onPress, style, children, ...props }: CardProps) {
  const s = [styles.card, { padding: PADDING[padding] }, style];
  if (onPress) {
    return (
      <PressableScale scaleTo={0.99} onPress={onPress} style={s}>
        {children}
      </PressableScale>
    );
  }
  return (
    <View style={s} {...props}>
      {children}
    </View>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text variant="headline">{children}</Text>;
}

/**
 * Prominent summary panel — the one dark, high-contrast surface on a
 * screen, with a tailor's tape along its top edge.
 */
export function Panel({ style, children, ...props }: ViewProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.panel, style]} {...props}>
      <TapeRule />
      {children}
    </View>
  );
}

// One "unit" on the tape: minor ticks every UNIT/10, a half mark at UNIT/2
// and a numbered major mark every UNIT — like the edge of a tailor's tape.
const UNIT = 64;
const ORIGIN = 24;
const COUNT = 16;

/** Tailor's tape-measure edge along the top of a panel. Purely decorative. */
export function TapeRule({ color = colors.textInverse, style }: { color?: string; style?: StyleProp<ViewStyle> }) {
  const width = ORIGIN + UNIT * COUNT;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i <= COUNT * 10; i++) {
    const x = ORIGIN + (i * UNIT) / 10 + 0.5;
    const h = i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6;
    ticks.push(<Line key={i} x1={x} y1={0} x2={x} y2={h} stroke={color} strokeWidth={1} />);
  }
  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[styles.tape, style]}>
      <Svg width={width} height={28}>
        {ticks}
      </Svg>
      <View style={[styles.tapeNumbers, { left: ORIGIN + 3 }]}>
        {Array.from({ length: COUNT }, (_, i) => (
          <Text key={i} tabular weight="semibold" size={9.5} color={color} style={{ width: UNIT, lineHeight: 10 }}>
            {i}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
  },
  panel: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.panel,
    backgroundColor: colors.panel,
    padding: 24,
    paddingTop: 44,
  },
  tape: { position: "absolute", left: 0, right: 0, top: 0, height: 28, overflow: "hidden", opacity: 0.35 },
  tapeNumbers: { position: "absolute", top: 16, flexDirection: "row" },
});

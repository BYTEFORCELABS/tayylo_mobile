import * as React from "react";
import { View } from "react-native";
import LottieView from "lottie-react-native";
import { colors } from "@/theme/tokens";

const loadingMark = require("../../../assets/lottie/tayylo-symbol-olive.json");

/** Full-screen branded wait state (session checks, opening the workspace). */
export function BrandLoader({ label = "Loading" }: { label?: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
      <LottieView source={loadingMark} autoPlay loop style={{ width: 56, height: 56 }} />
    </View>
  );
}

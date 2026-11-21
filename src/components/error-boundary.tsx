import * as React from "react";
import { View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { ErrorState } from "@/components/ui/states";
import { colors } from "@/theme/tokens";

/** Route-level error boundary: a calm retry screen instead of a red box. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.canvas }}>
      <ErrorState title="Something went wrong" description="This screen ran into a problem. Try again — your data is safe." onRetry={retry} />
    </View>
  );
}

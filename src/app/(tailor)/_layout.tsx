import * as React from "react";
import { View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useBusiness } from "@/lib/use-business";
import { prefetchWorkspace } from "@/lib/api/query";
import { BrandLoader } from "@/components/brand/brand-loader";
import { ErrorState, OfflineBanner } from "@/components/ui/states";
import { CreateSheet } from "@/components/shell/navigation";
import { colors } from "@/theme/tokens";

/**
 * Tailor workspace. Like the web's (app)/layout: needs a business (else
 * onboarding), starts loading orders/clients/templates straight away, and
 * hosts the Create sheet and offline banner for every screen inside it.
 */
export default function TailorLayout() {
  const { business, status, refresh } = useBusiness();

  React.useEffect(() => {
    prefetchWorkspace();
  }, []);

  if (!business) {
    if (status === "loading") return <BrandLoader label="Opening your workspace" />;
    if (status === "error")
      return (
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.canvas }}>
          <ErrorState title="Couldn't open your workspace" description="We couldn't reach Tayylo. Check your connection and try again." onRetry={() => refresh()} />
        </View>
      );
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" options={{ presentation: "transparentModal", animation: "fade" }} />
        <Stack.Screen name="measure" options={{ gestureEnabled: false }} />
        <Stack.Screen name="orders/new" />
      </Stack>
      <CreateSheet />
      <OfflineBanner />
    </View>
  );
}

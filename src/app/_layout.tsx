import * as React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { StatusBar } from "expo-status-bar";
import { useFonts, Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold } from "@expo-google-fonts/urbanist";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { queryClient } from "@/lib/api/query";
import { bootstrapSession, useSession } from "@/lib/auth/session";
import { ToastHost } from "@/components/ui/toast";
import { BrandSplash } from "@/components/splash-screen";
import { colors } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});
SystemUI.setBackgroundColorAsync(colors.canvas).catch(() => {});


export { ErrorBoundary } from "@/components/error-boundary";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold });
  const status = useSession(s => s.status);
  const role = useSession(s => s.me?.role);
  const [introDone, setIntroDone] = React.useState(false);
  const fontsReady = fontsLoaded || !!fontError;

  React.useEffect(() => {
    bootstrapSession();
  }, []);

  React.useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  const signedIn = status === "signedIn";

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style={introDone ? "dark" : "light"} />
          {fontsReady ? (
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: "default" }}>
              <Stack.Screen name="index" options={{ animation: "none" }} />
              <Stack.Protected guard={status === "signedOut"}>
                <Stack.Screen name="welcome" options={{ animation: "fade" }} />
                <Stack.Screen name="auth/index" />
              </Stack.Protected>
              {/* Reset links work signed in or out, like the web page. */}
              <Stack.Screen name="auth/reset" />
              <Stack.Protected guard={signedIn && role === "tailor"}>
                <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
                <Stack.Screen name="(tailor)" options={{ animation: "fade" }} />
              </Stack.Protected>
              <Stack.Protected guard={signedIn && role === "customer"}>
                <Stack.Screen name="(customer)" options={{ animation: "fade" }} />
              </Stack.Protected>
            </Stack>
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.panel }} />
          )}
          <ToastHost />
          {!introDone && <BrandSplash ready={fontsReady} onDone={() => setIntroDone(true)} />}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

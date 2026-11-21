import * as React from "react";
import { View } from "react-native";
import { Tabs } from "expo-router/tabs";
import { FloatingNav } from "@/components/shell/navigation";
import { OfflineBanner } from "@/components/ui/states";
import { colors } from "@/theme/tokens";

/** Customers only get inspiration and their account — no business tools. */
export default function CustomerTabs() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Tabs tabBar={props => <FloatingNav {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas }, animation: "fade" }}>
        <Tabs.Screen name="discover" />
        <Tabs.Screen name="account" />
      </Tabs>
      <OfflineBanner />
    </View>
  );
}

import * as React from "react";
import { Tabs } from "expo-router/tabs";
import { FloatingNav } from "@/components/shell/navigation";
import { colors } from "@/theme/tokens";

/** Home · Contact · (+) · Orders · Profile — the web's phone tab bar. */
export default function TailorTabs() {
  return (
    <Tabs
      tabBar={props => <FloatingNav {...props} withCreate />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.canvas }, animation: "fade" }}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

// Minimal account screen for customers (tailors manage theirs in Settings).
// Port of tayylo/src/app/(app)/account/page.tsx.

import * as React from "react";
import { StyleSheet, View } from "react-native";
import { LogOut } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/page";
import { Text } from "@/components/ui/text";
import { signOut } from "@/lib/auth/session";
import { useMe } from "@/lib/use-business";
import { colors, radii } from "@/theme/tokens";

export function AccountScreen() {
  const { me } = useMe();
  const [busy, setBusy] = React.useState(false);

  return (
    <Screen tabBar header={{ title: "Account" }}>
      <View style={styles.card}>
        <Text variant="overline" color={colors.textTertiary}>
          Signed in as
        </Text>
        <Text size={15} weight="semibold" style={{ marginTop: 4 }}>
          {me?.email ?? "…"}
        </Text>
        <Text variant="label" color={colors.textSecondary} style={styles.role}>
          {me?.role} account
        </Text>
      </View>
      <Button
        variant="secondary"
        block
        icon={LogOut}
        style={{ marginTop: 24 }}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          // Clears the session and cache; the route guards return to Welcome.
          await signOut();
        }}
      >
        Sign out
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 20 },
  role: { marginTop: 2, textTransform: "capitalize" },
});

// Set a new password from the emailed link. Opens from a
// tayylo://auth/reset?token=… deep link (same token the web page reads).

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AlertCircle, Eye, EyeOff, Link as LinkIcon, Lock } from "lucide-react-native";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SuccessMark } from "@/components/brand/success-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ApiRequestError } from "@/lib/api/http";
import { resetPassword, useSession } from "@/lib/auth/session";
import { colors, radii } from "@/theme/tokens";

export default function ResetPasswordScreen() {
  const { token = "" } = useLocalSearchParams<{ token?: string }>();
  const signedIn = useSession(s => s.status === "signedIn");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !!token && password.length >= 6 && password === confirm && !loading;
  const toSignIn = () => router.replace(signedIn ? "/" : "/auth?mode=signin");

  const submit = async () => {
    setTouched(true);
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message || "Could not reset your password" : "Couldn't reach Tayylo. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSunken }]}>
          <LinkIcon size={24} strokeWidth={1.75} color={colors.textSecondary} />
        </View>
        <Text variant="title" accessibilityRole="header">
          Open the link from your email
        </Text>
        <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
          This page needs the reset link we emailed you. If it expired, request a new one.
        </Text>
        <Button size="lg" block style={{ marginTop: 32 }} onPress={toSignIn}>
          Back to sign in
        </Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <View style={{ marginBottom: 20 }}>
          <SuccessMark size={72} label="Password updated" />
        </View>
        <Text variant="title" accessibilityRole="header">
          Password updated
        </Text>
        <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
          Sign in with your new password to continue.
        </Text>
        <Button size="lg" block style={{ marginTop: 32 }} onPress={toSignIn}>
          Sign in
        </Button>
      </AuthLayout>
    );
  }

  const toggle = (
    <Pressable
      onPress={() => setShow(v => !v)}
      accessibilityLabel={show ? "Hide passwords" : "Show passwords"}
      style={({ pressed }) => [styles.eye, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      {show ? <EyeOff size={18} strokeWidth={1.75} color={colors.textTertiary} /> : <Eye size={18} strokeWidth={1.75} color={colors.textTertiary} />}
    </Pressable>
  );

  return (
    <AuthLayout>
      <Text variant="title" accessibilityRole="header">
        Set a new password
      </Text>
      <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
        Choose a password you haven&apos;t used here before.
      </Text>

      <View style={{ marginTop: 32, gap: 20 }}>
        <Input
          label="New password"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          leadingIcon={Lock}
          value={password}
          onChangeText={setPassword}
          error={(touched || tooShort) && password.length < 6 ? "Use at least 6 characters" : undefined}
          helperText="At least 6 characters"
          trailing={toggle}
          autoFocus
        />
        <Input
          label="Confirm new password"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          leadingIcon={Lock}
          value={confirm}
          onChangeText={setConfirm}
          error={mismatch || (touched && confirm !== password) ? "Passwords don't match" : undefined}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {error ? (
          <View accessibilityRole="alert" style={styles.error}>
            <AlertCircle size={16} strokeWidth={2} color={colors.danger} style={{ marginTop: 2 }} />
            <Text variant="label" color={colors.danger} style={{ flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}
        <Button size="lg" block loading={loading} onPress={submit}>
          Save new password
        </Button>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  iconCircle: { marginBottom: 20, width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  eye: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: radii.input, backgroundColor: colors.dangerBg, paddingHorizontal: 16, paddingVertical: 12 },
});

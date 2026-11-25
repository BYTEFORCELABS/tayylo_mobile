// Sign in / Create account / Reset password — same copy, validation and
// flow as the web's /auth page.

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from "expo-apple-authentication";
import { AlertCircle, Eye, EyeOff, Lock, Mail, MailCheck } from "lucide-react-native";
import { AuthLayout } from "@/components/auth/auth-layout";
import { StitchLoader } from "@/components/brand/stitch-loader";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { ApiRequestError, NetworkError } from "@/lib/api/http";
import {
  AppleSignInCancelled,
  isAppleSignInAvailable,
  register,
  requestPasswordReset,
  signIn,
  signInWithApple,
  SignInError,
} from "@/lib/auth/session";
import { colors, radii } from "@/theme/tokens";

type Mode = "signin" | "signup" | "reset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OFFLINE = "Couldn't reach Tayylo. Check your connection and try again.";

const copy: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Welcome back", subtitle: "Sign in to your workspace." },
  signup: { title: "Create your account", subtitle: "Free to start. Set up your studio in under a minute." },
  reset: { title: "Reset your password", subtitle: "Enter your account email and we'll send you a link to set a new one." },
};

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
      <Path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
      <Path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
      <Path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
    </Svg>
  );
}

export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = React.useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [role, setRole] = React.useState<"tailor" | "customer">("tailor");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState({ email: false, password: false });
  const [resetSent, setResetSent] = React.useState(false);
  const [appleAvailable, setAppleAvailable] = React.useState(false);
  const [appleLoading, setAppleLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    isAppleSignInAvailable().then(ok => alive && setAppleAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordValid = password.length >= 6;
  const emailError = touched.email && !emailValid ? "Enter a valid email address" : undefined;
  const passwordError = touched.password && !passwordValid ? "Use at least 6 characters" : undefined;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setResetSent(false);
    setTouched({ email: false, password: false });
  };

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    if (!emailValid || !passwordValid || loading || appleLoading) return;
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        try {
          await register(email.trim(), password, role);
        } catch (e) {
          setError(e instanceof ApiRequestError ? e.message : e instanceof NetworkError ? OFFLINE : "Could not create your account");
          setLoading(false);
          return;
        }
      }
      await signIn(email.trim(), password);
      // The route guards switch to the workspace; index decides Today / Onboarding / Explore.
      router.replace("/");
    } catch (e) {
      setError(e instanceof SignInError ? e.message : OFFLINE);
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setTouched(t => ({ ...t, email: true }));
    if (!emailValid) return;
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setResetSent(true);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message || "Could not send the reset email" : OFFLINE);
    } finally {
      setLoading(false);
    }
  };

  // Native Sign in with Apple. One request at a time; the same button signs
  // in or creates the account (with the role picked on "Create account").
  const handleApple = async () => {
    if (appleLoading || loading) return;
    setError(null);
    setAppleLoading(true);
    try {
      await signInWithApple(role);
      router.replace("/");
    } catch (e) {
      if (!(e instanceof AppleSignInCancelled)) setError(e instanceof SignInError ? e.message : OFFLINE);
      setAppleLoading(false);
    }
  };

  // Google on mobile still needs a native Google client (not configured yet).
  const handleGoogle = () => {
    setError("Google sign-in isn't available in the app yet. Use your email and password for now.");
  };

  return (
    <AuthLayout>
      {mode !== "reset" && (
        <SegmentedControl
          accessibilityLabel="Account"
          block
          style={{ marginBottom: 32 }}
          value={mode}
          onChange={m => switchMode(m)}
          options={[
            { value: "signin", label: "Sign in" },
            { value: "signup", label: "Create account" },
          ]}
        />
      )}

      <Animated.View key={mode + String(resetSent)} entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(160)}>
        {mode === "reset" && resetSent ? (
          <View>
            <View style={styles.sentIcon}>
              <MailCheck size={26} strokeWidth={1.75} color={colors.oliveDeep} />
            </View>
            <Text variant="title" accessibilityRole="header">
              Check your inbox
            </Text>
            <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
              If an account exists for{" "}
              <Text weight="semibold">{email}</Text>, a reset link is on its way. It expires after a short while.
            </Text>
            <Button size="lg" block style={{ marginTop: 32 }} onPress={() => switchMode("signin")}>
              Back to sign in
            </Button>
            <Button variant="ghost" block style={{ marginTop: 8 }} onPress={() => setResetSent(false)}>
              Use a different email
            </Button>
          </View>
        ) : (
          <View>
            <Text variant="title" accessibilityRole="header">
              {copy[mode].title}
            </Text>
            <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
              {copy[mode].subtitle}
            </Text>

            <View style={{ marginTop: 32, gap: 20 }}>
              {mode === "signup" && (
                <View>
                  <Text variant="label" weight="semibold" style={{ marginBottom: 8 }}>
                    I am a…
                  </Text>
                  <SegmentedControl
                    accessibilityLabel="Account type"
                    block
                    value={role}
                    onChange={setRole}
                    options={[
                      { value: "tailor", label: "Tailor" },
                      { value: "customer", label: "Customer" },
                    ]}
                  />
                  <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 8 }}>
                    {role === "tailor" ? "Manage clients, measurements, orders, invoices and receipts." : "Browse style inspiration and keep the looks you love."}
                  </Text>
                </View>
              )}

              <Input
                label="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="you@studio.com"
                leadingIcon={Mail}
                value={email}
                onChangeText={setEmail}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                error={emailError}
                returnKeyType={mode === "reset" ? "send" : "next"}
                onSubmitEditing={mode === "reset" ? handleReset : undefined}
              />

              {mode !== "reset" && (
                <Input
                  label="Password"
                  hint={
                    mode === "signin" ? (
                      <Pressable onPress={() => switchMode("reset")} hitSlop={8} accessibilityRole="link">
                        <Text variant="caption" weight="semibold" color={colors.olive}>
                          Forgot password?
                        </Text>
                      </Pressable>
                    ) : undefined
                  }
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  textContentType={mode === "signin" ? "password" : "newPassword"}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                  leadingIcon={Lock}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                  error={passwordError}
                  helperText={mode === "signup" && !passwordError ? "At least 6 characters" : undefined}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  trailing={
                    <Pressable
                      onPress={() => setShowPassword(v => !v)}
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      style={({ pressed }) => [styles.eye, pressed && { backgroundColor: colors.surfaceSunken }]}
                    >
                      {showPassword ? <EyeOff size={18} strokeWidth={1.75} color={colors.textTertiary} /> : <Eye size={18} strokeWidth={1.75} color={colors.textTertiary} />}
                    </Pressable>
                  }
                />
              )}

              {error ? (
                <Animated.View entering={FadeInDown.duration(240)} accessibilityRole="alert" style={styles.error}>
                  <AlertCircle size={16} strokeWidth={2} color={colors.danger} style={{ marginTop: 2 }} />
                  <Text variant="label" color={colors.danger} style={{ flex: 1 }}>
                    {error}
                  </Text>
                </Animated.View>
              ) : null}

              <Button size="lg" block disabled={loading} onPress={mode === "reset" ? handleReset : handleSubmit} style={loading ? { height: "auto", minHeight: 52, paddingVertical: 8 } : undefined}>
                {loading ? (
                  <StitchLoader label={mode === "signin" ? "Stitching you in" : mode === "signup" ? "Tailoring your account" : "Sending your link"} />
                ) : mode === "signin" ? (
                  "Sign in"
                ) : mode === "signup" ? (
                  "Create account"
                ) : (
                  "Send reset link"
                )}
              </Button>
            </View>

            {mode === "reset" ? (
              <View style={[styles.row, { marginTop: 24 }]}>
                <Text variant="label" color={colors.textTertiary}>
                  Remembered it?{" "}
                </Text>
                <Pressable onPress={() => switchMode("signin")} hitSlop={8} accessibilityRole="link">
                  <Text variant="label" weight="semibold">
                    Back to sign in
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.divider}>
                  <View style={styles.rule} />
                  <Text variant="caption" color={colors.textTertiary}>
                    or continue with
                  </Text>
                  <View style={styles.rule} />
                </View>
                <View style={{ gap: 12 }}>
                  {appleAvailable &&
                    (appleLoading ? (
                      // Apple's native button can't show progress — same size and colour, with our loader.
                      <View style={styles.appleBusy} accessibilityRole="progressbar" accessibilityLabel="Signing in with Apple">
                        <StitchLoader label="Stitching you in" color="#FFFFFF" />
                      </View>
                    ) : (
                      <AppleAuthenticationButton
                        buttonType={mode === "signup" ? AppleAuthenticationButtonType.SIGN_UP : AppleAuthenticationButtonType.CONTINUE}
                        buttonStyle={AppleAuthenticationButtonStyle.BLACK}
                        cornerRadius={26}
                        style={[styles.appleButton, loading && { opacity: 0.45 }]}
                        pointerEvents={loading ? "none" : "auto"}
                        onPress={handleApple}
                      />
                    ))}
                  <Button variant="secondary" size="lg" block leading={<GoogleIcon />} disabled={appleLoading} onPress={handleGoogle}>
                    Continue with Google
                  </Button>
                </View>
              </>
            )}
          </View>
        )}
      </Animated.View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  sentIcon: { marginBottom: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.oliveSoft, alignItems: "center", justifyContent: "center" },
  eye: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderRadius: radii.input, backgroundColor: colors.dangerBg, paddingHorizontal: 16, paddingVertical: 12 },
  row: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  divider: { marginVertical: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
  // Same height as the lg buttons around it.
  appleButton: { width: "100%", height: 52 },
  appleBusy: { height: 52, borderRadius: 26, backgroundColor: "#000000", alignItems: "center", justifyContent: "center", overflow: "hidden" },
});

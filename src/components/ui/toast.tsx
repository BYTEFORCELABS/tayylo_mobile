// Quiet ink pill toasts — reassuring, never loud. Same call signature as
// the web's sonner usage: toast.success(msg, { action, duration }).

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertCircle, Info } from "lucide-react-native";
import { create } from "zustand";
import { colors, shadows } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { SuccessMark } from "@/components/brand/success-mark";
import { Text } from "./text";

type Kind = "success" | "error" | "info" | "plain";

interface ToastOptions {
  action?: { label: string; onClick: () => void };
  description?: string;
  /** ms; sonner's default is 4000. */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  kind: Kind;
  message: string;
}

const useToasts = create<{ items: ToastItem[] }>(() => ({ items: [] }));
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  useToasts.setState(s => ({ items: s.items.filter(t => t.id !== id) }));
}

function show(kind: Kind, message: string, opts: ToastOptions = {}) {
  const id = nextId++;
  // Keep at most three on screen, newest first.
  useToasts.setState(s => ({ items: [{ id, kind, message, ...opts }, ...s.items].slice(0, 3) }));
  timers.set(
    id,
    setTimeout(() => dismiss(id), opts.duration ?? 4000)
  );
  return id;
}

export const toast = Object.assign((message: string, opts?: ToastOptions) => show("plain", message, opts), {
  success: (message: string, opts?: ToastOptions) => show("success", message, opts),
  error: (message: string, opts?: ToastOptions) => show("error", message, opts),
  info: (message: string, opts?: ToastOptions) => show("info", message, opts),
  dismiss,
});

/** Renders the toast stack. Mounted once at the root and inside open sheets. */
export function ToastHost() {
  const items = useToasts(s => s.items);
  const insets = useSafeAreaInsets();
  if (items.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: Math.max(12, insets.top + 4) }]}>
      {items.map(t => (
        <Animated.View key={t.id} entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} layout={LinearTransition}>
          <Pressable onPress={() => dismiss(t.id)} accessibilityRole="alert" style={styles.toast}>
            {t.kind === "success" && <SuccessMark size={20} tone="light" animated={false} />}
            {t.kind === "error" && <AlertCircle size={18} strokeWidth={2} color="#F0B4A6" />}
            {t.kind === "info" && <Info size={18} strokeWidth={2} color={colors.textInverse} />}
            <View style={styles.copy}>
              <Text style={styles.title} color={colors.textInverse}>
                {t.message}
              </Text>
              {t.description ? (
                <Text variant="caption" color={colors.textInverse} style={{ opacity: 0.75 }}>
                  {t.description}
                </Text>
              ) : null}
            </View>
            {t.action ? (
              <Pressable
                onPress={() => {
                  dismiss(t.id);
                  t.action!.onClick();
                }}
                style={({ pressed }) => [styles.action, pressed && { backgroundColor: "rgba(255,255,255,0.25)" }]}
              >
                <Text size={12} weight="semibold" color={colors.textInverse}>
                  {t.action.label}
                </Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, zIndex: 1000, alignItems: "center", gap: 8 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    maxWidth: 384,
    borderRadius: 999,
    backgroundColor: colors.ink,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 20,
    boxShadow: shadows.float,
  },
  copy: { flexShrink: 1 },
  title: { fontSize: 14, lineHeight: 19, fontFamily: fonts.medium },
  action: { marginLeft: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6 },
});

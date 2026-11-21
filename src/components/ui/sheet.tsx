// Native bottom sheet — the phone form of both the web's BottomSheet (vaul
// drawer) and Dialog (which docks to the bottom edge on phones). Slides up
// over an ink scrim, drags down to dismiss, stays above the keyboard, and
// closes on the Android back button.

import * as React from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { GestureDetector, GestureHandlerRootView, usePanGesture } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { colors, radii, shadows } from "@/theme/tokens";
import { Text } from "./text";
import { PressableScale } from "./pressable";
import { ToastHost } from "./toast";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  /** Muted line under the title; a string or rich text (e.g. a bold amount). */
  description?: React.ReactNode;
  /** Sticky footer (primary action) that stays above the keyboard. */
  footer?: React.ReactNode;
  /** Shows the round × in the corner (Dialog style). */
  showClose?: boolean;
  /** Body padding; Dialog uses 24 all round, BottomSheet 24 sides. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Wrap children in a ScrollView (default). Disable for lists that scroll themselves. */
  scroll?: boolean;
  /** Fill most of the screen even when the content is short. */
  tall?: boolean;
  /** Prevent closing by drag / scrim / back while busy. */
  dismissible?: boolean;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  title,
  description,
  footer,
  showClose,
  contentStyle,
  scroll = true,
  tall,
  dismissible = true,
}: SheetProps) {
  const { height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = React.useState(open);
  const translate = useSharedValue(screenH);
  const scrim = useSharedValue(0);

  const finishClose = React.useCallback(() => setMounted(false), []);

  React.useEffect(() => {
    if (open) {
      setMounted(true);
      translate.value = screenH;
      scrim.value = withTiming(1, { duration: 200 });
      translate.value = withSpring(0, { damping: 32, stiffness: 320, mass: 0.9 });
    } else if (mounted) {
      Keyboard.dismiss();
      scrim.value = withTiming(0, { duration: 200 });
      translate.value = withTiming(screenH, { duration: 240, easing: Easing.bezier(0.2, 0.8, 0.2, 1) }, done => {
        if (done) scheduleOnRN(finishClose);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const requestClose = React.useCallback(() => {
    if (dismissible) onOpenChange(false);
  }, [dismissible, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [open, requestClose]);

  const pan = usePanGesture({
    enabled: dismissible,
    activeOffsetY: 8,
    onUpdate: e => {
      "worklet";
      translate.value = Math.max(0, e.translationY);
    },
    onDeactivate: e => {
      "worklet";
      if (e.translationY > 120 || e.velocityY > 900) scheduleOnRN(requestClose);
      else translate.value = withSpring(0, { damping: 30, stiffness: 320 });
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translate.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));

  if (!mounted) return null;

  const bottomPad = Math.max(16, insets.bottom);
  const body = (
    <View style={[styles.body, { paddingBottom: footer ? 24 : 24 + insets.bottom }, contentStyle]}>{children}</View>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
          <Pressable style={styles.fill} onPress={requestClose} accessibilityLabel="Close" />
        </Animated.View>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.end} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            style={[styles.sheet, { maxHeight: screenH - insets.top - 12 }, tall && { minHeight: screenH * 0.82 }, sheetStyle]}
          >
            <GestureDetector gesture={pan}>
              <View>
                <View style={styles.handleRow}>
                  <View style={styles.handle} />
                </View>
                {title ? (
                  <View style={[styles.header, showClose && { paddingRight: 64 }]}>
                    <Text accessibilityRole="header" size={20} weight="semibold" style={styles.title}>
                      {title}
                    </Text>
                    {description ? (
                      <Text variant="label" color={colors.textSecondary} style={{ marginTop: 4 }}>
                        {description}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </GestureDetector>

            {showClose && (
              <PressableScale scaleTo={0.9} onPress={requestClose} accessibilityLabel="Close" style={styles.close}>
                <X size={18} strokeWidth={1.75} color={colors.textTertiary} />
              </PressableScale>
            )}

            {scroll ? (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.flexShrink}>
                {body}
              </ScrollView>
            ) : (
              <View style={[styles.flexShrink, tall && styles.fill]}>{body}</View>
            )}

            {footer ? <View style={[styles.footer, { paddingBottom: bottomPad }]}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
        {/* Toasts raised while a sheet is open must render above it. */}
        <ToastHost />
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  end: { flex: 1, justifyContent: "flex-end" },
  scrim: { backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    boxShadow: shadows.sheet,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  handleRow: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  handle: { height: 4, width: 40, borderRadius: 999, backgroundColor: colors.borderStrong },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  title: { letterSpacing: -0.4, lineHeight: 24 },
  body: { paddingHorizontal: 24 },
  footer: { borderTopWidth: 1, borderTopColor: colors.divider, paddingHorizontal: 24, paddingTop: 16 },
  close: {
    position: "absolute",
    right: 16,
    top: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ------------------------------------------------------ web-named wrappers

/** The web's BottomSheet: handle, optional title/description, sticky footer. */
export function BottomSheet(props: Omit<SheetProps, "showClose">) {
  return <Sheet {...props} />;
}

/** The web's Dialog on phones: a bottom-docked card with a close button. */
export function Dialog(props: Omit<SheetProps, "showClose"> & { hideClose?: boolean }) {
  const { hideClose, ...rest } = props;
  return <Sheet {...rest} showClose={!hideClose} />;
}

/** Dialog actions: stacked full-width on phones, primary on top. */
export function DialogFooter({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = React.Children.toArray(children).filter(Boolean).reverse();
  return <View style={[{ marginTop: 24, gap: 10 }, style]}>{items}</View>;
}

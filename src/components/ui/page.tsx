// Page scaffolding shared by every in-app screen: a top bar that always
// says where you are, a scrolling body with the product's margins, and
// titled sections. Mirrors the web's src/components/ui/page.tsx.

import * as React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { ArrowLeft, ChevronRight, Compass } from "lucide-react-native";
import { alpha, colors, GUTTER, shadows } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { useSession } from "@/lib/auth/session";
import { PressableScale } from "./pressable";
import { Text } from "./text";

/** Space the floating tab bar needs under page content (web: `pb-nav`). */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return insets.bottom + 112;
}

/**
 * Back navigation used everywhere: returns to the previous screen when there
 * is one, otherwise goes to the given parent route (deep link / cold start).
 */
export function useBack() {
  return React.useCallback((fallback: string = "/today") => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback as never);
  }, []);
}

/** The single back button style for the whole product. */
export function BackButton({
  onPress,
  label = "Back",
  tone = "default",
  style,
}: {
  onPress: () => void;
  label?: string;
  /** `inverse` for use over photos / dark surfaces. */
  tone?: "default" | "inverse";
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      scaleTo={0.9}
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.back,
        tone === "default" ? { marginLeft: -8, backgroundColor: pressed ? alpha(colors.surfaceSunken, 0.7) : "transparent" } : styles.backInverse,
        style,
      ]}
    >
      <ArrowLeft size={22} strokeWidth={2} color={tone === "default" ? colors.ink : colors.white} />
    </PressableScale>
  );
}

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Small line above the title (compact headers show it on phones). */
  eyebrow?: React.ReactNode;
  /** Muted line under a large title (desktop only on the web, so hidden here too). */
  description?: React.ReactNode;
  /** Shows the back button; the string is the fallback route (`true` = Today). */
  back?: string | true;
  /** Custom back behaviour (multi-step flows). Takes precedence over `back`. */
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
  /** `large` for top-level tabs, `compact` for detail/task screens. */
  variant?: "large" | "compact";
  /** Extra rows pinned under the title (search, filters, progress). */
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  eyebrow,
  back,
  onBack,
  backLabel = "Back",
  actions,
  variant = "large",
  children,
  scrolled = false,
}: PageHeaderProps & { scrolled?: boolean }) {
  const insets = useSafeAreaInsets();
  const goBack = useBack();
  const pathname = usePathname();
  const role = useSession(s => s.me?.role);

  const backButton =
    onBack || back ? (
      <BackButton label={backLabel} onPress={() => (onBack ? onBack() : goBack(back === true ? "/today" : (back as string)))} />
    ) : null;

  const collapsed = variant === "large" && scrolled;
  // Tailors reach Explore from the top bar of the main tabs.
  const exploreLink =
    role === "tailor" && variant === "large" && !back && !onBack && !pathname.startsWith("/explore") ? (
      <PressableScale scaleTo={0.92} accessibilityLabel="Explore styles" onPress={() => router.push("/explore")} style={styles.explore}>
        <Compass size={20} strokeWidth={1.75} color={colors.ink} />
      </PressableScale>
    ) : null;

  return (
    <View
      style={[
        styles.header,
        { paddingTop: insets.top },
        scrolled || variant === "compact" ? { borderBottomColor: alpha(colors.border, 0.8) } : null,
        scrolled ? { boxShadow: shadows.headerScrolled } : null,
      ]}
    >
      <View style={styles.headerInner}>
        {variant === "compact" ? (
          <View style={styles.compactRow}>
            {backButton}
            <View style={{ flex: 1, minWidth: 0 }}>
              {eyebrow ? (
                <Text numberOfLines={1} variant="caption" color={colors.textTertiary}>
                  {eyebrow}
                </Text>
              ) : null}
              <Text accessibilityRole="header" numberOfLines={1} variant="headline">
                {title}
              </Text>
            </View>
            {actions ? <View style={styles.actions}>{actions}</View> : null}
          </View>
        ) : (
          <View style={[styles.largeRow, collapsed ? { paddingVertical: 12 } : { paddingTop: 16, paddingBottom: 12 }]}>
            <View style={styles.largeTitleWrap}>
              {backButton}
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={[
                  styles.largeTitle,
                  collapsed ? { fontSize: 19, lineHeight: 28, fontFamily: fonts.semibold } : { fontSize: 22, lineHeight: 32, fontFamily: fonts.medium },
                ]}
              >
                {title}
              </Text>
            </View>
            {actions || exploreLink ? (
              <View style={[styles.actions, { gap: 8 }]}>
                {exploreLink}
                {actions}
              </View>
            ) : null}
          </View>
        )}
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- Screen

const ScrollContext = React.createContext<(e: NativeSyntheticEvent<NativeScrollEvent>) => void>(() => {});

/** For screens that render their own FlatList: wire it to the header's collapse. */
export const useScreenScroll = () => React.useContext(ScrollContext);

interface ScreenProps {
  header?: PageHeaderProps;
  /** Fully custom top area instead of a PageHeader. */
  top?: React.ReactNode;
  children: React.ReactNode;
  /** false = children manage their own scrolling (FlatList / SectionList). */
  scroll?: boolean;
  /** Reserve space for the floating tab bar (main tabs). */
  tabBar?: boolean;
  /** Sticky bottom action area (task flows). */
  footer?: React.ReactNode;
  onRefresh?: () => Promise<unknown> | void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Content padding; defaults to the 16px gutter. */
  padded?: boolean;
  keyboardOffset?: number;
}

export function Screen({ header, top, children, scroll = true, tabBar, footer, onRefresh, contentStyle, padded = true, keyboardOffset = 0 }: ScreenProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const tabInset = useTabBarInset();
  const insets = useSafeAreaInsets();

  const onScroll = React.useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setScrolled(prev => (prev !== y > 8 ? y > 8 : prev));
  }, []);

  const refresh = onRefresh
    ? async () => {
        setRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      }
    : undefined;

  const bottomPad = tabBar ? tabInset : footer ? 24 : 32 + insets.bottom;

  return (
    <ScrollContext.Provider value={onScroll}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboardOffset}>
        {top ?? (header ? <PageHeader {...header} scrolled={scrolled} /> : null)}
        {scroll ? (
          <ScrollView
            style={styles.fill}
            onScroll={onScroll}
            scrollEventThrottle={32}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={[padded && styles.gutter, { paddingTop: padded ? 8 : 0, paddingBottom: bottomPad }, contentStyle]}
            refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.olive} colors={[colors.olive]} /> : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </ScrollContext.Provider>
  );
}

// ---------------------------------------------------------------- Section

interface SectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned link ("View all"). */
  action?: { label: string; onPress: () => void };
  trailing?: React.ReactNode;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  first?: boolean;
}

export function Section({ title, description, action, trailing, children, style, first }: SectionProps) {
  return (
    <View style={[{ marginTop: first ? 0 : 32 }, style]}>
      {title || action || trailing ? (
        <View style={styles.sectionHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {title ? (
              typeof title === "string" ? (
                <Text accessibilityRole="header" variant="headline">
                  {title}
                </Text>
              ) : (
                title
              )
            ) : null}
            {description ? (
              <Text variant="label" color={colors.textTertiary} style={{ marginTop: 2 }}>
                {description}
              </Text>
            ) : null}
          </View>
          {trailing}
          {action ? (
            <Pressable
              onPress={action.onPress}
              accessibilityRole="link"
              style={({ pressed }) => [styles.sectionAction, pressed && { backgroundColor: alpha(colors.oliveSoft, 0.6) }]}
            >
              <Text variant="label" weight="semibold" color={colors.olive}>
                {action.label}
              </Text>
              <ChevronRight size={16} strokeWidth={2} color={colors.olive} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Small uppercase label for groups (settings, form sections). */
export function Overline({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Text variant="overline" color={colors.textTertiary}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  gutter: { paddingHorizontal: GUTTER },
  header: {
    backgroundColor: "rgba(244,242,236,0.97)",
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    zIndex: 30,
  },
  headerInner: { paddingHorizontal: GUTTER },
  compactRow: { height: 64, flexDirection: "row", alignItems: "center", gap: 12 },
  largeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  largeTitleWrap: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 1, minWidth: 0 },
  largeTitle: { color: colors.ink, letterSpacing: -0.4, flexShrink: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  backInverse: { backgroundColor: "rgba(0,0,0,0.35)" },
  explore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.canvas,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
  },
  sectionHead: { marginBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginRight: -8 },
});

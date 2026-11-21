// Notifications sheet — same content and unread behaviour as the web's
// src/components/notifications-sheet.tsx. Read state lives in AsyncStorage,
// so the seen-set is loaded asynchronously.

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { AlertCircle, BellOff, CheckCircle2, Clock } from "lucide-react-native";
import { BottomSheet } from "@/components/ui/sheet";
import { IconTile } from "@/components/ui/list";
import { EmptyState } from "@/components/ui/states";
import { Text } from "@/components/ui/text";
import { alpha, colors, radii } from "@/theme/tokens";
import { type AppNotification, markSeen, readSeen } from "@/lib/notifications";

const kindIcon = {
  overdue: { icon: AlertCircle, tone: "danger" as const },
  "due-soon": { icon: Clock, tone: "warning" as const },
  ready: { icon: CheckCircle2, tone: "success" as const },
  balance: { icon: Clock, tone: "neutral" as const },
};

export function useUnreadCount(items: AppNotification[]) {
  // `version` bumps after the sheet marks items as seen, re-reading storage.
  const [version, setVersion] = React.useState(0);
  const [seen, setSeen] = React.useState<Set<string> | null>(null);

  React.useEffect(() => {
    let alive = true;
    readSeen().then(s => {
      if (alive) setSeen(s);
    });
    return () => {
      alive = false;
    };
  }, [items, version]);

  // Until storage has been read, nothing counts as unread (no badge flash).
  return {
    unread: seen ? items.filter(i => !seen.has(i.id)).length : 0,
    isUnread: (id: string) => (seen ? !seen.has(id) : false),
    refresh: () => setVersion(v => v + 1),
  };
}

interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AppNotification[];
  onSeen?: () => void;
}

export function NotificationsSheet({ open, onOpenChange, items, onSeen }: NotificationsSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Notifications"
      description="Deadlines, ready garments and overdue work across your orders."
    >
      <NotificationList key={open ? "open" : "closed"} open={open} items={items} onSeen={onSeen} onNavigate={() => onOpenChange(false)} />
    </BottomSheet>
  );
}

function NotificationList({
  open,
  items,
  onSeen,
  onNavigate,
}: {
  open: boolean;
  items: AppNotification[];
  onSeen?: () => void;
  onNavigate: () => void;
}) {
  // Snapshot unread state when the sheet opens, then mark all as seen —
  // so dots stay visible while reading but are gone next time.
  const [unreadAtOpen, setUnreadAtOpen] = React.useState<Set<string>>(() => new Set());
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const seen = await readSeen();
      if (alive) setUnreadAtOpen(new Set(items.filter(i => !seen.has(i.id)).map(i => i.id)));
      await markSeen(items.map(i => i.id));
      onSeen?.();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [open]);

  if (items.length === 0) {
    return (
      <EmptyState
        variant="inset"
        icon={BellOff}
        title="You're all caught up"
        description="Overdue orders, upcoming deadlines and garments ready for pickup will show up here."
      />
    );
  }

  return (
    <View accessibilityRole="list" style={styles.list}>
      {items.map(n => {
        const k = kindIcon[n.kind];
        const unread = unreadAtOpen.has(n.id);
        return (
          <Pressable
            key={n.id}
            accessibilityRole="link"
            onPress={() => {
              onNavigate();
              router.push(n.href as never);
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: alpha(colors.beigeLight, 0.7) }]}
          >
            <IconTile icon={k.icon} tone={k.tone} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size={15} weight={unread ? "semibold" : "medium"} style={{ lineHeight: 15 * 1.375 }}>
                {n.title}
              </Text>
              <Text variant="label" color={colors.textTertiary} style={{ marginTop: 2 }}>
                {n.detail}
              </Text>
            </View>
            {unread && <View accessibilityLabel="Unread" style={styles.dot} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: -8, gap: 4 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 14, borderRadius: radii.card, paddingHorizontal: 8, paddingVertical: 12 },
  dot: { marginTop: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.olive, flexShrink: 0 },
});

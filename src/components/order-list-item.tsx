// Order rows shared by Today, Orders and the client profile — same content
// and logic as the web's src/components/order-list-item.tsx.

import * as React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { Order } from "@/types";
import { colors, radii } from "@/theme/tokens";
import { GarmentIcon } from "@/components/brand/garment-icon";
import { Avatar } from "@/components/ui/avatar";
import { ListItem } from "@/components/ui/list";
import { StatusTag } from "@/components/ui/tag";
import { Text } from "@/components/ui/text";
import { daysUntil, dueLabel, formatDateShort, formatMoney } from "@/lib/format";
import { balanceMinor, displayStatus, garmentOf, isActive, isOverdue } from "@/lib/orders";
import { prefetchOrder } from "@/lib/api/query";
import { resolveImage } from "@/lib/static-images";

const openOrder = (id: string) => router.push(`/orders/${id}`);

/** Garment thumbnail: the order's own photo, otherwise a quiet icon tile. */
export function GarmentThumb({ order, size = "md" }: { order: Order; size?: "md" | "lg" }) {
  const img = order.items[0]?.imageUrl;
  const px = size === "md" ? 44 : 56;
  return (
    <View style={[styles.thumb, { width: px, height: px }]}>
      {img ? (
        <Image source={resolveImage(img)} style={{ width: px, height: px }} contentFit="cover" />
      ) : (
        <GarmentIcon garment={order.items[0]?.garmentType} size={size === "md" ? 28 : 34} label="" color="rgba(30,32,25,0.8)" />
      )}
    </View>
  );
}

interface OrderListItemProps {
  order: Order;
  /** Hide the client name (when already on that client's profile). */
  hideClient?: boolean;
}

function dueColor(order: Order) {
  const days = daysUntil(order.dueAt);
  return isOverdue(order) ? colors.danger : isActive(order) && days <= 3 ? colors.warning : colors.textTertiary;
}

/** One row per order inside a List — identical on Today, Orders and Client profile. */
export function OrderListItem({ order, hideClient }: OrderListItemProps) {
  const bal = balanceMinor(order);
  const active = isActive(order);

  return (
    <ListItem
      onPress={() => openOrder(order.id)}
      onPrefetch={() => prefetchOrder(order.id)}
      accessibilityLabel={`${garmentOf(order)} for ${order.customerName}, order ${order.number}`}
      leading={<GarmentThumb order={order} />}
      title={garmentOf(order)}
      subtitle={
        <View style={styles.subRow}>
          {hideClient ? (
            <Text tabular variant="label" color={colors.textTertiary}>
              #{order.number}
            </Text>
          ) : (
            <Text numberOfLines={1} variant="label" color={colors.textTertiary} style={{ flexShrink: 1 }}>
              {order.customerName}
            </Text>
          )}
          {bal > 0 && (
            <>
              <Text variant="label" color={colors.textTertiary}>
                ·
              </Text>
              <Text tabular variant="label" weight="semibold" color={colors.textSecondary} style={{ flexShrink: 0 }}>
                {formatMoney(bal, order.currency)} due
              </Text>
            </>
          )}
        </View>
      }
      trailing={<StatusTag status={displayStatus(order)} />}
      trailingSub={
        active ? (
          <Text variant="caption" weight="medium" color={dueColor(order)}>
            {dueLabel(order.dueAt)}
          </Text>
        ) : bal === 0 && order.priceMinor > 0 ? (
          "Paid"
        ) : undefined
      }
    />
  );
}

/**
 * Phone-first order row: photo with the order number on it, garment and
 * description, the client as a small chip, and price / status / due date
 * stacked on the right.
 */
export function OrderRow({ order, hideClient, clientPhoto }: OrderListItemProps & { clientPhoto?: string }) {
  const bal = balanceMinor(order);
  const active = isActive(order);
  const overdue = isOverdue(order);
  const days = daysUntil(order.dueAt);
  const img = order.items[0]?.imageUrl;
  const pieces = order.items.length;
  const description = order.items[0]?.styleNotes?.trim() || order.note?.trim() || `${pieces} ${pieces === 1 ? "piece" : "pieces"}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${garmentOf(order)} for ${order.customerName}, order ${order.number}`}
      onPress={() => openOrder(order.id)}
      onPressIn={() => prefetchOrder(order.id)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
    >
      <View style={styles.photo}>
        {img ? (
          <Image source={resolveImage(img)} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <GarmentIcon garment={order.items[0]?.garmentType} size={34} label="" color="rgba(30,32,25,0.8)" />
        )}
        <View style={styles.number}>
          <Text tabular numberOfLines={1} size={9} weight="semibold" align="center">
            #{order.number}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} size={16} weight="medium" style={{ lineHeight: 22 }}>
          {garmentOf(order)}
        </Text>
        <Text numberOfLines={1} size={13} color={colors.textSecondary} style={{ marginTop: 2 }}>
          {description}
        </Text>
        {!hideClient && (
          <View style={styles.client}>
            <Avatar name={order.customerName} src={clientPhoto} size="xs" shape="rounded" style={{ width: 20, height: 20 }} />
            <Text numberOfLines={1} size={13} color={colors.textSecondary} style={{ flexShrink: 1 }}>
              {order.customerName}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.right}>
        <Text tabular size={15} weight="semibold">
          {order.priceMinor > 0 ? formatMoney(order.priceMinor, order.currency) : "—"}
        </Text>
        <StatusTag status={displayStatus(order)} size="sm" />
        <Text tabular size={11.5} weight={active ? "medium" : "regular"} color={active ? dueColor(order) : colors.textTertiary}>
          {active
            ? overdue || days <= 7
              ? dueLabel(order.dueAt)
              : `Due ${formatDateShort(order.dueAt)}`
            : bal > 0
              ? `${formatMoney(bal, order.currency)} bal`
              : order.priceMinor > 0
                ? "Paid"
                : ""}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  thumb: { overflow: "hidden", borderRadius: radii.sm, backgroundColor: colors.surfaceSunken, alignItems: "center", justifyContent: "center" },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: radii.card, paddingHorizontal: 4, paddingVertical: 12 },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(227,224,214,0.6)",
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  number: { position: "absolute", left: 4, right: 4, bottom: 4, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.9)", paddingVertical: 1 },
  client: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  right: { flexShrink: 0, alignItems: "flex-end", gap: 6 },
});

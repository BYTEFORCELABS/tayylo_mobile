// Order detail — port of the web's src/app/(app)/orders/[id]/page.tsx (phone
// layout): fabric hero and photos, style references, live production tracker,
// payments with the agreed price (capped changes), invoice / receipt, garment
// and measurements, fittings, and deleting the order.

import * as React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type EntryExitAnimationFunction } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import {
  Check,
  ChevronRight,
  CreditCard,
  FileQuestion,
  FileText,
  Lock,
  Plus,
  ReceiptText,
  Ruler,
  Scissors,
  Trash2,
} from "lucide-react-native";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IconTile, List, ListItem } from "@/components/ui/list";
import { Screen, Section } from "@/components/ui/page";
import { BottomSheet, Dialog, DialogFooter } from "@/components/ui/sheet";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "@/components/ui/states";
import { StatusTag, Tag, statusColors } from "@/components/ui/tag";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { GarmentIcon } from "@/components/brand/garment-icon";
import { MeasurementIcon } from "@/components/brand/measurement-icon";
import { RecordPaymentDialog } from "@/components/payment-dialog";
import { orderRepo } from "@/lib/api/repos";
import { getQueryData, qk, setQueryData, useCustomer, useMeasurementSet, useOrder } from "@/lib/api/query";
import { useBusiness } from "@/lib/use-business";
import { currencySymbol, dueLabel, formatDate, formatMoney } from "@/lib/format";
import type { MaterialKind } from "@/lib/fabrics";
import {
  MAX_PRICE_CHANGES,
  ORDER_STATUSES,
  balanceMinor,
  displayStatus,
  isActive,
  isOverdue,
  normalizeStatus,
  paidMinor,
  statusLabel,
} from "@/lib/orders";
import { alpha, colors, hairline, radii } from "@/theme/tokens";
import type { Fitting, Order, OrderStatusName } from "@/types";
import { AddMaterialSheet, MaterialHero, MaterialStrip, MaterialViewer, StyleGallery, useOrderMaterials } from "./materials";
import { documentNumber, receiptAvailable } from "./order-document";
import { ProductionTracker } from "./production-tracker";
import { RecordFittingDialog } from "./fitting-dialog";

type OrderUpdater = Order | ((old: Order | null | undefined) => Order | null);

/** The header status pill drops in when the status changes (web: spring 420/30). */
const TAG_SPRING = { stiffness: 420, damping: 30, mass: 1 };
const tagEnter: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -14 }, { scale: 0.85 }] },
    animations: {
      opacity: withSpring(1, TAG_SPRING),
      transform: [{ translateY: withSpring(0, TAG_SPRING) }, { scale: withSpring(1, TAG_SPRING) }],
    },
  };
};
const tagExit: EntryExitAnimationFunction = () => {
  "worklet";
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: {
      opacity: withSpring(0, TAG_SPRING),
      transform: [{ translateY: withSpring(14, TAG_SPRING) }, { scale: withSpring(0.85, TAG_SPRING) }],
    },
  };
};

const BASE_HEADER = { variant: "compact" as const, title: "Order", back: "/orders", backLabel: "Back to orders" };

export function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const orderId = (Array.isArray(params.id) ? params.id[0] : params.id) ?? "";
  const { unit } = useBusiness();

  const orderQ = useOrder(orderId);
  // Until the full order arrives, show the copy already in the orders list
  // (everything except photos) so the screen opens instantly.
  const listCopy = React.useMemo(() => getQueryData<Order[]>(qk.orders)?.find(o => o.id === orderId), [orderId]);
  const order: Order | null = orderQ.data !== undefined ? orderQ.data : (listCopy ?? null);
  const orderRef = React.useRef(order);
  orderRef.current = order;
  const setOrder = React.useCallback(
    (u: OrderUpdater) =>
      setQueryData<Order | null>(qk.order(orderId), old => (typeof u === "function" ? u(old ?? orderRef.current) : u)),
    [orderId]
  );
  const status: "loading" | "ready" | "error" =
    order || orderQ.data === null ? "ready" : orderQ.status === "error" ? "error" : "loading";
  const customerQ = useCustomer(order?.customerId ?? null);
  const customer = customerQ.data ?? null;
  const measurementSet = useMeasurementSet(order?.items[0]?.measurementSetId || null).data ?? null;
  const [statusSheet, setStatusSheet] = React.useState(false);
  const [updatingStatus, setUpdatingStatus] = React.useState<OrderStatusName | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const [fittingOpen, setFittingOpen] = React.useState(false);
  const [addPhotoOpen, setAddPhotoOpen] = React.useState(false);
  const [addKind, setAddKind] = React.useState<MaterialKind>("Fabric");
  const [deletingFitting, setDeletingFitting] = React.useState<Fitting | null>(null);
  // Keeps the dialog's copy while it animates closed.
  const [shownFitting, setShownFitting] = React.useState<Fitting | null>(null);
  if (deletingFitting && deletingFitting !== shownFitting) setShownFitting(deletingFitting);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [priceOpen, setPriceOpen] = React.useState(false);
  const [priceSession, setPriceSession] = React.useState(0);
  const [deleteOrderOpen, setDeleteOrderOpen] = React.useState(false);
  const [deletingOrder, setDeletingOrder] = React.useState(false);
  const openAdd = (kind: MaterialKind) => {
    setAddKind(kind);
    setAddPhotoOpen(true);
  };
  const openPrice = () => {
    setPriceSession(s => s + 1);
    setPriceOpen(true);
  };
  const [viewerIndex, setViewerIndex] = React.useState<number | null>(null);

  const refreshOrder = async () => {
    await orderQ.refetch();
  };

  // Optimistic: the tracker animates immediately; rolls back if saving fails.
  const changeStatus = async (next: OrderStatusName) => {
    if (!order || next === order.statusName) {
      setStatusSheet(false);
      return;
    }
    const previous = order.statusName;
    const patchList = (statusName: OrderStatusName) => {
      if (getQueryData<Order[]>(qk.orders))
        setQueryData<Order[]>(qk.orders, list => (list ?? []).map(o => (o.id === order.id ? { ...o, statusName } : o)));
    };
    setOrder({ ...order, statusName: next });
    patchList(next);
    setStatusSheet(false);
    setUpdatingStatus(next);
    try {
      await orderRepo.updateStatus(order.id, next);
      toast.success(`Moved to ${statusLabel(next).toLowerCase()}`);
    } catch {
      setOrder(o => (o ? { ...o, statusName: previous } : (o ?? null)));
      patchList(previous);
      toast.error("Couldn't update the status — it's been put back");
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (status === "loading") {
    return (
      <Screen header={BASE_HEADER}>
        <LoadingRegion label="Loading order">
          <Skeleton width="60%" height={28} style={{ marginTop: 8 }} />
          <Skeleton width="40%" height={16} style={{ marginTop: 12 }} />
          <Skeleton variant="rectangular" height={88} style={{ marginTop: 24 }} />
          <Skeleton variant="rectangular" height={180} style={{ marginTop: 24 }} />
        </LoadingRegion>
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen header={BASE_HEADER} onRefresh={refreshOrder}>
        <ErrorState title="Couldn't load this order" onRetry={() => orderQ.refetch()} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen header={BASE_HEADER} onRefresh={refreshOrder}>
        <EmptyState
          icon={FileQuestion}
          title="Order not found"
          description="It may have been removed, or the link is incorrect."
          action={<Button onPress={() => router.push("/orders")}>Back to orders</Button>}
        />
      </Screen>
    );
  }

  const paid = paidMinor(order);
  const balance = balanceMinor(order);
  const paidPct = order.priceMinor > 0 ? Math.min(100, Math.round((paid / order.priceMinor) * 100)) : 0;
  const overdue = isOverdue(order);
  const priceChangesLeft = Math.max(0, MAX_PRICE_CHANGES - (order.priceChangeCount ?? 0));
  const priceLocked = order.priceMinor > 0 && priceChangesLeft === 0;
  const firstPrice = order.priceMinor <= 0;

  const deleteOrder = async () => {
    setDeletingOrder(true);
    try {
      await orderRepo.delete(order.id);
      if (getQueryData<Order[]>(qk.orders)) setQueryData<Order[]>(qk.orders, list => (list ?? []).filter(o => o.id !== order.id));
      toast.success(`Order #${order.number} deleted`);
      setDeleteOrderOpen(false);
      router.replace("/orders");
    } catch {
      toast.error("Couldn't delete this order");
      setDeletingOrder(false);
    }
  };

  const deleteFitting = async () => {
    if (!deletingFitting) return;
    const target = deletingFitting;
    setDeleteBusy(true);
    try {
      await orderRepo.deleteFitting(order.id, target.id);
      setOrder(o =>
        o
          ? {
              ...o,
              fittings: o.fittings.filter(x => x.id !== target.id).map(x => (x.number > target.number ? { ...x, number: x.number - 1 } : x)),
            }
          : (o ?? null)
      );
      toast.success(`Fitting ${target.number} deleted`);
      setDeletingFitting(null);
      refreshOrder();
    } catch {
      toast.error("Couldn't delete this fitting");
    } finally {
      setDeleteBusy(false);
    }
  };

  const fieldOptions = measurementSet?.values.map(v => ({ key: v.fieldKey, label: v.labelSnapshot }));
  const openClient = () => router.push(`/clients/${order.customerId}`);

  return (
    <>
      <Screen
        onRefresh={() => Promise.all([orderQ.refetch(), customerQ.refetch()])}
        header={{
          variant: "compact",
          eyebrow: order.customerName,
          title: `Order #${order.number}`,
          back: "/orders",
          backLabel: "Back to orders",
          actions: (
            <Animated.View key={displayStatus(order)} entering={tagEnter} exiting={tagExit}>
              <StatusTag status={displayStatus(order)} />
            </Animated.View>
          ),
        }}
      >
        {/* Fabric hero — recognise the job, material and client at a glance */}
        <View style={{ paddingTop: 8 }}>
          <MaterialHero
            order={order}
            clientPhoto={customer?.photoUrl}
            subtitle={isActive(order) ? dueLabel(order.dueAt) : `Due ${formatDate(order.dueAt)}`}
            subtitleTone={overdue ? "danger" : "default"}
            onAdd={() => openAdd("Fabric")}
            onOpen={setViewerIndex}
          />
          <MaterialStrip order={order} onAdd={() => openAdd("Fabric")} onAddStyle={() => openAdd("Style")} onOpen={setViewerIndex} />
        </View>

        {/* Style references — the look the client asked for (added from the photo strip) */}
        {(order.media ?? []).some(m => m.caption?.startsWith("Style")) && (
          <Section
            title="Style"
            trailing={
              <Button variant="secondary" size="sm" icon={Plus} onPress={() => openAdd("Style")}>
                Add style
              </Button>
            }
          >
            <StyleGallery order={order} onAdd={() => openAdd("Style")} onOpen={setViewerIndex} />
          </Section>
        )}

        {/* Production */}
        <View style={{ marginTop: 24 }}>
          <ProductionTracker status={order.statusName} onChange={changeStatus} onOpenAll={() => setStatusSheet(true)} updating={!!updatingStatus} />
        </View>

        {/* Payments */}
        <Section
          title="Payments"
          trailing={
            <Button variant="secondary" size="sm" icon={CreditCard} onPress={() => setPayOpen(true)}>
              Record payment
            </Button>
          }
        >
          <Card padding="none">
            <View style={styles.payTop}>
              <View style={styles.payRow}>
                <View style={{ flexShrink: 1 }}>
                  <Text variant="caption" color={colors.textTertiary}>
                    {balance > 0 ? "Balance due" : "Status"}
                  </Text>
                  <Text tabular size={28} weight="semibold" color={balance > 0 ? colors.ink : colors.success} style={styles.balance}>
                    {balance > 0 ? formatMoney(balance, order.currency) : order.priceMinor > 0 ? "Paid in full" : "No price set"}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text variant="caption" color={colors.textTertiary}>
                    Agreed price
                  </Text>
                  <Text tabular size={15} weight="semibold" style={{ marginTop: 4 }}>
                    {formatMoney(order.priceMinor, order.currency)}
                  </Text>
                  {priceLocked ? (
                    <View style={styles.locked} accessibilityLabel={`Price locked — changed ${MAX_PRICE_CHANGES} times`}>
                      <Lock size={12} strokeWidth={2} color={colors.textTertiary} />
                      <Text variant="caption" color={colors.textTertiary}>
                        Locked
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={openPrice}
                      accessibilityRole="button"
                      hitSlop={8}
                      style={({ pressed }) => [styles.priceLink, pressed && { backgroundColor: alpha(colors.oliveSoft, 0.6) }]}
                    >
                      <Text variant="caption" weight="semibold" color={colors.olive}>
                        {order.priceMinor > 0 ? "Change" : "Set price"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
              {order.priceMinor > 0 && (
                <View style={{ marginTop: 16 }}>
                  <PaidBar pct={paidPct} />
                  <Text tabular variant="caption" color={colors.textTertiary} style={{ marginTop: 8 }}>
                    {formatMoney(paid, order.currency)} paid · {paidPct}%
                  </Text>
                </View>
              )}
            </View>
            {order.payments.length > 0 && (
              <View style={styles.payments}>
                {[...order.payments]
                  .sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt))
                  .map((p, i) => (
                    <View key={p.id} style={[styles.payment, i > 0 && styles.rowDivider]}>
                      <IconTile tone="success" size="sm" icon={Check} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text size={15} weight="medium">
                          {p.method}
                        </Text>
                        <Text numberOfLines={1} variant="caption" color={colors.textTertiary}>
                          {formatDate(p.paidAt)}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </Text>
                      </View>
                      <Text tabular size={15} weight="semibold">
                        {formatMoney(p.amountMinor, order.currency)}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </Card>
        </Section>

        {/* Invoice & receipt */}
        <Section title="Documents">
          <List>
            <ListItem
              onPress={() => router.push(`/orders/${order.id}/invoice`)}
              leading={<IconTile tone="olive" icon={FileText} />}
              title={`Invoice ${documentNumber("invoice", order)}`}
              subtitle={
                order.priceMinor > 0
                  ? balance > 0
                    ? `${formatMoney(balance, order.currency)} due · ready to print or share`
                    : "Fully paid · ready to print or share"
                  : "Set a price to show amounts"
              }
              chevron
            />
            {receiptAvailable(order) ? (
              <ListItem
                onPress={() => router.push(`/orders/${order.id}/receipt`)}
                leading={<IconTile tone="success" icon={ReceiptText} />}
                title={`Receipt ${documentNumber("receipt", order)}`}
                subtitle={`Paid in full · ${formatMoney(order.priceMinor, order.currency)}`}
                chevron
              />
            ) : (
              <ListItem
                leading={<IconTile icon={Lock} />}
                title={
                  <Text numberOfLines={1} size={15} weight="semibold" color={colors.textSecondary}>
                    Receipt
                  </Text>
                }
                subtitle={
                  <Text variant="label" color={colors.textTertiary}>
                    {order.priceMinor > 0
                      ? `Generated automatically once the remaining ${formatMoney(balance, order.currency)} is paid`
                      : "Generated once a price is set and paid"}
                  </Text>
                }
              />
            )}
          </List>
        </Section>

        {/* Garment details */}
        <Section title="Garment">
          <List>
            <ListItem
              onPress={openClient}
              leading={<Avatar name={order.customerName} src={customer?.photoUrl} />}
              title={order.customerName}
              subtitle={customer?.phones[0] ?? "View client"}
              chevron
            />
            {order.items.map(item => (
              <ListItem
                key={item.id}
                leading={
                  <View style={styles.garmentTile}>
                    <GarmentIcon garment={item.garmentType} size={26} label="" color={colors.ink} />
                  </View>
                }
                title={item.garmentType}
                subtitle={item.styleNotes || "No style notes"}
              />
            ))}
            <ListItem
              onPress={openClient}
              leading={<IconTile tone="olive" icon={Ruler} />}
              title={measurementSet ? `${measurementSet.templateName} measurements` : "Measurements"}
              subtitle={
                measurementSet
                  ? `Taken ${formatDate(measurementSet.takenAt)} · ${measurementSet.values.length} values`
                  : "No measurement set linked — view the client's measurements"
              }
              chevron
            />
          </List>
          {order.note ? (
            <View style={styles.note}>
              <Text variant="caption" weight="semibold" color={colors.textTertiary}>
                Order note
              </Text>
              <Text variant="label" color={colors.textSecondary} style={{ marginTop: 4 }}>
                {order.note}
              </Text>
            </View>
          ) : null}
        </Section>

        {/* Fittings */}
        <Section
          title="Fittings"
          trailing={
            order.fittings.length > 0 ? (
              <Button variant="secondary" size="sm" icon={Plus} onPress={() => setFittingOpen(true)}>
                Record fitting
              </Button>
            ) : undefined
          }
        >
          {order.fittings.length === 0 ? (
            <EmptyState
              variant="inset"
              icon={Scissors}
              title="No fittings yet"
              description="Log each fitting with its outcome and any adjustments."
              action={
                <Button variant="secondary" icon={Plus} onPress={() => setFittingOpen(true)}>
                  Record fitting 1
                </Button>
              }
            />
          ) : (
            <View style={styles.fittings}>
              {[...order.fittings]
                .sort((a, b) => b.number - a.number)
                .map((f, i) => {
                  const approved = f.outcome === "approved";
                  return (
                    <View key={f.id} style={[styles.fitting, i > 0 && styles.rowDivider]}>
                      <IconTile tone={approved ? "success" : "warning"} icon={approved ? Check : Scissors} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={styles.fittingHead}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.fittingTitle}>
                              <Text size={16} weight="semibold">
                                Fitting {f.number}
                              </Text>
                              <Tag size="sm" variant={approved ? "success" : "warning"}>
                                {approved ? "Approved" : f.outcome === "skipped" ? "Skipped" : "Adjustments"}
                              </Tag>
                            </View>
                            <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 2 }}>
                              {formatDate(f.fittedAt)}
                            </Text>
                          </View>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            icon={Trash2}
                            color={colors.textTertiary}
                            accessibilityLabel={`Delete fitting ${f.number}`}
                            onPress={() => setDeletingFitting(f)}
                            style={{ marginRight: -8, marginTop: -4 }}
                          />
                        </View>

                        {f.adjustments.length > 0 && (
                          <View style={styles.adjustments}>
                            {f.adjustments.map(a => (
                              <Tag key={a.fieldKey} size="sm" variant="beige" style={{ gap: 4 }}>
                                <MeasurementIcon fieldKey={a.fieldKey} label={a.label} size={16} />
                                <Text tabular size={11} weight="semibold" color={colors.textSecondary}>
                                  {a.label} {a.rawDelta}
                                </Text>
                              </Tag>
                            ))}
                          </View>
                        )}
                        {f.notes ? (
                          <View style={styles.fittingNote}>
                            <Text variant="label" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                              {f.notes}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
            </View>
          )}
        </Section>

        <Section title="Manage">
          <List>
            <ListItem
              onPress={() => setDeleteOrderOpen(true)}
              leading={<IconTile tone="danger" icon={Trash2} />}
              title="Delete order"
              subtitle="Removes this order, its payments, fittings and photos"
              tone="danger"
            />
          </List>
        </Section>

        <View style={{ marginTop: 40, alignItems: "center" }}>
          <Pressable onPress={openClient} accessibilityRole="link" hitSlop={8} style={styles.allOrders}>
            <Text variant="caption" weight="semibold" color={colors.olive}>
              All orders for {order.customerName.split(" ")[0]}
            </Text>
            <ChevronRight size={14} strokeWidth={1.75} color={colors.olive} />
          </Pressable>
        </View>
      </Screen>

      {/* Status sheet */}
      <BottomSheet open={statusSheet} onOpenChange={setStatusSheet} title="Order status" description={`Currently ${statusLabel(order.statusName).toLowerCase()}`}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Order status" style={{ marginHorizontal: -8, gap: 4 }}>
          {ORDER_STATUSES.map(s => {
            const selected = normalizeStatus(order.statusName) === s.key;
            const tone = statusColors(s.key);
            return (
              <Pressable
                key={s.key}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: !!updatingStatus }}
                onPress={() => changeStatus(s.key)}
                disabled={!!updatingStatus}
                style={({ pressed }) => [
                  styles.statusRow,
                  selected ? { backgroundColor: colors.surfaceSunken } : pressed ? { backgroundColor: alpha(colors.beigeLight, 0.7) } : null,
                ]}
              >
                <View style={styles.statusLabel}>
                  <View style={[styles.statusDot, { backgroundColor: tone.dot }]} />
                  <Text size={15} weight="semibold" color={tone.text}>
                    {statusLabel(s.key)}
                  </Text>
                </View>
                {updatingStatus === s.key ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : selected ? (
                  <Check size={18} strokeWidth={2} color={colors.ink} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      <Dialog
        open={!!deletingFitting}
        onOpenChange={o => !o && !deleteBusy && setDeletingFitting(null)}
        dismissible={!deleteBusy}
        title={`Delete fitting ${shownFitting?.number ?? ""}?`}
        description="Its outcome, notes and adjustments will be removed. Later fittings are renumbered. This can't be undone."
      >
        <DialogFooter style={{ marginTop: 0 }}>
          <Button variant="secondary" onPress={() => setDeletingFitting(null)} disabled={deleteBusy}>
            Keep
          </Button>
          <Button variant="destructive-filled" icon={Trash2} loading={deleteBusy} onPress={deleteFitting}>
            Delete fitting
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteOrderOpen} onOpenChange={o => !deletingOrder && setDeleteOrderOpen(o)} dismissible={!deletingOrder}>
        <View style={{ paddingTop: 12 }}>
          <View style={styles.dangerBadge}>
            <Trash2 size={22} strokeWidth={1.75} color={colors.danger} />
          </View>
          <Text accessibilityRole="header" size={20} weight="semibold" style={{ letterSpacing: -0.4, lineHeight: 24 }}>
            Delete order #{order.number}?
          </Text>
          <Text variant="label" color={colors.textSecondary} style={{ marginTop: 4 }}>
            {order.customerName}&apos;s {order.items[0]?.garmentType ?? "order"}
            {order.payments.length > 0 ? `, its ${order.payments.length} recorded payment${order.payments.length > 1 ? "s" : ""}` : ""}, fittings,
            photos, invoice and receipt will be permanently deleted. This can&apos;t be undone.
          </Text>
        </View>
        <DialogFooter>
          <Button variant="secondary" onPress={() => setDeleteOrderOpen(false)} disabled={deletingOrder}>
            Keep order
          </Button>
          <Button variant="destructive-filled" icon={Trash2} loading={deletingOrder} onPress={deleteOrder}>
            Delete order
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={priceOpen}
        onOpenChange={setPriceOpen}
        title={firstPrice ? "Set agreed price" : "Change agreed price"}
        description={
          firstPrice
            ? `Once set, the price can be changed ${MAX_PRICE_CHANGES} times so your client's bill stays dependable.`
            : `You can change the agreed price ${priceChangesLeft} more time${priceChangesLeft === 1 ? "" : "s"}. After that it's locked.`
        }
      >
        <PriceForm
          key={priceSession}
          order={order}
          paidMinor={paid}
          changesLeft={priceChangesLeft}
          onDone={updated => {
            if (updated) setOrder(updated);
            setPriceOpen(false);
          }}
        />
      </Dialog>

      <OrderMaterials
        order={order}
        onOrder={setOrder}
        addKind={addKind}
        addOpen={addPhotoOpen}
        onAddOpenChange={setAddPhotoOpen}
        viewerIndex={viewerIndex}
        onViewerIndex={setViewerIndex}
      />
      <RecordPaymentDialog order={payOpen ? order : null} onOpenChange={setPayOpen} onRecorded={refreshOrder} />
      <RecordFittingDialog
        open={fittingOpen}
        onOpenChange={setFittingOpen}
        orderId={order.id}
        fittingNumber={order.fittings.length + 1}
        unit={unit}
        fieldOptions={fieldOptions}
        onRecorded={refreshOrder}
      />
    </>
  );
}

/** Amount-paid progress; the fill eases to its new width (web: duration-slow). */
function PaidBar({ pct }: { pct: number }) {
  const width = useSharedValue(pct);
  React.useEffect(() => {
    width.value = withTiming(pct, { duration: 320 });
  }, [pct, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Amount paid"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={styles.bar}
    >
      <Animated.View style={[styles.barFill, fill]} />
    </View>
  );
}

/** Add sheet + viewer, sharing one set of photo operations. */
function OrderMaterials({
  order,
  onOrder,
  addKind,
  addOpen,
  onAddOpenChange,
  viewerIndex,
  onViewerIndex,
}: {
  order: Order;
  onOrder: (o: Order) => void;
  addKind: MaterialKind;
  addOpen: boolean;
  onAddOpenChange: (o: boolean) => void;
  viewerIndex: number | null;
  onViewerIndex: (i: number | null) => void;
}) {
  const { busy, add, remove, makeCover } = useOrderMaterials(order, onOrder);
  return (
    <>
      <AddMaterialSheet open={addOpen} onOpenChange={onAddOpenChange} onPick={add} busy={busy} initialKind={addKind} />
      <MaterialViewer order={order} index={viewerIndex} onIndex={onViewerIndex} onRemove={remove} onCover={makeCover} busy={busy} />
    </>
  );
}

/** Set or change the agreed price. Changes after the first price are capped. */
function PriceForm({
  order,
  paidMinor: paid,
  changesLeft,
  onDone,
}: {
  order: Order;
  paidMinor: number;
  changesLeft: number;
  onDone: (updated: Order | null) => void;
}) {
  const firstPrice = order.priceMinor <= 0;
  const [value, setValue] = React.useState(firstPrice ? "" : String(order.priceMinor / 100));
  const [error, setError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const priceMinor = Math.round((parseFloat(value.replace(/,/g, "")) || 0) * 100);

  const save = async () => {
    if (priceMinor <= 0) return setError("Enter the agreed price");
    if (priceMinor < paid) return setError(`It can't be less than the ${formatMoney(paid, order.currency)} already paid`);
    if (priceMinor === order.priceMinor) return onDone(null);
    // A real change uses up one of the limited edits — ask once more.
    if (!firstPrice && !confirming) return setConfirming(true);
    setSaving(true);
    try {
      const updated = await orderRepo.updatePrice(order.id, priceMinor);
      toast.success(firstPrice ? "Price set" : "Agreed price updated");
      onDone(updated);
    } catch (e) {
      setError((e as Error).message || "Couldn't update the price");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const leftAfter = changesLeft - 1;

  return (
    <View style={{ gap: 16 }}>
      <Input
        label={`Agreed price (${currencySymbol(order.currency)})`}
        keyboardType="decimal-pad"
        autoFocus
        value={value}
        onChangeText={t => {
          setValue(t);
          setError(undefined);
          setConfirming(false);
        }}
        placeholder="0"
        error={error}
        hint={paid > 0 ? `${formatMoney(paid, order.currency)} paid so far` : undefined}
      />
      {confirming && (
        <View style={styles.confirm}>
          <Text variant="label" color={colors.warning}>
            {formatMoney(order.priceMinor, order.currency)} → {formatMoney(priceMinor, order.currency)}.{" "}
            {leftAfter > 0 ? `You'll have ${leftAfter} change left after this.` : "This is the last change — the price will be locked."}
          </Text>
        </View>
      )}
      <DialogFooter style={{ marginTop: 8 }}>
        <Button variant="secondary" onPress={() => onDone(null)} disabled={saving}>
          Cancel
        </Button>
        <Button onPress={save} loading={saving}>
          {confirming ? "Yes, change price" : firstPrice ? "Set price" : "Save"}
        </Button>
      </DialogFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  payTop: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  payRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16 },
  balance: { marginTop: 4, lineHeight: 30, letterSpacing: -0.6 },
  locked: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 4 },
  priceLink: { marginTop: 2, marginRight: -4, borderRadius: 999, paddingHorizontal: 4 },
  bar: { height: 6, overflow: "hidden", borderRadius: 999, backgroundColor: colors.surfaceSunken },
  barFill: { height: "100%", borderRadius: 999, backgroundColor: colors.olive },
  payments: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.divider },
  payment: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.divider },
  garmentTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { marginTop: 12, borderRadius: radii.card, backgroundColor: alpha(colors.surfaceSunken, 0.6), paddingHorizontal: 16, paddingVertical: 12 },
  fittings: { overflow: "hidden", borderRadius: radii.card, borderWidth: 1, borderColor: hairline, backgroundColor: colors.surface },
  fitting: { flexDirection: "row", gap: 14, paddingHorizontal: 16, paddingVertical: 16 },
  fittingHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  fittingTitle: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8, rowGap: 4 },
  adjustments: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  fittingNote: { marginTop: 12, borderRadius: radii.control, backgroundColor: alpha(colors.surfaceSunken, 0.6), paddingHorizontal: 12, paddingVertical: 10 },
  allOrders: { flexDirection: "row", alignItems: "center", gap: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radii.card, paddingHorizontal: 12, paddingVertical: 12 },
  statusLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dangerBadge: {
    marginBottom: 8,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dangerBg,
    alignItems: "center",
    justifyContent: "center",
  },
  confirm: { borderRadius: radii.control, backgroundColor: colors.warningBg, paddingHorizontal: 12, paddingVertical: 10 },
});

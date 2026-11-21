// Client profile: identity, key facts, quick actions and the
// measurements / orders / fittings / notes / photos tabs.
// Mirrors the web's src/app/(app)/clients/[id]/page.tsx (phone layout).

import * as React from "react";
import { Linking, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ClipboardList, MessageCircle, Pencil, Phone, Ruler, Scissors, UserX } from "lucide-react-native";
import type { Customer, MeasurementSet } from "@/types";
import { OrderListItem } from "@/components/order-list-item";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { List } from "@/components/ui/list";
import { Screen, useBack } from "@/components/ui/page";
import { EmptyState, ErrorState, ListSkeleton, LoadingRegion, MeasurementGridSkeleton, Skeleton } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { customerRepo } from "@/lib/api/repos";
import { getQueryData, qk, setQueryData, useCustomer, useMeasurements, useOrdersByCustomer, useTemplates } from "@/lib/api/query";
import { useBusiness } from "@/lib/use-business";
import { formatDate, formatMoney } from "@/lib/format";
import { balanceMinor, garmentOf, normalizeStatus } from "@/lib/orders";
import { alpha, colors, radii } from "@/theme/tokens";
import { MeasurementsTab } from "./measurements-tab";
import { PhotosTab } from "./photos-tab";
import { ShareMeasurementsDialog, whatsappLink } from "./share-dialog";

type Tab = "measurements" | "orders" | "fittings" | "notes" | "photos";

const BACK = "/clients";
const BACK_LABEL = "Back to clients";

export function ClientDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const clientId = String(params.id ?? "");
  const { business, unit, currency } = useBusiness();
  const goBack = useBack();

  const clientQ = useCustomer(clientId);
  const measurementsQ = useMeasurements(clientId);
  const ordersQ = useOrdersByCustomer(clientId);
  const templatesQ = useTemplates();
  // Render the client straight away from the cached client list (no photos
  // yet); measurements, orders and photos fill in as they arrive.
  const listCopy = React.useMemo(() => getQueryData<Customer[]>(qk.customers)?.find(c => c.id === clientId), [clientId]);
  const client: Customer | null = clientQ.data !== undefined ? clientQ.data : (listCopy ?? null);
  const status: "loading" | "ready" | "error" =
    client || clientQ.data === null ? "ready" : clientQ.isError ? "error" : "loading";
  const queries = [clientQ, measurementsQ, ordersQ, templatesQ];
  const measurementsLoading = measurementsQ.data === undefined;
  const ordersLoading = ordersQ.data === undefined;
  const measurements = measurementsQ.data ?? [];
  const orders = ordersQ.data ?? [];
  const templates = templatesQ.data ?? [];
  const setClient = (c: Customer) => setQueryData<Customer | null>(qk.customer(clientId), c);
  const setMeasurements = (sets: MeasurementSet[]) => setQueryData<MeasurementSet[]>(qk.measurements(clientId), sets);

  const [tab, setTab] = React.useState<Tab>("measurements");
  const [shareOpen, setShareOpen] = React.useState(false);
  // Unsaved edits to the notes; null means "showing what's saved".
  const [notesDraft, setNotesDraft] = React.useState<string | null>(null);
  const notes = notesDraft ?? client?.notes ?? "";
  const [savingNotes, setSavingNotes] = React.useState(false);

  const refresh = () => Promise.all(queries.map(q => q.refetch()));

  if (status === "loading") {
    return (
      <Screen header={{ variant: "compact", title: "", back: BACK, backLabel: BACK_LABEL }}>
        <LoadingRegion label="Loading client">
          <View style={[styles.identity, { paddingVertical: 8 }]}>
            <Skeleton variant="circular" width={80} height={80} />
            <View style={{ flex: 1, gap: 10 }}>
              <Skeleton width="55%" height={22} />
              <Skeleton width="35%" height={14} />
            </View>
          </View>
          <Skeleton style={{ marginTop: 24 }} width="100%" height={44} />
          <View style={{ marginTop: 24 }}>
            <MeasurementGridSkeleton />
          </View>
        </LoadingRegion>
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen header={{ variant: "compact", title: "Client", back: BACK, backLabel: BACK_LABEL }}>
        <ErrorState title="Couldn't load this client" onRetry={() => queries.forEach(q => q.isError && q.refetch())} />
      </Screen>
    );
  }

  if (!client) {
    return (
      <Screen header={{ variant: "compact", title: "Client", back: BACK, backLabel: BACK_LABEL }}>
        <EmptyState
          icon={UserX}
          title="Client not found"
          description="They may have been removed, or the link is incorrect."
          action={<Button onPress={() => goBack(BACK)}>Back to clients</Button>}
        />
      </Screen>
    );
  }

  const phone = client.phones[0];
  const current = measurements[0];
  const fittings = orders
    .flatMap(o => o.fittings.map(f => ({ ...f, order: o })))
    .sort((a, b) => +new Date(b.fittedAt) - +new Date(a.fittedAt));
  const totalOwed = orders.filter(o => normalizeStatus(o.statusName) !== "cancelled").reduce((s, o) => s + balanceMinor(o), 0);
  const notesDirty = notes.trim() !== (client.notes ?? "").trim();

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await customerRepo.update(client.id, { notes: notes.trim() });
      setClient({ ...client, notes: notes.trim() });
      setNotesDraft(null);
      toast.success("Notes saved");
    } catch {
      toast.error("Couldn't save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <Screen
      onRefresh={refresh}
      header={{
        variant: "compact",
        title: client.fullName,
        back: BACK,
        backLabel: BACK_LABEL,
        actions: (
          <Button
            variant="secondary"
            size="icon"
            icon={Pencil}
            accessibilityLabel="Edit client"
            onPress={() => router.push(`/clients/${client.id}/edit`)}
          />
        ),
      }}
    >
      {/* Identity */}
      <View style={[styles.identity, { paddingTop: 8 }]}>
        <Avatar name={client.fullName} src={client.photoUrl} size="xl" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="title">{client.fullName}</Text>
          <Text variant="label" color={colors.textTertiary} style={{ marginTop: 4 }}>
            {phone || client.email || "No contact details"} · Client since {formatDate(client.createdAt)}
          </Text>
          {client.tags.length > 0 && (
            <View style={styles.tags}>
              {client.tags.map(t => (
                <Tag key={t} size="sm" variant="olive">
                  {t}
                </Tag>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Key facts */}
      <View style={styles.facts}>
        <Fact
          label="Last measured"
          value={
            current
              ? formatDate(current.takenAt, { year: false })
              : client.lastMeasuredAt
                ? formatDate(client.lastMeasuredAt, { year: false })
                : measurementsLoading
                  ? "…"
                  : "—"
          }
        />
        <Fact divider label="Orders" value={ordersLoading ? "…" : String(orders.length)} />
        <Fact
          divider
          label="Balance"
          value={ordersLoading ? "…" : totalOwed > 0 ? formatMoney(totalOwed, currency) : "Paid up"}
          emphasis={!ordersLoading && totalOwed > 0}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button icon={Ruler} onPress={() => router.push(`/measure?clientId=${client.id}`)} style={styles.actionBtn}>
          Measure
        </Button>
        <Button variant="secondary" icon={ClipboardList} onPress={() => router.push(`/orders/new?clientId=${client.id}`)} style={styles.actionBtn}>
          New order
        </Button>
        {phone ? (
          <>
            <Button variant="secondary" size="icon" icon={Phone} accessibilityLabel={`Call ${client.fullName}`} onPress={() => open(`tel:${phone}`)} />
            <Button
              variant="secondary"
              size="icon"
              icon={MessageCircle}
              accessibilityLabel={`WhatsApp ${client.fullName}`}
              onPress={() => open(whatsappLink(phone, `Hello ${client.fullName.split(" ")[0]},`))}
            />
          </>
        ) : null}
      </View>

      <Tabs
        style={{ marginTop: 32 }}
        accessibilityLabel="Client sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: "measurements", label: "Measurements", count: measurementsLoading ? undefined : measurements.length },
          { value: "orders", label: "Orders", count: ordersLoading ? undefined : orders.length },
          { value: "fittings", label: "Fittings", count: ordersLoading ? undefined : fittings.length },
          { value: "notes", label: "Notes" },
          { value: "photos", label: "Photos", count: client.media?.length ?? 0 },
        ]}
      />

      <View style={{ paddingTop: 20 }}>
        {tab === "measurements" && measurementsLoading && <MeasurementGridSkeleton />}
        {tab === "measurements" && !measurementsLoading && (
          <MeasurementsTab
            clientId={client.id}
            measurements={measurements}
            templates={templates}
            unit={unit}
            onChanged={setMeasurements}
            onShare={() => setShareOpen(true)}
          />
        )}

        {(tab === "orders" || tab === "fittings") && ordersLoading && <ListSkeleton count={3} />}
        {tab === "orders" &&
          !ordersLoading &&
          (orders.length === 0 ? (
            <EmptyState
              variant="inset"
              icon={ClipboardList}
              title="No orders yet"
              description="Orders for this client, with balances and due dates, will appear here."
              action={
                <Button icon={ClipboardList} onPress={() => router.push(`/orders/new?clientId=${client.id}`)}>
                  Create order
                </Button>
              }
            />
          ) : (
            <List>
              {[...orders]
                .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                .map(o => (
                  <OrderListItem key={o.id} order={o} hideClient />
                ))}
            </List>
          ))}

        {tab === "fittings" &&
          !ordersLoading &&
          (fittings.length === 0 ? (
            <EmptyState
              variant="inset"
              icon={Scissors}
              title="No fittings recorded"
              description="Fittings you log on this client's orders are collected here."
            />
          ) : (
            <View style={{ gap: 12 }}>
              {fittings.map(f => (
                <Card key={f.id} padding="sm" onPress={() => router.push(`/orders/${f.order.id}`)}>
                  <View style={styles.fittingHead}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text size={15} weight="semibold">
                        Fitting {f.number} · {garmentOf(f.order)}
                      </Text>
                      <Text variant="label" color={colors.textTertiary}>
                        {formatDate(f.fittedAt)} · Order #{f.order.number}
                      </Text>
                    </View>
                    <Tag size="sm" variant={f.outcome === "approved" ? "success" : "warning"}>
                      {f.outcome === "approved" ? "Approved" : "Adjustments"}
                    </Tag>
                  </View>
                  {f.adjustments.length > 0 && (
                    <View style={[styles.tags, { marginTop: 12 }]}>
                      {f.adjustments.map(a => (
                        <Tag key={a.fieldKey} size="sm" variant="beige">
                          <Text tabular numberOfLines={1} size={11} weight="semibold" color={colors.textSecondary}>
                            {a.label} {a.rawDelta}
                          </Text>
                        </Tag>
                      ))}
                    </View>
                  )}
                  {f.notes ? (
                    <Text variant="label" color={colors.textSecondary} style={{ marginTop: 12 }}>
                      {f.notes}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          ))}

        {tab === "notes" && (
          <View>
            <Textarea
              label="Fit notes and preferences"
              helperText="Posture, preferred ease, fabric sensitivities, referral source — anything you want to remember next visit."
              rows={7}
              value={notes}
              onChangeText={setNotesDraft}
              placeholder="e.g. Right shoulder sits ½ in lower. Prefers a relaxed drape through the chest."
            />
            <View style={styles.notesActions}>
              {notesDirty && (
                <Button variant="ghost" onPress={() => setNotesDraft(null)}>
                  Discard
                </Button>
              )}
              <Button onPress={saveNotes} loading={savingNotes} disabled={!notesDirty}>
                Save notes
              </Button>
            </View>
          </View>
        )}

        {tab === "photos" && client.media === undefined && <MeasurementGridSkeleton count={4} />}
        {tab === "photos" && client.media !== undefined && (
          <PhotosTab clientId={client.id} media={client.media ?? []} onChange={media => setClient({ ...client, media })} />
        )}
      </View>

      <ShareMeasurementsDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        clientName={client.fullName}
        phone={phone}
        businessName={business?.name}
        set={current}
        unit={unit}
      />
    </Screen>
  );
}

function Fact({ label, value, emphasis, divider }: { label: string; value: string; emphasis?: boolean; divider?: boolean }) {
  return (
    <View style={[styles.fact, divider && styles.factDivider]}>
      <Text variant="caption" color={colors.textTertiary} align="center">
        {label}
      </Text>
      <Text
        tabular
        numberOfLines={1}
        size={15}
        weight="semibold"
        color={emphasis ? colors.warning : colors.ink}
        align="center"
        style={{ marginTop: 4 }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 16 },
  tags: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  facts: {
    marginTop: 24,
    flexDirection: "row",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.7),
    backgroundColor: colors.surface,
    paddingVertical: 16,
  },
  fact: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  factDivider: { borderLeftWidth: 1, borderLeftColor: colors.divider },
  actions: { marginTop: 16, flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  fittingHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  notesActions: { marginTop: 16, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
});

// New order — port of the web's src/app/(app)/orders/new/page.tsx.
// Step 1 picks the client (skipped when opened with ?clientId=), step 2 is
// the order form: garment, style notes, fabric/style photos, price and
// deposit, delivery date on a calendar that shows busy days, and a note.

import * as React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Camera, Check, Sparkles, X } from "lucide-react-native";
import { AddClientSheet } from "@/components/add-client-sheet";
import { ClientPicker } from "@/components/client-picker";
import { GarmentPicker } from "@/components/garment-picker";
import { GarmentIcon } from "@/components/brand/garment-icon";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, addDaysISO, fromLocalISO, toLocalISO } from "@/components/ui/calendar";
import { Chip } from "@/components/ui/choice";
import { Input, Textarea } from "@/components/ui/input";
import { Overline, Screen } from "@/components/ui/page";
import { PressableScale } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { customerRepo, measurementRepo, orderRepo } from "@/lib/api/repos";
import { getQueryData, qk, useCustomers, useOrders } from "@/lib/api/query";
import { isActive, PAYMENT_METHODS } from "@/lib/orders";
import { useBusiness } from "@/lib/use-business";
import { currencySymbol, daysUntil, formatMoney } from "@/lib/format";
import { parseCaption, type MaterialKind } from "@/lib/fabrics";
import { resolveImage } from "@/lib/static-images";
import { alpha, colors, hairline, radii, shadows } from "@/theme/tokens";
import type { Customer } from "@/types";
import { AddMaterialSheet, materialThumbnail } from "./materials";

const DUE_PRESETS = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "3 weeks", days: 21 },
  { label: "1 month", days: 30 },
];

/** Client-side ids / number for a new order (same scheme as the web; the API stores them). */
function newOrderMeta(dueDate: string) {
  const now = Date.now();
  return {
    number: String(1010 + Math.floor(Math.random() * 90)),
    dueAt: (dueDate ? fromLocalISO(dueDate) : fromLocalISO(addDaysISO(14))).toISOString(),
    itemId: `oi-${now}`,
    paymentId: `pay-${now}`,
    paidAt: new Date(now).toISOString(),
  };
}

const isoDate = (daysFromNow: number) => addDaysISO(daysFromNow);

export function NewOrderScreen() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const preselectedClientId = typeof params.clientId === "string" && params.clientId ? params.clientId : null;
  const { currency, business } = useBusiness();
  const symbol = currencySymbol(currency);

  const [step, setStep] = React.useState<"client" | "details">(preselectedClientId ? "details" : "client");
  const clientsQ = useCustomers();
  const clients = clientsQ.data ?? [];
  const clientsLoading = !clientsQ.data;
  const ordersQ = useOrders();
  // Orders already due on each day, so the calendar can show busy days.
  const dueMarkers = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of ordersQ.data ?? []) {
      if (!isActive(o)) continue;
      const k = toLocalISO(new Date(o.dueAt));
      map[k] = (map[k] ?? 0) + 1;
    }
    return map;
  }, [ordersQ.data]);
  const [client, setClient] = React.useState<Customer | null>(null);
  const [addClientOpen, setAddClientOpen] = React.useState(false);
  const [garment, setGarment] = React.useState("");
  const [customGarment, setCustomGarment] = React.useState("");
  const [styleNotes, setStyleNotes] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [deposit, setDeposit] = React.useState("");
  const [depositMethod, setDepositMethod] = React.useState<string>("Cash");
  const [dueDate, setDueDate] = React.useState(isoDate(14));
  const [orderNote, setOrderNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{ garment?: string; deposit?: string }>({});
  // Fabric / style photos picked before the order exists; uploaded after creation.
  const [photos, setPhotos] = React.useState<{ url: string; caption: string }[]>([]);
  const [photoSheet, setPhotoSheet] = React.useState(false);
  const [photoKind, setPhotoKind] = React.useState<MaterialKind>("Fabric");
  const openPhotos = (kind: MaterialKind) => {
    setPhotoKind(kind);
    setPhotoSheet(true);
  };

  React.useEffect(() => {
    if (preselectedClientId) {
      const cached = getQueryData<Customer[]>(qk.customers)?.find(c => c.id === preselectedClientId);
      (cached ? Promise.resolve(cached) : customerRepo.getById(preselectedClientId))
        .then(c => {
          if (c) setClient(c);
          else setStep("client");
        })
        .catch(() => setStep("client"));
    }
  }, [preselectedClientId]);

  const garmentName = garment === "Other" ? customGarment.trim() : garment;
  const priceMinor = Math.round((parseFloat(price) || 0) * 100);
  const depositMinor = Math.round((parseFloat(deposit) || 0) * 100);

  const create = async () => {
    const nextErrors: typeof errors = {};
    if (!garmentName) nextErrors.garment = "Choose what you're making";
    if (depositMinor > priceMinor && priceMinor > 0) nextErrors.deposit = "Deposit is more than the price";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !client) return;

    setSaving(true);
    try {
      const latest = await measurementRepo.getLatest(client.id).catch(() => null);
      const meta = newOrderMeta(dueDate);
      const order = await orderRepo.create({
        customerId: client.id,
        customerName: client.fullName,
        number: meta.number,
        statusName: "pending",
        dueAt: meta.dueAt,
        items: [
          {
            id: meta.itemId,
            orderId: "",
            garmentType: garmentName,
            measurementSetId: latest?.id || "",
            styleNotes: styleNotes.trim() || undefined,
            photos: [],
          },
        ],
        priceMinor,
        currency,
        note: orderNote.trim() || undefined,
        payments:
          depositMinor > 0
            ? [{ id: meta.paymentId, orderId: "", amountMinor: depositMinor, paidAt: meta.paidAt, method: depositMethod }]
            : [],
        fittings: [],
      });
      if (photos.length) {
        try {
          const uploaded = [];
          for (const p of photos) {
            const m = await orderRepo.addMedia(order.id, p);
            if (m) uploaded.push(m);
          }
          const cover = uploaded.find(m => parseCaption(m.caption).kind === "Fabric") ?? uploaded[0];
          if (cover) await orderRepo.setCover(order.id, { mediaId: cover.id, thumbUrl: await materialThumbnail(cover.url).catch(() => cover.url) });
        } catch {
          toast.error("Order created, but some photos didn't upload. Add them from the order.");
        }
      }
      toast.success(`Order #${order.number} created — invoice ready`, {
        action: { label: "View invoice", onClick: () => router.push(`/orders/${order.id}/invoice`) },
        duration: 8000,
      });
      // The form is done: the order replaces it in the stack.
      router.replace(`/orders/${order.id}`);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Couldn't create the order");
      setSaving(false);
    }
  };

  if (step === "client") {
    return (
      <Screen header={{ variant: "compact", eyebrow: "New order · Step 1 of 2", title: "Who is it for?", back: "/orders" }}>
        <View style={{ paddingTop: 8 }}>
          <ClientPicker
            clients={clients}
            loading={clientsLoading}
            onSelect={c => {
              setClient(c);
              setStep("details");
            }}
            onAddNew={() => setAddClientOpen(true)}
          />
        </View>
        <AddClientSheet
          open={addClientOpen}
          onOpenChange={setAddClientOpen}
          onCreated={c => {
            setAddClientOpen(false);
            setClient(c);
            setStep("details");
          }}
        />
      </Screen>
    );
  }

  const daysLeft = dueDate ? daysUntil(fromLocalISO(dueDate)) : 0;

  return (
    <Screen
      header={{
        variant: "compact",
        eyebrow: preselectedClientId ? "New order" : "New order · Step 2 of 2",
        title: "Order details",
        back: preselectedClientId ? "/orders" : undefined,
        onBack: preselectedClientId ? undefined : () => setStep("client"),
      }}
      footer={
        <View style={styles.footerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.footerGarment}>
              {garmentName ? <GarmentIcon garment={garmentName} size={16} color={colors.textTertiary} label="" /> : null}
              <Text variant="caption" color={colors.textTertiary} numberOfLines={1} style={{ flexShrink: 1 }}>
                {garmentName || "No garment chosen"}
              </Text>
            </View>
            <Text size={15} weight="semibold" tabular numberOfLines={1}>
              {formatMoney(priceMinor, currency)}
            </Text>
          </View>
          <Button size="lg" icon={Check} onPress={create} loading={saving} disabled={!client}>
            Create order
          </Button>
        </View>
      }
    >
      {client && (
        <View style={styles.clientCard}>
          <Avatar name={client.fullName} src={client.photoUrl} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size={15} weight="semibold" numberOfLines={1}>
              {client.fullName}
            </Text>
            <Text variant="label" color={colors.textTertiary} numberOfLines={1}>
              {client.phones[0] || "No phone"}
            </Text>
          </View>
          {!preselectedClientId && (
            <Button variant="ghost" size="sm" onPress={() => setStep("client")}>
              Change
            </Button>
          )}
        </View>
      )}

      <Overline style={styles.overline}>Garment</Overline>
      <GarmentPicker
        value={garment}
        customActive={garment === "Other"}
        studioGarments={business?.garmentTypes}
        onChange={g => {
          setGarment(g);
          setErrors(e => ({ ...e, garment: undefined }));
        }}
        onCustom={() => {
          setGarment("Other");
          setErrors(e => ({ ...e, garment: undefined }));
        }}
        error={errors.garment}
      />
      {garment === "Other" && (
        <Input
          containerStyle={{ marginTop: 16 }}
          label="What are you making?"
          value={customGarment}
          onChangeText={setCustomGarment}
          placeholder="e.g. Bridal gown"
          autoFocus
        />
      )}
      <Textarea
        containerStyle={{ marginTop: 20 }}
        label="Style notes"
        hint="Optional"
        rows={3}
        value={styleNotes}
        onChangeText={setStyleNotes}
        placeholder="Fabric, colour, lapel, buttons, lining…"
      />

      <Overline style={styles.overline}>Fabric and style</Overline>
      {photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={styles.photoRow}>
          {photos.map((p, i) => {
            const kind = parseCaption(p.caption).kind;
            return (
              <Animated.View key={`${i}-${p.caption}`} entering={ZoomIn.duration(200)} style={styles.photo}>
                <View style={styles.photoImageWrap}>
                  <Image source={resolveImage(p.url)} accessibilityLabel={p.caption} contentFit="cover" style={StyleSheet.absoluteFill} />
                  <View style={styles.photoKind}>
                    <Text size={9} weight="semibold" color={colors.white} align="center" style={styles.kindLabel}>
                      {kind}
                    </Text>
                  </View>
                </View>
                <PressableScale
                  scaleTo={0.9}
                  hitSlop={6}
                  onPress={() => setPhotos(ps => ps.filter((_, j) => j !== i))}
                  accessibilityLabel="Remove photo"
                  style={styles.photoRemove}
                >
                  <X size={13} strokeWidth={2.5} color={colors.textInverse} />
                </PressableScale>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.twoCol}>
        <PressableScale scaleTo={0.98} onPress={() => openPhotos("Fabric")} style={styles.addTile}>
          <Camera size={20} strokeWidth={1.75} color={colors.ink} />
          <View>
            <Text variant="label" weight="semibold">
              Add fabric
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              Photo or swatch
            </Text>
          </View>
        </PressableScale>
        <PressableScale scaleTo={0.98} onPress={() => openPhotos("Style")} style={styles.addTile}>
          <Sparkles size={20} strokeWidth={1.75} color={colors.ink} />
          <View>
            <Text variant="label" weight="semibold">
              Add style
            </Text>
            <Text variant="caption" color={colors.textTertiary}>
              The look they want
            </Text>
          </View>
        </PressableScale>
      </View>
      <AddMaterialSheet
        open={photoSheet}
        onOpenChange={setPhotoSheet}
        initialKind={photoKind}
        onPick={(url, caption) => setPhotos(ps => [...ps, { url, caption }])}
      />

      <Overline style={styles.overline}>Price and payment</Overline>
      <View style={styles.twoCol}>
        <Input
          containerStyle={{ flex: 1 }}
          label="Price"
          keyboardType="decimal-pad"
          inputMode="decimal"
          prefix={symbol}
          placeholder="0"
          value={price}
          onChangeText={v => setPrice(v.replace(",", "."))}
          inputStyle={{ fontVariant: ["tabular-nums"] }}
        />
        <Input
          containerStyle={{ flex: 1 }}
          label="Deposit"
          hint="Optional"
          keyboardType="decimal-pad"
          inputMode="decimal"
          prefix={symbol}
          placeholder="0"
          value={deposit}
          onChangeText={v => {
            setDeposit(v.replace(",", "."));
            setErrors(er => ({ ...er, deposit: undefined }));
          }}
          error={errors.deposit}
          inputStyle={{ fontVariant: ["tabular-nums"] }}
        />
      </View>
      {depositMinor > 0 && (
        <View style={{ marginTop: 16 }}>
          <Text variant="label" weight="semibold" style={{ marginBottom: 8 }}>
            Deposit paid by
          </Text>
          <View style={styles.chips}>
            {PAYMENT_METHODS.map(m => (
              <Chip key={m} size="sm" selected={depositMethod === m} onPress={() => setDepositMethod(m)}>
                {m}
              </Chip>
            ))}
          </View>
        </View>
      )}
      {priceMinor > 0 && (
        <View style={styles.balance}>
          <Text variant="label" color={colors.textSecondary}>
            Balance after deposit
          </Text>
          <Text size={15} weight="semibold" tabular>
            {formatMoney(Math.max(0, priceMinor - depositMinor), currency)}
          </Text>
        </View>
      )}

      <Overline style={styles.overline}>Delivery</Overline>
      <View style={styles.dueHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="caption" color={colors.textTertiary}>
            Ready by
          </Text>
          <Text size={20} weight="semibold" style={{ lineHeight: 25, letterSpacing: -0.3 }}>
            {dueDate ? fromLocalISO(dueDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" }) : "Pick a date"}
          </Text>
        </View>
        {dueDate ? (
          <View style={styles.duePill}>
            <Text variant="caption" weight="semibold" color={colors.olive} tabular>
              {daysLeft <= 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `In ${daysLeft} days`}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.chips, { marginBottom: 12 }]}>
        {DUE_PRESETS.map(p => (
          <Chip key={p.label} size="sm" selected={dueDate === isoDate(p.days)} onPress={() => setDueDate(isoDate(p.days))}>
            {p.label}
          </Chip>
        ))}
      </View>
      <Calendar value={dueDate} onChange={setDueDate} min={isoDate(0)} markers={dueMarkers} />
      {dueMarkers[dueDate] ? (
        <Text variant="caption" color={colors.warning} style={styles.calendarHint}>
          {dueMarkers[dueDate]} other order{dueMarkers[dueDate] > 1 ? "s are" : " is"} already due this day.
        </Text>
      ) : (
        <Text variant="caption" color={colors.textTertiary} style={styles.calendarHint}>
          Dots mark days that already have orders due.
        </Text>
      )}
      <Textarea
        containerStyle={{ marginTop: 20 }}
        label="Order note"
        hint="Optional"
        rows={2}
        value={orderNote}
        onChangeText={setOrderNote}
        placeholder="Anything the workshop should know"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  overline: { marginTop: 32, marginBottom: 12 },
  clientCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: hairline,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  photoRow: { gap: 8, paddingTop: 6, paddingBottom: 4, paddingRight: 8 },
  photo: { width: 80, height: 80 },
  photoImageWrap: { width: 80, height: 80, borderRadius: radii.control, overflow: "hidden", backgroundColor: colors.surfaceSunken },
  photoKind: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 2,
  },
  kindLabel: { textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 12 },
  photoRemove: {
    position: "absolute",
    right: -6,
    top: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadows.xs,
  },
  twoCol: { flexDirection: "row", gap: 12 },
  addTile: {
    flex: 1,
    alignItems: "flex-start",
    gap: 8,
    borderRadius: radii.card,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  balance: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radii.card,
    backgroundColor: alpha(colors.surfaceSunken, 0.7),
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dueHead: { marginBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, paddingHorizontal: 4 },
  duePill: { borderRadius: 999, backgroundColor: colors.oliveSoft, paddingHorizontal: 10, paddingVertical: 4 },
  calendarHint: { marginTop: 8, paddingHorizontal: 4 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  footerGarment: { flexDirection: "row", alignItems: "center", gap: 6 },
});

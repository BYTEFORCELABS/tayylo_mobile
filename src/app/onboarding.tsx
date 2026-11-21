// Studio setup after sign-up — the web's three onboarding steps:
// studio name → tape units & currency → garments made.

import * as React from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, SlideInLeft, SlideInRight, ZoomIn } from "react-native-reanimated";
import { router } from "expo-router";
import { ArrowRight, Check } from "lucide-react-native";
import { AuthLayout } from "@/components/auth/auth-layout";
import { GarmentIcon } from "@/components/brand/garment-icon";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { BackButton } from "@/components/ui/page";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { businessRepo } from "@/lib/api/repos";
import { CURRENCIES, currencySymbol, formatMoney } from "@/lib/format";
import { setCachedBusiness } from "@/lib/use-business";
import { colors, radii, shadows } from "@/theme/tokens";
import { measurementValue } from "@/theme/typography";

const GARMENTS = ["Suits", "Shirts", "Trousers", "Jackets", "Agbada", "Senator", "Kaftan", "Dresses", "Skirts", "Boubou", "Kurta", "Bridal"];

const STEPS = [
  { key: "studio", label: "Studio" },
  { key: "units", label: "Units" },
  { key: "garments", label: "Garments" },
] as const;

export default function OnboardingScreen() {
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState(1);
  const [businessName, setBusinessName] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [currency, setCurrency] = React.useState("NGN");
  const [unit, setUnit] = React.useState<"imperial" | "metric">("imperial");
  const [garments, setGarments] = React.useState<string[]>(["Suits", "Shirts", "Agbada", "Senator"]);
  const [nameError, setNameError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);

  const finish = async (skip = false) => {
    setSaving(true);
    try {
      const updated = await businessRepo.update({
        name: businessName.trim() || "My Atelier",
        ...(ownerName.trim() ? { ownerName: ownerName.trim() } : {}),
        ...(skip ? {} : { currency, unitSystem: unit, garmentTypes: garments }),
      });
      setCachedBusiness(updated);
      router.replace("/today");
    } catch {
      toast.error("Couldn't save your setup. Check your connection and try again.");
      setSaving(false);
    }
  };

  const next = () => {
    if (step === 0 && !businessName.trim()) {
      setNameError("Give your studio a name — you can change it later");
      return;
    }
    if (step < STEPS.length - 1) {
      setDir(1);
      setStep(step + 1);
    } else finish();
  };

  const back = React.useCallback(() => {
    setDir(-1);
    setStep(s => Math.max(0, s - 1));
  }, []);

  // Android back steps back through the setup instead of leaving it.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step > 0) {
        back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step, back]);

  const progress = (
    <View style={styles.progressRow}>
      {step > 0 ? <BackButton onPress={back} label="Previous step" /> : <View style={{ width: 40, height: 40 }} />}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[styles.bar, { backgroundColor: i <= step ? colors.ink : colors.surfaceSunken }]} />
          ))}
        </View>
        <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 8 }}>
          Step {step + 1} of {STEPS.length} · {STEPS[step].label}
        </Text>
      </View>
      <Button variant="ghost" size="sm" onPress={() => finish(true)} disabled={saving}>
        Skip
      </Button>
    </View>
  );

  const entering = dir > 0 ? SlideInRight.duration(240) : SlideInLeft.duration(240);

  return (
    <AuthLayout top={progress}>
      <View style={{ flex: 1 }}>
        <Animated.View key={step} entering={step === 0 && dir > 0 ? FadeIn.duration(240) : entering} style={{ flex: 1 }}>
          {step === 0 && (
            <>
              <Text variant="title" accessibilityRole="header">
                What&apos;s your studio called?
              </Text>
              <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
                It appears on measurement cards you share with clients.
              </Text>
              <View style={{ marginTop: 32, gap: 20 }}>
                <Input
                  label="Studio or business name"
                  placeholder="e.g. Adire House Tailoring"
                  value={businessName}
                  onChangeText={t => {
                    setBusinessName(t);
                    setNameError(undefined);
                  }}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={next}
                  error={nameError}
                  autoFocus
                />
                <Input
                  label="Your name"
                  hint="Optional"
                  placeholder="So we can greet you"
                  value={ownerName}
                  onChangeText={setOwnerName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={next}
                />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text variant="title" accessibilityRole="header">
                How do you work?
              </Text>
              <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
                Both can be changed later in Settings.
              </Text>

              <Text variant="label" weight="semibold" style={{ marginTop: 32, marginBottom: 8 }}>
                Tape measure
              </Text>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 12 }}>
                {(
                  [
                    { value: "imperial", title: "Inches", sub: "With ¼ ½ ¾", sample: "41¾", u: "in" },
                    { value: "metric", title: "Centimetres", sub: "To 0.5 cm", sample: "106.0", u: "cm" },
                  ] as const
                ).map(o => {
                  const selected = unit === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setUnit(o.value)}
                      style={[styles.unitCard, selected ? styles.selected : styles.unselected]}
                    >
                      <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                        <Text size={28} weight="semibold" style={[measurementValue, { lineHeight: 30 }]}>
                          {o.sample}
                        </Text>
                        <Text variant="label" weight="medium" color={colors.textTertiary} style={{ marginLeft: 4 }}>
                          {o.u}
                        </Text>
                      </View>
                      <Text size={15} weight="semibold" style={{ marginTop: 16 }}>
                        {o.title}
                      </Text>
                      <Text variant="caption" color={colors.textTertiary}>
                        {o.sub}
                      </Text>
                      {selected && (
                        <View style={styles.check}>
                          <Check size={12} strokeWidth={3} color={colors.textInverse} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Select
                containerStyle={{ marginTop: 24 }}
                label="Currency"
                value={currency}
                onChange={setCurrency}
                helperText={`Prices will look like ${formatMoney(4500000, currency)}`}
                options={CURRENCIES.map(c => ({ value: c.code, label: `${c.code} · ${currencySymbol(c.code)} · ${c.name}` }))}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Text variant="title" accessibilityRole="header">
                What do you make?
              </Text>
              <Text color={colors.textSecondary} style={{ marginTop: 8 }}>
                Pick all that apply. This tailors your workspace — you can still make anything.
              </Text>
              <View accessibilityLabel="Garments" style={styles.grid}>
                {GARMENTS.map(g => {
                  const selected = garments.includes(g);
                  return (
                    <Pressable
                      key={g}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={g}
                      onPress={() => setGarments(prev => (selected ? prev.filter(x => x !== g) : [...prev, g]))}
                      style={({ pressed }) => [styles.garment, selected ? styles.selected : styles.garmentIdle, pressed && { transform: [{ scale: 0.97 }] }]}
                    >
                      <GarmentIcon garment={g} size={36} label="" color={selected ? colors.ink : colors.textSecondary} />
                      <Text variant="caption" weight="medium" color={selected ? colors.ink : colors.textSecondary}>
                        {g}
                      </Text>
                      {selected && (
                        <Animated.View entering={ZoomIn.duration(200)} style={[styles.check, { right: 8, top: 8 }]}>
                          <Check size={12} strokeWidth={3} color={colors.textInverse} />
                        </Animated.View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="caption" color={colors.textTertiary} style={{ marginTop: 16 }}>
                {garments.length} selected
              </Text>
            </>
          )}
        </Animated.View>

        <View style={{ paddingTop: 40 }}>
          <Button size="lg" block onPress={next} loading={saving} disabled={step === 2 && garments.length === 0} iconRight={step === STEPS.length - 1 ? Check : ArrowRight}>
            {step === STEPS.length - 1 ? "Open my workspace" : "Continue"}
          </Button>
        </View>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  progressRow: { flexDirection: "row", alignItems: "center", gap: 16, width: "100%" },
  bar: { flex: 1, height: 4, borderRadius: 999 },
  unitCard: { flex: 1, alignItems: "flex-start", borderRadius: radii.card, borderWidth: 1, padding: 16 },
  selected: { borderColor: colors.ink, backgroundColor: colors.surfaceRaised, boxShadow: shadows.selectedRing },
  unselected: { borderColor: colors.border, backgroundColor: colors.surface },
  check: { position: "absolute", right: 12, top: 12, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  grid: { marginTop: 32, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  garment: { width: "31.9%", alignItems: "center", gap: 8, borderRadius: radii.card, borderWidth: 1, paddingHorizontal: 8, paddingTop: 16, paddingBottom: 12 },
  garmentIdle: { borderColor: "rgba(227,224,214,0.8)", backgroundColor: colors.surface },
});

import * as React from "react";
import { View } from "react-native";
import type { Customer } from "@/types";
import { BottomSheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { customerRepo, isDuplicatePhone } from "@/lib/api/repos";
import { getQueryData, queryClient, toKey } from "@/lib/api/query";

interface AddClientSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  onCreated: (customer: Customer) => void;
}

/** "New client" — only the name is required. Same form as the web sheet. */
export function AddClientSheet({ open, onOpenChange, initialName = "", onCreated }: AddClientSheetProps) {
  const [form, setForm] = React.useState(0);
  const submitRef = React.useRef<() => void>(() => {});
  const [saving, setSaving] = React.useState(false);

  // Each opening starts with a fresh form.
  React.useEffect(() => {
    if (open) setForm(f => f + 1);
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New client"
      description="Only the name is required. You can add measurements next."
      footer={
        <Button block size="lg" loading={saving} onPress={() => submitRef.current()}>
          Add client
        </Button>
      }
    >
      <AddClientForm key={form} initialName={initialName} onOpenChange={onOpenChange} onCreated={onCreated} submitRef={submitRef} setSaving={setSaving} />
    </BottomSheet>
  );
}

function AddClientForm({
  initialName,
  onOpenChange,
  onCreated,
  submitRef,
  setSaving,
}: Omit<AddClientSheetProps, "open"> & { submitRef: React.MutableRefObject<() => void>; setSaving: (v: boolean) => void }) {
  const [name, setName] = React.useState(initialName ?? "");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [dupWarning, setDupWarning] = React.useState(false);
  const [nameError, setNameError] = React.useState<string>();
  const phoneLongEnough = phone.replace(/\s/g, "").length > 5;

  // Debounced duplicate-phone check against the cached client list.
  React.useEffect(() => {
    if (!phoneLongEnough) return;
    const t = setTimeout(async () => {
      try {
        const all =
          getQueryData<Customer[]>("customers") ?? (await queryClient.fetchQuery<Customer[]>({ queryKey: toKey("customers"), queryFn: customerRepo.list }));
        setDupWarning(isDuplicatePhone(all ?? [], phone));
      } catch {
        setDupWarning(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [phone, phoneLongEnough]);

  const submit = async () => {
    if (!name.trim()) {
      setNameError("Enter the client's name");
      return;
    }
    setSaving(true);
    try {
      const customer = await customerRepo.create({
        fullName: name.trim(),
        phones: phone.trim() ? [phone.trim()] : [],
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: [],
      });
      onOpenChange(false);
      onCreated(customer);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add this client");
    } finally {
      setSaving(false);
    }
  };
  submitRef.current = submit;

  return (
    <View style={{ gap: 20 }}>
      <Input
        label="Full name"
        placeholder="e.g. Adaeze Okonkwo"
        value={name}
        onChangeText={t => {
          setName(t);
          setNameError(undefined);
        }}
        error={nameError}
        autoComplete="off"
        autoCapitalize="words"
        autoFocus
        returnKeyType="next"
      />
      <Input
        label="Phone"
        hint="Optional"
        placeholder="+234 800 000 0000"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        value={phone}
        onChangeText={setPhone}
        warning={dupWarning && phoneLongEnough ? "Another client already uses this number" : undefined}
      />
      <Input
        label="Email"
        hint="Optional"
        placeholder="name@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
      />
      <Textarea label="Notes" hint="Optional" rows={3} placeholder="Fit preferences, posture, referrals" value={notes} onChangeText={setNotes} />
    </View>
  );
}

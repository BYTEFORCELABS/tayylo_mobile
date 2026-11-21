// Edit a client's contact details, tags and notes.
// Mirrors the web's src/app/(app)/clients/[id]/edit/page.tsx (phone layout).

import * as React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { UserX } from "lucide-react-native";
import type { Customer } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Overline, Screen, useBack } from "@/components/ui/page";
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from "@/components/ui/states";
import { Tag } from "@/components/ui/tag";
import { toast } from "@/components/ui/toast";
import { customerRepo } from "@/lib/api/repos";
import { radii } from "@/theme/tokens";

export function ClientEditScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const clientId = String(params.id ?? "");
  const goBack = useBack();

  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [client, setClient] = React.useState<Customer | null>(null);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagDraft, setTagDraft] = React.useState("");
  const [nameError, setNameError] = React.useState<string>();
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    customerRepo
      .getById(clientId)
      .then(c => {
        if (c) {
          setClient(c);
          setName(c.fullName);
          setPhone(c.phones[0] || "");
          setEmail(c.email || "");
          setNotes(c.notes || "");
          setTags(c.tags);
        }
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [clientId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const addTag = (raw = tagDraft) => {
    const t = raw.trim().replace(/,$/, "").trim();
    if (t && !tags.includes(t)) setTags(prev => (prev.includes(t) ? prev : [...prev, t]));
    setTagDraft("");
  };

  const back = `/clients/${clientId}`;

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError("Enter the client's name");
      return;
    }
    setSaving(true);
    try {
      const pending = tagDraft.trim();
      // Keep any additional phone numbers that were stored beyond the first.
      const otherPhones = client?.phones.slice(1) ?? [];
      await customerRepo.update(clientId, {
        fullName: name.trim(),
        phones: phone.trim() ? [phone.trim(), ...otherPhones] : otherPhones,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: pending && !tags.includes(pending) ? [...tags, pending] : tags,
      });
      toast.success("Client updated");
      goBack(back);
    } catch {
      toast.error("Couldn't save changes");
      setSaving(false);
    }
  };

  if (status === "loading") {
    return (
      <Screen header={{ variant: "compact", title: "Edit client", back }}>
        <LoadingRegion>
          <View style={{ gap: 20, paddingTop: 16 }}>
            <Skeleton variant="circular" width={80} height={80} style={{ alignSelf: "center" }} />
            {[0, 1, 2].map(i => (
              <Skeleton key={i} height={48} style={{ borderRadius: radii.input }} />
            ))}
          </View>
        </LoadingRegion>
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen header={{ variant: "compact", title: "Edit client", back }}>
        <ErrorState
          title="Couldn't load this client"
          onRetry={() => {
            setStatus("loading");
            load();
          }}
        />
      </Screen>
    );
  }

  if (!client) {
    return (
      <Screen header={{ variant: "compact", title: "Edit client", back: "/clients" }}>
        <EmptyState icon={UserX} title="Client not found" action={<Button onPress={() => goBack("/clients")}>Back to clients</Button>} />
      </Screen>
    );
  }

  return (
    <Screen header={{ variant: "compact", title: "Edit client", eyebrow: client.fullName, back }}>
      <View style={styles.avatar}>
        <Avatar name={name || client.fullName} src={client.photoUrl} size="xl" />
      </View>

      <Overline style={{ marginBottom: 12, marginTop: 8 }}>Contact</Overline>
      <View style={{ gap: 20 }}>
        <Input
          label="Full name"
          value={name}
          onChangeText={v => {
            setName(v);
            setNameError(undefined);
          }}
          error={nameError}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Input
          label="Phone"
          hint="Optional"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          value={phone}
          onChangeText={setPhone}
          placeholder="+234 800 000 0000"
        />
        <Input
          label="Email"
          hint="Optional"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
        />
      </View>

      <Overline style={{ marginBottom: 12, marginTop: 32 }}>Organise</Overline>
      <View style={{ gap: 20 }}>
        <View>
          <Input
            label="Tags"
            hint="Press Enter to add"
            value={tagDraft}
            onChangeText={v => {
              // A typed comma adds the tag, like the web's "," key.
              if (v.endsWith(",")) addTag(v);
              else setTagDraft(v);
            }}
            onSubmitEditing={() => addTag()}
            onBlur={() => addTag()}
            submitBehavior="submit"
            returnKeyType="done"
            placeholder="VIP, Wedding, Regular"
          />
          {tags.length > 0 && (
            <View style={styles.tags}>
              {tags.map(t => (
                <Tag key={t} variant="olive" onRemove={() => setTags(tags.filter(x => x !== t))}>
                  {t}
                </Tag>
              ))}
            </View>
          )}
        </View>
        <Textarea
          label="Notes"
          hint="Optional"
          rows={4}
          value={notes}
          onChangeText={setNotes}
          placeholder="Fit preferences, posture, referrals"
        />
      </View>

      {/* Phones: primary on top (flex-col-reverse on the web). */}
      <View style={styles.buttons}>
        <Button size="lg" loading={saving} onPress={handleSave}>
          Save changes
        </Button>
        <Button variant="secondary" size="lg" onPress={() => goBack(back)}>
          Cancel
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", paddingVertical: 16 },
  tags: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  buttons: { marginTop: 40, gap: 10 },
});

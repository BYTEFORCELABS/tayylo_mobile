// Unsaved capture drafts, kept per client + template so a tailor can pick up
// where they left off. Same key and JSON shape as the web's localStorage draft.

import AsyncStorage from "@react-native-async-storage/async-storage";

export const draftKey = (clientId: string, templateId: string) => `tayylo_draft_${clientId}_${templateId}`;

export async function readDraft(clientId: string, templateId: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(clientId, templateId));
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {}
  return {};
}

export function writeDraft(clientId: string, templateId: string, values: Record<string, string>) {
  AsyncStorage.setItem(draftKey(clientId, templateId), JSON.stringify(values)).catch(() => {});
}

export function clearDraft(clientId: string, templateId: string) {
  AsyncStorage.removeItem(draftKey(clientId, templateId)).catch(() => {});
}

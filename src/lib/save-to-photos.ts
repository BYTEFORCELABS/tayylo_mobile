// Saves a local image file to the device's photo library — the native
// counterpart of the web's image download (measurement cards, documents).

import { Alert, Linking } from "react-native";
import { Asset, requestPermissionsAsync } from "expo-media-library";

/** Resolves true when saved; false when the user declined photo access. */
export async function saveToPhotos(fileUri: string): Promise<boolean> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) {
    Alert.alert("Photo access is off", "Allow Tayylo to add photos in Settings to save images.", [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ]);
    return false;
  }
  await Asset.create(fileUri);
  return true;
}

// Photo capture and preparation. Phone photos are often 4–12 MB; like the
// web (src/lib/images.ts) they are downscaled and re-encoded before upload
// so records stay light. Same sizes and qualities as the web:
//   compressPhoto  → JPEG data URL, longest side ≤ 1400px, q 0.82
//   makeThumbnail  → square JPEG data URL, 240px, q 0.78
//   preparePhoto   → JPEG file for multipart upload, ≤ 1600px, q 0.84
//   prepareLogo    → PNG data URL ≤ 380k chars (480 → 360 → 240px)

import { Alert, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

async function ensurePermission(source: "camera" | "library") {
  const res = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (res.granted) return true;
  Alert.alert(
    source === "camera" ? "Camera access is off" : "Photo access is off",
    source === "camera"
      ? "Allow Tayylo to use the camera in Settings to take photos."
      : "Allow Tayylo to access your photos in Settings to choose one.",
    [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ]
  );
  return false;
}

/** Opens the camera or the photo library. Resolves null if cancelled. */
export async function pickImage(source: "camera" | "library"): Promise<PickedImage | null> {
  if (!(await ensurePermission(source))) return null;
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: false, exif: false };
  const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  const a = result.assets[0];
  return { uri: a.uri, width: a.width, height: a.height };
}

/** Lets the user choose camera or library with a native action sheet. */
export function chooseImageSource(title = "Add a photo"): Promise<"camera" | "library" | null> {
  return new Promise(resolve => {
    Alert.alert(title, undefined, [
      { text: "Take photo", onPress: () => resolve("camera") },
      { text: "Choose from library", onPress: () => resolve("library") },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

function fit(w: number, h: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

async function render(uri: string, ops: (ctx: ReturnType<typeof ImageManipulator.manipulate>) => void) {
  const ctx = ImageManipulator.manipulate(uri);
  ops(ctx);
  return ctx.renderAsync();
}

/** Photo → JPEG data URL, longest side ≤ 1400px. */
export async function compressPhoto(img: PickedImage, maxSide = 1400, quality = 0.82): Promise<string> {
  const size = fit(img.width, img.height, maxSide);
  const ref = await render(img.uri, c => {
    if (size.width !== img.width) c.resize(size);
  });
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality, base64: true });
  if (!out.base64) throw new Error("Couldn't read this image");
  return `data:image/jpeg;base64,${out.base64}`;
}

/** Small square thumbnail (for list rows), centre-cropped. */
export async function makeThumbnail(img: PickedImage | string, size = 240): Promise<string> {
  let src: PickedImage;
  if (typeof img === "string") {
    // A data URL or file URI — measure it first.
    const probe = await (await render(img, () => {})).saveAsync({ format: SaveFormat.JPEG, compress: 1 });
    src = { uri: probe.uri, width: probe.width, height: probe.height };
  } else src = img;
  const side = Math.min(src.width, src.height);
  const ref = await render(src.uri, c => {
    c.crop({ originX: Math.round((src.width - side) / 2), originY: Math.round((src.height - side) / 2), width: side, height: side });
    if (side > size) c.resize({ width: size, height: size });
  });
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.78, base64: true });
  if (!out.base64) throw new Error("Couldn't read this image");
  return `data:image/jpeg;base64,${out.base64}`;
}

/** Photo → JPEG file (longest side ≤ maxSide) with its pixel size, for multipart uploads. */
export async function preparePhoto(img: PickedImage, maxSide = 1600, quality = 0.84): Promise<{ uri: string; width: number; height: number }> {
  const size = fit(img.width, img.height, maxSide);
  const ref = await render(img.uri, c => {
    if (size.width !== img.width) c.resize(size);
  });
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: quality });
  return { uri: out.uri, width: out.width, height: out.height };
}

/** Studio logo → small PNG data URL (keeps transparency) that fits inline on documents. */
export async function prepareLogo(img: PickedImage): Promise<string> {
  for (const side of [480, 360, 240]) {
    const size = fit(img.width, img.height, side);
    const ref = await render(img.uri, c => c.resize(size));
    const out = await ref.saveAsync({ format: SaveFormat.PNG, base64: true });
    const url = `data:image/png;base64,${out.base64 ?? ""}`;
    if (out.base64 && url.length <= 380_000) return url;
  }
  throw new Error("That logo is too detailed — try a simpler or smaller image");
}

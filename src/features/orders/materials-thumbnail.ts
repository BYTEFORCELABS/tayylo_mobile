// Cover thumbnails for order media. Media URLs are what the web stores:
// JPEG data URLs for photos, or a web public path for built-in swatches
// ("/fabrics/ankara.jpg"), which is bundled with the app. Bundled assets
// are first decoded into a local file so the manipulator can crop them.

import { Image as ExpoImage } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { makeThumbnail, type PickedImage } from "@/lib/images";
import { resolveImage } from "@/lib/static-images";

/** Any stored image URL → something makeThumbnail / ImageManipulator can read. */
export async function localImageSource(url: string): Promise<PickedImage | string> {
  const ref = resolveImage(url);
  if (typeof ref === "number") {
    const loaded = await ExpoImage.loadAsync(ref);
    const rendered = await ImageManipulator.manipulate(loaded).renderAsync();
    const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
    return { uri: out.uri, width: out.width, height: out.height };
  }
  return ref?.uri ?? url;
}

/** Square 240px JPEG data URL for the order's list cover (same as the web's makeThumbnail). */
export async function materialThumbnail(url: string): Promise<string> {
  return makeThumbnail(await localImageSource(url));
}

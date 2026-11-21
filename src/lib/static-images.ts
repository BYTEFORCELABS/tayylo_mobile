// Static photography the web app serves from /public, bundled into the app.
// Records in the database can reference these by their web path (seeded
// garments, built-in fabric swatches, sample Explore posts), so every image
// URL goes through resolveImage() before it is rendered.

import { API_URL } from "./config";

/** A bundled asset module id or a remote/data URI — accepted by expo-image and RN Image. */
export type ImageRef = number | { uri: string };

const BUNDLED: Record<string, number> = {
  "/garments/agbada.jpg": require("../../assets/images/garments/agbada.jpg"),
  "/garments/atelier_banner.jpg": require("../../assets/images/garments/atelier_banner.jpg"),
  "/garments/blazer.jpg": require("../../assets/images/garments/blazer.jpg"),
  "/garments/dress.jpg": require("../../assets/images/garments/dress.jpg"),
  "/garments/kaftan.jpg": require("../../assets/images/garments/kaftan.jpg"),
  "/garments/senator.jpg": require("../../assets/images/garments/senator.jpg"),
  "/garments/shirt.jpg": require("../../assets/images/garments/shirt.jpg"),
  "/garments/suit.jpg": require("../../assets/images/garments/suit.jpg"),
  "/garments/trousers.jpg": require("../../assets/images/garments/trousers.jpg"),

  "/fabrics/adire.jpg": require("../../assets/images/fabrics/adire.jpg"),
  "/fabrics/ankara.jpg": require("../../assets/images/fabrics/ankara.jpg"),
  "/fabrics/aso-oke.jpg": require("../../assets/images/fabrics/aso-oke.jpg"),
  "/fabrics/brocade.jpg": require("../../assets/images/fabrics/brocade.jpg"),
  "/fabrics/charcoal-linen.jpg": require("../../assets/images/fabrics/charcoal-linen.jpg"),
  "/fabrics/denim.jpg": require("../../assets/images/fabrics/denim.jpg"),
  "/fabrics/indigo-print.jpg": require("../../assets/images/fabrics/indigo-print.jpg"),
  "/fabrics/kente.jpg": require("../../assets/images/fabrics/kente.jpg"),
  "/fabrics/lace.jpg": require("../../assets/images/fabrics/lace.jpg"),
  "/fabrics/linen.jpg": require("../../assets/images/fabrics/linen.jpg"),
  "/fabrics/satin.jpg": require("../../assets/images/fabrics/satin.jpg"),
  "/fabrics/silk.jpg": require("../../assets/images/fabrics/silk.jpg"),
  "/fabrics/tartan-wool.jpg": require("../../assets/images/fabrics/tartan-wool.jpg"),
  "/fabrics/velvet.jpg": require("../../assets/images/fabrics/velvet.jpg"),

  "/explore/denim-tailored-jacket.jpg": require("../../assets/images/explore/denim-tailored-jacket.jpg"),
  "/explore/indian-embroidered-lehenga.jpg": require("../../assets/images/explore/indian-embroidered-lehenga.jpg"),
  "/explore/japanese-indigo-kimono.jpg": require("../../assets/images/explore/japanese-indigo-kimono.jpg"),
  "/explore/silk-scarf-collection.jpg": require("../../assets/images/explore/silk-scarf-collection.jpg"),
  "/explore/tweed-three-piece-suit.jpg": require("../../assets/images/explore/tweed-three-piece-suit.jpg"),

  "/pictures/tailorwithtablet.jpg": require("../../assets/images/pictures/tailorwithtablet.jpg"),
  "/pictures/tailorpic2.jpg": require("../../assets/images/pictures/tailorpic2.jpg"),
  "/pictures/suittailorimage.jpg": require("../../assets/images/pictures/suittailorimage.jpg"),
  "/pictures/happywomanailorwithtab.jpg": require("../../assets/images/pictures/happywomanailorwithtab.jpg"),
};

/**
 * Any image reference Tayylo stores → something <Image source> accepts.
 * data: and http(s) URLs pass through; web-public paths use the bundled
 * copy when there is one, otherwise they're loaded from the backend.
 */
export function resolveImage(src: string | null | undefined): ImageRef | undefined {
  if (!src) return undefined;
  if (src.startsWith("data:") || /^https?:\/\//i.test(src) || src.startsWith("file:")) return { uri: src };
  const path = src.split("?")[0];
  if (BUNDLED[path]) return BUNDLED[path];
  if (src.startsWith("/")) return { uri: `${API_URL}${src}` };
  return { uri: src };
}

/** Same garment → photo mapping as the web's lib/mock/seed-data.ts. */
export function getGarmentImage(key?: string): string {
  if (!key) return "/garments/suit.jpg";
  const lower = key.toLowerCase();
  if (lower.includes("suit") || lower.includes("waistcoat")) return "/garments/suit.jpg";
  if (lower.includes("agbada") || lower.includes("boubou")) return "/garments/agbada.jpg";
  if (lower.includes("senator") || lower.includes("dashiki")) return "/garments/senator.jpg";
  if (lower.includes("kaftan") || lower.includes("kurta")) return "/garments/kaftan.jpg";
  if (lower.includes("shirt") || lower.includes("oxford")) return "/garments/shirt.jpg";
  if (
    lower.includes("dress") ||
    lower.includes("gown") ||
    lower.includes("skirt") ||
    lower.includes("saree") ||
    lower.includes("jumpsuit") ||
    lower.includes("lehenga") ||
    lower.includes("bridal")
  )
    return "/garments/dress.jpg";
  if (lower.includes("blazer") || lower.includes("jacket")) return "/garments/blazer.jpg";
  if (lower.includes("trouser") || lower.includes("pant")) return "/garments/trousers.jpg";
  return "/garments/suit.jpg";
}

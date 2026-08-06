export function generateRmaNumber(shop: string): string {
  const shopSlug = shop.split(".")[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `RMA-${shopSlug}-${timestamp}-${random}`;
}

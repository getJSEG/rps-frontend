/** Fields that may carry customer artwork from API (snake_case or camelCase). */
export type CustomerArtworkFields = {
  customer_artwork_url?: string | null;
  customerArtworkUrl?: string | null;
};

export function lineCustomerArtworkSource(item: CustomerArtworkFields): string | undefined {
  const snake = item.customer_artwork_url != null ? String(item.customer_artwork_url).trim() : "";
  if (snake) return snake;
  const camel = item.customerArtworkUrl != null ? String(item.customerArtworkUrl).trim() : "";
  if (camel) return camel;
  return undefined;
}

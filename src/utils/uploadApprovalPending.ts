import { canonicalOrderStatus } from "./orderStatuses";

export type UploadApprovalOrderItem = {
  id?: number | null;
  product_name?: string | null;
  job_name?: string | null;
  quantity?: number | null;
  product_description?: string | null;
  width_inches?: number | string | null;
  height_inches?: number | string | null;
  customer_artwork_url?: string | null;
};

export type UploadApprovalOrderRow = {
  id: number;
  order_number?: string | null;
  status?: string | null;
  created_at?: string | null;
  items?: UploadApprovalOrderItem[] | null;
};

/** One row on the Pending Upload and Approval list (also used for the navbar badge count). */
export type PendingJob = {
  key: string;
  orderId: number;
  orderItemId: number | null;
  orderLabel: string;
  jobIdLabel: string;
  orderedAt: string | null;
  jobName: string;
  productLabel: string;
  dimensions: string | null;
  quantity: number;
  requiredWidthIn: number | null;
  requiredHeightIn: number | null;
};

function normalizeItems(raw: unknown): UploadApprovalOrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object" && x != null);
}

function formatLineSizeInches(w: unknown, h: unknown): string | null {
  const nw = w != null && w !== "" ? Number(w) : NaN;
  const nh = h != null && h !== "" ? Number(h) : NaN;
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
  return `${fmt(nw)}" × ${fmt(nh)}"`;
}

function parseOrderLineInches(w: unknown, h: unknown): { w: number; h: number } | null {
  const nw = w != null && w !== "" ? Number(w) : NaN;
  const nh = h != null && h !== "" ? Number(h) : NaN;
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return null;
  return { w: nw, h: nh };
}

function orderNeedsUploadOrApproval(status: string | null | undefined): boolean {
  const c = canonicalOrderStatus(status);
  return c === "awaiting_artwork" || c === "awaiting_customer_approval";
}

/**
 * Same rules as {@link buildPendingUploadJobsFromOrders} for a single line: order is open for
 * artwork/approval uploads, line has a real id, and no customer file yet.
 */
export function orderItemNeedsCustomerArtworkUpload(
  orderStatus: string | null | undefined,
  item: Pick<UploadApprovalOrderItem, "id" | "customer_artwork_url">
): boolean {
  if (!orderNeedsUploadOrApproval(orderStatus)) return false;
  const itemId = item.id != null && Number.isFinite(Number(item.id)) ? Number(item.id) : null;
  if (itemId == null || itemId <= 0) return false;
  const url = item.customer_artwork_url != null ? String(item.customer_artwork_url).trim() : "";
  return !url;
}

/**
 * Same rules as the Pending Upload and Approval page: orders awaiting artwork or customer
 * approval, counting each line item that still has no customer_artwork_url.
 */
export function buildPendingUploadJobsFromOrders(orders: UploadApprovalOrderRow[]): PendingJob[] {
  const out: PendingJob[] = [];
  for (const order of orders) {
    if (!orderNeedsUploadOrApproval(order.status)) continue;
    const items = normalizeItems(order.items);
    const base = order.order_number || String(order.id);
    if (items.length === 0) {
      out.push({
        key: `order-${order.id}-0`,
        orderId: order.id,
        orderItemId: null,
        orderLabel: base,
        jobIdLabel: `${base}-01`,
        orderedAt: order.created_at ?? null,
        jobName: "—",
        productLabel: "Order line pending",
        dimensions: null,
        quantity: 1,
        requiredWidthIn: null,
        requiredHeightIn: null,
      });
      continue;
    }
    items.forEach((it, idx) => {
      const url = it.customer_artwork_url != null ? String(it.customer_artwork_url).trim() : "";
      if (url) return;
      const itemId = it.id != null && Number.isFinite(Number(it.id)) ? Number(it.id) : null;
      const line = idx + 1;
      const jobIdLabel = `${base}-${String(line).padStart(2, "0")}`;
      const productLabel =
        [it.product_name, it.product_description].filter(Boolean).join(" — ") || "Product";
      const inches = parseOrderLineInches(it.width_inches, it.height_inches);
      out.push({
        key: `order-${order.id}-item-${it.id ?? line}`,
        orderId: order.id,
        orderItemId: itemId,
        orderLabel: base,
        jobIdLabel,
        orderedAt: order.created_at ?? null,
        jobName: (it.job_name || "").trim() || "—",
        productLabel,
        dimensions: formatLineSizeInches(it.width_inches, it.height_inches),
        quantity: Math.max(1, parseInt(String(it.quantity ?? 1), 10) || 1),
        requiredWidthIn: inches?.w ?? null,
        requiredHeightIn: inches?.h ?? null,
      });
    });
  }
  return out;
}

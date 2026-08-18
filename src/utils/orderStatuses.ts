/**
 * Canonical order job statuses (API / DB snake_case).
 * Keep in sync with VALID_ORDER_STATUSES in rps-backend orderController.js
 */

export const ADMIN_ORDER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending_payment", label: "Pending payment" },
  { value: "awaiting_artwork", label: "Awaiting artwork" },
  { value: "on_hold", label: "On hold" },
  { value: "processing", label: "Processing" },
  { value: "printing", label: "Printing" },
  { value: "trimming", label: "Trimming" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "reprint", label: "Reprint" },
  { value: "cancelled", label: "Cancelled" },
];

/** Line-item status picker includes the refund flow statuses used on the item, not the whole order. */
export const ADMIN_ITEM_STATUS_OPTIONS: { value: string; label: string }[] = [
  ...ADMIN_ORDER_STATUS_OPTIONS,
  { value: "cancellation_requested", label: "Cancellation requested" },
  { value: "awaiting_refund", label: "Awaiting refund" },
  { value: "refunded", label: "Refunded" },
];

/** After a line cancellation/refund request, only these statuses stay available. */
export const ADMIN_ITEM_REFUND_FLOW_OPTIONS: { value: string; label: string }[] = [
  { value: "cancellation_requested", label: "Cancellation requested" },
  { value: "awaiting_refund", label: "Awaiting refund" },
  { value: "refunded", label: "Refunded" },
];

const ITEM_REFUND_FLOW = new Set(["cancellation_requested", "awaiting_refund", "refunded"]);

export function isItemRefundFlowStatus(status: string | null | undefined): boolean {
  return ITEM_REFUND_FLOW.has(canonicalOrderStatus(status));
}

export function adminItemStatusOptionsFor(status: string | null | undefined): {
  value: string;
  label: string;
}[] {
  if (isItemRefundFlowStatus(status)) return ADMIN_ITEM_REFUND_FLOW_OPTIONS;
  return ADMIN_ITEM_STATUS_OPTIONS;
}

const ADMIN_LABELS: Record<string, string> = Object.fromEntries(
  ADMIN_ITEM_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

/** Map legacy DB values to the current pipeline for labels / progress / descriptions. */
export function canonicalOrderStatus(raw: string | null | undefined): string {
  const s = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const legacy: Record<string, string> = {
    pending: "awaiting_artwork",
    complete: "completed",
    delivered: "completed",
    approval_needed: "awaiting_customer_approval",
    refund: "awaiting_refund",
    cancelled: "cancelled",
    canceled: "cancelled",
    cancellation_requested: "cancellation_requested",
  };
  return legacy[s] ?? s;
}

export function adminOrderStatusLabel(status: string | null | undefined): string {
  const s = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  if (ADMIN_LABELS[s]) return ADMIN_LABELS[s];
  const c = canonicalOrderStatus(s);
  if (ADMIN_LABELS[c]) return ADMIN_LABELS[c];
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Customer-facing copy for expanded order details only (not shown on admin).
 * pending_payment uses a dedicated checkout message in the UI.
 */
export function customerOrderStatusDescription(
  status: string | null | undefined
): string | null {
  const c = canonicalOrderStatus(status);
  switch (c) {
    case "pending_payment":
      return null;
    case "awaiting_artwork":
      return "We're waiting to receive your artwork files for this job. Upload your files if you have not already.";
    case "cancellation_requested":
      return "Your cancellation request has been received and is awaiting admin review.";
    case "on_hold":
      return "There's an issue with your job. We'll email you with further instructions.";
    case "awaiting_customer_approval":
      return "Please check your email to approve the proofs we sent.";
    case "processing":
      return "Your job has been received and is being prepared for printing.";
    case "printing":
      return "Your job is on the press and being printed.";
    case "trimming":
      return "Your job is in the final stages, being trimmed and prepared for delivery.";
    case "shipped":
      return "Your job has been shipped. The shipping label is created, and the carrier has the package.";
    case "completed":
      return "Your order is complete.";
    case "reprint":
      return "Your job is being reprinted.";
    case "awaiting_refund":
      return "Your order is cancelled. Refund is in process. The accounting department is processing it.";
    case "refunded":
      return "Your refund has been successfully processed. It may take a few business days for the amount to reflect in your account. Thank you for your patience.";
    case "cancelled":
      return "Unfortunately, your order has been cancelled.";
    default:
      return null;
  }
}

export function customerOrderStatusTitle(status: string | null | undefined): string {
  return adminOrderStatusLabel(status);
}

export function isOrderStatusLocked(status: string | null | undefined): boolean {
  const s = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  return s === "completed" || s === "complete" || s === "delivered" || s === "refunded";
}

const REFUND_LIKE = new Set(["awaiting_refund", "refunded", "refund"]);

export function isRefundLikeStatus(status: string | null | undefined): boolean {
  const c = canonicalOrderStatus(status);
  return REFUND_LIKE.has(c);
}

/** Item statuses where a per-line Cancel item control may be shown. */
const ITEM_CANCEL_ALLOWED = new Set(["awaiting_artwork", "on_hold", "processing"]);

const ITEM_INACTIVE_STATUSES = new Set([
  "cancellation_requested",
  "awaiting_refund",
  "refunded",
  "cancelled",
]);

const WHOLE_ORDER_CANCEL_FLOW = new Set([
  "cancellation_requested",
  "awaiting_refund",
  "refunded",
  "cancelled",
]);

export function isInactiveOrderItemStatus(status: string | null | undefined): boolean {
  return ITEM_INACTIVE_STATUSES.has(canonicalOrderStatus(status));
}

export function isWholeOrderCancelFlow(status: string | null | undefined): boolean {
  return WHOLE_ORDER_CANCEL_FLOW.has(canonicalOrderStatus(status));
}

export function countActiveOrderItems(
  items: Array<{ status?: string | null } | null | undefined> | null | undefined
): number {
  if (!Array.isArray(items)) return 0;
  return items.filter((it) => it && !isInactiveOrderItemStatus(it.status)).length;
}

export function canShowItemCancelColumn(
  orderStatus: string | null | undefined,
  items: Array<{ status?: string | null } | null | undefined> | null | undefined
): boolean {
  if (isWholeOrderCancelFlow(orderStatus)) return false;
  return countActiveOrderItems(items) > 1;
}

/**
 * Show Cancel item only when the line is in an allowed status, the order is not in
 * the whole-order cancel/refund flow, and more than one active line remains.
 */
export function canCancelOrderItem(
  itemStatus: string | null | undefined,
  options?: {
    orderStatus?: string | null;
    items?: Array<{ status?: string | null } | null | undefined> | null;
    activeCount?: number | null;
  }
): boolean {
  if (isWholeOrderCancelFlow(options?.orderStatus)) return false;
  const active =
    options?.activeCount != null
      ? Number(options.activeCount)
      : countActiveOrderItems(options?.items);
  if (Number.isFinite(active) && active <= 1) return false;
  return ITEM_CANCEL_ALLOWED.has(canonicalOrderStatus(itemStatus));
}

/** When set, step 1 of the customer progress bar shows this label instead of "Pre-production". */
const FIRST_STEP_DYNAMIC_LABEL_STATUSES = new Set([
  "awaiting_artwork",
  "cancellation_requested",
  "on_hold",
  "awaiting_customer_approval",
  "reprint",
  "awaiting_refund",
  "refunded",
]);

export function customerOrderProgressFirstStepLabel(status: string | null | undefined): string {
  const c = canonicalOrderStatus(status);
  if (FIRST_STEP_DYNAMIC_LABEL_STATUSES.has(c)) {
    return customerOrderStatusTitle(status);
  }
  return "Pre-production";
}

/** For customer progress UI: 1–5 = pipeline stage; special strings otherwise. */
export function customerOrderProgressKind(
  status: string | null | undefined
): "awaiting_payment" | "cancelled" | { stage: number } {
  const raw = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  if (raw === "pending_payment") return "awaiting_payment";
  const c = canonicalOrderStatus(status);
  if (c === "cancelled") return "cancelled";
  if (REFUND_LIKE.has(c)) return { stage: 1 };
  if (c === "completed") return { stage: 5 };
  if (c === "shipped") return { stage: 4 };
  if (c === "trimming") return { stage: 3 };
  if (c === "printing" || c === "reprint" || c === "processing") return { stage: 2 };
  if (c === "awaiting_artwork" || c === "cancellation_requested" || c === "on_hold" || c === "awaiting_customer_approval")
    return { stage: 1 };
  return { stage: 1 };
}

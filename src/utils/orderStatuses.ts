/**
 * Canonical order job statuses (API / DB snake_case).
 * Keep in sync with VALID_ORDER_STATUSES in rps-backend orderController.js
 */

export const ADMIN_ORDER_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "pending_payment", label: "Pending payment" },
  { value: "awaiting_artwork", label: "Awaiting artwork" },
  { value: "on_hold", label: "On hold" },
  { value: "printing", label: "Printing" },
  { value: "trimming", label: "Trimming" },
  { value: "shipped", label: "Shipped" },
  { value: "completed", label: "Completed" },
  { value: "reprint", label: "Reprint" },
  { value: "cancelled", label: "Cancelled" },
];

const ADMIN_LABELS: Record<string, string> = Object.fromEntries(
  ADMIN_ORDER_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

/** Map legacy DB values to the current pipeline for labels / progress / descriptions. */
export function canonicalOrderStatus(raw: string | null | undefined): string {
  const s = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const legacy: Record<string, string> = {
    pending: "awaiting_artwork",
    processing: "printing",
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
  if (c === "printing" || c === "reprint") return { stage: 2 };
  if (c === "awaiting_artwork" || c === "cancellation_requested" || c === "on_hold" || c === "awaiting_customer_approval")
    return { stage: 1 };
  return { stage: 1 };
}

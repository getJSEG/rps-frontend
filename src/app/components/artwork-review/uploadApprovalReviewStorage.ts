export const REVIEW_PLACEHOLDER_FILE_NAME = "\u2014";
import { coercePositiveInch } from "../../../utils/artworkProportion";

/** Populated by Upload Approval before navigating to the review-ok screen. */
export const UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY = "uploadApprovalReviewContext";

/** Same-order jobs still awaiting artwork — shown in the review page left column. */
export const UPLOAD_APPROVAL_PENDING_JOBS_KEY = "uploadApprovalPendingJobs";

/** Guest flow: "Back to upload list" navigates here (path + query). */
export const UPLOAD_APPROVAL_GUEST_RETURN_URL_KEY = "uploadApprovalGuestReturnUrl";

/** Per-orderItemId map of unsaved review contexts — survives switching jobs in the sidebar. */
const UPLOAD_APPROVAL_REVIEW_DRAFTS_KEY = "uploadApprovalReviewDrafts";
export function clearGuestUploadReturnUrl(): void {
  try {
    sessionStorage.removeItem(UPLOAD_APPROVAL_GUEST_RETURN_URL_KEY);
  } catch {
    /* ignore */
  }
}

export function setGuestUploadReturnUrl(orderId: number, guestTrackingToken: string): void {
  const id = Number(orderId);
  const t = String(guestTrackingToken || "").trim();
  if (!Number.isFinite(id) || id <= 0 || !t) return;
  try {
    const path = `/guest-orders/${id}?token=${encodeURIComponent(t)}&placed=1`;
    sessionStorage.setItem(UPLOAD_APPROVAL_GUEST_RETURN_URL_KEY, path);
  } catch {
    /* ignore */
  }
}

export function consumeGuestUploadReturnUrl(): string | null {
  try {
    const u = sessionStorage.getItem(UPLOAD_APPROVAL_GUEST_RETURN_URL_KEY)?.trim();
    if (!u) return null;
    sessionStorage.removeItem(UPLOAD_APPROVAL_GUEST_RETURN_URL_KEY);
    return u;
  } catch {
    return null;
  }
}

export type StoredPendingJobLine = {
  orderId: number;
  orderItemId: number | null;
  jobIdLabel: string;
  jobName: string;
  product: string;
  dimensions: string;
  quantity: number;
  /** For ratio checks when switching jobs on the review page */
  requiredWidthIn?: number | null;
  requiredHeightIn?: number | null;
  isGraphicScenario?: boolean;
  orderedAtLabel?: string;
  /** True once the customer has approved artwork for this job in the current session. */
  hasArtwork?: boolean;
  /** Saved artwork URL from the backend — present when hasArtwork is true. */
  artworkUrl?: string | null;
};

export type StoredUploadReviewContext = {
  jobIdLabel?: string;
  orderedAtLabel?: string;
  jobName?: string;
  product?: string;
  dimensions?: string;
  quantity?: number;
  /** When set, "Approve" can persist artwork to this order line. */
  orderId?: number;
  orderItemId?: number;
  /** Guest order tracking token — when set, approve uses guest API instead of JWT. */
  guestTrackingToken?: string;
  fileName?: string;
  /** Base64 data URL — survives full page reload (used for smaller files). */
  previewDataUrl?: string;
  /** `blob:` URL — does not survive reload; revoke when replacing */
  previewUrl?: string;
  previewMime?: string;
  /** Required print size (inches) from order line — used for client-side ratio check. */
  requiredWidthIn?: number;
  requiredHeightIn?: number;
  isGraphicScenario?: boolean;
  /** Display strings for error page */
  uploadedGraphicLabel?: string;
  requiredGraphicLabel?: string;
  /** From extractUploadFileMetadata — same as My Artworks row display */
  uploadedWidthPx?: number;
  uploadedHeightPx?: number;
  uploadedSizeBytes?: number;
  /** True when the customer has already approved artwork for this job in a previous step. */
  hasArtwork?: boolean;
};

function fmtInch(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

/** Display string for required print size from a pending line (numeric inches preferred). */
function requiredGraphicLabelFromPendingLine(row: StoredPendingJobLine): string {
  const dims = row.dimensions?.trim() ? row.dimensions : "—";
  const rw = coercePositiveInch(row.requiredWidthIn);
  const rh = coercePositiveInch(row.requiredHeightIn);
  if (rw != null && rh != null) {
    return `${fmtInch(rw)}" × ${fmtInch(rh)}"`;
  }
  return dims;
}

/** Session context for a pending line before any file is chosen (error review / job switch). */
export function reviewContextFromPendingLine(row: StoredPendingJobLine): StoredUploadReviewContext | null {
  if (row.orderItemId == null || !Number.isFinite(row.orderItemId) || row.orderItemId <= 0) {
    return null;
  }
  const dims = row.dimensions?.trim() ? row.dimensions : "—";
  const rw = coercePositiveInch(row.requiredWidthIn);
  const rh = coercePositiveInch(row.requiredHeightIn);
  const alreadyApproved = row.hasArtwork === true;

  /** Build a proxied preview URL from the saved backend artwork URL so the image is displayable. */
  let savedPreviewUrl: string | undefined;
  let savedFileName: string | undefined;
  if (alreadyApproved && row.artworkUrl) {
    const src = row.artworkUrl.trim();
    if (src) {
      savedPreviewUrl = `/api/artwork-file?source=${encodeURIComponent(src)}`;
      try {
        const u = new URL(src);
        const parts = u.pathname.split("/");
        const last = parts[parts.length - 1] || "";
        if (last) savedFileName = decodeURIComponent(last);
      } catch {
        /* ignore — fileName stays undefined */
      }
    }
  }

  return {
    jobIdLabel: row.jobIdLabel,
    orderedAtLabel: row.orderedAtLabel?.trim() || "—",
    jobName: row.jobName,
    product: row.product,
    dimensions: dims,
    quantity: row.quantity,
    orderId: row.orderId,
    orderItemId: row.orderItemId,
    requiredWidthIn: rw ?? undefined,
    requiredHeightIn: rh ?? undefined,
    isGraphicScenario: row.isGraphicScenario === true,
    requiredGraphicLabel: requiredGraphicLabelFromPendingLine(row),
    uploadedGraphicLabel: alreadyApproved ? "Previously uploaded" : "Not uploaded yet",
    fileName: savedFileName ?? REVIEW_PLACEHOLDER_FILE_NAME,
    previewUrl: savedPreviewUrl,
    hasArtwork: alreadyApproved,
  };
}

/** Drops one line from the pending-jobs list after artwork is saved for that order item. */
export function removePendingJobLineFromSession(orderItemId: number): void {
  try {
    const raw = sessionStorage.getItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return;
    const next = (arr as StoredPendingJobLine[]).filter(
      (j) => j.orderItemId !== orderItemId
    );
    if (next.length > 0) {
      sessionStorage.setItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY, JSON.stringify(next));
    } else {
      sessionStorage.removeItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY);
    }
  } catch {
    /* ignore */
  }
}

type DraftsMap = Record<string, StoredUploadReviewContext>;

function readDrafts(): DraftsMap {
  try {
    const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as DraftsMap;
    }
    return {};
  } catch {
    return {};
  }
}

function writeDrafts(map: DraftsMap): void {
  try {
    if (Object.keys(map).length === 0) {
      sessionStorage.removeItem(UPLOAD_APPROVAL_REVIEW_DRAFTS_KEY);
      return;
    }
    sessionStorage.setItem(UPLOAD_APPROVAL_REVIEW_DRAFTS_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota errors */
  }
}

/** Persist a context as a per-orderItemId draft. No-op if the context has no preview. */
export function saveReviewDraft(ctx: StoredUploadReviewContext | null | undefined): void {
  if (!ctx) return;
  const id = ctx.orderItemId;
  if (id == null || !Number.isFinite(id) || id <= 0) return;
  const hasFile = Boolean(ctx.previewDataUrl?.trim() || ctx.previewUrl?.trim());
  if (!hasFile) return;
  const map = readDrafts();
  map[String(id)] = ctx;
  writeDrafts(map);
}

/** Read the saved draft for an order line, if any. */
export function loadReviewDraft(orderItemId: number): StoredUploadReviewContext | null {
  if (!Number.isFinite(orderItemId) || orderItemId <= 0) return null;
  const map = readDrafts();
  return map[String(orderItemId)] ?? null;
}

/** Drop a single draft (and revoke its blob URL if any). Called after Approve / explicit reset. */
export function removeReviewDraft(orderItemId: number): void {
  if (!Number.isFinite(orderItemId) || orderItemId <= 0) return;
  const map = readDrafts();
  const key = String(orderItemId);
  const ctx = map[key];
  if (!ctx) return;
  if (typeof ctx.previewUrl === "string" && ctx.previewUrl.startsWith("blob:")) {
    try { URL.revokeObjectURL(ctx.previewUrl); } catch { /* ignore */ }
  }
  delete map[key];
  writeDrafts(map);
}

/** Remove every draft (revoking blob URLs). Used on Upload Approval list mount. */
export function clearAllReviewDrafts(): void {
  const map = readDrafts();
  for (const ctx of Object.values(map)) {
    if (typeof ctx?.previewUrl === "string" && ctx.previewUrl.startsWith("blob:")) {
      try { URL.revokeObjectURL(ctx.previewUrl); } catch { /* ignore */ }
    }
  }
  try { sessionStorage.removeItem(UPLOAD_APPROVAL_REVIEW_DRAFTS_KEY); } catch { /* ignore */ }
}

/**
 * Mark an order item as having approved artwork in the pending-jobs session list.
 * The row stays in the list (so UploadApproval shows it with a Reupload option);
 * only the hasArtwork flag is updated.
 */
export function markPendingJobArtworkApproved(orderItemId: number, artworkUrl?: string): void {
  try {
    const raw = sessionStorage.getItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return;
    const next = (arr as StoredPendingJobLine[]).map((j) =>
      j.orderItemId === orderItemId
        ? { ...j, hasArtwork: true, artworkUrl: artworkUrl ?? j.artworkUrl ?? null }
        : j
    );
    sessionStorage.setItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  /** Also stamp the active review context so the upload page shows "already approved" state. */
  try {
    const ctxRaw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
    if (!ctxRaw) return;
    const ctx = JSON.parse(ctxRaw) as StoredUploadReviewContext;
    if (ctx.orderItemId === orderItemId) {
      ctx.hasArtwork = true;
      if (artworkUrl) ctx.previewUrl = `/api/artwork-file?source=${encodeURIComponent(artworkUrl)}`;
      sessionStorage.setItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY, JSON.stringify(ctx));
    }
  } catch {
    /* ignore */
  }
}

/** Revoke blob URL stored in the current context (call before removeItem or replace). */
export function revokeStoredUploadPreview(): void {
  try {
    const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as StoredUploadReviewContext;
    if (typeof p.previewUrl !== "string" || !p.previewUrl.startsWith("blob:")) return;
    /** Don't revoke if a saved draft still references this blob — switching jobs would lose it otherwise. */
    const drafts = readDrafts();
    const stillReferenced = Object.values(drafts).some((d) => d.previewUrl === p.previewUrl);
    if (stillReferenced) return;
    URL.revokeObjectURL(p.previewUrl);
  } catch {
    /* ignore */
  }
}

/** Populated by Upload Approval before navigating to the review-ok screen. */
export const UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY = "uploadApprovalReviewContext";

export type StoredUploadReviewContext = {
  jobIdLabel?: string;
  orderedAtLabel?: string;
  jobName?: string;
  product?: string;
  dimensions?: string;
  quantity?: number;
  fileName?: string;
  /** Base64 data URL — survives full page reload (used for smaller files). */
  previewDataUrl?: string;
  /** `blob:` URL — does not survive reload; revoke when replacing */
  previewUrl?: string;
  previewMime?: string;
  /** Required print size (inches) from order line — used for client-side ratio check. */
  requiredWidthIn?: number;
  requiredHeightIn?: number;
  /** Display strings for error page */
  uploadedGraphicLabel?: string;
  requiredGraphicLabel?: string;
};

/** Revoke blob URL stored in the current context (call before removeItem or replace). */
export function revokeStoredUploadPreview(): void {
  try {
    const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as StoredUploadReviewContext;
    if (typeof p.previewUrl === "string" && p.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(p.previewUrl);
    }
  } catch {
    /* ignore */
  }
}

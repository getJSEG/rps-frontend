import { isAuthenticated } from "../../../utils/roles";
import {
  consumeGuestUploadReturnUrl,
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  type StoredUploadReviewContext,
} from "./uploadApprovalReviewStorage";

/** Guest / logged-out: path to order tracking when context has token + order id. */
export function getGuestOrdersPathFromReviewContext(): string | null {
  try {
    const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as StoredUploadReviewContext;
    const oid = p.orderId;
    const tok = typeof p.guestTrackingToken === "string" ? p.guestTrackingToken.trim() : "";
    if (oid == null || !Number.isFinite(Number(oid)) || Number(oid) <= 0 || !tok) return null;
    return `/guest-orders/${Number(oid)}?token=${encodeURIComponent(tok)}&placed=1`;
  } catch {
    return null;
  }
}

/** My Artworks library requires login — hide for guests / logged-out users. */
export function shouldHideArtworkLibrary(): boolean {
  if (typeof window === "undefined") return true;
  return !isAuthenticated();
}

export function artworkReviewBackButtonLabel(): "Back to order" | "Back to upload list" {
  return shouldHideArtworkLibrary() ? "Back to order" : "Back to upload list";
}

/**
 * After review: guest order page if token context exists, else upload list (logged in) or home (logged out).
 */
export function navigateBackFromArtworkReview(router: { push: (href: string) => void }): void {
  const fromSessionKey = consumeGuestUploadReturnUrl();
  if (fromSessionKey) {
    router.push(fromSessionKey);
    return;
  }
  const fromCtx = getGuestOrdersPathFromReviewContext();
  if (fromCtx) {
    router.push(fromCtx);
    return;
  }
  if (isAuthenticated()) {
    router.push("/upload-approval");
  } else {
    router.push("/");
  }
}

import {
  UPLOAD_APPROVAL_PENDING_JOBS_KEY,
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  revokeStoredUploadPreview,
  reviewContextFromPendingLine,
  type StoredPendingJobLine,
  type StoredUploadReviewContext,
} from "./uploadApprovalReviewStorage";
import type { PendingJob } from "../../../utils/uploadApprovalPending";

export const UPLOAD_REVIEW_ERROR_CLIENT_PATH = "/upload-approval/review/error" as const;

function formatJobDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function pendingJobToStoredLine(j: PendingJob): StoredPendingJobLine {
  return {
    orderId: j.orderId,
    orderItemId: j.orderItemId,
    jobIdLabel: j.jobIdLabel,
    jobName: j.jobName,
    product: j.productLabel,
    dimensions: j.dimensions?.trim() ? j.dimensions : "—",
    quantity: j.quantity,
    requiredWidthIn: j.requiredWidthIn,
    requiredHeightIn: j.requiredHeightIn,
    orderedAtLabel: formatJobDate(j.orderedAt),
  };
}

function persistPendingJobsLines(jobs: PendingJob[]) {
  try {
    if (!jobs?.length) {
      sessionStorage.removeItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY);
      return;
    }
    const lines: StoredPendingJobLine[] = jobs.map(pendingJobToStoredLine);
    sessionStorage.setItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
}

function placeholderReviewContext(job: PendingJob): StoredUploadReviewContext {
  const ctx = reviewContextFromPendingLine(pendingJobToStoredLine(job));
  if (!ctx) {
    throw new Error("Missing order line for review context");
  }
  return ctx;
}

/** First pending line that can open the file review UI (needs a real order_items id). */
export function pickFirstOpenablePendingJob(jobs: PendingJob[]): PendingJob | null {
  const j = jobs.find(
    (x) => x.orderItemId != null && Number.isFinite(x.orderItemId) && Number(x.orderItemId) > 0
  );
  return j ?? null;
}

/**
 * Same session keys as Upload Approval → "Upload artwork" on a job: sidebar lines + placeholder review context.
 * @param job Line to show first
 * @param orderJobs All pending lines for that order (for job switcher)
 */
export function writeUploadReviewSessionForJob(job: PendingJob, orderJobs: PendingJob[]): void {
  if (job.orderItemId == null || !Number.isFinite(job.orderItemId) || job.orderItemId <= 0) {
    throw new Error("NO_ITEM_ID");
  }
  revokeStoredUploadPreview();
  persistPendingJobsLines(orderJobs);
  sessionStorage.setItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY, JSON.stringify(placeholderReviewContext(job)));
}

import {
  MAX_PREVIEW_FILE_BYTES,
  guessMimeFromFileName,
  readFileAsDataURL,
} from "../../../utils/filePreview";
import {
  assessArtworkProportionFromMetadata,
  coercePositiveInch,
} from "../../../utils/artworkProportion";
import { extractUploadFileMetadata } from "../../../utils/uploadMetadata";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";
import {
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  revokeStoredUploadPreview,
  type StoredUploadReviewContext,
} from "./uploadApprovalReviewStorage";

export type ArtworkJobFields = {
  jobIdLabel: string;
  orderedAtLabel: string;
  jobName: string;
  product: string;
  dimensions: string;
  quantity: number;
  requiredWidthIn: number | null;
  requiredHeightIn: number | null;
  orderId?: number;
  orderItemId?: number;
};

export const UPLOAD_APPROVAL_REVIEW_OK_ROUTE = "/upload-approval/review/ok" as const;
export const UPLOAD_APPROVAL_REVIEW_ERROR_ROUTE = "/upload-approval/review/error" as const;

export type BuildArtworkPayloadResult = {
  payload: StoredUploadReviewContext;
  nextPath: typeof UPLOAD_APPROVAL_REVIEW_OK_ROUTE | typeof UPLOAD_APPROVAL_REVIEW_ERROR_ROUTE;
};

/**
 * Builds session payload (preview + job + proportion labels) and chooses OK vs error route.
 */
export async function buildArtworkReviewPayload(
  file: File,
  job: ArtworkJobFields
): Promise<BuildArtworkPayloadResult> {
  revokeStoredUploadPreview();

  const previewMime = (file.type || "").trim() || guessMimeFromFileName(file.name);
  /** Same order as My Artworks: metadata first, then aspect check. */
  const meta = await extractUploadFileMetadata(file);
  const proportion = assessArtworkProportionFromMetadata(meta, job.requiredWidthIn, job.requiredHeightIn);

  const reqW = coercePositiveInch(job.requiredWidthIn);
  const reqH = coercePositiveInch(job.requiredHeightIn);

  const payload: StoredUploadReviewContext = {
    jobIdLabel: job.jobIdLabel,
    orderedAtLabel: job.orderedAtLabel,
    jobName: job.jobName,
    product: job.product,
    dimensions: job.dimensions,
    quantity: job.quantity,
    fileName: file.name,
    previewMime,
    ...(job.orderId != null && Number.isFinite(job.orderId) && job.orderId > 0 ? { orderId: job.orderId } : {}),
    ...(job.orderItemId != null && Number.isFinite(job.orderItemId) && job.orderItemId > 0
      ? { orderItemId: job.orderItemId }
      : {}),
    requiredWidthIn: reqW ?? undefined,
    requiredHeightIn: reqH ?? undefined,
    uploadedGraphicLabel: proportion.uploadedLabel,
    requiredGraphicLabel: proportion.requiredLabel,
    ...(meta.widthPx != null &&
    meta.heightPx != null &&
    meta.widthPx > 0 &&
    meta.heightPx > 0
      ? {
          uploadedWidthPx: meta.widthPx,
          uploadedHeightPx: meta.heightPx,
          uploadedSizeBytes: meta.sizeBytes,
        }
      : {}),
  };

  if (file.size <= MAX_PREVIEW_FILE_BYTES) {
    payload.previewDataUrl = await readFileAsDataURL(file);
  } else {
    payload.previewUrl = URL.createObjectURL(file);
  }

  const write = (p: StoredUploadReviewContext) => {
    sessionStorage.setItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY, JSON.stringify(p));
  };

  let storedPayload = payload;

  try {
    write(payload);
  } catch {
    if (payload.previewDataUrl) {
      revokeStoredUploadPreview();
      const fallback: StoredUploadReviewContext = {
        ...payload,
        previewDataUrl: undefined,
        previewUrl: URL.createObjectURL(file),
      };
      write(fallback);
      storedPayload = fallback;
    } else {
      throw new Error("Could not save preview.");
    }
  }

  return {
    payload: storedPayload,
    nextPath: proportion.ok ? UPLOAD_APPROVAL_REVIEW_OK_ROUTE : UPLOAD_APPROVAL_REVIEW_ERROR_ROUTE,
  };
}

function demoFallbackContext(): StoredUploadReviewContext {
  return {
    jobIdLabel: ARTWORK_REVIEW_DEMO.jobIdLabel,
    orderedAtLabel: ARTWORK_REVIEW_DEMO.orderedAtLabel,
    jobName: ARTWORK_REVIEW_DEMO.jobName,
    product: ARTWORK_REVIEW_DEMO.product,
    dimensions: ARTWORK_REVIEW_DEMO.dimensions,
    quantity: ARTWORK_REVIEW_DEMO.quantity,
    fileName: ARTWORK_REVIEW_DEMO.fileNameOk,
    previewMime: "application/pdf",
    requiredWidthIn: ARTWORK_REVIEW_DEMO.requiredInches.w,
    requiredHeightIn: ARTWORK_REVIEW_DEMO.requiredInches.h,
  };
}

function contextToJob(ctx: StoredUploadReviewContext): ArtworkJobFields {
  return {
    jobIdLabel: ctx.jobIdLabel ?? "",
    orderedAtLabel: ctx.orderedAtLabel ?? "",
    jobName: ctx.jobName ?? "",
    product: ctx.product ?? "",
    dimensions: ctx.dimensions ?? "",
    quantity:
      typeof ctx.quantity === "number" && Number.isFinite(ctx.quantity) ? ctx.quantity : 1,
    requiredWidthIn: coercePositiveInch(ctx.requiredWidthIn),
    requiredHeightIn: coercePositiveInch(ctx.requiredHeightIn),
    orderId:
      ctx.orderId != null && Number.isFinite(ctx.orderId) && ctx.orderId > 0 ? ctx.orderId : undefined,
    orderItemId:
      ctx.orderItemId != null && Number.isFinite(ctx.orderItemId) && ctx.orderItemId > 0
        ? ctx.orderItemId
        : undefined,
  };
}

/**
 * Reupload from review screens: rebuild preview + proportion check, write session, return navigation target.
 */
export async function commitFilePreviewToSession(
  file: File,
  existing: StoredUploadReviewContext | null
): Promise<{
  previewSrc: string;
  previewMime: string;
  fileName: string;
  nextPath: typeof UPLOAD_APPROVAL_REVIEW_OK_ROUTE | typeof UPLOAD_APPROVAL_REVIEW_ERROR_ROUTE;
}> {
  const base =
    existing && typeof existing.jobIdLabel === "string" && existing.jobIdLabel.trim() !== ""
      ? existing
      : demoFallbackContext();

  const { payload, nextPath } = await buildArtworkReviewPayload(file, contextToJob(base));

  return {
    previewSrc: (payload.previewDataUrl || payload.previewUrl)!,
    previewMime: payload.previewMime ?? "",
    fileName: payload.fileName ?? file.name,
    nextPath,
  };
}

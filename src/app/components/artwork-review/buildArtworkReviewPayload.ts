import {
  MAX_PREVIEW_FILE_BYTES,
  guessMimeFromFileName,
  readFileAsDataURL,
} from "../../../utils/filePreview";
import { assessArtworkProportion } from "../../../utils/artworkProportion";
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
};

const OK_PATH = "/upload-approval/review/ok" as const;
const ERR_PATH = "/upload-approval/review/error" as const;

export type BuildArtworkPayloadResult = {
  payload: StoredUploadReviewContext;
  nextPath: typeof OK_PATH | typeof ERR_PATH;
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
  const proportion = await assessArtworkProportion(file, job.requiredWidthIn, job.requiredHeightIn);

  const payload: StoredUploadReviewContext = {
    jobIdLabel: job.jobIdLabel,
    orderedAtLabel: job.orderedAtLabel,
    jobName: job.jobName,
    product: job.product,
    dimensions: job.dimensions,
    quantity: job.quantity,
    fileName: file.name,
    previewMime,
    requiredWidthIn:
      job.requiredWidthIn != null && Number.isFinite(job.requiredWidthIn)
        ? job.requiredWidthIn
        : undefined,
    requiredHeightIn:
      job.requiredHeightIn != null && Number.isFinite(job.requiredHeightIn)
        ? job.requiredHeightIn
        : undefined,
    uploadedGraphicLabel: proportion.uploadedLabel,
    requiredGraphicLabel: proportion.requiredLabel,
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
    nextPath: proportion.ok ? OK_PATH : ERR_PATH,
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
    requiredWidthIn:
      ctx.requiredWidthIn != null && Number.isFinite(ctx.requiredWidthIn)
        ? ctx.requiredWidthIn
        : null,
    requiredHeightIn:
      ctx.requiredHeightIn != null && Number.isFinite(ctx.requiredHeightIn)
        ? ctx.requiredHeightIn
        : null,
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
  nextPath: typeof OK_PATH | typeof ERR_PATH;
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

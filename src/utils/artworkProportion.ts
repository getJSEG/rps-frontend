import type { UploadFileMetadata } from "./uploadMetadata";

const DEFAULT_DISPLAY_DPI = 300;
/**
 * Relative aspect difference allowed — keep in sync with backend
 * `rps-backend/src/controllers/artworkController.js` (`RATIO_TOLERANCE` / `aspectMatch`).
 */
const RATIO_TOLERANCE = 0.06;

function fmtInch(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

/** Convert pixel size to inch labels assuming print DPI (display-only until API). */
export function formatInchesFromPixels(pxW: number, pxH: number, dpi = DEFAULT_DISPLAY_DPI): string {
  return `${fmtInch(pxW / dpi)}" × ${fmtInch(pxH / dpi)}"`;
}

function aspectRatiosMatch(pxW: number, pxH: number, reqW: number, reqH: number): boolean {
  if (pxW <= 0 || pxH <= 0 || reqW <= 0 || reqH <= 0) return true;
  const rU = pxW / pxH;
  const rR = reqW / reqH;
  const rel = Math.abs(rU - rR) / rR;
  return rel <= RATIO_TOLERANCE;
}

/** Match required print aspect, allowing artwork rotated 90° (swap W/H vs job). */
function aspectRatiosMatchPrintJob(pxW: number, pxH: number, reqW: number, reqH: number): boolean {
  return (
    aspectRatiosMatch(pxW, pxH, reqW, reqH) || aspectRatiosMatch(pxW, pxH, reqH, reqW)
  );
}

function requiredSizeLabel(reqW: number, reqH: number): string {
  return `${fmtInch(reqW)}" × ${fmtInch(reqH)}"`;
}

/** Coerce API/session values (may be string) to a positive finite inch value. */
export function coercePositiveInch(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v.trim()) : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ProportionAssessment = {
  ok: boolean;
  uploadedLabel: string;
  requiredLabel: string;
};

/**
 * Aspect check using metadata from `extractUploadFileMetadata` (same path as My Artworks).
 */
export function assessArtworkProportionFromMetadata(
  meta: UploadFileMetadata,
  requiredWidthIn: number | null,
  requiredHeightIn: number | null
): ProportionAssessment {
  const reqW = coercePositiveInch(requiredWidthIn);
  const reqH = coercePositiveInch(requiredHeightIn);

  if (reqW == null || reqH == null) {
    return {
      ok: true,
      uploadedLabel: "—",
      requiredLabel: "—",
    };
  }

  const requiredLabel = requiredSizeLabel(reqW, reqH);
  const uw = meta.widthPx;
  const uh = meta.heightPx;
  if (uw == null || uh == null || uw <= 0 || uh <= 0) {
    return {
      ok: false,
      uploadedLabel: "Could not read file dimensions.",
      requiredLabel,
    };
  }
  const ok = aspectRatiosMatchPrintJob(uw, uh, reqW, reqH);
  const uploadedLabel =
    meta.mimeType === "application/pdf"
      ? `${uw} × ${uh} pt (page)`
      : formatInchesFromPixels(uw, uh);
  return { ok, uploadedLabel, requiredLabel };
}

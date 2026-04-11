import { guessMimeFromFileName } from "./filePreview";

const DEFAULT_DISPLAY_DPI = 300;
const RATIO_TOLERANCE = 0.04;

function fmtInch(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

/** Convert pixel size to inch labels assuming print DPI (display-only until API). */
export function formatInchesFromPixels(pxW: number, pxH: number, dpi = DEFAULT_DISPLAY_DPI): string {
  return `${fmtInch(pxW / dpi)}" × ${fmtInch(pxH / dpi)}"`;
}

export function getImageDimensions(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}

function aspectRatiosMatch(pxW: number, pxH: number, reqW: number, reqH: number): boolean {
  if (pxW <= 0 || pxH <= 0 || reqW <= 0 || reqH <= 0) return true;
  const rU = pxW / pxH;
  const rR = reqW / reqH;
  const rel = Math.abs(rU - rR) / rR;
  return rel <= RATIO_TOLERANCE;
}

function requiredSizeLabel(reqW: number, reqH: number): string {
  return `${fmtInch(reqW)}" × ${fmtInch(reqH)}"`;
}

export type ProportionAssessment = {
  ok: boolean;
  uploadedLabel: string;
  requiredLabel: string;
};

/**
 * Client-only check until API exists. Raster images: compare aspect ratio to required print size.
 * PDF / unknown: cannot read dimensions in-browser → treat as OK (production will validate).
 */
export async function assessArtworkProportion(
  file: File,
  requiredWidthIn: number | null,
  requiredHeightIn: number | null
): Promise<ProportionAssessment> {
  const reqW =
    requiredWidthIn != null && requiredWidthIn !== "" ? Number(requiredWidthIn) : NaN;
  const reqH =
    requiredHeightIn != null && requiredHeightIn !== "" ? Number(requiredHeightIn) : NaN;

  if (!Number.isFinite(reqW) || !Number.isFinite(reqH) || reqW <= 0 || reqH <= 0) {
    return {
      ok: true,
      uploadedLabel: "—",
      requiredLabel: "—",
    };
  }

  const requiredLabel = requiredSizeLabel(reqW, reqH);
  const mime = (file.type || "").trim().toLowerCase() || guessMimeFromFileName(file.name);

  if (mime.startsWith("image/")) {
    try {
      const { w, h } = await getImageDimensions(file);
      const uploadedLabel = formatInchesFromPixels(w, h);
      const ok = aspectRatiosMatch(w, h, reqW, reqH);
      return { ok, uploadedLabel, requiredLabel };
    } catch {
      return {
        ok: true,
        uploadedLabel: "Could not read image",
        requiredLabel,
      };
    }
  }

  return {
    ok: true,
    uploadedLabel: mime.includes("pdf") ? "PDF (ratio check when API is ready)" : "—",
    requiredLabel,
  };
}

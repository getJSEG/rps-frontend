import type { Design } from "../../../utils/api";

/** Longest side of a blank canvas; matches the backend's DESIGN_TEMPLATE_MAX_PX default for templates. */
const BLANK_CANVAS_MAX_PX = 4000;

export type PrintSize = { widthIn: number; heightIn: number };

/** A design attached to one job on the product page. */
export type JobDesign = Design & {
  /** Print size the design was made for; blank-canvas/upload designs go stale when the size changes. */
  sizeKey: string | null;
};

export function printSizeKey(size: PrintSize | null): string | null {
  return size ? `${size.widthIn}x${size.heightIn}` : null;
}

/** White PNG in the job's shape, used as the editor source when the product has no template. */
export function blankCanvasDataUrl(size: PrintSize): string {
  const ratio = size.widthIn / size.heightIn;
  const width = ratio >= 1 ? BLANK_CANVAS_MAX_PX : Math.max(1, Math.round(BLANK_CANVAS_MAX_PX * ratio));
  const height = ratio >= 1 ? Math.max(1, Math.round(BLANK_CANVAS_MAX_PX / ratio)) : BLANK_CANVAS_MAX_PX;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  return canvas.toDataURL("image/png");
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not export the design."))), "image/png");
  });
}

export function isPdfDesign(design: Pick<Design, "mimeType"> | null | undefined): boolean {
  return String(design?.mimeType || "").toLowerCase() === "application/pdf";
}

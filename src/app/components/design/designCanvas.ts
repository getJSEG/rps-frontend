import type { Design } from "../../../utils/api";

/** Pixels per inch of a blank canvas; matches the editor's artboard ruler, so the canvas reads as the customer's size. */
const BLANK_CANVAS_PPI = 96;
/** Largest custom size the editor opens (13 ft × 10 ft, either orientation); bigger jobs upload print-ready artwork. */
const MAX_LONG_SIDE_IN = 13 * 12;
const MAX_SHORT_SIDE_IN = 10 * 12;

export type PrintSize = { widthIn: number; heightIn: number };

/** A design attached to one job on the product page. */
export type JobDesign = Design & {
  /** Print size the design was made for; blank-canvas/upload designs go stale when the size changes. */
  sizeKey: string | null;
};

export function printSizeKey(size: PrintSize | null): string | null {
  return size ? `${size.widthIn}x${size.heightIn}` : null;
}

/** Editor canvas size in pixels for a custom-size job: exactly the customer's width × height. */
export function blankCanvasSize(size: PrintSize): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(size.widthIn * BLANK_CANVAS_PPI)),
    height: Math.max(1, Math.round(size.heightIn * BLANK_CANVAS_PPI)),
  };
}

export function isBlankCanvasTooLarge(size: PrintSize): boolean {
  return (
    Math.max(size.widthIn, size.heightIn) > MAX_LONG_SIDE_IN || Math.min(size.widthIn, size.heightIn) > MAX_SHORT_SIDE_IN
  );
}

/** Placeholder source for a blank canvas: the editor sizes the canvas from `blankCanvasSize`, so a 1×1 white pixel is enough. */
export function blankCanvasDataUrl(): string {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
}

export function isPdfDesign(design: Pick<Design, "mimeType"> | null | undefined): boolean {
  return String(design?.mimeType || "").toLowerCase() === "application/pdf";
}

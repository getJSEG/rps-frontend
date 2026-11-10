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
  /** Exported SVG of a two-sided job's side, kept so both sides can be combined into one file. */
  svgFile?: Blob;
};

/** Two-sided jobs keep each side under its own key; the combined design stays under the job id. */
export function sideDesignKey(jobId: string, side: 1 | 2): string {
  return `${jobId}:side${side}`;
}

/**
 * A selected option named "Double Sided" / "Two-Sided", or "2 Sides" under a sides modifier (e.g. "# of Sides"),
 * makes each job two-sided. "2 Sides" under other modifiers (e.g. Hem) is about finishing, not printing.
 */
export function isTwoSidedOption(groupName: string, optionName: string): boolean {
  if (/\b(double|two)[\s-]*sided\b/i.test(optionName)) return true;
  return /\bsides?\b/i.test(groupName) && /\b(2|two)[\s-]*sid(e|es|ed)\b/i.test(optionName);
}

/** One SVG with side 1 on the left and side 2 on the right; ids are prefixed per side so they cannot clash. */
export async function combineSideSvgs(side1: Blob, side2: Blob): Promise<Blob> {
  const sides = await Promise.all(
    [side1, side2].map(async (blob, i) => {
      const prefix = `side${i + 1}-`;
      const svg = (await blob.text())
        .replace(/<\?xml[^>]*\?>/, "")
        .trim()
        .replace(/\bid="/g, `id="${prefix}`)
        .replace(/url\(#/g, `url(#${prefix}`)
        .replace(/href="#/g, `href="#${prefix}`);
      const rootTag = svg.match(/<svg\b[^>]*>/i)?.[0];
      const size = (name: string) => Number(rootTag?.match(new RegExp(`\\s${name}="([0-9.]+)"`))?.[1]);
      if (!rootTag || !(size("width") > 0) || !(size("height") > 0)) {
        throw new Error(`Could not read side ${i + 1}. Please save it again.`);
      }
      return { svg, rootTag, width: size("width"), height: size("height") };
    })
  );
  const [left, right] = sides;
  const width = left.width + right.width;
  const height = Math.max(left.height, right.height);
  const rightSvg = right.svg.replace(right.rootTag, right.rootTag.replace(/^<svg/i, `<svg x="${left.width}" y="0"`));
  const combined = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${left.svg}
${rightSvg}
</svg>`;
  return new Blob([combined], { type: "image/svg+xml" });
}

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

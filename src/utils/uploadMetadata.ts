import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export type UploadFileMetadata = {
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  pdfPageCount: number | null;
};

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "application/pdf"]);
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".pdf"];

function guessMimeType(file: File): string {
  const mime = String(file.type || "").trim().toLowerCase();
  const n = file.name.toLowerCase();

  /** Chrome/Linux often sends PDF as application/octet-stream — must not short-circuit on that. */
  if (mime === "application/x-pdf" || mime === "application/acrobat") {
    return "application/pdf";
  }
  const genericMime =
    mime === "" || mime === "application/octet-stream" || mime === "binary/octet-stream";
  if (genericMime) {
    if (n.endsWith(".pdf")) return "application/pdf";
    if (n.endsWith(".png")) return "image/png";
    if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
    return "";
  }
  if (mime) return mime;
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".pdf")) return "application/pdf";
  return "";
}

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isAllowedType(file: File, mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType) || hasAllowedExtension(file.name);
}

async function readImageDimensions(file: File): Promise<{ widthPx: number; heightPx: number }> {
  /** Prefer decode that respects EXIF orientation (common cause of false "wrong ratio"). */
  if (typeof createImageBitmap !== "undefined") {
    try {
      const bmp = await createImageBitmap(file);
      try {
        return { widthPx: bmp.width, heightPx: bmp.height };
      } finally {
        bmp.close();
      }
    } catch {
      /* fall through to Image() */
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not read image dimensions."));
      img.src = objectUrl;
    });
    return { widthPx: img.naturalWidth, heightPx: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readPdfSinglePageDimensions(
  file: File
): Promise<{ widthPx: number; heightPx: number; pageCount: number }> {
  const bytes = await file.arrayBuffer();
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  if (pageCount !== 1) {
    throw new Error("Only single-page PDF files are accepted.");
  }
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  return {
    widthPx: Math.round(viewport.width),
    heightPx: Math.round(viewport.height),
    pageCount,
  };
}

export async function extractUploadFileMetadata(file: File): Promise<UploadFileMetadata> {
  const mimeType = guessMimeType(file);
  if (!isAllowedType(file, mimeType)) {
    throw new Error("We only accept PNG, JPG and PDF (single page).");
  }

  if (mimeType.startsWith("image/")) {
    const imageDimensions = await readImageDimensions(file);
    return {
      mimeType,
      fileName: file.name,
      sizeBytes: file.size,
      widthPx: imageDimensions.widthPx,
      heightPx: imageDimensions.heightPx,
      pdfPageCount: null,
    };
  }

  if (mimeType === "application/pdf") {
    const pdfDimensions = await readPdfSinglePageDimensions(file);
    return {
      mimeType,
      fileName: file.name,
      sizeBytes: file.size,
      widthPx: pdfDimensions.widthPx,
      heightPx: pdfDimensions.heightPx,
      pdfPageCount: pdfDimensions.pageCount,
    };
  }

  throw new Error("We only accept PNG, JPG and PDF (single page).");
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { guessMimeFromFileName } from "../../../utils/filePreview";
import FeatherFlagArtworkPreview from "./FeatherFlagArtworkPreview";

type ArtworkReviewFilePreviewProps = {
  fileName: string;
  /** Data URL (persists after reload) or blob URL (session only) */
  previewSrc?: string | null;
  previewMime?: string | null;
  variant: "ok" | "error";
};

function isPdf(mime: string, name: string): boolean {
  const m = mime.toLowerCase();
  if (m.includes("pdf")) return true;
  if (m === "application/octet-stream" && /\.pdf$/i.test(name)) return true;
  return /\.pdf$/i.test(name);
}

function isRasterImage(mime: string): boolean {
  return /^image\/(jpeg|jpg|png|gif|webp|bmp)$/i.test(mime);
}

function PdfFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="h-[min(70vh,420px)] w-full bg-neutral-100">
      <object
        data={src}
        type="application/pdf"
        className="h-full w-full"
        aria-label={title}
      >
        <embed src={src} type="application/pdf" className="h-full w-full" title={title} />
      </object>
    </div>
  );
}

export default function ArtworkReviewFilePreview({
  fileName,
  previewSrc,
  previewMime,
  variant,
}: ArtworkReviewFilePreviewProps) {
  const [blobInvalid, setBlobInvalid] = useState(false);

  const mime = useMemo(
    () => ((previewMime || "").trim() || guessMimeFromFileName(fileName)).toLowerCase(),
    [previewMime, fileName]
  );

  useEffect(() => {
    if (!previewSrc?.startsWith("blob:")) {
      setBlobInvalid(false);
      return;
    }
    let cancelled = false;
    setBlobInvalid(false);
    fetch(previewSrc)
      .then((r) => {
        if (!cancelled && !r.ok) setBlobInvalid(true);
      })
      .catch(() => {
        if (!cancelled) setBlobInvalid(true);
      });
    return () => {
      cancelled = true;
    };
  }, [previewSrc]);

  const mode = useMemo(() => {
    if (!previewSrc || blobInvalid) return "schematic" as const;
    if (isRasterImage(mime)) return "image" as const;
    if (isPdf(mime, fileName)) return "pdf" as const;
    if (mime.startsWith("image/")) return "image" as const;
    return "schematic" as const;
  }, [previewSrc, mime, fileName, blobInvalid]);

  const showBlobReloadHint = Boolean(previewSrc?.startsWith("blob:")) && !blobInvalid;

  return (
    <div className="flex w-full max-w-md flex-col items-center">
      <div className="flex w-full max-w-[min(100%,320px)] items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        {mode === "image" && previewSrc ? (
          <img
            src={previewSrc}
            alt=""
            className="max-h-[min(70vh,420px)] w-full object-contain"
          />
        ) : mode === "pdf" && previewSrc ? (
          <PdfFrame src={previewSrc} title={fileName} />
        ) : (
          <div className="py-4">
            <FeatherFlagArtworkPreview variant={variant} fileName={fileName} showFileName={false} />
          </div>
        )}
      </div>
      {blobInvalid ? (
        <p className="mt-2 max-w-full px-1 text-center text-xs text-amber-800">
          Preview expired after refresh. Go back and upload the file again to see it.
        </p>
      ) : null}
      {showBlobReloadHint ? (
        <p className="mt-2 max-w-full px-1 text-center text-xs text-gray-500">
          Large files use a temporary preview; refreshing the page may hide it.
        </p>
      ) : null}
      <p
        className="mt-3 max-w-full truncate text-center text-sm font-medium text-sky-700"
        title={fileName}
      >
        {fileName}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Image from "next/image";
import { getProductImageUrl, downloadUrlAsFile } from "../../../utils/api";

/** Shared shape for customer `/orders` and admin line rows. */
export type OrderLineArtworkItem = {
  id?: number | string | null;
  image_url?: string | null;
  product_image?: string | null;
  customer_artwork_url?: string | null;
};

function jobArtworkDownloadName(item: OrderLineArtworkItem, href: string): string {
  const fromPath = href.split("?")[0].split("/").pop()?.trim();
  if (fromPath && /\.[a-z0-9]{2,8}$/i.test(fromPath)) return fromPath;
  const raw = item.customer_artwork_url ? String(item.customer_artwork_url).trim() : "";
  const tail = raw.split("?")[0].split("/").pop();
  if (tail && tail.length > 0) return tail;
  return `line-${item.id ?? "artwork"}-artwork`;
}

function ArtworkPreviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z"
      />
    </svg>
  );
}

function ArtworkDownloadIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

/**
 * Thumbnail: prefer customer artwork when it is a raster URL; otherwise product image.
 * Mirrors admin order detail `renderThumb`.
 */
export function OrderLineThumbnail({ item }: { item: OrderLineArtworkItem }) {
  const artHref = getProductImageUrl(item.customer_artwork_url ?? undefined);
  const productSrc = getProductImageUrl(item.image_url ?? item.product_image ?? undefined);
  const artExt = artHref ? artHref.split("?")[0].split(".").pop()?.toLowerCase() || "" : "";
  const useArtThumb =
    !!artHref && ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(artExt);
  const imgSrc = useArtThumb ? artHref : productSrc;
  if (!imgSrc) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 p-1 text-center text-[8px] leading-tight text-slate-500">
        No img
      </div>
    );
  }
  const isBackend =
    useArtThumb ||
    (item.image_url && String(item.image_url).startsWith("/uploads/")) ||
    (item.product_image && String(item.product_image).startsWith("/uploads/")) ||
    String(imgSrc).includes("/uploads/");
  if (isBackend) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        alt=""
        title={useArtThumb ? "Uploaded job artwork" : undefined}
        className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
      />
    );
  }
  return (
    <Image
      src={imgSrc}
      alt=""
      width={48}
      height={48}
      className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
      unoptimized
    />
  );
}

/** Preview modal + download — same behavior as admin `JobArtworkDownloadCell`. */
export function OrderLineArtworkDownloadCell({ item }: { item: OrderLineArtworkItem }) {
  const href = getProductImageUrl(item.customer_artwork_url ?? undefined);
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  if (!href) {
    return <span className="text-slate-400">—</span>;
  }
  const ext = href.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const isRasterImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const downloadName = jobArtworkDownloadName(item, href);

  const onDownload = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadUrlAsFile(href, downloadName);
    } catch {
      /* downloadUrlAsFile uses same-origin proxy for /uploads/ — no new-tab fallback */
    } finally {
      setDownloading(false);
    }
  };

  const openPreview = () => setPreviewOpen(true);

  return (
    <>
      <div className="flex max-w-[11rem] flex-col gap-2 sm:max-w-none sm:flex-row sm:items-center sm:gap-3">
        {isRasterImage ? (
          <button
            type="button"
            onClick={openPreview}
            className="inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
            title="Preview"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={href} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={openPreview}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-[10px] font-semibold leading-tight text-slate-600"
            title="Preview"
          >
            {isPdf ? "PDF" : "File"}
          </button>
        )}
        <div className="flex flex-col items-center text-sky-600">
          <button
            type="button"
            className="rounded transition-colors hover:bg-sky-50 hover:text-sky-800"
            title="Preview"
            aria-label="Preview artwork"
            onClick={openPreview}
          >
            <ArtworkPreviewIcon />
          </button>
          <button
            type="button"
            className="rounded transition-colors hover:bg-sky-50 hover:text-sky-800 disabled:opacity-50"
            title={downloading ? "Saving…" : "Download"}
            aria-label="Download artwork"
            onClick={onDownload}
            disabled={downloading}
          >
            <ArtworkDownloadIcon className={downloading ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
          </button>
        </div>
      </div>

      {previewOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Artwork preview"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="truncate pr-3 text-sm font-semibold text-gray-900" title={downloadName}>
                {downloadName}
              </h3>
              <button
                type="button"
                className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[78vh] overflow-auto bg-gray-50 p-4">
              {isPdf ? (
                <iframe
                  title="Artwork PDF"
                  src={href}
                  className="h-[72vh] w-full rounded border border-gray-200 bg-white"
                />
              ) : isRasterImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={href}
                  alt=""
                  className="mx-auto max-h-[72vh] w-auto rounded border border-gray-200 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-gray-600">
                  <p className="text-sm">Preview isn&apos;t available for this file type in the browser.</p>
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
                  >
                    <ArtworkDownloadIcon className="h-4 w-4" />
                    {downloading ? "Saving…" : "Download file"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

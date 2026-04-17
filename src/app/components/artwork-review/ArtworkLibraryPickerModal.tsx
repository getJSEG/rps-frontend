"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { artworksAPI, getProductImageUrl, type ArtworkRecord } from "../../../utils/api";
import { formatInchesFromPixels } from "../../../utils/artworkProportion";
import { formatBytes } from "../../../utils/formatBytes";

type ArtworkLibraryPickerModalProps = {
  open: boolean;
  onClose: () => void;
  onPickFile: (file: File) => void;
};

async function artworkRecordToFile(record: ArtworkRecord): Promise<File> {
  const url = getProductImageUrl(record.url);
  if (!url) {
    throw new Error("Missing file URL.");
  }
  const proxyUrl = `/api/artwork-file?source=${encodeURIComponent(url)}&name=${encodeURIComponent(record.fileName)}`;
  const res = await fetch(proxyUrl, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Could not load file (${res.status}).`);
  }
  const blob = await res.blob();
  const mime =
    blob.type && blob.type !== "application/octet-stream" ? blob.type : record.mimeType || "application/octet-stream";
  const safeName = record.fileName.replace(/[/\\]/g, "_");
  return new File([blob], safeName, { type: mime });
}

export default function ArtworkLibraryPickerModal({ open, onClose, onPickFile }: ArtworkLibraryPickerModalProps) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ArtworkRecord[]>([]);
  const [pickingId, setPickingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await artworksAPI.getMine();
      setRows(Array.isArray(res.artworks) ? res.artworks : []);
    } catch (e) {
      setRows([]);
      toast.error(e instanceof Error ? e.message : "Could not load your artworks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = async (item: ArtworkRecord) => {
    setPickingId(item.id);
    try {
      const file = await artworkRecordToFile(item);
      onPickFile(file);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not use this artwork.");
    } finally {
      setPickingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artwork-library-picker-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 sm:px-4 sm:py-2.5">
          <h2 id="artwork-library-picker-title" className="text-xs font-semibold text-gray-900 sm:text-sm">
            Choose from My Artworks
          </h2>
          <button
            type="button"
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(90vh-3rem)] overflow-auto bg-gray-50 p-2 sm:p-3">
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-500">Loading your artworks…</p>
          ) : rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-600">
              No saved artworks yet. Upload files on the My Artworks page, then return here.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(6.25rem,1fr))] gap-2 sm:gap-2.5">
              {rows.map((item) => {
                const thumb =
                  item.mimeType.startsWith("image/") && getProductImageUrl(item.url)
                    ? getProductImageUrl(item.url)
                    : null;
                const busy = pickingId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy || pickingId != null}
                    onClick={() => void handleSelect(item)}
                    className="min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white text-left shadow-sm transition-colors hover:border-sky-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex h-[4.5rem] w-full shrink-0 items-center justify-center overflow-hidden bg-gray-100 sm:h-[5.25rem]">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="px-1.5 text-center">
                          <div className="text-[10px] font-semibold text-gray-700 sm:text-xs">PDF</div>
                          <div className="mt-0.5 text-[9px] text-gray-500 sm:text-[10px]">Single page</div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5 p-1.5 sm:p-2">
                      <p className="line-clamp-2 break-all text-[10px] font-semibold leading-tight text-gray-900 sm:text-xs">
                        {item.fileName}
                      </p>
                      <p className="line-clamp-1 text-[9px] text-gray-600 sm:text-[10px]">
                        {item.widthPx && item.heightPx
                          ? `${formatInchesFromPixels(item.widthPx, item.heightPx)} · ${formatBytes(item.sizeBytes)}`
                          : `— · ${formatBytes(item.sizeBytes)}`}
                      </p>
                      <p className="text-[9px] font-medium leading-tight text-sky-700 sm:text-[10px]">
                        {busy ? "Applying…" : "Tap to use"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

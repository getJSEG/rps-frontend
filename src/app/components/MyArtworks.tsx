"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { artworksAPI, getProductImageUrl, type ArtworkRecord } from "../../utils/api";
import { extractUploadFileMetadata, type UploadFileMetadata } from "../../utils/uploadMetadata";
import { formatInchesFromPixels } from "../../utils/artworkProportion";

type UploadedArtworkRow = UploadFileMetadata & {
  id: string | number;
  previewUrl: string | null;
  remoteUrl?: string;
  uploadedAtLabel: string;
};
type PreviewState = {
  fileName: string;
  mimeType: string;
  src: string;
} | null;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileTypeLabel(mimeType: string, fileName: string): string {
  const m = String(mimeType || "").toLowerCase();
  const n = fileName.toLowerCase();
  if (m.includes("pdf") || n.endsWith(".pdf")) return "PDF";
  if (m.includes("png") || n.endsWith(".png")) return "PNG";
  return "JPG";
}

export default function MyArtworks() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [loadingUploads, setLoadingUploads] = useState(true);
  const [deletePopoverFor, setDeletePopoverFor] = useState<string | number | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>(null);
  const [uploads, setUploads] = useState<UploadedArtworkRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSearch = () => {};

  const filteredUploads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return uploads;
    return uploads.filter((u) => u.fileName.toLowerCase().includes(q));
  }, [uploads, searchQuery]);

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingUploads(true);
      try {
        const res = await artworksAPI.getMine();
        if (cancelled) return;
        const rows = Array.isArray(res.artworks) ? res.artworks : [];
        setUploads(
          rows.map((item: ArtworkRecord) => ({
            id: item.id,
            fileName: item.fileName,
            mimeType: item.mimeType,
            sizeBytes: item.sizeBytes,
            widthPx: item.widthPx,
            heightPx: item.heightPx,
            pdfPageCount: item.pdfPageCount,
            uploadedAtLabel: new Date(item.createdAt).toLocaleString(),
            previewUrl: item.mimeType.startsWith("image/") ? getProductImageUrl(item.url) : null,
            remoteUrl: getProductImageUrl(item.url),
          }))
        );
      } catch {
        if (!cancelled) {
          setUploads([]);
          toast.error("Could not load your uploads.");
        }
      } finally {
        if (!cancelled) setLoadingUploads(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmAndDelete = async (item: UploadedArtworkRow) => {
    try {
      await artworksAPI.delete(item.id);
      setUploads((prev) => prev.filter((u) => String(u.id) !== String(item.id)));
      setDeletePopoverFor(null);
      toast.success("Artwork deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete artwork.");
    }
  };

  const confirmAndReview = (item: UploadedArtworkRow) => {
    const url = item.previewUrl || item.remoteUrl;
    if (!url) return toast.error("No preview URL found.");
    setPreviewState({
      fileName: item.fileName,
      mimeType: item.mimeType,
      src: url,
    });
  };

  const confirmAndDownload = (item: UploadedArtworkRow) => {
    const url = item.remoteUrl || item.previewUrl;
    if (!url) return toast.error("No download URL found.");
    const a = document.createElement("a");
    a.href = url;
    a.download = item.fileName;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const metadata = await extractUploadFileMetadata(file);
      const isImage = metadata.mimeType.startsWith("image/");
      const saved = await artworksAPI.upload(file, {
        widthPx: metadata.widthPx,
        heightPx: metadata.heightPx,
        sizeBytes: metadata.sizeBytes,
        mimeType: metadata.mimeType,
        pdfPageCount: metadata.pdfPageCount,
      });
      const newRow: UploadedArtworkRow = {
        ...metadata,
        id: saved.id,
        previewUrl: isImage ? getProductImageUrl(saved.url) : null,
        remoteUrl: getProductImageUrl(saved.url),
        uploadedAtLabel: new Date(saved.createdAt).toLocaleString(),
      };
      setUploads((prev) => [newRow, ...prev]);
      toast.success("Artwork uploaded successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      {previewState ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm px-4">
          <div className="w-full max-w-4xl rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900 truncate pr-3">{previewState.fileName}</h3>
              <button
                type="button"
                className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => setPreviewState(null)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[78vh] overflow-auto bg-gray-50 p-4">
              {previewState.mimeType.includes("pdf") ? (
                <iframe
                  src={previewState.src}
                  title={previewState.fileName}
                  className="h-[72vh] w-full rounded border border-gray-200 bg-white"
                />
              ) : (
                <img
                  src={previewState.src}
                  alt={previewState.fileName}
                  className="mx-auto max-h-[72vh] w-auto rounded border border-gray-200 bg-white"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Artworks</h1>
              <p className="text-gray-600">
                We only accept PNG, JPG and PDF (single page).
              </p>
            </div>

            {/* Search and Upload */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search File Name"
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-64"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <button
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Search
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {isUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>

        {loadingUploads ? (
          <div className="bg-white min-h-[260px] flex flex-col items-center justify-center">
            <p className="text-gray-500 text-sm">Loading uploads...</p>
          </div>
        ) : filteredUploads.length === 0 ? (
          <div className="bg-white min-h-[500px] flex flex-col items-center justify-center">
            <div className="text-center">
              <svg
                className="w-24 h-24 text-gray-300 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              <p className="text-gray-400 text-lg">Your artwork is empty.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-6">
            {filteredUploads.map((item) => (
              <article
                key={item.id}
                className="w-full max-w-[280px] border-2 border-gray-200 rounded-lg bg-white overflow-hidden shadow-md"
              >
                <div className="h-44 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {item.previewUrl ? (
                    <img src={item.previewUrl} alt={item.fileName} className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-center px-4">
                      <div className="text-sm font-semibold text-gray-700">PDF</div>
                      <div className="text-xs text-gray-500 mt-1">Single page</div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-xl font-semibold text-gray-900 break-all leading-tight">{item.fileName}</h3>
                  <p className="text-gray-700 mt-2 text-lg">
                    {item.widthPx && item.heightPx
                      ? `${formatInchesFromPixels(item.widthPx, item.heightPx)} (${formatBytes(item.sizeBytes)})`
                      : `— (${formatBytes(item.sizeBytes)})`}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">Uploaded {item.uploadedAtLabel}</p>
                </div>
                <div className="relative flex items-center justify-between border-t border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-3 text-sky-500">
                    <button
                      type="button"
                      className="p-1 hover:text-sky-700 transition-colors"
                      title="Delete"
                      onClick={() =>
                        setDeletePopoverFor((prev) => (String(prev) === String(item.id) ? null : item.id))
                      }
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-5-3h4a1 1 0 011 1v2H9V5a1 1 0 011-1z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="p-1 hover:text-sky-700 transition-colors"
                      title="Preview"
                      onClick={() => confirmAndReview(item)}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="p-1 hover:text-sky-700 transition-colors"
                      title="Download"
                      onClick={() => confirmAndDownload(item)}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                  <div className="h-7 w-7 rounded border border-gray-300 flex items-center justify-center text-[9px] font-bold text-gray-500">
                    {fileTypeLabel(item.mimeType, item.fileName)}
                  </div>
                  {String(deletePopoverFor) === String(item.id) ? (
                    <div className="absolute bottom-10 left-2 z-20 w-56 rounded-md border border-red-200 bg-white p-3 shadow-lg">
                      <p className="text-xs text-gray-700">Delete this upload?</p>
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          onClick={() => setDeletePopoverFor(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                          onClick={() => void confirmAndDelete(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

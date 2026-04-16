"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ordersAPI } from "../../../utils/api";
import { IoCheckmarkCircle } from "react-icons/io5";
import { usePathname, useRouter } from "next/navigation";
import ArtworkReviewFilePreview from "./ArtworkReviewFilePreview";
import { commitFilePreviewToSession } from "./buildArtworkReviewPayload";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";
import {
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  removePendingJobLineFromSession,
  type StoredUploadReviewContext,
} from "./uploadApprovalReviewStorage";

async function fileFromReviewContext(ctx: StoredUploadReviewContext): Promise<File | null> {
  const name = (ctx.fileName || "artwork").trim() || "artwork";
  const mime = (ctx.previewMime || "application/octet-stream").trim();
  const src = ctx.previewDataUrl?.trim() || ctx.previewUrl?.trim();
  if (!src) return null;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return new File([blob], name, { type: mime || blob.type || "application/octet-stream" });
  } catch {
    return null;
  }
}

type ArtworkReviewOkContentProps = {
  displayFileName?: string;
  previewSrc?: string | null;
  previewMime?: string | null;
  /** After artwork is saved — parent refreshes pending-job sidebar from session. */
  onArtworkSaved?: () => void;
};

export default function ArtworkReviewOkContent({
  displayFileName,
  previewSrc,
  previewMime,
  onArtworkSaved,
}: ArtworkReviewOkContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(previewSrc ?? null);
  const [localPreviewMime, setLocalPreviewMime] = useState<string | null>(previewMime ?? null);
  const [localFileName, setLocalFileName] = useState(
    () => displayFileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameOk
  );
  const [approving, setApproving] = useState(false);
  /** After artwork is saved to the order line — primary + reupload stay disabled. */
  const [uploadSucceeded, setUploadSucceeded] = useState(false);

  useEffect(() => {
    setLocalPreviewSrc(previewSrc ?? null);
    setLocalPreviewMime(previewMime ?? null);
    setLocalFileName(displayFileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameOk);
  }, [previewSrc, previewMime, displayFileName]);

  const openReupload = useCallback(() => fileRef.current?.click(), []);

  const fileLabel = localFileName;

  const onReuploadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;

      let existing: StoredUploadReviewContext | null = null;
      try {
        const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
        if (raw) existing = JSON.parse(raw) as StoredUploadReviewContext;
      } catch {
        existing = null;
      }

      void (async () => {
        try {
          const r = await commitFilePreviewToSession(f, existing);
          if (r.nextPath !== pathname) {
            router.push(r.nextPath);
            return;
          }
          setLocalPreviewSrc(r.previewSrc);
          setLocalPreviewMime(r.previewMime);
          setLocalFileName(r.fileName);
        } catch {
          /* ignore */
        }
      })();
    },
    [pathname, router]
  );

  const actionsLocked = approving || uploadSucceeded;

  const onApprove = useCallback(() => {
    void (async () => {
      let ctx: StoredUploadReviewContext | null = null;
      try {
        const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
        if (raw) ctx = JSON.parse(raw) as StoredUploadReviewContext;
      } catch {
        ctx = null;
      }
      const oid = ctx?.orderId;
      const iid = ctx?.orderItemId;
      if (
        !ctx ||
        oid == null ||
        iid == null ||
        !Number.isFinite(oid) ||
        !Number.isFinite(iid) ||
        oid <= 0 ||
        iid <= 0
      ) {
        return;
      }
      setApproving(true);
      try {
        const file = await fileFromReviewContext(ctx);
        if (!file) {
          return;
        }
        await ordersAPI.approveOrderItemArtwork(oid, iid, file);
        try {
          sessionStorage.removeItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
          removePendingJobLineFromSession(iid);
        } catch {
          /* ignore */
        }
        onArtworkSaved?.();
        setUploadSucceeded(true);
      } catch {
        /* ignore */
      } finally {
        setApproving(false);
      }
    })();
  }, [onArtworkSaved]);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between">
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
        className="hidden"
        onChange={onReuploadFile}
      />

      <div className="flex flex-1 flex-col items-center">
        <ArtworkReviewFilePreview
          fileName={fileLabel}
          previewSrc={localPreviewSrc}
          previewMime={localPreviewMime}
          variant="ok"
        />
      </div>

      <div className="flex w-full shrink-0 flex-col justify-center gap-4 lg:max-w-sm">
        <div className="flex items-center gap-2 text-emerald-600">
          <IoCheckmarkCircle className="h-6 w-6 shrink-0" aria-hidden />
          <span className="text-lg font-semibold">Size OK</span>
        </div>

        <button
          type="button"
          disabled={actionsLocked}
          onClick={onApprove}
          className="w-full rounded-md bg-emerald-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:pointer-events-none disabled:opacity-60"
        >
          {uploadSucceeded
            ? "Successfully uploaded"
            : approving
              ? "Saving…"
              : "Approved"}
        </button>

        <button
          type="button"
          disabled={actionsLocked}
          onClick={openReupload}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-center text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-60"
        >
          Reupload
        </button>

        <button
          type="button"
          onClick={() => router.push("/upload-approval")}
          className="w-full rounded-md bg-sky-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
        >
          Back to upload list
        </button>
      </div>
    </div>
  );
}

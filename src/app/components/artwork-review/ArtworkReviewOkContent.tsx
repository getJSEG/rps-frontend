"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ordersAPI } from "../../../utils/api";
import { IoCheckmarkCircle } from "react-icons/io5";
import { toast } from "react-toastify";
import { usePathname, useRouter } from "next/navigation";
import ArtworkReviewFilePreview from "./ArtworkReviewFilePreview";
import {
  commitFilePreviewToSession,
} from "./buildArtworkReviewPayload";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";
import { artworkReviewBackButtonLabel, navigateBackFromArtworkReview, shouldHideArtworkLibrary } from "./artworkReviewBackNavigation";
import ArtworkLibraryPickerModal from "./ArtworkLibraryPickerModal";
import {
  REVIEW_PLACEHOLDER_FILE_NAME,
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  clearGuestUploadReturnUrl,
  markPendingJobArtworkApproved,
  markPendingJobReplacementPending,
  readPendingJobsFromSession,
  removeReviewDraft,
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
  /** True when the job was already approved before entering this page (reupload scenario). */
  isAlreadyApproved?: boolean;
  /** Job required print dimensions string e.g. "8" × 5.57"" */
  dimensions?: string;
  /** After artwork is saved — parent refreshes pending-job sidebar from session. */
  onArtworkSaved?: () => void;
};

export default function ArtworkReviewOkContent({
  displayFileName,
  previewSrc,
  previewMime,
  isAlreadyApproved = false,
  dimensions,
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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const hideArtworkLibrary = shouldHideArtworkLibrary();
  /** True once the user has clicked Approve and the API succeeded, or when job was already approved before entering. */
  const [uploadedSuccess, setUploadedSuccess] = useState(() => isAlreadyApproved);

  useEffect(() => {
    setLocalPreviewSrc(previewSrc ?? null);
    setLocalPreviewMime(previewMime ?? null);
    setLocalFileName(displayFileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameOk);
    /** When parent switches to a different job, restore success state based on whether that job is already approved. */
    setUploadedSuccess(isAlreadyApproved);
  }, [previewSrc, previewMime, displayFileName, isAlreadyApproved]);

  const openReupload = useCallback(() => fileRef.current?.click(), []);

  const applyLibraryFile = useCallback(
    (f: File) => {
      setUploadedSuccess(false);

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
          /** Job was previously approved — user is replacing the artwork without re-approving yet. */
          const prevItemId =
            typeof existing?.orderItemId === "number" && existing.orderItemId > 0
              ? existing.orderItemId
              : null;
          if (existing?.hasArtwork === true && prevItemId != null) {
            markPendingJobReplacementPending(prevItemId);
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

  const fileLabel = localFileName;

  const onReuploadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;

      /** Reupload resets the success state — user is choosing a new file. */
      setUploadedSuccess(false);

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
          /** Job was previously approved — user is replacing the artwork without re-approving yet. */
          const prevItemId =
            typeof existing?.orderItemId === "number" && existing.orderItemId > 0
              ? existing.orderItemId
              : null;
          if (existing?.hasArtwork === true && prevItemId != null) {
            markPendingJobReplacementPending(prevItemId);
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


  const actionsLocked = approving;

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
        if (!file) return;

        const guestTok = typeof ctx.guestTrackingToken === "string" ? ctx.guestTrackingToken.trim() : "";
        let result: { orderItemId: number; customerArtworkUrl: string; orderId: number; orderStatus?: string };
        if (guestTok) {
          result = await ordersAPI.approveGuestOrderItemArtwork(oid, iid, guestTok, file);
        } else {
          result = await ordersAPI.approveOrderItemArtwork(oid, iid, file);
        }

        try {
          markPendingJobArtworkApproved(iid, result.customerArtworkUrl);
          removeReviewDraft(iid);
        } catch {
          /* ignore */
        }
        onArtworkSaved?.();

        /**
         * All jobs done per backend — but check session for any job that had a replacement
         * file chosen locally but not yet re-approved. If found, block the redirect so the user
         * can go approve that job's new file.
         */
        if (result.orderStatus === "processing") {
          const pendingJobs = readPendingJobsFromSession();
          const unsubmittedReplacement = pendingJobs?.find(
            (j) => j.hasPendingReplacement === true && j.orderItemId !== iid
          ) ?? null;

          if (unsubmittedReplacement) {
            /** Stay on this page — sidebar lets the user click the other job. */
            setUploadedSuccess(true);
            return;
          }

          toast.success("All artwork approved! Your order is now being processed.");
          if (guestTok) {
            clearGuestUploadReturnUrl();
            router.push(`/guest-orders/${oid}?token=${encodeURIComponent(guestTok)}&placed=1`);
          } else {
            router.push(`/orders?order=${encodeURIComponent(String(oid))}`);
          }
          return;
        }

        /** Stay on this page — show the success state. */
        setUploadedSuccess(true);
      } catch {
        /* ignore */
      } finally {
        setApproving(false);
      }
    })();
  }, [onArtworkSaved, router]);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between">
      {!hideArtworkLibrary && (
        <ArtworkLibraryPickerModal
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onPickFile={applyLibraryFile}
        />
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf,application/x-pdf"
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
        {uploadedSuccess ? (
          <>
            {/* ── Success state ── */}
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200">
              <IoCheckmarkCircle className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              <span className="text-sm font-semibold text-emerald-700">Artwork uploaded successfully</span>
            </div>

            <p className="text-sm leading-relaxed text-gray-600">
              Your artwork has been approved for this job. You can upload a new file below to replace it.
            </p>

            {dimensions && dimensions.trim() && dimensions.trim() !== "—" && (
              <p className="text-sm text-gray-600">
                Required print size:{" "}
                <span className="font-bold text-gray-900">{dimensions}</span>
              </p>
            )}

            <button
              type="button"
              onClick={openReupload}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-center text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
            >
              Reupload artwork
            </button>

            {!hideArtworkLibrary && (
              <button
                type="button"
                onClick={() => setLibraryOpen(true)}
                className="w-full rounded-md bg-sky-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
              >
                Upload my artwork
              </button>
            )}

            <button
              type="button"
              onClick={() => navigateBackFromArtworkReview(router)}
              className="w-full rounded-md bg-sky-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
            >
              {artworkReviewBackButtonLabel()}
            </button>
          </>
        ) : (
          <>
            {/* ── Pre-approve state ── */}
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
              {approving ? "Saving…" : "Approve"}
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
              onClick={() => navigateBackFromArtworkReview(router)}
              className="w-full rounded-md bg-sky-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
            >
              {artworkReviewBackButtonLabel()}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

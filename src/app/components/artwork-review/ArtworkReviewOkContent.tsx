"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IoBookmarkOutline, IoCheckmarkCircle, IoSearchOutline } from "react-icons/io5";
import { toast } from "react-toastify";
import { usePathname, useRouter } from "next/navigation";
import ArtworkReviewFilePreview from "./ArtworkReviewFilePreview";
import { commitFilePreviewToSession } from "./buildArtworkReviewPayload";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";
import {
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  type StoredUploadReviewContext,
} from "./uploadApprovalReviewStorage";

const AUTO_APPROVE_START_SECONDS = 30 * 60 - 2; // 29:58

type ArtworkReviewOkContentProps = {
  displayFileName?: string;
  previewSrc?: string | null;
  previewMime?: string | null;
};

export default function ArtworkReviewOkContent({
  displayFileName,
  previewSrc,
  previewMime,
}: ArtworkReviewOkContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_APPROVE_START_SECONDS);
  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(previewSrc ?? null);
  const [localPreviewMime, setLocalPreviewMime] = useState<string | null>(previewMime ?? null);
  const [localFileName, setLocalFileName] = useState(
    () => displayFileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameOk
  );

  useEffect(() => {
    setLocalPreviewSrc(previewSrc ?? null);
    setLocalPreviewMime(previewMime ?? null);
    setLocalFileName(displayFileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameOk);
  }, [previewSrc, previewMime, displayFileName]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const countdownLabel = `${mm}:${ss.toString().padStart(2, "0")}`;

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
          toast.success(`Updated preview: ${r.fileName}`);
        } catch {
          toast.error("Could not update preview. Try a smaller file or different format.");
        }
      })();
    },
    [pathname, router]
  );

  const onApprove = useCallback(() => {
    toast.success("Approved (demo). Connect API to send to print.");
  }, []);

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
        <div className="mt-4 flex w-full max-w-md justify-center gap-6 text-gray-500">
          <button
            type="button"
            className="rounded p-1.5 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label="Zoom preview"
            onClick={() => toast.info("Zoom will open full proof when backend is ready.")}
          >
            <IoSearchOutline className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 transition-colors hover:bg-gray-100 hover:text-gray-800"
            aria-label="Save to favorites"
            onClick={() => toast.info("Save artwork — demo only.")}
          >
            <IoBookmarkOutline className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col justify-center gap-4 lg:max-w-sm">
        <div className="flex items-center gap-2 text-emerald-600">
          <IoCheckmarkCircle className="h-6 w-6 shrink-0" aria-hidden />
          <span className="text-lg font-semibold">Size OK</span>
        </div>

        <button
          type="button"
          onClick={onApprove}
          className="w-full rounded-md bg-emerald-600 px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
        >
          Approved, Send to print now
        </button>

        <button
          type="button"
          onClick={openReupload}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-center text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
        >
          Reupload
        </button>

        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-600">
          If no action is taken, this artwork will be sent to print in{" "}
          <span className="font-semibold text-sky-600">{countdownLabel}</span>.
        </div>

        <p className="text-xs text-gray-400">{fileLabel}</p>

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

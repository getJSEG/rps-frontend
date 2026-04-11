"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import ArtworkReviewFilePreview from "./ArtworkReviewFilePreview";
import { commitFilePreviewToSession } from "./buildArtworkReviewPayload";
import {
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  type StoredUploadReviewContext,
} from "./uploadApprovalReviewStorage";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";

type ArtworkReviewErrorContentProps = {
  displayFileName?: string;
  previewSrc?: string | null;
  previewMime?: string | null;
  uploadedGraphicLabel?: string;
  requiredGraphicLabel?: string;
};

export default function ArtworkReviewErrorContent({
  displayFileName,
  previewSrc,
  previewMime,
  uploadedGraphicLabel: uploadedProp,
  requiredGraphicLabel: requiredProp,
}: ArtworkReviewErrorContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);

  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(previewSrc ?? null);
  const [localPreviewMime, setLocalPreviewMime] = useState<string | null>(previewMime ?? null);
  const [localFileName, setLocalFileName] = useState(
    () => displayFileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameError
  );
  const [uploadedLabel, setUploadedLabel] = useState(
    uploadedProp ??
      `${ARTWORK_REVIEW_DEMO.uploadedInchesError.w}" × ${ARTWORK_REVIEW_DEMO.uploadedInchesError.h}"`
  );
  const [requiredLabel, setRequiredLabel] = useState(
    requiredProp ??
      `${ARTWORK_REVIEW_DEMO.requiredInches.w}" × ${ARTWORK_REVIEW_DEMO.requiredInches.h}"`
  );

  const openReupload = useCallback(() => fileRef.current?.click(), []);

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
          const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
          if (raw) {
            const p = JSON.parse(raw) as StoredUploadReviewContext;
            if (p.uploadedGraphicLabel) setUploadedLabel(p.uploadedGraphicLabel);
            if (p.requiredGraphicLabel && p.requiredGraphicLabel !== "—") {
              setRequiredLabel(p.requiredGraphicLabel);
            }
          }
          toast.success("Updated artwork.");
        } catch {
          toast.error("Could not update. Try a smaller file.");
        }
      })();
    },
    [pathname, router]
  );

  const onDownloadTemplates = useCallback(() => {
    toast.info("Template download will use your product template URL when the API is ready.");
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
          fileName={localFileName}
          previewSrc={localPreviewSrc}
          previewMime={localPreviewMime}
          variant="error"
        />
      </div>

      <div className="flex w-full shrink-0 flex-col justify-center gap-4 lg:max-w-md">
        <h2 className="text-lg font-bold text-red-600">On Hold: Incorrect Artwork Ratio</h2>

        <div className="space-y-1 text-sm text-gray-600">
          <p>
            Uploaded graphic size:{" "}
            <span className="font-medium text-gray-800">{uploadedLabel}</span>
          </p>
          <p>
            Required graphic size:{" "}
            <span className="font-medium text-gray-800">{requiredLabel}</span>
          </p>
        </div>

        <div className="border-t border-gray-200 pt-4 text-sm leading-relaxed text-gray-700">
          Correctly proportioned artwork is{" "}
          <span className="font-bold text-red-600">REQUIRED</span> for this product. Please{" "}
          <span className="font-bold uppercase text-gray-900">REUPLOAD</span> corrected artwork to
          proceed.
        </div>

        <button
          type="button"
          onClick={openReupload}
          className="w-full max-w-xs rounded-md bg-red-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
        >
          Reupload
        </button>

        <button
          type="button"
          onClick={onDownloadTemplates}
          className="text-left text-sm font-medium text-gray-600 underline decoration-gray-400 underline-offset-2 hover:text-gray-900"
        >
          Download Templates
        </button>

        <p className="text-xs text-gray-400">{localFileName}</p>

        <button
          type="button"
          onClick={() => router.push("/upload-approval")}
          className="w-full max-w-xs rounded-md bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
        >
          Back to upload list
        </button>
      </div>
    </div>
  );
}

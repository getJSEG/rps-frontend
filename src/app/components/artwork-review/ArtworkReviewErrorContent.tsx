"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ArtworkReviewFilePreview from "./ArtworkReviewFilePreview";
import ArtworkLibraryPickerModal from "./ArtworkLibraryPickerModal";
import {
  commitFilePreviewToSession,
  UPLOAD_APPROVAL_REVIEW_OK_ROUTE,
} from "./buildArtworkReviewPayload";
import {
  artworkReviewBackButtonLabel,
  navigateBackFromArtworkReview,
  shouldHideArtworkLibrary,
} from "./artworkReviewBackNavigation";
import {
  REVIEW_PLACEHOLDER_FILE_NAME,
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
  isGraphicScenario?: boolean;
};

export default function ArtworkReviewErrorContent({
  displayFileName,
  previewSrc,
  previewMime,
  uploadedGraphicLabel: uploadedProp,
  requiredGraphicLabel: requiredProp,
  isGraphicScenario = false,
}: ArtworkReviewErrorContentProps) {
  const hideArtworkLibrary = shouldHideArtworkLibrary();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

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

  /** Align local preview when props change (avoids lint on setState-in-effect for this flow). */
  const previewSyncKey = `${previewSrc ?? ""}\0${previewMime ?? ""}\0${displayFileName ?? ""}`;
  const [syncedPreviewKey, setSyncedPreviewKey] = useState(previewSyncKey);
  if (syncedPreviewKey !== previewSyncKey) {
    setSyncedPreviewKey(previewSyncKey);
    setLocalPreviewSrc(previewSrc ?? null);
    setLocalPreviewMime(previewMime ?? null);
    setLocalFileName(displayFileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameError);
  }

  /** No preview yet and placeholder filename — user has not chosen a file for this job. */
  const awaitingFileSelection = !localPreviewSrc && localFileName === REVIEW_PLACEHOLDER_FILE_NAME;

  const openReupload = useCallback(() => fileRef.current?.click(), []);

  const readExistingContext = useCallback((): StoredUploadReviewContext | null => {
    try {
      const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
      if (raw) return JSON.parse(raw) as StoredUploadReviewContext;
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  const applySelectedFile = useCallback(
    (f: File) => {
      const existing = readExistingContext();
      void (async () => {
        try {
          const r = await commitFilePreviewToSession(f, existing);
          if (r.nextPath === UPLOAD_APPROVAL_REVIEW_OK_ROUTE) {
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
        } catch {
          /* ignore — page already shows artwork status */
        }
      })();
    },
    [readExistingContext, router]
  );

  const onReuploadFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      applySelectedFile(f);
    },
    [applySelectedFile]
  );

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between">
      {!hideArtworkLibrary && (
        <ArtworkLibraryPickerModal
          open={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onPickFile={applySelectedFile}
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
          fileName={localFileName}
          previewSrc={localPreviewSrc}
          previewMime={localPreviewMime}
          variant="error"
        />
      </div>

      <div className="flex w-full shrink-0 flex-col justify-center gap-4 lg:max-w-sm">
        {awaitingFileSelection ? (
          <>
            <h2 className="text-lg font-bold text-sky-800">Upload artwork for this job</h2>
            <p className="text-sm leading-relaxed text-gray-700">
              Choose a PNG, JPG, or single-page PDF.
              {!isGraphicScenario && (
                <>
                  {" "}Your file must match this job&apos;s print size{" "}
                  <span className="font-medium">shape</span> (width-to-height aspect ratio)
                </>
              )}
            </p>
            <div className="space-y-1 text-sm text-gray-600">
              {!isGraphicScenario && (
                <p>
                  Required print size:{" "}
                  <span className="font-bold text-gray-900">{requiredLabel}</span>
                </p>
              )}
              <p className="text-gray-500">Uploaded file: not selected yet</p>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-red-600">On hold: artwork shape does not match</h2>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                Uploaded graphic:{" "}
                <span className="font-bold text-gray-900">{uploadedLabel}</span>
              </p>
              {!isGraphicScenario && (
                <p>
                  Required print size (aspect target):{" "}
                  <span className="font-bold text-gray-900">{requiredLabel}</span>
                </p>
              )}
            </div>
            {!isGraphicScenario && (
              <div className="border-t border-gray-200 pt-4 text-sm leading-relaxed text-gray-700">
                The image must have the same width-to-height proportion as the job dimensions. Please upload a
                different file or crop to match.
              </div>
            )}
          </>
        )}

        <button
          type="button"
          onClick={openReupload}
          className={`w-full rounded-md px-4 py-3.5 text-center text-sm font-semibold text-white shadow-sm transition-colors ${
            awaitingFileSelection
              ? "bg-sky-600 hover:bg-sky-700"
              : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {awaitingFileSelection ? "Choose file" : "Upload image"}
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
      </div>
    </div>
  );
}

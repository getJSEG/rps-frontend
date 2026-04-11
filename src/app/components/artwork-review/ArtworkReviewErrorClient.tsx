"use client";

import { useEffect, useState } from "react";
import ArtworkReviewShell, { type ArtworkReviewJobMeta } from "./ArtworkReviewShell";
import ArtworkReviewErrorContent from "./ArtworkReviewErrorContent";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";
import {
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  type StoredUploadReviewContext,
} from "./uploadApprovalReviewStorage";

function mergeMeta(stored: StoredUploadReviewContext | null): ArtworkReviewJobMeta {
  return {
    jobIdLabel: stored?.jobIdLabel ?? ARTWORK_REVIEW_DEMO.jobIdLabel,
    orderedAtLabel: stored?.orderedAtLabel ?? ARTWORK_REVIEW_DEMO.orderedAtLabel,
    jobName: stored?.jobName ?? ARTWORK_REVIEW_DEMO.jobName,
    product: stored?.product ?? ARTWORK_REVIEW_DEMO.product,
    dimensions:
      stored?.dimensions?.trim() ? stored.dimensions : ARTWORK_REVIEW_DEMO.dimensions,
    quantity:
      typeof stored?.quantity === "number" && Number.isFinite(stored.quantity)
        ? stored.quantity
        : ARTWORK_REVIEW_DEMO.quantity,
  };
}

export default function ArtworkReviewErrorClient() {
  const [meta, setMeta] = useState<ArtworkReviewJobMeta>(() => ({
    jobIdLabel: ARTWORK_REVIEW_DEMO.jobIdLabel,
    orderedAtLabel: ARTWORK_REVIEW_DEMO.orderedAtLabel,
    jobName: ARTWORK_REVIEW_DEMO.jobName,
    product: ARTWORK_REVIEW_DEMO.product,
    dimensions: ARTWORK_REVIEW_DEMO.dimensions,
    quantity: ARTWORK_REVIEW_DEMO.quantity,
  }));
  const [displayFileName, setDisplayFileName] = useState(ARTWORK_REVIEW_DEMO.fileNameError);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [uploadedLabel, setUploadedLabel] = useState(
    `${ARTWORK_REVIEW_DEMO.uploadedInchesError.w}" × ${ARTWORK_REVIEW_DEMO.uploadedInchesError.h}"`
  );
  const [requiredLabel, setRequiredLabel] = useState(
    `${ARTWORK_REVIEW_DEMO.requiredInches.w}" × ${ARTWORK_REVIEW_DEMO.requiredInches.h}"`
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredUploadReviewContext;
        setMeta(mergeMeta(parsed));
        setDisplayFileName(parsed.fileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameError);
        const data = parsed.previewDataUrl?.trim();
        const blob = parsed.previewUrl?.trim();
        setPreviewSrc(data || blob || null);
        setPreviewMime(parsed.previewMime?.trim() || null);
        if (parsed.uploadedGraphicLabel?.trim()) {
          setUploadedLabel(parsed.uploadedGraphicLabel.trim());
        }
        if (parsed.requiredGraphicLabel?.trim() && parsed.requiredGraphicLabel !== "—") {
          setRequiredLabel(parsed.requiredGraphicLabel.trim());
        }
      }
    } catch {
      /* ignore */
    } finally {
      setHydrated(true);
    }
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#f0f0f0] pb-16 pt-24">
        <div className="mx-auto w-3/4 max-w-full px-4 py-16 text-center text-gray-600">Loading…</div>
      </div>
    );
  }

  return (
    <ArtworkReviewShell meta={meta}>
      <ArtworkReviewErrorContent
        displayFileName={displayFileName}
        previewSrc={previewSrc}
        previewMime={previewMime}
        uploadedGraphicLabel={uploadedLabel}
        requiredGraphicLabel={requiredLabel}
      />
    </ArtworkReviewShell>
  );
}

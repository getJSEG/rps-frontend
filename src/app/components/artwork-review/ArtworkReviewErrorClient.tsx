"use client";

import { useCallback, useEffect, useState } from "react";
import ArtworkReviewShell, { type ArtworkReviewJobMeta } from "./ArtworkReviewShell";
import ArtworkReviewErrorContent from "./ArtworkReviewErrorContent";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";
import {
  REVIEW_PLACEHOLDER_FILE_NAME,
  UPLOAD_APPROVAL_PENDING_JOBS_KEY,
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  revokeStoredUploadPreview,
  reviewContextFromPendingLine,
  type StoredPendingJobLine,
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
  const [displayFileName, setDisplayFileName] = useState<string>(ARTWORK_REVIEW_DEMO.fileNameError);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [uploadedLabel, setUploadedLabel] = useState(
    `${ARTWORK_REVIEW_DEMO.uploadedInchesError.w}" × ${ARTWORK_REVIEW_DEMO.uploadedInchesError.h}"`
  );
  const [requiredLabel, setRequiredLabel] = useState(
    `${ARTWORK_REVIEW_DEMO.requiredInches.w}" × ${ARTWORK_REVIEW_DEMO.requiredInches.h}"`
  );
  const [isGraphicScenario, setIsGraphicScenario] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarJobs, setSidebarJobs] = useState<StoredPendingJobLine[] | null>(null);
  const [activeOrderItemId, setActiveOrderItemId] = useState<number | null>(null);
  const [activeJobIdLabel, setActiveJobIdLabel] = useState<string | undefined>(undefined);
  const applyJobRow = useCallback((row: StoredPendingJobLine) => {
    let preservedGuestToken: string | undefined;
    try {
      const prevRaw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
      if (prevRaw) {
        const prev = JSON.parse(prevRaw) as StoredUploadReviewContext;
        const gt = typeof prev.guestTrackingToken === "string" ? prev.guestTrackingToken.trim() : "";
        if (gt) preservedGuestToken = gt;
      }
    } catch {
      preservedGuestToken = undefined;
    }
    const ctx = reviewContextFromPendingLine(row);
    if (!ctx) {
      return;
    }
    if (preservedGuestToken) {
      ctx.guestTrackingToken = preservedGuestToken;
    }
    try {
      revokeStoredUploadPreview();
      sessionStorage.setItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY, JSON.stringify(ctx));
    } catch {
      return;
    }
    setMeta(mergeMeta(ctx));
    setDisplayFileName(ctx.fileName?.trim() || REVIEW_PLACEHOLDER_FILE_NAME);
    setPreviewSrc(null);
    setPreviewMime(null);
    setUploadedLabel(ctx.uploadedGraphicLabel?.trim() || "Not uploaded yet");
    setRequiredLabel(
      ctx.requiredGraphicLabel?.trim() && ctx.requiredGraphicLabel !== "—"
        ? ctx.requiredGraphicLabel.trim()
        : `${ARTWORK_REVIEW_DEMO.requiredInches.w}" × ${ARTWORK_REVIEW_DEMO.requiredInches.h}"`
    );
    setIsGraphicScenario(ctx.isGraphicScenario === true);
    const oi = ctx.orderItemId;
    setActiveOrderItemId(typeof oi === "number" && Number.isFinite(oi) && oi > 0 ? oi : null);
    setActiveJobIdLabel(ctx.jobIdLabel?.trim() || undefined);
  }, []);

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
        setIsGraphicScenario(parsed.isGraphicScenario === true);
        const oi = parsed.orderItemId;
        setActiveOrderItemId(
          typeof oi === "number" && Number.isFinite(oi) && oi > 0 ? oi : null
        );
        setActiveJobIdLabel(parsed.jobIdLabel?.trim() || undefined);
      }
      const rawJobs = sessionStorage.getItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY);
      if (rawJobs) {
        const arr = JSON.parse(rawJobs) as unknown;
        if (Array.isArray(arr) && arr.length > 0) {
          setSidebarJobs(arr as StoredPendingJobLine[]);
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

  const selectionKey =
    activeOrderItemId != null && activeOrderItemId > 0
      ? `oi-${activeOrderItemId}`
      : activeJobIdLabel
        ? `jl-${activeJobIdLabel}`
        : "none";

  return (
    <ArtworkReviewShell
      meta={meta}
      sidebarJobs={sidebarJobs}
      activeOrderItemId={activeOrderItemId}
      activeJobIdLabel={activeJobIdLabel}
      onSelectJob={sidebarJobs?.length ? applyJobRow : undefined}
    >
      <ArtworkReviewErrorContent
        key={selectionKey}
        displayFileName={displayFileName}
        previewSrc={previewSrc}
        previewMime={previewMime}
        uploadedGraphicLabel={uploadedLabel}
        requiredGraphicLabel={requiredLabel}
        isGraphicScenario={isGraphicScenario}
      />
    </ArtworkReviewShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ArtworkReviewShell, { type ArtworkReviewJobMeta } from "./ArtworkReviewShell";
import ArtworkReviewOkContent from "./ArtworkReviewOkContent";
import { ARTWORK_REVIEW_DEMO } from "./artworkReviewMock";
import {
  UPLOAD_APPROVAL_REVIEW_ERROR_ROUTE,
  UPLOAD_APPROVAL_REVIEW_OK_ROUTE,
} from "./buildArtworkReviewPayload";
import {
  REVIEW_PLACEHOLDER_FILE_NAME,
  UPLOAD_APPROVAL_PENDING_JOBS_KEY,
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  loadReviewDraft,
  reviewContextFromPendingLine,
  saveReviewDraft,
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

function readPendingJobsFromSession(): StoredPendingJobLine[] | null {
  try {
    const rawJobs = sessionStorage.getItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY);
    if (!rawJobs) return null;
    const arr = JSON.parse(rawJobs) as unknown;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr as StoredPendingJobLine[];
  } catch {
    return null;
  }
}

export default function ArtworkReviewOkClient() {
  const router = useRouter();
  const [meta, setMeta] = useState<ArtworkReviewJobMeta>(() => ({
    jobIdLabel: ARTWORK_REVIEW_DEMO.jobIdLabel,
    orderedAtLabel: ARTWORK_REVIEW_DEMO.orderedAtLabel,
    jobName: ARTWORK_REVIEW_DEMO.jobName,
    product: ARTWORK_REVIEW_DEMO.product,
    dimensions: ARTWORK_REVIEW_DEMO.dimensions,
    quantity: ARTWORK_REVIEW_DEMO.quantity,
  }));
  const [displayFileName, setDisplayFileName] = useState<string>(ARTWORK_REVIEW_DEMO.fileNameOk);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sidebarJobs, setSidebarJobs] = useState<StoredPendingJobLine[] | null>(null);
  const [activeOrderItemId, setActiveOrderItemId] = useState<number | null>(null);
  const [activeJobIdLabel, setActiveJobIdLabel] = useState<string | undefined>(undefined);
  const refreshPendingSidebar = useCallback(() => {
    setSidebarJobs(readPendingJobsFromSession());
  }, []);

  const applyJobRow = useCallback(
    (row: StoredPendingJobLine) => {
      if (
        activeOrderItemId != null &&
        row.orderItemId != null &&
        row.orderItemId === activeOrderItemId
      ) {
        return;
      }
      let preservedGuestToken: string | undefined;
      try {
        const prevRaw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
        if (prevRaw) {
          const prev = JSON.parse(prevRaw) as StoredUploadReviewContext;
          /** Snapshot outgoing context so its preview survives a job switch. */
          saveReviewDraft(prev);
          const gt = typeof prev.guestTrackingToken === "string" ? prev.guestTrackingToken.trim() : "";
          if (gt) preservedGuestToken = gt;
        }
      } catch {
        preservedGuestToken = undefined;
      }

      const incomingId = row.orderItemId;
      const draft =
        incomingId != null && Number.isFinite(incomingId) && incomingId > 0
          ? loadReviewDraft(incomingId)
          : null;

      let ctx: StoredUploadReviewContext | null;
      if (draft) {
        ctx = { ...draft };
        if (preservedGuestToken && !ctx.guestTrackingToken) {
          ctx.guestTrackingToken = preservedGuestToken;
        }
      } else {
        ctx = reviewContextFromPendingLine(row);
        if (!ctx) return;
        if (preservedGuestToken) ctx.guestTrackingToken = preservedGuestToken;
      }

      try {
        sessionStorage.setItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY, JSON.stringify(ctx));
      } catch {
        return;
      }

      const hasOkPreview =
        Boolean(ctx.previewDataUrl?.trim() || ctx.previewUrl?.trim()) &&
        Boolean(ctx.uploadedGraphicLabel?.trim()) &&
        ctx.uploadedGraphicLabel !== "Not uploaded yet" &&
        Boolean(ctx.fileName?.trim()) &&
        ctx.fileName !== REVIEW_PLACEHOLDER_FILE_NAME;
      router.push(hasOkPreview ? UPLOAD_APPROVAL_REVIEW_OK_ROUTE : UPLOAD_APPROVAL_REVIEW_ERROR_ROUTE);
    },
    [router, activeOrderItemId]
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredUploadReviewContext;
        setMeta(mergeMeta(parsed));
        setDisplayFileName(parsed.fileName?.trim() || ARTWORK_REVIEW_DEMO.fileNameOk);
        const data = parsed.previewDataUrl?.trim();
        const blob = parsed.previewUrl?.trim();
        setPreviewSrc(data || blob || null);
        setPreviewMime(parsed.previewMime?.trim() || null);
        const oi = parsed.orderItemId;
        setActiveOrderItemId(
          typeof oi === "number" && Number.isFinite(oi) && oi > 0 ? oi : null
        );
        setActiveJobIdLabel(parsed.jobIdLabel?.trim() || undefined);
      }
      setSidebarJobs(readPendingJobsFromSession());
    } catch {
      /* ignore bad JSON */
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
    <ArtworkReviewShell
      meta={meta}
      sidebarJobs={sidebarJobs}
      activeOrderItemId={activeOrderItemId}
      activeJobIdLabel={activeJobIdLabel}
      onSelectJob={sidebarJobs?.length ? applyJobRow : undefined}
    >
      <ArtworkReviewOkContent
        displayFileName={displayFileName}
        previewSrc={previewSrc}
        previewMime={previewMime}
        onArtworkSaved={refreshPendingSidebar}
      />
    </ArtworkReviewShell>
  );
}

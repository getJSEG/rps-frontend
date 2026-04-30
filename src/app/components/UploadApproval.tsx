"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ordersAPI } from "../../utils/api";
import {
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  clearAllReviewDrafts,
  revokeStoredUploadPreview,
} from "./artwork-review/uploadApprovalReviewStorage";
import {
  UPLOAD_REVIEW_ERROR_CLIENT_PATH,
  writeUploadReviewSessionForJob,
} from "./artwork-review/openUploadReviewSession";
import { isAuthenticated } from "../../utils/roles";
import {
  buildAllUploadJobsFromOrders,
  type PendingJob,
  type UploadApprovalOrderRow as OrderRow,
} from "../../utils/uploadApprovalPending";

function formatJobDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type PendingOrderGroup = {
  orderId: number;
  orderLabel: string;
  orderedAt: string | null;
  jobs: PendingJob[];
};

function openReviewForJob(
  router: ReturnType<typeof useRouter>,
  group: PendingOrderGroup,
  job: PendingJob
) {
  if (job.orderItemId == null || !Number.isFinite(job.orderItemId) || job.orderItemId <= 0) {
    toast.info(
      "This order line has no item id yet. If this persists, contact support or try again after refreshing."
    );
    return;
  }
  try {
    writeUploadReviewSessionForJob(job, group.jobs);
  } catch {
    toast.error("Could not open review. Try again.");
    return;
  }
  router.push(UPLOAD_REVIEW_ERROR_CLIENT_PATH);
}

function InfoHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <span>{text}</span>
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-400 text-[11px] font-semibold text-gray-500"
        title={text}
        aria-hidden
      >
        ?
      </span>
    </div>
  );
}

export default function UploadApproval() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    setAuthReady(true);
  }, []);

  /** Drop stale review preview/context and per-job drafts when visiting the list; keep pending job lines for review sidebar. */
  useEffect(() => {
    try {
      revokeStoredUploadPreview();
      sessionStorage.removeItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
      clearAllReviewDrafts();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!loggedIn) {
      setLoading(false);
      setOrders([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = (await ordersAPI.getAll({ limit: 50, page: 1 })) as { orders?: OrderRow[] };
        const list = Array.isArray(res?.orders) ? res.orders : [];
        if (!cancelled) setOrders(list);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load orders");
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, loggedIn]);

  useEffect(() => {
    if (!authReady || !loggedIn) return;
    const refetch = () => {
      void (async () => {
        try {
          const res = (await ordersAPI.getAll({ limit: 50, page: 1 })) as { orders?: OrderRow[] };
          const list = Array.isArray(res?.orders) ? res.orders : [];
          setOrders(list);
        } catch {
          /* ignore */
        }
      })();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refetch();
    };
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [authReady, loggedIn]);

  const allJobs: PendingJob[] = useMemo(() => buildAllUploadJobsFromOrders(orders), [orders]);

  const pendingOrderGroups: PendingOrderGroup[] = useMemo(() => {
    const byOrder = new Map<number, PendingOrderGroup>();
    for (const job of allJobs) {
      let g = byOrder.get(job.orderId);
      if (!g) {
        g = {
          orderId: job.orderId,
          orderLabel: job.orderLabel,
          orderedAt: job.orderedAt,
          jobs: [],
        };
        byOrder.set(job.orderId, g);
      }
      g.jobs.push(job);
    }
    return Array.from(byOrder.values());
  }, [allJobs]);

  return (
    <div className="relative min-h-screen bg-[#f5f5f5] pb-16 pt-24">
      <div className="mx-auto w-3/4 max-w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Pending Upload and Approval</h1>
            <p className="text-gray-600">
              This page displays all jobs awaiting file uploads before processing.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:text-right mt-5">
            <InfoHint text="Don't Include Crop Marks or Bleed" />
            <InfoHint text="Accepted file formats: PNG, JPG, or single-page PDF" />
          </div>
        </div>

        {!authReady || loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-600 shadow-sm">
            Loading jobs…
          </div>
        ) : !loggedIn ? null : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">{error}</div>
        ) : allJobs.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm">
            <svg
              className="mb-4 h-24 w-24 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="mb-2 font-medium text-gray-700">No jobs pending for upload.</p>
            <p className="max-w-md text-center text-gray-600">
              To upload a file, please place an order first. When your order is ready for artwork or proof review, it
              will appear here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-6">
            {pendingOrderGroups.map((group) => (
              <li key={`order-${group.orderId}`}>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                    <span>
                      Order <span className="font-semibold text-gray-900">{group.orderLabel}</span>
                      <span className="mx-2 text-gray-300">·</span>
                      <span className="text-gray-500">
                        {group.jobs.length} job{group.jobs.length === 1 ? "" : "s"}
                      </span>
                      {(() => {
                        const approved = group.jobs.filter((j) => j.hasArtwork).length;
                        return approved > 0 ? (
                          <>
                            <span className="mx-2 text-gray-300">·</span>
                            <span className="text-emerald-600 font-medium">{approved}/{group.jobs.length} approved</span>
                          </>
                        ) : null;
                      })()}
                    </span>
                    <span className="text-gray-500">{formatJobDate(group.orderedAt)}</span>
                  </div>
                  <div className="border-gray-100 px-4 py-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Jobs</p>
                    <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
                      {group.jobs.map((job) => (
                        <li
                          key={job.key}
                          className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-800">
                              <span className="font-medium text-gray-600">Job name: </span>
                              {job.jobName}
                            </p>
                            <p className="mt-1 text-sm text-gray-800">
                              <span className="font-medium text-gray-600">Product: </span>
                              {job.productLabel}
                            </p>
                            {job.dimensions && (
                              <p className="mt-1 text-sm text-gray-800">
                                <span className="font-medium text-gray-600">Dimensions: </span>
                                {job.dimensions}
                              </p>
                            )}
                            <p className="mt-1 text-sm text-gray-800">
                              <span className="font-medium text-gray-600">Qty: </span>x{job.quantity}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                            {job.hasArtwork && (
                              <span className="flex items-center justify-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Approved
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openReviewForJob(router, group, job)}
                              className={`w-full min-w-[10.5rem] rounded-md px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors sm:w-auto ${
                                job.hasArtwork
                                  ? "bg-gray-500 hover:bg-gray-600"
                                  : "bg-sky-600 hover:bg-sky-700"
                              }`}
                            >
                              {job.hasArtwork ? "Reupload artwork" : "Upload artwork"}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

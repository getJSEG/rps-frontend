"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ordersAPI } from "../../utils/api";
import {
  UPLOAD_APPROVAL_PENDING_JOBS_KEY,
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  revokeStoredUploadPreview,
  reviewContextFromPendingLine,
  type StoredPendingJobLine,
  type StoredUploadReviewContext,
} from "./artwork-review/uploadApprovalReviewStorage";
import { isAuthenticated } from "../../utils/roles";
import { canonicalOrderStatus } from "../../utils/orderStatuses";

type OrderItem = {
  id?: number | null;
  product_name?: string | null;
  job_name?: string | null;
  quantity?: number | null;
  product_description?: string | null;
  width_inches?: number | string | null;
  height_inches?: number | string | null;
  customer_artwork_url?: string | null;
};

type OrderRow = {
  id: number;
  order_number?: string | null;
  status?: string | null;
  created_at?: string | null;
  items?: OrderItem[] | null;
};

function normalizeItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object" && x != null);
}

function formatLineSizeInches(w: unknown, h: unknown): string | null {
  const nw = w != null && w !== "" ? Number(w) : NaN;
  const nh = h != null && h !== "" ? Number(h) : NaN;
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
  return `${fmt(nw)}" × ${fmt(nh)}"`;
}

function parseOrderLineInches(w: unknown, h: unknown): { w: number; h: number } | null {
  const nw = w != null && w !== "" ? Number(w) : NaN;
  const nh = h != null && h !== "" ? Number(h) : NaN;
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return null;
  return { w: nw, h: nh };
}

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

function orderNeedsUploadOrApproval(status: string | null | undefined): boolean {
  const c = canonicalOrderStatus(status);
  return c === "awaiting_artwork" || c === "awaiting_customer_approval";
}

type PendingJob = {
  key: string;
  orderId: number;
  orderItemId: number | null;
  orderLabel: string;
  jobIdLabel: string;
  orderedAt: string | null;
  jobName: string;
  productLabel: string;
  dimensions: string | null;
  quantity: number;
  requiredWidthIn: number | null;
  requiredHeightIn: number | null;
};

type PendingOrderGroup = {
  orderId: number;
  orderLabel: string;
  orderedAt: string | null;
  jobs: PendingJob[];
};

const REVIEW_ERROR_PATH = "/upload-approval/review/error";

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
    revokeStoredUploadPreview();
    persistPendingJobsForGroup(group);
    sessionStorage.setItem(
      UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
      JSON.stringify(placeholderReviewContext(job))
    );
  } catch {
    toast.error("Could not open review. Try again.");
    return;
  }
  router.push(REVIEW_ERROR_PATH);
}

function pendingJobToStoredLine(j: PendingJob): StoredPendingJobLine {
  return {
    orderId: j.orderId,
    orderItemId: j.orderItemId,
    jobIdLabel: j.jobIdLabel,
    jobName: j.jobName,
    product: j.productLabel,
    dimensions: j.dimensions?.trim() ? j.dimensions : "—",
    quantity: j.quantity,
    requiredWidthIn: j.requiredWidthIn,
    requiredHeightIn: j.requiredHeightIn,
    orderedAtLabel: formatJobDate(j.orderedAt),
  };
}

function persistPendingJobsForGroup(grp: PendingOrderGroup | null) {
  try {
    if (!grp?.jobs?.length) {
      sessionStorage.removeItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY);
      return;
    }
    const lines: StoredPendingJobLine[] = grp.jobs.map(pendingJobToStoredLine);
    sessionStorage.setItem(UPLOAD_APPROVAL_PENDING_JOBS_KEY, JSON.stringify(lines));
  } catch {
    /* ignore */
  }
}

function placeholderReviewContext(job: PendingJob): StoredUploadReviewContext {
  const ctx = reviewContextFromPendingLine(pendingJobToStoredLine(job));
  if (!ctx) {
    throw new Error("Missing order line for review context");
  }
  return ctx;
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

  /** Drop stale review preview/context when visiting the list; keep pending job lines for review sidebar. */
  useEffect(() => {
    try {
      revokeStoredUploadPreview();
      sessionStorage.removeItem(UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY);
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

  const pendingJobs: PendingJob[] = useMemo(() => {
    const out: PendingJob[] = [];
    for (const order of orders) {
      if (!orderNeedsUploadOrApproval(order.status)) continue;
      const items = normalizeItems(order.items);
      const base = order.order_number || String(order.id);
      if (items.length === 0) {
        out.push({
          key: `order-${order.id}-0`,
          orderId: order.id,
          orderItemId: null,
          orderLabel: base,
          jobIdLabel: `${base}-01`,
          orderedAt: order.created_at ?? null,
          jobName: "—",
          productLabel: "Order line pending",
          dimensions: null,
          quantity: 1,
          requiredWidthIn: null,
          requiredHeightIn: null,
        });
        continue;
      }
      items.forEach((it, idx) => {
        const url = it.customer_artwork_url != null ? String(it.customer_artwork_url).trim() : "";
        if (url) return;
        const itemId = it.id != null && Number.isFinite(Number(it.id)) ? Number(it.id) : null;
        const line = idx + 1;
        const jobIdLabel = `${base}-${String(line).padStart(2, "0")}`;
        const productLabel =
          [it.product_name, it.product_description].filter(Boolean).join(" — ") ||
          it.product_name ||
          "Product";
        const inches = parseOrderLineInches(it.width_inches, it.height_inches);
        out.push({
          key: `order-${order.id}-item-${it.id ?? line}`,
          orderId: order.id,
          orderItemId: itemId,
          orderLabel: base,
          jobIdLabel,
          orderedAt: order.created_at ?? null,
          jobName: (it.job_name || "").trim() || "—",
          productLabel,
          dimensions: formatLineSizeInches(it.width_inches, it.height_inches),
          quantity: Math.max(1, parseInt(String(it.quantity ?? 1), 10) || 1),
          requiredWidthIn: inches?.w ?? null,
          requiredHeightIn: inches?.h ?? null,
        });
      });
    }
    return out;
  }, [orders]);

  const pendingOrderGroups: PendingOrderGroup[] = useMemo(() => {
    const byOrder = new Map<number, PendingOrderGroup>();
    for (const job of pendingJobs) {
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
  }, [pendingJobs]);

  return (
    <div className="relative min-h-screen bg-[#f5f5f5] pb-16 pt-24">
      <div className="mx-auto w-3/4 max-w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Pending Upload and Approval</h1>
            <p className="text-gray-600">
              This page displays all jobs awaiting file uploads or proof approval before processing.
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
        ) : !loggedIn ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-gray-700">
              Sign in with the account menu in the header to see jobs that need artwork or proof approval.
            </p>
            <Link href="/register" className="mt-4 inline-block font-medium text-sky-600 hover:underline">
              Create an account
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center text-red-800">{error}</div>
        ) : pendingJobs.length === 0 ? (
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
                          <div className="flex shrink-0 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => openReviewForJob(router, group, job)}
                              className="w-full min-w-[10.5rem] rounded-md bg-sky-600 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 sm:w-auto"
                            >
                              Upload artwork
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

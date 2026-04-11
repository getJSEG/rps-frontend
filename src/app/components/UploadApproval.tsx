"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ordersAPI } from "../../utils/api";
import {
  UPLOAD_APPROVAL_REVIEW_CONTEXT_KEY,
  revokeStoredUploadPreview,
} from "./artwork-review/uploadApprovalReviewStorage";
import { buildArtworkReviewPayload } from "./artwork-review/buildArtworkReviewPayload";
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
  jobIdLabel: string;
  orderedAt: string | null;
  jobName: string;
  productLabel: string;
  dimensions: string | null;
  quantity: number;
  requiredWidthIn: number | null;
  requiredHeightIn: number | null;
};

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadJobRef = useRef<PendingJob | null>(null);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    setAuthReady(true);
  }, []);

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

  const openFilePickerForJob = useCallback((job: PendingJob) => {
    pendingUploadJobRef.current = job;
    fileInputRef.current?.click();
  }, []);

  const onFilePicked = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const job = pendingUploadJobRef.current;
      if (!job) {
        toast.error("Choose a file from a job row using “Upload From Computer”.");
        return;
      }

      void (async () => {
        try {
          const { nextPath } = await buildArtworkReviewPayload(file, {
            jobIdLabel: job.jobIdLabel,
            orderedAtLabel: formatJobDate(job.orderedAt),
            jobName: job.jobName,
            product: job.productLabel,
            dimensions: job.dimensions ?? "",
            quantity: job.quantity,
            requiredWidthIn: job.requiredWidthIn,
            requiredHeightIn: job.requiredHeightIn,
          });
          pendingUploadJobRef.current = null;
          router.push(nextPath);
        } catch (err) {
          pendingUploadJobRef.current = job;
          toast.error(
            err instanceof Error && err.message
              ? err.message
              : "Could not save preview (file may be too large for browser storage)."
          );
        }
      })();
    },
    [router]
  );

  return (
    <div className="relative min-h-screen bg-[#f5f5f5] pb-16 pt-24">
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.pdf,image/jpeg,application/pdf"
        className="hidden"
        onChange={onFilePicked}
      />

      <div className="mx-auto w-3/4 max-w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Upload and Approval</h1>
            <p className="text-gray-600">
              This page displays all jobs awaiting file uploads or proof approval before processing.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              After upload, JPG/PNG files are compared to the job print size by aspect ratio; PDF is accepted for
              now (API will validate later). Demo-only pages:{" "}
              <Link href="/upload-approval/review/ok" className="font-medium text-sky-600 hover:underline">
                size OK
              </Link>
              {" · "}
              <Link href="/upload-approval/review/error" className="font-medium text-sky-600 hover:underline">
                incorrect ratio
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 text-right md:text-right">
            <InfoHint text="Don't Include Crop Marks or Bleed" />
            <InfoHint text="Accepted File Formats: JPG or Single Page PDF" />
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
            {pendingJobs.map((job) => (
              <li key={job.key}>
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 text-sm text-gray-600">
                    <span>
                      Job ID <span className="font-semibold text-gray-900">{job.jobIdLabel}</span>
                    </span>
                    <span className="text-gray-500">{formatJobDate(job.orderedAt)}</span>
                  </div>
                  <div className="grid gap-0 md:grid-cols-[1fr_minmax(220px,280px)]">
                    <div className="border-gray-100 px-4 py-5 md:border-r">
                      <p className="text-sm text-gray-800">
                        <span className="font-medium text-gray-600">Job Name: </span>
                        {job.jobName}
                      </p>
                      <div className="my-4 border-t border-gray-200" />
                      <p className="text-sm text-gray-800">
                        <span className="font-medium text-gray-600">Product: </span>
                        {job.productLabel}
                      </p>
                      {job.dimensions && (
                        <p className="mt-2 text-sm text-gray-800">
                          <span className="font-medium text-gray-600">Dimensions: </span>
                          {job.dimensions}
                        </p>
                      )}
                      <p className="mt-2 text-sm text-gray-800">
                        <span className="font-medium text-gray-600">Qty: </span>x{job.quantity}
                      </p>
                    </div>
                    <div className="flex flex-col justify-center gap-3 border-t border-gray-100 bg-gray-50/80 px-4 py-5 md:border-t-0 md:bg-white">
                      <button
                        type="button"
                        onClick={() => openFilePickerForJob(job)}
                        className="w-full rounded-md bg-sky-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700"
                      >
                        Upload From Computer
                      </button>
                      <Link
                        href="/my-artworks"
                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-3 text-center text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                      >
                        Recent Uploads & My Artworks
                      </Link>
                    </div>
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

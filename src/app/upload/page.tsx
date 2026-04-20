"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import {
  pickFirstOpenablePendingJob,
  UPLOAD_REVIEW_ERROR_CLIENT_PATH,
  writeUploadReviewSessionForGuestJob,
  writeUploadReviewSessionForJob,
} from "../components/artwork-review/openUploadReviewSession";
import { ordersAPI, cartAPI } from "../../utils/api";
import { isAuthenticated } from "../../utils/roles";
import {
  buildPendingUploadJobsFromOrders,
  type UploadApprovalOrderRow,
} from "../../utils/uploadApprovalPending";

function UploadAfterOrderInner() {
  const router = useRouter();
  const [uploadNavBusy, setUploadNavBusy] = useState(false);
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order");
  const guestToken = String(searchParams.get("guestToken") || "").trim();
  const placed = searchParams.get("placed") === "1";
  const redirectStatus = (searchParams.get("redirect_status") || "").toLowerCase();
  const paymentIntentId = searchParams.get("payment_intent");

  useEffect(() => {
    if (!placed || !orderId) return;
    void (async () => {
      try {
        await cartAPI.clear();
      } catch {}
      try {
        localStorage.removeItem("cart");
        window.dispatchEvent(new Event("cartUpdated"));
      } catch {}
    })();
  }, [placed, orderId]);

  useEffect(() => {
    if (!placed || !orderId) return;
    if (redirectStatus !== "succeeded") return;
    if (!paymentIntentId) return;
    const orderIdNum = Number(orderId);
    if (!Number.isFinite(orderIdNum) || orderIdNum <= 0) return;
    const key = `stripe-confirmed-${orderIdNum}-${paymentIntentId}`;
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return;

    void (async () => {
      try {
        await ordersAPI.confirmStripePayment(orderIdNum, paymentIntentId);
        if (typeof window !== "undefined") sessionStorage.setItem(key, "1");
      } catch {
        /* webhook may still update order */
      }
    })();
  }, [placed, orderId, redirectStatus, paymentIntentId]);

  const orderDetailHref =
    orderId != null && orderId !== ""
      ? guestToken
        ? `/guest-orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(guestToken)}&placed=1`
        : `/orders?placed=1&order=${encodeURIComponent(orderId)}`
      : "/orders";

  const hasOrderContext = orderId != null && orderId !== "";

  const goUploadArtwork = () => {
    if (!hasOrderContext) {
      router.push("/upload-approval");
      return;
    }
    const idNum = Number(orderId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      router.push("/upload-approval");
      return;
    }
    if (!guestToken && !isAuthenticated()) {
      toast.info("Please sign in to upload artwork.");
      router.push("/upload-approval");
      return;
    }
    setUploadNavBusy(true);
    void (async () => {
      try {
        const res = guestToken
          ? ((await ordersAPI.getGuestById(String(idNum), guestToken)) as { order?: UploadApprovalOrderRow })
          : ((await ordersAPI.getById(String(idNum))) as { order?: UploadApprovalOrderRow });
        const order = res?.order;
        if (!order || Number(order.id) !== idNum) {
          toast.error("Could not load your order.");
          router.push("/upload-approval");
          return;
        }
        const pending = buildPendingUploadJobsFromOrders([order]);
        const job = pickFirstOpenablePendingJob(pending);
        if (!job) {
          router.push("/upload-approval");
          return;
        }
        try {
          if (guestToken) {
            writeUploadReviewSessionForGuestJob(job, pending, guestToken);
          } else {
            writeUploadReviewSessionForJob(job, pending);
          }
        } catch {
          toast.error("Could not open upload. Try again from Pending Upload and Approval.");
          router.push("/upload-approval");
          return;
        }
        router.push(UPLOAD_REVIEW_ERROR_CLIENT_PATH);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load your order.");
        router.push("/upload-approval");
      } finally {
        setUploadNavBusy(false);
      }
    })();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-6 sm:px-8">
        <div className="flex w-full max-w-2xl flex-col items-center text-center sm:max-w-3xl">
          {/* Stepper: dotted connectors + teal active step (matches reference) */}
          <div className="mb-10 flex w-full items-center justify-center gap-0 sm:mb-12">
            <div className="flex shrink-0 items-center">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-medium text-white shadow-sm"
                aria-hidden
              >
                ✓
              </span>
              <span className="ml-2 text-xs font-medium text-gray-700 sm:text-sm">Shopping Cart</span>
            </div>
            <div className="mx-1 h-0 min-w-[2rem] flex-1 border-t-2 border-dotted border-emerald-500 sm:min-w-[3.5rem]" aria-hidden />
            <div className="flex shrink-0 items-center">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-medium text-white shadow-sm"
                aria-hidden
              >
                ✓
              </span>
              <span className="ml-2 text-sm font-medium text-gray-700">Checkout</span>
            </div>
            <div className="mx-1 h-0 min-w-[2rem] flex-1 border-t-2 border-dotted border-teal-500 sm:min-w-[3.5rem]" aria-hidden />
            <div className="flex shrink-0 items-center">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white shadow-sm">
                3
              </span>
              <span className="ml-2 text-sm font-semibold text-teal-700">Upload</span>
            </div>
          </div>

          <h1 className="text-balance text-2xl font-bold tracking-tight text-gray-800 sm:text-3xl">
            {hasOrderContext ? "Your order has been placed. Thank you" : "Upload artwork"}
          </h1>
          {!hasOrderContext ? (
            <p className="mt-4 max-w-lg text-base text-gray-500">
              Submit files for your jobs from My Artworks, or open an order below.
            </p>
          ) : null}

          <button
            type="button"
            disabled={uploadNavBusy}
            onClick={goUploadArtwork}
            className="mt-10 w-full max-w-sm rounded-lg bg-emerald-600 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploadNavBusy ? "Opening…" : "Upload Artwork"}
          </button>

          {hasOrderContext && (
            <p className="mt-6 max-w-md text-sm leading-relaxed text-gray-700">
              {guestToken
                ? "Save your order tracking link from View order detail if you need to return later."
                : "To submit artwork at a later time, use Upload page in menu bar."}
            </p>
          )}
        </div>
      </div>

      <div className="w-full shrink-0 border-t border-dotted border-gray-300 px-4 pb-8 pt-6 sm:px-6 sm:pb-10">
        <div className="mx-auto w-full max-w-xl text-center">
          <Link href={orderDetailHref} className="text-[15px] font-medium text-sky-500 hover:text-sky-600 hover:underline">
            {hasOrderContext ? "View Order Detail" : "My orders"}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UploadAfterOrderPage() {
  return (
    <div className="min-h-dvh bg-[#f6f6f6]">
      <Navbar />
      {/* Document flow + pt-24 (navbar is fixed) — avoids blank main area on client navigation */}
      <main className="flex min-h-[calc(100dvh-6rem)] flex-col bg-[#f6f6f6] pt-24">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center py-16">
              <p className="text-gray-600">Loading…</p>
            </div>
          }
        >
          <div className="flex min-h-0 flex-1 flex-col">
            <UploadAfterOrderInner />
          </div>
        </Suspense>
      </main>
    </div>
  );
}

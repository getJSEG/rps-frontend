"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { ordersAPI } from "../../../utils/api";
import { customerOrderStatusDescription, customerOrderStatusTitle } from "../../../utils/orderStatuses";

type OrderItem = {
  id?: number;
  product_name?: string | null;
  job_name?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
};

type GuestOrder = {
  id: number;
  order_number?: string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  total_amount?: number | string | null;
  subtotal_amount?: number | string | null;
  shipping_charge?: number | string | null;
  tax_amount?: number | string | null;
  tax_percentage?: number | string | null;
  tax_name?: string | null;
  items?: OrderItem[] | null;
};

function money(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

function canRequestCancellation(status: string | null | undefined): boolean {
  const s = String(status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  return s === "awaiting_artwork" || s === "on_hold" || s === "awaiting_customer_approval";
}

function GuestOrderTrackInner() {
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const orderId = String(params?.orderId || "").trim();
  const token = String(searchParams.get("token") || "").trim();
  const placed = searchParams.get("placed") === "1";
  const redirectStatus = (searchParams.get("redirect_status") || "").toLowerCase();
  const paymentIntentId = searchParams.get("payment_intent");
  const [order, setOrder] = useState<GuestOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTime, setRefreshTime] = useState<string>("");
  const [copyDone, setCopyDone] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const trackingUrl = useMemo(() => {
    if (typeof window === "undefined" || !orderId || !token) return "";
    return `${window.location.origin}/guest-orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`;
  }, [orderId, token]);

  const loadOrder = useCallback(async () => {
    if (!orderId || !token) {
      setError("Missing order tracking token.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = (await ordersAPI.getGuestById(orderId, token)) as { order?: GuestOrder };
      if (!res?.order) {
        setError("Order not found.");
        setOrder(null);
        return;
      }
      setOrder(res.order);
      setRefreshTime(new Date().toLocaleTimeString());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load order.");
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  const onCopyLink = async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1200);
    } catch {
      setCopyDone(false);
    }
  };

  const submitCancellationRequest = async () => {
    if (!orderId || !token) return;
    setCancelBusy(true);
    setCancelMsg(null);
    try {
      await ordersAPI.requestGuestCancellation(orderId, token);
      setCancelMsg("Cancellation requested.");
      await loadOrder();
    } catch (e: unknown) {
      setCancelMsg(e instanceof Error ? e.message : "Failed to request cancellation.");
    } finally {
      setCancelBusy(false);
      setConfirmCancelOpen(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

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
        await loadOrder();
      } catch {
        /* webhook may still update order */
      }
    })();
  }, [placed, orderId, redirectStatus, paymentIntentId, loadOrder]);

  return (
    <div className="min-h-screen bg-gray-50 pb-16 pt-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {placed && (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
            <p className="font-semibold">Your order has been placed successfully.</p>
            <p className="mt-1 text-sm">
              Since you checked out as a guest, please save this tracking link to view your order status later.
            </p>
            <p className="mt-2 text-sm">
              Order number: <span className="font-semibold">{order?.order_number || `#${orderId}`}</span>
            </p>
            <div className="mt-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs break-all text-gray-700">
              {trackingUrl || "Tracking link unavailable"}
            </div>
            <button
              type="button"
              onClick={onCopyLink}
              disabled={!trackingUrl}
              className="mt-3 inline-flex rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {copyDone ? "Copied" : "Copy link"}
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold text-gray-900">Order tracking</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadOrder()}
              disabled={loading}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh status"}
            </button>
            <Link href="/products" className="text-sm text-[#0B6BCB] hover:underline">
              Continue shopping
            </Link>
          </div>
        </div>
        {refreshTime && <p className="mb-4 text-xs text-gray-500">Updated at {refreshTime}</p>}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-white p-6 text-red-700">{error}</div>
        ) : !order ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-gray-600">Loading order...</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{order.order_number || `Order #${order.id}`}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Placed{" "}
                    {order.created_at
                      ? new Date(order.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                      : "—"}
                  </p>
                </div>
                <p className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                  {customerOrderStatusTitle(order.status)}
                </p>
              </div>
              {customerOrderStatusDescription(order.status) && (
                <p className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {customerOrderStatusDescription(order.status)}
                </p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-gray-500">Payment status</p>
                  <p className="font-medium text-gray-900">{customerOrderStatusTitle(order.payment_status)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Payment method</p>
                  <p className="font-medium text-gray-900">{order.payment_method || "—"}</p>
                </div>
                <div>
                  <p className="text-gray-500">Last updated</p>
                  <p className="font-medium text-gray-900">
                    {order.updated_at
                      ? new Date(order.updated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Items</h2>
              {!Array.isArray(order.items) || order.items.length === 0 ? (
                <p className="text-sm text-gray-500">No items found for this order.</p>
              ) : (
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div key={`${item.id ?? idx}`} className="flex items-start justify-between rounded-md border border-gray-100 p-3">
                      <div>
                        <p className="font-medium text-gray-900">{item.product_name || "Item"}</p>
                        {item.job_name && <p className="text-xs text-gray-500">Job: {item.job_name}</p>}
                        <p className="text-xs text-gray-500">Qty: {item.quantity ?? "—"}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">${money(item.total_price)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 max-w-xs space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>${money(order.subtotal_amount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>${money(order.shipping_charge)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>
                    Tax{Number(order.tax_percentage || 0) > 0 ? ` (${money(order.tax_percentage)}%)` : ""}
                    {order.tax_name ? ` - ${order.tax_name}` : ""}
                  </span>
                  <span>${money(order.tax_amount)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>${money(order.total_amount)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Actions</h2>
              {canRequestCancellation(order.status) ? (
                <button
                  type="button"
                  onClick={() => setConfirmCancelOpen(true)}
                  disabled={cancelBusy}
                  className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                >
                  {cancelBusy ? "Requesting..." : "Request cancellation"}
                </button>
              ) : (
                <p className="text-sm text-gray-500">Cancellation is unavailable for the current order stage.</p>
              )}
              {cancelMsg && <p className="mt-2 text-sm text-gray-700">{cancelMsg}</p>}
            </div>
          </div>
        )}
      </div>
      {confirmCancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
            <p className="text-sm text-gray-700">Are you sure you want to request cancellation for this order?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCancelOpen(false)}
                disabled={cancelBusy}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => void submitCancellationRequest()}
                disabled={cancelBusy}
                className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
              >
                {cancelBusy ? "Requesting..." : "Yes, request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuestOrderTrackPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 pt-24 pb-16 flex items-center justify-center">
            <p className="text-gray-600">Loading...</p>
          </div>
        }
      >
        <GuestOrderTrackInner />
      </Suspense>
      <Footer />
    </>
  );
}

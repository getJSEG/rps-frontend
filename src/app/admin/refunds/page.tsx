"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ordersAPI, getProductImageUrl } from "../../../utils/api";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { adminOrderStatusLabel } from "../../../utils/orderStatuses";

function normalizeStatus(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
}

function isRefundQueueStatus(raw: string): boolean {
  const s = normalizeStatus(raw);
  return (
    s === "cancellation_requested" ||
    s === "awaiting_refund" ||
    s === "refunded" ||
    s === "refund"
  );
}

type RefundFilter = "all" | "cancellation_requested" | "awaiting_refund" | "refunded";

function matchesRefundFilter(status: string, filter: RefundFilter): boolean {
  const s = normalizeStatus(status);
  if (filter === "all") return isRefundQueueStatus(s);
  if (filter === "refunded") return s === "refunded";
  return s === filter;
}

function statusChipClass(status: string): string {
  const s = normalizeStatus(status);
  if (s === "cancellation_requested") return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
  if (s === "awaiting_refund" || s === "refund")
    return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80";
  if (s === "refunded") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
}

interface OrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_image?: string;
}

interface OrderRow {
  id: string;
  order_number: string;
  productName: string;
  productImage?: string;
  productId?: string;
  orderDate: string;
  paymentType: string;
  amount: number;
  status: string;
  user_email?: string;
  user_name?: string;
  items?: OrderItem[];
}

export default function RefundsPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [filter, setFilter] = useState<RefundFilter>("all");
  /** When set, shows centered refund confirmation modal for that order id. */
  const [refundModalOrderId, setRefundModalOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }
    if (!canAccessAdminPanel()) {
      router.push("/");
      return;
    }
  }, [router]);

  useEffect(() => {
    const fetchRefundOrders = async () => {
      try {
        setLoading(true);
        const response = await ordersAPI.getAllAdmin({ page: 1, limit: 1000 });
        if (response?.orders && Array.isArray(response.orders)) {
          const refundOrders: OrderRow[] = response.orders
            .filter((o: any) => {
              const s = (o.status || "").toLowerCase().replace(/\s+/g, "_");
              return isRefundQueueStatus(s);
            })
            .map((order: any) => {
              const firstItem = order.items?.[0];
              const productName = firstItem?.product_name || order.order_number || "N/A";
              const productImage = firstItem?.product_image || firstItem?.image_url || null;
              const productId = firstItem?.product_id?.toString() || null;
              return {
                id: String(order.id),
                order_number: order.order_number || `ORD-${order.id}`,
                productName,
                productImage,
                productId,
                orderDate: order.created_at
                  ? new Date(order.created_at).toLocaleString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—",
                paymentType: order.payment_method || "N/A",
                amount: parseFloat(order.total_amount || 0),
                status: normalizeStatus(order.status || ""),
                user_email: order.user_email,
                user_name: order.user_name,
                items: order.items || [],
              };
            });
          setOrders(refundOrders);
        } else {
          setOrders([]);
        }
      } catch (e) {
        console.error("Error fetching refund orders:", e);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRefundOrders();
  }, []);

  const updateOrderStatusLocally = (id: string, nextStatus: string) => {
    const next = normalizeStatus(nextStatus);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
  };

  const handleMarkAwaitingRefund = async (orderId: string) => {
    try {
      setBusyOrderId(orderId);
      const response = await ordersAPI.updateStatus(orderId, "awaiting_refund");
      const nextStatus = String(response?.order?.status || "awaiting_refund");
      updateOrderStatusLocally(orderId, nextStatus);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update status";
      alert(msg);
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleRefund = async (orderId: string) => {
    try {
      setBusyOrderId(orderId);
      const response = await ordersAPI.refundAdmin(orderId);
      const nextStatus = String(response?.order?.status || "refunded");
      updateOrderStatusLocally(orderId, nextStatus);
      setRefundModalOrderId(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to process refund";
      alert(msg);
    } finally {
      setBusyOrderId(null);
    }
  };

  const filteredOrders = orders.filter((o) => matchesRefundFilter(o.status, filter));
  const refundModalOrder = refundModalOrderId
    ? orders.find((o) => o.id === refundModalOrderId)
    : null;
  const paymentTagClass = (paymentType: string) => {
    const p = String(paymentType || "").toLowerCase();
    if (p === "stripe") return "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80";
    if (p === "manual" || p === "admin_cart")
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
  };
  const paymentLabel = (paymentType: string) => {
    const p = String(paymentType || "").toLowerCase();
    if (p === "stripe") return "Card (Stripe)";
    if (p === "manual") return "Manual / test";
    if (p === "admin_cart") return "Admin cart";
    return paymentType || "—";
  };

  return (
    <AdminNavbar
      title="Refunds"
      subtitle="Orders marked for refund"
    >
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to orders
      </Link>

      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Refund Orders</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                filter === "all"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("cancellation_requested")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                filter === "cancellation_requested"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Cancellation requested
            </button>
            <button
              type="button"
              onClick={() => setFilter("awaiting_refund")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                filter === "awaiting_refund"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Awaiting refund
            </button>
            <button
              type="button"
              onClick={() => setFilter("refunded")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                filter === "refunded"
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Refunded
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3.5 sm:px-6">Product</th>
                <th className="px-4 py-3.5 sm:px-6">Customer</th>
                <th className="px-4 py-3.5 sm:px-6">Email</th>
                <th className="px-4 py-3.5 sm:px-6">Date</th>
                <th className="px-4 py-3.5 sm:px-6">Payment</th>
                <th className="px-4 py-3.5 sm:px-6">Amount</th>
                <th className="px-4 py-3.5 sm:px-6">Status</th>
                <th className="w-24 px-4 py-3.5 sm:px-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                      Loading…
                    </span>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-slate-500">
                    No refund orders right now.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const s = normalizeStatus(order.status);
                  const isBusy = busyOrderId === order.id;
                  return (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/90"
                  >
                    <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          {order.productImage ? (
                            <img
                              src={getProductImageUrl(order.productImage)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-900">{order.productName}</div>
                          <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                            Order ID: {order.order_number || order.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600 sm:px-6">
                      {order.user_name || "—"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600 sm:px-6">
                      {order.user_email || "—"}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-500 sm:px-6">{order.orderDate}</td>
                    <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${paymentTagClass(order.paymentType)}`}>
                        {paymentLabel(order.paymentType)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-900 sm:px-6">
                      ${order.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${statusChipClass(order.status)}`}
                      >
                        {adminOrderStatusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap sm:px-6" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-2">
                        {s === "cancellation_requested" && (
                          <button
                            type="button"
                            onClick={() => handleMarkAwaitingRefund(order.id)}
                            disabled={isBusy}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {isBusy ? "Updating…" : "Mark awaiting refund"}
                          </button>
                        )}
                        {(s === "awaiting_refund" || s === "refund") && (
                          <button
                            type="button"
                            onClick={() => setRefundModalOrderId(order.id)}
                            disabled={isBusy}
                            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                          >
                            {isBusy ? "Refunding…" : "Refund"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {refundModalOrderId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-list-modal-title"
          onClick={() => {
            if (!busyOrderId) setRefundModalOrderId(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="refund-list-modal-title" className="text-lg font-bold text-slate-900">
              Process refund?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to process this refund. This cannot be
              undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundModalOrderId(null)}
                disabled={busyOrderId === refundModalOrderId}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => void handleRefund(refundModalOrderId)}
                disabled={busyOrderId === refundModalOrderId}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
              >
                {busyOrderId === refundModalOrderId ? "Processing…" : "Yes, refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminNavbar>
  );
}

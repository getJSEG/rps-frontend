"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ordersAPI } from "../../../utils/api";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";

const REFUND_TAB_STATUSES = ["refund", "cancelled", "approval_needed", "shipped"];

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
              const s = (o.status || "").toLowerCase();
              return REFUND_TAB_STATUSES.some((ref) => s === ref || s === ref.replace("_", " "));
            })
            .map((order: any) => {
              const firstItem = order.items?.[0];
              const productName = firstItem?.product_name || order.order_number || "N/A";
              const productImage = firstItem?.product_image || null;
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
                status: (order.status || "").toLowerCase(),
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

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === "refund" || s === "cancelled" || s === "canceled")
      return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80";
    if (s === "approval_needed" || s === "approval needed")
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    if (s === "shipped") return "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80";
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
  };

  const formatStatus = (status: string) => {
    const s = status.toLowerCase();
    if (s === "approval_needed" || s === "approval needed") return "Approval Needed";
    if (s === "cancelled" || s === "canceled") return "Cancelled";
    if (s === "refund") return "Refund";
    if (s === "shipped") return "Shipped";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <AdminNavbar
      title="Refunds"
      subtitle="Orders that need follow-up or post-sale handling"
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

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Filtered orders</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Refund, cancelled, approval needed, and shipped. Update status from the order detail page.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3.5 sm:px-6">Product</th>
                <th className="px-4 py-3.5 sm:px-6">Date</th>
                <th className="px-4 py-3.5 sm:px-6">Payment</th>
                <th className="px-4 py-3.5 sm:px-6">Amount</th>
                <th className="px-4 py-3.5 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                      Loading…
                    </span>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center text-slate-500">
                    No orders in these statuses right now.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/90"
                  >
                    <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          {order.productImage ? (
                            <Image
                              src={order.productImage}
                              alt={order.productName}
                              width={48}
                              height={56}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </div>
                        <span className="font-medium text-slate-900">{order.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-500 sm:px-6">{order.orderDate}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-500 sm:px-6">{order.paymentType}</td>
                    <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-900 sm:px-6">
                      ${order.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusColor(order.status)}`}
                      >
                        {formatStatus(order.status)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminNavbar>
  );
}

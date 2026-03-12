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
    if (s === "refund" || s === "cancelled" || s === "canceled") return "bg-red-500 text-white";
    if (s === "approval_needed" || s === "approval needed") return "bg-yellow-500 text-white";
    if (s === "shipped") return "bg-blue-500 text-white";
    return "bg-gray-500 text-white";
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
    <AdminNavbar title="Refunds">
      <div className="flex-1 p-6">
        <div className="mb-4">
          <Link
            href="/admin"
            className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
          >
            ← Back to Orders
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-bold text-gray-800 p-6 pb-2">Refunds (Refund, Cancelled, Approval Needed, Shipped)</h2>
          <p className="text-sm text-gray-500 px-6 pb-4">
            Orders with these statuses are shown here. Change status from the order detail page.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product Image & Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      No orders with Refund / Cancelled / Approval Needed / Shipped status.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/admin/orders/${order.id}`)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-14 bg-gray-100 border border-gray-300 rounded flex items-center justify-center overflow-hidden shrink-0">
                            {order.productImage ? (
                              <Image
                                src={order.productImage}
                                alt={order.productName}
                                width={48}
                                height={56}
                                className="w-full h-full object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="w-12 h-14 bg-gray-200 rounded flex items-center justify-center">
                                <span className="text-gray-400 text-xs">—</span>
                              </div>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900">{order.productName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.orderDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.paymentType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${order.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            order.status
                          )}`}
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
      </div>
    </AdminNavbar>
  );
}

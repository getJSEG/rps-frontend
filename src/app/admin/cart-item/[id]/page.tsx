"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import AdminNavbar from "../../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../../utils/roles";
import { ordersAPI } from "../../../../utils/api";

interface CartItemType {
  id?: string;
  productId?: string;
  productName?: string;
  jobName?: string;
  width?: number;
  height?: number;
  areaSqFt?: number;
  quantity?: number;
  total?: number;
  unitPrice?: number;
  subtotal?: number;
  productImage?: string;
  timestamp?: number;
  savedOrderId?: string;
  [key: string]: unknown;
}

export default function CartItemDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [item, setItem] = useState<CartItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);

  // Pending, In Process, Complete for main flow; Refund-tab statuses for Refunds page
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "processing", label: "In Process" },
    { value: "complete", label: "Complete" },
    { value: "refund", label: "Refund" },
    { value: "cancelled", label: "Cancelled" },
    { value: "approval_needed", label: "Approval Needed" },
    { value: "shipped", label: "Shipped" },
  ];

  const getStatusColor = (s: string) => {
    switch (s.toLowerCase()) {
      case "processing":
      case "complete":
      case "shipped":
      case "delivered":
        return "bg-green-500 text-white";
      case "cancelled":
        return "bg-red-500 text-white";
      case "pending":
      default:
        return "bg-yellow-500 text-white";
    }
  };

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
    if (!id) {
      setError("Item ID missing");
      setLoading(false);
      return;
    }
    try {
      const raw = localStorage.getItem("cart");
      const cart: CartItemType[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) {
        setError("Cart not found");
        setLoading(false);
        return;
      }
      const slug = id.startsWith("cart-") ? id.slice(5) : id;
      const index = parseInt(slug, 10);
      let found: CartItemType | null = null;
      if (!isNaN(index) && index >= 0 && index < cart.length) {
        found = cart[index];
      } else {
        found = cart.find((i) => i.id === slug || `cart-${i.id}` === id) || cart.find((_, i) => `cart-${i}` === id) || null;
      }
      setItem(found || null);
      if (found && found.savedOrderId) setSavedOrderId(String(found.savedOrderId));
      if (!found) setError("Cart item not found. It may have been removed.");
    } catch (e) {
      setError("Failed to load cart item");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("adminCartToOrder");
      const map = saved ? JSON.parse(saved) : {};
      if (map && typeof map === "object" && map[id]) {
        setSavedOrderId(String(map[id]));
      }
    } catch (_) {}
  }, [id]);

  const removeCurrentCartItemFromStorage = () => {
    try {
      const cartRaw = localStorage.getItem("cart");
      let cart: CartItemType[] = cartRaw ? JSON.parse(cartRaw) : [];
      if (!Array.isArray(cart)) return;
      const slug = id.startsWith("cart-") ? id.slice(5) : id;
      const index = parseInt(slug, 10);
      if (!isNaN(index) && index >= 0 && index < cart.length) {
        cart = cart.filter((_, i) => i !== index);
        localStorage.setItem("cart", JSON.stringify(cart));
        window.dispatchEvent(new Event("cartUpdated"));
      } else {
        const newCart = cart.filter((i) => i.id !== slug && `cart-${i.id}` !== id);
        if (newCart.length < cart.length) {
          localStorage.setItem("cart", JSON.stringify(newCart));
          window.dispatchEvent(new Event("cartUpdated"));
        }
      }
    } catch (_) {}
  };

  const handleSaveToDatabase = async () => {
    if (!item) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      let orderId: string | undefined;
      let existingOrderId: string | null = null;
      try {
        const raw = localStorage.getItem("adminCartToOrder");
        const map = raw ? JSON.parse(raw) : {};
        if (map && typeof map === "object" && map[id]) existingOrderId = String(map[id]);
      } catch (_) {}
      const fromItem = item.savedOrderId ? String(item.savedOrderId) : null;
      const useUpdate = !!(savedOrderId || existingOrderId || fromItem);

      if (useUpdate) {
        const targetId = existingOrderId || savedOrderId || fromItem!;
        await ordersAPI.updateStatus(targetId, status);
        orderId = targetId;
        if (!savedOrderId) setSavedOrderId(targetId);
        removeCurrentCartItemFromStorage();
        setSaveSuccess("Status updated. Item removed from cart list so it only appears under Orders.");
        setSaving(false);
        return;
      }

      try {
        const again = localStorage.getItem("adminCartToOrder");
        const mapAgain = again ? JSON.parse(again) : {};
        if (mapAgain && typeof mapAgain === "object" && mapAgain[id]) {
          const existing = String(mapAgain[id]);
          await ordersAPI.updateStatus(existing, status);
          setSavedOrderId(existing);
          removeCurrentCartItemFromStorage();
          setSaveSuccess("Status updated. Item removed from cart list so it only appears under Orders.");
          setSaving(false);
          return;
        }
      } catch (_) {}
      const response = await ordersAPI.createFromCartItem(item as Record<string, unknown>, status);
      orderId = response?.order?.id;
      if (orderId) {
        try {
          const raw = localStorage.getItem("adminCartToOrder");
          const map = raw ? JSON.parse(raw) : {};
          map[id] = orderId;
          localStorage.setItem("adminCartToOrder", JSON.stringify(map));
        } catch (_) {}
        setSavedOrderId(orderId);
        const cartRaw = localStorage.getItem("cart");
        let cart: CartItemType[] = cartRaw ? JSON.parse(cartRaw) : [];
        if (Array.isArray(cart)) {
          const slug = id.startsWith("cart-") ? id.slice(5) : id;
          const index = parseInt(slug, 10);
          if (!isNaN(index) && index >= 0 && index < cart.length) {
            cart = cart.filter((_, i) => i !== index);
            localStorage.setItem("cart", JSON.stringify(cart));
            window.dispatchEvent(new Event("cartUpdated"));
          }
        }
        router.push(`/admin/orders/${orderId}`);
        return;
      }
      setSaveError("Order created but ID not returned.");
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Failed to save to database.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminNavbar title="Cart Item">
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </AdminNavbar>
    );
  }

  if (error || !item) {
    return (
      <AdminNavbar title="Cart Item">
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-red-600 font-semibold mb-2">{error || "Item not found"}</p>
            <button
              onClick={() => router.push("/admin")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Orders
            </button>
          </div>
        </div>
      </AdminNavbar>
    );
  }

  const jobName = item.jobName || item.productName || "—";
  const productName = item.productName || item.jobName || "Cart Item";
  const qty = item.quantity ?? 1;
  const total = item.total ?? item.subtotal ?? item.unitPrice ?? 0;
  const unitPrice = item.unitPrice ?? (typeof total === "number" && qty ? total / qty : 0);
  const tax = total * 0.08;
  const sizeStr = item.width != null && item.height != null ? `${item.width}" x ${item.height}"` : "—";

  return (
    <AdminNavbar title="Cart Item Detail">
      <div className="flex-1 p-6">
        <div className="mb-4">
          <button
            onClick={() => router.push("/admin")}
            className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
          >
            <span>←</span> Back to Orders
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex gap-6 flex-wrap">
            <div className="w-32 h-40 bg-gray-100 border border-gray-300 rounded flex items-center justify-center overflow-hidden shrink-0">
              {item.productImage ? (
                <Image
                  src={item.productImage}
                  alt={productName}
                  width={128}
                  height={160}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-red-600 flex flex-col items-center justify-center text-white p-2">
                  <p className="text-xs font-bold uppercase leading-tight text-center">
                    ONE STOP SHOP & SERVICES COMING SOON
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-4 mb-2">
                <p className="text-sm text-gray-700">Job Name: {jobName}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveToDatabase}
                    disabled={saving}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white shrink-0 ${getStatusColor(status)} hover:opacity-90 disabled:opacity-50`}
                  >
                    {saving ? "Saving…" : savedOrderId ? "Update status" : "Save to database"}
                  </button>
                </div>
              </div>
              {saveError && <p className="text-sm text-red-600 mb-2">{saveError}</p>}
              {saveSuccess && <p className="text-sm text-green-600 mb-2">{saveSuccess}</p>}
              {savedOrderId && (
                <p className="text-sm text-gray-600 mb-2">
                  Already saved as order.{" "}
                  <Link href={`/admin/orders/${savedOrderId}`} className="text-blue-600 hover:underline">View order</Link>
                </p>
              )}
              <p className="text-xl font-bold text-gray-900 mb-3">{productName}</p>

              <div className="space-y-1 mb-4">
                <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Size:</span> {sizeStr}</p>
                <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Material:</span> —</p>
                <p className="text-sm text-gray-600"><span className="font-medium text-gray-800"># of Sides:</span> 1 Side</p>
                <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Hem:</span> —</p>
                <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Grommet:</span> —</p>
                <p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Turnaround:</span> —</p>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Qty:</span>
                  <span className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center bg-gray-50 inline-block">{qty}</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">${Number(total).toFixed(2)}</p>
                  <p className="text-sm text-gray-600">Tax: ${tax.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          {savedOrderId
            ? "This item is already saved as an order. Change the status above and click \"Update status\" to update the order."
            : "Choose a status and click \"Save to database\" to add this item as an order once. It will appear on the admin Orders list. Later you can change status here without creating a new order."}
        </p>
      </div>
    </AdminNavbar>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ordersAPI, cartAPI, getProductImageUrl } from "../../utils/api";
import { isAuthenticated } from "../../utils/roles";
import {
  canonicalOrderStatus,
  customerOrderProgressFirstStepLabel,
  customerOrderProgressKind,
  customerOrderStatusDescription,
  customerOrderStatusTitle,
  isRefundLikeStatus,
} from "../../utils/orderStatuses";

const LIST_LIMIT = 15;

type GuestAddr = {
  street_address?: string;
  address_line2?: string | null;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

type GuestCheckout = {
  email?: string;
  fullName?: string | null;
  phone?: string | null;
  shippingAddress?: GuestAddr;
  billingAddress?: GuestAddr;
};

type OrderItem = {
  id?: number | null;
  product_id?: number | null;
  product_name?: string | null;
  job_name?: string | null;
  quantity?: number | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
  image_url?: string | null;
  width_inches?: number | string | null;
  height_inches?: number | string | null;
};

type OrderRow = {
  id: number;
  order_number?: string | null;
  total_amount?: number | string | null;
  status?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items?: OrderItem[] | null;
  guest_checkout?: GuestCheckout | string | null;
  shipping_street_address?: string | null;
  shipping_address_line2?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postcode?: string | null;
  shipping_country?: string | null;
  billing_street_address?: string | null;
  billing_address_line2?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  billing_postcode?: string | null;
  billing_country?: string | null;
  shipping_method?: string | null;
  shipping_charge?: number | string | null;
  shipping_mode?: string | null;
};

function parseGuestCheckout(raw: OrderRow["guest_checkout"]): GuestCheckout | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as GuestCheckout;
  try {
    return JSON.parse(String(raw)) as GuestCheckout;
  } catch {
    return null;
  }
}

function normalizeItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object" && x != null && (x as OrderItem).id != null);
}

function formatMoney(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toFixed(2);
}

/** Show W×H when both dimensions are valid positive numbers (from product detail). */
function formatLineSizeInches(w: unknown, h: unknown): string | null {
  const nw = w != null && w !== "" ? Number(w) : NaN;
  const nh = h != null && h !== "" ? Number(h) : NaN;
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return null;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
  return `${fmt(nw)}" × ${fmt(nh)}"`;
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return "Unknown";
  return customerOrderStatusTitle(status);
}

function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";
  const m = method.toLowerCase();
  if (m === "stripe") return "Card (Stripe)";
  if (m === "manual") return "Manual / test checkout";
  return formatStatus(method);
}

function statusBadgeClass(status: string | null | undefined): string {
  const c = canonicalOrderStatus(status);
  if (c === "completed") return "bg-emerald-100 text-emerald-800";
  if (c === "shipped") return "bg-violet-100 text-violet-800";
  if (c === "printing" || c === "trimming" || c === "reprint") return "bg-blue-100 text-blue-800";
  if (
    c === "pending_payment" ||
    c === "awaiting_artwork" ||
    c === "awaiting_customer_approval"
  )
    return "bg-amber-100 text-amber-900";
  if (c === "on_hold" || c === "cancelled") return "bg-orange-100 text-orange-900";
  if (c === "awaiting_refund" || c === "refunded") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-800";
}

function shippingLines(order: OrderRow): string[] {
  const mode = String(order.shipping_mode || "").toLowerCase();
  if (mode === "store_pickup" || mode === "store-pickup") {
    const gc = parseGuestCheckout(order.guest_checkout);
    const sa = gc?.shippingAddress;
    if (sa?.street_address) {
      return [
        sa.street_address,
        sa.address_line2 || undefined,
        [sa.city, sa.state, sa.postcode].filter(Boolean).join(", "),
        sa.country || undefined,
      ].filter(Boolean) as string[];
    }
  }
  if (order.shipping_street_address) {
    const lines = [
      order.shipping_street_address,
      order.shipping_address_line2 || undefined,
      [order.shipping_city, order.shipping_state, order.shipping_postcode].filter(Boolean).join(", "),
      order.shipping_country || undefined,
    ].filter(Boolean) as string[];
    return lines;
  }
  const gc = parseGuestCheckout(order.guest_checkout);
  const sa = gc?.shippingAddress;
  if (sa?.street_address) {
    return [
      sa.street_address,
      sa.address_line2 || undefined,
      [sa.city, sa.state, sa.postcode].filter(Boolean).join(", "),
      sa.country || undefined,
    ].filter(Boolean) as string[];
  }
  return [];
}

function billingLines(order: OrderRow): string[] {
  if (order.billing_street_address) {
    return [
      order.billing_street_address,
      order.billing_address_line2 || undefined,
      [order.billing_city, order.billing_state, order.billing_postcode].filter(Boolean).join(", "),
      order.billing_country || undefined,
    ].filter(Boolean) as string[];
  }
  const gc = parseGuestCheckout(order.guest_checkout);
  const ba = gc?.billingAddress;
  if (ba?.street_address) {
    return [
      ba.street_address,
      ba.address_line2 || undefined,
      [ba.city, ba.state, ba.postcode].filter(Boolean).join(", "),
      ba.country || undefined,
    ].filter(Boolean) as string[];
  }
  return [];
}

function contactLines(order: OrderRow): string[] {
  const gc = parseGuestCheckout(order.guest_checkout);
  const lines: string[] = [];
  if (gc?.fullName) lines.push(gc.fullName);
  if (gc?.email) lines.push(gc.email);
  if (gc?.phone) lines.push(gc.phone);
  return lines;
}

function OrderProgressBar({ status }: { status: string | null | undefined }) {
  const kind = customerOrderProgressKind(status);
  if (kind === "cancelled") {
    return null;
  }
  const firstLabel = customerOrderProgressFirstStepLabel(status);
  const steps = [
    { label: firstLabel, min: 1 },
    { label: "Printing", min: 2 },
    { label: "Trimming", min: 3 },
    { label: "Shipped", min: 4 },
    { label: "Completed", min: 5 },
  ];
  const stage = kind === "awaiting_payment" ? 0 : kind.stage;
  if (kind === "awaiting_payment") {
    return (
      <div>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-3">
          Awaiting payment confirmation. This usually updates within a few moments after you pay.
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-0 sm:justify-between opacity-60">
          {steps.map((step, i) => (
            <div key={`step-${i}`} className="flex items-center gap-2 flex-1 min-w-[4.5rem]">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold bg-gray-200 text-gray-500">
                {i + 1}
              </div>
              <span className="text-xs sm:text-sm text-gray-500">{step.label}</span>
              {i < steps.length - 1 && (
                <div className="hidden sm:block flex-1 h-0.5 mx-1 bg-gray-200 min-w-[8px]" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 sm:gap-0 sm:justify-between">
        {steps.map((step, i) => {
          const active = stage >= step.min;
          return (
            <div key={`step-${i}`} className="flex items-center gap-2 flex-1 min-w-[4.5rem]">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  active ? "bg-[#0B6BCB] text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs sm:text-sm ${active ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div className="hidden sm:block flex-1 h-0.5 mx-1 bg-gray-200 min-w-[8px]" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddressBlock({ title, lines }: { title: string; lines: string[] }) {
  if (lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</h4>
        <p className="text-sm text-gray-500">Not on file for this order</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      <div className="text-sm text-gray-800 space-y-0.5">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

function matchesFilter(order: OrderRow, filterOption: string): boolean {
  if (filterOption === "All") return true;
  const raw = (order.status || "").toLowerCase().replace(/\s+/g, "_");
  const c = canonicalOrderStatus(order.status);
  if (filterOption === "Pre-production") {
    return (
      raw === "pending_payment" ||
      c === "awaiting_artwork" ||
      c === "on_hold" ||
      c === "awaiting_customer_approval"
    );
  }
  if (filterOption === "Production") {
    return c === "printing" || c === "trimming" || c === "reprint";
  }
  if (filterOption === "Shipped") return c === "shipped";
  if (filterOption === "Complete") return c === "completed";
  if (filterOption === "Refund") return isRefundLikeStatus(order.status);
  return true;
}

function matchesSearch(order: OrderRow, q: string): boolean {
  if (!q.trim()) return true;
  const n = q.trim().toLowerCase();
  const num = String(order.id);
  const on = (order.order_number || "").toLowerCase();
  const date = order.created_at ? new Date(order.created_at).toLocaleDateString().toLowerCase() : "";
  const total = String(order.total_amount ?? "");
  if (num.includes(n) || on.includes(n) || date.includes(n) || total.includes(n)) return true;
  const items = normalizeItems(order.items);
  return items.some(
    (it) =>
      (it.product_name || "").toLowerCase().includes(n) ||
      (it.job_name || "").toLowerCase().includes(n)
  );
}

export default function Orders() {
  const searchParams = useSearchParams();
  const [filterOption, setFilterOption] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    setAuthReady(true);
  }, []);

  const placed = searchParams.get("placed") === "1";
  const placedOrderId = searchParams.get("order");

  useEffect(() => {
    if (!placed || !placedOrderId) return;
    (async () => {
      try {
        await cartAPI.clear();
      } catch (_) {}
      try {
        localStorage.removeItem("cart");
        window.dispatchEvent(new Event("cartUpdated"));
      } catch (_) {}
    })();
  }, [placed, placedOrderId]);

  useEffect(() => {
    if (placedOrderId && authReady && loggedIn) {
      const id = parseInt(placedOrderId, 10);
      if (!Number.isNaN(id)) {
        setExpanded((prev) => ({ ...prev, [id]: true }));
      }
    }
  }, [placedOrderId, authReady, loggedIn]);

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
        const res = (await ordersAPI.getAll({ limit: LIST_LIMIT, page: 1 })) as { orders?: OrderRow[] };
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

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => matchesFilter(o, filterOption) && matchesSearch(o, searchQuery));
  }, [orders, filterOption, searchQuery]);

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /** Guest just paid: URL has placed=1&order=… — show confirmation only, not the full orders UI. */
  const guestCheckoutSuccessOnly = !!(placed && placedOrderId && (!authReady || !loggedIn));

  return (
    <div className="min-h-screen bg-gray-50 pb-16 pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {placed && placedOrderId && (
          <div
            className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900"
            role="status"
          >
            {loggedIn ? (
              <>
                <p className="font-semibold">Your order was placed.</p>
                <p className="text-sm mt-1">
                  Order #{placedOrderId} — details are expanded below. A confirmation email will be sent to you shortly.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-lg">Thank you for your order!</p>
                <p className="text-sm mt-2">
                  Your order was placed successfully. <span className="font-medium">Order #{placedOrderId}</span>
                </p>
                <p className="text-sm mt-2">A confirmation email will be sent to you shortly.</p>
              </>
            )}
          </div>
        )}

        {!guestCheckoutSuccessOnly && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6 p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">My orders</h1>
                <p className="text-sm text-gray-500 mt-1">Order number, items, delivery address, payment, and status</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 min-w-0">
                  <select
                    value={filterOption}
                    onChange={(e) => setFilterOption(e.target.value)}
                    className="w-full sm:w-44 appearance-none bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0B6BCB] pr-8"
                  >
                    <option value="All">All statuses</option>
                    <option value="Pre-production">Pre-production</option>
                    <option value="Production">Production</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Complete">Complete</option>
                    <option value="Refund">Refund</option>
                  </select>
                  <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none text-gray-500">▾</div>
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search order #, product, job name…"
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6BCB]"
                />
              </div>
              <Link href="/cart" className="text-sm text-[#0B6BCB] hover:underline w-fit">
                View shopping cart
              </Link>
            </div>
          </div>
        )}

        {guestCheckoutSuccessOnly ? (
          !authReady ? (
            <div
              className="mt-2 rounded-2xl border border-gray-200 bg-white p-10 shadow-sm"
              aria-busy="true"
              aria-label="Loading"
            >
              <div className="mx-auto h-9 w-9 rounded-full border-2 border-gray-200 border-t-[#0B6BCB] animate-spin" />
              <p className="mt-4 text-center text-sm text-gray-500">Almost there…</p>
            </div>
          ) : (
            <div className="mt-2 rounded-2xl border border-gray-200/90 bg-white p-6 sm:p-8 shadow-sm">
              <p className="text-center text-sm font-medium text-gray-900">What would you like to do next?</p>
              <p className="text-center text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Browse more products whenever you’re ready.
              </p>
              <div className="mt-6 flex justify-center">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B6BCB] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0959a8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B6BCB] focus-visible:ring-offset-2"
                >
                  <svg className="h-5 w-5 shrink-0 opacity-95" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  Continue shopping
                </Link>
              </div>
            </div>
          )
        ) : !authReady ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">Loading…</p>
          </div>
        ) : !loggedIn ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
            <p className="text-gray-700 mb-4">Sign in to see orders linked to your account.</p>
            <Link
              href="/login"
              className="inline-block bg-[#0B6BCB] hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg"
            >
              Sign in
            </Link>
          </div>
        ) : loading ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600">Loading your orders…</p>
          </div>
        ) : error ? (
          <div className="bg-white border border-red-200 p-8 text-center rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white border border-gray-200 p-8 text-center rounded-lg shadow-sm">
            <p className="text-gray-600 mb-2">No orders match your filters.</p>
            <Link href="/products" className="text-[#0B6BCB] hover:underline text-sm">
              Continue shopping
            </Link>
          </div>
        ) : (
          <ul className="space-y-4">
            {filteredOrders.map((order) => {
              const items = normalizeItems(order.items);
              const subtotal = items.reduce((sum, it) => sum + Number(it.total_price ?? 0), 0);
              const orderTotal = Number(order.total_amount ?? 0);
              const shippingChargeNum = Number(order.shipping_charge ?? 0);
              const hasAdjust = Math.abs(subtotal + shippingChargeNum - orderTotal) > 0.02;
              const isOpen = !!expanded[order.id];
              const whenPlaced = order.created_at
                ? new Date(order.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "—";
              const whenUpdated = order.updated_at
                ? new Date(order.updated_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : null;
              const ship = shippingLines(order);
              const bill = billingLines(order);
              const contact = contactLines(order);
              const shippingMethodLabel = order.shipping_method?.trim() || null;
              const isStorePickup = String(order.shipping_mode || "").toLowerCase() === "store_pickup";

              return (
                <li
                  key={order.id}
                  className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleExpanded(order.id)}
                    className="w-full text-left px-4 py-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {order.order_number || `Order #${order.id}`}
                        </span>
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadgeClass(order.status)}`}
                        >
                          {formatStatus(order.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Placed {whenPlaced}
                        {items.length > 0 && (
                          <span className="text-gray-500">
                            {" "}
                            · {items.length} {items.length === 1 ? "item" : "items"}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <p className="text-lg font-bold text-gray-900">${formatMoney(order.total_amount)}</p>
                      <span className="text-[#0B6BCB] text-sm font-medium whitespace-nowrap">
                        {isOpen ? "Hide details ▲" : "View details ▼"}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 py-5 sm:px-5 bg-gray-50/40 space-y-6">
                      <div className="space-y-3 pb-1">
                        {(() => {
                          const desc = customerOrderStatusDescription(order.status);
                          if (!desc) return null;
                          return (
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-800">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
                                Status details
                              </p>
                              <p>{desc}</p>
                            </div>
                          );
                        })()}
                        <h3 className="text-sm font-semibold text-gray-900">Order status</h3>
                        <OrderProgressBar status={order.status} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Payment status</span>
                          <p className="font-medium text-gray-900">{formatStatus(order.payment_status)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Payment method</span>
                          <p className="font-medium text-gray-900">{formatPaymentMethod(order.payment_method)}</p>
                        </div>
                        {(shippingMethodLabel || shippingChargeNum > 0) && (
                          <div>
                            <span className="text-gray-500">Shipping service</span>
                            <p className="font-medium text-gray-900">
                              {shippingMethodLabel || "—"}
                              {shippingChargeNum > 0 && (
                                <span className="text-gray-600 font-normal"> (${formatMoney(shippingChargeNum)})</span>
                              )}
                            </p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">Order ID</span>
                          <p className="font-medium text-gray-900">{order.id}</p>
                        </div>
                        {whenUpdated && (
                          <div>
                            <span className="text-gray-500">Last updated</span>
                            <p className="font-medium text-gray-900">{whenUpdated}</p>
                          </div>
                        )}
                      </div>

                      {(contact.length > 0 || parseGuestCheckout(order.guest_checkout)?.email) && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Contact (checkout)
                          </h3>
                          <div className="text-sm text-gray-800 space-y-0.5">
                            {contact.map((line, i) => (
                              <p key={i}>{line}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AddressBlock title={isStorePickup ? "Store pickup address" : "Ship to"} lines={ship} />
                        <AddressBlock title="Bill to" lines={bill.length > 0 ? bill : ship} />
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                          Items in this order
                        </h3>
                        {items.length === 0 ? (
                          <p className="text-sm text-gray-500">No line items returned for this order.</p>
                        ) : (
                          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-100 text-left text-gray-600">
                                  <th className="px-3 py-2 font-medium w-[72px]"> </th>
                                  <th className="px-3 py-2 font-medium">Product</th>
                                  <th className="px-3 py-2 font-medium text-right w-20">Qty</th>
                                  <th className="px-3 py-2 font-medium text-right w-24">Price</th>
                                  <th className="px-3 py-2 font-medium text-right w-28">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((it) => {
                                  const img = getProductImageUrl(it.image_url || undefined);
                                  const sizeLine = formatLineSizeInches(it.width_inches, it.height_inches);
                                  return (
                                    <tr key={it.id} className="border-t border-gray-100">
                                      <td className="px-3 py-2 align-top">
                                        <div className="w-14 h-14 rounded border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
                                          {img ? (
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                          ) : (
                                            <span className="text-[10px] text-gray-400">No img</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 align-top">
                                        <p className="font-medium text-gray-900">{it.product_name || "Item"}</p>
                                        {it.job_name ? (
                                          <p className="text-gray-500 text-xs mt-0.5">Job: {it.job_name}</p>
                                        ) : null}
                                        {sizeLine ? (
                                          <p className="text-gray-500 text-xs mt-0.5">Size: {sizeLine}</p>
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-2 align-top text-right text-gray-800">
                                        {it.quantity ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 align-top text-right text-gray-800">
                                        ${formatMoney(it.unit_price)}
                                      </td>
                                      <td className="px-3 py-2 align-top text-right font-medium text-gray-900">
                                        ${formatMoney(it.total_price)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 border-t border-gray-200 pt-4">
                        <div className="w-full max-w-xs space-y-1 text-sm">
                          <div className="flex justify-between text-gray-600">
                            <span>Items subtotal</span>
                            <span>${formatMoney(subtotal)}</span>
                          </div>
                          {shippingChargeNum > 0 && (
                            <div className="flex justify-between text-gray-600">
                              <span>Shipping</span>
                              <span>${formatMoney(shippingChargeNum)}</span>
                            </div>
                          )}
                          {hasAdjust && (
                            <p className="text-xs text-gray-500 text-right">
                              Totals may differ slightly from line items due to rounding or adjustments.
                            </p>
                          )}
                          <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                            <span>Order total</span>
                            <span>${formatMoney(order.total_amount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

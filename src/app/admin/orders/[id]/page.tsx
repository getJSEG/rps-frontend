"use client";

import { useState, useEffect, useCallback, useRef, type MouseEvent, type ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { lineCustomerArtworkSource } from "../../../../utils/customerArtworkSource";
import { ordersAPI, getProductImageUrl, downloadUrlAsFile } from "../../../../utils/api";
import AdminNavbar from "../../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated, getUserRole } from "../../../../utils/roles";
import {
  ADMIN_ORDER_STATUS_OPTIONS,
  adminOrderStatusLabel,
  isOrderStatusLocked,
} from "../../../../utils/orderStatuses";

interface OrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  job_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_image?: string;
  product_material?: string;
  product_description?: string;
  product_price_per_sqft?: number;
  product_min_charge?: number;
  product_category?: string;
  product_subcategory?: string;
  product_sku?: string;
  width_inches?: number;
  height_inches?: number;
  /** Customer-uploaded artwork for this line (path or URL from API). */
  customer_artwork_url?: string | null;
  /** Some API responses use camelCase; normalized to `customer_artwork_url` when order loads. */
  customerArtworkUrl?: string | null;
  selection_mode?: "graphic_only" | "graphic_frame" | null;
  graphic_scenario_enabled?: boolean | null;
  selected_modifiers?: Array<{
    group_key?: string | null;
    group_name?: string | null;
    option_value?: string | null;
    option_label?: string | null;
    price_adjustment?: number | string | null;
  }>;
}

function lineGraphicSelectionLabel(item: OrderItem): string | null {
  const mode = String(item.selection_mode || "").trim().toLowerCase();
  if (mode === "graphic_only") return "Graphic";
  if (mode === "graphic_frame") return "Graphic + Frame";
  return null;
}

interface GuestCheckoutShape {
  email?: string;
  fullName?: string;
  full_name?: string;
  phone?: string;
  telephone?: string;
  shippingAddress?: Record<string, string | null | undefined>;
  billingAddress?: Record<string, string | null | undefined>;
}

interface Order {
  id: string;
  user_id?: string | null;
  order_number: string;
  status: string;
  total_amount: number;
  payment_method: string;
  payment_status?: string;
  created_at: string;
  updated_at?: string;
  notes?: string | null;
  guest_checkout?: GuestCheckoutShape | string | null;
  shipping_address_id?: string | null;
  billing_address_id?: string | null;
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
  items: OrderItem[];
  user_email?: string;
  user_name?: string;
  /** Guest checkout or merged display */
  customer_phone?: string;
  shipping_method?: string | null;
  shipping_charge?: number;
  shipping_mode?: string | null;
  subtotal_amount?: number;
  tax_name?: string | null;
  tax_percentage?: number;
  tax_amount?: number;
  /** Optional carrier / shipment ID (DB: order_tracking_id). */
  order_tracking_id?: string | null;
}

function parseGuest(raw: Order["guest_checkout"]): GuestCheckoutShape | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as GuestCheckoutShape;
  try {
    return JSON.parse(String(raw)) as GuestCheckoutShape;
  } catch {
    return null;
  }
}

function guestPhoneDisplay(g: GuestCheckoutShape | null): string | undefined {
  if (!g) return undefined;
  const p = g.phone ?? g.telephone;
  if (p == null || String(p).trim() === "") return undefined;
  return String(p).trim();
}

function formatMoney(n: number) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}

function formatStatus(status: string) {
  return adminOrderStatusLabel(status);
}

function formatPaymentMethod(m: string) {
  const x = (m || "").toLowerCase();
  if (x === "stripe") return "Card (Stripe)";
  if (x === "manual") return "Manual / test";
  return m || "—";
}

function dash(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function formatSizeWxH(w: unknown, h: unknown): string {
  const nw = w != null && w !== "" ? Number(w) : NaN;
  const nh = h != null && h !== "" ? Number(h) : NaN;
  if (!Number.isFinite(nw) || !Number.isFinite(nh) || nw <= 0 || nh <= 0) return "—";
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));
  return `${fmt(nw)}" × ${fmt(nh)}"`;
}

function formatSizeForOrderLine(item: OrderItem): string {
  if (lineGraphicSelectionLabel(item)) return "—";
  return formatSizeWxH(item.width_inches, item.height_inches);
}

function lineSelectedModifiers(item: OrderItem): Array<{
  group_name: string;
  option_label: string;
}> {
  const raw = Array.isArray(item.selected_modifiers) ? item.selected_modifiers : [];
  return raw
    .map((m) => ({
      group_name: String(m?.group_name || m?.group_key || "").trim(),
      option_label: String(m?.option_label || m?.option_value || "").trim(),
    }))
    .filter((m) => m.group_name && m.option_label);
}

function jobArtworkDownloadName(item: OrderItem, href: string): string {
  const fromPath = href.split("?")[0].split("/").pop()?.trim();
  if (fromPath && /\.[a-z0-9]{2,8}$/i.test(fromPath)) return fromPath;
  const raw = lineCustomerArtworkSource(item) ?? "";
  const tail = raw.split("?")[0].split("/").pop();
  if (tail && tail.length > 0) return tail;
  return `line-${item.id}-artwork`;
}

/** Same heroicons-style glyphs as `MyArtworks.tsx` (preview + download). */
function ArtworkPreviewIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z"
      />
    </svg>
  );
}

function ArtworkDownloadIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function JobArtworkDownloadCell({ item }: { item: OrderItem }) {
  const href = getProductImageUrl(lineCustomerArtworkSource(item));
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewOpen]);

  if (!href) {
    return <span className="text-slate-400">—</span>;
  }
  const ext = href.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const isRasterImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
  const isPdf = ext === "pdf";
  const downloadName = jobArtworkDownloadName(item, href);

  const onDownload = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadUrlAsFile(href, downloadName);
    } catch {
      /* Proxied /uploads/ download in downloadUrlAsFile */
    } finally {
      setDownloading(false);
    }
  };

  const openPreview = () => setPreviewOpen(true);

  return (
    <>
      <div className="flex max-w-[11rem] flex-col gap-2 sm:max-w-none sm:flex-row sm:items-center sm:gap-3">
        {isRasterImage ? (
          <button
            type="button"
            onClick={openPreview}
            className="inline-flex h-11 w-11 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
            title="Preview"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={href} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <button
            type="button"
            onClick={openPreview}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md border border-slate-200 bg-slate-100 text-[10px] font-semibold leading-tight text-slate-600"
            title="Preview"
          >
            {isPdf ? "PDF" : "File"}
          </button>
        )}
        <div className="flex flex-col items-center  text-sky-600">
          <button
            type="button"
            className="rounded  transition-colors hover:bg-sky-50 hover:text-sky-800"
            title="Preview"
            aria-label="Preview artwork"
            onClick={openPreview}
          >
            <ArtworkPreviewIcon />
          </button>
          <button
            type="button"
            className="rounded transition-colors hover:bg-sky-50 hover:text-sky-800 disabled:opacity-50"
            title={downloading ? "Saving…" : "Download"}
            aria-label="Download artwork"
            onClick={onDownload}
            disabled={downloading}
          >
            <ArtworkDownloadIcon className={downloading ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
          </button>
        </div>
      </div>

      {previewOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Artwork preview"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-4xl rounded-lg bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="truncate pr-3 text-sm font-semibold text-gray-900" title={downloadName}>
                {downloadName}
              </h3>
              <button
                type="button"
                className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                onClick={() => setPreviewOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="max-h-[78vh] overflow-auto bg-gray-50 p-4">
              {isPdf ? (
                <iframe
                  title="Artwork PDF"
                  src={href}
                  className="h-[72vh] w-full rounded border border-gray-200 bg-white"
                />
              ) : isRasterImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={href}
                  alt=""
                  className="mx-auto max-h-[72vh] w-auto rounded border border-gray-200 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center text-gray-600">
                  <p className="text-sm">Preview isn&apos;t available for this file type in the browser.</p>
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
                  >
                    <ArtworkDownloadIcon className="h-4 w-4" />
                    {downloading ? "Saving…" : "Download file"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function linesFromDbOrder(o: Order, kind: "shipping" | "billing"): string[] {
  const pre = kind === "shipping" ? "shipping" : "billing";
  const street = o[`${pre}_street_address` as keyof Order] as string | null | undefined;
  if (!street) return [];
  const line2 = o[`${pre}_address_line2` as keyof Order] as string | null | undefined;
  const city = o[`${pre}_city` as keyof Order] as string | null | undefined;
  const state = o[`${pre}_state` as keyof Order] as string | null | undefined;
  const post = o[`${pre}_postcode` as keyof Order] as string | null | undefined;
  const country = o[`${pre}_country` as keyof Order] as string | null | undefined;
  const lines = [street, line2 || undefined, [city, state, post].filter(Boolean).join(", ") || undefined, country || undefined];
  return lines.filter(Boolean) as string[];
}

function linesFromGuestAddr(a?: Record<string, string | null | undefined>): string[] {
  if (!a) return [];
  const street = a.street_address || a.streetAddress;
  if (!street) return [];
  const line2 = a.address_line2 || a.addressLine2;
  const city = a.city;
  const state = a.state;
  const post = a.postcode || a.zip || a.postalCode;
  const country = a.country;
  return [street, line2 || undefined, [city, state, post].filter(Boolean).join(", ") || undefined, country || undefined].filter(
    Boolean
  ) as string[];
}

function DetailCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 sm:py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900 break-words">{value}</dd>
    </div>
  );
}

function FormattedAddressCard({ title, lines }: { title: string; lines: string[] }) {
  if (!lines.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-2 space-y-0.5 text-sm text-slate-800">
        {lines.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </div>
  );
}

export default function OrderDetails() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id ? String(params.id) : null;
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);
  const [removingTracking, setRemovingTracking] = useState(false);
  const [removeTrackingModalOpen, setRemoveTrackingModalOpen] = useState(false);
  const [deleteOrderModalOpen, setDeleteOrderModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [expandedModifierLines, setExpandedModifierLines] = useState<Record<string, boolean>>({});

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError("Order ID is missing");
      setLoading(false);
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setError("Authentication required. Please login as admin to view order details.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setOrder(null);

      const response = await ordersAPI.getByIdAdmin(String(orderId));

      if (!response || !response.order) {
        throw new Error("Invalid response from server");
      }

      const d = response.order as Record<string, unknown>;
      const guestPreview = parseGuest((d.guest_checkout as Order["guest_checkout"]) ?? undefined);
      const mergedUserEmail =
        d.user_email != null && String(d.user_email).trim() !== ""
          ? String(d.user_email)
          : guestPreview?.email
            ? String(guestPreview.email).trim()
            : undefined;
      const mergedUserName =
        d.user_name != null && String(d.user_name).trim() !== ""
          ? String(d.user_name)
          : guestPreview?.fullName || guestPreview?.full_name
            ? String(guestPreview.fullName || guestPreview.full_name).trim()
            : undefined;
      const mergedCustomerPhone = guestPhoneDisplay(guestPreview);

      const processedOrder: Order = {
        id: String(d.id),
        user_id: d.user_id != null ? String(d.user_id) : null,
        order_number: String(d.order_number || `ORD-${d.id}`),
        status: String(d.status || "awaiting_artwork"),
        total_amount: parseFloat(String(d.total_amount)) || 0,
        payment_method: String(d.payment_method || "N/A"),
        payment_status: d.payment_status != null ? String(d.payment_status) : undefined,
        created_at: String(d.created_at || new Date().toISOString()),
        updated_at: d.updated_at != null ? String(d.updated_at) : undefined,
        notes: d.notes != null ? String(d.notes) : undefined,
        guest_checkout: (d.guest_checkout as Order["guest_checkout"]) ?? undefined,
        shipping_address_id: d.shipping_address_id != null ? String(d.shipping_address_id) : null,
        billing_address_id: d.billing_address_id != null ? String(d.billing_address_id) : null,
        shipping_street_address: d.shipping_street_address != null ? String(d.shipping_street_address) : null,
        shipping_address_line2: d.shipping_address_line2 != null ? String(d.shipping_address_line2) : null,
        shipping_city: d.shipping_city != null ? String(d.shipping_city) : null,
        shipping_state: d.shipping_state != null ? String(d.shipping_state) : null,
        shipping_postcode: d.shipping_postcode != null ? String(d.shipping_postcode) : null,
        shipping_country: d.shipping_country != null ? String(d.shipping_country) : null,
        billing_street_address: d.billing_street_address != null ? String(d.billing_street_address) : null,
        billing_address_line2: d.billing_address_line2 != null ? String(d.billing_address_line2) : null,
        billing_city: d.billing_city != null ? String(d.billing_city) : null,
        billing_state: d.billing_state != null ? String(d.billing_state) : null,
        billing_postcode: d.billing_postcode != null ? String(d.billing_postcode) : null,
        billing_country: d.billing_country != null ? String(d.billing_country) : null,
        items: Array.isArray(d.items)
          ? (d.items as Record<string, unknown>[])
              .filter((item) => item !== null && item !== undefined)
              .map((item) => ({
                id: String(item.id),
                product_id: item.product_id != null ? String(item.product_id) : undefined,
                product_name: String(item.product_name || "Unknown Product"),
                job_name: item.job_name ? String(item.job_name) : undefined,
                quantity: parseInt(String(item.quantity), 10) || 1,
                unit_price: parseFloat(String(item.unit_price)) || 0,
                total_price: parseFloat(String(item.total_price)) || 0,
                product_image: item.product_image ? String(item.product_image) : undefined,
                product_material: item.product_material ? String(item.product_material) : undefined,
                product_description: item.product_description ? String(item.product_description) : undefined,
                product_price_per_sqft: item.product_price_per_sqft != null ? parseFloat(String(item.product_price_per_sqft)) : undefined,
                product_min_charge: item.product_min_charge != null ? parseFloat(String(item.product_min_charge)) : undefined,
                product_category: item.product_category ? String(item.product_category) : undefined,
                product_subcategory: item.product_subcategory ? String(item.product_subcategory) : undefined,
                product_sku: item.product_sku ? String(item.product_sku) : undefined,
                width_inches:
                  item.width_inches != null && item.width_inches !== ""
                    ? parseFloat(String(item.width_inches))
                    : undefined,
                height_inches:
                  item.height_inches != null && item.height_inches !== ""
                    ? parseFloat(String(item.height_inches))
                    : undefined,
                customer_artwork_url:
                  item.customer_artwork_url != null && String(item.customer_artwork_url).trim() !== ""
                    ? String(item.customer_artwork_url)
                    : item.customerArtworkUrl != null && String(item.customerArtworkUrl).trim() !== ""
                      ? String(item.customerArtworkUrl)
                      : null,
                selected_modifiers: Array.isArray(item.selected_modifiers)
                  ? (item.selected_modifiers as OrderItem["selected_modifiers"])
                  : Array.isArray(item.selectedModifiers)
                    ? (item.selectedModifiers as OrderItem["selected_modifiers"])
                    : [],
                selection_mode:
                  item.selection_mode === "graphic_only" || item.selection_mode === "graphic_frame"
                    ? (item.selection_mode as OrderItem["selection_mode"])
                    : undefined,
                graphic_scenario_enabled: item.graphic_scenario_enabled === true,
              }))
          : [],
        user_email: mergedUserEmail,
        user_name: mergedUserName,
        customer_phone: mergedCustomerPhone,
        shipping_method: d.shipping_method != null ? String(d.shipping_method) : undefined,
        shipping_mode: d.shipping_mode != null ? String(d.shipping_mode) : undefined,
        shipping_charge:
          d.shipping_charge != null && d.shipping_charge !== ""
            ? parseFloat(String(d.shipping_charge)) || 0
            : 0,
        subtotal_amount:
          d.subtotal_amount != null && d.subtotal_amount !== ""
            ? parseFloat(String(d.subtotal_amount)) || 0
            : undefined,
        tax_name: d.tax_name != null ? String(d.tax_name) : null,
        tax_percentage:
          d.tax_percentage != null && d.tax_percentage !== ""
            ? parseFloat(String(d.tax_percentage)) || 0
            : 0,
        tax_amount:
          d.tax_amount != null && d.tax_amount !== ""
            ? parseFloat(String(d.tax_amount)) || 0
            : 0,
        order_tracking_id:
          d.order_tracking_id != null && String(d.order_tracking_id).trim() !== ""
            ? String(d.order_tracking_id)
            : null,
      };
      setOrder(processedOrder);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load order details";

      if (
        errorMessage.includes("Access token required") ||
        errorMessage.includes("Invalid token") ||
        errorMessage.includes("Token expired") ||
        errorMessage.includes("401")
      ) {
        setError("Authentication failed. Please login again as admin.");
        localStorage.removeItem("token");
        localStorage.removeItem("isLoggedIn");
        setTimeout(() => router.push("/"), 2000);
      } else {
        setError(`${errorMessage}. Check that the order exists.`);
      }
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const authenticated = isAuthenticated();
    const hasAccess = canAccessAdminPanel();
    const userRole = getUserRole();

    if (!authenticated) {
      setError("Please login to view order details.");
      setLoading(false);
      setTimeout(() => router.push("/"), 1500);
      return;
    }

    if (!hasAccess) {
      setError(`Access denied. Admin only. Your role: ${userRole || "unknown"}`);
      setLoading(false);
      setTimeout(() => router.push("/"), 2000);
    }
  }, [router]);

  useEffect(() => {
    if (!orderId) {
      setError("Order ID is missing");
      setLoading(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (!isAuthenticated() || !canAccessAdminPanel()) return;
    if (!localStorage.getItem("token")) {
      setError("Please login as admin.");
      setLoading(false);
      return;
    }
    fetchOrder();
  }, [orderId, fetchOrder]);

  useEffect(() => {
    if (!showStatusDropdown) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showStatusDropdown]);

  const statusOptions = ADMIN_ORDER_STATUS_OPTIONS;

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;
    try {
      setUpdatingStatus(true);
      const response = await ordersAPI.updateStatus(order.id, newStatus);
      if (response?.order) {
        setOrder((prev) => (prev ? { ...prev, status: response.order.status } : null));
      }
      setShowStatusDropdown(false);
    } catch {
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const confirmDeleteOrder = async () => {
    if (!order) return;
    try {
      setDeleting(true);
      await ordersAPI.deleteAdmin(order.id);
      setDeleteOrderModalOpen(false);
      router.push("/admin");
    } catch {
      alert("Failed to delete order. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const confirmRefundOrder = async () => {
    if (!order) return;
    try {
      setProcessingRefund(true);
      const response = await ordersAPI.refundAdmin(order.id);
      if (response?.order?.status) {
        setOrder((prev) => (prev ? { ...prev, status: String(response.order.status) } : null));
      } else {
        setOrder((prev) => (prev ? { ...prev, status: "refunded" } : null));
      }
      setRefundModalOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to refund order";
      alert(msg);
    } finally {
      setProcessingRefund(false);
    }
  };

  const openTrackingModal = () => {
    if (!order) return;
    setTrackingDraft(order.order_tracking_id?.trim() ? order.order_tracking_id : "");
    setTrackingModalOpen(true);
  };

  const handleSaveTrackingId = async () => {
    if (!order) return;
    try {
      setSavingTracking(true);
      const trimmed = trackingDraft.trim();
      const response = await ordersAPI.updateOrderTrackingId(order.id, trimmed === "" ? null : trimmed);
      const row = response?.order as Record<string, unknown> | undefined;
      const next =
        row?.order_tracking_id != null && String(row.order_tracking_id).trim() !== ""
          ? String(row.order_tracking_id)
          : null;
      setOrder((prev) => (prev ? { ...prev, order_tracking_id: next } : null));
      setTrackingModalOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save tracking ID";
      alert(msg);
    } finally {
      setSavingTracking(false);
    }
  };

  const confirmRemoveTrackingId = async () => {
    if (!order?.order_tracking_id?.trim()) return;
    try {
      setRemovingTracking(true);
      const response = await ordersAPI.updateOrderTrackingId(order.id, null);
      const row = response?.order as Record<string, unknown> | undefined;
      const next =
        row?.order_tracking_id != null && String(row.order_tracking_id).trim() !== ""
          ? String(row.order_tracking_id)
          : null;
      setOrder((prev) => (prev ? { ...prev, order_tracking_id: next } : null));
      setRemoveTrackingModalOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to remove tracking ID";
      alert(msg);
    } finally {
      setRemovingTracking(false);
    }
  };

  const getStatusStyles = (status: string) => {
    const s = status.toLowerCase().replace(/\s+/g, "_");
    if (s === "shipped") return "bg-violet-50 text-violet-900 ring-violet-200/80";
    if (s === "completed" || s === "complete" || s === "delivered") return "bg-emerald-50 text-emerald-900 ring-emerald-200/80";
    if (s === "awaiting_refund" || s === "refunded" || s === "refund") return "bg-rose-50 text-rose-900 ring-rose-200/80";
    if (s === "on_hold" || s === "cancelled" || s === "canceled") return "bg-orange-50 text-orange-950 ring-orange-200/80";
    if (
      s === "pending_payment" ||
      s === "awaiting_artwork" ||
      s === "awaiting_customer_approval" ||
      s === "approval_needed" ||
      s === "pending"
    )
      return "bg-amber-50 text-amber-950 ring-amber-200/80";
    if (s === "printing" || s === "trimming" || s === "reprint" || s === "processing")
      return "bg-sky-50 text-sky-900 ring-sky-200/80";
    return "bg-slate-100 text-slate-800 ring-slate-200/80";
  };

  const renderThumb = (item: OrderItem) => {
    const artHref = getProductImageUrl(lineCustomerArtworkSource(item));
    const productSrc = getProductImageUrl(item.product_image);
    const artExt = artHref ? artHref.split("?")[0].split(".").pop()?.toLowerCase() || "" : "";
    const useArtThumb =
      !!artHref && ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(artExt);
    const imgSrc = useArtThumb ? artHref : productSrc;
    if (!imgSrc) {
      return <div className="h-12 w-12 rounded-lg bg-slate-200 text-[8px] leading-tight text-slate-500 flex items-center justify-center p-1 text-center">No img</div>;
    }
    const isBackend =
      (item.product_image && String(item.product_image).startsWith("/uploads/")) ||
      useArtThumb ||
      String(imgSrc).includes("/uploads/");
    if (isBackend) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt=""
          title={useArtThumb ? "Uploaded job artwork" : undefined}
          className="h-12 w-12 rounded-lg object-cover border border-slate-200"
        />
      );
    }
    return <Image src={imgSrc} alt="" width={48} height={48} className="h-12 w-12 rounded-lg object-cover border border-slate-200" unoptimized />;
  };

  const toggleModifierLine = (lineKey: string) => {
    setExpandedModifierLines((prev) => ({ ...prev, [lineKey]: !prev[lineKey] }));
  };

  if (loading) {
    return (
      <AdminNavbar title="Order details" subtitle="Loading…">
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <p className="flex items-center gap-3 text-slate-600">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-sky-600" />
            Loading order…
          </p>
        </div>
      </AdminNavbar>
    );
  }

  if (error || !order) {
    return (
      <AdminNavbar title="Order details" subtitle="Error">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-8 shadow-sm">
          <p className="text-lg font-semibold text-rose-900">{error || "Order not found"}</p>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to admin
          </button>
        </div>
      </AdminNavbar>
    );
  }

  const linesSubtotal = order.items.reduce((s, i) => s + (Number.isFinite(i.total_price) ? i.total_price : 0), 0);
  const totalCharged = order.total_amount;
  const shipStored = Number(order.shipping_charge ?? 0);
  const delta = Math.abs(linesSubtotal + shipStored - totalCharged);
  const guest = parseGuest(order.guest_checkout);

  const shipDb = linesFromDbOrder(order, "shipping");
  const billDb = linesFromDbOrder(order, "billing");
  const shipGuest = linesFromGuestAddr(guest?.shippingAddress);
  const billGuest = linesFromGuestAddr(guest?.billingAddress);
  const shipLines = shipDb.length ? shipDb : shipGuest;
  const isStorePickup = String(order.shipping_mode || "").toLowerCase() === "store_pickup";
  const billLines = billDb.length ? billDb : billGuest.length ? billGuest : shipGuest;

  const hasDbAddressIds = Boolean(order.shipping_address_id || order.billing_address_id);
  const guestOnlyAddresses = !hasDbAddressIds && guest && (shipGuest.length > 0 || billGuest.length > 0);
  const billingDiffersFromShipping =
    guestOnlyAddresses &&
    billGuest.length > 0 &&
    JSON.stringify(shipGuest) !== JSON.stringify(billGuest);

  const placedStr = order.created_at
    ? new Date(order.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";
  const updatedStr = order.updated_at
    ? new Date(order.updated_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";
  const normalizedStatus = String(order.status || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const canRefundFromAdmin = normalizedStatus === "awaiting_refund";

  return (
    <AdminNavbar title="Order details" subtitle={order.order_number}>
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to orders
          </button>
          <div className="flex flex-wrap gap-2">
            <div className="relative" ref={statusDropdownRef}>
              {isOrderStatusLocked(order.status) ? (
                <div
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 ${getStatusStyles(order.status)}`}
                  title="Completed orders cannot be moved to another status."
                >
                  <svg className="h-4 w-4 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  {formatStatus(order.status)}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    disabled={updatingStatus}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm ring-1 transition ${getStatusStyles(
                      order.status
                    )} ${updatingStatus ? "opacity-60" : ""}`}
                  >
                    {updatingStatus ? "Updating…" : formatStatus(order.status)}
                    <svg className="h-4 w-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showStatusDropdown && (
                    <div className="absolute right-0 z-30 mt-2 max-h-72 w-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                      {statusOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleStatusUpdate(option.value)}
                          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDeleteOrderModalOpen(true)}
              disabled={deleting}
              className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Delete order
            </button>
            {canRefundFromAdmin && (
              <button
                type="button"
                onClick={() => setRefundModalOpen(true)}
                disabled={processingRefund}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
              >
                {processingRefund ? "Refunding…" : "Refund"}
              </button>
            )}
          </div>
        </div>

        {/* Order tracking ID — optional; admins may add or edit */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Order tracking ID</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-900">
                {order.order_tracking_id?.trim() ? order.order_tracking_id : "—"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openTrackingModal}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-100"
              >
                Order Tracking ID
              </button>
              {order.order_tracking_id?.trim() ? (
                <button
                  type="button"
                  onClick={() => setRemoveTrackingModalOpen(true)}
                  disabled={removingTracking}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  aria-label="Remove order tracking ID"
                  title="Remove tracking ID"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {trackingModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracking-modal-title"
            onClick={() => {
              if (!savingTracking) setTrackingModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="tracking-modal-title" className="text-lg font-bold text-slate-900">
                Order tracking ID
              </h2>
              <input
                type="text"
                value={trackingDraft}
                onChange={(e) => setTrackingDraft(e.target.value)}
                placeholder="Order tracking number"
                className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none ring-slate-200 focus:ring-2"
                maxLength={255}
                autoFocus
              />
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTrackingModalOpen(false)}
                  disabled={savingTracking}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTrackingId}
                  disabled={savingTracking}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {savingTracking ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteOrderModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-order-modal-title"
            onClick={() => {
              if (!deleting) setDeleteOrderModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="delete-order-modal-title" className="text-lg font-bold text-slate-900">
                Delete order?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to delete this order? This cannot be undone.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteOrderModalOpen(false)}
                  disabled={deleting}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteOrder}
                  disabled={deleting}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete order"}
                </button>
              </div>
            </div>
          </div>
        )}

        {refundModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="refund-order-modal-title"
            onClick={() => {
              if (!processingRefund) setRefundModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="refund-order-modal-title" className="text-lg font-bold text-slate-900">
                Process refund?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Are you sure you want to refund this order in Stripe? This action cannot be undone.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRefundModalOpen(false)}
                  disabled={processingRefund}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRefundOrder}
                  disabled={processingRefund}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                  {processingRefund ? "Processing…" : "Yes, refund"}
                </button>
              </div>
            </div>
          </div>
        )}

        {removeTrackingModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-tracking-modal-title"
            onClick={() => {
              if (!removingTracking) setRemoveTrackingModalOpen(false);
            }}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="remove-tracking-modal-title" className="text-lg font-bold text-slate-900">
                Remove tracking ID?
              </h2>
              <p className="mt-2 text-sm text-slate-600">Are you sure you want to remove the order tracking ID?</p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRemoveTrackingModalOpen(false)}
                  disabled={removingTracking}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRemoveTrackingId}
                  disabled={removingTracking}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                >
                  {removingTracking ? "Removing…" : "Remove"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top summary — dense, all key facts */}
        <div className="overflow-hidden rounded-2xl border border-slate-800/20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl shadow-slate-900/25">
          <div className="grid gap-px bg-slate-700/50 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-slate-900/90 p-5 lg:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order</p>
              <p className="mt-1 font-mono text-xl font-bold tracking-tight">{order.order_number}</p>
              <p className="mt-2 text-xs text-slate-400">
                Internal ID <span className="font-mono text-slate-200">{order.id}</span>
                {order.user_id != null && (
                  <>
                    {" · "}
                    User <span className="font-mono text-slate-200">#{order.user_id}</span>
                  </>
                )}
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Line items: <span className="font-semibold text-white">{order.items.length}</span>
              </p>
            </div>
            <div className="bg-slate-900/90 p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Amounts</p>
              <p className="mt-1 text-3xl font-bold tracking-tight">${formatMoney(totalCharged)}</p>
              <p className="mt-2 text-xs text-slate-400">Order total (stored)</p>
              <p className="mt-1 text-sm text-slate-300">Lines sum ${formatMoney(linesSubtotal)}</p>
              {(order.shipping_method || shipStored > 0) && (
                <p className="mt-1 text-sm text-slate-300">
                  Shipping ({dash(order.shipping_method)}) ${formatMoney(shipStored)}
                </p>
              )}
              {delta > 0.02 && <p className="mt-1 text-[11px] text-amber-200/90">Δ rounding or adjustments</p>}
            </div>
            <div className="bg-slate-900/90 p-5 sm:col-span-2 lg:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Payment & fulfillment</p>
              <p className="mt-2 text-sm font-medium">{formatPaymentMethod(order.payment_method)}</p>
              <p className="mt-1 text-sm text-slate-300">Payment: {dash(order.payment_status)}</p>
              <p className="mt-1 text-sm text-slate-300">Fulfillment: {formatStatus(order.status)}</p>
            </div>
            <div className="bg-slate-900/90 p-5 lg:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Customer</p>
              {order.user_name || order.user_email ? (
                <>
                  {!order.user_id && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Guest checkout</p>}
                  <p className="mt-2 text-sm font-semibold text-white">{dash(order.user_name)}</p>
                  {order.user_email && (
                    <a href={`mailto:${order.user_email}`} className="mt-1 block text-sm text-sky-300 hover:underline">
                      {order.user_email}
                    </a>
                  )}
                  {order.customer_phone && (
                    <a href={`tel:${order.customer_phone.replace(/\s/g, "")}`} className="mt-1 block text-sm text-slate-300 hover:text-white">
                      {order.customer_phone}
                    </a>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-400">No customer record</p>
              )}
            </div>
            <div className="bg-slate-900/90 p-5 sm:col-span-2 lg:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Timeline</p>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-slate-500">Created</span>{" "}
                  <span className="font-medium text-white">{placedStr}</span>
                </p>
                <p>
                  <span className="text-slate-500">Updated</span>{" "}
                  <span className="font-medium text-white">{updatedStr}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Single panel: full record + addresses + notes + line-item table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-3">
            <h2 className="text-sm font-bold text-slate-800">Complete order record</h2>
            <p className="text-xs text-slate-500">All database fields, addresses, notes, and products in one view</p>
          </div>

          <div className="px-5 py-4">
            <dl className="grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-3">
              <DetailCell label="Order number" value={order.order_number} />
              <DetailCell label="Order ID" value={order.id} />
              <DetailCell label="Order tracking ID" value={order.order_tracking_id?.trim() ? order.order_tracking_id : "—"} />
              {order.user_id != null && <DetailCell label="User ID" value={order.user_id} />}
              <DetailCell label="Customer name" value={dash(order.user_name)} />
              <DetailCell
                label="Customer email"
                value={
                  order.user_email ? (
                    <a href={`mailto:${order.user_email}`} className="text-sky-700 hover:underline">
                      {order.user_email}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailCell
                label="Customer phone"
                value={
                  order.customer_phone ? (
                    <a href={`tel:${order.customer_phone.replace(/\s/g, "")}`} className="text-sky-700 hover:underline">
                      {order.customer_phone}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailCell label="Status" value={formatStatus(order.status)} />
              <DetailCell label="Payment method" value={formatPaymentMethod(order.payment_method)} />
              <DetailCell label="Payment status" value={dash(order.payment_status)} />
              <DetailCell label="Total amount" value={`$${formatMoney(order.total_amount)}`} />
              <DetailCell label="Subtotal" value={`$${formatMoney(order.subtotal_amount ?? linesSubtotal)}`} />
              <DetailCell label="Shipping service" value={dash(order.shipping_method)} />
              <DetailCell label="Shipping charge" value={`$${formatMoney(shipStored)}`} />
              <DetailCell
                label={`Tax${order.tax_name ? ` (${order.tax_name})` : ""}`}
                value={`$${formatMoney(order.tax_amount ?? 0)}${order.tax_percentage ? ` (${formatMoney(order.tax_percentage)}%)` : ""}`}
              />
              {(hasDbAddressIds || order.user_id != null) && (
                <>
                  <DetailCell label="Shipping address ID" value={dash(order.shipping_address_id)} />
                  <DetailCell label="Billing address ID" value={dash(order.billing_address_id)} />
                </>
              )}
              <DetailCell label="Created at" value={placedStr} />
              <DetailCell label="Updated at" value={updatedStr} />
            </dl>
          </div>

          {guestOnlyAddresses ? (
            <div className="border-t border-slate-200 p-5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                {isStorePickup ? "Store pickup address" : "Delivery address"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">From guest checkout (not linked to saved address IDs)</p>
              <div className={`mt-4 grid gap-4 ${billingDiffersFromShipping ? "sm:grid-cols-2" : ""}`}>
                <FormattedAddressCard title={isStorePickup ? "Store pickup address" : "Shipping"} lines={shipGuest} />
                {billingDiffersFromShipping ? <FormattedAddressCard title="Billing" lines={billGuest} /> : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-0 border-t border-slate-200 sm:grid-cols-2">
              <div className="border-b border-slate-200 p-5 sm:border-b-0 sm:border-r">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {isStorePickup ? "Store pickup address" : "Ship to"}
                </h3>
                {shipLines.length ? (
                  <div className="mt-2 space-y-0.5 text-sm text-slate-800">
                    {shipLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">—</p>
                )}
              </div>
              <div className="border-b border-slate-200 p-5 sm:border-b-0">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Bill to</h3>
                {billLines.length ? (
                  <div className="mt-2 space-y-0.5 text-sm text-slate-800">
                    {billLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">—</p>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 px-5 py-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{order.notes && String(order.notes).trim() ? order.notes : "—"}</p>
          </div>

          <div className="border-t border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Products / line items</h3>
              <span className="text-xs text-slate-500">{order.items.length} row(s)</span>
            </div>
            <div className="overflow-x-auto">
              {order.items.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No line items.</p>
              ) : (
                <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3 pl-5"> </th>
                      <th className="px-3 py-3">Product</th>
                      <th className="px-3 py-3">Job</th>
                      <th className="px-3 py-3 whitespace-nowrap">Download</th>
                      <th className="px-3 py-3 whitespace-nowrap">Size (W×H)</th>
                      <th className="px-3 py-3">SKU</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Material</th>
                      <th className="px-3 py-3 text-right">Qty</th>
                      <th className="px-3 py-3 text-right">Unit</th>
                      <th className="px-3 py-3 text-right pr-5">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item) => {
                      const lineKey = String(item.id);
                      const selectedMods = lineSelectedModifiers(item);
                      const modifiersOpen = !!expandedModifierLines[lineKey];
                      const visibleModifiers =
                        selectedMods.length > 2 && !modifiersOpen
                          ? selectedMods.slice(0, 2)
                          : selectedMods;
                      return (
                      <tr key={item.id} className="border-b border-slate-100 align-top hover:bg-slate-50/50">
                        <td className="px-3 py-3 pl-5">{renderThumb(item)}</td>
                        <td className="px-3 py-3 font-medium text-slate-900">
                          {item.product_id ? (
                            <Link href={`/products/product-detail?productId=${item.product_id}`} className="text-sky-700 hover:underline">
                              {item.product_name}
                            </Link>
                          ) : (
                            item.product_name
                          )}
                          {item.product_id && (
                            <span className="mt-0.5 block text-xs font-normal text-slate-500">ID {item.product_id}</span>
                          )}
                          {lineGraphicSelectionLabel(item) ? (
                            <span className="mt-0.5 block text-xs font-medium text-sky-700">
                              {lineGraphicSelectionLabel(item)}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          <span>{dash(item.job_name)}</span>
                          {selectedMods.length > 0 ? (
                            <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                              {visibleModifiers.map((m, idx) => (
                                <li key={`${item.id}-mod-${idx}`}>
                                  {m.group_name}: {m.option_label}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {selectedMods.length > 2 ? (
                            <button
                              type="button"
                              onClick={() => toggleModifierLine(lineKey)}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-800"
                            >
                              <span aria-hidden>{modifiersOpen ? "▴" : "▾"}</span>
                              {modifiersOpen ? "Show less" : `Show ${selectedMods.length - 2} more`}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top text-slate-700">
                          <JobArtworkDownloadCell item={item} />
                        </td>
                        <td className="px-3 py-3 text-slate-700 tabular-nums whitespace-nowrap">
                          {formatSizeForOrderLine(item)}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{dash(item.product_sku)}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {dash(item.product_category)}
                          {item.product_subcategory && (
                            <span className="block text-xs text-slate-400">{item.product_subcategory}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{dash(item.product_material)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-3 text-right tabular-nums">${formatMoney(item.unit_price)}</td>
                        <td className="px-3 py-3 pr-5 text-right font-semibold tabular-nums text-slate-900">${formatMoney(item.total_price)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/90 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:gap-8">
            <p className="text-sm text-slate-600">
              Sum of lines <span className="font-semibold text-slate-900">${formatMoney(linesSubtotal)}</span>
            </p>
            {(order.shipping_method || shipStored > 0) && (
              <p className="text-sm text-slate-600">
                Shipping ({dash(order.shipping_method)}){" "}
                <span className="font-semibold text-slate-900">${formatMoney(shipStored)}</span>
              </p>
            )}
            {!!(order.tax_amount ?? 0) && (
              <p className="text-sm text-slate-600">
                Tax{order.tax_name ? ` (${order.tax_name})` : ""}{" "}
                <span className="font-semibold text-slate-900">
                  ${formatMoney(order.tax_amount ?? 0)}
                  {order.tax_percentage ? ` (${formatMoney(order.tax_percentage)}%)` : ""}
                </span>
              </p>
            )}
            <p className="text-base font-bold text-slate-900">
              Order total <span className="ml-2">${formatMoney(totalCharged)}</span>
            </p>
          </div>
        </div>

        <div className="pb-8">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to orders
          </button>
        </div>
      </div>
    </AdminNavbar>
  );
}

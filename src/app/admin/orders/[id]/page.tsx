"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ordersAPI, productsAPI, getProductImageUrl } from "../../../../utils/api";
import AdminNavbar from "../../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated, getUserRole } from "../../../../utils/roles";

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
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  items: OrderItem[];
  user_email?: string;
  user_name?: string;
}

export default function OrderDetails() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.id ? String(params.id) : null;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showItemStatusDropdown, setShowItemStatusDropdown] = useState<{ [key: string]: boolean }>({});

  const fetchOrder = useCallback(async () => {
    if (!orderId) {
      setError("Order ID is missing");
      setLoading(false);
      return;
    }

    // Check token - if missing, API will handle it
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setError("Authentication required. Please login as admin to view order details.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setOrder(null); // Reset order state
      
      const orderIdStr = String(orderId);
      // Call backend API
      const response = await ordersAPI.getByIdAdmin(orderIdStr);
      
      if (!response || !response.order) {
        throw new Error("Invalid response from server");
      }
      
      const orderData = response.order;
      // Process order data - ensure all fields are properly formatted
      const processedOrder: Order = {
        id: String(orderData.id),
        order_number: orderData.order_number || `ORD-${orderData.id}`,
        status: orderData.status || "pending",
        total_amount: parseFloat(orderData.total_amount) || 0,
        payment_method: orderData.payment_method || "N/A",
        created_at: orderData.created_at || new Date().toISOString(),
        items: Array.isArray(orderData.items) 
          ? orderData.items
              .filter((item: any) => item !== null && item !== undefined)
              .map((item: any) => ({
                id: String(item.id),
                product_id: item.product_id ? String(item.product_id) : undefined,
                product_name: item.product_name || "Unknown Product",
                job_name: item.job_name || undefined,
                quantity: parseInt(item.quantity) || 1,
                unit_price: parseFloat(item.unit_price) || 0,
                total_price: parseFloat(item.total_price) || 0,
                product_image: item.product_image || undefined,
                product_material: item.product_material || undefined,
                product_description: item.product_description || undefined,
                product_price_per_sqft: item.product_price_per_sqft ? parseFloat(item.product_price_per_sqft) : undefined,
                product_min_charge: item.product_min_charge ? parseFloat(item.product_min_charge) : undefined,
                product_category: item.product_category || undefined,
                product_subcategory: item.product_subcategory || undefined,
                product_sku: item.product_sku || undefined,
              }))
          : [],
        user_email: orderData.user_email || undefined,
        user_name: orderData.user_name || undefined,
      };
      setOrder(processedOrder);
      
    } catch (error: any) {
      const errorMessage = error?.message || "Failed to load order details";
      
      // Handle authentication errors
      if (errorMessage.includes("Access token required") || 
          errorMessage.includes("Invalid token") || 
          errorMessage.includes("Token expired") ||
          errorMessage.includes("401")) {
        setError("Authentication failed. Please login again as admin.");
        // Clear invalid token
        localStorage.removeItem('token');
        localStorage.removeItem('isLoggedIn');
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/');
        }, 2000);
      } else {
        setError(`Error: ${errorMessage}. Please check if the order exists in the database.`);
      }
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  // Check authentication and role before fetching order
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const authenticated = isAuthenticated();
    const hasAccess = canAccessAdminPanel();
    const userRole = getUserRole();

    if (!authenticated) {
      setError("Please login to view order details.");
      setLoading(false);
      setTimeout(() => {
        router.push('/');
      }, 1500);
      return;
    }

    if (!hasAccess) {
      setError(`Access denied. This page is only accessible to admin users. Your role: ${userRole || 'unknown'}`);
      setLoading(false);
      setTimeout(() => {
        router.push('/');
      }, 2000);
      return;
    }

  }, [router]);

  useEffect(() => {
    if (!orderId) {
      setError("Order ID is missing");
      setLoading(false);
      return;
    }

    if (typeof window === 'undefined') return;

    const authenticated = isAuthenticated();
    const hasAccess = canAccessAdminPanel();
    if (!authenticated || !hasAccess) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError("Please login to view order details. This page is only accessible to admin users.");
      setLoading(false);
      return;
    }
    fetchOrder();
  }, [orderId, fetchOrder]);

  // Main flow: Pending, In Process, Complete. Refund-tab statuses: Refund, Cancelled, Approval Needed, Shipped (show on Refunds page)
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "processing", label: "In Process" },
    { value: "complete", label: "Complete" },
    { value: "refund", label: "Refund" },
    { value: "cancelled", label: "Cancelled" },
    { value: "approval_needed", label: "Approval Needed" },
    { value: "shipped", label: "Shipped" },
  ];

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;
    
    try {
      setUpdatingStatus(true);
      const response = await ordersAPI.updateStatus(order.id, newStatus);
      if (response && response.order) {
        // Only update status – keep existing payment_method, items, images etc.
        setOrder((prev) => prev ? { ...prev, status: response.order.status } : null);
      }
      setShowStatusDropdown(false);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order || !window.confirm("Delete this order? This cannot be undone.")) return;
    try {
      setDeleting(true);
      await ordersAPI.deleteAdmin(order.id);
      router.push("/admin");
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("Failed to delete order. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case "processing":
      case "complete":
      case "shipped":
      case "delivered":
        return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
      case "cancelled":
      case "canceled":
      case "refund":
        return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80";
      case "pending":
      case "approval_needed":
      case "approval needed":
        return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
      default:
        return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
    }
  };

  const formatStatus = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case "processing":
        return "Processing";
      case "complete":
        return "Complete";
      case "pending":
        return "Pending";
      case "shipped":
        return "Shipped";
      case "delivered":
        return "Delivered";
      case "cancelled":
      case "canceled":
        return "Cancelled";
      case "refund":
        return "Refund";
      case "approval_needed":
      case "approval needed":
        return "Approval Needed";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  // Calculate tax (8% of total)
  const calculateTax = (amount: number) => {
    return amount * 0.08;
  };

  // Get specifications from order item - use data directly from backend
  const getItemSpecifications = (item: OrderItem) => {
    const material = item.product_material || "N/A";
    const description = item.product_description || "";
    const pricePerSqFt = item.product_price_per_sqft || null;
    const minCharge = item.product_min_charge || null;
    const category = item.product_category || "N/A";
    const subcategory = item.product_subcategory || "N/A";
    const sku = item.product_sku || "N/A";
    const productName = item.product_name || "N/A";
    const jobName = item.job_name || item.product_name || "—";
    const size = "36\" x 13\"";
    return {
      productName,
      jobName,
      size,
      material,
      description,
      pricePerSqFt,
      minCharge,
      category,
      subcategory,
      sku,
      sides: "1 Side",
      hem: "All Sides",
      grommet: "Every 2' All Sides",
      turnaround: "Next Day",
    };
  };

  if (loading) {
    return (
      <AdminNavbar title="Order details" subtitle="Review line items and update status">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm shadow-slate-900/5">
          <p className="flex items-center gap-2 text-slate-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Loading order details…
          </p>
        </div>
      </AdminNavbar>
    );
  }

  if (error || !order) {
    return (
      <AdminNavbar title="Order details" subtitle="Review line items and update status">
        <div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-8 shadow-sm">
          <p className="mb-2 font-semibold text-rose-800">{error || "Order not found"}</p>
          <p className="mb-6 text-sm text-slate-600">
            {error
              ? "There was an error loading the order details. Check the console for more information."
              : "The order you are looking for does not exist or was removed."}
          </p>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            Back to orders
          </button>
        </div>
      </AdminNavbar>
    );
  }

  const tax = calculateTax(order.total_amount);
  const totalWithTax = order.total_amount + tax;

  return (
    <AdminNavbar title="Order details" subtitle={order.order_number}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => router.push("/admin")}
          className="inline-flex w-fit items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to orders
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            disabled={updatingStatus}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
              getStatusColor(order.status)
            } ${updatingStatus ? "cursor-not-allowed opacity-50" : "hover:brightness-[0.98]"}`}
          >
            {formatStatus(order.status)}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showStatusDropdown && (
            <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-lg shadow-slate-900/10">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStatusUpdate(option.value)}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-8">
        <h2 className="mb-5 text-base font-semibold text-slate-900">Order information</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Order number</p>
              <p className="mt-1 text-base font-medium text-slate-900">{order.order_number}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Order date</p>
              <p className="mt-1 text-base font-medium text-slate-900">
                {order.created_at 
                  ? new Date(order.created_at).toLocaleString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Payment method</p>
              <p className="mt-1 text-base font-medium text-slate-900">{order.payment_method || "N/A"}</p>
            </div>
            {order.user_email && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer email</p>
                <p className="mt-1 text-base font-medium text-slate-900">{order.user_email}</p>
              </div>
            )}
            {order.user_name && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Customer name</p>
                <p className="mt-1 text-base font-medium text-slate-900">{order.user_name}</p>
              </div>
            )}
        </div>
      </div>

        <div className="space-y-4">
          {order.items && order.items.length > 0 ? (
            order.items.map((item, index) => {
              const specs = getItemSpecifications(item);
              const itemTax = calculateTax(item.total_price);
              const isItemStatusOpen = showItemStatusDropdown[item.id] || false;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-8"
                >
                  <div className="flex flex-col gap-6 sm:flex-row">
                    {/* Product Image - Left */}
                    {item.product_id ? (
                      <Link
                        href={`/products/product-detail?productId=${String(item.product_id)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/products/product-detail?productId=${String(item.product_id)}`);
                        }}
                        className="flex h-40 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition-colors hover:border-sky-400"
                      >
                        {(() => {
                          const imgSrc = getProductImageUrl(item.product_image);
                          const isBackend = item.product_image && String(item.product_image).startsWith("/uploads/");
                          if (!imgSrc) return (
                            <div className="w-full h-full bg-red-600 flex flex-col items-center justify-center text-white p-2">
                              <p className="text-xs font-bold uppercase leading-tight text-center">ONE STOP SHOP & SERVICES COMING SOON</p>
                            </div>
                          );
                          return isBackend ? (
                            <img src={imgSrc} alt={item.product_name} className="w-full h-full object-cover" />
                          ) : (
                            <Image src={imgSrc} alt={item.product_name} width={128} height={160} className="w-full h-full object-cover" unoptimized />
                          );
                        })()}
                      </Link>
                    ) : (
                      <div className="flex h-40 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {(() => {
                          const imgSrc = getProductImageUrl(item.product_image);
                          const isBackend = item.product_image && String(item.product_image).startsWith("/uploads/");
                          if (!imgSrc) return (
                            <div className="w-full h-full bg-red-600 flex flex-col items-center justify-center text-white p-2">
                              <p className="text-xs font-bold uppercase leading-tight text-center">ONE STOP SHOP & SERVICES COMING SOON</p>
                            </div>
                          );
                          return isBackend ? (
                            <img src={imgSrc} alt={item.product_name} className="w-full h-full object-cover" />
                          ) : (
                            <Image src={imgSrc} alt={item.product_name} width={128} height={160} className="w-full h-full object-cover" unoptimized />
                          );
                        })()}
                      </div>
                    )}

                    {/* Content: Job Name, Product Name, Specs, Qty/Price - Design match */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: Job Name (left) + Status dropdown (right) */}
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <p className="text-sm text-slate-600">
                          Job name: <span className="font-medium text-slate-800">{specs.jobName}</span>
                        </p>
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setShowItemStatusDropdown({
                                ...showItemStatusDropdown,
                                [item.id]: !isItemStatusOpen,
                              })
                            }
                            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ${getStatusColor(order.status)} hover:brightness-[0.98]`}
                          >
                            {formatStatus(order.status)}
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isItemStatusOpen && (
                            <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-lg shadow-slate-900/10">
                              {statusOptions.map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    handleStatusUpdate(option.value);
                                    setShowItemStatusDropdown({ ...showItemStatusDropdown, [item.id]: false });
                                  }}
                                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {item.product_id ? (
                        <Link
                          href={`/products/product-detail?productId=${String(item.product_id)}`}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/products/product-detail?productId=${String(item.product_id)}`);
                          }}
                          className="mb-3 block text-xl font-bold text-slate-900 transition hover:text-sky-600"
                        >
                          {specs.productName}
                        </Link>
                      ) : (
                        <p className="mb-3 text-xl font-bold text-slate-900">{specs.productName}</p>
                      )}

                      <div className="mb-4 space-y-1.5">
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800">Size:</span> {specs.size}
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800">Material:</span> {specs.material}
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800"># of sides:</span> {specs.sides}
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800">Hem:</span> {specs.hem}
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800">Grommet:</span> {specs.grommet}
                        </p>
                        <p className="text-sm text-slate-600">
                          <span className="font-medium text-slate-800">Turnaround:</span> {specs.turnaround}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">Qty</span>
                          <input
                            type="number"
                            value={item.quantity}
                            readOnly
                            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm text-slate-800"
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-slate-900">${item.total_price.toFixed(2)}</p>
                          <p className="text-sm text-slate-500">Tax: ${itemTax.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-sm">
              No items in this order.
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-8">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold text-slate-900">${order.total_amount.toFixed(2)}</span>
          </div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-slate-600">Tax</span>
            <span className="font-semibold text-slate-900">${tax.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-lg font-bold text-slate-900">Total</span>
            <span className="text-lg font-bold text-slate-900">${totalWithTax.toFixed(2)}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to orders
          </button>
          <button
            type="button"
            onClick={handleDeleteOrder}
            disabled={deleting}
            className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete order"}
          </button>
        </div>
    </AdminNavbar>
  );
}


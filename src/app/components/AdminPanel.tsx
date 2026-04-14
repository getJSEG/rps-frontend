"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ordersAPI, productsAPI, cartAPI, getProductImageUrl } from "../../utils/api";
import AdminNavbar from "./AdminNavbar";
import { canAccessAdminPanel, isAuthenticated, getUserRole } from "../../utils/roles";
import { FiTrash2 } from "react-icons/fi";
import { adminOrderStatusLabel, canonicalOrderStatus } from "../../utils/orderStatuses";

interface OrderItem {
  id: string;
  product_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Order {
  id: string;
  order_number: string;
  productName: string;
  productImage?: string;
  productId?: string;
  orderDate: string;
  paymentType: string;
  amount: number;
  status: string;
  items?: OrderItem[];
  user_email?: string;
  user_name?: string;
  isCartItem?: boolean; // Flag to identify cart items
}

type GuestCheckoutRow = {
  email?: string;
  fullName?: string;
  full_name?: string;
};

function guestFromOrderRow(order: { guest_checkout?: unknown }): GuestCheckoutRow | null {
  const raw = order.guest_checkout;
  if (!raw) return null;
  if (typeof raw === "object" && raw !== null) return raw as GuestCheckoutRow;
  try {
    return JSON.parse(String(raw)) as GuestCheckoutRow;
  } catch {
    return null;
  }
}

interface CartItem {
  id: string;
  productId?: string;
  productName: string;
  productImage?: string;
  width: number;
  height: number;
  areaSqFt: number;
  quantity: number;
  jobName: string;
  total: number;
  unitPrice?: number;
  subtotal?: number;
  shippingCost?: number;
  tax?: number;
  [key: string]: any;
}

export default function AdminPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All Projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const sampleImages = [
    "/0a3pGsJF-s1000.jpg",
    "/0EVddVW5-s1000.jpg",
    "/22UuQewt-s1000.jpg",
    "/2koFWu1n-s1000.jpg",
    "/3PVhOONT-s1000.jpg",
    "/3XJNimyc-s1000.jpg",
    "/4Uag4HyR-s1000.jpg",
    "/5HeAGSx1-s1000.jpg",
    "/66xRJHT0-s1000.jpg",
  ];

  const [allOrders, setAllOrders] = useState<Order[]>([]); // Start with empty array - will be populated from database
  const [loading, setLoading] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [adminCartToOrder, setAdminCartToOrder] = useState<Record<string, string>>({}); // cart item id -> order id (so we don't show same item twice)
  const [productImages, setProductImages] = useState<{ [key: string]: string }>({});
  const [accessGranted, setAccessGranted] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const itemsPerPage = 10;

  const handleRemoveOrder = async (e: React.MouseEvent, order: { id: string; order_number: string; isCartItem?: boolean }) => {
    e.stopPropagation();
    setRemovingId(order.id);
    try {
      if (order.isCartItem) {
        const cartItemId = String(order.id).replace(/^cart-/, "");
        await cartAPI.remove(cartItemId);
        setCartItems((prev) => prev.filter((i) => String(i.id) !== cartItemId));
      } else {
        await ordersAPI.deleteAdmin(order.id);
        setAllOrders((prev) => prev.filter((o) => o.id !== order.id));
      }
      setConfirmDeleteId(null);
    } catch (err: any) {
      alert(err?.message || "Failed to remove.");
    } finally {
      setRemovingId(null);
    }
  };

  // Check if user is admin before allowing access; only then allow data fetches
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const authenticated = isAuthenticated();
    const hasAccess = canAccessAdminPanel();
    const userRole = getUserRole();

    if (!authenticated) {
      router.push('/');
      return;
    }

    if (!hasAccess) {
      router.push('/');
      return;
    }

    setAccessGranted(true);
  }, [router]);

  useEffect(() => {
    if (!accessGranted) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        
        // Always load the first chunk from the API; table pagination is client-side only.
        // Passing UI currentPage as API page would skip rows (e.g. page 2 → offset 1000).
        const response = await ordersAPI.getAllAdmin({
          page: 1,
          limit: 1000,
        });

        if (response && response.orders && Array.isArray(response.orders)) {
          if (response.orders.length > 0) {
            const formattedOrders: Order[] = response.orders.map((order: any) => {
              // Get first product name from items
              const firstItem = order.items && Array.isArray(order.items) && order.items.length > 0 ? order.items[0] : null;
              const productName = firstItem?.product_name || order.order_number || "N/A";
              
              // Format date
              const orderDate = order.created_at 
                ? new Date(order.created_at).toLocaleString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : new Date().toLocaleString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

              // Get product image from first item (from product table via backend)
              const productImage = firstItem?.product_image || firstItem?.image_url || null;
              const productId = firstItem?.product_id?.toString() || null;

              const gc = guestFromOrderRow(order);
              const guestName = gc?.fullName || gc?.full_name || "";
              const guestEmail = gc?.email || "";
              const user_name = order.user_name || guestName || undefined;
              const user_email = order.user_email || guestEmail || undefined;

              return {
                id: String(order.id || Math.random()),
                order_number: order.order_number || `ORD-${order.id}`,
                productName: productName,
                productImage: productImage,
                productId: productId,
                orderDate: orderDate,
                paymentType: order.payment_method || "N/A",
                amount: parseFloat(order.total_amount || 0),
                status: (order.status || "awaiting_artwork").toLowerCase(),
                items: order.items || [],
                user_email,
                user_name,
              };
            });
            setAllOrders(formattedOrders);
          } else {
            setAllOrders([]);
          }
        } else {
          setAllOrders([]);
        }
      } catch (error: any) {
        const msg = error?.message?.toLowerCase() || "";
        if (msg.includes("token") || msg.includes("access") || msg.includes("session") || msg.includes("unauthorized")) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("token");
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("user");
            localStorage.removeItem("userRole");
            router.push("/");
          }
          return;
        }
        setAllOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [accessGranted, activeTab, router]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Load all users' cart items from API when admin (backend returns all carts); else fallback to localStorage
  useEffect(() => {
    if (!accessGranted) return;

    const loadCart = async () => {
      try {
        if (isAuthenticated()) {
          const res = await cartAPI.get();
          if (res && res.isAdminView && Array.isArray(res.cartItems)) {
            setCartItems(res.cartItems);
          } else if (res && Array.isArray(res.cartItems)) {
            setCartItems(res.cartItems);
          } else {
            const cart = localStorage.getItem("cart");
            const items = cart ? JSON.parse(cart) : [];
            setCartItems(Array.isArray(items) ? items : []);
          }
        } else {
          const cart = localStorage.getItem("cart");
          const items = cart ? JSON.parse(cart) : [];
          setCartItems(Array.isArray(items) ? items : []);
        }
        const raw = localStorage.getItem("adminCartToOrder");
        const map = raw ? JSON.parse(raw) : {};
        setAdminCartToOrder(map && typeof map === "object" ? map : {});
      } catch (error) {
        console.error("Error loading cart:", error);
        const cart = localStorage.getItem("cart");
        const items = cart ? JSON.parse(cart) : [];
        setCartItems(Array.isArray(items) ? items : []);
        setAdminCartToOrder({});
      } finally {
        setCartLoading(false);
      }
    };

    loadCart();

    const onCartUpdated = () => loadCart();
    window.addEventListener("cartUpdated", onCartUpdated);
    window.addEventListener("storage", onCartUpdated);

    return () => {
      window.removeEventListener("cartUpdated", onCartUpdated);
      window.removeEventListener("storage", onCartUpdated);
    };
  }, [accessGranted]);

  // Fetch product images for orders that don't have images
  useEffect(() => {
    const fetchProductImages = async () => {
      // Get unique product IDs that don't have images
      const ordersWithoutImages = allOrders.filter(order => !order.productImage && order.productId);
      const uniqueProductIds = [...new Set(ordersWithoutImages.map(order => order.productId).filter(Boolean))];

      if (uniqueProductIds.length === 0) return;

      try {
        const imageMap: { [key: string]: string } = {};
        
        // Fetch products in parallel
        await Promise.all(
          uniqueProductIds.map(async (productId) => {
            try {
              const response = await productsAPI.getById(productId as string);
              const p = response?.product;
              if (!p) return;
              const gallery = p.gallery_images;
              let fromGallery = "";
              if (Array.isArray(gallery) && gallery.length > 0) {
                fromGallery = String(gallery[0] ?? "").trim();
              }
              const raw = (p.image_url && String(p.image_url).trim()) || fromGallery;
              if (raw) imageMap[productId as string] = raw;
            } catch (error) {
              console.error(`Error fetching product ${productId}:`, error);
            }
          })
        );

        setProductImages(prev => ({ ...prev, ...imageMap }));
      } catch (error) {
        console.error("Error fetching product images:", error);
      }
    };

    fetchProductImages();
  }, [allOrders]);

  // Convert cart items to order format for display (exclude items already saved as orders to avoid duplicate rows)
  const cartItemsAsOrders = cartItems
    .map((cartItem, index) => ({ cartItem, index, rowId: `cart-${cartItem.id ?? index}` }))
    .filter(({ rowId }) => !adminCartToOrder[rowId])
    .map(({ cartItem, index }) => ({
    id: `cart-${cartItem.id || index}`,
    order_number: `CART-${cartItem.id || index}`,
    productName: cartItem.productName || cartItem.jobName || "Cart Item",
    productImage: cartItem.productImage || null,
    productId: cartItem.productId || null,
    orderDate: cartItem.timestamp 
      ? new Date(cartItem.timestamp).toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : new Date().toLocaleString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    paymentType: "Pending",
    amount: cartItem.total || cartItem.totalPrice || cartItem.subtotal || 0,
    status: "awaiting_artwork",
    items: [{
      id: cartItem.id,
      product_id: cartItem.productId,
      product_name: cartItem.productName || cartItem.jobName,
      quantity: cartItem.quantity || 1,
      unit_price: cartItem.unitPrice || cartItem.totalPrice || 0,
      total_price: cartItem.total || cartItem.totalPrice || 0,
    }],
    user_email: cartItem.userEmail || cartItem.user_email || "—",
    user_name: cartItem.userName || cartItem.user_name || "—",
    isCartItem: true, // Flag to identify cart items
  }));

  // Filter orders based on active tab and search query
  const getFilteredOrders = () => {
    // Combine orders and cart items
    const combinedItems = [...allOrders, ...cartItemsAsOrders];
    const excludedFromMain = new Set([
      "cancellation_requested",
      "awaiting_refund",
      "refunded",
      "refund",
    ]);
    const baseVisible = combinedItems.filter((order) => {
      if (order.isCartItem) return true;
      const c = canonicalOrderStatus(order.status);
      return !excludedFromMain.has(c);
    });
    let filtered = combinedItems;

    // Apply tab filter
    if (activeTab === "All Projects") {
      // Show all orders and cart items
      filtered = baseVisible;
    } else if (activeTab === "In Progress") {
      filtered = baseVisible.filter((order) => {
        const c = canonicalOrderStatus(order.status);
        return (
          c === "printing" ||
          c === "trimming" ||
          c === "reprint" ||
          c === "shipped" ||
          c === "awaiting_artwork" ||
          c === "awaiting_customer_approval"
        );
      });
    } else if (activeTab === "Pending") {
      // Show pre-production orders and all cart items (cart items use awaiting_artwork placeholder)
      filtered = baseVisible.filter((order) => {
        const c = canonicalOrderStatus(order.status);
        return (
          order.isCartItem ||
          c === "pending_payment" ||
          c === "awaiting_artwork" ||
          c === "on_hold"
        );
      });
    } else if (activeTab === "Complete") {
      filtered = baseVisible.filter((order) => {
        const c = canonicalOrderStatus(order.status);
        return c === "completed";
      });
    }

    // Apply search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.productName.toLowerCase().includes(q) ||
          order.orderDate.toLowerCase().includes(q) ||
          order.paymentType.toLowerCase().includes(q) ||
          order.order_number.toLowerCase().includes(q) ||
          (order.user_email && order.user_email.toLowerCase().includes(q)) ||
          (order.user_name && order.user_name.toLowerCase().includes(q))
      );
    }

    return filtered;
  };

  const filteredOrders = getFilteredOrders();
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const getStatusColor = (status: string) => {
    const c = canonicalOrderStatus(status);
    if (c === "completed" || c === "shipped") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
    if (c === "awaiting_refund" || c === "refunded") return "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80";
    if (c === "on_hold" || c === "cancelled") return "bg-orange-50 text-orange-900 ring-1 ring-orange-200/80";
    if (
      c === "pending_payment" ||
      c === "awaiting_artwork" ||
      c === "awaiting_customer_approval"
    )
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/80";
    if (c === "printing" || c === "trimming" || c === "reprint")
      return "bg-sky-50 text-sky-900 ring-1 ring-sky-200/80";
    return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";
  };

  const formatStatus = (status: string) => adminOrderStatusLabel(status);

  /** Same pill as Status column; map payment row to a status key for shared colors. */
  const paymentKeyForTag = (order: { isCartItem?: boolean; paymentType?: string }) => {
    if (order.isCartItem) return "awaiting_artwork";
    const p = (order.paymentType || "").toLowerCase();
    if (p === "stripe") return "printing";
    if (p === "manual" || p === "admin_cart") return "awaiting_artwork";
    return "unknown";
  };

  const formatPaymentLabel = (order: { isCartItem?: boolean; paymentType?: string }) => {
    if (order.isCartItem) return "Cart";
    const raw = order.paymentType || "—";
    const p = raw.toLowerCase();
    if (p === "stripe") return "Card (Stripe)";
    if (p === "manual") return "Manual / test";
    if (p === "admin_cart") return "Admin cart";
    return raw;
  };

  return (
    <AdminNavbar
      title="Orders"
      subtitle="Placed orders and items still in customer carts"
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {["All Projects", "In Progress", "Pending", "Complete"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-slate-700 text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab}
              </button>
            ))}
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
                      Loading orders…
                    </span>
                  </td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-slate-500">
                    No orders match the current filters.
                  </td>
                </tr>
              ) : (
                    paginatedOrders.map((order) => {
                      const orderId = String(order.id).trim();
                      const orderDetailUrl = order.isCartItem ? `/admin/cart-item/${orderId}` : `/admin/orders/${orderId}`;
                      const isCart = !!order.isCartItem;
                      return (
                      <tr
                        key={order.id}
                        onClick={() => router.push(orderDetailUrl)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50/90 ${isCart ? "bg-amber-50/40" : ""} ${canonicalOrderStatus(order.status) === "completed" ? "bg-sky-50/30" : ""}`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-14 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition-opacity hover:opacity-90"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(orderDetailUrl);
                              }}
                            >
                              {(() => {
                                const raw = order.productImage || (order.productId && productImages[order.productId]);
                                const imageUrl = raw ? getProductImageUrl(raw) : "";
                                return imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                <div className="w-12 h-14 bg-yellow-200 border border-yellow-300 rounded flex flex-col items-center justify-center relative overflow-hidden">
                                  <div className="absolute top-0 left-0 right-0 bg-yellow-300 h-3 flex items-center justify-center">
                                    <span className="text-[6px] font-bold text-yellow-800">BRAND LOGO</span>
                                  </div>
                                  <svg
                                    className="w-6 h-6 text-yellow-600 mt-1"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </div>
                                );
                              })()}
                            </div>
                            <Link
                              href={orderDetailUrl}
                              onClick={(e) => e.stopPropagation()}
                              className="font-medium text-slate-900 transition-colors hover:text-sky-600"
                            >
                              {order.productName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-700 sm:px-6">
                          {order.user_name || "—"}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-600 sm:px-6">
                          {order.user_email || "—"}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-500 sm:px-6">
                          {order.orderDate}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${getStatusColor(
                              paymentKeyForTag(order)
                            )}`}
                          >
                            {formatPaymentLabel(order)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-900 sm:px-6">
                          ${order.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${getStatusColor(order.status)}`}>
                            {formatStatus(order.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap sm:px-6" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-flex">
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmDeleteId((prev) => (prev === order.id ? null : order.id))
                              }
                              disabled={removingId === order.id}
                              title="Remove"
                              aria-label={order.isCartItem ? "Remove from cart" : "Remove order"}
                              className="inline-flex items-center justify-center rounded-lg p-1.5 font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {removingId === order.id ? (
                                <span className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" />
                              ) : (
                                <FiTrash2 size={18} aria-hidden />
                              )}
                            </button>
                            {confirmDeleteId === order.id && (
                              <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                                <p className="text-xs text-slate-700">
                                  {order.isCartItem
                                    ? "Remove this cart item? This cannot be undone."
                                    : "Are you sure you want to delete this order?"}
                                </p>
                                <div className="mt-3 flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                  >
                                    No
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleRemoveOrder(e, order)}
                                    disabled={removingId === order.id}
                                    className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                                  >
                                    Yes, remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>

        <div className="flex flex-col gap-4 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <select
              value={itemsPerPage}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400/40"
              disabled
            >
              <option value={10}>10 / page</option>
            </select>
            <span>
              {startIndex + 1}–{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  type="button"
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`min-w-[2.25rem] rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    currentPage === pageNum
                      ? "border-slate-700 bg-slate-700 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span className="px-1 text-sm text-slate-400">…</span>
            )}
            {totalPages > 5 && (
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                className={`min-w-[2.25rem] rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  currentPage === totalPages
                    ? "border-slate-700 bg-slate-700 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                }`}
              >
                {totalPages}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(Math.max(1, totalPages), prev + 1))}
              disabled={totalPages === 0 || currentPage === totalPages}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </AdminNavbar>
  );
}


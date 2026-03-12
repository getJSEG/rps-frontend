"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ordersAPI, productsAPI, cartAPI } from "../../utils/api";
import AdminNavbar from "./AdminNavbar";
import { canAccessAdminPanel, isAuthenticated, getUserRole } from "../../utils/roles";

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
  const itemsPerPage = 10;

  const handleRemoveOrder = async (e: React.MouseEvent, order: { id: string; order_number: string; isCartItem?: boolean }) => {
    e.stopPropagation();
    const label = order.isCartItem ? "this cart item" : `order ${order.order_number}`;
    if (!window.confirm(`Remove ${label}? This cannot be undone.`)) return;
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
        
        const response = await ordersAPI.getAllAdmin({
          page: currentPage,
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

              return {
                id: String(order.id || Math.random()),
                order_number: order.order_number || `ORD-${order.id}`,
                productName: productName,
                productImage: productImage,
                productId: productId,
                orderDate: orderDate,
                paymentType: order.payment_method || "N/A",
                amount: parseFloat(order.total_amount || 0),
                status: (order.status || "pending").toLowerCase(),
                items: order.items || [],
                user_email: order.user_email,
                user_name: order.user_name,
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
  }, [accessGranted, activeTab, currentPage, router]);

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
              if (response.product && response.product.image_url) {
                imageMap[productId as string] = response.product.image_url;
              }
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
    status: "pending", // Cart items are always pending
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
    let filtered = combinedItems;

    // Apply tab filter
    if (activeTab === "All Projects") {
      // Show all orders and cart items
      filtered = combinedItems;
    } else if (activeTab === "In Progress") {
      filtered = combinedItems.filter(order => {
        const statusLower = order.status.toLowerCase();
        return statusLower === "processing" || statusLower === "shipped";
      });
    } else if (activeTab === "Pending") {
      // Show pending orders and all cart items (cart items are always pending)
      filtered = combinedItems.filter(order => {
        const statusLower = order.status.toLowerCase();
        return statusLower === "pending" || statusLower === "approval needed" || order.isCartItem;
      });
    } else if (activeTab === "Complete") {
      filtered = combinedItems.filter(order => {
        const statusLower = order.status.toLowerCase();
        return statusLower === "complete" || statusLower === "delivered";
      });
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(order =>
        order.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderDate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.paymentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.user_email && order.user_email.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    return filtered;
  };

  const filteredOrders = getFilteredOrders();
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case "processing":
      case "complete":
      case "approved":
      case "shipped":
      case "delivered":
        return "bg-green-500 text-white";
      case "cancelled":
      case "canceled":
        return "bg-red-500 text-white";
      case "pending":
      case "approval needed":
        return "bg-yellow-500 text-white";
      default:
        return "bg-gray-500 text-white";
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
      case "approval needed":
      case "approval_needed":
        return "Approval Needed";
      case "cancelled":
      case "canceled":
        return "Cancelled";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <AdminNavbar 
      title="New Orders"
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      {/* Main Content */}
      <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow-sm">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <div className="px-6 py-4">
                <div className="flex space-x-6 border-b-2 border-transparent">
                  {["All Projects", "In Progress", "Pending", "Complete"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setCurrentPage(1);
                      }}
                      className={`pb-4 px-2 font-medium transition-colors ${
                        activeTab === tab
                          ? "text-blue-600 border-b-2 border-blue-600"
                          : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                 
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Image & Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        Loading orders...
                      </td>
                    </tr>
                  ) : paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                        No orders found
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
                        className={`cursor-pointer hover:bg-gray-50 ${isCart ? "bg-yellow-50" : ""} ${order.status.toLowerCase() === "complete" ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-12 h-14 bg-gray-100 border border-gray-300 rounded flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(orderDetailUrl);
                              }}
                            >
                              {(() => {
                                const imageUrl = order.productImage || (order.productId && productImages[order.productId]);
                                return imageUrl ? (
                                  <Image
                                    src={imageUrl}
                                    alt={order.productName}
                                    width={48}
                                    height={56}
                                    className="w-full h-full object-cover"
                                    unoptimized
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
                              className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                            >
                              {order.productName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {order.user_name || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {order.user_email || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.orderDate}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.isCartItem ? (
                            <span className="text-yellow-600 font-medium">Cart Item</span>
                          ) : (
                            order.paymentType
                          )}
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
                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveOrder(e, order)}
                            disabled={removingId === order.id}
                            className="text-red-600 hover:text-red-800 hover:underline text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {removingId === order.id ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      </tr>
                    );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <select
                  value={itemsPerPage}
                  className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled
                >
                  <option value={10}>10</option>
                </select>
                <span className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &lt;
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
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 border rounded text-sm ${
                        currentPage === pageNum
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                {totalPages > 5 && currentPage < totalPages - 2 && (
                  <span className="px-2 text-sm text-gray-500">...</span>
                )}
                {totalPages > 5 && (
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    className={`px-3 py-1 border rounded text-sm ${
                      currentPage === totalPages
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {totalPages}
                  </button>
                )}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
    </AdminNavbar>
  );
}


"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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

export default function Orders() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState("All");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCart = () => {
      try {
        const cart = localStorage.getItem("cart");
        if (cart) {
          const items = JSON.parse(cart);
          setCartItems(Array.isArray(items) ? items : []);
        } else {
          setCartItems([]);
        }
      } catch (error) {
        console.error("Error loading cart:", error);
        setCartItems([]);
      } finally {
        setLoading(false);
      }
    };

    loadCart();

    // Listen for cart updates
    window.addEventListener("cartUpdated", loadCart);
    window.addEventListener("storage", loadCart);

    return () => {
      window.removeEventListener("cartUpdated", loadCart);
      window.removeEventListener("storage", loadCart);
    };
  }, []);

  const handleSearch = () => {
    // Search functionality can be implemented here
  };

  return (
    <div className="min-h-screen bg-white pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="bg-white border-b border-gray-200 mb-8">
          <div className="py-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              {/* Left: Title */}
              <div className="shrink-0">
                <h1 className="text-2xl font-semibold text-gray-800">Order Status</h1>
              </div>

              {/* Center: Search Interface */}
              <div className="flex-1 flex items-center max-w-2xl w-full lg:w-auto">
                <div className="relative">
                  <select
                    value={filterOption}
                    onChange={(e) => setFilterOption(e.target.value)}
                    className="appearance-none bg-gray-100 border border-gray-300 rounded-l-lg px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer pr-8"
                  >
                    <option value="All">All</option>
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="Shipped">Shipped</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg
                      className="w-4 h-4 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Job#, Job Name, Total or Date..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 border-l-0 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />
                <button
                  onClick={handleSearch}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-r-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  Search
                </button>
              </div>

              {/* Right: Info Links */}
              <div className="flex flex-col items-center shrink-0">
                <a
                  href="#"
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  Cancellation Policy?
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </a>
                <a
                  href="#"
                  className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
                >
                  Understanding Order Status?
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Cart Items Section */}
        {loading ? (
          <div className="mb-8">
            <div className="bg-white border border-gray-300 p-8 text-center">
              <p className="text-gray-600">Loading cart items...</p>
            </div>
          </div>
        ) : cartItems.length > 0 ? (
          <div className="mb-8">
         
            <div className="bg-white border border-gray-300">
              <div className="px-5 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-700">Cart Items:</span>
                    <span className="font-semibold text-gray-900 ml-1">
                      {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-700">Total:</span>
                    <span className="font-semibold text-gray-900 ml-1">
                      ${cartItems.reduce((sum, item) => sum + (item.total || 0), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4">
                {cartItems.map((item, itemIndex) => (
                  <div
                    key={item.id}
                    className={`${
                      itemIndex < cartItems.length - 1 ? "border-b border-gray-200 pb-4 mb-4" : ""
                    }`}
                  >
                    <div className="flex gap-4">
                      {/* Thumbnail */}
                      <div className="shrink-0">
                        <div className="w-20 h-28 bg-gray-100 border border-gray-300 flex items-center justify-center overflow-hidden">
                          {item.productImage ? (
                            <Image
                              src={item.productImage}
                              alt={item.productName}
                              width={80}
                              height={112}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">Image</span>
                          )}
                        </div>
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-8">
                          <div className="flex-1 min-w-0">
                            <div className="mb-1.5">
                              <span className="text-sm text-gray-600">Product:</span>
                              <span className="text-sm font-semibold text-gray-900 ml-1">
                                {item.productName}
                              </span>
                            </div>
                            <div className="mb-1.5 text-sm text-gray-700">
                              x{item.quantity || 1}
                            </div>
                            {item.jobName && (
                              <div className="mb-1.5">
                                <span className="text-sm text-gray-600">Job Name:</span>
                                <span className="text-sm text-gray-900 ml-1">{item.jobName}</span>
                              </div>
                            )}
                            {item.width > 0 && item.height > 0 && (
                              <div className="text-sm text-gray-700">
                                {item.width}" × {item.height}" ({item.areaSqFt.toFixed(2)} sq ft)
                              </div>
                            )}
                          </div>

                          {/* Price Info */}
                          <div className="text-right">
                            <div className="mb-1.5">
                              <div className="text-sm text-gray-600">Price</div>
                              <div className="text-sm text-gray-900 font-medium">
                                ${(item.total || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <div className="bg-white border border-gray-300 p-8 text-center">
              <p className="text-gray-600">Your cart is empty.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


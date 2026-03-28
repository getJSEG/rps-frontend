"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  getProductImageUrl,
  cartAPI,
  shippingRatesAPI,
  shippingAmountForService,
  type ShippingRates,
} from "../../utils/api";
import { FiTrash2 } from "react-icons/fi";

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
  userEmail?: string;
  userName?: string;
  userId?: number;
  [key: string]: any;
}

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingRates, setShippingRates] = useState<ShippingRates | null>(null);
  // const [isAdminView, setIsAdminView] = useState(false);
  const hasInitializedRef = useRef(false);

  const loadCart = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await cartAPI.get();
      setCartItems(Array.isArray(res?.cartItems) ? res.cartItems : []);
      // Admin cart view disabled on this page.
      // setIsAdminView(!!res?.isAdminView);
    } catch (error) {
      console.error("Error loading cart:", error);
      setCartItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    loadCart();
    const onCartUpdated = () => loadCart(true);
    window.addEventListener("cartUpdated", onCartUpdated);
    window.addEventListener("storage", onCartUpdated);
    return () => {
      window.removeEventListener("cartUpdated", onCartUpdated);
      window.removeEventListener("storage", onCartUpdated);
    };
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await shippingRatesAPI.get();
        if (!c && res?.rates) setShippingRates(res.rates);
      } catch {
        /* keep null → defaults in shippingAmountForService */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const removeFromCart = async (itemId: string) => {
    try {
      await cartAPI.remove(itemId);
      setCartItems((prev) => prev.filter((item) => item.id !== itemId));
      window.dispatchEvent(new Event("cartUpdated"));
    } catch (error) {
      console.error("Error removing from cart:", error);
    }
  };

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      const item = cartItems.find((i) => i.id === itemId);
      if (!item) return;
      const updatedItem = { ...item, quantity: newQuantity };
      if (updatedItem.unitPrice) {
        updatedItem.subtotal = updatedItem.unitPrice * newQuantity;
        const ship = shippingAmountForService(shippingRates, updatedItem.shippingService);
        updatedItem.shippingCost = ship;
        updatedItem.total = (updatedItem.subtotal || 0) + ship;
      }
      await cartAPI.update(itemId, updatedItem);
      setCartItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      window.dispatchEvent(new Event("cartUpdated"));
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      const sub =
        item.subtotal != null
          ? Number(item.subtotal)
          : (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
      return sum + sub + shippingAmountForService(shippingRates, item.shippingService);
    }, 0);
  };

  if (loading) {
    return (
      <>
        <Navbar cartCountOverride={cartItems.length} skipCartCountFetch />
        <div className="min-h-screen bg-white  pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <p className="text-gray-600">Loading cart...</p>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const subtotalSum = cartItems.reduce((sum, item) => {
    if (item.subtotal != null) return sum + Number(item.subtotal);
    return sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
  }, 0);
  const shippingSum = cartItems.reduce(
    (sum, item) => sum + shippingAmountForService(shippingRates, item.shippingService),
    0
  );

  return (
    <>
      <Navbar cartCountOverride={cartItems.length} skipCartCountFetch />
      <div className="min-h-screen bg-gray-50 pt-25 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {cartItems.length === 0 ? (
            <>
              {/* Cart title hidden */}
              <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
                <svg className="w-24 h-24 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <p className="text-gray-600 text-lg mb-4">Your cart is empty</p>
                <Link href="/products" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors">
                  Continue Shopping
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* Top summary card hidden */}

              {/* Full-width product cards */}
              <div className="space-y-4 mb-4">
                {cartItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col lg:flex-row gap-6 w-full"
                  >
                    {/* Product Image */}
                    <div className="w-full lg:w-48 h-48 lg:h-40 bg-gray-100 rounded-lg relative overflow-hidden shrink-0">
                      {(() => {
                        const raw = item.productImage;
                        const src = raw ? getProductImageUrl(raw) || (typeof raw === 'string' ? raw : '') : '';
                        const isBackend = src && (String(raw || '').startsWith('/uploads/') || src.includes('/uploads/'));
                        if (!src || src === '/placeholder.jpg') return (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        );
                        return isBackend ? (
                          <img src={src} alt={item.productName} className="w-full h-full object-cover" />
                        ) : (
                          <Image src={src} alt={item.productName} fill className="object-cover" sizes="192px" />
                        );
                      })()}
                    </div>

                    {/* Product details + config (center) */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Admin user badge disabled */}
                      {/* {isAdminView && (item.userEmail || item.userName) && (
                        <div className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                          {item.userName || "User"} {item.userEmail && `(${item.userEmail})`}
                        </div>
                      )} */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{item.productName}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Added to cart at {item.timestamp ? new Date(item.timestamp).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <span className="text-sm text-gray-400 font-mono shrink-0">{String(index + 1).padStart(2, '0')}</span>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {item.jobName && <p><span className="font-medium text-gray-700">Job Name:</span> {item.jobName}</p>}
                        {item.width > 0 && item.height > 0 && (
                          <p>Size: {item.width}" × {item.height}" ({item.areaSqFt.toFixed(2)} sq ft)</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)} className="px-2  text-gray-600 border border-gray-600 rounded hover:bg-gray-50">−</button>
                          <span className="w-6 text-center text-gray-600  text-sm">{item.quantity || 1}</span>
                          <button onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)} className="px-2  text-gray-600 border border-gray-600 rounded hover:bg-gray-50">+</button>
                        </div>
                        <span className="text-gray-700 font-medium">${(item.subtotal != null ? item.subtotal : (item.unitPrice || 0) * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="inline-flex items-center gap-1.5 text-red-600 hover:underline"
                        >
                          <FiTrash2 className="h-4 w-4 shrink-0" aria-hidden />
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Shipping + item total (right) */}
                    <div className="lg:w-56 shrink-0 space-y-2 text-sm">
                      {item.shippingService && (
                        <p className="text-gray-700">
                          {item.shippingService} ${shippingAmountForService(shippingRates, item.shippingService).toFixed(2)}
                        </p>
                      )}
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-lg font-bold text-gray-900">${(item.total || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom: Order summary card (checkout wala card neeche) */}
              <div className="flex justify-end">
                <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-6">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-gray-700">
                      <span>Subtotal:</span>
                      <span>${subtotalSum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span>Shipping:</span>
                      <span>${shippingSum.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-300 pt-3 mb-4">
                    <div className="flex justify-between text-lg font-bold text-gray-900">
                      <span>Total ({cartItems.length} {cartItems.length === 1 ? 'job' : 'jobs'}):</span>
                      <span>${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push("/checkout")}
                    className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
                  >
                    Checkout
                  </button>
                  <Link href="/products" className="block text-center text-blue-600 hover:text-blue-800 mt-4 text-sm">
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}


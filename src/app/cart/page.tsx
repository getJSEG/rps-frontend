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

interface CartJobLine {
  jobName: string;
  quantity: number;
  unitPrice?: number;
  lineSubtotal?: number;
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
  jobs?: CartJobLine[];
  totalJobs?: number;
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

/** Subtotal for one cart row (sums job lines when `jobs` is set). */
function cartItemLineSubtotal(item: CartItem): number {
  if (item.subtotal != null) return Number(item.subtotal);
  const jobs = item.jobs;
  if (Array.isArray(jobs) && jobs.length > 0) {
    const fallbackUnit = Number(item.unitPrice) || 0;
    return jobs.reduce((sum, line) => {
      if (line.lineSubtotal != null) return sum + Number(line.lineSubtotal);
      const up = Number(line.unitPrice) || fallbackUnit;
      return sum + up * (Number(line.quantity) || 0);
    }, 0);
  }
  return (Number(item.unitPrice) || 0) * (Number(item.quantity) || 1);
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
      if (Array.isArray(item.jobs) && item.jobs.length > 1) return;

      let updatedItem: CartItem = { ...item, quantity: newQuantity };
      const unit = Number(updatedItem.unitPrice) || 0;

      if (Array.isArray(item.jobs) && item.jobs.length === 1) {
        const line = item.jobs[0];
        const lineSubtotal = parseFloat((unit * newQuantity).toFixed(2));
        updatedItem.jobs = [{ ...line, quantity: newQuantity, lineSubtotal, unitPrice: unit }];
        updatedItem.quantity = newQuantity;
        updatedItem.subtotal = lineSubtotal;
        updatedItem.jobName = line.jobName;
        updatedItem.totalJobs = 1;
      } else if (unit) {
        updatedItem.subtotal = unit * newQuantity;
      }

      const ship = shippingAmountForService(shippingRates, updatedItem.shippingService);
      updatedItem.shippingCost = ship;
      updatedItem.total = (updatedItem.subtotal != null ? updatedItem.subtotal : cartItemLineSubtotal(updatedItem)) + ship;

      await cartAPI.update(itemId, updatedItem);
      setCartItems((prev) => prev.map((i) => (i.id === itemId ? updatedItem : i)));
      window.dispatchEvent(new Event("cartUpdated"));
    } catch (error) {
      console.error("Error updating quantity:", error);
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((sum, item) => {
      return sum + cartItemLineSubtotal(item) + shippingAmountForService(shippingRates, item.shippingService);
    }, 0);
  };

  if (loading) {
    return (
      <>
        <Navbar />
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

  const subtotalSum = cartItems.reduce((sum, item) => sum + cartItemLineSubtotal(item), 0);
  const shippingSum = cartItems.reduce(
    (sum, item) => sum + shippingAmountForService(shippingRates, item.shippingService),
    0
  );

  return (
    <>
      <Navbar />
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

              {/* Product line cards */}
              <div className="mb-6 space-y-5">
                {cartItems.map((item, index) => {
                  const shipLine = shippingAmountForService(shippingRates, item.shippingService);
                  return (
                  <div
                    key={item.id}
                    className="flex w-full flex-col gap-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:gap-8"
                  >
                    {/* Thumbnail — square, consistent crop */}
                    <div className="relative mx-auto aspect-square w-full max-w-[11rem] shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-gray-200 sm:max-w-[13rem] lg:mx-0 lg:w-44 lg:max-w-none">
                      {(() => {
                        const raw = item.productImage;
                        const src = raw ? getProductImageUrl(raw) || (typeof raw === 'string' ? raw : '') : '';
                        const isBackend = src && (String(raw || '').startsWith('/uploads/') || src.includes('/uploads/'));
                        if (!src || src === '/placeholder.jpg') return (
                          <div className="flex h-full w-full items-center justify-center">
                            <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        );
                        return isBackend ? (
                          <img src={src} alt="" className="h-full w-full object-cover object-center" />
                        ) : (
                          <Image src={src} alt="" fill className="object-cover object-center" sizes="176px" />
                        );
                      })()}
                      <span className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-gray-600 shadow-sm ring-1 ring-gray-200/80">
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold leading-snug text-gray-900">{item.productName}</h3>
                          <p className="mt-1 text-xs text-gray-500">
                            Added {item.timestamp ? new Date(item.timestamp).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        {item.width > 0 && item.height > 0 && (
                          <div className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-right">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Print size</p>
                            <p className="text-sm font-semibold tabular-nums text-gray-900">{item.width}" × {item.height}"</p>
                            <p className="text-xs text-gray-500">{item.areaSqFt.toFixed(2)} sq ft</p>
                          </div>
                        )}
                      </div>

                      <div className="text-sm text-gray-600">
                        {Array.isArray(item.jobs) && item.jobs.length > 0 ? (
                          <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 sm:p-4">
                            <p className="mb-2 text-sm font-semibold text-gray-900">Jobs ({item.jobs.length})</p>
                            <ul className="divide-y divide-gray-200/80">
                              {item.jobs.map((j, ji) => {
                                const lineAmt =
                                  j.lineSubtotal != null
                                    ? Number(j.lineSubtotal)
                                    : (Number(j.unitPrice) || Number(item.unitPrice) || 0) * (Number(j.quantity) || 0);
                                return (
                                  <li key={ji} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                                    <span className="font-medium text-gray-900">{j.jobName || `Job ${ji + 1}`}</span>
                                    <span className="text-gray-600">
                                      Qty <span className="tabular-nums font-medium text-gray-800">{j.quantity}</span>
                                      {item.jobs!.length > 1 ? (
                                        <span className="ml-2 tabular-nums font-medium text-gray-900">${lineAmt.toFixed(2)}</span>
                                      ) : null}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : item.jobName ? (
                          <p className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                            <span className="font-medium text-gray-800">Job:</span> {item.jobName}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4">
                        {Array.isArray(item.jobs) && item.jobs.length > 1 ? null : (
                          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums text-gray-900">{item.quantity || 1}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                              className="flex h-9 w-9 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm text-gray-500">Subtotal</span>
                          <span className="text-base font-semibold tabular-nums text-gray-900">${cartItemLineSubtotal(item).toFixed(2)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <FiTrash2 className="h-4 w-4 shrink-0" aria-hidden />
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col justify-center gap-3 border-t border-gray-200 pt-4 text-sm lg:w-52 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      {item.shippingService && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Shipping</p>
                          <p className="mt-1 text-gray-800">
                            <span className="font-medium">{item.shippingService}</span>
                            <span className="ml-1 font-semibold tabular-nums text-gray-900">${shipLine.toFixed(2)}</span>
                          </p>
                        </div>
                      )}
                      <div className="border-t border-gray-200 pt-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Line total</p>
                        <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">${(item.total || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Bottom: order summary — typography matches cart line cards above */}
              <div className="flex justify-end">
                <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900">Order summary</h2>
                  <div className="mb-4 space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-medium tabular-nums text-gray-900">${subtotalSum.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span className="font-medium tabular-nums text-gray-900">${shippingSum.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mb-4 border-t border-gray-300 pt-3">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        Total ({cartItems.length} {cartItems.length === 1 ? "line" : "lines"})
                      </span>
                      <span className="text-lg font-bold tabular-nums text-gray-900">${calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push("/checkout")}
                    className="w-full rounded-lg bg-blue-500 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    Checkout
                  </button>
                  <Link
                    href="/products"
                    className="mt-4 block text-center text-sm font-medium text-blue-600 hover:text-blue-800"
                  >
                    Continue shopping
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


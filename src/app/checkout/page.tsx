"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { loadStripe, type Stripe, type StripeElements, type StripePaymentElement } from "@stripe/stripe-js";
import {
  ordersAPI,
  cartAPI,
  addressesAPI,
  authAPI,
  shippingRatesAPI,
  effectiveOrderShipping,
  orderQualifiesForFreeShipping,
  stackedShippingFromCartItems,
  mergedShippingFromCartItems,
  type ShippingMethod,
  type ShippingRates,
  type FreeShippingPolicy,
  type CartSummary,
} from "../../utils/api";
import { isAuthenticated } from "../../utils/roles";

interface Address {
  id: number;
  street_address: string;
  address_line2: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  is_default: boolean;
  address_type: string;
}

function normalizeAddress(raw: Record<string, unknown>): Address {
  return {
    id: Number(raw.id),
    street_address: String(raw.street_address ?? raw.streetAddress ?? ""),
    address_line2: raw.address_line2 != null || raw.addressLine2 != null ? String(raw.address_line2 ?? raw.addressLine2) : null,
    city: String(raw.city ?? ""),
    state: String(raw.state ?? ""),
    postcode: String(raw.postcode ?? ""),
    country: String(raw.country ?? "United States"),
    is_default: Boolean(raw.is_default ?? raw.isDefault),
    address_type: String(raw.address_type ?? raw.addressType ?? "billing"),
  };
}

interface CartItem {
  id: string;
  productId?: string;
  productName?: string;
  product_name?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  subtotal?: number;
  shippingService?: string;
  shippingMode?: string;
  storePickupAddressId?: number;
  product_id?: string;
  jobName?: string;
  job_name?: string;
  width?: number;
  height?: number;
  print_size_label?: string;
  selection_mode?: string;
  selectionMode?: string;
  graphic_scenario_enabled?: boolean;
  graphicScenarioEnabled?: boolean;
  pricing_snapshot?: {
    selection_mode?: string;
    selectionMode?: string;
    graphic_scenario_enabled?: boolean;
    graphicScenarioEnabled?: boolean;
  };
  jobs?: Array<{ jobName?: string; quantity?: number; unitPrice?: number; lineSubtotal?: number }>;
  [key: string]: unknown;
}

function checkoutItemLineSubtotal(item: CartItem): number {
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

function isGraphicScenarioCheckoutItem(item: CartItem): boolean {
  const selectionMode = String(
    item.selection_mode ??
      item.selectionMode ??
      item.pricing_snapshot?.selection_mode ??
      item.pricing_snapshot?.selectionMode ??
      ""
  ).trim();
  if (selectionMode === "graphic_only" || selectionMode === "graphic_frame") {
    return true;
  }
  return (
    item.graphic_scenario_enabled === true ||
    item.graphicScenarioEnabled === true ||
    item.pricing_snapshot?.graphic_scenario_enabled === true ||
    item.pricing_snapshot?.graphicScenarioEnabled === true
  );
}

interface StripeElementsRef {
  elements: StripeElements;
  paymentElement: StripePaymentElement;
}

async function fetchCartItemsFromApi(): Promise<CartItem[]> {
  try {
    const res = await cartAPI.get();
    return Array.isArray(res?.cartItems) ? (res.cartItems as CartItem[]) : [];
  } catch {
    return [];
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderSummary, setOrderSummary] = useState<CartSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [guestTrackingToken, setGuestTrackingToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paymentElementRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<StripeElementsRef | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [profile, setProfile] = useState<{ fullName?: string; telephone?: string } | null>(null);
  const [showAddBilling, setShowAddBilling] = useState(false);
  const [billingForm, setBillingForm] = useState({
    streetAddress: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    country: "United States",
  });
  const [guestEmail, setGuestEmail] = useState("");
  const [guestFullName, setGuestFullName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  const [shippingRates, setShippingRates] = useState<ShippingRates | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [freeShippingPolicy, setFreeShippingPolicy] = useState<FreeShippingPolicy>({
    freeShippingEnabled: false,
    freeShippingThreshold: 0,
  });
  const loadCartFromApi = useCallback(async () => {
    setCartItems(await fetchCartItemsFromApi());
    try {
      const summary = await cartAPI.getSummary();
      setOrderSummary(summary);
    } catch {
      setOrderSummary(null);
    }
  }, []);

  const globalDefault = addresses.find((a) => a.is_default) ?? null;
  const billingAddress =
    globalDefault?.address_type === "billing"
      ? globalDefault
      : addresses.find((a) => a.address_type === "billing") ?? globalDefault ?? null;
  const shippingAddress =
    globalDefault?.address_type === "shipping"
      ? globalDefault
      : addresses.find((a) => a.address_type === "shipping") ?? globalDefault ?? billingAddress;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const items = await fetchCartItemsFromApi();
      if (!cancelled) {
        setCartItems(items);
        try {
          const summary = await cartAPI.getSummary();
          if (!cancelled) setOrderSummary(summary);
        } catch {
          if (!cancelled) setOrderSummary(null);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onCartUpdated = () => {
      void loadCartFromApi();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadCartFromApi();
    };
    const onPageShow = (e: Event) => {
      if ("persisted" in e && (e as PageTransitionEvent).persisted) void loadCartFromApi();
    };
    window.addEventListener("cartUpdated", onCartUpdated);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("cartUpdated", onCartUpdated);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [loadCartFromApi]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await shippingRatesAPI.get();
        if (!c && res?.rates) setShippingRates(res.rates);
        if (!c) {
          setShippingMethods(Array.isArray(res?.methods) ? res.methods : []);
          setFreeShippingPolicy({
            freeShippingEnabled: !!res?.freeShippingEnabled,
            freeShippingThreshold: Math.max(0, Number(res?.freeShippingThreshold) || 0),
          });
        }
      } catch {
        /* defaults used */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) return;
    let cancelled = false;
    setAddressLoading(true);
    (async () => {
      try {
        const [addrRes, profileRes] = await Promise.all([
          addressesAPI.getAll() as Promise<{ addresses?: unknown[] }>,
          authAPI.getProfile().catch(() => null),
        ]);
        if (cancelled) return;
        const rawList = Array.isArray(addrRes?.addresses) ? addrRes.addresses : [];
        setAddresses(rawList.map((item) => normalizeAddress((item as Record<string, unknown>) || {})));
        if (profileRes && typeof profileRes === "object" && profileRes !== null) {
          const p = profileRes as { fullName?: string; full_name?: string; telephone?: string };
          setProfile({ fullName: p.fullName ?? p.full_name, telephone: p.telephone });
        }
      } catch {
        if (!cancelled) setAddresses([]);
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleBillingFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setBillingForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddBillingAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingForm.streetAddress.trim() || !billingForm.city.trim() || !billingForm.state.trim() || !billingForm.postcode.trim()) return;
    setSavingAddress(true);
    try {
      const res = await addressesAPI.create({
        streetAddress: billingForm.streetAddress.trim(),
        addressLine2: billingForm.addressLine2.trim() || undefined,
        city: billingForm.city.trim(),
        state: billingForm.state.trim(),
        postcode: billingForm.postcode.trim(),
        country: billingForm.country || "United States",
        addressType: "billing",
        isDefault: true,
      }) as { address?: Record<string, unknown> };
      if (res?.address) {
        setAddresses((prev) => [normalizeAddress(res.address!), ...prev]);
        setShowAddBilling(false);
        setBillingForm({ streetAddress: "", addressLine2: "", city: "", state: "", postcode: "", country: "United States" });
      }
    } finally {
      setSavingAddress(false);
    }
  };

  const STATES = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

  // Mount Stripe Payment Element when clientSecret is set (use single Stripe instance for elements + confirmPayment)
  useEffect(() => {
    if (!clientSecret || !paymentElementRef.current || !stripePublishableKey) return;
    let mounted = true;
    (async () => {
      try {
        const stripe = await loadStripe(stripePublishableKey);
        if (!stripe || !mounted || !paymentElementRef.current) return;
        stripeRef.current = stripe;
        const elements = stripe.elements({ clientSecret, appearance: { theme: "stripe" } });
        const paymentElement = elements.create("payment");
        paymentElement.mount(paymentElementRef.current);
        elementsRef.current = { elements, paymentElement };
      } catch (e) {
        console.error("Stripe mount error:", e);
        setError("Failed to load payment form");
      }
    })();
    return () => {
      mounted = false;
      stripeRef.current = null;
      if (elementsRef.current) {
        try {
          elementsRef.current.paymentElement.unmount();
        } catch {}
        elementsRef.current = null;
      }
    };
  }, [clientSecret, stripePublishableKey]);

  const subtotal = cartItems.reduce((sum, i) => sum + checkoutItemLineSubtotal(i), 0);
  const shippingMode =
    cartItems.length > 0 && cartItems.every((i) => String(i.shippingMode || "").toLowerCase() === "store_pickup")
      ? "store_pickup"
      : "blind_drop_ship";
  const storePickupOrder = shippingMode === "store_pickup";
  const stackedShipping = stackedShippingFromCartItems(
    cartItems,
    shippingMethods,
    shippingRates,
    storePickupOrder
  );
  const mergedShipping = mergedShippingFromCartItems(
    cartItems,
    shippingMethods,
    shippingRates,
    storePickupOrder
  );
  const shipping = effectiveOrderShipping(mergedShipping, subtotal, freeShippingPolicy, storePickupOrder);
  const showFreeShippingLabel =
    !storePickupOrder && orderQualifiesForFreeShipping(subtotal, freeShippingPolicy, false);
  const showMergedShippingDiscount =
    !storePickupOrder &&
    !showFreeShippingLabel &&
    stackedShipping > mergedShipping + 0.005;
  const total = subtotal + shipping;
  const shownSubtotal = orderSummary?.subtotal ?? subtotal;
  const shownShipping = orderSummary?.shipping ?? shipping;
  const shownTax = orderSummary?.taxAmount ?? 0;
  const shownTaxPercentage = orderSummary?.taxPercentage ?? 0;
  const shownTotal = orderSummary?.total ?? total;

  const loggedInCheckout = isAuthenticated();
  const guestEmailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const guestAddressOk =
    !!billingForm.streetAddress.trim() &&
    !!billingForm.city.trim() &&
    !!billingForm.state.trim() &&
    !!billingForm.postcode.trim();
  const guestCheckoutReady = guestEmailOk && guestAddressOk;
  const canProceedToPayment = loggedInCheckout ? !!billingAddress : guestCheckoutReady;

  const handlePlaceOrder = async () => {
    if (!canProceedToPayment) return;
    setCreating(true);
    setError(null);
    try {
      const items = cartItems as unknown as Record<string, unknown>[];
      const shipAddrId = shippingAddress?.id ?? billingAddress?.id;
      const billAddrId = billingAddress?.id ?? shippingAddress?.id;
      const res = loggedInCheckout
        ? await ordersAPI.createPaymentIntent(
            items,
            undefined,
            shipAddrId != null && billAddrId != null
              ? { shippingAddressId: Number(shipAddrId), billingAddressId: Number(billAddrId) }
              : undefined
          )
        : await ordersAPI.createPaymentIntent(items, {
            email: guestEmail.trim(),
            fullName: guestFullName.trim() || undefined,
            phone: guestPhone.trim() || undefined,
            shippingAddress: {
              streetAddress: billingForm.streetAddress.trim(),
              addressLine2: billingForm.addressLine2.trim() || undefined,
              city: billingForm.city.trim(),
              state: billingForm.state.trim(),
              postcode: billingForm.postcode.trim(),
              country: billingForm.country || "United States",
            },
          }) as {
            orderId: number;
            orderNumber?: string;
            clientSecret: string | null;
            stripePaymentSkipped?: boolean;
            guestTrackingToken?: string;
          };
      const guestToken = !loggedInCheckout ? String(res.guestTrackingToken || "").trim() : "";
      if (!loggedInCheckout && guestToken) setGuestTrackingToken(guestToken);
      if (res.stripePaymentSkipped) {
        try {
          await cartAPI.clear();
        } catch {}
        localStorage.removeItem("cart");
        window.dispatchEvent(new Event("cartUpdated"));
        if (!loggedInCheckout && guestToken) {
          router.push(
            `/upload?placed=1&order=${res.orderId}&guestToken=${encodeURIComponent(guestToken)}`
          );
        } else {
          router.push(`/upload?placed=1&order=${res.orderId}`);
        }
        return;
      }
      if (!res.clientSecret) {
        setError("No payment session returned from server.");
        return;
      }
      if (!stripePublishableKey) {
        setError("Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in your .env (and STRIPE_SECRET_KEY on the backend).");
        return;
      }
      setClientSecret(res.clientSecret);
      setOrderId(res.orderId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create payment");
    } finally {
      setCreating(false);
    }
  };

  const cancelPayment = () => {
    setClientSecret(null);
    setOrderId(null);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSecret || orderId == null) return;
    const stripe = stripeRef.current;
    if (!stripe || !elementsRef.current) {
      setError("Payment form not ready");
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const { error: err } = await stripe.confirmPayment({
        elements: elementsRef.current.elements,
        confirmParams: {
          return_url:
            !loggedInCheckout && guestTrackingToken
              ? `${typeof window !== "undefined" ? window.location.origin : ""}/upload?placed=1&order=${orderId}&guestToken=${encodeURIComponent(guestTrackingToken)}`
              : `${typeof window !== "undefined" ? window.location.origin : ""}/upload?placed=1&order=${orderId}`,
        },
      });
      if (err) setError(err.message || "Payment failed");
      else {
        try {
          await cartAPI.clear();
        } catch {}
        localStorage.removeItem("cart");
        window.dispatchEvent(new Event("cartUpdated"));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 pt-24 pb-16 flex items-center justify-center">
          <p className="text-gray-600">Loading...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (cartItems.length === 0 && !clientSecret) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 pt-24 pb-16 flex flex-col items-center justify-center gap-4">
          <p className="text-gray-600">Your cart is empty.</p>
          <Link href="/cart" className="text-blue-600 hover:underline">Back to Cart</Link>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-center gap-2 sm:gap-4">
            <div className="flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white text-sm">✓</span>
              <span className="ml-2 text-sm font-medium text-gray-700">Shopping Cart</span>
            </div>
            <div className="flex-1 h-0.5 max-w-[80px] sm:max-w-[120px] bg-blue-400" />
            <div className="flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-sm font-medium">2</span>
              <span className="ml-2 text-sm font-medium text-blue-600">Checkout</span>
            </div>
            <div className="flex-1 h-0.5 max-w-[80px] sm:max-w-[120px] bg-gray-200" />
            <div className="flex items-center">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-300 text-gray-500 text-sm font-medium">3</span>
              <span className="ml-2 text-sm font-medium text-gray-400">Upload</span>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Checkout</h1>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Payment method</h2>
                <div
                  className="flex items-start gap-3 rounded-lg border-2 border-blue-500 bg-blue-50/80 p-3"
                  role="status"
                  aria-label="Payment method"
                >
                  <input type="radio" name="payment" checked disabled className="mt-1" aria-checked="true" />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Pay with card</span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-gray-900">Billing Address</h2>
                    {isAuthenticated() && billingAddress && (
                      <Link
                        href="/address-book"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 hover:text-gray-900"
                        aria-label="Change billing address"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Change
                      </Link>
                    )}
                  </div>
                  {addressLoading ? (
                    <p className="text-gray-500 text-sm">Loading addresses...</p>
                  ) : !isAuthenticated() ? (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                      <p className="text-sm text-gray-600">Checkout as guest — enter email, phone (optional), and shipping address.</p>
                      <input
                        type="email"
                        placeholder="Email *"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        autoComplete="email"
                      />
                      <input
                        type="text"
                        placeholder="Full name (optional)"
                        value={guestFullName}
                        onChange={(e) => setGuestFullName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        autoComplete="name"
                      />
                      <input
                        type="tel"
                        placeholder="Phone (optional)"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        autoComplete="tel"
                      />
                      <input
                        type="text"
                        placeholder="Street address *"
                        value={billingForm.streetAddress}
                        onChange={(e) => setBillingForm((p) => ({ ...p, streetAddress: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        autoComplete="street-address"
                      />
                      <input
                        type="text"
                        placeholder="Apartment, suite, etc. (optional)"
                        value={billingForm.addressLine2}
                        onChange={(e) => setBillingForm((p) => ({ ...p, addressLine2: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="City *"
                          value={billingForm.city}
                          onChange={(e) => setBillingForm((p) => ({ ...p, city: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          autoComplete="address-level2"
                        />
                        <select
                          value={billingForm.state}
                          onChange={(e) => setBillingForm((p) => ({ ...p, state: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          autoComplete="address-level1"
                        >
                          <option value="">State *</option>
                          {STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        placeholder="ZIP / Postcode *"
                        value={billingForm.postcode}
                        onChange={(e) => setBillingForm((p) => ({ ...p, postcode: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        autoComplete="postal-code"
                      />
                      <input
                        type="text"
                        placeholder="Country"
                        value={billingForm.country}
                        onChange={(e) => setBillingForm((p) => ({ ...p, country: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        autoComplete="country-name"
                      />
                    </div>
                  ) : billingAddress && !showAddBilling ? (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 text-sm space-y-1">
                      {profile?.fullName && <p className="font-medium">{profile.fullName}</p>}
                      <p>{billingAddress.street_address}</p>
                      {billingAddress.address_line2 && <p>{billingAddress.address_line2}</p>}
                      <p>{billingAddress.city}, {billingAddress.state} {billingAddress.postcode}</p>
                      <p>{billingAddress.country}</p>
                      {profile?.telephone && <p>Tel: {profile.telephone}</p>}
                    </div>
                  ) : showAddBilling ? (
                    <form onSubmit={handleAddBillingAddress} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
                      <input type="text" name="streetAddress" placeholder="Street address *" value={billingForm.streetAddress} onChange={handleBillingFormChange} className="w-full px-3 py-2 text-gray-500 border border-gray-400 rounded-md text-sm" required />
                      <input type="text" name="addressLine2" placeholder="Apartment, suite, etc. (optional)" value={billingForm.addressLine2} onChange={handleBillingFormChange} className="w-full px-3 py-2 text-gray-500 border border-gray-400 rounded-md text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" name="city" placeholder="City *" value={billingForm.city} onChange={handleBillingFormChange} className="w-full px-3 py-2 text-gray-500 border border-gray-400 rounded-md text-sm" required />
                        <select name="state" value={billingForm.state} onChange={handleBillingFormChange} className="w-full px-3 py-2 text-gray-500 border border-gray-400 rounded-md text-sm" required>
                          <option value="">State</option>
                          {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <input type="text" name="postcode" placeholder="Postcode *" value={billingForm.postcode} onChange={handleBillingFormChange} className="w-full px-3 py-2 text-gray-500 border border-gray-400 rounded-md text-sm" required />
                      <input type="text" name="country" placeholder="Country" value={billingForm.country} onChange={handleBillingFormChange} className="w-full px-3 py-2 text-gray-500 border border-gray-400 rounded-md text-sm" />
                      <div className="flex gap-2">
                        <button type="submit" disabled={savingAddress} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-70">Save address</button>
                        <button type="button" onClick={() => setShowAddBilling(false)} className="px-4 py-2 border border-gray-400 text-gray-800 rounded-md text-sm hover:bg-gray-200">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-gray-600 text-sm mb-2">No billing address saved. Add one to continue.</p>
                      <button type="button" onClick={() => setShowAddBilling(true)} className="text-sm text-blue-500 hover:underline">Add billing address</button>
                    </div>
                  )}
                </div>
                {shippingMode !== "store_pickup" && (
                  <div>
                    <h2 className="text-lg font-bold text-gray-700 mb-3">Shipping Address</h2>
                    {addressLoading ? (
                      <p className="text-gray-500 text-sm">Loading...</p>
                    ) : !isAuthenticated() ? (
                      <p className="text-gray-500 text-sm">We ship to the address you entered under Billing.</p>
                    ) : shippingAddress ? (
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-gray-800 text-sm space-y-1">
                        {shippingAddress.id === billingAddress?.id && <p className="text-gray-500 italic mb-1">Same as billing</p>}
                        <p>{shippingAddress.street_address}</p>
                        {shippingAddress.address_line2 && <p>{shippingAddress.address_line2}</p>}
                        <p>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.postcode}</p>
                        <p>{shippingAddress.country}</p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">Same as billing (add a billing address above).</p>
                    )}
                    {isAuthenticated() && shippingAddress && (
                      <Link href="/address-book" className="text-sm text-gray-600 hover:text-gray-700 mt-1 inline-block">Change</Link>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
                <div className="mb-4 space-y-3 border-b border-gray-200 pb-4">
                  {cartItems.map((item, idx) => {
                    const name = item.productName ?? item.product_name ?? "Product";
                    const isGraphicScenario = isGraphicScenarioCheckoutItem(item);
                    const w = Number(item.width ?? 0);
                    const h = Number(item.height ?? 0);
                    const pl =
                      typeof item.print_size_label === "string" ? item.print_size_label.trim() : "";
                    const sizeLine =
                      pl || (w > 0 && h > 0) ? (pl || `${w}" × ${h}"`) : "—";
                    const lineSub = checkoutItemLineSubtotal(item);
                    return (
                      <div
                        key={String(item.id ?? idx)}
                        className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">{name}</p>
                          {!isGraphicScenario && (
                            <p className="text-sm text-gray-600">
                              Size: <span className="tabular-nums text-gray-800">{sizeLine}</span>
                            </p>
                          )}
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
                          ${lineSub.toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal:</span>
                    <span>${shownSubtotal.toFixed(2)}</span>
                  </div>
                  {shippingMode !== "store_pickup" && (
                    <div className="flex justify-between text-gray-700 items-baseline gap-2">
                      <span>Shipping:</span>
                      <span className="font-medium text-right">
                        {showFreeShippingLabel ? (
                          <span className="text-emerald-700">Free Shipping</span>
                        ) : showMergedShippingDiscount ? (
                          <>
                            <span className="text-gray-500 line-through">${stackedShipping.toFixed(2)}</span>
                            <span className="ml-2 text-emerald-600">${shownShipping.toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="text-gray-900">${shownShipping.toFixed(2)}</span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-700">
                    <span>Tax ({shownTaxPercentage.toFixed(2)}%):</span>
                    <span>${shownTax.toFixed(2)}</span>
                  </div>
                </div>
                <div className="border-t border-gray-300 pt-3 mb-4">
                  <div className="flex justify-between text-xl font-bold text-gray-700">
                    <span>Total:</span>
                    <span>${shownTotal.toFixed(2)}</span>
                  </div>
                </div>

                {clientSecret && orderId != null ? (
                  <form onSubmit={handlePaySubmit} className="space-y-4">
                    <div ref={paymentElementRef} className="min-h-[200px]" />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={processing}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                      >
                        {processing ? "Processing…" : `Pay $${shownTotal.toFixed(2)}`}
                      </button>
                      <button type="button" onClick={cancelPayment} className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {!canProceedToPayment && isAuthenticated() && (
                      <p className="text-amber-700 text-sm mb-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        Please add a billing address above before placing your order.
                      </p>
                    )}
                    {!canProceedToPayment && !isAuthenticated() && (
                      <p className="text-amber-700 text-sm mb-3 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        Enter a valid email and full shipping address to continue.
                      </p>
                    )}
                    {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                    <button
                      type="button"
                      onClick={handlePlaceOrder}
                      disabled={creating || !canProceedToPayment}
                      className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                      {creating ? "Creating order…" : "Place Your Order"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

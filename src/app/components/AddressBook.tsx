"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addressesAPI } from "../../utils/api";
import { toast } from "react-toastify";

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
  updated_at?: string | null;
}

function parseAddressBool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    return s === "true" || s === "1" || s === "t";
  }
  return false;
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
    is_default: parseAddressBool(raw.is_default ?? raw.isDefault),
    address_type: String(raw.address_type ?? raw.addressType ?? "billing"),
    updated_at:
      raw.updated_at != null
        ? String(raw.updated_at)
        : raw.updatedAt != null
          ? String(raw.updatedAt)
          : null,
  };
}

/** If API still returns multiple defaults, show the most recently updated one (matches set-default / sort order). */
function ensureSingleDefaultForDisplay(addresses: Address[]): Address[] {
  const defaultRows = addresses.filter((a) => a.is_default);
  if (defaultRows.length <= 1) return addresses;
  const ts = (a: Address) => {
    const t = a.updated_at ? Date.parse(a.updated_at) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  const keep = defaultRows.reduce((best, a) => {
    const bt = ts(best);
    const at = ts(a);
    if (at > bt) return a;
    if (at < bt) return best;
    return a.id > best.id ? a : best;
  });
  return addresses.map((a) => ({ ...a, is_default: a.id === keep.id }));
}

const defaultForm = {
  streetAddress: "",
  addressLine2: "",
  city: "",
  state: "",
  postcode: "",
  country: "United States",
  addressType: "billing" as "billing" | "shipping",
  isDefault: false,
};

export default function AddressBook() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkDone = useRef(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState(defaultForm);

  const fetchAddressList = useCallback(
    async (options?: { showFullPageSpinner?: boolean }) => {
      const showSpinner = options?.showFullPageSpinner !== false;
      try {
        if (showSpinner) setLoading(true);
        const res = (await addressesAPI.getAll()) as { addresses?: unknown[] } | unknown[];
        const rawList = Array.isArray((res as { addresses?: unknown[] }).addresses)
          ? (res as { addresses: unknown[] }).addresses
          : Array.isArray(res)
            ? (res as unknown[])
            : [];
        const list = ensureSingleDefaultForDisplay(
          rawList.map((item) => normalizeAddress((item as Record<string, unknown>) || {}))
        );
        setAddresses(list);
      } catch (err: any) {
        if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("token")) {
          router.push("/login");
          return;
        }
        toast.error(err?.message || "Failed to load addresses");
        setAddresses([]);
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    fetchAddressList({ showFullPageSpinner: true });
  }, [router, fetchAddressList]);

  /** Deep links from product page: ?edit=123 or ?add=1 */
  useEffect(() => {
    if (loading) return;
    const editParam = searchParams.get("edit");
    const addParam = searchParams.get("add");
    if (!editParam && addParam !== "1" && addParam !== "true") {
      deepLinkDone.current = false;
      return;
    }
    if (deepLinkDone.current) return;
    if (addParam === "1" || addParam === "true") {
      deepLinkDone.current = true;
      setEditingId(null);
      setFormData(defaultForm);
      requestAnimationFrame(() => {
        document.getElementById("address-book-add-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }
    const id = parseInt(editParam || "", 10);
    if (!isNaN(id)) {
      const addr = addresses.find((a) => a.id === id);
      if (addr) {
        deepLinkDone.current = true;
        setEditingId(addr.id);
        setFormData({
          streetAddress: addr.street_address,
          addressLine2: addr.address_line2 || "",
          city: addr.city,
          state: addr.state,
          postcode: addr.postcode,
          country: addr.country || "United States",
          addressType: (addr.address_type === "shipping" ? "shipping" : "billing") as "billing" | "shipping",
          isDefault: !!addr.is_default,
        });
        requestAnimationFrame(() => {
          document.getElementById("address-book-add-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else if (addresses.length > 0) {
        deepLinkDone.current = true;
      }
    }
  }, [loading, addresses, searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const fillFormForEdit = (addr: Address) => {
    setEditingId(addr.id);
    setFormData({
      streetAddress: addr.street_address,
      addressLine2: addr.address_line2 || "",
      city: addr.city,
      state: addr.state,
      postcode: addr.postcode,
      country: addr.country || "United States",
      addressType: (addr.address_type === "shipping" ? "shipping" : "billing") as "billing" | "shipping",
      isDefault: !!addr.is_default,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData(defaultForm);
  };

  const handleSetDefault = async (addr: Address) => {
    if (addr.is_default) return;
    try {
      await addressesAPI.setDefault(String(addr.id), {
        streetAddress: addr.street_address,
        addressLine2: addr.address_line2 || undefined,
        city: addr.city,
        state: addr.state,
        postcode: addr.postcode,
        country: addr.country,
        addressType: addr.address_type,
      });
      await fetchAddressList({ showFullPageSpinner: false });
      toast.success("Default address updated.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to set default.");
    }
  };


  const handleDelete = async (id: number) => {
    if (!window.confirm("Remove this address?")) return;
    try {
      await addressesAPI.delete(String(id));
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      if (editingId === id) cancelEdit();
      toast.success("Address removed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete address.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    if (!formData.streetAddress.trim() || !formData.city.trim() || !formData.state.trim() || !formData.postcode.trim()) {
      toast.error("Street, city, state and postcode are required.");
      return;
    }

    const payload = {
      streetAddress: formData.streetAddress.trim(),
      addressLine2: formData.addressLine2.trim() || undefined,
      city: formData.city.trim(),
      state: formData.state.trim(),
      postcode: formData.postcode.trim(),
      country: formData.country || "United States",
      addressType: formData.addressType,
      isDefault: formData.isDefault,
    };

    if (editingId) {
      try {
        setSaving(true);
        await addressesAPI.update(String(editingId), payload);
        await fetchAddressList({ showFullPageSpinner: false });
        toast.success("Address updated.");
        cancelEdit();
      } catch (err: any) {
        toast.error(err?.message || "Failed to update address.");
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      await addressesAPI.create(payload);
      await fetchAddressList({ showFullPageSpinner: false });
      toast.success("Address added.");
      setFormData(defaultForm);
    } catch (err: any) {
      toast.error(err?.message || "Failed to add address.");
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { label: "Account Settings", href: "/account-settings" },
    { label: "Change Password", href: "/change-password" },
    { label: "Reseller Permit", href: "/reseller-permit" },
    { label: "Credit Cards", href: "/credit-cards" },
    { label: "Your Default Address", href: "/address-book", active: true },
  ];

  const states = ["Select State", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-20 flex items-center justify-center">
        <p className="text-gray-600">Loading addresses...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          <aside className="w-64 shrink-0 bg-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>
            <nav className="space-y-0">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block w-full text-left px-4 py-3 transition-colors border-b border-gray-200 last:border-b-0 ${
                    item.active ? "bg-blue-100 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          <main className="flex-1 bg-white p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Your Default Address</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your address from registration is shown below. You can update it anytime—click Edit, change the details, and save.
            </p>

            {addresses.length === 0 && !loading && (
              <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-800 font-medium">No saved address yet.</p>
                <p className="text-amber-700 text-sm mt-1">
                  If you added an address at registration, it should appear here when you’re logged in. You can also add one below.
                </p>
              </div>
            )}

            {addresses.length > 0 && (
              <div className="space-y-4 mb-8">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="bg-white border border-gray-300 rounded-lg p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr)}
                        disabled={addr.is_default}
                        className={`inline-flex w-32 shrink-0 justify-center items-center px-2 py-2 rounded text-sm font-medium transition-colors ${
                          addr.is_default
                            ? "bg-gray-300 text-gray-700 cursor-default"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {addr.is_default ? "Default" : "Set Default"}
                      </button>
                      <div className="flex-1 text-sm text-gray-700">
                        <div className="font-medium text-gray-900 capitalize">{addr.address_type}</div>
                        <div>{addr.street_address}</div>
                        {addr.address_line2 && <div>{addr.address_line2}</div>}
                        <div>{addr.city}, {addr.state} {addr.postcode}</div>
                        <div>{addr.country}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fillFormForEdit(addr)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(addr.id)}
                      className="text-gray-500 hover:text-red-600 p-2"
                      aria-label="Delete address"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h2 id="address-book-add-form" className="text-xl font-bold text-gray-900 mb-4 scroll-mt-24">
              {editingId ? "Update address" : "Add new address"}
            </h2>
            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Street address *</label>
                  <input
                    type="text"
                    name="streetAddress"
                    value={formData.streetAddress}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address line 2</label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {states.map((s) => (
                        <option key={s} value={s === "Select State" ? "" : s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
                    <input
                      type="text"
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address type</label>
                  <select
                    name="addressType"
                    value={formData.addressType}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="billing">Billing</option>
                    <option value="shipping">Shipping</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDefaultAddr"
                    name="isDefault"
                    checked={formData.isDefault}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                  <label htmlFor="isDefaultAddr" className="text-sm font-medium text-gray-700">
                    Use as my default address (only one; shown on product page and checkout)
                  </label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-8 py-3 rounded-lg transition-colors"
                  >
                    {saving ? "Saving…" : editingId ? "Update" : "Add"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { addressesAPI } from "../../utils/api";
import { toast } from "react-toastify";
import { FiEdit, FiTrash2 } from "react-icons/fi";

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
    { label: "Credit Cards", href: "/credit-cards" },
    { label: "Your Default Address", href: "/address-book", active: true },
  ];

  const states = ["Select State", "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20 flex items-center justify-center">
        <div className="rounded-sm border border-gray-200 bg-white px-6 py-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-medium text-gray-600">Loading addresses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 rounded-sm border border-gray-200 bg-white/80 px-5 py-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Area</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Address Book</h1>
          <p className="mt-1.5 text-sm text-gray-600">Manage your billing and shipping addresses.</p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <aside className="h-fit w-full shrink-0 self-start rounded-sm border border-gray-200 bg-white p-4 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] lg:w-72 lg:p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Settings</h2>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group block w-full border-l-2 px-3 py-2.5 text-sm transition-all ${
                    item.active
                      ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-800 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.5)]"
                      : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="text-[10px] text-gray-300 transition-colors group-hover:text-gray-400">&gt;</span>
                  </span>
                </Link>
              ))}
            </nav>
          </aside>

          <main className="flex-1 rounded-sm border border-gray-200 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)] sm:p-7">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Your Default Address</h2>
            <p className="mb-6 mt-1 text-sm text-gray-600">
              Your address from registration is shown below. You can update it anytime—click Edit, change the details, and save.
            </p>

            {addresses.length === 0 && !loading && (
              <div className="mb-8 rounded-sm border border-amber-200 bg-amber-50 px-6 py-5">
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
                    className="flex items-center justify-between rounded-sm border border-gray-200 bg-white p-5 shadow-[0_8px_26px_-24px_rgba(15,23,42,0.5)]"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(addr)}
                        disabled={addr.is_default}
                        className={`inline-flex w-32 shrink-0 items-center justify-center rounded-sm px-2 py-2 text-sm font-medium transition-colors ${
                          addr.is_default
                            ? "cursor-default bg-gray-200 text-gray-700"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {addr.is_default ? "Default" : "Set Default"}
                      </button>
                      <div className="min-w-0 flex-1 text-sm text-gray-700">
                        <div className="font-medium text-gray-900 capitalize">{addr.address_type}</div>
                        <div>{addr.street_address}</div>
                        {addr.address_line2 && <div>{addr.address_line2}</div>}
                        <div>{addr.city}, {addr.state} {addr.postcode}</div>
                        <div>{addr.country}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fillFormForEdit(addr)}
                        className="font-medium text-sky-600 hover:text-sky-800"
                        title="Edit"
                        aria-label="Edit address"
                      >
                        <FiEdit size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(addr.id)}
                        className="font-medium text-rose-600 hover:text-rose-800"
                        title="Delete"
                        aria-label="Delete address"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h3 id="address-book-add-form" className="mb-4 scroll-mt-24 text-lg font-semibold text-gray-900">
              {editingId ? "Update address" : "Add new address"}
            </h3>
            <div className="rounded-sm border border-gray-200 bg-white p-6 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.5)]">
              <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Street address *</label>
                  <input
                    type="text"
                    name="streetAddress"
                    value={formData.streetAddress}
                    onChange={handleChange}
                    className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Address line 2</label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">City *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">State *</label>
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
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
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Postcode *</label>
                    <input
                      type="text"
                      name="postcode"
                      value={formData.postcode}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Address type</label>
                  <select
                    name="addressType"
                    value={formData.addressType}
                    onChange={handleChange}
                    className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  >
                    <option value="billing">Billing</option>
                    <option value="shipping">Shipping</option>
                  </select>
                </div>
                <div className="rounded-sm border border-gray-200 bg-gray-50/80 px-3 py-3">
                  <label htmlFor="isDefaultAddr" className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      id="isDefaultAddr"
                      name="isDefault"
                      checked={formData.isDefault}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Use as my default address (only one; shown on product page and checkout)
                    </span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-w-28 items-center justify-center rounded-sm bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving…" : editingId ? "Update" : "Add"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className="rounded-sm border border-gray-400 text-gray-800 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-gray-200">
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

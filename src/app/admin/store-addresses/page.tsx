"use client";

import { useEffect, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { storeAddressesAPI, type StoreAddress } from "../../../utils/api";

type FormState = {
  label: string;
  company: string;
  contactName: string;
  phone: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  isDefault: boolean;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  label: "",
  company: "",
  contactName: "",
  phone: "",
  streetAddress: "",
  addressLine2: "",
  city: "",
  state: "",
  postcode: "",
  country: "United States",
  isDefault: false,
  isActive: true,
};

const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

function toForm(row: StoreAddress): FormState {
  return {
    label: row.label || "",
    company: row.company || "",
    contactName: row.contact_name || "",
    phone: row.phone || "",
    streetAddress: row.street_address || "",
    addressLine2: row.address_line2 || "",
    city: row.city || "",
    state: row.state || "",
    postcode: row.postcode || "",
    country: row.country || "United States",
    isDefault: !!row.is_default,
    isActive: row.is_active !== false,
  };
}

function fullAddress(row: StoreAddress): string {
  return [row.street_address, row.address_line2, row.city, row.state, row.postcode, row.country]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(", ");
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function AdminStoreAddressesPage() {
  const [rows, setRows] = useState<StoreAddress[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const pageSize = 4;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await storeAddressesAPI.getAdmin();
      const nextRows = Array.isArray(res?.addresses) ? res.addresses : [];
      setRows(nextRows);
      setPage((current) => Math.min(current, Math.max(1, Math.ceil(nextRows.length / pageSize))));
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load store addresses"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (row: StoreAddress) => {
    setEditingId(Number(row.id));
    setForm(toForm(row));
    setSuccess("");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    if (!form.label.trim() || !form.streetAddress.trim() || !form.city.trim() || !form.state.trim() || !form.postcode.trim()) {
      setError("Label, street address, city, state and ZIP are required.");
      setSaving(false);
      return;
    }
    const payload = {
      label: form.label.trim(),
      company: form.company.trim() || null,
      contactName: form.contactName.trim() || null,
      phone: form.phone.trim() || null,
      streetAddress: form.streetAddress.trim(),
      addressLine2: form.addressLine2.trim() || null,
      city: form.city.trim(),
      state: form.state.trim(),
      postcode: form.postcode.trim(),
      country: form.country.trim() || "United States",
      isDefault: form.isDefault,
      isActive: form.isActive,
    };

    try {
      if (editingId) {
        await storeAddressesAPI.updateAdmin(editingId, payload);
        setSuccess("Store address updated.");
      } else {
        await storeAddressesAPI.createAdmin(payload);
        setSuccess("Store address added.");
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save store address"));
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async (id: number) => {
    setError("");
    setSuccess("");
    try {
      await storeAddressesAPI.setDefaultAdmin(id);
      setSuccess("Default shipper address updated.");
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to set default address"));
    }
  };

  const archive = async (id: number) => {
    setError("");
    setSuccess("");
    try {
      await storeAddressesAPI.deleteAdmin(id);
      setSuccess("Store address archived.");
      if (editingId === id) resetForm();
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to archive store address"));
    }
  };

  return (
    <AdminNavbar title="Store Addresses" subtitle="Manage the default shipper origin used for FedEx rates and labels">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editingId ? "Edit Store Address" : "Add Store Address"}
          </h2>
          <form onSubmit={submit} className="space-y-3">
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Label, e.g. Dallas Warehouse" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Company" value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Contact name" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Street address" value={form.streetAddress} onChange={(e) => setForm((p) => ({ ...p, streetAddress: e.target.value }))} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Apartment, suite, unit" value={form.addressLine2} onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="City" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                autoComplete="address-level1"
              >
                <option value="">State</option>
                {US_STATE_CODES.map((stateCode) => (
                  <option key={stateCode} value={stateCode}>
                    {stateCode}
                  </option>
                ))}
              </select>
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="ZIP" value={form.postcode} onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value }))} />
            </div>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Country" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
            <div className="flex flex-wrap gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))} />
                Default shipper
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
                Active
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving..." : editingId ? "Update Address" : "Create Address"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
          {success ? <p className="mt-3 text-sm text-emerald-700">{success}</p> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Saved Store Addresses</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No store addresses yet.</p>
          ) : (
            <>
              <div className="space-y-3">
                {pageRows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-slate-200 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{row.label}</p>
                          {row.is_default ? <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Default</span> : null}
                          {row.is_active === false ? <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Archived</span> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{fullAddress(row)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[row.company, row.contact_name, row.phone].map((v) => String(v || "").trim()).filter(Boolean).join(" | ") || "No contact details"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {!row.is_default ? (
                          <button onClick={() => setDefault(row.id)} className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            Set Default
                          </button>
                        ) : null}
                        <button onClick={() => startEdit(row)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs">
                          Edit
                        </button>
                        <button onClick={() => archive(row.id)} className="rounded-md border border-rose-300 px-2.5 py-1 text-xs text-rose-700">
                          Archive
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {rows.length > pageSize ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">
                    Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, rows.length)} of {rows.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-medium text-slate-600">
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </AdminNavbar>
  );
}

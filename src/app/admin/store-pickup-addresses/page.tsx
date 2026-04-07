"use client";

import { useEffect, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { storePickupAddressesAPI, type StorePickupAddress } from "../../../utils/api";

type FormState = {
  label: string;
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  label: "",
  streetAddress: "",
  addressLine2: "",
  city: "",
  state: "",
  postcode: "",
  country: "United States",
  isActive: true,
};

export default function StorePickupAddressesPage() {
  const [rows, setRows] = useState<StorePickupAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StorePickupAddress | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await storePickupAddressesAPI.getAdmin();
      const allRows = Array.isArray(res?.addresses) ? res.addresses : [];
      setRows(allRows.filter((a) => a.is_active !== false));
    } catch (e: any) {
      setError(e?.message || "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (a: StorePickupAddress) => {
    setEditingId(Number(a.id));
    setForm({
      label: a.label || "",
      streetAddress: a.street_address || "",
      addressLine2: a.address_line2 || "",
      city: a.city || "",
      state: a.state || "",
      postcode: a.postcode || "",
      country: a.country || "United States",
      isActive: a.is_active !== false,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };
      if (editingId) {
        await storePickupAddressesAPI.updateAdmin(editingId, payload);
      } else {
        await storePickupAddressesAPI.createAdmin(payload);
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await storePickupAddressesAPI.deleteAdmin(id);
      setRows((prev) => prev.filter((r) => Number(r.id) !== Number(id)));
    } catch (e: any) {
      setError(e?.message || "Failed to delete address");
    }
  };

  return (
    <AdminNavbar title="Store Pickup Addresses" subtitle="Manage locations for pickup orders">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-24">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Store Address" : "Add Store Address"}
          </h2>
          <form onSubmit={submit} className="space-y-3">
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Label (e.g. CA Facility)" value={form.label} onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))} required />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Street address" value={form.streetAddress} onChange={(e) => setForm((p) => ({ ...p, streetAddress: e.target.value }))} required />
            <input className="w-full border rounded-lg px-3 py-2" placeholder="Address line 2 (optional)" value={form.addressLine2} onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full border rounded-lg px-3 py-2" placeholder="City" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="State" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Postcode" value={form.postcode} onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value }))} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Country" value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Active
            </label>
            <div className="flex gap-2">
              <button disabled={saving} className="px-4 py-2 rounded-lg bg-slate-900 text-white">
                {saving ? "Saving..." : editingId ? "Update Address" : "Create Address"}
              </button>
              {editingId ? (
                <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-slate-300">
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Saved Locations</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-500 text-sm">No store pickup addresses yet.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900">{r.label}</p>
                      <p className="text-xs text-slate-600 truncate">
                        {[
                          r.street_address,
                          r.address_line2 || "",
                          `${r.city}, ${r.state} ${r.postcode}`,
                          r.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="text-[11px] text-slate-500">{r.is_active === false ? "Inactive" : "Active"}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEdit(r)} className="px-2.5 py-1 rounded-md border border-slate-300 text-xs">Edit</button>
                      <button
                        onClick={() => setDeleteTarget(r)}
                        className="px-2.5 py-1 rounded-md border border-rose-300 text-rose-700 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Are you sure?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete <span className="font-medium">{deleteTarget.label}</span> from saved locations?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-2 rounded-md border border-slate-300 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await remove(Number(deleteTarget.id));
                  setDeleteTarget(null);
                }}
                className="px-3 py-2 rounded-md border border-rose-300 bg-rose-50 text-rose-700 text-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminNavbar>
  );
}

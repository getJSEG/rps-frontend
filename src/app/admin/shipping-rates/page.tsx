"use client";

import { useState, useEffect } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { shippingRatesAPI, type ShippingMethod } from "../../../utils/api";

type FormState = {
  name: string;
  price: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  price: "",
  isActive: true,
};

export default function AdminShippingRatesPage() {
  const [rows, setRows] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ShippingMethod | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await shippingRatesAPI.getAdminMethods();
      setRows(Array.isArray(res?.methods) ? res.methods : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load shipping methods");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (row: ShippingMethod) => {
    setEditingId(Number(row.id));
    setForm({
      name: row.name || "",
      price: String(Number(row.price) || 0),
      isActive: row.is_active !== false,
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
    const priceNum = parseFloat(form.price);
    if (!form.name.trim()) {
      setError("Name is required");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Price must be a non-negative number");
      setSaving(false);
      return;
    }
    try {
      const payload = { name: form.name.trim(), price: priceNum, isActive: form.isActive };
      if (editingId) {
        await shippingRatesAPI.updateAdminMethod(editingId, payload);
      } else {
        await shippingRatesAPI.createAdminMethod(payload);
      }
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save shipping method");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminNavbar title="Shipping Methods" subtitle="Manage shipping dropdown options and prices">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Shipping Method" : "Add Shipping Method"}
          </h2>
          <form onSubmit={submit} className="space-y-3">
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Name (e.g. 2-Day Air)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <div className="flex items-center gap-2">
              <span className="text-slate-500">$</span>
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="Price"
                type="number"
                min={0}
                step={0.01}
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                required
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex gap-2">
              <button disabled={saving} className="px-4 py-2 rounded-lg bg-slate-900 text-white">
                {saving ? "Saving..." : editingId ? "Update Method" : "Create Method"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-slate-300"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Saved Methods</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-500 text-sm">No shipping methods yet.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-600">${(Number(r.price) || 0).toFixed(2)}</p>
                      <p className="text-[11px] text-slate-500">{r.is_active === false ? "Inactive" : "Active"}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(r)}
                        className="px-2.5 py-1 rounded-md border border-slate-300 text-xs"
                      >
                        Edit
                      </button>
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
              Delete <span className="font-medium">{deleteTarget.name}</span> from shipping methods?
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
                  await shippingRatesAPI.deleteAdminMethod(deleteTarget.id);
                  setDeleteTarget(null);
                  await load();
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

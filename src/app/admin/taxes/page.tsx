"use client";

import { useEffect, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { taxesAPI, type Tax } from "../../../utils/api";

type FormState = {
  name: string;
  percentage: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  percentage: "",
  isActive: true,
};

export default function AdminTaxesPage() {
  const [rows, setRows] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Tax | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await taxesAPI.getAdmin();
      setRows(Array.isArray(res?.taxes) ? res.taxes : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load taxes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (row: Tax) => {
    setEditingId(Number(row.id));
    setForm({
      name: row.name || "",
      percentage: String(Number(row.percentage) || 0),
      isActive: row.is_active === true,
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
    const percentageNum = parseFloat(form.percentage);
    if (!form.name.trim()) {
      setError("Name is required");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(percentageNum) || percentageNum < 0) {
      setError("Percentage must be a non-negative number");
      setSaving(false);
      return;
    }
    try {
      const payload = { name: form.name.trim(), percentage: percentageNum, isActive: form.isActive };
      if (editingId) {
        await taxesAPI.updateAdmin(editingId, payload);
      } else {
        await taxesAPI.createAdmin(payload);
      }
      resetForm();
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save tax");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminNavbar title="Taxes" subtitle="Manage order-level tax rates">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Tax" : "Add Tax"}
          </h2>
          <form onSubmit={submit} className="space-y-3">
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Name (e.g. Sales Tax, VAT)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Percentage (%)</label>
              <input
                className="w-full border rounded-lg px-3 py-2"
                placeholder="8"
                type="number"
                min={0}
                step={0.01}
                value={form.percentage}
                onChange={(e) => setForm((p) => ({ ...p, percentage: e.target.value }))}
                required
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              />
              Active (deactivates all other taxes)
            </label>
            <div className="flex gap-2">
              <button disabled={saving} className="px-4 py-2 rounded-lg bg-slate-900 text-white">
                {saving ? "Saving..." : editingId ? "Update Tax" : "Create Tax"}
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
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Saved Taxes</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-500 text-sm">No taxes yet.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900">{r.name}</p>
                      <p className="text-xs text-slate-600">{(Number(r.percentage) || 0).toFixed(2)}%</p>
                      <p className="text-[11px] text-slate-500">{r.is_active ? "Active" : "Inactive"}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {!r.is_active && (
                        <button
                          onClick={async () => {
                            await taxesAPI.activateAdmin(r.id);
                            await load();
                          }}
                          className="px-2.5 py-1 rounded-md border border-emerald-300 text-emerald-700 text-xs"
                        >
                          Activate
                        </button>
                      )}
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
              Delete <span className="font-medium">{deleteTarget.name}</span>?
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
                  await taxesAPI.deleteAdmin(deleteTarget.id);
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

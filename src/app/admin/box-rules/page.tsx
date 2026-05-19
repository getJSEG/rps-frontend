"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { shippingBoxesAPI, type ShippingBox } from "../../../utils/api";

type FormState = {
  name: string;
  length: string;
  width: string;
  height: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  length: "",
  width: "",
  height: "",
  isActive: true,
};

const isFloatInput = (value: string) => value === "" || /^\d*\.?\d*$/.test(value);

export default function AdminBoxRulesPage() {
  const [boxes, setBoxes] = useState<ShippingBox[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25";

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shippingBoxesAPI.getAdmin();
      setBoxes(Array.isArray(res?.boxes) ? res.boxes : []);
    } catch (error) {
      showMsg("error", error instanceof Error ? error.message : "Failed to load shipping boxes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (box: ShippingBox) => {
    setEditingId(Number(box.id));
    setForm({
      name: box.name || "",
      length: String(Number(box.length) || ""),
      width: String(Number(box.width) || ""),
      height: String(Number(box.height) || ""),
      isActive: box.is_active !== false,
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const length = Number(form.length);
    const width = Number(form.width);
    const height = Number(form.height);
    if (!name) return showMsg("error", "Box name is required.");
    if (![length, width, height].every((n) => Number.isFinite(n) && n > 0)) {
      return showMsg("error", "Length, width, and height must be greater than zero.");
    }

    setSaving(true);
    try {
      const payload = { name, length, width, height, isActive: form.isActive };
      if (editingId) {
        await shippingBoxesAPI.updateAdmin(editingId, payload);
        showMsg("success", "Shipping box updated.");
      } else {
        await shippingBoxesAPI.createAdmin(payload);
        showMsg("success", "Shipping box added.");
      }
      resetForm();
      await load();
    } catch (error) {
      showMsg("error", error instanceof Error ? error.message : "Failed to save shipping box");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminNavbar title="Shipping Box Rules" subtitle="Manage physical boxes and tubes used for FedEx dimensions">
      {message ? (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editingId ? "Edit Shipping Box" : "Add Shipping Box Rule"}
          </h2>
          <div className="space-y-3">
            <input
              className={inputClass}
              placeholder="Box name, e.g. Banner Tube 50x4x4"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <div className="grid gap-3 md:grid-cols-3">
              {(["length", "width", "height"] as const).map((key) => (
                <input
                  key={key}
                  className={inputClass}
                  inputMode="decimal"
                  placeholder={`${key[0].toUpperCase()}${key.slice(1)} (inch)`}
                  value={form[key]}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (isFloatInput(value)) setForm((prev) => ({ ...prev, [key]: value }));
                  }}
                />
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              Active
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Update Box" : "Create Box"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Saved Box Rules</h2>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : boxes.length === 0 ? (
            <p className="text-sm text-slate-500">No boxes yet.</p>
          ) : (
            <div className="space-y-2">
              {boxes.map((box) => (
                <div key={box.id} className="rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{box.name}</p>
                      <p className="text-xs text-slate-600">
                        {box.length}&quot; x {box.width}&quot; x {box.height}&quot;
                      </p>
                      <p className="text-[11px] text-slate-500">{box.is_active === false ? "Inactive" : "Active"}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(box)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`Delete "${box.name}"?`)) return;
                          try {
                            await shippingBoxesAPI.deleteAdmin(box.id);
                            showMsg("success", "Shipping box deleted.");
                            await load();
                          } catch (error) {
                            showMsg("error", error instanceof Error ? error.message : "Failed to delete shipping box");
                          }
                        }}
                        className="rounded-md border border-rose-300 px-2.5 py-1 text-xs text-rose-700"
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
    </AdminNavbar>
  );
}

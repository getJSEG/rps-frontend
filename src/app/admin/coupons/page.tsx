"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { couponsAPI, type Coupon } from "../../../utils/api";

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return { year, month, day };
}

function DiscountTypeSelect({
  value,
  onChange,
}: {
  value: "percent" | "fixed";
  onChange: (next: "percent" | "fixed") => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const label = value === "fixed" ? "Fixed" : "Percentage";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${FIELD_CLASS} flex items-center justify-between gap-2 text-left`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open ? (
        <div
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          role="listbox"
        >
          {(
            [
              { id: "percent", label: "Percentage" },
              { id: "fixed", label: "Fixed" },
            ] as const
          ).map((opt) => {
            const active = opt.id === value;
            return (
              <button
                key={opt.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                }}
                className={`flex w-full rounded-md px-3 py-2 text-left text-sm ${
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ExpiryCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selected = parseIsoDate(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(selected?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.getMonth());

  useEffect(() => {
    if (!open) return;
    if (selected) {
      setViewYear(selected.year);
      setViewMonth(selected.month);
    }
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, selected?.year, selected?.month]);

  const days = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startPad = first.getDay();
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < startPad; i += 1) cells.push(null);
    for (let day = 1; day <= lastDay; day += 1) {
      cells.push({ day, iso: toIsoDate(viewYear, viewMonth, day) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const display = value ? formatExpiry(value) : "Select date";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${FIELD_CLASS} flex items-center justify-between gap-2 text-left ${
          value ? "text-slate-900" : "text-slate-400"
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{display}</span>
        <svg className="h-4 w-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.8" />
          <path d="M3 9h18M8 3v4M16 3v4" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-50"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-50"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((cell, idx) => {
              if (!cell) return <span key={`e-${idx}`} />;
              const isSelected = cell.iso === value;
              const isToday =
                cell.iso === toIsoDate(today.getFullYear(), today.getMonth(), today.getDate());
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-md text-xs ${
                    isSelected
                      ? "bg-slate-900 font-semibold text-white"
                      : isToday
                        ? "border border-slate-300 text-slate-900 hover:bg-slate-50"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FormState = {
  code: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  expiresOn: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  code: "",
  discountType: "percent",
  discountValue: "",
  expiresOn: "",
  isActive: true,
};

const isFloatInput = (v: string) => v === "" || /^\d*\.?\d*$/.test(v);

function formatDiscount(coupon: Coupon) {
  const value = Number(coupon.discountValue) || 0;
  if (String(coupon.discountType).toLowerCase() === "percent") {
    return `${value}% off`;
  }
  return `$${value.toFixed(2)} off`;
}

function formatCreatedAt(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function formatExpiry(value?: string | null) {
  if (!value) return "No expiry";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

export default function AdminCouponsPage() {
  const [rows, setRows] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await couponsAPI.getAdmin();
      setRows(Array.isArray(res?.coupons) ? res.coupons : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startEdit = (row: Coupon) => {
    setEditingId(Number(row.id));
    setForm({
      code: row.code || "",
      discountType: String(row.discountType).toLowerCase() === "fixed" ? "fixed" : "percent",
      discountValue: String(Number(row.discountValue) || ""),
      expiresOn: row.expiresOn || "",
      isActive: row.isActive !== false,
    });
    setError("");
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const valueNum = parseFloat(form.discountValue);
    if (!form.code.trim()) {
      setError("Coupon code is required");
      setSaving(false);
      return;
    }
    if (!Number.isFinite(valueNum) || valueNum <= 0) {
      setError("Discount value must be greater than 0");
      setSaving(false);
      return;
    }
    if (form.discountType === "percent" && valueNum > 100) {
      setError("Percent discount cannot be greater than 100");
      setSaving(false);
      return;
    }
    try {
      const payload = {
        code: form.code.trim(),
        discountType: form.discountType,
        discountValue: valueNum,
        isActive: form.isActive,
        expiresOn: form.expiresOn.trim() ? form.expiresOn.trim() : null,
      };
      if (editingId) {
        await couponsAPI.updateAdmin(editingId, payload);
      } else {
        await couponsAPI.createAdmin(payload);
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: Coupon) => {
    setTogglingId(Number(row.id));
    setError("");
    try {
      await couponsAPI.updateAdmin(row.id, { isActive: !row.isActive });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update coupon status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <AdminNavbar title="Coupons" subtitle="Create codes customers can apply at checkout">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Coupon" : "Create Coupon"}
          </h2>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Code</label>
              <input
                className={`${FIELD_CLASS} uppercase`}
                placeholder="SAVE10"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount type</label>
              <DiscountTypeSelect
                value={form.discountType}
                onChange={(discountType) => setForm((p) => ({ ...p, discountType }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {form.discountType === "percent" ? "Percent" : "Amount ($)"}
              </label>
              <input
                className={FIELD_CLASS}
                placeholder={form.discountType === "percent" ? "10" : "30"}
                type="text"
                inputMode="decimal"
                value={form.discountValue}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isFloatInput(v)) setForm((p) => ({ ...p, discountValue: v }));
                }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Expiry date</label>
              <ExpiryCalendar
                value={form.expiresOn}
                onChange={(expiresOn) => setForm((p) => ({ ...p, expiresOn }))}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Leave empty for no expiry. After this date the coupon turns inactive automatically.
              </p>
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
                {saving ? "Saving..." : editingId ? "Update Coupon" : "Create Coupon"}
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
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Saved Coupons</h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-slate-500 text-sm">No coupons yet.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {rows.map((r) => {
                const active = r.isActive !== false && r.expired !== true;
                return (
                  <div key={r.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 font-mono">{r.code}</p>
                        <p className="text-xs text-slate-600">{formatDiscount(r)}</p>
                        <p className="text-[11px] text-slate-500">
                          <span className={active ? "text-emerald-600 font-medium" : "text-orange-600 font-medium"}>
                            {active ? "Active" : "Inactive"}
                          </span>
                          {" · "}
                          {formatCreatedAt(r.createdAt)}
                          {" · expiry: "}
                          {formatExpiry(r.expiresOn)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <p className="mb-1 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Actions
                        </p>
                        <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={() => startEdit(r)}
                          className="px-2.5 py-1 rounded-md border border-slate-300 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void toggleActive(r)}
                          disabled={togglingId === Number(r.id)}
                          className={
                            active
                              ? "px-2.5 py-1 rounded-md border border-orange-300 bg-orange-50 text-orange-800 text-xs disabled:opacity-50"
                              : "px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs disabled:opacity-50"
                          }
                        >
                          {active ? "Deactivate" : "Activate"}
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
                  </div>
                );
              })}
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
              Delete coupon <span className="font-medium font-mono">{deleteTarget.code}</span>? Past
              orders that used it will still show the saved discount.
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
                  await couponsAPI.deleteAdmin(deleteTarget.id);
                  setDeleteTarget(null);
                  if (editingId === Number(deleteTarget.id)) resetForm();
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

"use client";

import { useMemo, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";

/**
 * Sales tax nexus tracker — DUMMY UI (no API yet).
 * Statuses always come from the rolling 12 months of completed orders, recalculated at month end.
 * The weekly/monthly filter only changes the numbers shown.
 */

type NexusStatus =
  | "not_collecting"
  | "close_warning"
  | "reached"
  | "pending_registration"
  | "filing"
  | "collecting";

type Rule = "or" | "and";

interface StateRow {
  code: string;
  name: string;
  /** null = state has no economic nexus threshold (N/A). */
  salesThreshold: number | null;
  txnThreshold: number | null;
  rule: Rule;
  /** Rolling 12 months. */
  sales: number;
  orders: number;
  /** Only manual statuses are stored; auto ones are derived from the numbers. */
  manualStatus: NexusStatus | null;
}

const STATUS_META: Record<NexusStatus, { label: string; chip: string; auto: boolean }> = {
  not_collecting: { label: "Not collecting", chip: "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80", auto: false },
  close_warning: { label: "Close warning", chip: "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300/80", auto: true },
  reached: { label: "Reached", chip: "bg-rose-50 text-rose-800 ring-1 ring-rose-200/80", auto: true },
  pending_registration: { label: "Pending registration", chip: "bg-orange-50 text-orange-800 ring-1 ring-orange-200/80", auto: false },
  filing: { label: "Filing", chip: "bg-sky-50 text-sky-800 ring-1 ring-sky-200/80", auto: false },
  collecting: { label: "Collecting", chip: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80", auto: false },
};

const STATUS_ORDER: NexusStatus[] = [
  "not_collecting",
  "close_warning",
  "reached",
  "pending_registration",
  "filing",
  "collecting",
];

const WARNING_RATIO = 0.95;

// [code, name, sales $, transactions, rule]
const THRESHOLDS: [string, string, number | null, number | null, Rule][] = [
  ["AL", "Alabama", 250000, null, "or"],
  ["AK", "Alaska", 100000, null, "or"],
  ["AZ", "Arizona", 100000, null, "or"],
  ["AR", "Arkansas", 100000, 200, "or"],
  ["CA", "California", 500000, null, "or"],
  ["CO", "Colorado", 100000, null, "or"],
  ["CT", "Connecticut", 100000, 200, "or"],
  ["DE", "Delaware", null, null, "or"],
  ["DC", "District of Columbia", 100000, 200, "or"],
  ["FL", "Florida", 100000, null, "or"],
  ["GA", "Georgia", 100000, 200, "or"],
  ["HI", "Hawaii", 100000, 200, "or"],
  ["ID", "Idaho", 100000, null, "or"],
  ["IL", "Illinois", 100000, null, "or"],
  ["IN", "Indiana", 100000, null, "or"],
  ["IA", "Iowa", 100000, null, "or"],
  ["KS", "Kansas", 100000, null, "or"],
  ["KY", "Kentucky", 100000, null, "or"],
  ["LA", "Louisiana", 100000, null, "or"],
  ["ME", "Maine", 100000, null, "or"],
  ["MD", "Maryland", 100000, 200, "or"],
  ["MA", "Massachusetts", 100000, null, "or"],
  ["MI", "Michigan", 100000, 200, "or"],
  ["MN", "Minnesota", 100000, 200, "or"],
  ["MS", "Mississippi", 250000, null, "or"],
  ["MO", "Missouri", 100000, null, "or"],
  ["MT", "Montana", null, null, "or"],
  ["NE", "Nebraska", 100000, 200, "or"],
  ["NV", "Nevada", 100000, 200, "or"],
  ["NH", "New Hampshire", null, null, "or"],
  ["NJ", "New Jersey", 100000, 200, "or"],
  ["NM", "New Mexico", 100000, null, "or"],
  ["NY", "New York", 500000, 100, "and"],
  ["NC", "North Carolina", 100000, null, "or"],
  ["ND", "North Dakota", 100000, null, "or"],
  ["OH", "Ohio", 100000, 200, "or"],
  ["OK", "Oklahoma", 100000, null, "or"],
  ["OR", "Oregon", null, null, "or"],
  ["PA", "Pennsylvania", 100000, null, "or"],
  ["PR", "Puerto Rico", 100000, 200, "or"],
  ["RI", "Rhode Island", 100000, 200, "or"],
  ["SC", "South Carolina", 100000, null, "or"],
  ["SD", "South Dakota", 100000, null, "or"],
  ["TN", "Tennessee", 100000, null, "or"],
  ["TX", "Texas", 500000, null, "or"],
  ["UT", "Utah", 100000, null, "or"],
  ["VT", "Vermont", 100000, 200, "or"],
  ["VA", "Virginia", 100000, 200, "or"],
  ["WA", "Washington", 100000, null, "or"],
  ["WV", "West Virginia", 100000, 200, "or"],
  ["WI", "Wisconsin", 100000, null, "or"],
  ["WY", "Wyoming", 100000, null, "or"],
];

// Dummy numbers so every status shows up somewhere.
const DUMMY: Record<string, { sales: number; orders: number; manual?: NexusStatus }> = {
  TX: { sales: 612450.2, orders: 1840, manual: "collecting" },
  CA: { sales: 498200, orders: 1210 },
  FL: { sales: 131780.55, orders: 402, manual: "pending_registration" },
  GA: { sales: 74210, orders: 196 },
  NY: { sales: 521000, orders: 88 },
  IL: { sales: 101350, orders: 290 },
  OH: { sales: 88400, orders: 215, manual: "filing" },
  NJ: { sales: 61200, orders: 191 },
  PA: { sales: 96300, orders: 260 },
  AZ: { sales: 54100.75, orders: 140 },
  WA: { sales: 112000, orders: 310, manual: "collecting" },
  OR: { sales: 23800, orders: 64 },
};

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h;
}

function dummyFallback(code: string): { sales: number; orders: number } {
  const h = hash(code);
  return { sales: 2000 + (h % 60) * 1000 + (h % 97) * 10.5, orders: 5 + (h % 120) };
}

function buildRows(): StateRow[] {
  return THRESHOLDS.map(([code, name, salesThreshold, txnThreshold, rule]) => {
    const d = DUMMY[code] ?? dummyFallback(code);
    return {
      code,
      name,
      salesThreshold,
      txnThreshold,
      rule,
      sales: d.sales,
      orders: d.orders,
      manualStatus: DUMMY[code]?.manual ?? null,
    };
  });
}

/** How far the state is toward nexus: 1 = threshold met. OR uses the higher ratio, AND the lower. */
function progressRatio(row: StateRow): number | null {
  const ratios: number[] = [];
  if (row.salesThreshold) ratios.push(row.sales / row.salesThreshold);
  if (row.txnThreshold) ratios.push(row.orders / row.txnThreshold);
  if (ratios.length === 0) return null;
  return row.rule === "and" ? Math.min(...ratios) : Math.max(...ratios);
}

function effectiveStatus(row: StateRow): NexusStatus {
  if (row.manualStatus && row.manualStatus !== "not_collecting") return row.manualStatus;
  const r = progressRatio(row);
  if (r === null) return "not_collecting";
  if (r >= 1) return "reached";
  if (r >= WARNING_RATIO) return "close_warning";
  return "not_collecting";
}

type Tab = "all" | "not_collecting" | "attention" | "collecting";

function tabFor(status: NexusStatus): Exclude<Tab, "all"> {
  if (status === "collecting") return "collecting";
  if (status === "not_collecting") return "not_collecting";
  return "attention";
}

// ---- Period filter (weeks run Monday–Sunday) ----

type PeriodKind = "rolling" | "month" | "week";

interface PeriodOption {
  key: string;
  label: string;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthOptions(): PeriodOption[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      key: isoDate(d).slice(0, 7),
      label: d.toLocaleString("en-US", { month: "long", year: "numeric" }) + (i === 0 ? " (this month)" : ""),
    };
  });
}

function weekOptions(): PeriodOption[] {
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric" });
  return Array.from({ length: 12 }, (_, i) => {
    const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * i);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return {
      key: isoDate(start),
      label: `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}` + (i === 0 ? " (this week)" : ""),
    };
  });
}

/** Dummy slice of the 12-month numbers for a single month or week. */
function periodNumbers(row: StateRow, kind: PeriodKind, key: string): { sales: number; orders: number } {
  if (kind === "rolling") return { sales: row.sales, orders: row.orders };
  const parts = kind === "month" ? 12 : 52;
  const f = 0.5 + (hash(row.code + key) % 100) / 100;
  return { sales: (row.sales / parts) * f, orders: Math.round((row.orders / parts) * f) };
}

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function thresholdLabel(row: StateRow): string {
  if (!row.salesThreshold && !row.txnThreshold) return "N/A";
  const parts: string[] = [];
  if (row.salesThreshold) parts.push(money(row.salesThreshold));
  if (row.txnThreshold) parts.push(`${row.txnThreshold} orders`);
  return parts.join(row.rule === "and" ? " and " : " or ");
}

function WarningIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

interface ThresholdForm {
  code: string;
  name: string;
  notApplicable: boolean;
  sales: string;
  txns: string;
  rule: Rule;
}

export default function TaxNexusPage() {
  const [rows, setRows] = useState<StateRow[]>(buildRows);
  const [tab, setTab] = useState<Tab>("attention");
  const [search, setSearch] = useState("");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("rolling");
  const months = useMemo(() => monthOptions(), []);
  const weeks = useMemo(() => weekOptions(), []);
  const [monthKey, setMonthKey] = useState(months[0].key);
  const [weekKey, setWeekKey] = useState(weeks[0].key);
  const [editing, setEditing] = useState<ThresholdForm | null>(null);
  const [formError, setFormError] = useState("");

  const periodKey = periodKind === "month" ? monthKey : periodKind === "week" ? weekKey : "";
  const periodLabel =
    periodKind === "month"
      ? months.find((m) => m.key === monthKey)?.label
      : periodKind === "week"
        ? weeks.find((w) => w.key === weekKey)?.label
        : "Nov 1, 2025 – Oct 31, 2026";

  const withStatus = useMemo(
    () => rows.map((row) => ({ row, status: effectiveStatus(row) })),
    [rows]
  );

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: withStatus.length, not_collecting: 0, attention: 0, collecting: 0 };
    for (const { status } of withStatus) c[tabFor(status)]++;
    return c;
  }, [withStatus]);

  const needsAction = withStatus.some(({ status }) => status === "close_warning" || status === "reached");

  const visible = withStatus
    .filter(({ status }) => tab === "all" || tabFor(status) === tab)
    .filter(({ row }) => {
      const q = search.trim().toLowerCase();
      return !q || row.name.toLowerCase().includes(q) || row.code.toLowerCase() === q;
    })
    .sort((a, b) => (progressRatio(b.row) ?? -1) - (progressRatio(a.row) ?? -1));

  const setManualStatus = (code: string, status: NexusStatus) => {
    setRows((prev) =>
      prev.map((r) => (r.code === code ? { ...r, manualStatus: status === "not_collecting" ? null : status } : r))
    );
  };

  const openEdit = (row: StateRow) => {
    setFormError("");
    setEditing({
      code: row.code,
      name: row.name,
      notApplicable: !row.salesThreshold && !row.txnThreshold,
      sales: row.salesThreshold ? String(row.salesThreshold) : "",
      txns: row.txnThreshold ? String(row.txnThreshold) : "",
      rule: row.rule,
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const sales = editing.sales.trim() ? Number(editing.sales) : null;
    const txns = editing.txns.trim() ? Number(editing.txns) : null;
    if (!editing.notApplicable) {
      if (sales === null && txns === null) return setFormError("Enter a sales amount, a transaction count, or mark N/A.");
      if ((sales !== null && !(sales > 0)) || (txns !== null && !(Number.isInteger(txns) && txns > 0)))
        return setFormError("Amounts must be positive numbers; transactions must be a whole number.");
    }
    setRows((prev) =>
      prev.map((r) =>
        r.code === editing.code
          ? {
              ...r,
              salesThreshold: editing.notApplicable ? null : sales,
              txnThreshold: editing.notApplicable ? null : txns,
              rule: editing.rule,
            }
          : r
      )
    );
    setEditing(null);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "not_collecting", label: "Not collecting" },
    { key: "attention", label: "Close / reached" },
    { key: "collecting", label: "Collecting" },
  ];

  const periodButtons: { key: PeriodKind; label: string }[] = [
    { key: "rolling", label: "Last 12 months" },
    { key: "month", label: "Monthly" },
    { key: "week", label: "Weekly" },
  ];

  const inputClass =
    "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400";
  const filterInputClass =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none";

  return (
    <AdminNavbar title="Sales Tax Nexus" subtitle="Sales per state from completed orders">
      <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
        Design preview: all numbers on this page are dummy data.
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nexus by state</h2>
              <p className="mt-1 text-xs text-slate-500">
                Showing: {periodLabel}
                {periodKind === "rolling"
                  ? " · Last updated Oct 31, 2026"
                  : " · Status is always based on the last 12 months"}
              </p>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search state…"
              aria-label="Search state"
              className={`${filterInputClass} w-full sm:w-52`}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  tab === key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {key === "attention" && needsAction && (
                  <WarningIcon className={`h-3.5 w-3.5 ${tab === key ? "text-amber-300" : "text-rose-600"}`} />
                )}
                {label}
                <span className={tab === key ? "text-slate-300" : "text-slate-400"}>{counts[key]}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Period">
              {periodButtons.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPeriodKind(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    periodKind === key ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {periodKind === "month" && (
              <select
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                aria-label="Month"
                className={filterInputClass}
              >
                {months.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            )}
            {periodKind === "week" && (
              <select
                value={weekKey}
                onChange={(e) => setWeekKey(e.target.value)}
                aria-label="Week"
                className={filterInputClass}
              >
                {weeks.map((w) => (
                  <option key={w.key} value={w.key}>
                    {w.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3.5 sm:px-6">State</th>
                <th className="px-4 py-3.5 sm:px-6">Threshold</th>
                <th className="px-4 py-3.5 text-right sm:px-6">Sales amount</th>
                <th className="px-4 py-3.5 text-right sm:px-6">Orders placed</th>
                <th className="px-4 py-3.5 sm:px-6">Status</th>
                <th className="w-20 px-4 py-3.5 sm:px-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-slate-500">
                    No states here right now.
                  </td>
                </tr>
              ) : (
                visible.map(({ row, status }) => {
                  const meta = STATUS_META[status];
                  const nums = periodNumbers(row, periodKind, periodKey);
                  return (
                    <tr
                      key={row.code}
                      className={status === "reached" ? "bg-rose-50/40" : status === "close_warning" ? "bg-yellow-50/40" : ""}
                    >
                      <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                        <div className="flex items-center gap-2">
                          {(status === "reached" || status === "close_warning") && (
                            <WarningIcon className={status === "reached" ? "h-4 w-4 text-rose-600" : "h-4 w-4 text-yellow-600"} />
                          )}
                          <span className="font-medium text-slate-900">{row.name}</span>
                          <span className="text-[11px] font-semibold text-slate-400">{row.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-500 sm:px-6">{thresholdLabel(row)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-right font-semibold text-slate-900 sm:px-6">
                        {money(nums.sales)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-slate-700 sm:px-6">
                        {nums.orders.toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                        <select
                          value={status}
                          onChange={(e) => setManualStatus(row.code, e.target.value as NexusStatus)}
                          className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 ${meta.chip}`}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s} disabled={STATUS_META[s].auto && s !== status}>
                              {STATUS_META[s].label}
                              {STATUS_META[s].auto ? " (auto)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right sm:px-6">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="threshold-modal-title"
          onClick={() => setEditing(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="threshold-modal-title" className="text-lg font-bold text-slate-900">
              Edit threshold · {editing.name}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Warning shows at 95% and alert at 100% of these numbers, over the last 12 months.
            </p>

            <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editing.notApplicable}
                onChange={(e) => setEditing({ ...editing, notApplicable: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              No threshold (N/A): state has no sales tax nexus rule
            </label>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Sales amount ($)</span>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={editing.sales}
                  disabled={editing.notApplicable}
                  onChange={(e) => setEditing({ ...editing, sales: e.target.value })}
                  placeholder="100000"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Transactions</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={editing.txns}
                  disabled={editing.notApplicable}
                  onChange={(e) => setEditing({ ...editing, txns: e.target.value })}
                  placeholder="Optional"
                  className={inputClass}
                />
              </label>
            </div>

            <fieldset
              className="mt-4 disabled:opacity-50"
              disabled={editing.notApplicable || !editing.sales.trim() || !editing.txns.trim()}
            >
              <legend className="mb-1.5 text-xs font-semibold text-slate-600">When both are set</legend>
              <div className="space-y-1.5 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rule"
                    checked={editing.rule === "or"}
                    onChange={() => setEditing({ ...editing, rule: "or" })}
                  />
                  Either one triggers nexus (OR)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rule"
                    checked={editing.rule === "and"}
                    onChange={() => setEditing({ ...editing, rule: "and" })}
                  />
                  Both are needed (AND)
                </label>
              </div>
            </fieldset>

            {formError && <p className="mt-3 text-sm text-rose-700">{formError}</p>}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Save threshold
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminNavbar>
  );
}

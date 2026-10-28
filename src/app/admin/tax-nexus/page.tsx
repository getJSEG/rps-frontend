"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import {
  nexusAPI,
  NEXUS_ATTENTION_CHANGED_EVENT,
  type NexusPeriod,
  type NexusState,
  type NexusStatus,
} from "../../../utils/api";

/**
 * Sales tax nexus tracker. Statuses always come from the rolling 12 months of completed orders,
 * recalculated after each month closes; the weekly/monthly filter only changes the numbers shown.
 */

type Rule = "or" | "and";

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

/** How far the state is toward nexus over the last 12 months: 1 = threshold met. Used for sorting. */
function progressRatio(s: NexusState): number {
  const ratios: number[] = [];
  if (s.salesThreshold) ratios.push(s.rollingSales / s.salesThreshold);
  if (s.transactionThreshold) ratios.push(s.rollingOrders / s.transactionThreshold);
  if (ratios.length === 0) return -1;
  return s.rule === "and" ? Math.min(...ratios) : Math.max(...ratios);
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

/** "2026-09-30" → "Sep 30, 2026" without time zone shifts. */
function formatDay(ymd: string | null | undefined): string {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function thresholdLabel(s: NexusState): string {
  if (!s.salesThreshold && !s.transactionThreshold) return "N/A";
  const parts: string[] = [];
  if (s.salesThreshold) parts.push(money(s.salesThreshold));
  if (s.transactionThreshold) parts.push(`${s.transactionThreshold} orders`);
  return parts.join(s.rule === "and" ? " and " : " or ");
}

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
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
  const [states, setStates] = useState<NexusState[]>([]);
  const [period, setPeriod] = useState<NexusPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("rolling");
  const months = useMemo(() => monthOptions(), []);
  const weeks = useMemo(() => weekOptions(), []);
  const [monthKey, setMonthKey] = useState(months[0].key);
  const [weekKey, setWeekKey] = useState(weeks[0].key);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [editing, setEditing] = useState<ThresholdForm | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const periodKey = periodKind === "month" ? monthKey : periodKind === "week" ? weekKey : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    nexusAPI
      .getStatesAdmin(periodKind, periodKey)
      .then((res) => {
        if (cancelled) return;
        setStates(Array.isArray(res?.states) ? res.states : []);
        setPeriod(res?.period ?? null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(errorMessage(e, "Failed to load nexus states"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodKind, periodKey]);

  const periodLabel =
    periodKind === "month"
      ? months.find((m) => m.key === monthKey)?.label
      : periodKind === "week"
        ? weeks.find((w) => w.key === weekKey)?.label
        : period?.start
          ? `${formatDay(period.start)} – ${formatDay(period.end)}`
          : "Not calculated yet";

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: states.length, not_collecting: 0, attention: 0, collecting: 0 };
    for (const s of states) c[tabFor(s.status)]++;
    return c;
  }, [states]);

  const needsAction = states.some((s) => s.status === "close_warning" || s.status === "reached");

  const visible = states
    .filter((s) => tab === "all" || tabFor(s.status) === tab)
    .filter((s) => {
      const q = search.trim().toLowerCase();
      return !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q;
    })
    .sort((a, b) => progressRatio(b) - progressRatio(a) || a.name.localeCompare(b.name));

  /** Server returns 12-month fields; keep the numbers already shown for the selected week/month. */
  const replaceState = (updated: NexusState) => {
    setStates((prev) =>
      prev.map((s) => (s.code === updated.code ? { ...updated, sales: s.sales, orders: s.orders } : s))
    );
    window.dispatchEvent(new Event(NEXUS_ATTENTION_CHANGED_EVENT));
  };

  const changeStatus = async (code: string, status: NexusStatus) => {
    try {
      setBusyCode(code);
      const res = await nexusAPI.updateStatusAdmin(code, status);
      replaceState(res.state);
    } catch (e) {
      alert(errorMessage(e, "Failed to update status"));
    } finally {
      setBusyCode(null);
    }
  };

  const openEdit = (s: NexusState) => {
    setFormError("");
    setEditing({
      code: s.code,
      name: s.name,
      notApplicable: !s.salesThreshold && !s.transactionThreshold,
      sales: s.salesThreshold ? String(s.salesThreshold) : "",
      txns: s.transactionThreshold ? String(s.transactionThreshold) : "",
      rule: s.rule,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const sales = editing.sales.trim() ? Number(editing.sales) : null;
    const txns = editing.txns.trim() ? Number(editing.txns) : null;
    if (!editing.notApplicable) {
      if (sales === null && txns === null) return setFormError("Enter a sales amount, a transaction count, or mark N/A.");
      if ((sales !== null && !(sales > 0)) || (txns !== null && !(Number.isInteger(txns) && txns > 0)))
        return setFormError("Amounts must be positive numbers; transactions must be a whole number.");
    }
    try {
      setSaving(true);
      const res = await nexusAPI.updateThresholdAdmin(editing.code, {
        salesThreshold: editing.notApplicable ? null : sales,
        transactionThreshold: editing.notApplicable ? null : txns,
        rule: editing.rule,
        notApplicable: editing.notApplicable,
      });
      replaceState(res.state);
      setEditing(null);
    } catch (e) {
      setFormError(errorMessage(e, "Failed to save threshold"));
    } finally {
      setSaving(false);
    }
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
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Nexus by state</h2>
              <p className="mt-1 text-xs text-slate-500">
                Showing: {periodLabel}
                {periodKind === "rolling"
                  ? period?.calculatedAt
                    ? ` · Last updated ${new Date(period.calculatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}`
                    : ""
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                      Loading…
                    </span>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-rose-700">
                    {loadError}
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-14 text-center text-slate-500">
                    No states here right now.
                  </td>
                </tr>
              ) : (
                visible.map((s) => {
                  const meta = STATUS_META[s.status] ?? STATUS_META.not_collecting;
                  return (
                    <tr
                      key={s.code}
                      className={s.status === "reached" ? "bg-rose-50/40" : s.status === "close_warning" ? "bg-yellow-50/40" : ""}
                    >
                      <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                        <div className="flex items-center gap-2">
                          {(s.status === "reached" || s.status === "close_warning") && (
                            <WarningIcon className={s.status === "reached" ? "h-4 w-4 text-rose-600" : "h-4 w-4 text-yellow-600"} />
                          )}
                          <span className="font-medium text-slate-900">{s.name}</span>
                          <span className="text-[11px] font-semibold text-slate-400">{s.code}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-500 sm:px-6">{thresholdLabel(s)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-right font-semibold text-slate-900 sm:px-6">
                        {money(s.sales)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-slate-700 sm:px-6">
                        {s.orders.toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap sm:px-6">
                        <select
                          value={s.status}
                          disabled={busyCode === s.code}
                          onChange={(e) => void changeStatus(s.code, e.target.value as NexusStatus)}
                          className={`cursor-pointer rounded-lg border-0 px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-wait disabled:opacity-60 ${meta.chip}`}
                        >
                          {STATUS_ORDER.map((st) => (
                            <option key={st} value={st} disabled={STATUS_META[st].auto && st !== s.status}>
                              {STATUS_META[st].label}
                              {STATUS_META[st].auto ? " (auto)" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right sm:px-6">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
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
          onClick={() => {
            if (!saving) setEditing(null);
          }}
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
                disabled={saving}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save threshold"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminNavbar>
  );
}

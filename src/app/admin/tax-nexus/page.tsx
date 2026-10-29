"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
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
 * recalculated every day (to yesterday); the weekly/monthly filter only changes the numbers shown.
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

/** "2026-10" → "October 2026" (+ " (this month)" for the current month). */
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const now = new Date();
  const label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  return y === now.getFullYear() && m - 1 === now.getMonth() ? `${label} (this month)` : label;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Month calendar for the Monthly filter, styled like the Reports date picker.
 * value / onChange use "YYYY-MM"; future months cannot be picked.
 */
function MonthPicker({
  value,
  onChange,
  buttonClassName,
}: {
  value: string;
  onChange: (key: string) => void;
  buttonClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && buttonRef.current) {
      // Fixed position: the filter row sits inside a card with overflow hidden.
      const rect = buttonRef.current.getBoundingClientRect();
      const width = 248;
      setPanelStyle({ position: "fixed", top: rect.bottom + 4, left: Math.max(8, rect.right - width), width });
      setViewYear(Number(value.slice(0, 4)));
    }
    setOpen((prev) => !prev);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Month"
        className={`inline-flex items-center gap-2 text-left ${buttonClassName}`}
      >
        <span>{monthLabel(value)}</span>
        <svg className="h-4 w-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.8" />
          <path d="M3 9h18M8 3v4M16 3v4" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose month"
          style={panelStyle}
          className="z-[90] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-50"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Previous year"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-900">{viewYear}</p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => setViewYear((y) => y + 1)}
              disabled={viewYear >= thisYear}
              aria-label="Next year"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTH_SHORT.map((name, idx) => {
              const key = `${viewYear}-${String(idx + 1).padStart(2, "0")}`;
              const isSelected = key === value;
              const isCurrent = viewYear === thisYear && idx === thisMonth;
              const isFuture = viewYear > thisYear || (viewYear === thisYear && idx > thisMonth);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isFuture}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`h-9 rounded-md text-xs ${
                    isSelected
                      ? "bg-slate-900 font-semibold text-white"
                      : isFuture
                        ? "cursor-not-allowed text-slate-300"
                        : isCurrent
                          ? "border border-slate-300 text-slate-900 hover:bg-slate-50"
                          : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Monday of the week that contains d (weeks run Monday–Sunday). */
function mondayOf(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday "2026-10-26" → "Oct 26 – Nov 1, 2026" (+ " (this week)" for the current week). */
function weekLabel(key: string): string {
  const start = parseYmd(key);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric" });
  const label = `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  return key === isoDate(mondayOf(new Date())) ? `${label} (this week)` : label;
}

const WEEKDAYS_MON_FIRST = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/**
 * Week calendar for the Weekly filter, styled like the Reports date picker. Clicking any day picks its
 * Monday–Sunday week; value / onChange use the Monday as "YYYY-MM-DD". Future weeks cannot be picked.
 */
function WeekPicker({
  value,
  onChange,
  buttonClassName,
}: {
  value: string;
  onChange: (mondayKey: string) => void;
  buttonClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const d = parseYmd(value);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayKey = isoDate(today);
  const currentMondayKey = isoDate(mondayOf(today));

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (!open && buttonRef.current) {
      // Fixed position: the filter row sits inside a card with overflow hidden.
      const rect = buttonRef.current.getBoundingClientRect();
      const width = 280;
      setPanelStyle({ position: "fixed", top: rect.bottom + 4, left: Math.max(8, rect.right - width), width });
      const d = parseYmd(value);
      setView({ year: d.getFullYear(), month: d.getMonth() });
      setHoverKey(null);
    }
    setOpen((prev) => !prev);
  };

  // Rows of Monday–Sunday weeks that cover the viewed month.
  const rows: Date[][] = [];
  const firstOfMonth = new Date(view.year, view.month, 1);
  for (let start = mondayOf(firstOfMonth); start.getMonth() === view.month || start < firstOfMonth; ) {
    rows.push(Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
    start = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  }

  const atCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth();
  const shiftMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Week"
        className={`inline-flex items-center gap-2 text-left ${buttonClassName}`}
      >
        <span>{weekLabel(value)}</span>
        <svg className="h-4 w-4 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.8" />
          <path d="M3 9h18M8 3v4M16 3v4" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose week"
          style={panelStyle}
          className="z-[90] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-50"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-slate-900">
              {firstOfMonth.toLocaleString("en-US", { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
              onClick={() => shiftMonth(1)}
              disabled={atCurrentMonth}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-400">
            {WEEKDAYS_MON_FIRST.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="mt-1 space-y-0.5" onMouseLeave={() => setHoverKey(null)}>
            {rows.map((week) => {
              const weekKey = isoDate(week[0]);
              const isSelected = weekKey === value;
              const isFuture = weekKey > currentMondayKey;
              const isHover = hoverKey === weekKey && !isSelected && !isFuture;
              return (
                <button
                  key={weekKey}
                  type="button"
                  disabled={isFuture}
                  onMouseEnter={() => setHoverKey(weekKey)}
                  onClick={() => {
                    onChange(weekKey);
                    setOpen(false);
                  }}
                  aria-label={weekLabel(weekKey)}
                  className={`grid w-full grid-cols-7 gap-0.5 rounded-md ${
                    isSelected
                      ? "bg-slate-900 text-white"
                      : isFuture
                        ? "cursor-not-allowed"
                        : isHover
                          ? "bg-slate-100"
                          : ""
                  }`}
                >
                  {week.map((day) => {
                    const inMonth = day.getMonth() === view.month;
                    const isToday = isoDate(day) === todayKey;
                    return (
                      <span
                        key={isoDate(day)}
                        className={`flex h-8 items-center justify-center rounded-md text-xs ${
                          isSelected
                            ? `font-semibold ${inMonth ? "text-white" : "text-slate-400"}`
                            : isFuture
                              ? "text-slate-300"
                              : inMonth
                                ? "text-slate-700"
                                : "text-slate-400"
                        } ${isToday && !isSelected ? "border border-slate-300" : ""}`}
                      >
                        {day.getDate()}
                      </span>
                    );
                  })}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
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

/** Compact state chip for the alert bar: name + % of threshold (rounded down, so 99.6% never shows 100%). */
function AlertPill({ state, tone, onClick }: { state: NexusState; tone: "reached" | "warning"; onClick: () => void }) {
  const pct = Math.floor(progressRatio(state) * 100);
  const colors =
    tone === "reached"
      ? "border-rose-300 text-rose-900 hover:bg-rose-100"
      : "border-yellow-300 text-yellow-900 hover:bg-yellow-100";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Show ${state.name} in the table`}
      className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 text-xs font-semibold ${colors}`}
    >
      {state.name}
      <span className={tone === "reached" ? "text-rose-600" : "text-yellow-700"}>{pct}%</span>
    </button>
  );
}

type ThemedDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/**
 * Same look as the admin ThemedDropdown (products / hardware / modifiers). The menu is fixed-positioned
 * so it is not clipped by the scrolling table, and opens upward when there is no room below.
 */
function ThemedDropdown({
  value,
  options,
  onChange,
  ariaLabel,
  buttonClassName,
  disabled = false,
  menuMinWidth = 0,
}: {
  value: string;
  options: ThemedDropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  buttonClassName: string;
  disabled?: boolean;
  menuMinWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // The menu is fixed-positioned, so close when the page scrolls, but not when the list itself scrolls.
    const onScroll = (event: Event) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuHeight = Math.min(256, options.length * 36 + 10);
      const openUp = window.innerHeight - rect.bottom < menuHeight + 8 && rect.top > menuHeight + 8;
      setMenuStyle({
        position: "fixed",
        left: rect.left,
        minWidth: Math.max(rect.width, menuMinWidth),
        ...(openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setOpen((prev) => !prev);
  };

  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? "";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-2 text-left outline-none transition disabled:cursor-wait disabled:opacity-60 ${buttonClassName}`}
      >
        <span className="truncate">{selectedLabel}</span>
        <FiChevronDown
          className={`shrink-0 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="listbox"
          style={menuStyle}
          className="z-[90] max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg"
        >
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={opt.disabled}
                onClick={() => {
                  setOpen(false);
                  if (!isActive) onChange(opt.value);
                }}
                className={`block w-full whitespace-nowrap px-3 py-2 text-left text-sm transition ${
                  isActive
                    ? "bg-sky-50 text-sky-800"
                    : opt.disabled
                      ? "cursor-not-allowed text-slate-400"
                      : "text-slate-700 hover:bg-slate-50"
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
  const [monthKey, setMonthKey] = useState(() => isoDate(new Date()).slice(0, 7));
  const [weekKey, setWeekKey] = useState(() => isoDate(mondayOf(new Date())));
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
      ? monthLabel(monthKey)
      : periodKind === "week"
        ? weekLabel(weekKey)
        : period?.start
          ? `${formatDay(period.start)} – ${formatDay(period.end)}`
          : "Not calculated yet";

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: states.length, not_collecting: 0, attention: 0, collecting: 0 };
    for (const s of states) c[tabFor(s.status)]++;
    return c;
  }, [states]);

  const needsAction = states.some((s) => s.status === "close_warning" || s.status === "reached");
  const byRatioDesc = (a: NexusState, b: NexusState) => progressRatio(b) - progressRatio(a);
  const reachedStates = states.filter((s) => s.status === "reached").sort(byRatioDesc);
  const warningStates = states.filter((s) => s.status === "close_warning").sort(byRatioDesc);

  const query = search.trim().toLowerCase();
  // An exact state name (e.g. from an alert pill) shows only that state, so "Kansas" skips "Arkansas".
  const exactMatch = states.some((s) => s.name.toLowerCase() === query);
  const visible = states
    .filter((s) => tab === "all" || tabFor(s.status) === tab)
    .filter((s) => {
      if (!query) return true;
      if (exactMatch) return s.name.toLowerCase() === query;
      return s.name.toLowerCase().includes(query) || s.code.toLowerCase() === query;
    })
    .sort((a, b) => progressRatio(b) - progressRatio(a) || a.name.localeCompare(b.name));

  /** Server returns 12-month fields; keep the numbers already shown for the selected week/month. */
  const replaceState = (updated: NexusState) => {
    setStates((prev) =>
      prev.map((s) => (s.code === updated.code ? { ...updated, sales: s.sales, orders: s.orders } : s))
    );
    window.dispatchEvent(new Event(NEXUS_ATTENTION_CHANGED_EVENT));
  };

  /** Alert pill click: show just that state in the table. */
  const focusState = (s: NexusState) => {
    setTab("all");
    setSearch(s.name);
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
      {(reachedStates.length > 0 || warningStates.length > 0) && (
        <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5" role="alert">
          {reachedStates.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-l-4 border-rose-500 bg-rose-100/70 px-5 py-3">
              <WarningIcon className="h-5 w-5 shrink-0 text-rose-600" />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-900">
                Reached
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none tabular-nums shadow-sm bg-gradient-to-b from-rose-500 to-rose-600 text-white ring-2 ring-white">
                  {reachedStates.length}
                </span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {reachedStates.map((s) => (
                  <AlertPill key={s.code} state={s} tone="reached" onClick={() => focusState(s)} />
                ))}
              </div>
            </div>
          )}
          {warningStates.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-l-4 border-yellow-400 bg-yellow-100/70 px-5 py-3">
              <WarningIcon className="h-5 w-5 shrink-0 text-yellow-600" />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-900">
                Close 95%+
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none tabular-nums shadow-sm bg-gradient-to-b from-amber-300 to-amber-400 text-amber-950 ring-2 ring-white">
                  {warningStates.length}
                </span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {warningStates.map((s) => (
                  <AlertPill key={s.code} state={s} tone="warning" onClick={() => focusState(s)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                <MonthPicker value={monthKey} onChange={setMonthKey} buttonClassName={filterInputClass} />
              )}
              {periodKind === "week" && (
                <WeekPicker value={weekKey} onChange={setWeekKey} buttonClassName={filterInputClass} />
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
                <th className="px-4 py-3.5 text-center sm:px-6">Sales amount</th>
                <th className="px-4 py-3.5 text-center sm:px-6">Orders placed</th>
                <th className="px-4 py-3.5 text-center sm:px-6">Status</th>
                <th className="w-20 px-4 py-3.5 text-right sm:px-6">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
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
                      className={s.status === "reached" ? "bg-rose-100/40" : s.status === "close_warning" ? "bg-yellow-100/40" : ""}
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
                      <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-slate-900 sm:px-6">
                        {money(s.sales)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center text-slate-700 sm:px-6">
                        {s.orders.toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-center sm:px-6">
                        <ThemedDropdown
                          value={s.status}
                          disabled={busyCode === s.code}
                          onChange={(next) => void changeStatus(s.code, next as NexusStatus)}
                          ariaLabel={`Status for ${s.name}`}
                          menuMinWidth={200}
                          buttonClassName={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium focus:ring-2 focus:ring-slate-300 ${meta.chip}`}
                          options={STATUS_ORDER.map((st) => ({
                            value: st,
                            label: STATUS_META[st].label + (STATUS_META[st].auto ? " (auto)" : ""),
                            disabled: STATUS_META[st].auto && st !== s.status,
                          }))}
                        />
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
                  Either one triggers nexus
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="rule"
                    checked={editing.rule === "and"}
                    onChange={() => setEditing({ ...editing, rule: "and" })}
                  />
                  Both are needed
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

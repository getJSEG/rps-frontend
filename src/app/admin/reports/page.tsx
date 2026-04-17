"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "../../components/AdminNavbar";
import {
  reportsAPI,
  type AdminDashboardResponse,
  type ReportsDateRange,
} from "../../../utils/api";
import { adminOrderStatusLabel } from "../../../utils/orderStatuses";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";

type LoadingState = "idle" | "loading" | "ready" | "error";

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

function toDateInputValue(d: Date): string {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function RevenueLineChart({ points }: { points: { bucket: string; revenue: number }[] }) {
  const width = 1000;
  const height = 260;
  const padLeft = 58;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 34;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  if (!points.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
        No revenue data in selected range.
      </div>
    );
  }

  const values = points.map((p) => p.revenue);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const spread = Math.max(maxValue - minValue, 1);
  const yTicks = 5;

  const polyline = points
    .map((p, i) => {
      const x = padLeft + (i / Math.max(points.length - 1, 1)) * chartW;
      const y = padTop + (1 - (p.revenue - minValue) / spread) * chartH;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Revenue over time chart"
        className="block w-full"
      >
        <defs>
          <linearGradient id="revenueLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="14" fill="#f8fafc" />

        {[...Array(yTicks)].map((_, idx) => {
          const ratio = idx / (yTicks - 1);
          const y = padTop + ratio * chartH;
          const tickValue = maxValue - ratio * spread;
          return (
            <g key={idx}>
              <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={padLeft - 8} y={y + 4} textAnchor="end" className="fill-slate-500 text-[10px]">
                {currency(tickValue)}
              </text>
            </g>
          );
        })}

        <line x1={padLeft} y1={padTop} x2={padLeft} y2={height - padBottom} stroke="#cbd5e1" strokeWidth="1.2" />
        <line x1={padLeft} y1={height - padBottom} x2={width - padRight} y2={height - padBottom} stroke="#cbd5e1" strokeWidth="1.2" />

        <polyline fill="none" stroke="url(#revenueLine)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
        {points.map((p, i) => {
          const x = padLeft + (i / Math.max(points.length - 1, 1)) * chartW;
          const y = padTop + (1 - (p.revenue - minValue) / spread) * chartH;
          return (
            <g key={`${p.bucket}-${i}`}>
              <title>{`${p.bucket} - ${currency(p.revenue)}`}</title>
              <circle cx={x} cy={y} r="3.8" fill="#0f172a" />
              <text x={x} y={height - 8} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {p.bucket}
              </text>
            </g>
          );
        })}

      </svg>
    </div>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadingState>("idle");
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [dateRange, setDateRange] = useState<ReportsDateRange>("all");
  const [chartYear, setChartYear] = useState<number>(() => new Date().getFullYear());
  const [fromDate, setFromDate] = useState<string>(() => toDateInputValue(new Date(Date.now() - 29 * 86400000)));
  const [toDate, setToDate] = useState<string>(() => toDateInputValue(new Date()));

  const fetchDashboard = async () => {
    try {
      setState("loading");
      const result = await reportsAPI.getAdminDashboard({
        range: dateRange,
        chartYear,
        from: dateRange === "custom" ? fromDate : undefined,
        to: dateRange === "custom" ? toDate : undefined,
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      });
      setData(result);
      setState("ready");
    } catch (e) {
      console.error("Failed loading reports dashboard:", e);
      setState("error");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated() || !canAccessAdminPanel()) {
      router.push("/");
      return;
    }
    void fetchDashboard();
  }, [router, dateRange, chartYear]);

  const overviewRows = useMemo(() => {
    if (!data?.ordersOverview) return [];
    return [
      { label: "Processing", value: data.ordersOverview.processing },
      { label: "Shipped", value: data.ordersOverview.shipped },
      { label: "In progress", value: data.ordersOverview.pending },
    ];
  }, [data]);
  const statusOrder = [
    "printing",
    "trimming",
    "pending_payment",
    "awaiting_artwork",
    "on_hold",
    "awaiting_refund",
    "shipped",
    "reprint",
    "cancelled",
  ];
  const statusCountMap = new Map(
    (data?.ordersOverview?.statusBreakdown || []).map((r) => [String(r.status || ""), Number(r.count || 0)])
  );
  const extraStatusRows = statusOrder.map((status) => ({
    status,
    count: statusCountMap.get(status) || 0,
  }));

  return (
    <AdminNavbar title="Reports Dashboard" subtitle="Business performance at a glance">
      <div className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Filters</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Date and trend options</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDateRange("all")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${dateRange === "all" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                All history
              </button>
              <button
                type="button"
                onClick={() => setDateRange("today")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${dateRange === "today" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateRange("last30")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${dateRange === "last30" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                Last 30 days
              </button>
              <button
                type="button"
                onClick={() => setDateRange("custom")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${dateRange === "custom" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
              >
                Custom
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            {dateRange === "custom" && (
              <>
                <label className="text-sm text-slate-600">
                  From{" "}
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  To{" "}
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="ml-2 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void fetchDashboard()}
                  className="inline-flex rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
                >
                  Apply
                </button>
              </>
            )}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700">Registered users</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{data?.summary.registeredUsersCount || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Total revenue</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{currency(data?.summary.totalRevenue || 0)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Total orders</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{data?.summary.totalOrders || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Completed orders</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{data?.summary.completedOrders || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Orders in progress</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{data?.summary.pendingOrders || 0}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Registered vs Guest Orders</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Registered completed</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data?.summary.registeredCompletedOrders || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Registered in progress</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data?.summary.registeredInProgressOrders || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Guest completed</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data?.summary.guestCompletedOrders || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Guest in progress</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{data?.summary.guestInProgressOrders || 0}</p>
            </div>
          </div>
        </section>

        <section className="grid items-stretch gap-4 md:grid-cols-23">
          <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-14">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-900">Revenue trend</h3>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-500">Year</label>
                <select
                  value={chartYear}
                  onChange={(e) => setChartYear(Number(e.target.value))}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-700"
                >
                  {(data?.revenueChart?.availableYears?.length ? data.revenueChart.availableYears : [chartYear]).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <RevenueLineChart points={data?.revenueChart?.series || []} />
          </div>

          <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-9">
            <h3 className="text-lg font-semibold text-slate-900">Refund snapshot</h3>
            <div className="mt-4 flex-1 space-y-3">
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-wide text-rose-700">Refund orders</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{data?.summary.refundOrders || 0}</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3">
                <p className="text-xs uppercase tracking-wide text-rose-700">Refund amount</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{currency(data?.summary.refundAmount || 0)}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/admin/refunds")}
                className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-200"
              >
                See refund orders
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-slate-900">Live Orders Status Overview</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-3">
              {overviewRows.map((row) => {
                const tone =
                  row.label === "Processing"
                    ? "bg-sky-50 text-sky-900 border-sky-200"
                    : row.label === "Shipped"
                      ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                      : "bg-amber-50 text-amber-900 border-amber-200";
                return (
                  <div key={row.label} className={`rounded-lg border px-3 py-2 ${tone}`}>
                    <p className="text-xs">{row.label}</p>
                    <p className="mt-1 text-base font-semibold">{row.value}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {extraStatusRows.map((row) => {
                const label = adminOrderStatusLabel(row.status);
                let tone =
                  row.status === "printing" || row.status === "trimming" || row.status === "reprint"
                    ? "bg-sky-50 text-sky-900 border-sky-200"
                    : row.status === "shipped"
                      ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                      : row.status === "awaiting_refund"
                        ? "bg-rose-50 text-rose-900 border-rose-200"
                        : row.status === "cancelled"
                          ? "bg-slate-100 text-slate-800 border-slate-300"
                          : "bg-slate-50 text-slate-900 border-slate-200";
                return (
                  <div key={row.status} className={`rounded-lg border px-3 py-2 ${tone}`}>
                    <p className="text-xs">{label}</p>
                    <p className="mt-1 text-base font-semibold">{row.count}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Top products</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Product</th>
                    <th className="py-2 pr-3">Orders</th>
                    <th className="py-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.topProducts || []).map((p) => (
                    <tr key={`${p.productId || "na"}-${p.productName}`} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{p.productName}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{p.orderCount}</td>
                      <td className="py-2.5 font-semibold text-slate-900">{currency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Recent orders</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Order</th>
                    <th className="py-2 pr-3">Customer</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.recentOrders || []).map((o) => (
                    <tr key={o.orderId} className="border-b border-slate-100">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">{o.orderNumber}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{o.customerName}</td>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900">{currency(o.totalAmount)}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{adminOrderStatusLabel(o.status)}</td>
                      <td className="py-2.5 text-slate-500">{new Date(o.date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {state === "loading" && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Loading dashboard data…</div>
        )}
        {state === "error" && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Could not load reports. Please check date filters or try again.
          </div>
        )}
      </div>
    </AdminNavbar>
  );
}

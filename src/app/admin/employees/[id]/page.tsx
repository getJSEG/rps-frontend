"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import AdminNavbar from "../../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../../utils/roles";
import { employeesAPI } from "../../../../utils/api";

interface Employee {
  id: number;
  email: string;
  full_name: string;
  telephone: string | null;
  role: string;
  is_active: boolean;
  is_approved: boolean;
  profile_image: string | null;
  hire_date: string | null;
  created_at: string;
  updated_at?: string;
}

const getImageSrc = (path: string | null | undefined): string => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const base =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/api\/?$/, "")
      : "http://localhost:5000";
  return `${base}${path.startsWith("/") ? path : "/" + path}`;
};

function splitName(fullName: string): { firstName: string; lastName: string } {
  const s = (fullName || "").trim();
  const i = s.indexOf(" ");
  if (i <= 0) return { firstName: s || "—", lastName: "—" };
  return { firstName: s.slice(0, i), lastName: s.slice(i + 1).trim() || "—" };
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, ".");
  } catch {
    return "—";
  }
}

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(true);
  const [onboardingProgress] = useState(35);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }
    if (!canAccessAdminPanel()) {
      router.push("/");
      return;
    }
  }, [router]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await employeesAPI.getById(id);
        if (!cancelled && res?.employee) setEmployee(res.employee);
        else if (!cancelled) setError("Employee not found");
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load employee");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => alert(`${label} copied`),
      () => {}
    );
  };

  if (loading) {
    return (
      <AdminNavbar title="Employee" subtitle="Profile">
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-slate-200/60 bg-white p-8 shadow-sm">
          <p className="flex items-center gap-2 text-slate-500">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Loading…
          </p>
        </div>
      </AdminNavbar>
    );
  }

  if (error || !employee) {
    return (
      <AdminNavbar title="Employee" subtitle="Profile">
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/50 p-8">
          <p className="mb-4 font-medium text-rose-800">{error || "Employee not found"}</p>
          <Link
            href="/admin/employees"
            className="inline-flex items-center gap-2 text-sm font-medium text-sky-600 hover:text-sky-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to employees
          </Link>
        </div>
      </AdminNavbar>
    );
  }

  const { firstName, lastName } = splitName(employee.full_name || "");
  const position = employee.role === "admin" ? "Admin" : "Employee";
  const statusLabel = employee.is_active ? "Active" : "Inactive";

  return (
    <AdminNavbar title={employee.full_name || "Employee"} subtitle="Profile & onboarding">
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to employees
      </Link>

      <div className="grid grid-cols-1 gap-8 rounded-xl border border-slate-200/60 bg-white p-6 shadow-sm shadow-slate-900/5 md:grid-cols-3 md:p-8">
          <div className="flex flex-col items-center">
            <h3 className="mb-4 w-full text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              Profile image
            </h3>
            <div className="flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
              {employee.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getImageSrc(employee.profile_image)}
                  alt={employee.full_name || "Employee"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-semibold text-slate-400">
                  {(employee.full_name || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <Link
              href={`/admin/employees?edit=${employee.id}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 16v1a2 2 0 01-2 2H7a2 2 0 01-2-2v-1m14 0v-3a2 2 0 00-2-2H7a2 2 0 00-2 2v3m14 0V9a2 2 0 00-2-2h-2" />
              </svg>
              Change Profile Image
            </Link>
          </div>

          {/* EMPLOYEE DETAILS */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Employee details</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">First name</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900">
                  {firstName}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Last name</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900">
                  {lastName}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Email</label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900">
                    {employee.email || "—"}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(employee.email, "Email")}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600"
                    title="Copy email"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m2 4a2 2 0 01-2 2h-2m-4-2H8" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m0 0v-8m0 0h4" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Phone</label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900">
                    {employee.telephone || "—"}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(employee.telephone || "", "Phone")}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-sky-600"
                    title="Copy phone"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m2 4a2 2 0 01-2 2h-2m-4-2H8" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m0 0v-8m0 0h4" />
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Position</label>
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900">
                  {position}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Onboarding</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Starts on</label>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-slate-900">
                    {formatDate(employee.hire_date)}
                  </div>
                  <span className="text-slate-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">Onboarding required</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onboardingRequired}
                  onClick={() => setOnboardingRequired((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${
                    onboardingRequired ? "bg-slate-900" : "bg-slate-200"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                      onboardingRequired ? "translate-x-5" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-600">Current status</label>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ${
                      statusLabel === "Active"
                        ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                        : "bg-slate-100 text-slate-600 ring-slate-200/80"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <div className="min-w-[120px] flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${onboardingProgress}%` }}
                      />
                    </div>
                    <span className="mt-1 block text-xs text-slate-500">{onboardingProgress}%</span>
                  </div>
                </div>
              </div>
              <button type="button" className="text-sm font-medium text-sky-600 hover:text-sky-800">
                View answers
              </button>
            </div>
          </div>
      </div>
    </AdminNavbar>
  );
}

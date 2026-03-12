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
      <AdminNavbar title="Employee Detail">
        <div className="p-6 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-500">Loading...</p>
        </div>
      </AdminNavbar>
    );
  }

  if (error || !employee) {
    return (
      <AdminNavbar title="Employee Detail">
        <div className="p-6">
          <p className="text-red-600 mb-4">{error || "Employee not found"}</p>
          <Link href="/admin/employees" className="text-blue-600 hover:underline">
            ← Back to Employees
          </Link>
        </div>
      </AdminNavbar>
    );
  }

  const { firstName, lastName } = splitName(employee.full_name || "");
  const position = employee.role === "admin" ? "Admin" : "Employee";
  const statusLabel = employee.is_active ? "Active" : "Inactive";

  return (
    <AdminNavbar title="Employee Detail">
      <div className="p-6">
        <div className="mb-6">
          <Link href="/admin/employees" className="text-blue-600 hover:underline text-sm">
            ← Back to Employees
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {/* PROFILE IMAGE */}
          <div className="flex flex-col items-center">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 w-full text-left">
              Profile Image
            </h3>
            <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
              {employee.profile_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getImageSrc(employee.profile_image)}
                  alt={employee.full_name || "Employee"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-4xl font-semibold text-gray-400">
                  {(employee.full_name || "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <Link
              href={`/admin/employees?edit=${employee.id}`}
              className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium inline-flex items-center gap-1"
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
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Employee Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                  {firstName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                  {lastName}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email Address</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                    {employee.email || "—"}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(employee.email, "Email")}
                    className="p-2 text-gray-500 hover:text-blue-600 rounded"
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
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone Number</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                    {employee.telephone || "—"}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(employee.telephone || "", "Phone")}
                    className="p-2 text-gray-500 hover:text-blue-600 rounded"
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
                <label className="block text-sm font-medium text-gray-600 mb-1">Position</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                  {position}
                </div>
              </div>
            </div>
          </div>

          {/* ONBOARDING */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Onboarding
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Starts on</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-gray-800 border border-gray-200">
                    {formatDate(employee.hire_date)}
                  </div>
                  <span className="text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Onboarding required</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={onboardingRequired}
                  onClick={() => setOnboardingRequired((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    onboardingRequired ? "bg-blue-600" : "bg-gray-200"
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
                <label className="block text-sm font-medium text-gray-600 mb-2">Current Status</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-full ${
                      statusLabel === "Active" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <div className="flex-1 min-w-[120px]">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${onboardingProgress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 mt-1 block">{onboardingProgress}%</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                View Answers
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminNavbar>
  );
}

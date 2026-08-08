"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { usersAPI } from "../../utils/api";
import { getAccountSettingsMenu } from "../../utils/accountSettingsMenu";

function clearLocalSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("user");
  localStorage.removeItem("userRole");
  window.dispatchEvent(new Event("loginStatusChanged"));
}

export default function DeleteAccount() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const menuItems = getAccountSettingsMenu("/delete-account");

  const openConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Enter your password to continue.");
      return;
    }
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      await usersAPI.requestAccountDeletion(password);
      clearLocalSession();
      toast.success(
        "Your account will be deleted after a 30-day period. You have been logged out."
      );
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to schedule account deletion.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 rounded-sm border border-gray-200 bg-white/80 px-5 py-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Area</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Delete Account</h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Permanently remove your account after a 30-day waiting period.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <aside className="h-fit w-full shrink-0 self-start rounded-sm border border-gray-200 bg-white p-4 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] lg:w-72 lg:p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Settings</h2>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group block w-full border-l-2 px-3 py-2.5 text-sm transition-all ${
                    item.active
                      ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-800 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.5)]"
                      : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    {item.label}
                    <span className="text-gray-400 group-hover:text-gray-600">›</span>
                  </span>
                </Link>
              ))}
            </nav>
          </aside>

          <section className="min-w-0 flex-1 rounded-sm border border-gray-200 bg-white p-5 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] sm:p-6">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">Delete My Account</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your account and personal data are scheduled for deletion after 30 days. During that
              time you can log in only to cancel deletion. After 30 days, personal data is removed
              and the account cannot be recovered.
            </p>

            <form onSubmit={openConfirm} className="mt-6 max-w-md space-y-4">
              <div>
                <label htmlFor="delete-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Confirm with password
                </label>
                <div className="relative">
                  <input
                    id="delete-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-sm border border-gray-300 px-3 py-2.5 pr-12 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="rounded-sm bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                Delete My Account
              </button>
            </form>
          </section>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-sm border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Are you sure?</h3>
            <p className="mt-2 text-sm text-gray-600">
              Your account will be deleted after a 30 days period and you will be logged out
              immediately. You can cancel during that period by logging back in.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Keep my account
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="rounded-sm bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {submitting ? "Scheduling…" : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

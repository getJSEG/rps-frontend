"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import AdminNavbar from "../../components/AdminNavbar";
import { usersAPI } from "../../../utils/api";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).+$/;

export default function AdminSettingsPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated() || !canAccessAdminPanel()) {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      toast.error("Password must include at least one uppercase letter and one number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    try {
      setSaving(true);
      await usersAPI.changePassword(newPassword);
      toast.success("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminNavbar
      title="Admin Settings"
      subtitle="Update your admin account password."
    >
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold text-slate-900">Change Password</h2>
        <p className="mt-1 text-sm text-slate-600">
          Use a strong password that you do not use on other websites.
        </p>
        <p className="mt-1 text-xs text-red-600">
          Rule: minimum 6 characters, at least 1 uppercase letter, and at least 1 number.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              New Password
            </span>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
                placeholder="At least 6 characters"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-700"
                aria-label={showNew ? "Hide new password" : "Show new password"}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
              Confirm New Password
            </span>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
                placeholder="Re-enter password"
                className="w-full rounded-md border border-slate-300 px-3 py-2.5 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-700"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">You are changing the current admin account password.</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-w-36 items-center justify-center rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Update Password"}
            </button>
          </div>
        </form>
      </section>
    </AdminNavbar>
  );
}


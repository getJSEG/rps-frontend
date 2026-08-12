"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authAPI } from "../../utils/api";
import { toast } from "react-toastify";

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).+$/;

const EyeIcon = ({ show }: { show: boolean }) =>
  show ? (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );

const LockIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white py-2.5 pl-3 pr-11 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#0B6BCB] focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600";

export default function ResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Kept in memory for the lifetime of the page only - never persisted to storage.
  const token = (searchParams.get("token") || "").trim();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [linkRejected, setLinkRejected] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      toast.error("New password must include at least one uppercase letter and one number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      setSaving(true);
      const res = await authAPI.resetPassword(token, newPassword);
      toast.success(res?.message || "Password reset successfully.");
      router.push("/");
    } catch (err) {
      const message = (err instanceof Error && err.message) || "Failed to reset password.";
      if (/invalid|expired/i.test(message)) setLinkRejected(true);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (!token || linkRejected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-24 pb-16">
        <div className="mx-auto w-full max-w-md px-4 sm:px-6">
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-8 text-center shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)] sm:px-8">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Link no longer valid</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
              This reset link is invalid or has expired. Reset links last 30 minutes and can only be used once.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-block w-full rounded-md bg-[#0B6BCB] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              Request a new link
            </Link>
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">
                Remembered your password?{" "}
                <Link href="/" className="font-semibold text-[#0B6BCB] hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-24 pb-16">
      <div className="mx-auto w-full max-w-md px-4 sm:px-6">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)]">
          <div className="border-b border-gray-100 bg-white px-6 py-6 text-center sm:px-8">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0B6BCB]">
              <LockIcon />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Access</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-gray-900">Reset Password</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
              Choose a new password for your account.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="new-password" className={labelClass}>
                  New password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    minLength={6}
                    className={inputClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    <EyeIcon show={showNew} />
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Must include at least one uppercase letter and one number.
                </p>
              </div>

              <div>
                <label htmlFor="confirm-password" className={labelClass}>
                  Confirm password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    minLength={6}
                    className={inputClass}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    <EyeIcon show={showConfirm} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-[#0B6BCB] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Reset password"}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-100 pt-4 text-center">
              <p className="text-sm text-gray-600">
                Remembered your password?{" "}
                <Link href="/" className="font-semibold text-[#0B6BCB] hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">
          For your security, this link expires 30 minutes after it was requested.
        </p>
      </div>
    </div>
  );
}

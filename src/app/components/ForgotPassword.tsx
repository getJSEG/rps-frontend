"use client";

import { useState } from "react";
import Link from "next/link";
import { authAPI } from "../../utils/api";
import { toast } from "react-toastify";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Please enter your email address.");
      return;
    }
    try {
      setSending(true);
      const res = await authAPI.forgotPassword(trimmed);
      setSent(true);
      toast.success(res?.message || "Check your email for a link to reset your password.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(message || "Could not send the reset link. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-24 pb-16">
      <div className="mx-auto w-full max-w-md px-4 sm:px-6">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)]">
          <div className="border-b border-gray-100 bg-white px-6 py-6 text-center sm:px-8">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#0B6BCB]">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Access</p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-gray-900">Forgot Password</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {sent && (
              <div
                className="mb-5 flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                role="status"
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Please check your email for a link to reset your password.</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600"
                >
                  Email address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="w-full rounded-md border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#0B6BCB] focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-md bg-[#0B6BCB] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send reset link"}
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
          For your security, the reset link expires in 30 minutes and can only be used once.
        </p>
      </div>
    </div>
  );
}

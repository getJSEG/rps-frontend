"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authAPI } from "../../utils/api";
import { toast } from "react-toastify";

type Step = "email" | "code";

export default function ChangePassword() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Pre-fill email from logged-in user
  useEffect(() => {
    if (typeof window === "undefined") return;
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user?.email) setEmail(user.email);
      } catch {}
    }
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Please enter your email.");
      return;
    }
    try {
      setSendingCode(true);
      const res = await authAPI.sendResetCode(trimmed) as { message?: string; code?: string; devMode?: boolean };
      if (res?.devMode && res?.code) {
        setCode(res.code);
        toast.success(`Use this code: ${res.code} (email not configured)`);
      } else {
        toast.success("Code sent to your email. Check your inbox.");
      }
      setStep("code");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send code.");
    } finally {
      setSendingCode(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedCode = code.replace(/\D/g, "").trim();
    if (!trimmedEmail || !trimmedCode) {
      toast.error("Email and code are required.");
      return;
    }
    if (trimmedCode.length !== 6) {
      toast.error("Code must be 6 digits.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      setResetting(true);
      await authAPI.resetPasswordWithCode(trimmedEmail, trimmedCode, newPassword);
      toast.success("Password changed. You can now log in.");
      router.push("/");
    } catch (err: any) {
      toast.error(err?.message || "Failed to change password.");
    } finally {
      setResetting(false);
    }
  };

  const menuItems = [
    { label: "Account Settings", href: "/account-settings" },
    { label: "Change Password", href: "/change-password", active: true },
    { label: "Reseller Permit", href: "/reseller-permit" },
    { label: "Credit Cards", href: "/credit-cards" },
    { label: "Your Default Address", href: "/address-book" },
  ];

  const EyeIcon = ({ show }: { show: boolean }) => (
    show ? (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
    ) : (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
    )
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 rounded-sm border border-gray-200 bg-white/80 px-5 py-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Area</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Change Password</h1>
          <p className="mt-1.5 text-sm text-gray-600">
            A verification code will be sent to your email. Enter the code and set a new password.
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
                  <span className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="text-[10px] text-gray-300 transition-colors group-hover:text-gray-400">&gt;</span>
                  </span>
                </Link>
              ))}
            </nav>
          </aside>

          <main className="flex-1 rounded-sm border border-gray-200 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)] sm:p-7">
            <div className="mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Change Password</h2>
              <p className="mt-1 text-sm text-gray-600">
                A code will be sent to your email. Enter the code and your new password below.
              </p>
            </div>

            {step === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-6 max-w-2xl">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your registered email"
                    className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    required
                  />
                </div>
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={sendingCode}
                    className="inline-flex min-w-40 items-center justify-center rounded-sm bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sendingCode ? "Sending…" : "Send code to email"}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="mb-6 rounded-sm border border-blue-100 bg-blue-50/80 px-3 py-3 text-sm text-gray-700">
                  Code sent to <strong>{email}</strong>. Check your email and enter the 6-digit code below.
                </div>
                <form onSubmit={handleResetPassword} className="space-y-6 max-w-2xl">
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Email</label>
                    <input type="email" value={email} readOnly className="w-full rounded-sm border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600" />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                      Code from email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      maxLength={6}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 font-mono text-lg tracking-widest text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                      New password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        minLength={6}
                        className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                        required
                      />
                      <button type="button" onClick={() => setShowNew((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1" tabIndex={-1} aria-label={showNew ? "Hide password" : "Show password"}>
                        <EyeIcon show={showNew} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                      Confirm new password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        minLength={6}
                        className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                        required
                      />
                      <button type="button" onClick={() => setShowConfirm((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1" tabIndex={-1} aria-label={showConfirm ? "Hide password" : "Show password"}>
                        <EyeIcon show={showConfirm} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep("email")}
                      className="rounded-sm border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Use different email
                    </button>
                    <button
                      type="submit"
                      disabled={resetting}
                      className="inline-flex min-w-40 items-center justify-center rounded-sm bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resetting ? "Updating…" : "Change password"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

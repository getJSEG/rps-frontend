"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import { authAPI } from "../../utils/api";

/** Only same-site paths are allowed after login, never another site or the login page itself. */
export function safeNextPath(raw: string | null | undefined): string | null {
  const next = String(raw ?? "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/login")) return null;
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    // Already signed in: nothing to do here.
    if (localStorage.getItem("isLoggedIn") === "true" && localStorage.getItem("token")) {
      router.replace(nextPath ?? "/");
      return;
    }
    // Email typed during registration, so the customer doesn't have to type it again.
    const registeredEmail = localStorage.getItem("registeredEmail");
    if (registeredEmail) setEmail(registeredEmail);
  }, [router, nextPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    try {
      setSigningIn(true);
      const response = await authAPI.login(trimmedEmail, password);
      if (!response?.token) throw new Error("Invalid email or password");

      localStorage.setItem("token", response.token);
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("user", JSON.stringify(response.user));
      if (response.user?.role) localStorage.setItem("userRole", response.user.role);
      localStorage.removeItem("registeredEmail");
      localStorage.removeItem("registeredPassword");
      window.dispatchEvent(new Event("loginStatusChanged"));
      toast.success("Login successful!");

      if (response.user?.pendingDeletion) {
        router.push("/account-pending-deletion");
        return;
      }
      const isAdmin = String(response.user?.role || "").toLowerCase() === "admin";
      router.push(nextPath ?? (isAdmin ? "/admin/reports" : "/"));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Invalid email or password");
    } finally {
      setSigningIn(false);
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
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-gray-900">Sign In</h1>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-600">
              Welcome back! Sign in to your account to continue.
            </p>
          </div>

          <div className="px-6 py-6 sm:px-8">
            {error && (
              <div
                className="mb-5 flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                role="alert"
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="login-email"
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
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="w-full rounded-md border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#0B6BCB] focus:ring-2 focus:ring-blue-100"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                  <Link href="/forgot-password" className="text-xs font-medium text-[#0B6BCB] hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.8}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="Your password"
                    autoComplete="current-password"
                    className="w-full rounded-md border border-gray-300 bg-white py-2.5 pl-10 pr-11 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#0B6BCB] focus:ring-2 focus:ring-blue-100"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={signingIn}
                className="w-full rounded-md bg-[#0B6BCB] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingIn ? "Signing in…" : "Sign In"}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-100 pt-4 text-center">
              <p className="text-sm text-gray-600">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-semibold text-[#0B6BCB] hover:underline">
                  Register
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

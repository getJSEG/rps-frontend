"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { authAPI } from "../../utils/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("registeredEmail") || "";
    }
    return "";
  });
  
  const [password, setPassword] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("registeredPassword") || "";
    }
    return "";
  });
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Clear registered credentials after component mounts (they're already used)
  useEffect(() => {
    // Keep them for a bit so user can see them, then clear after login or after some time
    const timer = setTimeout(() => {
      // Only clear if user is not logged in
      if (localStorage.getItem("isLoggedIn") !== "true") {
        // Keep them visible for now, user might want to login
      }
    }, 5000); // Clear after 5 seconds if not used

    return () => clearTimeout(timer);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      const msg = "Please enter email and password";
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await authAPI.login(email, password);

      if (response.token) {
        localStorage.setItem("token", response.token);
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("user", JSON.stringify(response.user));
        if (response.user?.role) {
          localStorage.setItem("userRole", response.user.role);
        }
        localStorage.removeItem("registeredEmail");
        localStorage.removeItem("registeredPassword");
        window.dispatchEvent(new Event("loginStatusChanged"));
        toast.success("Login successful!");
        const role = (response.user?.role || "").toString().toLowerCase();
        if (role === "admin") {
          router.push("/admin/reports");
        } else {
          router.push("/");
        }
      }
    } catch (err: any) {
      const msg = err.message || "Login failed. Please check your credentials.";
      setError(msg);
      toast.error(msg);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-[#243c55]">
      {/* Left Section - Information */}
      <div className="hidden md:flex flex-1 items-center justify-center">
        <div className="flex flex-col gap-4 text-white text-start">
          <p className="text-3xl">Resource Print Solution </p>
          <p className="text-3xl">Specializing in Grand Format Production</p>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h2 className="text-white text-bold font size-2xl text-md mb-3">Sign in </h2>
          
          <div className="space-y-4">
            {/* Email Input */}
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Email"
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-lg bg-gray-200 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-gray-600 hover:text-gray-800 p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
                <a
                  href="#"
                  className="text-[#1986b1] hover:text-blue-300 text-sm"
                >
                  Forgot?
                </a>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Sign In Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full text-md bg-[#1986b1] text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Member Sign In"}
            </button>

            {/* Create Account Section */}
            <div className="text-center space-y-4">
              <p className="text-[#ddd] text-md">Don't have an account?</p>
              <a
                href="/register"
                className="block w-full  text-md bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-6 rounded-lg transition-colors text-center"
              >
                Create Account
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


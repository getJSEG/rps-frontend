"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  IoPersonCircleOutline,
  IoSettingsOutline,
  IoKeyOutline,
  IoBookOutline,
  IoLogOutOutline,
  IoImageOutline,
  IoMenu,
  IoClose,
} from "react-icons/io5";
import { toast } from "react-toastify";
import { ordersAPI } from "../../utils/api";
import {
  buildPendingUploadJobsFromOrders,
  type UploadApprovalOrderRow,
} from "../../utils/uploadApprovalPending";

type Category = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
};

function readCachedNavbarCategories(): Category[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("navbarCategories");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is Category =>
        c &&
        typeof c === "object" &&
        typeof c.id === "number" &&
        typeof c.name === "string" &&
        typeof c.slug === "string" &&
        (c.parent_id === null || typeof c.parent_id === "number")
    );
  } catch {
    return [];
  }
}

function getDisplayNameFromUser(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  const u = user as Record<string, unknown>;
  const candidates = [u.fullName, u.full_name, u.name, u.firstName, u.email];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/**
 * Badge count for the cart icon.
 * - One cart row = one card on /cart. For print jobs, `quantity` is often the sum of all job
 *   quantities (e.g. 5 jobs × qty 1 → quantity 5), which inflated the badge vs. one card.
 * - If the row has a `jobs` array (multi-job configuration), count that row as 1.
 * - Otherwise use `quantity` (simple lines with a single line qty).
 */
function cartBadgeCount(items: unknown[]): number {
  if (!Array.isArray(items) || items.length === 0) return 0;
  let sum = 0;
  for (const raw of items) {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    if (!row) continue;
    const jobs = row.jobs;
    if (Array.isArray(jobs) && jobs.length > 0) {
      sum += 1;
      continue;
    }
    const q = row.quantity;
    const n = q != null && q !== "" ? Number(q) : NaN;
    if (Number.isFinite(n) && n > 0) sum += n;
    else sum += 1;
  }
  return sum > 0 ? sum : items.length;
}

function CartIconLink({ count }: { count: number }) {
  const label = count > 0 ? `Shopping cart, ${count} items` : "Shopping cart";
  return (
    <Link
      href="/cart"
      className="relative inline-flex shrink-0 items-center justify-center overflow-visible p-1.5 text-blue-400 transition-colors hover:text-blue-500"
      style={{ WebkitTapHighlightColor: "transparent" }}
      aria-label={label}
    >
      <span className="relative inline-flex h-6 w-6 items-center justify-center">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-xs font-bold text-white shadow-sm">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Pages that should not be returned to after signing in. */
const NO_RETURN_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // SSR + first client render must match — never read localStorage in useState initializers.
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const didInitialCartFetchRef = useRef(false);
  const loginCheckInvocationRef = useRef(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [uploadPendingDot, setUploadPendingDot] = useState(false);

  // Cart count from API (JWT or guest X-Guest-Session-Id)
  const updateCartCount = async () => {
    if (typeof window !== "undefined") {
      try {
        const { cartAPI } = await import("../../utils/api");
        const res = await cartAPI.get();
        const items = Array.isArray(res?.cartItems) ? res.cartItems : [];
        const next = cartBadgeCount(items);
        setCartCount(next);
        localStorage.setItem("cartCount", String(next));
      } catch {
        // Keep previous/cached badge when cart endpoint is temporarily unavailable.
      }
    }
  };

  // Check login status on mount and listen for changes
  useEffect(() => {
    const checkLoginStatus = () => {
      loginCheckInvocationRef.current += 1;
      if (loginCheckInvocationRef.current > 1) {
        void updateCartCount();
      }
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      setIsLoggedIn(loggedIn);

      if (loggedIn) {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            setUserName(getDisplayNameFromUser(user));
          } catch (e) {
            console.error("Error parsing user data:", e);
          }
        }
      } else {
        setUserName("");
      }
    };

    checkLoginStatus();
    if (!didInitialCartFetchRef.current) {
      didInitialCartFetchRef.current = true;
      try {
        const cached = localStorage.getItem("cartCount");
        const parsed = cached != null ? Number(cached) : NaN;
        if (Number.isFinite(parsed) && parsed >= 0) setCartCount(parsed);
      } catch {
        /* ignore */
      }
      void updateCartCount();
    }

    // Listen for custom login status change event
    window.addEventListener("loginStatusChanged", checkLoginStatus);

    window.addEventListener("cartUpdated", updateCartCount);

    // Also listen for storage changes (when login happens in another tab/window)
    const onStorageChange = () => {
      checkLoginStatus();
      void updateCartCount();
    };
    window.addEventListener("storage", onStorageChange);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void updateCartCount();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("loginStatusChanged", checkLoginStatus);
      window.removeEventListener("cartUpdated", updateCartCount);
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);

  // Close the mobile menu after navigating.
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  /** Red dot on Upload when the same pending jobs exist as on /upload-approval. */
  useEffect(() => {
    if (!isLoggedIn) {
      setUploadPendingDot(false);
      return;
    }
    let cancelled = false;
    const refreshUploadPending = async () => {
      try {
        const res = (await ordersAPI.getAll({ limit: 50, page: 1 })) as {
          orders?: UploadApprovalOrderRow[];
        };
        const list = Array.isArray(res?.orders) ? res.orders : [];
        const n = buildPendingUploadJobsFromOrders(list).length;
        if (!cancelled) setUploadPendingDot(n > 0);
      } catch {
        if (!cancelled) setUploadPendingDot(false);
      }
    };
    void refreshUploadPending();
    const onFocus = () => void refreshUploadPending();
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshUploadPending();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isLoggedIn, pathname]);

  useEffect(() => {
    const cached = readCachedNavbarCategories();
    if (cached.length > 0) {
      setCategories(cached);
    }
    let mounted = true;
    const loadCategories = async () => {
      try {
        const { productsAPI } = await import("../../utils/api");
        const res = await productsAPI.getCategories();
        const nextCategories = Array.isArray(res?.categories) ? res.categories : [];
        if (!mounted) return;
        setCategories(nextCategories);
        if (typeof window !== "undefined") {
          localStorage.setItem("navbarCategories", JSON.stringify(nextCategories));
          window.dispatchEvent(new Event("navbarCategoriesUpdated"));
        }
      } catch {
        if (!mounted) return;
        setCategories((prev) => (prev.length > 0 ? prev : []));
      }
    };
    void loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  /** Sign In opens the login page, which brings the customer back to `path` afterwards. */
  const loginHrefFor = (path: string) => {
    if (!pathname || pathname === "/" || NO_RETURN_PATHS.some((p) => pathname.startsWith(p))) return "/login";
    return `/login?next=${encodeURIComponent(path)}`;
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    setIsLoggedIn(false);
    setUserName("");
    setIsUserDropdownOpen(false);
    window.dispatchEvent(new Event("loginStatusChanged"));
    // Show toast before navigation so it mounts; ToastContainer lives in the root layout.
    toast.success("Logged out successfully.", { autoClose: 3000 });
    if (typeof window !== "undefined" && window.location.pathname !== "/") {
      // Brief delay so the toast is painted before the route change.
      window.setTimeout(() => {
        router.push("/");
      }, 50);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isUserDropdownOpen || isSearchOpen || isMobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserDropdownOpen, isSearchOpen, isMobileMenuOpen]);

  // Keep only the first 7 parent categories (preserve API order = "first created").
  const parentCategories = categories.filter((c) => c.parent_id == null);
  const navbarParentCategories = parentCategories.slice(0, 7);
  const categoryVisibilityClasses = [
    "min-[1080px]:inline-flex",
    "min-[1160px]:inline-flex",
    "min-[1240px]:inline-flex",
    "min-[1320px]:inline-flex",
    "min-[1400px]:inline-flex",
    "min-[1480px]:inline-flex",
    "min-[1560px]:inline-flex",
  ];
  
  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 nav-bg border-b border-slate-200 shadow-sm z-50 transition-transform duration-300 pt-[max(0px,env(safe-area-inset-top))] ${
          // Guests on phones need overflow visible so the burger card can slide out below the bar.
          isLoggedIn ? "overflow-visible" : "overflow-visible sm:overflow-hidden"
    }`}
      >
        <div className="mx-auto w-full max-w-full px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            {/* Left Section - Logo and White Label */}
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/" className="flex items-center">
                {/* Guests on phones get a slightly smaller logo so burger + cart fit. */}
                <Image
                  src="/rps-logo.png"
                  alt="Logo"
                  width={160}
                  height={40}
                  className={`w-auto rounded-lg object-contain ${!isLoggedIn ? "h-8 sm:h-10" : "h-8 md:h-10"}`}
                  priority
                />
              </Link>
            </div>

            {/* Middle Section - Navigation Links */}
            <div
              className="hidden lg:flex items-center gap-1 flex-1 justify-center"
            >
              <div className="flex items-center gap-0.5 whitespace-nowrap relative">
                <Link
                  href="/products"
                  className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-sm font-normal transition-colors px-2 py-1 rounded-sm"
                >
                  All Products
                </Link>
              </div>
              {navbarParentCategories.map((category, index) => {
                const categorySlug = category.slug || category.name.toLowerCase().replace(/\s+/g, "-");
                return (
                  <Link
                    key={category.id}
                    href={`/products/${encodeURIComponent(categorySlug)}`}
                    className={`hidden ${categoryVisibilityClasses[index]} items-center text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-sm font-normal transition-colors px-2 py-1 rounded-sm whitespace-nowrap`}
                  >
                    {category.name}
                  </Link>
                );
              })}
            </div>

            {/* Right Section - Login Form or User Actions */}
            {!isLoggedIn ? (
              <div className="ml-auto flex flex-none shrink-0 items-center gap-2">
                <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href={loginHrefFor(pathname || "/")}
                  onClick={(e) => {
                    // Keep the query too (e.g. ?productId=2), which usePathname leaves out.
                    e.preventDefault();
                    router.push(loginHrefFor(window.location.pathname + window.location.search));
                  }}
                  className="bg-[#0B6BCB] hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-sm font-semibold transition-colors whitespace-nowrap border border-[#0B6BCB] sm:px-4"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-sm text-sm font-semibold transition-colors whitespace-nowrap inline-block text-center border border-red-500 sm:px-4"
                >
                  Register
                </Link>
                </div>
                <CartIconLink count={cartCount} />
                <div className="relative sm:hidden" ref={mobileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen((o) => !o)}
                    aria-expanded={isMobileMenuOpen}
                    aria-controls="guest-mobile-menu"
                    aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                    className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {isMobileMenuOpen ? <IoClose className="h-6 w-6" /> : <IoMenu className="h-6 w-6" />}
                  </button>

                  {/* Guest mobile menu: small card under the burger */}
                  <div
                      id="guest-mobile-menu"
                      aria-hidden={!isMobileMenuOpen}
                      className={`absolute right-0 top-full z-50 mt-3 w-52 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 transition-all duration-200 ease-out ${
                        isMobileMenuOpen
                          ? "visible translate-y-0 opacity-100"
                          : "pointer-events-none invisible -translate-y-2 opacity-0"
                      }`}
                    >
                      <Link
                        href={loginHrefFor(pathname || "/")}
                        onClick={(e) => {
                          e.preventDefault();
                          setIsMobileMenuOpen(false);
                          router.push(loginHrefFor(window.location.pathname + window.location.search));
                        }}
                        className="block w-full rounded-sm border border-[#0B6BCB] bg-[#0B6BCB] px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/register"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block w-full rounded-sm border border-red-500 bg-red-500 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-red-600"
                      >
                        Register
                      </Link>
                    </div>
                </div>
              </div>
            ) : (
              <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 md:gap-4">
                {/* Full bar (768px and up); phones use the burger card below. */}
                <div className="hidden items-center gap-4 md:flex">
                {/* Search Icon */}
                <div className="relative" ref={searchRef}>
                  <button
                    onClick={() => setIsSearchOpen(!isSearchOpen)}
                    className="text-gray-700 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>

                  {/* Search Dropdown */}
                  {isSearchOpen && (
                    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                      {/* Search Bar - submits to /products with search + category/subcategory */}
                      <form
                        className="p-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const q = searchQuery.trim();
                          if (!q) return;
                          setIsSearchOpen(false);
                          router.push(`/products?search=${encodeURIComponent(q)}`);
                          setSearchQuery("");
                        }}
                      >
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products, categories, subcategories..."
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            autoFocus
                          />
                          <button type="submit" className="bg-[#0B6BCB] hover:bg-[#0B6BCB] text-white px-4 py-2 rounded-lg transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                <Link
                  href="/upload-approval"
                  className="relative inline-flex items-center text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors"
                  aria-label={uploadPendingDot ? "Upload (pending artwork or approval)" : "Upload"}
                >
                  Upload
                  {uploadPendingDot ? (
                    <span
                      className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500 shadow-sm ring-2 ring-white"
                      aria-hidden
                    />
                  ) : null}
                </Link>

                <Link href="/orders" className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors">
                  Orders
                </Link>

                {/* User Name or Estimate */}
                {isLoggedIn && userName ? (
                  <span className="text-gray-700 text-sm font-medium">
                    {userName}
                  </span>
                ) : (
                <Link href="/estimates" className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors">
                  Estimate
                </Link>
                )}

                {/* User Profile Icon */}
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className={`text-blue-400 hover:text-blue-500 transition-colors  rounded-lg ${
                      isUserDropdownOpen ? "bg-gray-200" : ""
                    }`}
                  >
                    <IoPersonCircleOutline className="w-7 h-7"/>
                  </button>

                  {/* User Dropdown Menu */}
                  {isUserDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-max max-w-[92vw] rounded-md border border-slate-300 bg-white shadow-lg shadow-slate-900/10 z-50">
                      {/* Menu Options */}
                      <div className="px-2.5 py-2">
                        <div className="space-y-0.5">
                          <Link href="/account-settings" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoSettingsOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Account Settings
                          </Link>
                          <Link href="/change-password" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoKeyOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Change Password
                          </Link>
                          {/* Credit cards page disabled — checkout uses Stripe only. */}
                          {/* Messages section disabled. */}
                          <Link href="/address-book" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoBookOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Address Book
                          </Link>
                          <Link href="/my-artworks" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoImageOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            My Artworks
                          </Link>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="mt-1 flex w-full justify-center gap-3 rounded-sm border border-red-500 bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:border-red-600 hover:bg-red-600"
                          >
                            <IoLogOutOutline className="h-5 w-5 shrink-0 text-white " aria-hidden />
                            Logout
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>

                <CartIconLink count={cartCount} />

                {/* Logged-in mobile menu (below 768px) */}
                <div className="relative md:hidden" ref={mobileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen((o) => !o)}
                    aria-expanded={isMobileMenuOpen}
                    aria-controls="user-mobile-menu"
                    aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                    className="relative inline-flex items-center justify-center rounded-md p-1.5 text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    {isMobileMenuOpen ? <IoClose className="h-6 w-6" /> : <IoMenu className="h-6 w-6" />}
                    {uploadPendingDot && !isMobileMenuOpen ? (
                      <span
                        className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
                        aria-hidden
                      />
                    ) : null}
                  </button>

                  <div
                    id="user-mobile-menu"
                    aria-hidden={!isMobileMenuOpen}
                    className={`absolute right-0 top-full z-50 mt-3 w-max min-w-[13rem] max-w-[80vw] rounded-lg border border-slate-200 bg-white p-2 shadow-lg shadow-slate-900/10 transition-all duration-200 ease-out ${
                      isMobileMenuOpen
                        ? "visible translate-y-0 opacity-100"
                        : "pointer-events-none invisible -translate-y-2 opacity-0"
                    }`}
                  >
                    <div className="border-b border-slate-100 px-2 pb-2 pt-1">
                      {userName ? (
                        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gray-900">
                          <IoPersonCircleOutline className="h-6 w-6 shrink-0 text-blue-400" aria-hidden />
                          <span className="truncate">{userName}</span>
                        </span>
                      ) : (
                        <Link
                          href="/estimates"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                          Estimate
                        </Link>
                      )}
                    </div>

                    <div className="space-y-0.5 border-b border-slate-100 py-2">
                      <Link
                        href="/upload-approval"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-slate-100 hover:text-gray-900"
                        aria-label={uploadPendingDot ? "Upload (pending artwork or approval)" : "Upload"}
                      >
                        Upload
                        {uploadPendingDot ? (
                          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        ) : null}
                      </Link>
                      <Link
                        href="/orders"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block rounded-sm px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-slate-100 hover:text-gray-900"
                      >
                        Orders
                      </Link>
                    </div>

                    <div className="space-y-0.5 border-b border-slate-100 py-2">
                      <Link href="/account-settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800">
                        <IoSettingsOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                        Account Settings
                      </Link>
                      <Link href="/change-password" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800">
                        <IoKeyOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                        Change Password
                      </Link>
                      <Link href="/address-book" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800">
                        <IoBookOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                        Address Book
                      </Link>
                      <Link href="/my-artworks" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800">
                        <IoImageOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                        My Artworks
                      </Link>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          handleLogout();
                        }}
                        className="flex w-full justify-center gap-3 rounded-sm border border-red-500 bg-red-500 px-4 py-2 text-sm text-white transition-colors hover:border-red-600 hover:bg-red-600"
                      >
                        <IoLogOutOutline className="h-5 w-5 shrink-0 text-white" aria-hidden />
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

    </>
  );
}


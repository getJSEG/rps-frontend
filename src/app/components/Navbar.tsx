"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  IoPersonCircleOutline,
  IoSettingsOutline,
  IoKeyOutline,
  IoCardOutline,
  IoMailOutline,
  IoBookOutline,
  IoLogOutOutline,
} from "react-icons/io5";
import { toast } from "react-toastify";

function shouldDisableScrollNavbar(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === "/checkout" || pathname === "/cart" || pathname === "/orders" || pathname === "/products") return true;
  if (pathname.startsWith("/products/product-detail") || pathname.startsWith("/products/product/")) return true;
  return false;
}

function shouldSkipCartApiForPathname(pathname: string): boolean {
  if (!pathname) return false;
  const skipPrefixes = [
    "/account-settings",
    "/change-password",
    "/credit-cards",
    "/messages",
    "/address-book",
    "/claims",
    "/favorite-jobs",
    "/pending-payment",
  ];
  return skipPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

type Category = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
};

type NavbarProps = {
  cartCountOverride?: number;
  skipCartCountFetch?: boolean;
};

function getDisplayNameFromUser(user: any): string {
  if (!user || typeof user !== "object") return "";
  const candidates = [user.fullName, user.full_name, user.name, user.firstName, user.email];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export default function Navbar({ cartCountOverride, skipCartCountFetch = false }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const disableScrollBehavior = shouldDisableScrollNavbar(pathname ?? "");
  const effectiveSkipCartCountFetch = skipCartCountFetch || shouldSkipCartApiForPathname(pathname ?? "");
  const [isVisible, setIsVisible] = useState(disableScrollBehavior);
  const lastScrollYRef = useRef(0);
  const [openCategoryId, setOpenCategoryId] = useState<number | null>(null);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [cartCount, setCartCount] = useState(0);
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
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const categoryCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialCartFetchRef = useRef(false);
  const effectiveCartCount = typeof cartCountOverride === "number" ? cartCountOverride : cartCount;
  const [categories, setCategories] = useState<Category[]>([]);

  // Cart count from API (JWT or guest X-Guest-Session-Id)
  const updateCartCount = async () => {
    if (typeof window !== "undefined") {
      try {
        const { cartAPI } = await import("../../utils/api");
        const res = await cartAPI.get();
        const items = Array.isArray(res?.cartItems) ? res.cartItems : [];
        setCartCount(items.length);
      } catch {
        setCartCount(0);
      }
    }
  };

  // Check login status on mount and listen for changes
  useEffect(() => {
    const checkLoginStatus = () => {
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
      
      // Update email and password from localStorage if available (from registration)
      const registeredEmail = localStorage.getItem("registeredEmail");
      const registeredPassword = localStorage.getItem("registeredPassword");
      if (registeredEmail) {
        setEmail(registeredEmail);
      }
      if (registeredPassword) {
        setPassword(registeredPassword);
      }
    };

    checkLoginStatus();
    if (!effectiveSkipCartCountFetch && !didInitialCartFetchRef.current) {
      didInitialCartFetchRef.current = true;
      updateCartCount(); // Initial cart count
    }

    // Listen for custom login status change event
    window.addEventListener("loginStatusChanged", checkLoginStatus);
    
    // Listen for cart updates
    if (!effectiveSkipCartCountFetch) {
      window.addEventListener("cartUpdated", updateCartCount);
    }

    // Also listen for storage changes (when login happens in another tab/window)
    const onStorageChange = () => {
      checkLoginStatus();
      if (!effectiveSkipCartCountFetch) updateCartCount();
    };
    window.addEventListener("storage", onStorageChange);

    return () => {
      window.removeEventListener("loginStatusChanged", checkLoginStatus);
      if (!effectiveSkipCartCountFetch) {
        window.removeEventListener("cartUpdated", updateCartCount);
      }
      window.removeEventListener("storage", onStorageChange);
    };
  }, [effectiveSkipCartCountFetch]);

  useEffect(() => {
    let mounted = true;
    const loadCategories = async () => {
      try {
        const { productsAPI } = await import("../../utils/api");
        const res = await productsAPI.getCategories();
        if (!mounted) return;
        setCategories(Array.isArray(res?.categories) ? res.categories : []);
      } catch {
        if (!mounted) return;
        setCategories([]);
      }
    };
    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  // Handle login
  const handleLogin = async () => {
    if (!email || !password) {
      const msg = "Please enter email and password";
      setLoginError(msg);
      toast.error(msg);
      return;
    }

    setLoginError("");

    try {
      const { authAPI } = await import("../../utils/api");
      const response = await authAPI.login(email, password);

      if (response.token) {
        localStorage.setItem("token", response.token);
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("user", JSON.stringify(response.user));
        if (response.user?.role) {
          localStorage.setItem("userRole", response.user.role);
        }
        if (response.user?.fullName) {
          setUserName(response.user.fullName);
        }
        localStorage.removeItem("registeredEmail");
        localStorage.removeItem("registeredPassword");
        setIsLoggedIn(true);
        window.dispatchEvent(new Event("loginStatusChanged"));
        toast.success("Login successful!");
        const role = (response.user?.role || "").toString().toLowerCase();
        if (role === "admin") {
          router.push("/admin");
        } else {
          router.push("/");
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Invalid email or password";
      setLoginError(msg);
      toast.error(msg);
    }
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    setIsLoggedIn(false);
    setUserName("");
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event("loginStatusChanged"));
    // Redirect to home page
    router.push("/");
  };

  useEffect(() => {
    if (disableScrollBehavior) {
      setIsVisible(true);
      return;
    }
    if (typeof window !== 'undefined') {
      const initialScrollY = window.scrollY;
      lastScrollYRef.current = initialScrollY;
      setIsVisible(false);
    }
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const lastScrollY = lastScrollYRef.current;
      if (currentScrollY > lastScrollY) setIsVisible(true);
      else if (currentScrollY < lastScrollY) setIsVisible(false);
      lastScrollYRef.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [disableScrollBehavior]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryNavRef.current && !categoryNavRef.current.contains(event.target as Node)) {
        setOpenCategoryId(null);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    if (isUserDropdownOpen || isSearchOpen || openCategoryId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserDropdownOpen, isSearchOpen, openCategoryId]);

  // Keep only the first 9 parent categories (preserve API order = "first created").
  const parentCategories = categories.filter((c) => c.parent_id == null);
  const navbarParentCategories = parentCategories.slice(0, 9);
  const subCategoriesByParent = categories.reduce<Record<number, Category[]>>((acc, c) => {
    if (c.parent_id != null) {
      if (!acc[c.parent_id]) acc[c.parent_id] = [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {});

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 nav-bg border-b border-slate-200 shadow-sm z-50 transition-transform duration-300`}
      >
        <div className="max-w-full mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-4">
            {/* Left Section - Logo and White Label */}
            <div className="flex items-center gap-3 shrink-0">
              <Link href="/" className="flex items-center">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={160}
                  height={40}
                  className="rounded-lg object-contain"
                  style={{ width: "auto", height: "40px" }}
                  priority
                />
              </Link>
            </div>

            {/* Middle Section - Navigation Links */}
            <div
              ref={categoryNavRef}
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
              {navbarParentCategories.map((category) => {
                const subcategories = subCategoriesByParent[category.id] || [];
                const hasDropdown = subcategories.length > 0;
                const categorySlug = category.slug || category.name.toLowerCase().replace(/\s+/g, "-");
                return (
                <div
                  key={category.id}
                  className="flex items-center gap-0.5 whitespace-nowrap relative pb-1"
                  onMouseEnter={() => {
                    if (!hasDropdown) return;
                    if (categoryCloseTimeoutRef.current) {
                      clearTimeout(categoryCloseTimeoutRef.current);
                      categoryCloseTimeoutRef.current = null;
                    }
                    setOpenCategoryId(category.id);
                  }}
                  onMouseLeave={() => {
                    if (!hasDropdown) return;
                    categoryCloseTimeoutRef.current = setTimeout(() => {
                      setOpenCategoryId((prev) => (prev === category.id ? null : prev));
                    }, 120);
                  }}
                >
                  {hasDropdown ? (
                    <>
                    <button
                      className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-sm font-normal transition-colors flex items-center gap-0.5 px-2 py-1 rounded-sm border border-transparent hover:border-slate-200"
                    >
                      {category.name}
                    </button>
                    {openCategoryId === category.id && (
                      <div
                        className="absolute left-0 top-full mt-0 w-max min-w-[170px] max-w-[300px] bg-white border border-slate-300 rounded-sm shadow-lg shadow-slate-900/10 z-50"
                        onMouseEnter={() => {
                          if (categoryCloseTimeoutRef.current) {
                            clearTimeout(categoryCloseTimeoutRef.current);
                            categoryCloseTimeoutRef.current = null;
                          }
                        }}
                        onMouseLeave={() => setOpenCategoryId((prev) => (prev === category.id ? null : prev))}
                      >
                        <ul className="py-1">
                          {subcategories.map((sub) => (
                            <li key={sub.id}>
                              <Link
                                href={`/products?category=${encodeURIComponent(categorySlug)}&subcategory=${encodeURIComponent(sub.name)}`}
                                className="block px-3 py-1.5 text-sm font-normal text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap"
                                onClick={() => setOpenCategoryId(null)}
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    </>
                  ) : (
                    <Link
                      href={`/products/${categorySlug}`}
                      className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 text-sm font-normal transition-colors px-2 py-1 rounded-sm"
                    >
                      {category.name}
                    </Link>
                  )}
                </div>
              )})}
            </div>

            {/* Right Section - Login Form or User Actions */}
            {!isLoggedIn ? (
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {loginError && (
                  <p className="text-red-600 text-xs font-medium" role="alert">
                    {loginError}
                  </p>
                )}
                <div className="flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white/90 p-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
                    className="hidden xl:block w-44 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-sm text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400"
                    placeholder="Email"
                  />
                  <div className="hidden xl:flex items-center gap-2">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                        className="w-36 pl-3 pr-9 py-1.5 bg-slate-50 border border-slate-200 rounded-sm text-slate-700 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-400"
                        placeholder="Password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-0.5"
                        tabIndex={-1}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={handleLogin}
                    className="bg-[#0B6BCB] hover:bg-blue-700 text-white px-4 py-1.5 rounded-sm text-sm font-semibold transition-colors whitespace-nowrap border border-[#0B6BCB]"
                  >
                    Sign In
                  </button>
                  <a
                    href="/register"
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-sm text-sm font-semibold transition-colors whitespace-nowrap inline-block text-center border border-red-500"
                  >
                    Register
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 shrink-0">
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
                        className="p-4 border-b border-gray-200"
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

                      {/* Popular Searches - go to products filtered by category/subcategory/search */}
                      <div className="p-4">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Popular Search</h3>
                        <ul className="space-y-2">
                          {[
                            "DTF and UV DTF",
                            "Banners",
                            "Flags",
                            "Banner Stands",
                            "Trade Show",
                            "Tents",
                            "Table Throws",
                            "Rigids",
                            "Adhesives",
                            "Wall Art",
                          ].map((item, index) => (
                            <li key={index}>
                              <Link
                                href={`/products?search=${encodeURIComponent(item)}`}
                                onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
                                className="flex items-center justify-between text-gray-900 hover:bg-gray-50 px-2 py-2 rounded transition-colors group"
                              >
                                <span className="text-sm">{item}</span>
                                <svg
                                  className="w-4 h-4 text-gray-400 group-hover:text-gray-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <Link href="/orders" className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors">
                  Orders
                </Link>

                {/* User Name or Estimate */}
                {isLoggedIn && userName ? (
                  <span className="text-gray-700 text-sm font-medium">
                    {userName}
                  </span>
                ) : (
                <a href="/estimates" className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors">
                  Estimate
                </a>
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
                          <a href="/account-settings" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoSettingsOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Account Settings
                          </a>
                          <a href="/change-password" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoKeyOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Change Password
                          </a>
                          <a href="/credit-cards" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoCardOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Manage Credit Cards
                          </a>
                          <a href="/messages" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoMailOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Messages
                          </a>
                          <a href="/address-book" className="flex items-center gap-2 rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            <IoBookOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Address Book
                          </a>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-sm  text-rose-600 hover:bg-rose-50"
                          >
                            <IoLogOutOutline className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                            Logout
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Shopping Cart Icon */}
                <Link href="/cart" className="text-blue-400 hover:text-blue-500 transition-colors relative">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {effectiveCartCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {effectiveCartCount > 99 ? '99+' : effectiveCartCount}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

    </>
  );
}


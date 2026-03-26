"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { IoPersonCircleOutline } from "react-icons/io5";
import { toast } from "react-toastify";

function shouldDisableScrollNavbar(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname === "/checkout" || pathname === "/cart" || pathname === "/products") return true;
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

type NavItem = {
  label: string;
  hasDropdown?: boolean;
  hasNew?: boolean;
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const didInitialCartFetchRef = useRef(false);
  const effectiveCartCount = typeof cartCountOverride === "number" ? cartCountOverride : cartCount;

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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    if (isDropdownOpen || isUserDropdownOpen || isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen, isUserDropdownOpen, isSearchOpen]);

  const navItems: NavItem[] = [
    { label: "All Products", hasDropdown: true },
    { label: "DTF and UV DTF", hasNew: true },
    { label: "Banners" },
    { label: "Flags" },
    { label: "Banner Stands" },
    { label: "Trade Show" },
    { label: "Tents" },
    { label: "Table Throws" },
    { label: "Rigids" },
    { label: "Adhesives" },
    { label: "Wall Art" },
  ];

  const loggedInNavItems: NavItem[] = [
    { label: "All Products", hasDropdown: true },
    // { label: "DTF and UV DTF", hasNew: true },
    { label: "Banners" },
    { label: "Flags" },
    { label: "Banner Stands" },
    { label: "Trade Show" },
    { label: "Tents" },
    // { label: "Table Throws" },
    // { label: "Rigids" },
    // { label: "Adhesives" },
    { label: "Wall Art" },
    // { label: "Channel Letters" },
  ];

  // Map category labels to slugs for navigation (navbar + dropdown)
  const categorySlugMap: { [key: string]: string } = {
    "Banners": "banners",
    "Flags": "advertising-flags",
    "Channel Letters": "channel-letters",
    "Banner Stands": "banner-stands",
    "Trade Show": "trade-show-products",
    "Tents": "custom-event-tents",
    "Table Throws": "table-throws",
    "Rigids": "rigid-signs-magnets",
    "Adhesives": "adhesive-products",
    "Wall Art": "wall-art",
    "DTF and UV DTF": "dtf-uv-dtf",
    "Advertising Flags": "advertising-flags",
    "Step and Repeat Backdrop": "step-repeat-backdrop",
    "Real Estate Products": "real-estate-products",
    "A Frame and Sign Holders": "a-frame-sign-holders",
    "Signicade A-Frames": "signicade-a-frames",
    "SEG Products": "seg-products",
    "Trade Show Products": "trade-show-products",
    "Custom Event Tents": "custom-event-tents",
    "Hardware Only": "hardware-only",
    "13oz Vinyl Banner": "13oz-vinyl-banner",
    "18oz Blockout Banner": "18oz-blockout-banner",
    "Backlit Banner": "backlit-banner",
    "Mesh Banner": "mesh-banner",
    "Indoor Banner": "indoor-banner",
    "Pole Banner": "pole-banner",
    "9oz Fabric Banner": "9oz-fabric-banner",
    "Blockout Fabric Banner": "blockout-fabric-banner",
    "Tension Fabric": "tension-fabric",
    "Hand Banner": "hand-banner",
    "Wall Murals": "wall-murals",
    "Adhesive Products": "adhesive-products",
    "Rigid Signs and Magnets": "rigid-signs-magnets",
    "Reflective Products": "reflective-products",
    "Dry Erase Products": "dry-erase-products",
    "Backlit Film": "backlit-film",
    "Premium Window Cling": "premium-window-cling",
    "Posters": "posters",
    "Styrene": "styrene",
    "Popup": "popup",
    "Canvas Roll": "canvas-roll",
    "Material": "material",
  };

  const dropdownColumns = [
    {
      title: "Signs / Letters",
      items: [
        { label: "Channel Letters", hasArrow: true },
        { label: "Advertising Flags", hasArrow: true },
        { label: "Banner Stands", hasArrow: true },
        { label: "Step and Repeat Backdrop", hasArrow: true },
        { label: "Real Estate Products", hasArrow: true },
        { label: "A Frame and Sign Holders", hasArrow: true },
        { label: "Signicade A-Frames", hasArrow: true },
        { label: "SEG Products", hasNew: true, hasArrow: true },
        { label: "Trade Show Products", hasArrow: true },
        { label: "Custom Event Tents", hasNew: true, hasArrow: true },
        { label: "Table Throws", hasNew: true, hasArrow: true },
        { label: "Hardware Only", hasArrow: true },
      ],
    },
    {
      title: "Banners",
      items: [
        { label: "13oz Vinyl Banner", hasArrow: true },
        { label: "18oz Blockout Banner", hasArrow: true },
        { label: "Backlit Banner", hasArrow: true },
        { label: "Mesh Banner", hasArrow: true },
        { label: "Indoor Banner", hasArrow: true },
        { label: "Pole Banner", hasArrow: true },
        { label: "9oz Fabric Banner", hasArrow: true },
        { label: "Blockout Fabric Banner", hasArrow: true },
        { label: "Tension Fabric", hasArrow: true },
        { label: "Hand Banner", hasNew: true, hasArrow: true },
      ],
    },
    {
      title: "Large Format",
      items: [
        { label: "Wall Art", hasArrow: true },
        { label: "Wall Murals", hasNew: true, hasArrow: true },
        { label: "Adhesive Products", hasArrow: true },
        { label: "Rigid Signs and Magnets", hasArrow: true },
        { label: "Reflective Products", hasArrow: true },
        { label: "Dry Erase Products", hasArrow: true },
        { label: "DTF and UV DTF", hasNew: true, hasArrow: true },
        { label: "Backlit Film", hasArrow: true },
        { label: "Premium Window Cling", hasArrow: true },
        { label: "Posters", hasArrow: true },
        { label: "Styrene", hasArrow: true },
        { label: "Popup", hasArrow: true },
        { label: "Canvas Roll", hasArrow: true },
        { label: "Material", hasArrow: true },
      ],
    },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 nav-bg shadow-md z-50 transition-transform duration-300`}
      >
        <div className="max-w-full mx-auto px-4 py-3">
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
            <div className="hidden lg:flex items-center gap-4 overflow-x-auto flex-1 justify-center">
              {(isLoggedIn ? loggedInNavItems : navItems).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 whitespace-nowrap relative"
                  ref={item.hasDropdown ? dropdownRef : null}
                >
                  {item.hasDropdown ? (
                    <>
                      {item.label === "All Products" ? (
                        <Link
                          href="/"
                          className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors flex items-center gap-1"
                        >
                          {item.label}
                          <svg
                            className="w-4 h-4 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </Link>
                      ) : (
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      onMouseEnter={() => setIsDropdownOpen(true)}
                      className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors flex items-center gap-1"
                    >
                      {item.label}
                      <svg
                        className="w-4 h-4 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                      )}
                    </>
                  ) : (
                    <Link
                      href={`/products/${categorySlugMap[item.label] || item.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors"
                    >
                      {item.label}
                    </Link>
                  )}
                  {item.hasNew && (
                    <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                      New
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Right Section - Login Form or User Actions */}
            {!isLoggedIn ? (
              <div className="flex flex-col items-end gap-1 shrink-0">
                {loginError && (
                  <p className="text-red-600 text-sm" role="alert">
                    {loginError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLoginError(""); }}
                    className="hidden xl:block w-40 px-3 py-2 bg-gray-100 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Email"
                  />
                  <div className="hidden xl:flex items-center gap-2">
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                        className="w-32 pl-3 pr-9 py-2 bg-gray-100 rounded-lg text-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-0.5"
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
                    <a
                      href="#"
                      className="text-[#0B6BCB] hover:text-[#0B6BCB] text-sm whitespace-nowrap"
                    >
                      Forgot?
                    </a>
                  </div>
                  <button
                    onClick={handleLogin}
                    className="bg-[#0B6BCB] hover:bg-[#0B6BCB] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    Sign In
                  </button>
                  <a
                    href="/register"
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap inline-block text-center"
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

                {/* Orders - shows cart products (items user added to cart) */}
                <Link href="/cart" className="text-gray-700 hover:text-gray-900 text-sm font-medium transition-colors">
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
                          <a href="/account-settings" className="flex items-center rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            Account Settings
                          </a>
                          <a href="/change-password" className="flex items-center rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            Change Password
                          </a>
                          <a href="/credit-cards" className="flex items-center rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            Manage Credit Cards
                          </a>
                          <a href="/messages" className="flex items-center rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            Messages
                          </a>
                          <a href="/address-book" className="flex items-center rounded-sm px-1.5 py-1 text-[#0B6BCB] hover:bg-slate-100 hover:text-blue-800 text-sm whitespace-nowrap">
                            Address Book
                          </a>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="flex w-full items-center rounded-sm px-1.5 py-1 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
                          >
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

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div
          ref={dropdownRef}
          className="fixed top-[60px] left-0 right-0 bg-white shadow-lg z-40 border-t border-gray-200"
          onMouseLeave={() => setIsDropdownOpen(false)}
        >
          <div className="max-w-7xl mx-auto px-8 py-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {dropdownColumns.map((column, colIndex) => (
                <div key={colIndex}>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    {column.title}
                  </h3>
                  <ul className="space-y-2">
                    {column.items.map((item: any, itemIndex) => {
                      // Handle nested subcategories (like Indoor / Outdoor Displays)
                      if (item.isSubcategory && item.subItems) {
                        return (
                          <li key={itemIndex} className="space-y-2">
                            <div className="text-sm font-bold text-gray-900 py-1">
                              {item.label}
                            </div>
                            <ul className="pl-4 space-y-1.5">
                              {item.subItems.map((subItem: any, subIndex: number) => {
                                const subSlug = categorySlugMap[subItem.label] || subItem.label.toLowerCase().replace(/\s+/g, '-');
                                const subHref = subItem.label === "Material" ? "/material" : 
                                               subItem.label === "Products detail" ? "/products/product-detail" :
                                               `/products/${subSlug}`;
                                
                                return (
                                  <li key={subIndex}>
                                    <Link
                                      href={subHref}
                                      className="flex items-center justify-between text-gray-600 hover:text-gray-900 text-sm py-1 group"
                                    >
                                      <span className="flex items-center gap-2">
                                        {subItem.label}
                                        {subItem.hasNew && (
                                          <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                            New
                                          </span>
                                        )}
                                      </span>
                                      {subItem.hasArrow && (
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
                                      )}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </li>
                        );
                      }
                      
                      // Generate href for main category items
                      const slug = categorySlugMap[item.label] || item.label.toLowerCase().replace(/\s+/g, '-');
                      let href = item.label === "Material" ? "/material" : 
                                item.label === "Products detail" ? "/products/product-detail" :
                                `/products/${slug}`;
                      
                      return (
                      <li key={itemIndex}>
                        <Link
                            href={href}
                          className="flex items-center justify-between text-gray-600 hover:text-gray-900 text-sm py-1 group"
                        >
                          <span className="flex items-center gap-2">
                            {item.label}
                              {(item as any).hasNew && (
                              <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                                New
                              </span>
                            )}
                          </span>
                          {item.hasArrow && (
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
                          )}
                        </Link>
                      </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";

interface AdminNavbarProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const navItems = [
  {
    href: "/admin",
    label: "Orders",
    match: (p: string) =>
      p === "/admin" ||
      p === "/admin/" ||
      p.startsWith("/admin/orders") ||
      p.startsWith("/admin/cart-item"),
  },
  { href: "/admin/refunds", label: "Refunds", match: (p: string) => p === "/admin/refunds" },
  {
    href: "/admin/products",
    label: "Products",
    match: (p: string) => p === "/admin/products" || p.startsWith("/admin/products"),
  },
  {
    href: "/admin/employees",
    label: "Employees",
    match: (p: string) => p === "/admin/employees" || p.startsWith("/admin/employees"),
  },
] as const;

export default function AdminNavbar({
  children,
  title = "Admin",
  subtitle,
  searchQuery = "",
  onSearchChange,
}: AdminNavbarProps) {
  const router = useRouter();
  const pathname = usePathname() || "";

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    window.dispatchEvent(new Event("loginStatusChanged"));
    router.push("/");
  };

  return (
    <div className="admin-app min-h-screen flex bg-slate-100 text-slate-900">
      <aside className="flex w-52 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900 text-slate-300 sm:w-56">
        <div className="p-5 border-b border-slate-800/80">
          <div className="rounded-xl bg-white/95 p-2.5 shadow-sm ring-1 ring-black/5">
            <Image
              src="/logo.png"
              alt="Logo"
              width={180}
              height={54}
              className="h-9 w-auto max-w-full object-contain object-left"
              priority
            />
          </div>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Control panel
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-md ${
                    active ? "bg-sky-500/20 text-sky-300" : "bg-slate-800 text-slate-500"
                  }`}
                  aria-hidden
                >
                  {label === "Orders" && (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  )}
                  {label === "Refunds" && (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                  )}
                  {label === "Products" && (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                  {label === "Employees" && (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800/80 text-xs text-slate-500">
          Signed in as admin
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {onSearchChange && (
              <div className="relative">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search…"
                  className="h-10 w-full min-w-[200px] rounded-xl border border-slate-200 bg-slate-50/80 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-inner outline-none transition focus:bg-white sm:w-72"
                />
                <svg
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Log out
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1600px] space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

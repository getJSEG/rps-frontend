"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";

interface AdminNavbarProps {
  children: ReactNode;
  title?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export default function AdminNavbar({ 
  children, 
  title = "New Orders",
  searchQuery = "",
  onSearchChange 
}: AdminNavbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    window.dispatchEvent(new Event("loginStatusChanged"));
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <div className="w-24 bg-gradient-to-b from-blue-600 to-blue-400 text-white flex-shrink-0"></div>
      <div className="p-6 bg-gray-200">
        {/* Logo */}
        <div className="mb-8">
          <Image
            src="/logo.png"
            alt="Logo"
            width={200}
            height={60}
            className="rounded-lg object-contain"
            priority
          />
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2">
          <Link
            href="/admin"
            className={`block px-4 py-3 rounded-lg font-bold text-gray-400 transition-colors ${
              pathname === "/admin" || pathname === "/admin/"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-500 font-bold text-gray-400 hover:text-white"
            }`}
          >
            Orders
          </Link>
          <Link
            href="/admin/refunds"
            className={`block px-4 py-3 rounded-lg font-bold text-gray-400 transition-colors ${
              pathname === "/admin/refunds"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-500 font-bold text-gray-400 hover:text-white"
            }`}
          >
            Refunds
          </Link>
          <Link
            href="/admin/products"
            className={`block px-4 py-3 rounded-lg font-bold text-gray-400 transition-colors ${
              pathname === "/admin/products" || pathname?.startsWith("/admin/products")
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-500 font-bold text-gray-400 hover:text-white"
            }`}
          >
            Products
          </Link>
          <Link
            href="/admin/employees"
            className={`block px-4 py-3 rounded-lg font-bold text-gray-400 transition-colors ${
              pathname === "/admin/employees"
                ? "bg-blue-500 text-white"
                : "hover:bg-blue-500 font-bold text-gray-400 hover:text-white"
            }`}
          >
            Employees
          </Link>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          
          {/* Search Bar and Logout */}
          <div className="flex items-center gap-4">
            {onSearchChange && (
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search Here..."
                  className="w-64 px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
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
              onClick={handleLogout}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Children Content */}
        {children}
      </div>
    </div>
  );
}


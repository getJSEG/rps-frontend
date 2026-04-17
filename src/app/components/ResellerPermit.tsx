"use client";

import { useState } from "react";
import Link from "next/link";
import { FiEdit, FiTrash2 } from "react-icons/fi";

export default function ResellerPermit() {
  const [formData, setFormData] = useState({
    state: "",
    permitImage: null as File | null,
    resellerForm: null as File | null,
  });

  const [permitImageName, setPermitImageName] = useState("No file chosen");
  const [resellerFormName, setResellerFormName] = useState("No file chosen");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (field === "permitImage") {
        setFormData((prev) => ({ ...prev, permitImage: file }));
        setPermitImageName(file.name);
      } else if (field === "resellerForm") {
        setFormData((prev) => ({ ...prev, resellerForm: file }));
        setResellerFormName(file.name);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
  };

  const menuItems = [
    { label: "Account Settings", href: "/account-settings" },
    { label: "Change Password", href: "/change-password" },
    { label: "Reseller Permit", href: "/reseller-permit", active: true },
    { label: "Your Default Address", href: "/address-book" },
  ];

  const states = [
    "Please Choose a State!",
    "California",
    "Texas",
    "New York",
    "Florida",
    "Illinois",
    "Pennsylvania",
    "Ohio",
    "Georgia",
    "North Carolina",
    "Michigan",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 rounded-sm border border-gray-200 bg-white/80 px-5 py-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Area</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Reseller Permit</h1>
          <p className="mt-1.5 text-sm text-gray-600">Upload permit documents for verification.</p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          {/* Left Panel - Settings Menu */}
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

          {/* Right Column - Upload Reseller Permit Form */}
          <main className="flex-1 rounded-sm border border-gray-200 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)] sm:p-7">
            <div className="mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Upload Reseller Permit Verification</h2>
            </div>

            <div className="mb-6 rounded-sm border border-gray-200 bg-gray-50/80 px-3 py-3 text-sm text-gray-700">
              Please choose a state first then download Permit Form:{" "}
              <a href="#" className="text-blue-500 hover:text-blue-800 underline">
                CA Download Form
              </a>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
              {/* State Dropdown */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                    State
                  </label>
                  <span className="text-red-500">*</span>
                </div>
                <div className="relative">
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full cursor-pointer appearance-none rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    required
                  >
                    {states.map((state) => (
                      <option key={state} value={state === "Please Choose a State!" ? "" : state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg
                      className="w-5 h-5 text-gray-400"
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
                  </div>
                </div>
              </div>

              {/* Permit Image */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                    Permit Image
                  </label>
                  <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="inline-block rounded-sm bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                      Choose File
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "permitImage")}
                      className="hidden"
                      required
                    />
                  </label>
                  <span className="text-sm text-gray-600">{permitImageName}</span>
                </div>
              </div>

              {/* Reseller Form */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                    Reseller Form
                  </label>
                  <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="inline-block rounded-sm bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
                      Choose File
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileChange(e, "resellerForm")}
                      className="hidden"
                      required
                    />
                  </label>
                  <span className="text-sm text-gray-600">{resellerFormName}</span>
                </div>
              </div>

              {/* Update Button */}
              <div className="border-t border-gray-200 pt-4">
                <button
                  type="submit"
                  className="inline-flex min-w-32 items-center justify-center rounded-sm bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}


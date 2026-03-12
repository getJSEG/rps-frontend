"use client";

import { useState } from "react";
import Link from "next/link";

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
    { label: "Credit Cards", href: "/credit-cards" },
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
    <div className="min-h-screen bg-white pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Left Panel - Settings Menu */}
          <aside className="w-64 shrink-0 bg-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>
            <nav className="space-y-0">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block w-full text-left px-4 py-3 transition-colors border-b border-gray-200 last:border-b-0 ${
                    item.active
                      ? "bg-blue-100 text-gray-900 font-medium"
                      : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Right Column - Upload Reseller Permit Form */}
          <main className="flex-1 bg-white p-8">
            <div className="mb-6 pb-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">Upload Reseller Permit Verification</h1>
            </div>

            <div className="mb-6 text-sm text-gray-700">
              Please choose a state first then download Permit Form:{" "}
              <a href="#" className="text-blue-600 hover:text-blue-800 underline">
                CA Download Form
              </a>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
              {/* State Dropdown */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    State
                  </label>
                  <span className="text-red-500">*</span>
                </div>
                <div className="relative">
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none cursor-pointer"
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
                  <label className="block text-sm font-medium text-gray-700">
                    Permit Image
                  </label>
                  <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors inline-block">
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
                  <label className="block text-sm font-medium text-gray-700">
                    Reseller Form
                  </label>
                  <span className="text-red-500">*</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer">
                    <span className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors inline-block">
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
              <div className="pt-4">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-lg transition-colors"
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


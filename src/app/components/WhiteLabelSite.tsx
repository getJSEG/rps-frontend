"use client";

import { useState } from "react";

export default function WhiteLabelSite() {
  const [activeTab, setActiveTab] = useState("product-pricing");
  const [showPrice, setShowPrice] = useState("Yes");
  const [markupPrice, setMarkupPrice] = useState("100");
  const [individualPricing, setIndividualPricing] = useState("No");
  
  // Contact Information state
  const [contactInfo, setContactInfo] = useState({
    company: "Resourcefuldigital",
    address: "2503 Castille Drive",
    city: "Grand Prairie",
    zipCode: "75051",
    workHours: "",
    telephone: "2144061397",
    aptSuite: "",
    state: "Texas (TX)",
    contactEmail: "resorucefuldigital@gmail.com",
  });

  // Logo state
  const [logoType, setLogoType] = useState("text");
  const [logoText, setLogoText] = useState("Resourcefuldigital");
  const [fontStyle, setFontStyle] = useState("Arial");

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setContactInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = () => {};

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Title */}
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-8">White Label Site</h1>

        <div className="flex gap-8">
          {/* Left Sidebar - Steps Navigation */}
          <aside className="w-64 shrink-0">
            <div className="relative">
              {/* Step 1: Domain - Completed */}
              <div className="flex items-start gap-4 mb-8">
                <div className="relative">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-16 bg-blue-600"></div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Domain</div>
                  <div className="text-sm text-gray-600">Setup your domain</div>
                </div>
              </div>

              {/* Step 2: Setting - Active */}
              <div className="flex items-start gap-4 mb-8">
                <div className="relative">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold">2</span>
                  </div>
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-16 bg-gray-300"></div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Setting</div>
                  <div className="text-sm text-gray-600">Company Info & Operations</div>
                </div>
              </div>

              {/* Step 3: Shopping Cart - Inactive */}
              <div className="flex items-start gap-4">
                <div>
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-gray-500 font-semibold">—</span>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-1">Shopping Cart</div>
                  <div className="text-sm text-gray-600">Coming soon</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1">
            {/* Domain Configuration Card */}
            <div className="bg-gray-100 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-gray-700">Your White Label Site: </span>
                  <a
                    href="https://resourcefuldigital.bs.run"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    resourcefuldigital.bs.run
                  </a>
                </div>
                <a
                  href="#"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Change Domain
                </a>
              </div>
            </div>

            {/* Settings Configuration Card */}
            <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
              {/* Tab Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <div className="flex gap-6">
                  <button
                    onClick={() => setActiveTab("product-pricing")}
                    className={`pb-3 px-1 font-medium transition-colors ${
                      activeTab === "product-pricing"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Product & Pricing
                  </button>
                  <button
                    onClick={() => setActiveTab("contact")}
                    className={`pb-3 px-1 font-medium transition-colors ${
                      activeTab === "contact"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Contact Information
                  </button>
                  <button
                    onClick={() => setActiveTab("logo")}
                    className={`pb-3 px-1 font-medium transition-colors ${
                      activeTab === "logo"
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Add Your Logo
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === "product-pricing" && (
                <div className="space-y-6">
                  {/* Show Price Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Show Price
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowPrice("No")}
                        className={`relative px-6 py-2 border-2 rounded-lg font-medium transition-colors ${
                          showPrice === "No"
                            ? "border-green-500 bg-green-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        No
                        {showPrice === "No" && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setShowPrice("Yes")}
                        className={`relative px-6 py-2 border-2 rounded-lg font-medium transition-colors ${
                          showPrice === "Yes"
                            ? "border-green-500 bg-green-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        Yes
                        {showPrice === "Yes" && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Markup Price Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Markup Price:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={markupPrice}
                        onChange={(e) => setMarkupPrice(e.target.value)}
                        className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="20"
                      />
                      <span className="text-gray-700">%</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      * Minimum markup price 20%
                    </p>
                  </div>

                  {/* Set individual Product & Pricing Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Set individual Product & Pricing
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setIndividualPricing("No")}
                        className={`relative px-6 py-2 border-2 rounded-lg font-medium transition-colors ${
                          individualPricing === "No"
                            ? "border-green-500 bg-green-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        No
                        {individualPricing === "No" && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setIndividualPricing("Yes")}
                        className={`relative px-6 py-2 border-2 rounded-lg font-medium transition-colors ${
                          individualPricing === "Yes"
                            ? "border-green-500 bg-green-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        Yes
                        {individualPricing === "Yes" && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "contact" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Company
                        </label>
                        <input
                          type="text"
                          name="company"
                          value={contactInfo.company}
                          onChange={handleContactChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Address
                        </label>
                        <input
                          type="text"
                          name="address"
                          value={contactInfo.address}
                          onChange={handleContactChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          name="city"
                          value={contactInfo.city}
                          onChange={handleContactChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Zip Code
                        </label>
                        <input
                          type="text"
                          name="zipCode"
                          value={contactInfo.zipCode}
                          onChange={handleContactChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Work Hours
                        </label>
                        <input
                          type="text"
                          name="workHours"
                          value={contactInfo.workHours}
                          onChange={handleContactChange}
                          placeholder="Work Hours"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Telephone
                        </label>
                        <input
                          type="tel"
                          name="telephone"
                          value={contactInfo.telephone}
                          onChange={handleContactChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Apt, suite, unit, etc. (optional)...
                        </label>
                        <input
                          type="text"
                          name="aptSuite"
                          value={contactInfo.aptSuite}
                          onChange={handleContactChange}
                          placeholder="Apt, suite, unit, etc. (optional)..."
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          State
                        </label>
                        <div className="relative">
                          <select
                            name="state"
                            value={contactInfo.state}
                            onChange={handleContactChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                          >
                            <option value="Texas (TX)">Texas (TX)</option>
                            <option value="California (CA)">California (CA)</option>
                            <option value="New York (NY)">New York (NY)</option>
                            <option value="Florida (FL)">Florida (FL)</option>
                            <option value="Illinois (IL)">Illinois (IL)</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex flex-col items-center justify-center pr-3 pointer-events-none">
                            <svg
                              className="w-3 h-3 text-gray-400 mb-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                            <svg
                              className="w-3 h-3 text-gray-400"
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Email
                        </label>
                        <input
                          type="email"
                          name="contactEmail"
                          value={contactInfo.contactEmail}
                          onChange={handleContactChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "logo" && (
                <div className="space-y-6">
                  {/* Logo Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Logo Type
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setLogoType("text")}
                        className={`relative px-6 py-2 border-2 rounded-lg font-medium transition-colors ${
                          logoType === "text"
                            ? "border-blue-500 bg-blue-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        Text Logo
                        {logoType === "text" && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => setLogoType("upload")}
                        className={`relative px-6 py-2 border-2 rounded-lg font-medium transition-colors ${
                          logoType === "upload"
                            ? "border-blue-500 bg-blue-50 text-gray-900"
                            : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        Upload Logo
                        {logoType === "upload" && (
                          <span className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {logoType === "text" && (
                    <>
                      {/* Logo Text Input */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Logo Text
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            value={logoText}
                            onChange={(e) => setLogoText(e.target.value)}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="relative">
                            <select
                              value={fontStyle}
                              onChange={(e) => setFontStyle(e.target.value)}
                              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="Arial">Font Style</option>
                              <option value="Helvetica">Helvetica</option>
                              <option value="Times New Roman">Times New Roman</option>
                              <option value="Georgia">Georgia</option>
                              <option value="Verdana">Verdana</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                              <svg
                                className="w-4 h-4 text-gray-400"
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
                      </div>

                      {/* Preview Link */}
                      <div>
                        <a
                          href="#"
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Preview
                        </a>
                      </div>
                    </>
                  )}

                  {logoType === "upload" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Logo Image
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Click to upload or drag and drop
                        </label>
                        <p className="text-sm text-gray-500 mt-2">
                          PNG, JPG, GIF up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Update Button */}
            <div className="flex justify-center">
              <button
                onClick={handleUpdate}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-12 py-3 rounded-lg transition-colors text-lg"
              >
                Update
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}


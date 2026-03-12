"use client";

import { useState } from "react";

export default function Estimates() {
  const [category, setCategory] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = () => {
    if (category) {
      setCurrentStep(2);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-3xl font-bold text-gray-900">Estimates</h1>
            <div className="flex items-center gap-3">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                New Estimate
              </button>
              <button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Recent Estimates
              </button>
            </div>
          </div>
        </div>

        {/* Information Box */}
        <div className="bg-blue-50 border border-gray-300 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Should I place an estimate?
          </h2>
          <p className="text-gray-700 mb-4">
            If your order does not meet these criteria, please use the Instant Quote system located on each product page for your convenience.
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>
              You order contains 50+ sheets of rigid substrates, 1000+ square feet of banner material, or 500+ square feet of another material.
            </li>
            <li>
              You're ordering a quantity of at least 100 of any item.
            </li>
            <li>
              Your order exceeds $250 and you have a special finishing request.
            </li>
          </ol>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                currentStep >= 1
                  ? "bg-blue-600 text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              1
            </div>
            <span
              className={`font-medium ${
                currentStep >= 1 ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Category
            </span>
          </div>
          <div className="flex-1 border-t-2 border-dashed border-gray-300"></div>
          <div className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                currentStep >= 2
                  ? "bg-blue-600 text-white"
                  : "bg-gray-300 text-gray-600"
              }`}
            >
              2
            </div>
            <span
              className={`font-medium ${
                currentStep >= 2 ? "text-gray-900" : "text-gray-500"
              }`}
            >
              Configure
            </span>
          </div>
        </div>

        {/* Form Section */}
        <div className="bg-white border border-gray-300 rounded-lg p-6 max-w-2xl">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer bg-white"
              >
                <option value="">Select a category</option>
                <option value="banners">Banners</option>
                <option value="flags">Flags</option>
                <option value="signs">Signs</option>
                <option value="rigid">Rigid Substrates</option>
                <option value="adhesives">Adhesives</option>
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
          <button
            onClick={handleNext}
            disabled={!category}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}


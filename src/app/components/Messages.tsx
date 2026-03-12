"use client";

import { useState } from "react";

export default function Messages() {
  const [selectedMessage, setSelectedMessage] = useState<number | null>(null);
  const [filterOption, setFilterOption] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);

  const messages = [
    {
      id: 1,
      title: "Your Order A8198720 has been shipped",
      timestamp: "2026-01-20 07:28:28",
      type: "shipped",
      content: "Your order A8198720 has been shipped and is on its way. You can track your package using the tracking number provided.",
    },
    {
      id: 2,
      title: "Order Confirmation: Order A8198720",
      timestamp: "2026-01-17 13:33:06",
      type: "confirmation",
      content: "Thank you for your order! Your order A8198720 has been confirmed and is being processed.",
    },
    {
      id: 3,
      title: "Your Order A7785971 has been shipped",
      timestamp: "2025-09-09 11:09:55",
      type: "shipped",
      content: "Your order A7785971 has been shipped and is on its way. You can track your package using the tracking number provided.",
    },
    {
      id: 4,
      title: "Order Confirmation: Order A7785971",
      timestamp: "2025-09-08 18:37:11",
      type: "confirmation",
      content: "Thank you for your order! Your order A7785971 has been confirmed and is being processed.",
    },
    {
      id: 5,
      title: "Your Order A7521611 has been shipped",
      timestamp: "2025-06-18 13:57:48",
      type: "shipped",
      content: "Your order A7521611 has been shipped and is on its way. You can track your package using the tracking number provided.",
    },
    {
      id: 6,
      title: "Order Confirmation: Order A7521611",
      timestamp: "2025-06-16 20:27:59",
      type: "confirmation",
      content: "Thank you for your order! Your order A7521611 has been confirmed and is being processed.",
    },
    {
      id: 7,
      title: "Your Order A7455158 has been shipped",
      timestamp: "2025-05-28 10:26:21",
      type: "shipped",
      content: "Your order A7455158 has been shipped and is on its way. You can track your package using the tracking number provided.",
    },
    {
      id: 8,
      title: "Order Confirmation: Order A7455158",
      timestamp: "2025-05-27 10:09:00",
      type: "confirmation",
      content: "Thank you for your order! Your order A7455158 has been confirmed and is being processed.",
    },
  ];

  const handleMarkAllAsRead = () => {};

  const selectedMessageData = messages.find((msg) => msg.id === selectedMessage);

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Messages</h1>
          <p className="text-gray-600">Here are all your recent messages and emails</p>
        </div>

        <div className="flex gap-6">
          {/* Left Column - Message List */}
          <div className="w-1/3 bg-white border border-gray-300 rounded-lg">
            {/* Controls */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <select
                  value={filterOption}
                  onChange={(e) => setFilterOption(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer bg-white"
                >
                  <option value="All">All</option>
                  <option value="Shipped">Shipped</option>
                  <option value="Confirmation">Confirmation</option>
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
              <button
                onClick={handleMarkAllAsRead}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors whitespace-nowrap"
              >
                Mark All As Read
              </button>
            </div>

            {/* Message List */}
            <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
              {messages.map((message) => (
                <button
                  key={message.id}
                  onClick={() => setSelectedMessage(message.id)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedMessage === message.id ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 mb-1">
                    {message.title}
                  </div>
                  <div className="text-xs text-gray-500">{message.timestamp}</div>
                </button>
              ))}
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-gray-200 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &lt;
              </button>
              <button
                onClick={() => setCurrentPage(1)}
                className={`px-3 py-1 rounded ${
                  currentPage === 1
                    ? "bg-blue-600 text-white"
                    : "text-blue-600 hover:bg-blue-50"
                }`}
              >
                1
              </button>
              <button
                onClick={() => setCurrentPage(2)}
                className={`px-3 py-1 rounded ${
                  currentPage === 2
                    ? "bg-blue-600 text-white"
                    : "text-blue-600 hover:bg-blue-50"
                }`}
              >
                2
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(2, currentPage + 1))}
                disabled={currentPage === 2}
                className="px-3 py-1 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                &gt;
              </button>
            </div>
          </div>

          {/* Right Column - Message Display */}
          <div className="flex-1 bg-white border border-gray-300 rounded-lg min-h-[600px]">
            {selectedMessageData ? (
              <div className="p-8">
                <div className="mb-4">
                  <h2 className="text-xl font-bold text-gray-900 mb-2">
                    {selectedMessageData.title}
                  </h2>
                  <p className="text-sm text-gray-500">{selectedMessageData.timestamp}</p>
                </div>
                <div className="text-gray-700 leading-relaxed">
                  {selectedMessageData.content}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[600px] text-gray-400">
                <svg
                  className="w-16 h-16 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-400">Please select a message</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


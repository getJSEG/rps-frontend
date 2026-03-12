"use client";

export default function PendingPayment() {
  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pending Payment</h1>
          <p className="text-gray-600">
            Your order will be processed once payment has been completed.
          </p>
        </div>

        {/* Empty State */}
        <div className="bg-white min-h-[500px] flex flex-col items-center justify-center">
          <div className="text-center">
            <svg
              className="w-24 h-24 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <p className="text-gray-500 text-lg">No Pending Payment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}


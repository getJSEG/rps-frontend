"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showModal, setShowModal] = useState(true);
  const orderId = searchParams.get("order");
  const paid = searchParams.get("paid");

  const goHome = () => {
    setShowModal(false);
    router.replace("/");
  };

  useEffect(() => {
    if (!showModal) return;
    const t = setTimeout(goHome, 5000);
    return () => clearTimeout(t);
  }, [showModal]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 pt-24 pb-16 flex items-center justify-center">
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" aria-modal="true">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Payment Successful</h2>
              <p className="text-gray-600 mb-6">
                Thank you for your order. {orderId && <span className="block mt-1 text-sm">Order # {orderId}</span>}
              </p>
              <button
                type="button"
                onClick={goHome}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Continue to Home
              </button>
              <p className="text-gray-400 text-xs mt-4">Redirecting to home in 5 seconds…</p>
            </div>
          </div>
        )}
        {!showModal && <p className="text-gray-500">Redirecting…</p>}
      </div>
      <Footer />
    </>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <>
        <Navbar />
        <div className="min-h-screen bg-gray-50 pt-24 pb-16 flex items-center justify-center">
          <p className="text-gray-500">Loading…</p>
        </div>
        <Footer />
      </>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}

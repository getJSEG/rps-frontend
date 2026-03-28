import { Suspense } from "react";
import Navbar from "../components/Navbar";
import Orders from "../components/Orders";
import Footer from "../components/Footer";

export default function OrdersPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="min-h-screen bg-white pt-24 pb-16 flex items-center justify-center">
            <p className="text-gray-600">Loading…</p>
          </div>
        }
      >
        <Orders />
      </Suspense>
      <Footer />
    </>
  );
}


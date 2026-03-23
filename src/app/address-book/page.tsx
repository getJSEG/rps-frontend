import { Suspense } from "react";
import Navbar from "../components/Navbar";
import AddressBook from "../components/AddressBook";
import Footer from "../components/Footer";

export default function AddressBookPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20 flex items-center justify-center">
          <div className="rounded-sm border border-gray-200 bg-white px-6 py-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.4)]">
            <p className="text-sm font-medium text-gray-600">Loading…</p>
          </div>
        </div>
      }>
        <AddressBook />
      </Suspense>
      <Footer />
    </>
  );
}


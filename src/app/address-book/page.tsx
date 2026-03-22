import { Suspense } from "react";
import Navbar from "../components/Navbar";
import AddressBook from "../components/AddressBook";
import Footer from "../components/Footer";

export default function AddressBookPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={
        <div className="min-h-screen bg-white pt-20 flex items-center justify-center">
          <p className="text-gray-600">Loading…</p>
        </div>
      }>
        <AddressBook />
      </Suspense>
      <Footer />
    </>
  );
}


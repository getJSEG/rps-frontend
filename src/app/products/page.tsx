import { Suspense } from "react";
import Navbar from "../components/Navbar";
import AllProductsByCategory from "../components/AllProductsByCategory";
import Footer from "../components/Footer";

export default function ProductsPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-16 text-center text-gray-500">Loading products…</div>
        }
      >
        <AllProductsByCategory />
      </Suspense>
      <Footer />
    </>
  );
}


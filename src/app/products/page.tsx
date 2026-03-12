import { Suspense } from "react";
import Navbar from "../components/Navbar";
import Products from "../components/Products";
import Footer from "../components/Footer";

export default function ProductsPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="text-center py-12"><p className="text-gray-600">Loading products...</p></div>}>
        <Products />
      </Suspense>
      <Footer />
    </>
  );
}


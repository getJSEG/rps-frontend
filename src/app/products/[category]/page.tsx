"use client";

import { use } from "react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Products from "../../components/Products";

export default function CategoryProductsPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlugParam } = use(params);

  return (
    <>
      <Navbar />
      <Products forcedCategorySlug={categorySlugParam} />
      <Footer />
    </>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import ProductCarousel, { type CarouselProduct } from "./ProductCarousel";
import { productsAPI } from "../../utils/api";

interface ApiCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  display_order?: number;
}

interface Product {
  id: string;
  name: string;
  image?: string;
  image_url?: string;
  description?: string | null;
  price?: string | number | null;
  price_per_sqft?: number | string | null;
  subcategory?: string;
  category?: string;
  category_name?: string;
}

type CategorySection = {
  id: number;
  name: string;
  slug: string;
  products: CarouselProduct[];
};

export default function AllProductsByCategory() {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<CategorySection[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await productsAPI.getCategories();
        const categories: ApiCategory[] = Array.isArray(res?.categories) ? res.categories : [];
        const parents = categories
          .filter((c) => c.parent_id == null)
          .sort((a, b) => {
            const oa = a.display_order ?? 0;
            const ob = b.display_order ?? 0;
            if (oa !== ob) return oa - ob;
            return a.name.localeCompare(b.name);
          });

        const allResults = await Promise.all(
          parents.map((parent) =>
            productsAPI.getAll({
              category: parent.slug,
              limit: 100,
            })
          )
        );

        if (cancelled) return;

        const nextSections: CategorySection[] = parents.map((parent, index) => {
          const products = (allResults[index]?.products || []) as Product[];
          return {
            id: parent.id,
            name: parent.name,
            slug: parent.slug,
            products: products.map(
              (p): CarouselProduct => ({
                id: p.id,
                name: p.name,
                image: p.image,
                image_url: p.image_url,
                subcategory: p.subcategory,
                category_name: p.category_name,
                category: p.category,
                description: p.description,
                price: p.price,
                price_per_sqft: p.price_per_sqft,
              })
            ),
          };
        });

        setSections(nextSections);
      } catch (error) {
        console.error("Failed to load product sections:", error);
        if (!cancelled) setSections([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleSections = useMemo(() => sections.filter((s) => s.products.length > 0), [sections]);

  return (
    <section className="min-h-screen bg-white px-4 py-8 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none">
        <div className="flex gap-8">
          <Sidebar />
          <div className="flex-1 min-w-0 overflow-x-hidden">
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">All Products</h1>
              <p className="text-gray-600">Browse all categories and their products</p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : visibleSections.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No products available yet.</p>
                <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium mt-4 inline-block">
                  Go to home →
                </Link>
              </div>
            ) : (
              <div className="space-y-12">
                {visibleSections.map((section) => (
                  <section key={section.id} aria-labelledby={`cat-${section.id}`}>
                    <div className="mb-4 flex items-center justify-between gap-4 border-b border-gray-200 pb-2">
                      <h2 id={`cat-${section.id}`} className="text-xl font-semibold text-gray-900">
                        {section.name}
                      </h2>
                      <Link
                        href={`/products/${encodeURIComponent(section.slug)}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        View all →
                      </Link>
                    </div>
                    <ProductCarousel products={section.products} />
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Sidebar from "../../components/Sidebar";
import ProductCarousel, { type CarouselProduct } from "../../components/ProductCarousel";
import { productsAPI } from "../../../utils/api";

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
  is_new?: boolean;
}

function slugMatches(a: string, b: string): boolean {
  const x = decodeURIComponent(a).trim().toLowerCase();
  const y = decodeURIComponent(b).trim().toLowerCase();
  return x === y;
}

export default function CategoryProductsPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlugParam } = use(params);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [parentName, setParentName] = useState("");
  const [subsections, setSubsections] = useState<{ id: number; name: string; products: Product[] }[]>([]);
  const [fallbackProducts, setFallbackProducts] = useState<Product[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setNotFound(false);
      setSubsections([]);
      setFallbackProducts([]);
      setParentName("");

      try {
        const res = await productsAPI.getCategories();
        const categories: ApiCategory[] = Array.isArray(res?.categories) ? res.categories : [];

        const parent = categories.find(
          (c) => c.parent_id == null && c.slug && slugMatches(categorySlugParam, c.slug)
        );

        if (!parent) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const subs = categories
          .filter((c) => c.parent_id === parent.id)
          .sort((a, b) => {
            const oa = a.display_order ?? 0;
            const ob = b.display_order ?? 0;
            if (oa !== ob) return oa - ob;
            return a.name.localeCompare(b.name);
          });

        const catQuerySlug = parent.slug || categorySlugParam;

        if (!cancelled) {
          setParentName(parent.name);
        }

        if (subs.length === 0) {
          const flat = await productsAPI.getAll({ category: catQuerySlug, limit: 100 });
          if (!cancelled) setFallbackProducts(flat.products || []);
        } else {
          const results = await Promise.all(
            subs.map((sub) =>
              productsAPI.getAll({
                category: catQuerySlug,
                subcategory: sub.name,
                limit: 50,
              })
            )
          );
          if (!cancelled) {
            setSubsections(
              subs.map((sub, i) => ({
                id: sub.id,
                name: sub.name,
                products: (results[i]?.products || []) as Product[],
              }))
            );
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [categorySlugParam]);

  const carouselProducts = useMemo(
    () =>
      subsections.map((s) => ({
        ...s,
        carousel: s.products.map(
          (p): CarouselProduct => ({
            id: p.id,
            name: p.name,
            image: p.image,
            image_url: p.image_url,
            is_new: p.is_new,
          })
        ),
      })),
    [subsections]
  );

  return (
    <>
      <Navbar />
      <section className="min-h-screen bg-white px-4 py-8 pt-24 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-none">
          <div className="flex gap-8">
            <Sidebar />

            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Loading…</p>
                </div>
              ) : notFound ? (
                <div className="text-center py-12">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Category not found</h1>
                  <p className="text-gray-600 mb-6">We could not find a category matching this link.</p>
                  <Link href="/products" className="text-blue-600 hover:text-blue-700 font-medium">
                    View all products →
                  </Link>
                </div>
              ) : subsections.length === 0 ? (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{parentName}</h1>
                    <p className="text-gray-600">
                      {fallbackProducts.length}{" "}
                      {fallbackProducts.length === 1 ? "product" : "products"} in this category
                    </p>
                  </div>
                  {fallbackProducts.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 text-lg">No products in this category yet.</p>
                      <Link href="/products" className="text-blue-600 hover:text-blue-700 font-medium mt-4 inline-block">
                        View all products →
                      </Link>
                    </div>
                  ) : (
                    <ProductCarousel
                      products={fallbackProducts.map((p) => ({
                        id: p.id,
                        name: p.name,
                        image: p.image,
                        image_url: p.image_url,
                        is_new: p.is_new,
                      }))}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{parentName}</h1>
                    <p className="text-gray-600">Browse by subcategory</p>
                  </div>
                  <div className="space-y-12">
                    {carouselProducts.map((section) => (
                      <section key={section.id} aria-labelledby={`subcat-${section.id}`}>
                        <h2
                          id={`subcat-${section.id}`}
                          className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2"
                        >
                          {section.name}
                        </h2>
                        <ProductCarousel products={section.carousel} />
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

"use client";

import { use, useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import Sidebar from "../../components/Sidebar";
import { productsAPI, getProductImageUrl } from "../../../utils/api";

interface Product {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  price?: number | string;
  image?: string;
  image_url?: string;
  is_new?: boolean;
  category_slug?: string;
  category_name?: string;
}

export default function CategoryProductsPage({ params }: { params: Promise<{ category: string }> }) {
  const { category: categorySlug } = use(params);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedCategoryRef = useRef<string | null>(null);

  const titleFromSlug = categorySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  useEffect(() => {
    const fetchProducts = async () => {
      if (fetchedCategoryRef.current === categorySlug) return;
      fetchedCategoryRef.current = categorySlug;
      try {
        setLoading(true);
        const response = await productsAPI.getAll({ category: categorySlug, limit: 100 });
        setProducts(response.products || []);
      } catch (e) {
        fetchedCategoryRef.current = null;
        console.error("Error fetching products:", e);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [categorySlug]);

  const ProductCard = ({ product }: { product: Product }) => {
    const rawUrl = product.image_url || product.image;
    const imageSrc = getProductImageUrl(rawUrl);
    const isNew = product.is_new;
    const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");

    return (
      <Link href={`/products/product-detail?productId=${product.id}`}>
        <div className="group h-full cursor-pointer">
          <div className="w-full h-48 border border-gray-200 bg-gray-200 relative overflow-hidden">
            {imageSrc ? (
              isBackendUpload ? (
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  unoptimized
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {product.name}
              </h3>
              {isNew && (
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">New</span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <>
      <Navbar />
      <section className="py-8 px-4 bg-white min-h-screen pt-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-8">
            <Sidebar />

            <div className="flex-1">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{titleFromSlug}</h1>
                <p className="text-gray-600">
                  {loading ? "Loading…" : `${products.length} ${products.length === 1 ? "product" : "products"} found`}
                </p>
              </div>

              { loading ? (
                <div className="text-center py-12">
                  <p className="text-gray-600">Loading products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">No products in this category yet.</p>
                  <Link href="/products" className="text-blue-600 hover:text-blue-700 font-medium mt-4 inline-block">
                    View All Products →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

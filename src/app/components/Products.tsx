"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { productsAPI, getProductImageUrl } from "../../utils/api";
import Sidebar from "./Sidebar";

interface Product {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  description?: string | null;
  price?: string | number | null;
  price_per_sqft?: number | string | null;
  image?: string;
  image_url?: string;
  category_slug?: string;
  category_name?: string;
}

function descriptionPreview(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProductMoney(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).trim().replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

export default function Products() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryParam = searchParams.get("category");
  const searchParam = searchParams.get("search")?.trim() || null;
  const subcategoryParam = searchParams.get("subcategory")?.trim() || null;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryParam);
  const lastFetchedKeyRef = useRef<string>("");

  useEffect(() => {
    setSelectedCategory(categoryParam);
  }, [categoryParam]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params: Record<string, string | number> = { limit: 100 };
        if (selectedCategory) params.category = selectedCategory;
        if (subcategoryParam) params.subcategory = subcategoryParam;
        if (searchParam) params.search = searchParam;
        const requestKey = JSON.stringify(params);
        if (lastFetchedKeyRef.current === requestKey) return;
        lastFetchedKeyRef.current = requestKey;
        setLoading(true);
        const response = await productsAPI.getAll(params);
        setProducts(response.products || []);
      } catch (error) {
        lastFetchedKeyRef.current = "";
        console.error("Error fetching products:", error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [selectedCategory, searchParam, subcategoryParam]);

  const handleCategoryClick = (categorySlug: string) => {
    setSelectedCategory(categorySlug);
    router.push(`/products?category=${categorySlug}`);
  };

  const ProductCard = ({ product }: { product: Product }) => {
    const rawUrl = product.image_url || product.image;
    const imageSrc = getProductImageUrl(rawUrl);
    const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");
    const descPlain = descriptionPreview(product.description);
    const unit = parseProductMoney(product.price);
    const ppsf = parseProductMoney(product.price_per_sqft ?? undefined);
    const topLabel =
      product.subcategory?.trim() || product.category_name?.trim() || product.category?.trim() || "";

    return (
      <Link href={`/products/product-detail?productId=${product.id}`} className="block h-full">
        <div className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-md transition-all hover:border-gray-300 hover:shadow-lg">
          <div className="relative h-48 w-full overflow-hidden bg-gray-200">
            {imageSrc ? (
              isBackendUpload ? (
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
                  unoptimized
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-200">
                <svg
                  className="h-16 w-16 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 p-4">
            <div className="min-w-0">
              {topLabel ? (
                <p className="mb-1 text-xs text-gray-500 line-clamp-1">{topLabel}</p>
              ) : null}
              <h3 className="line-clamp-2 text-lg font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
                {product.name}
              </h3>
            </div>
            {descPlain ? (
              <p className="line-clamp-3 min-w-0 break-words text-sm text-gray-600 [overflow-wrap:anywhere]">{descPlain}</p>
            ) : null}
            {unit != null ? (
              <p className="text-lg font-bold text-gray-900">${unit.toFixed(2)}</p>
            ) : ppsf != null ? (
              <p className="text-sm text-gray-700">${ppsf.toFixed(2)}/ft²</p>
            ) : (
              <p className="text-sm text-gray-700">Price on request</p>
            )}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <section className="min-h-screen bg-white px-4 py-8 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-none">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          <Sidebar onCategoryClick={handleCategoryClick} />

          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {searchParam
                  ? `Search: "${searchParam}"`
                  : subcategoryParam
                    ? `Products: ${subcategoryParam}`
                    : selectedCategory
                      ? `Products: ${selectedCategory.replace(/-/g, " ")}`
                      : "All Products"}
              </h1>
              <p className="text-gray-600">
                {searchParam
                  ? "Products matching your search (by name, category, or subcategory)"
                  : subcategoryParam
                    ? "Showing products in this subcategory"
                    : selectedCategory
                      ? "Showing products in selected category"
                      : "Browse our complete product catalog. Products and categories are managed by admin."}
              </p>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading products...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  {searchParam
                    ? `No products found for "${searchParam}". Try a different search or category.`
                    : subcategoryParam || selectedCategory
                      ? "No products in this category yet."
                      : "No products yet. Admin can add products from Admin Panel."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

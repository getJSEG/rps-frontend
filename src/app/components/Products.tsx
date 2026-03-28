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
  price?: string | number | null;
  price_per_sqft?: number | string | null;
  image?: string;
  image_url?: string;
  isNew?: boolean;
  is_new?: boolean;
  category_slug?: string;
  category_name?: string;
}

/** Parse numeric money from API (pg often returns DECIMAL as string). */
function parseProductMoney(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).trim().replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/** Catalog line: main `price` from DB first, else `price_per_sqft`. */
function getCatalogPriceDisplay(product: Product): string {
  const unit = parseProductMoney(product.price);
  if (unit != null) return `$${unit.toFixed(2)}`;
  const ppsf = parseProductMoney(product.price_per_sqft ?? undefined);
  if (ppsf != null) return `$${ppsf.toFixed(2)}/sf`;
  return "";
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

  // Sync category from URL when it changes (e.g. from navbar search or sidebar)
  useEffect(() => {
    setSelectedCategory(categoryParam);
  }, [categoryParam]);

  // Fetch products: filter by category, subcategory, or search (product name / category / subcategory)
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

  // Product card — catalog style: sharp corners, light image well, title + grey price line (ref. signage grid)
  const ProductCard = ({ product }: { product: Product }) => {
    const rawUrl = product.image_url || product.image;
    const imageSrc = getProductImageUrl(rawUrl);
    const isNew = product.is_new || product.isNew;
    const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");

    const priceFromApi = getCatalogPriceDisplay(product);
    const metaParts: string[] = [];
    if (isNew) metaParts.push("New low price");
    if (priceFromApi) metaParts.push(priceFromApi);
    const metaLine = metaParts.join(" ");

    return (
      <Link href={`/products/product-detail?productId=${product.id}`} className="block h-full">
        <div className="group flex h-full cursor-pointer flex-col">
          {/* Bordered box = image only; title + price sit below, outside */}
          <div className="relative aspect-square w-full overflow-hidden rounded-sm border border-gray-200 bg-[#f5f5f5] transition-colors group-hover:border-gray-300">
            {imageSrc ? (
              isBackendUpload ? (
                <img
                  src={imageSrc}
                  alt={product.name}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  className="object-cover object-center"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 25vw, 20vw"
                  unoptimized
                />
              )
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#f5f5f5]">
                <svg
                  className="h-14 w-14 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col pt-3">
            <h3 className="text-left text-[15px] font-bold leading-snug tracking-tight text-gray-900">
              {product.name}
            </h3>
            {metaLine ? (
              <p className="mt-1.5 text-left text-sm font-normal leading-snug text-gray-500">{metaLine}</p>
            ) : null}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <section className="py-8 px-4 bg-white min-h-screen pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Sidebar - Left */}
          <Sidebar onCategoryClick={handleCategoryClick} />

          {/* Main Content - Right */}
          <div className="flex-1">
            {/* Page Title */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
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

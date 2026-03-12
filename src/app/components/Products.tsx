"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { productsAPI, getProductImageUrl } from "../../utils/api";
import Sidebar from "./Sidebar";

interface Product {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  price?: string;
  image?: string;
  image_url?: string;
  isNew?: boolean;
  is_new?: boolean;
  category_slug?: string;
  category_name?: string;
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

  // Sync category from URL when it changes (e.g. from navbar search or sidebar)
  useEffect(() => {
    setSelectedCategory(categoryParam);
  }, [categoryParam]);

  // Fetch products: filter by category, subcategory, or search (product name / category / subcategory)
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const params: Record<string, string | number> = { limit: 100 };
        if (selectedCategory) params.category = selectedCategory;
        if (subcategoryParam) params.subcategory = subcategoryParam;
        if (searchParam) params.search = searchParam;
        const response = await productsAPI.getAll(params);
        setProducts(response.products || []);
      } catch (error) {
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

  // Product Card Component - use native img for backend /uploads/ URLs so images always load
  const ProductCard = ({ product }: { product: Product }) => {
    const rawUrl = product.image_url || product.image;
    const imageSrc = getProductImageUrl(rawUrl);
    const isNew = product.is_new || product.isNew;
    const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");
    
    return (
      <Link href={`/products/product/${product.id}`}>
        <div className="group h-full cursor-pointer">
          {/* Product Image */}
          <div className="w-full h-48 border border-gray-200 bg-gray-200 relative overflow-hidden">
            {imageSrc ? (
              isBackendUpload ? (
                // Native img so backend URL loads without Next.js Image restrictions
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
                <svg
                  className="w-16 h-16 text-gray-400"
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

          {/* Product Info */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {product.name}
              </h3>
              {isNew && (
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full whitespace-nowrap">
                  New
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <section className="py-8 px-4 bg-white min-h-screen pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-8">
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

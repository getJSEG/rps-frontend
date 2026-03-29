"use client";

import { use, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import Sidebar from "../../../components/Sidebar";
import { productsAPI, getProductImageUrl } from "../../../../utils/api";

interface ProductProperty {
  key: string;
  value: string;
}

interface Product {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  price?: string | number;
  price_per_sqft?: number | null;
  min_charge?: number | null;
  material?: string | null;
  image?: string;
  image_url?: string;
  isNew?: boolean;
  is_new?: boolean;
  category_slug?: string;
  category_name?: string;
  description?: string;
  dimensions?: string;
  sizes?: string[];
  properties?: ProductProperty[];
}

export default function ProductDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);


  // Fetch product and related products from API
  useEffect(() => {
    const fetchProductData = async () => {
      try {
        setLoading(true);
        
        // Fetch current product
        const productResponse = await productsAPI.getById(productId);
        const product = productResponse.product;
        setCurrentProduct(product);
        
        // Fetch related products (same category)
        if (product?.category_slug) {
          const relatedResponse = await productsAPI.getAll({ category: product.category_slug });
          const related = (relatedResponse.products || []).filter(
            (p: Product) => p.id !== productId
          );
          // Ensure at least 5 different products, if less fetch from all products
          if (related.length < 5) {
            const allResponse = await productsAPI.getAll();
            const additional = (allResponse.products || []).filter(
              (p: Product) => p.id !== productId && !related.find((r: Product) => r.id === p.id)
            );
            setRelatedProducts([...related, ...additional].slice(0, 10));
          } else {
            setRelatedProducts(related.slice(0, 10));
          }
        } else {
          // Fallback: fetch all products and filter by category
          const allResponse = await productsAPI.getAll();
          const related = (allResponse.products || []).filter(
            (p: Product) => p.category_slug === product?.category_slug && p.id !== productId
          );
          // If less than 5, add more products from different categories
          if (related.length < 5) {
            const additional = (allResponse.products || []).filter(
              (p: Product) => p.id !== productId && !related.find((r: Product) => r.id === p.id)
            );
            setRelatedProducts([...related, ...additional].slice(0, 10));
          } else {
            setRelatedProducts(related.slice(0, 10));
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        // Fallback to sample data
        const fallbackProducts = getFallbackProducts();
        const product = fallbackProducts.find(p => p.id === productId);
        if (product) {
          setCurrentProduct(product);
          const related = fallbackProducts.filter(
            p => p.category_slug === product.category_slug && p.id !== productId
          );
          setRelatedProducts(related);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchProductData();
  }, [productId]);

  // Fallback products
  function getFallbackProducts(): Product[] {
    return [
      { id: "1", name: "Channel Letters", category: "Channel Letters", category_slug: "channel-letters", image: "/0a3pGsJF-s1000.jpg", isNew: false },
      { id: "2", name: "Advertising Flags", category: "Advertising Flags", category_slug: "advertising-flags", image: "/0EVddVW5-s1000.jpg", isNew: false },
      { id: "3", name: "Banner Stands", category: "Banner Stands", category_slug: "banner-stands", image: "/22UuQewt-s1000.jpg", isNew: false },
      { id: "4", name: "SEG Products", category: "SEG Products", category_slug: "seg-products", image: "/2koFWu1n-s1000.jpg", isNew: true },
      { id: "5", name: "Custom Event Tents", category: "Custom Event Tents", category_slug: "custom-event-tents", image: "/2qE7fUaG-s1000.jpg", isNew: true },
      { id: "6", name: "Table Throws", category: "Table Throws", category_slug: "table-throws", image: "/3PVhOONT-s1000.jpg", isNew: true },
      { id: "7", name: "Real Estate Products", category: "Real Estate Products", category_slug: "real-estate-products", image: "/3XJNimyc-s1000.jpg", isNew: false },
      { id: "8", name: "A Frame and Sign Holders", category: "A Frame and Sign Holders", category_slug: "a-frame-sign-holders", image: "/4Uag4HyR-s1000.jpg", isNew: false },
      { id: "9", name: "13oz Vinyl Banner", category: "13oz Vinyl Banner", category_slug: "13oz-vinyl-banner", image: "/5HeAGSx1-s1000.jpg", isNew: false },
      { id: "10", name: "18oz Blockout Banner", category: "18oz Blockout Banner", category_slug: "18oz-blockout-banner", image: "/5N2zezcP-s1000.jpg", isNew: false },
      { id: "11", name: "Backlit Banner", category: "Backlit Banner", category_slug: "backlit-banner", image: "/66xRJHT0-s1000.jpg", isNew: false },
      { id: "12", name: "Mesh Banner", category: "Mesh Banner", category_slug: "mesh-banner", image: "/6FfR6FwW-s1000.jpg", isNew: false },
      { id: "13", name: "Hand Banner", category: "Hand Banner", category_slug: "hand-banner", image: "/6yPYGfuF-s1000.jpg", isNew: true },
      { id: "14", name: "Pole Banner", category: "Pole Banner", category_slug: "pole-banner", image: "/6ZjLmOJF-s1000.jpg", isNew: false },
      { id: "15", name: "9oz Fabric Banner", category: "9oz Fabric Banner", category_slug: "9oz-fabric-banner", image: "/7QbBfFk9-s1000.jpg", isNew: false },
      { id: "16", name: "Wall Art", category: "Wall Art", category_slug: "wall-art", image: "/8mjXQEYk-s1000.jpg", isNew: false },
      { id: "17", name: "Wall Murals", category: "Wall Murals", category_slug: "wall-murals", image: "/8MQlJCEz-s1000.jpg", isNew: true },
      { id: "18", name: "Adhesive Products", category: "Adhesive Products", category_slug: "adhesive-products", image: "/9xYzzcPo-s1000.jpg", isNew: false },
      { id: "19", name: "DTF and UV DTF", category: "DTF and UV DTF", category_slug: "dtf-uv-dtf", image: "/9y32Vjgz-s1000.jpg", isNew: true },
      { id: "20", name: "Backlit Film", category: "Backlit Film", category_slug: "backlit-film", image: "/AmpUzEJp-s1000.jpg", isNew: false },
      { id: "21", name: "Premium Window Cling", category: "Premium Window Cling", category_slug: "premium-window-cling", image: "/AX2oZYTK-s1000.jpg", isNew: false },
      { id: "22", name: "Posters", category: "Posters", category_slug: "posters", image: "/BiyOyxQf-s1000.jpg", isNew: false },
  ];
  }

  // Product Card Component - use native img for backend /uploads/ so images load
  const ProductCard = ({ product }: { product: Product }) => {
    const rawUrl = product.image_url || product.image;
    const imageSrc = getProductImageUrl(rawUrl);
    const isNew = product.is_new || product.isNew;
    const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");
    
    return (
    <Link href={`/products/product-detail?productId=${product.id}`}>
      <div className="group h-full cursor-pointer">
        {/* Product Image */}
        <div className="w-full h-48 border border-gray-200 bg-gray-200 relative overflow-hidden">
            {imageSrc ? (
              isBackendUpload ? (
                <img src={imageSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <Image
                  src={imageSrc}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
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

  if (loading) {
    return (
      <>
        <Navbar />
        <section className="py-8 px-4 bg-white min-h-screen pt-24">
          <div className="w-full max-w-none mx-auto text-center">
            <p className="text-gray-600">Loading product...</p>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  if (!currentProduct) {
    return (
      <>
        <Navbar />
        <section className="py-8 px-4 bg-white min-h-screen pt-24">
          <div className="w-full max-w-none mx-auto text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Product Not Found</h1>
            <Link href="/products" className="text-blue-600 hover:text-blue-700">
              ← Back to Products
            </Link>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <section className="py-8 px-4 bg-white min-h-screen pt-24">
        <div className="w-full max-w-none mx-auto">
          <div className="flex gap-8">
            {/* Sidebar - Left */}
            <Sidebar showAllProductsButton={false} />

            {/* Main Content - Right */}
            <div className="flex-1">
              {/* Breadcrumb */}
              <div className="mb-6">
                <Link href="/products" className="text-blue-600 hover:text-blue-700 text-sm">
                  ← Back to Products
                </Link>
              </div>
              {/* Related Products by Size Categories */}
              <div className="mb-12 text-center ">
                {(() => {
                  // Define size categories
                  const sizeCategories = [
                    { name: "10' x 15'", slug: "10x15" },
                    { name: "10' x 20'", slug: "10x20" },
                    { name: "10' x 25'", slug: "10x25" },
                    { name: "10' x 30'", slug: "10x30" },
                  ];

                  // Group products by size categories (3 products per category)
                  const productsPerCategory = 3;
                  const totalCategories = Math.ceil(Math.max(5, relatedProducts.length) / productsPerCategory);
                  
                  return sizeCategories.slice(0, totalCategories).map((category, categoryIndex) => {
                    const startIndex = categoryIndex * productsPerCategory;
                    const categoryProducts = relatedProducts.slice(startIndex, startIndex + productsPerCategory);
                    
                    if (categoryProducts.length === 0) return null;
                    
                    return (
                      <div key={category.slug} className="mb-12">
                        {/* Category Heading */}
                        <h3 className="text-4xl font-semibold  text-gray-700 tracking-tight mb-6 text-center">{category.name} Custom Event Tents</h3>
                        
                        {/* Products Grid - 3 products per category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                          {categoryProducts.map((product, productIndex) => {
                            const rawUrl = product.image_url || product.image;
                            const imageSrc = getProductImageUrl(rawUrl);
                            const isNew = product.is_new || product.isNew;
                            const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");
                            
                            return (
                              <Link key={product.id} href={`/products/product-detail?productId=${product.id}`}>
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden group cursor-pointer h-full flex flex-col">
                      {/* Product Image */}
                      <div className="w-full h-64 border-b border-gray-200 bg-gray-200 relative overflow-hidden">
                                    {imageSrc ? (
                          <>
                                        {isNew && (
                                          <div className="absolute top-2 left-2 z-10 bg-gray-800 text-white text-xs px-2 py-1 rounded font-medium">
                                New Low Price
                              </div>
                            )}
                            {isBackendUpload ? (
                              <img src={imageSrc} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <Image
                                src={imageSrc}
                                alt={product.name}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              />
                            )}
                          </>
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
                                  <div className="p-5 flex-1 flex flex-col">
                                    <h3 className="text-lg font-semibold text-start text-gray-900 mb-3  transition-colors">
                                      {product.name}
                                    </h3>
                                    
                                    {/* Description / Properties / Specs (price, price per sq ft, min charge, material) */}
                                    {product.description ? (
                                      <div className="mb-3 space-y-1">
                                        {product.description.split('\n').map((line, idx) => (
                                          <p key={idx} className="text-sm text-start text-gray-600">
                                            {line}
                                          </p>
                                        ))}
                                      </div>
                                    ) : product.properties && Array.isArray(product.properties) && product.properties.some((p) => (p.key && p.key.trim()) || (p.value && p.value.trim())) ? (
                                      <ul className="mb-3 space-y-1 list-disc list-inside text-sm text-start text-gray-600">
                                        {product.properties
                                          .filter((p) => (p.key && p.key.trim()) || (p.value && p.value.trim()))
                                          .map((p, idx) => (
                                            <li key={idx}>
                                              {p.key && p.key.trim() ? `${p.key}: ${p.value || ""}` : p.value || ""}
                                            </li>
                                          ))}
                                      </ul>
                                    ) : (() => {
                                      const specs: string[] = [];
                                      if (product.price != null && product.price !== "") specs.push(`Price: $${typeof product.price === "number" ? product.price : product.price}`);
                                      if (product.price_per_sqft != null) specs.push(`Price per sq ft: $${product.price_per_sqft}`);
                                      if (product.min_charge != null) specs.push(`Min charge: $${product.min_charge}`);
                                      if (product.material && String(product.material).trim()) specs.push(`Material: ${product.material}`);
                                      if (specs.length > 0) {
                                        return (
                                          <ul className="mb-3 space-y-1 list-disc list-inside text-sm text-start text-gray-600">
                                            {specs.map((s, i) => <li key={i}>{s}</li>)}
                                          </ul>
                                        );
                                      }
                                      return (
                                        <div className="mb-3 space-y-1">
                                          <p className="text-sm text-start text-gray-600">{category.name} aluminum frame</p>
                                          <p className="text-sm text-start text-gray-600">Complete set - canopy with wall options</p>
                                        </div>
                                      );
                                    })()}
                                    
                                    {/* Price */}
                                    {product.price != null && product.price !== "" ? (
                                      <div className="w-full border-t border-gray-200 pt-2 flex justify-between items-center gap-2 mt-auto">
                                        <p className="text-base font-bold text-gray-900">Starting at</p>
                                        <p className="text-base font-bold text-gray-900">
                                          ${typeof product.price === "number" ? product.price : product.price}
                                        </p>
                                      </div>
                                    ) : null}
                        </div>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
                </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}


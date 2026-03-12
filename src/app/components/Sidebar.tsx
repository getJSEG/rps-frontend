"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { productsAPI } from "../../utils/api";

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description?: string | null;
  product_count?: number;
}

interface SidebarProps {
  onCategoryClick?: (categorySlug: string) => void;
  showAllProductsButton?: boolean;
}

export default function Sidebar({ onCategoryClick, showAllProductsButton = true }: SidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const slugFromPath = pathname?.match(/^\/products\/([^/]+)$/)?.[1];
  const selectedCategory = searchParams.get("category") || (slugFromPath && slugFromPath !== "product" ? slugFromPath : null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await productsAPI.getCategories();
        setCategories(res.categories || []);
      } catch (e) {
        console.error("Error fetching categories:", e);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const parentCategories = categories.filter((c) => !c.parent_id);
  const childCategories = categories.filter((c) => c.parent_id != null);

  const handleCategoryClick = (categorySlug: string) => {
    if (onCategoryClick) onCategoryClick(categorySlug);
    router.push(`/products/${categorySlug}`);
  };

  const handleClearFilter = () => {
    router.push("/");
  };

  const getChildren = (parentId: number) =>
    childCategories.filter((c) => c.parent_id === parentId);

  return (
    <aside className="w-64 shrink-0 bg-white border border-gray-200 p-4">
      <div className="space-y-8 sticky top-24">
        {showAllProductsButton && (
          <button
            onClick={handleClearFilter}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !selectedCategory ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            All Products
          </button>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading categories...</p>
        ) : parentCategories.length === 0 ? (
          <p className="text-sm text-gray-500">No categories yet. Admin can add from Admin Panel.</p>
        ) : (
          parentCategories.map((parent) => {
            const children = getChildren(parent.id);
            return (
              <div key={parent.id}>
                <h3 className="text-md font-bold text-gray-900 mb-4">{parent.name}</h3>
                <ul className="space-y-2">
                  {children.length > 0 ? (
                    children.map((child) => {
                      const isSelected = selectedCategory === child.slug;
                      return (
                        <li key={child.id}>
                          <button
                            onClick={() => handleCategoryClick(child.slug)}
                            className={`w-full flex items-center justify-between text-sm py-1.5 px-2 rounded transition-colors ${
                              isSelected
                                ? "bg-gray-100 text-gray-900 font-medium"
                                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                            }`}
                          >
                            <span>{child.name}</span>
                            {/* <svg className="w-4 h-4 text-gray-400 shrink-0"
                                 fill="none" stroke="currentColor" viewBox="0 0 24 24" >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg> */}
                          </button>
                        </li>
                      );
                    })
                  ) : (
                    <li>
                      <button
                        onClick={() => handleCategoryClick(parent.slug)}
                        className={`w-full flex items-center justify-between text-sm py-1.5 px-2 rounded transition-colors ${
                          selectedCategory === parent.slug
                            ? "bg-gray-100 text-gray-900 font-medium"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                        }`}
                      >
                        <span>{parent.name}</span>
                        <svg
                          className="w-4 h-4 text-gray-400 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

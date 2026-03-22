"use client";

import { useState, useEffect, useMemo } from "react";
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

function CategorySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-3 w-24 bg-gray-200 mb-2" />
          <div className="space-y-1 pl-2 border-l border-gray-100">
            <div className="h-6 bg-gray-100" />
            <div className="h-6 bg-gray-100 w-[92%]" />
            <div className="h-6 bg-gray-100 w-[80%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar({ onCategoryClick, showAllProductsButton = true }: SidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const slugFromPath = pathname?.match(/^\/products\/([^/]+)$/)?.[1];
  const selectedCategory = searchParams.get("category") || (slugFromPath && slugFromPath !== "product" ? slugFromPath : null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

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

  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const childCategories = useMemo(() => categories.filter((c) => c.parent_id != null), [categories]);

  // Keep the parent expanded when a subcategory in that group is selected (e.g. deep link).
  useEffect(() => {
    if (!selectedCategory || categories.length === 0) return;
    const selectedChild = categories.find(
      (c) => c.parent_id != null && c.slug === selectedCategory
    );
    const parentId = selectedChild?.parent_id;
    if (parentId != null) {
      setOpenGroups((prev) => ({ ...prev, [parentId]: true }));
    }
  }, [selectedCategory, categories]);

  const handleCategoryClick = (categorySlug: string) => {
    if (onCategoryClick) onCategoryClick(categorySlug);
    router.push(`/products/${categorySlug}`);
  };

  const handleClearFilter = () => {
    router.push("/");
  };

  const getChildren = (parentId: number) => childCategories.filter((c) => c.parent_id === parentId);

  const toggleGroup = (parentId: number) => {
    setOpenGroups((prev) => ({ ...prev, [parentId]: !(prev[parentId] ?? false) }));
  };

  return (
    <aside className="w-full lg:w-52 xl:w-56 shrink-0">
      <div className="sticky top-24 z-10 rounded-sm border border-gray-200/50 bg-white shadow-[4px_0_14px_-4px_rgba(15,23,42,0.1),0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="rounded-t-sm border-b border-gray-200/60 bg-gray-100/95 px-3 py-2.5">
          <h2 className="text-xs font-normal uppercase tracking-wider text-gray-600">Categories</h2>
        </div>

        <div className="px-2 py-2">
          {showAllProductsButton && (
            <button
              type="button"
              onClick={handleClearFilter}
              className={`w-full text-left text-sm font-bold py-1.5 px-2 rounded-md transition-colors ${
                !selectedCategory
                  ? "bg-blue-50/70 text-blue-800"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              All products
            </button>
          )}

          {loading ? (
            <div className="pt-2 px-1">
              <CategorySkeleton />
            </div>
          ) : parentCategories.length === 0 ? (
            <p className="text-xs text-gray-500 px-2 py-4 text-center leading-relaxed">
              No categories yet. Admin can add them from the admin panel.
            </p>
          ) : (
            <div className="pt-1">
              {parentCategories.map((parent, index) => {
                const children = getChildren(parent.id);
                const isOpen = openGroups[parent.id] ?? false;
                const hasChildren = children.length > 0;
                const parentSelected = !hasChildren && selectedCategory === parent.slug;

                return (
                  <div key={parent.id} className={index > 0 ? "mt-1 pt-1 border-t border-gray-100" : ""}>
                    {hasChildren ? (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleGroup(parent.id)}
                          className="flex w-full items-center gap-1.5 py-1.5 px-2 text-left text-sm font-normal text-gray-900 rounded-md hover:bg-gray-50/90"
                          aria-expanded={isOpen}
                        >
                          <span className="min-w-0 flex-1 truncate">{parent.name}</span>
                          <span className="shrink-0 text-[10px] font-normal text-gray-400 tabular-nums">
                            {children.length}
                          </span>
                          <svg
                            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <div
                          className={`grid transition-[grid-template-rows] duration-150 ease-out ${
                            isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                          }`}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <ul className="ml-1 pl-2 border-l border-gray-200/90 space-y-0">
                              {children.map((child) => {
                                const isSelected = selectedCategory === child.slug;
                                return (
                                  <li key={child.id}>
                                    <button
                                      type="button"
                                      onClick={() => handleCategoryClick(child.slug)}
                                      className={`group w-full flex items-center justify-between gap-1.5 py-1 pl-1.5 pr-1 text-left text-sm leading-tight border-l-2 rounded-r-md transition-colors ${
                                        isSelected
                                          ? "border-blue-600 text-blue-800 font-medium bg-blue-50/50"
                                          : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/80"
                                      }`}
                                    >
                                      <span className="truncate">{child.name}</span>
                                      {child.product_count != null && child.product_count > 0 && (
                                        <span
                                          className={`shrink-0 text-[10px] tabular-nums text-gray-400 group-hover:text-gray-500 ${
                                            isSelected ? "text-blue-600/80" : ""
                                          }`}
                                        >
                                          {child.product_count}
                                        </span>
                                      )}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(parent.slug)}
                        className={`flex w-full items-center justify-between gap-2 py-1.5 px-2 text-left text-sm rounded-md transition-colors border-l-2 ${
                          parentSelected
                            ? "border-blue-600 bg-blue-50/70 text-blue-800 font-medium"
                            : "border-transparent text-gray-800 hover:bg-gray-50/90"
                        }`}
                      >
                        <span className="truncate font-normal">{parent.name}</span>
                        <svg
                          className="h-3.5 w-3.5 shrink-0 text-gray-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

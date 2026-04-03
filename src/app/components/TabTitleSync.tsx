"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { documentTitleFromRoute } from "../../utils/tabTitle";

/** Keeps the browser tab title in sync with the route (navbar and any in-app navigation). */
export default function TabTitleSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const productsSearch = pathname === "/products" ? searchParams.get("search") : null;

  useEffect(() => {
    const apply = () => {
      const next = documentTitleFromRoute(pathname, productsSearch);
      if (next != null) {
        document.title = next;
      }
    };
    apply();
    window.addEventListener("navbarCategoriesUpdated", apply);
    return () => window.removeEventListener("navbarCategoriesUpdated", apply);
  }, [pathname, productsSearch]);

  return null;
}

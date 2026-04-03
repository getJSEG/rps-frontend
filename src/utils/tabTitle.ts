export const SITE_TAB_TITLE = "Resourceful Print Solution";

export function pageTitle(pageLabel: string): string {
  return `${pageLabel} | ${SITE_TAB_TITLE}`;
}

function titleCaseSlug(segment: string): string {
  let s = segment;
  try {
    s = decodeURIComponent(segment);
  } catch {
    /* ignore */
  }
  return s
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

interface StoredNavCategory {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

/**
 * Tab label for `/products/[slug]`: parent category name when slug is a subcategory
 * (matches `navbarCategories` from the Navbar API cache).
 */
function tabTitleForProductsPathSlug(pathSegment: string): string | null {
  if (typeof window === "undefined") return null;
  const key = decodeURIComponent(pathSegment).trim().toLowerCase();
  if (!key) return null;
  try {
    const raw = localStorage.getItem("navbarCategories");
    if (!raw) return null;
    const list = JSON.parse(raw) as StoredNavCategory[];
    if (!Array.isArray(list)) return null;
    const match = list.find((c) => String(c.slug).trim().toLowerCase() === key);
    if (!match?.name?.trim()) return null;
    if (match.parent_id == null) return match.name.trim();
    const parent = list.find((c) => c.id === match.parent_id);
    return parent?.name?.trim() || match.name.trim();
  } catch {
    return null;
  }
}

const EXACT: Record<string, string> = {
  "/": "Home",
  "/products": "All Products",
  "/cart": "Cart",
  "/register": "Register",
  "/orders": "Orders",
  "/estimates": "Estimates",
  "/account-settings": "Account Settings",
  "/change-password": "Change Password",
  "/credit-cards": "Manage Credit Cards",
  "/messages": "Messages",
  "/address-book": "Address Book",
  "/checkout": "Checkout",
  "/favorite-jobs": "Favorite Jobs",
  "/claims": "Claims",
  "/my-artworks": "My Artworks",
  "/pending-payment": "Pending Payment",
  "/payment-success": "Payment Success",
  "/reseller-permit": "Reseller Permit",
  "/testimonial": "Testimonials",
  "/white-label": "White Label",
  "/admin": "Admin",
};

/**
 * Tab title for the current URL, or null when a page sets `document.title` itself
 * (e.g. product detail with the loaded product name).
 */
export function documentTitleFromRoute(
  pathname: string | null,
  productsSearch: string | null
): string | null {
  if (!pathname) return SITE_TAB_TITLE;

  if (pathname === "/products/product-detail" || pathname.startsWith("/products/product-detail/")) {
    return null;
  }

  if (pathname === "/products" && productsSearch?.trim()) {
    return pageTitle("Search");
  }

  const exact = EXACT[pathname];
  if (exact) return pageTitle(exact);

  const singleSegment = pathname.match(/^\/products\/([^/]+)$/);
  if (singleSegment) {
    const seg = singleSegment[1];
    if (seg === "product-detail") return null;
    const fromNav = tabTitleForProductsPathSlug(seg);
    return pageTitle(fromNav ?? titleCaseSlug(seg));
  }

  if (pathname.startsWith("/products/product/")) {
    return pageTitle("Product");
  }

  if (pathname.startsWith("/admin/")) {
    const rest = pathname.slice("/admin/".length);
    if (rest.startsWith("orders/")) return pageTitle("Admin Order");
    if (rest.startsWith("products")) return pageTitle("Admin Products");
    if (rest.startsWith("users")) return pageTitle("Admin Users");
    if (rest.startsWith("refunds")) return pageTitle("Admin Refunds");
    if (rest.startsWith("shipping-rates")) return pageTitle("Shipping Rates");
    if (rest.startsWith("employees")) return pageTitle("Admin Employees");
    if (rest.startsWith("cart-item/")) return pageTitle("Admin Cart Item");
    return pageTitle("Admin");
  }

  return SITE_TAB_TITLE;
}

"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { toast } from "react-toastify";
import {
  productsAPI,
  getProductImageUrl,
  cartAPI,
  addressesAPI,
  shippingRatesAPI,
  shippingAmountForService,
  type ShippingRates,
} from "../../../utils/api";
import { isAuthenticated } from "../../../utils/roles";

interface ProductProperty {
  key: string;
  value: string;
}

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
  description?: string;
  dimensions?: string;
  sizes?: string[];
  material?: string;
  price_per_sqft?: number;
  min_charge?: number;
  properties?: ProductProperty[];
}

interface SavedAddress {
  id: number;
  street_address: string;
  address_line2: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  is_default: boolean;
  address_type: string;
  updated_at?: string | null;
}

function parseSavedAddressBool(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string") {
    const s = v.toLowerCase();
    return s === "true" || s === "1" || s === "t";
  }
  return false;
}

function normalizeSavedAddress(raw: Record<string, unknown>): SavedAddress {
  return {
    id: Number(raw.id),
    street_address: String(raw.street_address ?? raw.streetAddress ?? ""),
    address_line2: raw.address_line2 != null || raw.addressLine2 != null ? String(raw.address_line2 ?? raw.addressLine2) : null,
    city: String(raw.city ?? ""),
    state: String(raw.state ?? ""),
    postcode: String(raw.postcode ?? ""),
    country: String(raw.country ?? "United States"),
    is_default: parseSavedAddressBool(raw.is_default ?? raw.isDefault),
    address_type: String(raw.address_type ?? raw.addressType ?? "billing"),
    updated_at:
      raw.updated_at != null
        ? String(raw.updated_at)
        : raw.updatedAt != null
          ? String(raw.updatedAt)
          : null,
  };
}

/** Collapse legacy duplicate defaults to the most recently updated row */
function ensureSingleDefaultAddress(addresses: SavedAddress[]): SavedAddress[] {
  const d = addresses.filter((a) => a.is_default);
  if (d.length <= 1) return addresses;
  const ts = (a: SavedAddress) => {
    const t = a.updated_at ? Date.parse(a.updated_at) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  const keep = d.reduce((best, a) => {
    const bt = ts(best);
    const at = ts(a);
    if (at > bt) return a;
    if (at < bt) return best;
    return a.id > best.id ? a : best;
  });
  return addresses.map((a) => ({ ...a, is_default: a.id === keep.id }));
}

/** Single account default (any type), else first shipping, else first billing, else first row */
function pickDisplayShippingAddress(addresses: SavedAddress[]): SavedAddress | null {
  const normalized = ensureSingleDefaultAddress(addresses);
  if (!normalized.length) return null;
  const globalDefault = normalized.find((a) => a.is_default);
  if (globalDefault) return globalDefault;
  const shipping = normalized.filter((a) => a.address_type === "shipping");
  const billing = normalized.filter((a) => a.address_type === "billing");
  return shipping[0] || billing[0] || normalized[0];
}

function ProductDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get("productId");
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [width, setWidth] = useState("0");
  const [height, setHeight] = useState("0");
  const [jobName, setJobName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [productType, setProductType] = useState("canopy-frame"); // "canopy-frame" or "canopy-only"
  const [reinforcedStrip, setReinforcedStrip] = useState("White");
  const [carryBag, setCarryBag] = useState("Standard Bag");
  const [sandbag, setSandbag] = useState("No");
  const [fullWall, setFullWall] = useState("1 Full Wall");
  const [halfWall, setHalfWall] = useState("1 Half Wall (Single Sided)");
  const [shipping, setShipping] = useState("blind-drop");
  const [shippingService, setShippingService] = useState("Ground");
  const [activeTab, setActiveTab] = useState("description");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [subcategories, setSubcategories] = useState<Array<{name: string; slug: string; image_url?: string}>>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [subcategoryProducts, setSubcategoryProducts] = useState<Product[]>([]);
  const [loadingSubcategoryProducts, setLoadingSubcategoryProducts] = useState(false);
  const [imageZoom, setImageZoom] = useState({ x: 50, y: 50, scale: 1 });
  const [message, setMessage] = useState("");
  const [shippingAuthReady, setShippingAuthReady] = useState(false);
  const [shippingUserLoggedIn, setShippingUserLoggedIn] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [shippingRates, setShippingRates] = useState<ShippingRates | null>(null);
  const fetchedProductForRef = useRef<string | null>(null);
  const fetchedRelatedForRef = useRef<string | null>(null);
  const fetchedAddressesOnceRef = useRef(false);

  // Default pricing values (can be overridden by product data)
  const pricePerSqFt = product?.price_per_sqft || 3.63;
  const minCharge = product?.min_charge || 8.0;
  const sameDayFee = 8.0;

  // Fetch product data - Reset and fetch when productId changes
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        setProduct(null);
        setLoading(false);
        fetchedProductForRef.current = null;
        return;
      }
      if (fetchedProductForRef.current === String(productId)) return;
      fetchedProductForRef.current = String(productId);

      try {
        // Reset product state when productId changes
        setProduct(null);
        setLoading(true);
        const response = await productsAPI.getById(String(productId));
        const fetchedProduct = response.product || response;
        if (fetchedProduct && String(fetchedProduct.id) === String(productId)) {
          setProduct(fetchedProduct);
        } else {
          setProduct(null);
        }
      } catch (_) {
        fetchedProductForRef.current = null;
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await shippingRatesAPI.get();
        if (!cancelled && res?.rates) setShippingRates(res.rates);
      } catch {
        if (!cancelled) setShippingRates(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch related products from different categories
  useEffect(() => {
    const fetchRelatedProducts = async () => {
      if (!productId) return;
      if (fetchedRelatedForRef.current === String(productId)) return;
      fetchedRelatedForRef.current = String(productId);

      try {
        setLoadingRelated(true);
        const response = await productsAPI.getRelated(productId, 8);
        if (response && response.products) {
          setRelatedProducts(response.products);
        } else if (Array.isArray(response)) {
          setRelatedProducts(response);
        } else {
          setRelatedProducts([]);
        }
      } catch (_) {
        fetchedRelatedForRef.current = null;
        setRelatedProducts([]);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelatedProducts();
  }, [productId]);

  // Fetch subcategories from same category
  useEffect(() => {
    const fetchSubcategories = async () => {
      if (!product?.category_slug) return;
      try {
        const response = await productsAPI.getAll({ category: product.category_slug });
        const products = response.products || [];
        const subcategoryMap = new Map<string, { name: string; image_url?: string }>();
        products.forEach((p: Product) => {
          if (p.subcategory && !subcategoryMap.has(p.subcategory)) {
            subcategoryMap.set(p.subcategory, {
              name: p.subcategory,
              image_url: p.image_url || p.image
            });
          }
        });
        const subcats = Array.from(subcategoryMap.values()).map(sub => ({
          name: sub.name,
          slug: sub.name.toLowerCase().replace(/\s+/g, '-'),
          image_url: sub.image_url
        }));
        setSubcategories(subcats);
      } catch (_) {
        setSubcategories([]);
      }
    };

    if (product) {
      fetchSubcategories();
    }
  }, [product?.category_slug, product]);

  // Fetch products for selected subcategory
  useEffect(() => {
    const fetchSubcategoryProducts = async () => {
      if (!selectedSubcategory || !product?.category_slug) {
        setSubcategoryProducts([]);
        return;
      }

      try {
        setLoadingSubcategoryProducts(true);
        // Fetch products by category and subcategory
        const response = await productsAPI.getAll({ 
          category: product.category_slug,
          subcategory: selectedSubcategory
        });
        
        let products = response.products || [];
        
        // Ensure minimum 4 products - if less, fetch more from same category
        if (products.length < 4) {
          const allCategoryResponse = await productsAPI.getAll({ 
            category: product.category_slug 
          });
          const allCategoryProducts = allCategoryResponse.products || [];
          
          // Add products from same category but different subcategories
          const additionalProducts = allCategoryProducts
            .filter((p: Product) => 
              p.id !== productId && 
              !products.find((sp: Product) => sp.id === p.id)
            )
            .slice(0, 4 - products.length);
          
          products = [...products, ...additionalProducts];
        }
        
        // Limit to at least 4 products
        setSubcategoryProducts(products.slice(0, Math.max(4, products.length)));
      } catch (error) {
        console.error('Error fetching subcategory products:', error);
        setSubcategoryProducts([]);
      } finally {
        setLoadingSubcategoryProducts(false);
      }
    };

    fetchSubcategoryProducts();
  }, [selectedSubcategory, product?.category_slug, productId]);

  // Calculate area in square feet
  const widthInches = parseFloat(width) || 0;
  const heightInches = parseFloat(height) || 0;
  const areaSqFt = (widthInches * heightInches) / 144;
  const basePrice = Math.max(areaSqFt * pricePerSqFt, minCharge);
  const qty = parseFloat(quantity) || 1;
  const unitPrice = basePrice;
  const subtotal = unitPrice * qty;
  const shippingCost = shippingAmountForService(shippingRates, shippingService);
  const total = subtotal + shippingCost;

  // Handle Add to Cart (logged-in or guest via X-Guest-Session-Id from api.ts)
  const handleAddToCart = async () => {
    // Validation
    if (!jobName.trim()) {
      setMessage("❌ Error: Please enter Job Name/PO#");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    if (widthInches <= 0 || heightInches <= 0) {
      setMessage("❌ Error: Width and Height must be greater than 0");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    setAddingToCart(true);
    setMessage("");

    try {
      // Extract fullWall and halfWall quantities from strings
      const fullWallQty = parseInt(fullWall.match(/\d+/)?.[0] || "0") || 0;
      const halfWallQty = parseInt(halfWall.match(/\d+/)?.[0] || "0") || 0;

      // Create cart item
      const cartItem = {
        productId: productId,
        productName: productName,
        productImage: imageSrc,
        width: widthInches,
        height: heightInches,
        areaSqFt: parseFloat(areaSqFt.toFixed(2)),
        quantity: qty,
        jobName: jobName.trim(),
        turnaround: "free-same-day",
        shipping: shipping,
        shippingService: shippingService,
        emailProof: false,
        fullWall: fullWallQty,
        halfWall: halfWallQty,
        totalJobs: 1,
        productType: productType,
        reinforcedStrip: reinforcedStrip,
        carryBag: carryBag,
        sandbag: sandbag,
        unitPrice: parseFloat(unitPrice.toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        shippingCost: parseFloat(shippingCost.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        pricePerSqFt: pricePerSqFt,
        minCharge: minCharge,
        material: productMaterial,
        timestamp: new Date().toISOString()
      };

      await cartAPI.add(cartItem);

      window.dispatchEvent(new Event("cartUpdated"));
      setMessage("✅ Product added to cart successfully!");
      setTimeout(() => {
        setMessage("");
        // Navigate to cart page
        router.push("/cart");
      }, 1000);

    } catch (error: any) {
      console.error("Error adding to cart:", error);
      setMessage(`❌ Error: ${error.message || "Failed to add product to cart"}`);
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setAddingToCart(false);
    }
  };

  const loadSavedAddresses = useCallback(async () => {
    if (!isAuthenticated()) {
      setSavedAddresses([]);
      return;
    }
    try {
      setAddressesLoading(true);
      const res = (await addressesAPI.getAll()) as { addresses?: unknown[] } | unknown[];
      const rawList = Array.isArray((res as { addresses?: unknown[] }).addresses)
        ? (res as { addresses: unknown[] }).addresses
        : Array.isArray(res)
          ? (res as unknown[])
          : [];
      setSavedAddresses(
        ensureSingleDefaultAddress(
          rawList.map((item) => normalizeSavedAddress((item as Record<string, unknown>) || {}))
        )
      );
    } catch {
      setSavedAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, []);

  useEffect(() => {
    setShippingAuthReady(true);
    setShippingUserLoggedIn(isAuthenticated());
  }, []);

  useEffect(() => {
    if (!shippingAuthReady || !shippingUserLoggedIn) return;
    if (fetchedAddressesOnceRef.current) return;
    fetchedAddressesOnceRef.current = true;
    loadSavedAddresses();
  }, [shippingAuthReady, shippingUserLoggedIn, loadSavedAddresses]);

  useEffect(() => {
    const onAuthChange = () => {
      const loggedIn = isAuthenticated();
      setShippingUserLoggedIn(loggedIn);
      if (loggedIn) {
        fetchedAddressesOnceRef.current = true;
        void loadSavedAddresses();
      } else {
        fetchedAddressesOnceRef.current = false;
        setSavedAddresses([]);
      }
    };
    window.addEventListener("loginStatusChanged", onAuthChange);
    window.addEventListener("storage", onAuthChange);
    return () => {
      window.removeEventListener("loginStatusChanged", onAuthChange);
      window.removeEventListener("storage", onAuthChange);
    };
  }, [loadSavedAddresses]);

  const displayShipTo = pickDisplayShippingAddress(savedAddresses);

  const productImageRaw = product?.image_url || product?.image;
  const imageSrc = getProductImageUrl(productImageRaw) || '';
  const isProductImageBackendUpload = productImageRaw && String(productImageRaw).trim().startsWith("/uploads/");
  const productName = product?.name || "Product";
  const productDescription = product?.description || "";
  const productMaterial = product?.material || "15mil. White Canvas";
  const productProperties = (() => {
    const p = product?.properties;
    if (Array.isArray(p)) return p;
    if (typeof p === "string") {
      try {
        const parsed = JSON.parse(p);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();
  const hasProductProperties = productProperties.some((x) => (x?.key && String(x.key).trim()) || (x?.value && String(x.value).trim()));
  
  // Subcategories for thumbnail gallery
  const subcategoryThumbnails = subcategories.length > 0 
    ? subcategories.map(sub => ({
        src: getProductImageUrl(sub.image_url) || imageSrc,
        label: sub.name,
        slug: sub.slug
      }))
    : [
        { src: imageSrc, label: "4 Ropes and 4 Stakes (Included)" },
        { src: imageSrc, label: "Tent Setup" },
        { src: imageSrc, label: "Frame Component" },
        { src: imageSrc, label: "Specification" },
        { src: imageSrc, label: "Canopy" },
        { src: imageSrc, label: "Tent with Walls" },
        { src: imageSrc, label: "Patterned Canopy" },
      ];

  if (loading) {
    return (
      <>
        <Navbar skipCartCountFetch />
        <div className="min-h-screen bg-white pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <p className="text-gray-600">Loading product...</p>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!product && !productId) {
    return (
      <>
        <Navbar skipCartCountFetch />
        <div className="min-h-screen bg-white pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Product Not Found</h1>
              <Link href="/products" className="text-blue-600 hover:text-blue-700">
                ← Back to Products
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar skipCartCountFetch />
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link href="/products" className="text-blue-600 hover:text-blue-700 text-sm">
              ← Back to Products
            </Link>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 min-w-0">
          {/* Left Panel - Product Image and Details */}
          <div className="min-w-0 max-w-full">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">{productName}</h1>
            

            {/* Main Product Image */}
            <div className="mb-4">
                <div 
                  className="w-full h-150 bg-gray-100 border border-gray-300 rounded-lg relative overflow-hidden cursor-zoom-in"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setImageZoom({ x, y, scale: 2.5 });
                  }}
                  onMouseLeave={() => {
                    setImageZoom({ x: 50, y: 50, scale: 1 });
                  }}
                >
                  {subcategoryThumbnails[selectedImageIndex]?.src && subcategoryThumbnails[selectedImageIndex].src !== '/placeholder.jpg' ? (
                    isProductImageBackendUpload || (subcategoryThumbnails[selectedImageIndex].src || '').includes('/uploads/') ? (
                      <img
                        src={subcategoryThumbnails[selectedImageIndex].src}
                        alt={productName}
                        className="w-full h-full object-cover transition-transform duration-300 ease-out"
                        style={{
                          transform: `scale(${imageZoom.scale})`,
                          transformOrigin: `${imageZoom.x}% ${imageZoom.y}%`,
                        }}
                      />
                    ) : (
                      <Image
                        src={subcategoryThumbnails[selectedImageIndex].src}
                        alt={productName}
                        fill
                        className="object-cover transition-transform duration-300 ease-out"
                        sizes="(max-width: 1024px) 96vw, 60vw"
                        style={{
                          transform: `scale(${imageZoom.scale})`,
                          transformOrigin: `${imageZoom.x}% ${imageZoom.y}%`,
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-28 h-28 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 32 32"
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
            
            </div>

            {/* Subcategories Thumbnail Gallery */}
            {subcategories.length > 0 && (
              <div className="mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {subcategoryThumbnails.map((sub, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setSelectedSubcategory(sub.label);
                    }}
                    className={`w-25 h-25 bg-gray-100 border-2 rounded cursor-pointer hover:border-blue-500 relative overflow-hidden shrink-0 ${
                      selectedSubcategory === sub.label ? 'border-blue-500 ring-2 ring-blue-300' : selectedImageIndex === idx ? 'border-blue-500' : 'border-gray-300'
                    }`}
                    title={sub.label}
                  >
                    {sub.src && sub.src !== '/placeholder.jpg' ? (
                      (sub.src || '').includes('/uploads/') ? (
                        <img src={sub.src} alt={sub.label} className="w-full h-full object-cover" />
                      ) : (
                        <Image
                          src={sub.src}
                          alt={sub.label}
                          fill
                          className="object-cover"
                          sizes="90px"
                        />
                      )
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-gray-300 to-gray-500 rounded"></div>
                    )}
                   
                  </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="mb-6">
                {width && height && parseFloat(width) > 0 && parseFloat(height) > 0 ? (
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      ${basePrice.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Based on {width}" × {height}" ({areaSqFt.toFixed(2)} sq ft)
                    </p>
                  </div>
                ) : null}
            </div>

              {/* Product Features / Description */}
            <div className="mb-6 min-w-0 max-w-full">
                {productDescription ? (
                  <div className="space-y-2 text-gray-700 min-w-0">
                    {productDescription.split('\n').map((line, idx) => (
                      <p key={idx} className="flex items-start gap-2 min-w-0">
                        <span className="shrink-0" aria-hidden>•</span>
                        <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">{line}</span>
                      </p>
                    ))}
                  </div>
                ) : hasProductProperties ? (
                  <ul className="space-y-2 text-gray-700 min-w-0">
                    {productProperties
                      .filter((p) => (p?.key && String(p.key).trim()) || (p?.value && String(p.value).trim()))
                      .map((p, idx) => (
                        <li key={idx} className="flex items-start gap-2 min-w-0">
                          <span className="shrink-0" aria-hidden>•</span>
                          <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
                            {p?.key && String(p.key).trim() ? `${p.key}: ${p.value || ""}` : p?.value || ""}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (() => {
                  const specs: { label: string; value: string }[] = [];
                  if (product?.price != null && product?.price !== "") specs.push({ label: "Price", value: `$${product.price}` });
                  if (product?.price_per_sqft != null) specs.push({ label: "Price per sq ft", value: `$${product.price_per_sqft}` });
                  if (product?.min_charge != null) specs.push({ label: "Min charge", value: `$${product.min_charge}` });
                  if (product?.material && String(product.material).trim()) specs.push({ label: "Material", value: String(product.material) });
                  if (specs.length > 0) {
                    return (
                      <ul className="space-y-2 text-gray-700">
                        {specs.map((s, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>{s.label}: {s.value}</span>
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>High quality product</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Custom sizes available</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Professional printing</span>
                      </li>
                      <li className="flex items-start">
                        <span className="mr-2">•</span>
                        <span>Fast turnaround</span>
                      </li>
                    </ul>
                  );
                })()}
            </div>
          </div>

          {/* Right Panel - Configuration and Order */}
          <div className="min-w-0 max-w-full">
            {/* Product Type Selection */}
            <div className="mb-6">
              {/* <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setProductType("canopy-frame")}
                  className={`px-4 py-3 border-2 rounded-lg font-medium transition-colors ${
                    productType === "canopy-frame"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  Canopy Graphic + Frame
                </button>
                <button
                  onClick={() => setProductType("canopy-only")}
                  className={`px-4 py-3 border-2 rounded-lg font-medium transition-colors ${
                    productType === "canopy-only"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                  }`}
                >
                  Canopy Graphic Only
                </button>
              </div> */}
            </div>

            {/* Customization Options */}
            {/* <div className="mb-6 p-4 border border-gray-200 rounded-lg space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reinforced Strip</label>
                <select
                  value={reinforcedStrip}
                  onChange={(e) => setReinforcedStrip(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>White</option>
                  <option>Black</option>
                  <option>Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Carry Bag</label>
                <select
                  value={carryBag}
                  onChange={(e) => setCarryBag(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Standard Bag</option>
                  <option>Premium Wheeled Bag</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sandbag</label>
                <select
                  value={sandbag}
                  onChange={(e) => setSandbag(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Wall</label>
                <select
                  value={fullWall}
                  onChange={(e) => setFullWall(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>No Full Wall</option>
                  <option>1 Full Wall</option>
                  <option>2 Full Walls</option>
                  <option>3 Full Walls</option>
                  <option>4 Full Walls</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Half Wall</label>
                <select
                  value={halfWall}
                  onChange={(e) => setHalfWall(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>No Half Wall</option>
                  <option>1 Half Wall (Single Sided)</option>
                  <option>1 Half Wall (Double Sided)</option>
                  <option>2 Half Walls (Single Sided)</option>
                  <option>2 Half Walls (Double Sided)</option>
                </select>
              </div>
            </div> */}
            {/* Custom Size */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Width (inches) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height (inches) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>

            {/* Job Details Section */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
              {/* grid grid-cols-4 gap-2 mb-4-4 */}
              <div className="flex flex-wrap gap-4 items-end">
                {/* Job Name */}
                <div className="min-w-0 flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Name/PO# <span className="text-red-500">(Required)</span>
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Job Name/PO#"
                  />
                </div>

                {/* qty per job */}
                <div className="w-28 shrink-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Qty</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black  focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>

                {/* prices per job — width grows with formatted amount */}
                <div className="shrink-0">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                  <div
                    className="inline-flex max-w-full min-h-[42px] items-center overflow-x-auto whitespace-nowrap rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-black tabular-nums [scrollbar-width:thin]"
                    aria-readonly="true"
                  >
                    ${subtotal.toFixed(2)}
                  </div>
                </div>


                {/* <div className="w-1/16">
                  <div className="hover:bg-gray-100 text-red-500  font-bold my-7 py-1 px-2 rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </div>
                </div> */}
                
              </div>
            </div>

            {/* Shipping: service & charges for everyone; saved “Ship to” only when logged in */}
            {shippingAuthReady && (
            <div className="mb-6 p-4 border border-gray-200 rounded-lg min-w-0">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping</h2>
                <div className="space-y-3" />
              </div>

              {shippingUserLoggedIn ? (
                /* Ship to — from address book */
                <div className="mb-4 p-3 bg-gray-50 rounded-lg relative min-w-0 max-w-full">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="text-sm font-medium text-gray-700 shrink-0">Ship to</h3>
                    {addressesLoading ? null : displayShipTo ? (
                      <Link
                        href={`/address-book?edit=${displayShipTo.id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0"
                      >
                        Edit
                      </Link>
                    ) : (
                      <Link
                        href="/address-book?add=1"
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium shrink-0"
                      >
                        Add address
                      </Link>
                    )}
                  </div>
                  {addressesLoading ? (
                    <p className="text-sm text-gray-500">Loading your address…</p>
                  ) : displayShipTo ? (
                    <div className="text-sm text-gray-900 space-y-0.5 min-w-0 break-words [overflow-wrap:anywhere]">
                      <p className="text-xs text-gray-500 capitalize">{displayShipTo.address_type}</p>
                      <p>{displayShipTo.street_address}</p>
                      {displayShipTo.address_line2 ? <p>{displayShipTo.address_line2}</p> : null}
                      <p>{displayShipTo.city}, {displayShipTo.state} {displayShipTo.postcode}</p>
                      <p>{displayShipTo.country}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>No saved address yet. Add one in settings to see it here.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-3">
                  <p className="text-sm text-gray-700">
                    You’ll enter your full shipping address at checkout. Choose a service below to see the estimated
                    shipping charge for this item.
                  </p>
                </div>
              )}

              {/* Shipping Service */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Shipping Service</label>
                <div className="flex items-center gap-2">
                  <select
                    value={shippingService}
                    onChange={(e) => setShippingService(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg  text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>Ground</option>
                    <option>Express</option>
                    <option>Overnight</option>
                  </select>
                  <span className="text-gray-900 font-medium">${shippingCost.toFixed(2)}</span>
                </div>
              </div>

              {/* Estimated Delivery */}
              <div className="mb-4">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">Estimated Delivery:</span> See checkout for delivery options.
                </p>
              </div>
            </div>
            )}

            {/* Order Summary */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex justify-between mb-2">
                <span className="text-gray-700">Subtotal</span>
                <span className="text-gray-900 font-medium">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-700">Shipping ({shippingService})</span>
                <span className="text-gray-900 font-medium">${shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="text-gray-900 font-bold">Total</span>
                <span className="text-gray-900 font-bold text-xl">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              {message && (
                <div className={`p-3 rounded-lg text-sm ${
                  message.includes("✅") 
                    ? "bg-green-50 text-green-800 border border-green-200" 
                    : "bg-red-50 text-red-800 border border-red-200"
                }`}>
                  {message}
                </div>
              )}
              <button 
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="w-full bg-blue-500 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                {addingToCart ? "Adding to Cart..." : "Add to Cart"}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Tabs Section */}
        <div className="border-t border-gray-200 pt-8 min-w-0 max-w-full">
          {/* Tabs */}
          <div className="flex gap-6 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("description")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "description"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab("spec")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "spec"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Spec
            </button>
            <button
              onClick={() => setActiveTab("file-setup")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "file-setup"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              File Setup
            </button>
            <button
              onClick={() => setActiveTab("installation-guide")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "installation-guide"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Installation Guide
            </button>
            <button
              onClick={() => setActiveTab("faq")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "faq"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              FAQ
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "description" && (
            <div className="space-y-6 text-gray-700 min-w-0 max-w-full">
              {productDescription && (
                <div className="min-w-0 max-w-full">
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  {/^[\s]*</.test(productDescription) ? (
                    <div
                      className="product-description-html prose prose-sm max-w-full min-w-0 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
                      dangerouslySetInnerHTML={{ __html: productDescription }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] max-w-full min-w-0">
                      {productDescription}
                    </p>
                  )}
                </div>
              )}
              {hasProductProperties && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Properties</h3>
                  <table className="w-full max-w-md border border-gray-200 rounded-lg overflow-hidden">
                    <tbody>
                      {productProperties
                        .filter((p) => (p?.key && String(p.key).trim()) || (p?.value && String(p.value).trim()))
                        .map((p, i) => (
                          <tr key={i} className="border-b border-gray-200 last:border-0">
                            <td className="px-4 py-2 bg-gray-50 font-medium text-gray-700">{p?.key || "—"}</td>
                            <td className="px-4 py-2 text-gray-900">{p?.value || "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Next Day Turnaround and Cut-off Time:
                </h3>
                <p className="mb-2">
                  Order and submit artwork before 4pm PST ships next business day. Order after 4pm add 1 business day.
                </p>
                <p>Orders over 100 qty require 2 extra business days.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Same Day Turnaround:</h3>
                <p>Not available for this product.</p>
              </div>
              <div>
                <p>
                  Unstretched artist canvas in custom height and width so customers can order and frame photos and art at any size. Our canvas has semi-gloss finish, designed for long-term and fade-resistant fine art reproduction. The polyester/cotton blend canvas is great for superior color quality.
                </p>
              </div>
            </div>
          )}

          {activeTab === "spec" && (
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Material:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>6 oz. Tent Fabric (600x600 denier)</li>
                  <li>40mm Aluminum Hex Hardware, aluminum wall thickness 1mm</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "file-setup" && (
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">File Setup</h3>
                <ul className="list-disc list-inside space-y-2 mb-6">
                  <li>Max File Upload Size: 300MB</li>
                  <li>Submit artwork built to ordered size - Scaled artwork is automatically detected and fit to order</li>
                  <li>Do not include crop marks or bleeds</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Additional Tips</h3>
                <ul className="list-disc list-inside space-y-2 mb-6">
                  <li>Do not submit with Pantones/Spot Colors - Convert to CMYK</li>
                  <li>Convert live fonts to outlines</li>
                  <li>Use provided design templates when available</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">
                  Template Download <a href="#" className="text-blue-600 text-sm font-normal">(Template User Guide)</a>
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-4 py-2 text-left">Tent Products</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-red-600">PDF</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </th>
                        <th className="border border-gray-300 px-4 py-2 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-600">Photoshop</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                            </svg>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 bg-gray-200 rounded"></div>
                            <span>Event Tent (Full Color)</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <a href="#" className="text-blue-600 hover:text-blue-800">Canopy</a>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <a href="#" className="text-blue-600 hover:text-blue-800">Canopy</a>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 bg-gray-200 rounded"></div>
                            <span>Tent Full Wall (Full Color)</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <a href="#" className="text-blue-600 hover:text-blue-800">Full Wall</a>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <a href="#" className="text-blue-600 hover:text-blue-800">Full Wall</a>
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-16 bg-gray-200 rounded"></div>
                            <span>Tent Half Wall (Full Color)</span>
                          </div>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <a href="#" className="text-blue-600 hover:text-blue-800">Half Wall</a>
                        </td>
                        <td className="border border-gray-300 px-4 py-3">
                          <a href="#" className="text-blue-600 hover:text-blue-800">Half Wall</a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "installation-guide" && (
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Installation Guide</h3>
                <a href="#" className="text-blue-600 hover:text-blue-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  Event Tent Installation Guide
                </a>
              </div>
            </div>
          )}

          {activeTab === "faq" && (
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Frequently asked questions</h3>
                <div className="space-y-3">
                  {[
                    { q: "Can I leave the canopy graphic on while I retract the tent frame?", a: "Yes, the canopy graphic can remain on the tent frame when retracting it." },
                    { q: "Can I use different artwork for each side?", a: "Yes, you can customize each side with different artwork." },
                    { q: "How many graphics can fit in the Carry Bag Graphics/Accessories Compartment?", a: "The carry bag can accommodate multiple graphics depending on their size and thickness." },
                    { q: "What do you recommend for cleaning the event tent graphics?", a: "Use mild soap and water with a soft cloth. Avoid harsh chemicals." },
                    { q: "How would canopy and full wall connect together?", a: "The canopy and full wall connect using the included hardware and attachment points on the frame." },
                  ].map((faq, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg">
                      <button
                        onClick={() => setExpandedFAQ(expandedFAQ === idx ? null : idx)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                      >
                        <span className="font-medium text-gray-900">Q: {faq.q}</span>
                        <svg
                          className={`w-5 h-5 text-blue-600 transition-transform ${
                            expandedFAQ === idx ? "rotate-45" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      {expandedFAQ === idx && (
                        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                          <p className="text-gray-700">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-16 border-t border-gray-200 pt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">Related Products</h2>
            {loadingRelated ? (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading related products...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {relatedProducts.map((relatedProduct) => {
                  const handleSelectProduct = (e?: React.MouseEvent) => {
                    if (e) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                    
                    // Update URL with new product ID - this will trigger useEffect to fetch new product
                    router.push(`/products/product-detail?productId=${relatedProduct.id}`);
                    
                    // Reset form values for new product
                    setWidth("0");
                    setHeight("0");
                    setQuantity("1");
                    setJobName("");
                    
                    // Scroll to top to show new product
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  };

                  return (
                  <div
                    key={relatedProduct.id}
                    onClick={handleSelectProduct}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg group border-2 border-gray-200 hover:border-gray-300 h-full cursor-pointer transition-all"
                  >
                    {/* Product Image */}
                    <div className="w-full h-48 bg-gray-200 relative overflow-hidden">
                      {(() => {
                        const rawUrl = relatedProduct.image_url || relatedProduct.image;
                        const relatedImgSrc = getProductImageUrl(rawUrl);
                        const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");
                        return relatedImgSrc ? (
                          isBackendUpload ? (
                            <img src={relatedImgSrc} alt={relatedProduct.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <Image
                              src={relatedImgSrc}
                              alt={relatedProduct.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                            />
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-200">
                            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        );
                      })()}
                      {(relatedProduct.isNew || relatedProduct.is_new) && (
                        <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                          New
                        </span>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-4">
                      <div className="mb-2">
                        {relatedProduct.category_name && (
                          <p className="text-xs text-gray-500 mb-1">{relatedProduct.category_name}</p>
                        )}
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {relatedProduct.name}
                        </h3>
                      </div>
                      {relatedProduct.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2 min-w-0 break-words [overflow-wrap:anywhere]">
                          {relatedProduct.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        {relatedProduct.price ? (
                          <p className="text-lg font-bold text-gray-900">
                            ${relatedProduct.price}
                          </p>
                        ) : relatedProduct.price_per_sqft ? (
                          <p className="text-sm text-gray-700">
                            ${relatedProduct.price_per_sqft.toFixed(2)}/ft²
                          </p>
                        ) : (
                          <p className="text-sm text-gray-700">Price on request</p>
                        )}
                        <span className="text-blue-600 text-sm font-medium group-hover:text-blue-700">
                          View Details →
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <button
                          onClick={(e) => handleSelectProduct(e)}
                          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                          Select Product
                        </button>
                      </div>
                      {relatedProduct.id === productId && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Currently Selected
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
      <Footer />
    </>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={
      <>
        <Navbar skipCartCountFetch />
        <div className="min-h-screen bg-white pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <p className="text-gray-600">Loading product...</p>
            </div>
          </div>
        </div>
        <Footer />
      </>
    }>
      <ProductDetailContent />
    </Suspense>
  );
}

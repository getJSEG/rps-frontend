"use client";

import { useState, useEffect, Suspense, useRef, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import {
  productsAPI,
  getProductImageUrl,
  cartAPI,
  taxesAPI,
  fedexAPI,
  addressesAPI,
  shippingRatesAPI,
  effectiveOrderShipping,
  buildFedexPackagesForProductConfigure,
  hardwareFedexShippingFromProduct,
  type FedexRateQuote,
  type FreeShippingPolicy,
  type TaxEstimateResponse,
} from "../../../utils/api";
import { isAuthenticated } from "../../../utils/roles";
import { SITE_TAB_TITLE, pageTitle } from "../../../utils/tabTitle";
import { FiArrowLeft, FiTrash2, FiX } from "react-icons/fi";
import { HiOutlinePencilSquare } from "react-icons/hi2";

/** One artwork per job popup image in `public`. */
const ONE_ARTWORK_PER_JOB_IMAGE = "/Oneartwokperjob.jpg";

/** Logged-in only: restores ship-to when there is no default address row yet (e.g. right after checkout). */
const PDP_SHIP_ESTIMATE_STORAGE_KEY = "rps_pdp_ship_estimate_v1";

/** After dimensions/qty/address stop changing, fetch FedEx once (avoids many pending /fedex/rates). */
const PDP_FEDEX_RATES_DEBOUNCE_MS = 350;
const PDP_TAX_ESTIMATE_DEBOUNCE_MS = 350;

function billableQtyFromFedexJobQtyKey(key: string): number {
  if (!key.length) return 1;
  return key.split("|").reduce((s, q) => s + Math.max(1, parseInt(q, 10) || 1), 0);
}

function readStoredPdpShipEstimate(): {
  streetAddress: string;
  addressLine2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PDP_SHIP_ESTIMATE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!p || typeof p !== "object") return null;
    const postcode = String(p.postcode ?? "").trim();
    if (!postcode) return null;
    return {
      streetAddress: String(p.streetAddress ?? p.street_address ?? ""),
      addressLine2: String(p.addressLine2 ?? p.address_line2 ?? ""),
      city: String(p.city ?? ""),
      state: String(p.state ?? ""),
      postcode,
      country: String(p.country ?? "United States"),
    };
  } catch {
    return null;
  }
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

interface ProductProperty {
  key: string;
  value: string;
}

interface ProductFaqItem {
  question: string;
  answer: string;
}

interface Product {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  price?: string;
  image?: string;
  image_url?: string;
  /** Ordered image URLs; first matches listing thumbnail (`image_url`). */
  gallery_images?: string[];
  isNew?: boolean;
  is_new?: boolean;
  category_slug?: string;
  category_name?: string;
  description?: string;
  spec?: string | null;
  file_setup?: string | null;
  installation_guide?: string | null;
  faq?: ProductFaqItem[] | string | null;
  dimensions?: string;
  sizes?: string[];
  material?: string;
  /** API may send DECIMAL as string */
  price_per_sqft?: number | string;
  min_charge?: number;
  pricing_mode?: "fixed" | "area";
  graphic_scenario_enabled?: boolean;
  size_mode?: "predefined" | "custom";
  base_unit?: "inch";
  min_width?: number | null;
  max_width?: number | null;
  min_height?: number | null;
  max_height?: number | null;
  size_options?: Array<{
    id: number;
    label: string;
    width: number;
    height: number;
    unit_price: number | null;
    is_default?: boolean;
  }>;
  modifier_groups?: Array<{
    modifier_group_id?: number;
    key: string;
    name: string;
    /** Any option key or "all" — not limited to the legacy graphic_only/graphic_frame values. */
    mode_scope?: string;
    input_type?: string;
    is_required?: boolean;
    options: Array<{
      id?: number;
      value: string;
      label: string;
      price_adjustment?: number;
      price_type?: string;
      is_default?: boolean;
    }>;
  }>;
  hardware_template_id?: number | null;
  shipping_length?: number | string | null;
  shipping_width?: number | string | null;
  shipping_height?: number | string | null;
  shipping_weight?: number | string | null;
  purchase_options?: Array<{
    id: number;
    label: string;
    option_key: string;
    pricing_mode?: string;
    unit_price?: number | null;
    price_per_sqft?: number | null;
    min_charge?: number | null;
    sort_order?: number;
    is_default?: boolean;
  }>;
  conditional_modifier_rules?: Array<{
    id?: number;
    hardware_option_id?: number | null;
    hardware_option_key?: string | null;
    source_modifier_id: number;
    source_modifier_key?: string;
    source_option_id?: number | null;
    source_option_value?: string | null;
    action_type: "auto_select" | "disable";
    target_modifier_id: number;
    target_modifier_key?: string;
    target_option_id?: number | null;
    target_option_value?: string | null;
  }>;
  properties?: ProductProperty[];
  /** Ordered bullet points shown under the product image. */
  product_highlights?: string[] | null;
}

interface PreviewPricing {
  unitPrice: number;
  baseUnitPrice?: number;
  modifierTotal?: number;
  selectedModifiers?: Array<{
    group_key: string;
    group_name: string;
    option_value: string;
    option_label: string;
    price_adjustment: number;
  }>;
  width: number;
  height: number;
  areaSqft: number;
  pricing_mode: "fixed" | "area";
  size_mode: "predefined" | "custom";
  sizeOptionId: number | null;
  sizeOptionLabel: string | null;
  minApplied: boolean;
  selection_mode?: "graphic_only" | "graphic_frame" | null;
  purchase_option_key?: string | null;
  purchase_option_label?: string | null;
}

function normalizeProductGalleryImages(product: Product | null): string[] {
  if (!product) return [];
  const g = product.gallery_images;
  if (Array.isArray(g) && g.length) {
    return g.map((u) => String(u || "").trim()).filter(Boolean);
  }
  const raw = product.image_url || product.image;
  if (raw) return [String(raw).trim()];
  return [];
}

/** Plain-text preview for listing cards (description is HTML from admin editor). */
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

/** Same parsing as product listing cards (`Products.tsx`): `price` wins over `price_per_sqft`. */
function parseProductMoney(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).trim().replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

/** Align with storefront listing when `pricing_mode` is missing or stale in the payload. */
function inferPricingModeForProduct(product: Product | null): "fixed" | "area" {
  if (!product) return "fixed";
  const explicit = String(product.pricing_mode || "").trim().toLowerCase();
  if (explicit === "fixed" || explicit === "area") return explicit;
  const sizeMode = String(product.size_mode || "custom").toLowerCase();
  if (sizeMode === "predefined") return "fixed";
  const unit = parseProductMoney(product.price);
  if (unit != null) return "fixed";
  const ppsf = Number(product.price_per_sqft);
  if (Number.isFinite(ppsf) && ppsf > 0) return "area";
  return "fixed";
}

function modifierOptionValue(option: { value?: string; label?: string } | null | undefined): string {
  return String(option?.value || option?.label || "").trim();
}

function resolveModifierAdjustmentAmount(
  baseUnitBeforeModifiers: number,
  option: { price_adjustment?: number; price_type?: string } | null | undefined
): number {
  const raw = Number(option?.price_adjustment ?? 0);
  if (!Number.isFinite(raw)) return 0;
  const type = String(option?.price_type || "percent").trim().toLowerCase();
  if (type === "fixed") return raw;
  return baseUnitBeforeModifiers * (raw / 100);
}

function newProductJobRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function BackToProductsLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/products"
      className={`group inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-4 py-2.5 text-sm  text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-200 hover:bg-gray-50/80 hover:text-sky-900 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 ${className}`}
    >
      <FiArrowLeft
        className="h-4 w-4 shrink-0 text-slate-600 transition-transform duration-200 group-hover:-translate-x-0.5 group-hover:text-sky-700"
        aria-hidden
      />
      <span className="leading-tight">Back to products</span>
    </Link>
  );
}

/** One print job under a product configuration (same width/height as siblings). */
interface ProductJobRow {
  id: string;
  jobName: string;
  quantity: string;
}

type GraphicSelectionMode = "graphic_only" | "graphic_frame";

function ProductDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const productId = searchParams.get("productId");
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [previewPricing, setPreviewPricing] = useState<PreviewPricing | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string>>({});
  const [selectedGraphicMode, setSelectedGraphicMode] = useState<GraphicSelectionMode>("graphic_only");
  /** Key of the selected purchase option (new dynamic system). Null when no purchase_options. */
  const [selectedPurchaseOptionKey, setSelectedPurchaseOptionKey] = useState<string | null>(null);
  const [openModifierKey, setOpenModifierKey] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [jobs, setJobs] = useState<ProductJobRow[]>(() => [
    { id: newProductJobRowId(), jobName: "", quantity: "1" },
  ]);
  /** Defaults for cart line (customization UI removed); keep in sync if options return. */
  const productType = "canopy-frame";
  const reinforcedStrip = "White";
  const carryBag = "Standard Bag";
  const sandbag = "No";
  const fullWall = "1 Full Wall";
  const halfWall = "1 Half Wall (Single Sided)";
  const [activeTab, setActiveTab] = useState("description");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedProductImageIndex, setSelectedProductImageIndex] = useState(0);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [subcategories, setSubcategories] = useState<Array<{name: string; slug: string; image_url?: string}>>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [imageZoom, setImageZoom] = useState({ x: 50, y: 50, scale: 1 });
  const [message, setMessage] = useState("");
  const [taxEstimate, setTaxEstimate] = useState<TaxEstimateResponse | null>(null);
  const [taxEstimateLoading, setTaxEstimateLoading] = useState(false);
  const [taxEstimateError, setTaxEstimateError] = useState<string | null>(null);
  const [jobArtworkInfoOpen, setJobArtworkInfoOpen] = useState(false);
  const [estimateShipForm, setEstimateShipForm] = useState({
    streetAddress: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    country: "United States",
  });
  /** False until first address-book fetch for this PDP visit finishes (avoids clearing FedEx while postcode is still empty). */
  const [addressDefaultsLoaded, setAddressDefaultsLoaded] = useState(false);
  const [fedexRates, setFedexRates] = useState<FedexRateQuote[]>([]);
  const [fedexRatesLoading, setFedexRatesLoading] = useState(false);
  const [fedexRatesError, setFedexRatesError] = useState<string | null>(null);
  const [selectedFedexServiceType, setSelectedFedexServiceType] = useState("");
  /** When false and postal+country are set, show compact Ship to card (image 2). When true, show full address form. */
  const [shipToEditing, setShipToEditing] = useState(false);
  const [freeShippingPolicy, setFreeShippingPolicy] = useState<FreeShippingPolicy>({
    freeShippingEnabled: false,
    freeShippingThreshold: 0,
  });
  const fetchedProductForRef = useRef<string | null>(null);
  const fetchedRelatedForRef = useRef<string | null>(null);
  /** Bumped on FedEx effect cleanup so debounced/in-flight requests ignore stale results. */
  const fedexRatesRunRef = useRef(0);
  const addJob = () => {
    setJobs((prev) => [...prev, { id: newProductJobRowId(), jobName: "", quantity: "1" }]);
  };

  const removeJob = (id: string) => {
    setJobs((prev) => (prev.length <= 1 ? prev : prev.filter((j) => j.id !== id)));
  };

  const updateJob = (id: string, patch: Partial<Pick<ProductJobRow, "jobName" | "quantity">>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  };

  /** Quantity signature only — jobName edits must not retrigger FedEx rates. */
  const fedexJobQtyKey = jobs.map((j) => j.quantity).join("|");

  // Default pricing values (can be overridden by product data); DECIMAL often arrives as string.
  const pricePerSqFtNum = Number(product?.price_per_sqft);
  const pricePerSqFt =
    Number.isFinite(pricePerSqFtNum) && pricePerSqFtNum > 0 ? pricePerSqFtNum : 3.63;
  const minChargeNum = Number(product?.min_charge);
  const minCharge = Number.isFinite(minChargeNum) && minChargeNum >= 0 ? minChargeNum : 8.0;
  const isGraphicScenario = !!product?.graphic_scenario_enabled;
  const purchaseOptions = Array.isArray(product?.purchase_options) ? product.purchase_options : [];
  const hasPurchaseOptions = purchaseOptions.length > 0;

  // Determine the effective scope key for modifier filtering
  const effectiveScopeKey: string | null = hasPurchaseOptions
    ? (selectedPurchaseOptionKey ??
        (purchaseOptions.find((o) => o.is_default) || purchaseOptions[0])?.option_key ??
        null)
    : isGraphicScenario
      ? selectedGraphicMode
      : null;

  // Which purchase option is currently active?
  const activePurchaseOption = hasPurchaseOptions
    ? (purchaseOptions.find((o) => o.option_key === effectiveScopeKey) ||
        purchaseOptions.find((o) => o.is_default) ||
        purchaseOptions[0])
    : null;
  const activePurchaseOptionIsFixed = activePurchaseOption
    ? String(activePurchaseOption.pricing_mode || "fixed") === "fixed"
    : false;
  /** True when no width/height input is needed (graphic scenario OR fixed-price purchase option) */
  const skipDimensionsForPrice = isGraphicScenario || (hasPurchaseOptions && activePurchaseOptionIsFixed);

  /** FedEx physical box from admin `shipping_*` when product has a hardware template and all dims are set. */
  const hardwareFedexShipping = useMemo(() => hardwareFedexShippingFromProduct(product), [product]);

  const activeModifierGroups = (Array.isArray(product?.modifier_groups) ? product.modifier_groups : []).filter(
    (group) => {
      if (!effectiveScopeKey) return true;
      const scope = String((group as { mode_scope?: string }).mode_scope || "all").toLowerCase();
      if (scope === "all") return true;
      return scope === effectiveScopeKey;
    }
  );
  const activeGroupsById = new Map(
    activeModifierGroups
      .map((group) => [Number(group.modifier_group_id || 0), group] as const)
      .filter(([id]) => Number.isFinite(id) && id > 0)
  );
  const activeGroupsByKey = new Map(activeModifierGroups.map((group) => [String(group.key), group] as const));
  const conditionalRules = Array.isArray(product?.conditional_modifier_rules) ? product.conditional_modifier_rules : [];
  const evaluateConditionalModifierRules = (selection: Record<string, string>) => {
    const nextSelected = { ...selection };
    const disabledOptionIds = new Set<number>();
    const disabledGroupKeys = new Set<string>();
    const autoSelectedOptionIdsByGroup = new Map<string, number>();
    const activePurchaseId = activePurchaseOption?.id != null ? Number(activePurchaseOption.id) : null;
    const activeScopeKey = String(effectiveScopeKey || "").trim().toLowerCase();

    const ruleAppliesToCurrentHardware = (rule: NonNullable<Product["conditional_modifier_rules"]>[number]) => {
      const ruleHardwareId = rule.hardware_option_id == null ? null : Number(rule.hardware_option_id);
      const ruleHardwareKey = String(rule.hardware_option_key || "").trim().toLowerCase();
      if (ruleHardwareId != null && activePurchaseId != null && ruleHardwareId !== activePurchaseId) return false;
      if (ruleHardwareId != null && activePurchaseId == null) return false;
      if (ruleHardwareKey && activeScopeKey && ruleHardwareKey !== activeScopeKey) return false;
      if (ruleHardwareKey && !activeScopeKey) return false;
      return true;
    };

    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      disabledOptionIds.clear();
      for (const rule of conditionalRules) {
        if (!ruleAppliesToCurrentHardware(rule)) continue;
        const sourceGroup =
          activeGroupsById.get(Number(rule.source_modifier_id)) ||
          activeGroupsByKey.get(String(rule.source_modifier_key || ""));
        const targetGroup =
          activeGroupsById.get(Number(rule.target_modifier_id)) ||
          activeGroupsByKey.get(String(rule.target_modifier_key || ""));
        if (!sourceGroup || !targetGroup) continue;
        const sourceOption =
          rule.source_option_id == null && !rule.source_option_value
            ? null
            : sourceGroup.options.find(
                (opt) => Number(opt.id) === Number(rule.source_option_id) || modifierOptionValue(opt) === String(rule.source_option_value || "")
              );
        const targetOption =
          rule.target_option_id == null && rule.action_type === "disable"
            ? null
            : targetGroup.options.find(
                (opt) => Number(opt.id) === Number(rule.target_option_id) || modifierOptionValue(opt) === String(rule.target_option_value || "")
              );
        if (rule.source_option_id != null && !sourceOption) continue;
        if (rule.action_type !== "disable" && !targetOption) continue;
        const selectedSourceValue = String(nextSelected[sourceGroup.key] || "").trim();
        if (!selectedSourceValue) continue;
        if (sourceOption) {
          const sourceValue = modifierOptionValue(sourceOption);
          if (!sourceValue || selectedSourceValue !== sourceValue) continue;
        }
        if (rule.action_type === "disable") {
          if (!targetOption) {
            disabledGroupKeys.add(targetGroup.key);
          } else {
            disabledOptionIds.add(Number(targetOption.id || rule.target_option_id));
          }
        } else {
          const targetValue = modifierOptionValue(targetOption);
          if (targetValue && nextSelected[targetGroup.key] !== targetValue) {
            nextSelected[targetGroup.key] = targetValue;
            changed = true;
          }
          if (targetOption?.id != null) {
            autoSelectedOptionIdsByGroup.set(targetGroup.key, Number(targetOption.id));
          }
        }
      }
      for (const group of activeModifierGroups) {
        const selectedValue = nextSelected[group.key];
        if (!selectedValue) continue;
        const selectedOption = group.options.find((opt) => modifierOptionValue(opt) === selectedValue);
        if (
          disabledGroupKeys.has(group.key) ||
          (selectedOption?.id != null && disabledOptionIds.has(Number(selectedOption.id)))
        ) {
          delete nextSelected[group.key];
          changed = true;
        }
      }
      if (!changed) break;
    }
    return { nextSelected, disabledOptionIds, disabledGroupKeys, autoSelectedOptionIdsByGroup };
  };
  const conditionalRuleEvaluation = evaluateConditionalModifierRules(selectedModifiers);
  const disabledModifierOptionIds = conditionalRuleEvaluation.disabledOptionIds;
  const disabledModifierGroupKeys = conditionalRuleEvaluation.disabledGroupKeys;
  const autoSelectedModifierOptionIdsByGroup = conditionalRuleEvaluation.autoSelectedOptionIdsByGroup;

  const missingRequiredModifiers = activeModifierGroups
    .filter((group) => group.is_required)
    .filter((group) => {
      const selectedValue = String(selectedModifiers[group.key] || "").trim();
      if (!selectedValue) return true;
      const options = Array.isArray(group.options) ? group.options : [];
      return !options.some((o) => modifierOptionValue(o) === selectedValue);
    });

  useEffect(() => {
    const normalized = conditionalRuleEvaluation.nextSelected;
    if (JSON.stringify(normalized) !== JSON.stringify(selectedModifiers)) {
      setSelectedModifiers(normalized);
    }
  }, [conditionalRuleEvaluation.nextSelected, selectedModifiers]);

  // Fetch product data - Reset and fetch when productId changes
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        setProduct(null);
        setLoading(false);
        fetchedProductForRef.current = null;
        return;
      }
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
      } catch {
        fetchedProductForRef.current = null;
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  useEffect(() => {
    if (!productId) {
      document.title = SITE_TAB_TITLE;
      return;
    }
    const name = product?.name?.trim();
    if (name) {
      document.title = pageTitle(name);
      return;
    }
    if (!loading) {
      document.title = pageTitle("Product");
    }
  }, [productId, product?.name, loading]);

  useEffect(() => {
    return () => {
      document.title = SITE_TAB_TITLE;
    };
  }, []);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const res = await shippingRatesAPI.get();
        if (!c) {
          setFreeShippingPolicy({
            freeShippingEnabled: !!res?.freeShippingEnabled,
            freeShippingThreshold: Math.max(0, Number(res?.freeShippingThreshold) || 0),
          });
        }
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated() || !productId) return;
    let cancelled = false;
    setAddressDefaultsLoaded(false);
    void (async () => {
      try {
        const addrRes = (await addressesAPI.getAll()) as { addresses?: unknown[] };
        const rawList = Array.isArray(addrRes?.addresses) ? addrRes.addresses : [];
        const list = rawList.map((item) => {
          const r = (item as Record<string, unknown>) || {};
          return {
            street_address: String(r.street_address ?? r.streetAddress ?? ""),
            address_line2:
              r.address_line2 != null || r.addressLine2 != null
                ? String(r.address_line2 ?? r.addressLine2 ?? "")
                : "",
            city: String(r.city ?? ""),
            state: String(r.state ?? ""),
            postcode: String(r.postcode ?? ""),
            country: String(r.country ?? "United States"),
            is_default: Boolean(r.is_default ?? r.isDefault),
            address_type: String(r.address_type ?? r.addressType ?? "billing"),
          };
        });
        const globalDefault = list.find((a) => a.is_default) ?? list[0] ?? null;
        const ship =
          globalDefault?.address_type === "shipping"
            ? globalDefault
            : list.find((a) => a.address_type === "shipping") ?? globalDefault;
        if (!cancelled && ship && ship.postcode.trim()) {
          setEstimateShipForm((prev) => ({
            ...prev,
            streetAddress: ship.street_address || prev.streetAddress,
            addressLine2: ship.address_line2 || prev.addressLine2,
            city: ship.city || prev.city,
            state: ship.state || prev.state,
            postcode: ship.postcode || prev.postcode,
            country: ship.country || prev.country,
          }));
          setShipToEditing(false);
        }
      } catch {
        /* guest or no addresses */
      } finally {
        if (!cancelled) {
          setEstimateShipForm((prev) => {
            if (String(prev.postcode || "").trim()) return prev;
            const stored = readStoredPdpShipEstimate();
            if (!stored) return prev;
            return { ...prev, ...stored };
          });
          setAddressDefaultsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId, pathname]);

  /** Logged-in: persist last ship-to so a return visit (e.g. after checkout) has postcode before FedEx effect runs. */
  useEffect(() => {
    if (!isAuthenticated()) return;
    const pc = String(estimateShipForm.postcode || "").trim();
    if (!pc) return;
    try {
      sessionStorage.setItem(
        PDP_SHIP_ESTIMATE_STORAGE_KEY,
        JSON.stringify({
          streetAddress: estimateShipForm.streetAddress,
          addressLine2: estimateShipForm.addressLine2,
          city: estimateShipForm.city,
          state: estimateShipForm.state,
          postcode: estimateShipForm.postcode,
          country: estimateShipForm.country,
        })
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [
    estimateShipForm.streetAddress,
    estimateShipForm.addressLine2,
    estimateShipForm.city,
    estimateShipForm.state,
    estimateShipForm.postcode,
    estimateShipForm.country,
  ]);

  useEffect(() => {
    const myRun = ++fedexRatesRunRef.current;
    const debounceHolder: { timer?: ReturnType<typeof setTimeout> } = {};

    const cleanup = () => {
      fedexRatesRunRef.current += 1;
      if (debounceHolder.timer !== undefined) clearTimeout(debounceHolder.timer);
    };

    if (!isAuthenticated()) {
      setFedexRates([]);
      setSelectedFedexServiceType("");
      setFedexRatesError(null);
      setFedexRatesLoading(false);
      return cleanup;
    }
    if (missingRequiredModifiers.length > 0) {
      setFedexRates([]);
      setSelectedFedexServiceType("");
      setFedexRatesError(null);
      return cleanup;
    }

    // Form dimensions only (same as price-preview). Do not depend on previewPricing
    // or the effect reruns when preview returns and duplicates POST /fedex/rates.
    const wIn = parseFloat(width) || 0;
    const hIn = parseFloat(height) || 0;
    const useHardwareFedexBox = hardwareFedexShipping != null;
    if (!useHardwareFedexBox && !skipDimensionsForPrice && (wIn <= 0 || hIn <= 0)) {
      setFedexRates([]);
      setSelectedFedexServiceType("");
      setFedexRatesError(null);
      return cleanup;
    }

    const pc = String(estimateShipForm.postcode || "").trim();
    const countryRaw = String(estimateShipForm.country || "").trim();
    if (!pc || !countryRaw) {
      if (isAuthenticated() && !addressDefaultsLoaded) {
        return cleanup;
      }
      setFedexRates([]);
      setSelectedFedexServiceType("");
      setFedexRatesError(null);
      return cleanup;
    }

    const billableQty = billableQtyFromFedexJobQtyKey(fedexJobQtyKey);
    const fedexStreetLines: string[] = [];
    const s1 = estimateShipForm.streetAddress.trim();
    const s2 = estimateShipForm.addressLine2.trim();
    if (s1) fedexStreetLines.push(s1);
    if (s2) fedexStreetLines.push(s2);

    const destination = {
      postalCode: pc,
      countryCode:
        countryRaw.toLowerCase() === "united states"
          ? "US"
          : countryRaw.trim().toUpperCase(),
      stateOrProvinceCode: String(estimateShipForm.state || "").trim().toUpperCase() || undefined,
      city: String(estimateShipForm.city || "").trim() || undefined,
      ...(fedexStreetLines.length > 0 ? { streetLines: fedexStreetLines } : {}),
    };

    const packages = buildFedexPackagesForProductConfigure({
      billableQty,
      widthInches: wIn,
      heightInches: hIn,
      isGraphicScenario,
      hardwareShipping: hardwareFedexShipping,
    });

    debounceHolder.timer = setTimeout(() => {
      if (fedexRatesRunRef.current !== myRun) return;
      void (async () => {
        try {
          setFedexRatesLoading(true);
          setFedexRatesError(null);
          const res = await fedexAPI.getRates(destination, packages);
          if (fedexRatesRunRef.current !== myRun) return;
          const raw = Array.isArray(res?.rates) ? res.rates : [];
          const list = [...raw].sort((a, b) => (Number(a.totalCharge) || 0) - (Number(b.totalCharge) || 0));
          setFedexRates(list);
          if (list.length > 0) {
            setSelectedFedexServiceType((prev) => {
              if (prev && list.some((r) => r.serviceType === prev)) return prev;
              return list[0].serviceType;
            });
          } else {
            setSelectedFedexServiceType("");
          }
        } catch (e) {
          if (fedexRatesRunRef.current !== myRun) return;
          setFedexRates([]);
          setSelectedFedexServiceType("");
          setFedexRatesError(e instanceof Error ? e.message : "Could not load FedEx rates");
        } finally {
          setFedexRatesLoading(false);
        }
      })();
    }, PDP_FEDEX_RATES_DEBOUNCE_MS);

    return cleanup;
  }, [
    missingRequiredModifiers.length,
    width,
    height,
    skipDimensionsForPrice,
    isGraphicScenario,
    hardwareFedexShipping,
    fedexJobQtyKey,
    estimateShipForm.postcode,
    estimateShipForm.country,
    estimateShipForm.state,
    estimateShipForm.city,
    estimateShipForm.streetAddress,
    estimateShipForm.addressLine2,
    addressDefaultsLoaded,
  ]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedProductImageIndex(0);
    setSelectedSubcategory(null);
    setSelectedGraphicMode("graphic_only");
    setSelectedPurchaseOptionKey(null);
  }, [productId]);

  useEffect(() => {
    if (!product) return;
    setPreviewPricing(null);
    setOpenModifierKey(null);

    // Initialize selectedPurchaseOptionKey from default when product loads
    const pOpts = Array.isArray(product.purchase_options) ? product.purchase_options : [];
    if (pOpts.length > 0) {
      const defaultOpt = pOpts.find((o) => o.is_default) || pOpts[0];
      setSelectedPurchaseOptionKey(defaultOpt?.option_key ?? null);
    }

    const scopeKey = pOpts.length > 0
      ? (pOpts.find((o) => o.is_default) || pOpts[0])?.option_key ?? null
      : product.graphic_scenario_enabled ? selectedGraphicMode : null;

    const groups = (Array.isArray(product.modifier_groups) ? product.modifier_groups : []).filter((group) => {
      if (!scopeKey) return true;
      const scope = String((group as { mode_scope?: string }).mode_scope || "all").toLowerCase();
      if (scope === "all") return true;
      return scope === scopeKey;
    });
    const defaults: Record<string, string> = {};
    for (const g of groups) {
      const options = Array.isArray(g.options) ? g.options : [];
      const def = options.find((o) => o.is_default);
      const defValue = modifierOptionValue(def);
      if (defValue) defaults[String(g.key)] = defValue;
    }
    setSelectedModifiers(defaults);
  }, [product, selectedGraphicMode]);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-modifier-dropdown="true"]')) return;
      setOpenModifierKey(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!jobArtworkInfoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setJobArtworkInfoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jobArtworkInfoOpen]);

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
      } catch {
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
      } catch {
        setSubcategories([]);
      }
    };

    if (product) {
      fetchSubcategories();
    }
  }, [product]);

  useEffect(() => {
    if (!productId || !product) return;
    const widthInches = parseFloat(width) || 0;
    const heightInches = parseFloat(height) || 0;
    if (!skipDimensionsForPrice && (widthInches <= 0 || heightInches <= 0)) {
      setPreviewPricing(null);
      return;
    }
    if (missingRequiredModifiers.length > 0) {
      setPreviewPricing(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const response = await productsAPI.previewPrice(String(productId), {
          width: widthInches,
          height: heightInches,
          selectedModifiers,
          purchase_option_key: hasPurchaseOptions ? (effectiveScopeKey ?? undefined) : undefined,
          selection_mode: (!hasPurchaseOptions && isGraphicScenario) ? selectedGraphicMode : undefined,
        });
        if (!cancelled && response?.pricing) {
          setPreviewPricing(response.pricing);
        }
      } catch {
        if (!cancelled) setPreviewPricing(null);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [productId, product, width, height, selectedModifiers, isGraphicScenario, selectedGraphicMode, selectedPurchaseOptionKey, hasPurchaseOptions, effectiveScopeKey, skipDimensionsForPrice, missingRequiredModifiers.length]);

  // Calculate displayed pricing (server preview preferred, fallback mirrors product mode)
  const widthInches = previewPricing?.width ?? (parseFloat(width) || 0);
  const heightInches = previewPricing?.height ?? (parseFloat(height) || 0);
  const areaSqFt = previewPricing?.areaSqft ?? ((widthInches * heightInches) / 144);
  const productPricingMode = inferPricingModeForProduct(product ?? null);
  const listFixedUnit = parseProductMoney(product?.price);
  const fallbackFixedFromProduct = listFixedUnit != null ? listFixedUnit : 0;
  const fallbackAreaPrice = Math.max(areaSqFt * pricePerSqFt, minCharge);

  // Base price for modifier percentage calculations — always the raw option/product price,
  // never the server total (which already includes modifiers).
  // For purchase-options products: use the currently selected option's unit_price.
  // For plain/area products: derive from server baseUnitPrice if available, else product price.
  const baseUnitBeforeModifiers = hasPurchaseOptions
    ? (activePurchaseOption?.unit_price != null ? Number(activePurchaseOption.unit_price) : fallbackFixedFromProduct)
    : isGraphicScenario
      ? fallbackFixedFromProduct
      : (() => {
          const previewBase = Number(previewPricing?.baseUnitPrice);
          if (Number.isFinite(previewBase) && previewBase > 0) return previewBase;
          const previewTotal = Number(previewPricing?.unitPrice);
          const previewMod = Number(previewPricing?.modifierTotal);
          if (Number.isFinite(previewTotal) && Number.isFinite(previewMod)) return previewTotal - previewMod;
          return productPricingMode === "fixed" ? fallbackFixedFromProduct : fallbackAreaPrice;
        })();

  // Client-side modifier total — used as fallback before server preview arrives.
  const selectedModifierTotal = activeModifierGroups.reduce((sum, group) => {
    const selectedValue = String(selectedModifiers[group.key] || "");
    if (!selectedValue) return sum;
    const options = Array.isArray(group.options) ? group.options : [];
    const selectedOption = options.find((o) => modifierOptionValue(o) === selectedValue);
    return sum + resolveModifierAdjustmentAmount(baseUnitBeforeModifiers, selectedOption);
  }, 0);

  // Final price: server preview is authoritative (already includes modifiers correctly).
  // Client calculation is the immediate fallback before the preview response arrives.
  const unitPrice = previewPricing?.unitPrice ?? (baseUnitBeforeModifiers + selectedModifierTotal);
  const displayPricingMode: "fixed" | "area" = previewPricing?.pricing_mode ?? productPricingMode;
  const jobLines = jobs.map((j) => {
    const qtyNum = Math.max(0, Math.floor(parseFloat(j.quantity) || 0));
    return {
      id: j.id,
      qtyNum,
      lineSubtotal: unitPrice * qtyNum,
    };
  });
  const subtotal = jobLines.reduce((sum, line) => sum + line.lineSubtotal, 0);
  const taxEstimatePostalCode = String(estimateShipForm.postcode || "").trim();
  const selectedFedexRatePdp =
    fedexRates.find((r) => r.serviceType === selectedFedexServiceType) || fedexRates[0] || null;
  const fedexRawChargePdp = isAuthenticated()
    ? Number(selectedFedexRatePdp?.totalCharge) || 0
    : 0;
  const effectiveShippingPdp = effectiveOrderShipping(
    fedexRawChargePdp,
    subtotal,
    freeShippingPolicy,
    false
  );
  const activeTaxPercentage = Number(taxEstimate?.taxPercentage ?? 0);
  const taxAmount = Number(taxEstimate?.tax ?? 0);
  const totalWithTax = Number(taxEstimate?.total ?? subtotal + effectiveShippingPdp + taxAmount);

  useEffect(() => {
    if (!isAuthenticated()) {
      setTaxEstimate(null);
      setTaxEstimateError(null);
      setTaxEstimateLoading(false);
      return;
    }
    if (!taxEstimatePostalCode) {
      if (!addressDefaultsLoaded) return;
      setTaxEstimate(null);
      setTaxEstimateError("Add a default shipping address to calculate tax.");
      setTaxEstimateLoading(false);
      return;
    }
    if (!/^\d{5}(?:-\d{4})?$/.test(taxEstimatePostalCode)) {
      setTaxEstimate(null);
      setTaxEstimateError("Invalid postal code");
      setTaxEstimateLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setTaxEstimateLoading(true);
          setTaxEstimateError(null);
          const res = await taxesAPI.estimate({
            subtotal,
            shipping: effectiveShippingPdp,
            postalCode: taxEstimatePostalCode,
          });
          if (!cancelled) setTaxEstimate(res);
        } catch (e) {
          if (cancelled) return;
          setTaxEstimate(null);
          setTaxEstimateError(e instanceof Error ? e.message : "Could not calculate tax");
        } finally {
          if (!cancelled) setTaxEstimateLoading(false);
        }
      })();
    }, PDP_TAX_ESTIMATE_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [subtotal, effectiveShippingPdp, taxEstimatePostalCode, addressDefaultsLoaded]);

  const handleEstimateShipFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEstimateShipForm((prev) => ({ ...prev, [name]: value }));
  };

  const shipToAddressReady = Boolean(
    String(estimateShipForm.postcode || "").trim() && String(estimateShipForm.country || "").trim()
  );
  const showShipToForm = !shipToAddressReady || shipToEditing;

  // Handle Add to Cart (logged-in or guest via X-Guest-Session-Id from api.ts)
  const handleAddToCart = async () => {
    if (!skipDimensionsForPrice && !String(width).trim()) {
      setMessage("❌ Error: Width is required");
      setTimeout(() => setMessage(""), 5000);
      return;
    }
    if (!skipDimensionsForPrice && !String(height).trim()) {
      setMessage("❌ Error: Height is required");
      setTimeout(() => setMessage(""), 5000);
      return;
    }
    if (!skipDimensionsForPrice && (widthInches <= 0 || heightInches <= 0)) {
      setMessage("❌ Error: Width and Height must be greater than 0");
      setTimeout(() => setMessage(""), 5000);
      return;
    }
    if (missingRequiredModifiers.length > 0) {
      const firstMissing = missingRequiredModifiers[0];
      setMessage(`❌ Error: Please select ${firstMissing.name || firstMissing.key}`);
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    for (let i = 0; i < jobs.length; i++) {
      if (!jobs[i].jobName.trim()) {
        setMessage(`❌ Error: Job ${i + 1}: Please enter Job Name/PO#`);
        setTimeout(() => setMessage(""), 5000);
        return;
      }
      const q = parseInt(jobs[i].quantity, 10);
      if (!Number.isFinite(q) || q < 1) {
        setMessage(`❌ Error: Job ${i + 1}: Quantity must be at least 1`);
        setTimeout(() => setMessage(""), 5000);
        return;
      }
    }

    let fedExValidatedQuoteAmount: number | undefined;
    const resolvedRateForCart =
      fedexRates.find((r) => r.serviceType === selectedFedexServiceType) ??
      (fedexRates.length > 0 ? fedexRates[0] : null);
    if (isAuthenticated()) {
      if (!String(estimateShipForm.postcode || "").trim() || !String(estimateShipForm.country || "").trim()) {
        setMessage("❌ Error: Enter ship-to postal code and country for FedEx.");
        setTimeout(() => setMessage(""), 5000);
        return;
      }
      if (fedexRatesLoading) {
        setMessage("❌ Error: Please wait for FedEx rates to finish loading.");
        setTimeout(() => setMessage(""), 5000);
        return;
      }
      if (fedexRatesError || !resolvedRateForCart || fedexRates.length === 0) {
        setMessage("❌ Error: Choose a FedEx service (check ship-to address and try again).");
        setTimeout(() => setMessage(""), 5000);
        return;
      }
      const chargeNum = Number(resolvedRateForCart.totalCharge);
      if (!Number.isFinite(chargeNum) || chargeNum < 0) {
        setMessage("❌ Error: FedEx rate is invalid. Refresh rates and try again.");
        setTimeout(() => setMessage(""), 5000);
        return;
      }
      fedExValidatedQuoteAmount = chargeNum;
    }

    setAddingToCart(true);
    setMessage("");

    try {
      // Extract fullWall and halfWall quantities from strings
      const fullWallQty = parseInt(fullWall.match(/\d+/)?.[0] || "0") || 0;
      const halfWallQty = parseInt(halfWall.match(/\d+/)?.[0] || "0") || 0;

      const jobsPayload = jobs.map((j) => {
        const q = Math.max(1, parseInt(j.quantity, 10) || 1);
        const up = unitPrice;
        return {
          jobName: j.jobName.trim(),
          quantity: q,
          unitPrice: up,
          lineSubtotal: up * q,
        };
      });
      const totalQty = jobsPayload.reduce((s, j) => s + j.quantity, 0);
      const subtotalNum = jobsPayload.reduce((s, j) => s + j.lineSubtotal, 0);
      const fedexRawAdd = fedExValidatedQuoteAmount ?? 0;
      const shipEffAdd = effectiveOrderShipping(fedexRawAdd, subtotalNum, freeShippingPolicy, false);
      const taxNum = ((subtotalNum + shipEffAdd) * activeTaxPercentage) / 100;
      const totalNum = subtotalNum + shipEffAdd + taxNum;
      const legacyJobName =
        jobsPayload.length === 1
          ? jobsPayload[0].jobName
          : `${jobsPayload[0].jobName} (+${jobsPayload.length - 1} more)`;

      // Cart/checkout always show the listing image (first photo), not whichever gallery thumb is selected on this page.
      const listingGallery = normalizeProductGalleryImages(product);
      const firstListingRaw =
        listingGallery.length > 0
          ? listingGallery[0]
          : product?.image_url || product?.image;
      const productImageForCart =
        getProductImageUrl(firstListingRaw ? String(firstListingRaw).trim() : "") || "";

      const hardwareCartFields: Record<string, string | number> = {};
      if (hardwareFedexShipping && product?.hardware_template_id != null) {
        const hid = Number(product.hardware_template_id);
        if (Number.isFinite(hid)) {
          hardwareCartFields.hardware_template_id = hid;
          hardwareCartFields.hardwareTemplateId = hid;
          hardwareCartFields.shipping_length = hardwareFedexShipping.length;
          hardwareCartFields.shipping_width = hardwareFedexShipping.width;
          hardwareCartFields.shipping_height = hardwareFedexShipping.height;
          hardwareCartFields.shipping_weight = hardwareFedexShipping.weightPerUnit;
        }
      }

      let loggedInFedexPayload: Record<string, unknown> = {};
      if (fedExValidatedQuoteAmount !== undefined && resolvedRateForCart) {
        const svc = String(resolvedRateForCart.serviceType ?? "").trim();
        const cur = (String(resolvedRateForCart.currency ?? "USD").trim() || "USD").toUpperCase();
        const name = (String(resolvedRateForCart.serviceName ?? "").trim() || svc).trim() || svc;
        const ed = resolvedRateForCart.estimatedDelivery ?? null;
        loggedInFedexPayload = {
          shippingService: svc,
          shipping_service: svc,
          shippingRateServiceName: name,
          shipping_rate_service_name: name,
          shippingRateAmount: fedExValidatedQuoteAmount,
          shipping_rate_amount: fedExValidatedQuoteAmount,
          shippingRateCurrency: cur,
          shipping_rate_currency: cur,
          shippingRateEstimatedDelivery: ed,
          shipping_rate_estimated_delivery: ed,
        };
      }

      const cartItem = {
        productId: productId,
        productName: productName,
        productImage: productImageForCart,
        width: widthInches,
        height: heightInches,
        areaSqFt: areaSqFt,
        ...hardwareCartFields,
        purchase_option_key: hasPurchaseOptions ? (effectiveScopeKey ?? undefined) : undefined,
        selection_mode: (!hasPurchaseOptions && isGraphicScenario) ? selectedGraphicMode : undefined,
        jobs: jobsPayload,
        quantity: totalQty,
        jobName: legacyJobName,
        turnaround: "free-same-day",
        shippingMode: "blind_drop_ship",
        shipping: "blind-drop",
        // Guest: omit FedEx quote on the line; cart shows "rate at checkout" until checkout (address + FedEx).
        // Logged-in: camelCase + snake_case so backend/cart always persist cartLineFedexQuotedAmount fields.
        ...loggedInFedexPayload,
        emailProof: false,
        fullWall: fullWallQty,
        halfWall: halfWallQty,
        totalJobs: jobsPayload.length,
        productType: productType,
        reinforcedStrip: reinforcedStrip,
        carryBag: carryBag,
        sandbag: sandbag,
        unitPrice: unitPrice,
        subtotal: subtotalNum,
        total: totalNum,
        pricePerSqFt: pricePerSqFt,
        minCharge: minCharge,
        material: productMaterial,
        selectedModifiers,
        pricing_snapshot: previewPricing ?? undefined,
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

    } catch (error: unknown) {
      console.error("Error adding to cart:", error);
      const msg = error instanceof Error ? error.message : "Failed to add product to cart";
      setMessage(`❌ Error: ${msg}`);
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setAddingToCart(false);
    }
  };

  const productGalleryUrls = normalizeProductGalleryImages(product);
  const idx = Math.min(selectedProductImageIndex, Math.max(0, productGalleryUrls.length - 1));
  const productImageRaw =
    productGalleryUrls.length > 0
      ? productGalleryUrls[idx]
      : product?.image_url || product?.image;
  const imageSrc = getProductImageUrl(productImageRaw) || '';
  const isProductImageBackendUpload = productImageRaw && String(productImageRaw).trim().startsWith("/uploads/");
  const productName = product?.name || "Product";
  const productDescription = product?.description || "";
  const productSpec = product?.spec || "";
  const productFileSetup = product?.file_setup || "";
  const productInstallationGuide = product?.installation_guide || "";
  const productFaq: ProductFaqItem[] = (() => {
    const f = product?.faq;
    if (Array.isArray(f)) {
      return f
        .map((item) => ({
          question: String(item?.question || "").trim(),
          answer: String(item?.answer || "").trim(),
        }))
        .filter((item) => item.question || item.answer);
    }
    if (typeof f === "string") {
      try {
        const parsed = JSON.parse(f);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((item) => ({
            question: String((item as ProductFaqItem)?.question || "").trim(),
            answer: String((item as ProductFaqItem)?.answer || "").trim(),
          }))
          .filter((item) => item.question || item.answer);
      } catch {
        return [];
      }
    }
    return [];
  })();
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

  /** Strip thumbnails only — hero image always uses this product’s `imageSrc` (not the first product per subcategory from the list API). */
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

  const mainHeroSrc = imageSrc;
  const showMainHero = Boolean(mainHeroSrc && mainHeroSrc !== "/placeholder.jpg");

  if (loading) {
    return (
      <>
        <Navbar />
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
        <Navbar />
        <div className="min-h-screen bg-white pt-24 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Product Not Found</h1>
              <div className="flex justify-center pt-2">
                <BackToProductsLink />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <BackToProductsLink />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-6">{productName}</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12 min-w-0">
          {/* Left Panel - Product Image and Details */}
          <div className="min-w-0 max-w-full">
            {/* Main Product Image */}
            <div className="mb-4">
                <div 
                  className="w-full h-150 mt-6 bg-gray-100 border border-gray-300 rounded-lg relative overflow-hidden cursor-zoom-in"
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
                  {showMainHero ? (
                    isProductImageBackendUpload || (mainHeroSrc || "").includes("/uploads/") ? (
                      <img
                        key={String(product?.id ?? productId)}
                        src={mainHeroSrc}
                        alt={productName}
                        className="w-full h-full object-cover  transition-transform duration-300 ease-out"
                        style={{
                          transform: `scale(${imageZoom.scale})`,
                          transformOrigin: `${imageZoom.x}% ${imageZoom.y}%`,
                        }}
                      />
                    ) : (
                      <Image
                        key={String(product?.id ?? productId)}
                        src={mainHeroSrc}
                        alt={productName}
                        fill
                        className="object-cover transition-transform duration-300  ease-out"
                        sizes="(max-width: 1024px) 96vw, 60vw"
                        style={{
                          transform: `scale(${imageZoom.scale})`,
                          transformOrigin: `${imageZoom.x}% ${imageZoom.y}%`,
                        }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex border-2 border-gray-500 items-center justify-center">
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

            {/* Product photo gallery (admin multi-upload) */}
            {productGalleryUrls.length > 1 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-gray-600">Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {productGalleryUrls.map((raw, gidx) => {
                    const thumbSrc = getProductImageUrl(raw) || "";
                    const isBack = raw && String(raw).trim().startsWith("/uploads/");
                    return (
                      <button
                        key={`${raw}-${gidx}`}
                        type="button"
                        onClick={() => setSelectedProductImageIndex(gidx)}
                        className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                          idx === gidx ? "border-sky-600 ring-2 ring-sky-200" : "border-gray-200 hover:border-gray-400"
                        }`}
                      >
                        {thumbSrc ? (
                          isBack ? (
                            <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Image src={thumbSrc} alt="" fill className="object-cover" sizes="80px" />
                          )
                        ) : (
                          <div className="h-full w-full bg-gray-200" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subcategories Thumbnail Gallery (show only when multiple subcategories exist) */}
            {subcategories.length > 1 && (
              <div className="mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {subcategoryThumbnails.map((sub, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedImageIndex(idx);
                      setSelectedSubcategory(sub.label);
                    }}
                    className={`w-25 h-25 bg-gray-100 border-2 rounded cursor-pointer hover:border-gray-400 relative overflow-hidden shrink-0 ${
                      selectedSubcategory === sub.label
                        ? 'border-gray-400 ring-2 ring-gray-300'
                        : selectedImageIndex === idx
                          ? 'border-gray-400'
                          : 'border-gray-400'
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
                {(skipDimensionsForPrice || (widthInches > 0 && heightInches > 0)) ? (
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      ${unitPrice.toFixed(2)}
                    </p>
                    {!skipDimensionsForPrice && displayPricingMode === "area" ? (
                      <>
                        <p className="text-sm text-gray-600 mt-1">
                          Based on {widthInches} in × {heightInches} in ({areaSqFt.toFixed(4)} sq ft)
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Size in feet: {(widthInches / 12).toFixed(2)} ft × {(heightInches / 12).toFixed(2)} ft
                        </p>
                      </>
                    ) : !skipDimensionsForPrice ? (
                      <p className="text-sm text-gray-600 mt-1">
                        Size: {widthInches} in × {heightInches} in ({(widthInches / 12).toFixed(2)} ft ×{" "}
                        {(heightInches / 12).toFixed(2)} ft)
                      </p>
                    ) : null}
                    {previewPricing?.minApplied ? (
                      <p className="text-xs text-amber-700 mt-1">Minimum charge applied.</p>
                    ) : null}
                    {previewLoading ? (
                      <p className="text-xs text-gray-500 mt-1">Updating live quote…</p>
                    ) : null}
                  </div>
                ) : null}
            </div>

            {/* Product Highlights */}
            {Array.isArray(product?.product_highlights) && product.product_highlights.length > 0 && (
              <ul className="mb-6 space-y-1.5">
                {product.product_highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-700" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right Panel - Configuration and Order */}
          <div className="min-w-0 max-w-full">
            {hasPurchaseOptions ? (
              /* New dynamic purchase options system */
              <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  {purchaseOptions.map((opt) => {
                    const isSelected = effectiveScopeKey === opt.option_key;
                    return (
                      <button
                        key={opt.option_key}
                        type="button"
                        className={`rounded-lg border px-4 py-3 text-sm font-semibold transition flex min-h-[50px] flex-col items-center justify-center text-center ${
                          isSelected
                            ? "border-sky-500 bg-sky-50 text-sky-800"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                        onClick={() => {
                          setSelectedPurchaseOptionKey(opt.option_key);
                          // Re-compute modifier defaults for the new scope
                          const newScope = opt.option_key;
                          const groups = (Array.isArray(product?.modifier_groups) ? product.modifier_groups : []).filter((group) => {
                            const scope = String((group as { mode_scope?: string }).mode_scope || "all").toLowerCase();
                            return scope === "all" || scope === newScope;
                          });
                          const defaults: Record<string, string> = {};
                          for (const g of groups) {
                            const options = Array.isArray(g.options) ? g.options : [];
                            const def = options.find((o) => o.is_default);
                            const defValue = modifierOptionValue(def);
                            if (defValue) defaults[String(g.key)] = defValue;
                          }
                          setSelectedModifiers(defaults);
                        }}
                      >
                        <span className="block">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : isGraphicScenario ? (
              /* Legacy graphic scenario (no purchase_options defined yet) */
              <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                      selectedGraphicMode === "graphic_frame"
                        ? "border-sky-500 bg-sky-50 text-sky-800"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedGraphicMode("graphic_frame")}
                  >
                    Graphic + Frame
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                      selectedGraphicMode === "graphic_only"
                        ? "border-sky-500 bg-sky-50 text-sky-800"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedGraphicMode("graphic_only")}
                  >
                    Graphic Only
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Width (inches) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={width}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^\d*\.?\d*$/.test(v)) setWidth(v);
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Height (inches) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={height}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || /^\d*\.?\d*$/.test(v)) setHeight(v);
                      }}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeModifierGroups.length > 0 ? (
              <div className="mb-6 p-4 border border-gray-200 rounded-lg">
                <div className="space-y-3">
                  {!isGraphicScenario && String(product?.material || "").trim() ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                      <label className="text-sm font-medium text-gray-700 sm:min-w-[140px]">Material</label>
                      <div className="w-full sm:min-w-[320px] sm:flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm text-gray-900">
                        {String(product?.material || "").trim()}
                      </div>
                    </div>
                  ) : null}
                  {activeModifierGroups.map((group) => {
                    const options = Array.isArray(group.options) ? group.options : [];
                    const selectedValue = String(selectedModifiers[group.key] || "");
                    const isGroupDisabledByRule = disabledModifierGroupKeys.has(group.key);
                    const autoSelectedOptionId = autoSelectedModifierOptionIdsByGroup.get(group.key) ?? null;
                    const selectedOption = options.find((o) => modifierOptionValue(o) === selectedValue);
                    const selectedLabel = selectedOption
                      ? (() => {
                          const value = modifierOptionValue(selectedOption);
                          const label = String(selectedOption.label || "").trim();
                          return value && value !== label ? `${label} - ${value}` : String(label || value || "Select option");
                        })()
                      : "Select option";
                    return (
                      <div key={group.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <label className="text-sm font-medium text-gray-700 sm:min-w-[140px]">
                          {group.name}
                          {group.is_required ? <span className="text-red-500"> *</span> : null}
                        </label>
                        <div
                          className="relative w-full sm:min-w-[320px] sm:flex-1"
                          data-modifier-dropdown="true"
                        >
                          <button
                            type="button"
                            className={`flex w-full items-center justify-between rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              isGroupDisabledByRule
                                ? "cursor-not-allowed bg-gray-50 text-gray-400"
                                : "bg-white text-black"
                            }`}
                            disabled={isGroupDisabledByRule}
                            onClick={() =>
                              setOpenModifierKey((prev) => (prev === group.key ? null : group.key))
                            }
                          >
                            <span className="truncate">{selectedLabel}</span>
                            <span className="ml-2 text-gray-500">▾</span>
                          </button>
                          {openModifierKey === group.key ? (
                            <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                              {!group.is_required ? (
                                <button
                                  type="button"
                                  className={`block w-full px-3 py-2 text-left text-sm ${
                                    autoSelectedOptionId != null
                                      ? "cursor-not-allowed bg-gray-50 text-gray-400"
                                      : !selectedValue
                                      ? "bg-blue-50 text-blue-700"
                                      : "text-gray-700 hover:bg-gray-50"
                                  }`}
                                  disabled={autoSelectedOptionId != null}
                                  onClick={() => {
                                    if (autoSelectedOptionId != null) return;
                                    setSelectedModifiers((prev) => {
                                      const next = { ...prev };
                                      delete next[group.key];
                                      return next;
                                    });
                                    setOpenModifierKey(null);
                                  }}
                                >
                                  Select option
                                </button>
                              ) : null}
                              {options.map((opt, idx) => {
                                const optValue = modifierOptionValue(opt);
                                const isLockedOutByAutoSelect =
                                  autoSelectedOptionId != null && Number(opt.id || 0) !== autoSelectedOptionId;
                                const isDisabledByRule =
                                  isGroupDisabledByRule ||
                                  isLockedOutByAutoSelect ||
                                  (opt.id != null && disabledModifierOptionIds.has(Number(opt.id)));
                                const displayLeft =
                                  optValue && optValue !== String(opt.label || "")
                                    ? `${opt.label} - ${optValue}`
                                    : String(opt.label || optValue || `Option ${idx + 1}`);
                                const isActive = selectedValue === optValue;
                                return (
                                  <button
                                    key={`${group.key}-${optValue}-${idx}`}
                                    type="button"
                                    className={`block w-full px-3 py-2 text-left text-sm ${
                                      isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : isDisabledByRule
                                          ? "cursor-not-allowed bg-gray-50 text-gray-400"
                                        : "text-gray-700 hover:bg-gray-50"
                                    }`}
                                    disabled={isDisabledByRule}
                                    onClick={() => {
                                      if (isDisabledByRule) return;
                                      setSelectedModifiers((prev) => {
                                        const isUnselecting = !group.is_required && prev[group.key] === optValue;
                                        if (isUnselecting) {
                                          const next = { ...prev };
                                          delete next[group.key];
                                          return next;
                                        }
                                        return {
                                          ...prev,
                                          [group.key]: optValue,
                                        };
                                      });
                                      setOpenModifierKey(null);
                                    }}
                                  >
                                    {displayLeft}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Job Details */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
              <div className="space-y-4">
                {jobs.map((job, index) => {
                  const line = jobLines[index];
                  const linePrice = line ? line.lineSubtotal : 0;
                  return (
                    <div
                      key={job.id}
                      className="flex flex-wrap gap-4 items-end rounded-lg border border-gray-100 bg-white/60 p-3 sm:p-4"
                    >
                      <div className="min-w-0 flex-1 basis-[200px]">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Job Name/PO# <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={job.jobName}
                          onChange={(e) => updateJob(job.id, { jobName: e.target.value })}
                          className="box-border h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Job Name/PO#"
                          aria-label={`Job ${index + 1} name or PO number`}
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Qty</label>
                        <input
                          type="number"
                          value={job.quantity}
                          onChange={(e) => updateJob(job.id, { quantity: e.target.value })}
                          className="box-border h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min={1}
                          step={1}
                          aria-label={`Job ${index + 1} quantity`}
                        />
                      </div>
                      <div className="shrink-0">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Line total</label>
                        <div
                          className="box-border inline-flex h-10 max-w-full min-w-[5.5rem] items-center overflow-x-auto whitespace-nowrap rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-black tabular-nums [scrollbar-width:thin]"
                          aria-readonly="true"
                          title="Based on unit price × quantity"
                        >
                          ${linePrice.toFixed(2)}
                        </div>
                      </div>
                      {jobs.length > 1 ? (
                        <div className="shrink-0 flex items-end pb-0.5">
                          <button
                            type="button"
                            onClick={() => removeJob(job.id)}
                            className="inline-flex items-center mb-3 justify-center font-medium text-rose-600 hover:text-rose-800"
                            aria-label={`Remove job ${index + 1}`}
                            title="Delete"
                          >
                            <FiTrash2 size={18} aria-hidden />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3">
                <button
                  type="button"
                  onClick={addJob}
                  className="inline-flex min-w-0 items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                >
                  <span className="text-base leading-none" aria-hidden>
                    +
                  </span>
                  Add Another Job
                </button>
                <div className="inline-flex items-center gap-2 text-sm text-gray-600">
                  <span>One Artwork Per Job</span>
                  <button
                    type="button"
                    onClick={() => setJobArtworkInfoOpen(true)}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-400 bg-white text-[13px] font-semibold leading-none text-blue-600 shadow-sm hover:border-blue-500 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
                    aria-label="About one artwork per job"
                    title="About one artwork per job"
                  >
                    <span aria-hidden className="-mt-px">
                      ?
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Shipping — logged-in: live FedEx + ship-to; guests: quote at checkout only */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Shipping</h2>
              {isAuthenticated() ? (
              <div className="space-y-4">
                  {showShipToForm ? (
                    <div className="space-y-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ship to</p>
                      {addressDefaultsLoaded && !shipToAddressReady ? (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          <span>Add address</span>{" "}
                          <Link href="/address-book" className="font-medium text-amber-900 underline">
                            in address book
                          </Link>{" "}
                          to calculate shipping and tax.
                        </div>
                      ) : null}
                      <input
                        type="text"
                        name="streetAddress"
                        placeholder="Street address"
                        value={estimateShipForm.streetAddress}
                        onChange={handleEstimateShipFormChange}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      />
                      <input
                        type="text"
                        name="addressLine2"
                        placeholder="Apt, suite (optional)"
                        value={estimateShipForm.addressLine2}
                        onChange={handleEstimateShipFormChange}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          name="city"
                          placeholder="City"
                          value={estimateShipForm.city}
                          onChange={handleEstimateShipFormChange}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                        <select
                          name="state"
                          value={estimateShipForm.state}
                          onChange={handleEstimateShipFormChange}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        >
                          <option value="">State</option>
                          {US_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          type="text"
                          name="postcode"
                          placeholder="ZIP / Postal code *"
                          value={estimateShipForm.postcode}
                          onChange={handleEstimateShipFormChange}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                        <input
                          type="text"
                          name="country"
                          placeholder="Country"
                          value={estimateShipForm.country}
                          onChange={handleEstimateShipFormChange}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      </div>
                      {shipToAddressReady ? (
                        <button
                          type="button"
                          onClick={() => setShipToEditing(false)}
                          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                        >
                          Save address
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="relative rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                      <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-100/90 px-3 py-2.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Ship to</span>
                        <Link
                          href="/address-book"
                          className="rounded p-0.5 text-[#0B6BCB] transition hover:bg-white/80 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1"
                          aria-label="Update shipping address in address book"
                          title="Address book"
                        >
                          <HiOutlinePencilSquare className="h-5 w-5" aria-hidden />
                        </Link>
                      </div>
                      <div className="space-y-1 text-gray-900">
                        {estimateShipForm.streetAddress.trim() ? (
                          <p>{estimateShipForm.streetAddress.trim()}</p>
                        ) : null}
                        {estimateShipForm.addressLine2.trim() ? (
                          <p>{estimateShipForm.addressLine2.trim()}</p>
                        ) : null}
                        <p>
                          {[estimateShipForm.city, estimateShipForm.state].filter(Boolean).join(", ")}{" "}
                          {estimateShipForm.postcode.trim()}
                        </p>
                        {estimateShipForm.country.trim() ? <p>{estimateShipForm.country.trim()}</p> : null}
                        {!estimateShipForm.streetAddress.trim() &&
                        !estimateShipForm.addressLine2.trim() &&
                        !estimateShipForm.city.trim() &&
                        !estimateShipForm.state.trim() ? (
                          <p className="text-xs text-gray-500">
                            Postal destination only — use edit to add street and city.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div className="rounded-md border border-gray-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-0 flex-1">
                        <label htmlFor="pdp-fedex-service" className="mb-1 block text-sm font-medium text-gray-700">
                            Shipping service
                        </label>
                        {fedexRatesError ? <p className="mb-2 text-xs text-rose-600">{fedexRatesError}</p> : null}
                        {fedexRates.length > 0 ? (
                          <select
                            id="pdp-fedex-service"
                            value={selectedFedexServiceType}
                            onChange={(e) => setSelectedFedexServiceType(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-gray-800"
                          >
                            {fedexRates.map((r) => (
                              <option key={r.serviceType} value={r.serviceType}>
                                {r.serviceName}
                                {r.estimatedDelivery ? ` (${r.estimatedDelivery})` : ""}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-500">
                            {fedexRatesLoading
                              ? "Fetching shipping services…"
                              : !shipToAddressReady
                                ? "Enter postal code and country for Ship to to load FedEx services."
                                : "Enter height and width to get shipping service."}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Rate</p>
                        <p className="text-lg font-semibold tabular-nums text-gray-900">
                          {fedexRatesLoading && fedexRates.length === 0 ? (
                            <span className="ml-auto block w-20 pt-1" aria-hidden>
                              <span className="sr-only">Fetching shipping services</span>
                              <div className="pdp-fedex-rates-indeterminate-track">
                                <div className="pdp-fedex-rates-indeterminate-bar" />
                              </div>
                            </span>
                          ) : selectedFedexRatePdp ? (
                            `$${Number(selectedFedexRatePdp.totalCharge).toFixed(2)}`
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </p>
                      </div>
                    </div>
                    {fedexRatesLoading ? (
                      <div
                        className="pdp-fedex-rates-indeterminate-track mt-2"
                        role="progressbar"
                        aria-valuetext="Fetching shipping services"
                        aria-busy="true"
                      >
                        <div className="pdp-fedex-rates-indeterminate-bar" />
                      </div>
                    ) : null}
                  </div>
              </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-4 text-sm leading-relaxed text-gray-600">
                  <p>
                    Please provide your full shipping address at checkout. Available shipping services will be
                    calculated once your address is confirmed.
                  </p>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="mb-2 flex justify-between">
                <span className="text-gray-700">Subtotal</span>
                <span className="font-medium text-gray-900">${subtotal.toFixed(2)}</span>
              </div>
              <div className="mb-2 flex justify-between">
                <span className="text-gray-700">Shipping</span>
                <span className="font-medium text-gray-900 tabular-nums text-right">
                  {isAuthenticated() ? (
                    fedexRatesLoading && fedexRates.length === 0 ? (
                      <span className="inline-block w-20 align-middle" aria-hidden>
                        <span className="sr-only">Fetching shipping services</span>
                        <div className="pdp-fedex-rates-indeterminate-track">
                          <div className="pdp-fedex-rates-indeterminate-bar" />
                        </div>
                      </span>
                    ) : (
                      `$${effectiveShippingPdp.toFixed(2)}`
                    )
                  ) : (
                    <span className="text-sm font-normal text-gray-500">Calculated at checkout</span>
                  )}
                </span>
              </div>
              {isAuthenticated() &&
              fedexRawChargePdp > 0 &&
              effectiveShippingPdp === 0 &&
              freeShippingPolicy.freeShippingEnabled ? (
                <p className="mb-2 text-xs text-emerald-700">Free shipping applied (order meets threshold).</p>
              ) : null}
              {isAuthenticated() && selectedFedexRatePdp?.estimatedDelivery ? (
                <p className="mb-2 text-xs text-gray-600">
                  Estimated delivery: {selectedFedexRatePdp.estimatedDelivery}
                </p>
              ) : null}
              <div className="mb-2 flex justify-between">
                <span className="text-gray-700">
                  Tax ({activeTaxPercentage.toFixed(2)}%)
                </span>
                <span className="font-medium text-gray-900">
                  {taxEstimateLoading ? (
                    <span className="inline-block w-16 align-middle" aria-hidden>
                      <span className="sr-only">Calculating tax</span>
                      <div className="pdp-fedex-rates-indeterminate-track">
                        <div className="pdp-fedex-rates-indeterminate-bar" />
                      </div>
                    </span>
                  ) : (
                    `$${taxAmount.toFixed(2)}`
                  )}
                </span>
              </div>
              {isAuthenticated() && taxEstimateError ? (
                <p className="mb-2 text-xs text-rose-600">{taxEstimateError}</p>
              ) : null}
              <div className="flex justify-between border-t border-gray-300 pt-2">
                <span className="font-bold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">${totalWithTax.toFixed(2)}</span>
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
              {!productDescription && !hasProductProperties && (
                <p className="text-gray-600">No description available for this product yet.</p>
              )}
            </div>
          )}

          {activeTab === "spec" && (
            <div className="space-y-6 text-gray-700">
              {productSpec ? (
                /^[\s]*</.test(productSpec) ? (
                  <div
                    className="prose prose-sm max-w-full min-w-0 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
                    dangerouslySetInnerHTML={{ __html: productSpec }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{productSpec}</p>
                )
              ) : (
                <p className="text-gray-600">No spec available for this product yet.</p>
              )}
            </div>
          )}

          {activeTab === "file-setup" && (
            <div className="space-y-6 text-gray-700">
              {productFileSetup ? (
                /^[\s]*</.test(productFileSetup) ? (
                  <div
                    className="prose prose-sm max-w-full min-w-0 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
                    dangerouslySetInnerHTML={{ __html: productFileSetup }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{productFileSetup}</p>
                )
              ) : (
                <p className="text-gray-600">No file setup content available for this product yet.</p>
              )}
            </div>
          )}

          {activeTab === "installation-guide" && (
            <div className="space-y-6 text-gray-700">
              {productInstallationGuide ? (
                /^[\s]*</.test(productInstallationGuide) ? (
                  <div
                    className="prose prose-sm max-w-full min-w-0 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_img]:max-w-full [&_img]:h-auto"
                    dangerouslySetInnerHTML={{ __html: productInstallationGuide }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{productInstallationGuide}</p>
                )
              ) : (
                <p className="text-gray-600">No installation guide available for this product yet.</p>
              )}
            </div>
          )}

          {activeTab === "faq" && (
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Frequently asked questions</h3>
                {productFaq.length > 0 ? (
                  <div className="space-y-3">
                    {productFaq.map((faq, idx) => (
                      <div key={`${faq.question}-${idx}`} className="border border-gray-200 rounded-lg">
                        <button
                          onClick={() => setExpandedFAQ(expandedFAQ === idx ? null : idx)}
                          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">Q: {faq.question}</span>
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
                            <p className="text-gray-700 whitespace-pre-wrap">{faq.answer}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">No FAQ available for this product yet.</p>
                )}
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
                  const relatedPpsf = Number(relatedProduct.price_per_sqft);
                  const hasRelatedPpsf = Number.isFinite(relatedPpsf) && relatedPpsf > 0;
                  const relatedDescPlain = descriptionPreview(relatedProduct.description);
                  const handleSelectProduct = (e?: React.MouseEvent) => {
                    if (e) {
                      e.preventDefault();
                      e.stopPropagation();
                    }

                    // Update URL with new product ID - this will trigger useEffect to fetch new product
                    router.push(`/products/product-detail?productId=${relatedProduct.id}`);

                    // Reset form values for new product
                    setWidth("");
                    setHeight("");
                    setJobs([{ id: newProductJobRowId(), jobName: "", quantity: "1" }]);

                    // Scroll to top to show new product
                    window.scrollTo({ top: 0, behavior: "smooth" });
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
                              <img
                                src={relatedImgSrc}
                                alt={relatedProduct.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
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
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
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
                      <div className="p-4 flex h-full flex-col">
                        <div className="mb-2">
                          {relatedProduct.category_name && (
                            <p className="text-xs text-gray-500 mb-1">{relatedProduct.category_name}</p>
                          )}
                          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                            {relatedProduct.name}
                          </h3>
                        </div>
                        {relatedDescPlain ? (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-3 min-w-0 break-words [overflow-wrap:anywhere]">
                            {relatedDescPlain}
                          </p>
                        ) : null}
                        <div className="flex items-center justify-between">
                          {relatedProduct.price ? (
                            <p className="text-lg font-bold text-gray-900">${relatedProduct.price}</p>
                          ) : hasRelatedPpsf ? (
                            <p className="text-sm text-gray-700">Starting at ${relatedPpsf.toFixed(2)} per ft²</p>
                          ) : (
                            <p className="text-sm text-gray-700">Price on request</p>
                          )}
                          <span className="text-blue-600 text-sm font-medium group-hover:text-blue-700">
                            View Details →
                          </span>
                        </div>
                        <div className="mt-auto pt-3 border-t border-gray-200">
                          <button
                            type="button"
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
      {jobArtworkInfoOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white/45 p-4 backdrop-blur-[1px] backdrop-saturate-150 supports-[backdrop-filter]:bg-white/35"
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-artwork-info-title"
          onClick={() => setJobArtworkInfoOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200/60 bg-slate-50/90 p-4 shadow-2xl shadow-slate-900/10 ring-1 ring-white/60 backdrop-blur-sm sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="job-artwork-info-title" className="text-lg font-semibold text-slate-800 pr-2">
                One Artwork Per Job
              </h2>
              <button
                type="button"
                onClick={() => setJobArtworkInfoOpen(false)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white/80 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                aria-label="Close"
              >
                <FiX className="h-6 w-6" aria-hidden />
              </button>
            </div>
            <div className="relative w-full overflow-hidden rounded-lg border border-slate-200/50 bg-white shadow-inner">
              <Image
                src={ONE_ARTWORK_PER_JOB_IMAGE}
                alt="Illustration explaining one artwork per job"
                width={1200}
                height={800}
                className="h-auto w-full max-h-[min(70vh,800px)] object-contain"
                sizes="(max-width: 768px) 100vw, 90vw"
                quality={95}
              />
            </div>
          </div>
        </div>
      ) : null}
      <Footer />
    </>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={
      <>
        <Navbar />
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

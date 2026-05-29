import { isArtworkDownloadProxyUrl } from "./backendUploadProxy";

// API Configuration - ensure base URL always ends with /api (backend mounts routes at /api)
function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  const base = raw.trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}
const API_BASE_URL = getApiBaseUrl();
const inFlightGetRequests = new Map<string, Promise<unknown>>();

const GUEST_SESSION_STORAGE_KEY = 'rps_guest_session_id';

export function getOrCreateGuestSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(GUEST_SESSION_STORAGE_KEY)?.trim() || '';
    if (id.length >= 8 && id.length <= 128) return id;
    id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    if (id.length > 128) id = id.slice(0, 128);
    localStorage.setItem(GUEST_SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function isCartApiEndpoint(endpoint: string): boolean {
  return endpoint === '/cart' || endpoint.startsWith('/cart/');
}

/** Guest checkout must send X-Guest-Session-Id so the server can clear the guest cart after order. */
function needsGuestSessionHeader(endpoint: string): boolean {
  return isCartApiEndpoint(endpoint) || endpoint === '/orders/create-payment-intent';
}

/** Get backend base URL (no /api) for image URLs - works in browser */
export function getBackendBaseUrl(): string {
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/?$/, '') || 'http://localhost:8080';
}

/** Convert product/category image URL to full URL (for /uploads/ paths from backend) */
export function getProductImageUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  let u = url.trim();
  if (!u) return '';
  // DB/API sometimes store "uploads/..." without leading slash
  if (u.startsWith('uploads/')) u = `/${u}`;
  if (u.startsWith('/uploads/')) {
    const base = getBackendBaseUrl();
    return base + u;
  }
  return u;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const safeName = filename.replace(/[/\\]/g, '_');
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = safeName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Save a file from a URL (e.g. backend `/uploads/...`) with a chosen filename.
 * Uses a same-origin Next.js proxy for backend `/uploads/` URLs (works for guests / no login — no CORS).
 */
export async function downloadUrlAsFile(url: string, filename: string): Promise<void> {
  const safeName = filename.replace(/[/\\]/g, '_');
  if (typeof window !== "undefined" && isArtworkDownloadProxyUrl(url)) {
    const proxyUrl = `/api/artwork-download?u=${encodeURIComponent(url)}&fn=${encodeURIComponent(safeName)}`;
    try {
      const proxied = await fetch(proxyUrl, { credentials: "same-origin" });
      if (proxied.ok) {
        const blob = await proxied.blob();
        triggerBlobDownload(blob, safeName);
        return;
      }
    } catch {
      /* try anchor fallback below */
    }
    try {
      const a = document.createElement("a");
      a.href = proxyUrl;
      a.download = safeName;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    } catch {
      /* fall through to direct fetch */
    }
  }
  const res = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }
  const blob = await res.blob();
  triggerBlobDownload(blob, safeName);
}

export type ShippingRates = { ground: number; express: number; overnight: number };

/** Admin / public shipping-rates API: threshold order subtotal for waived shipping. */
export type FreeShippingPolicy = {
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
};

export type ShippingRatesResponse = {
  rates: ShippingRates;
  methods?: ShippingMethod[];
  freeShippingEnabled?: boolean;
  freeShippingThreshold?: number;
};

export type ShippingRatesAdminPayload = ShippingRates & {
  freeShippingEnabled?: boolean;
  freeShippingThreshold?: number;
};

export type ShippingMethod = {
  id: number;
  name: string;
  price: number;
  is_active?: boolean;
  sort_order?: number;
};

export type ShippingBox = {
  id: number;
  name: string;
  length: number;
  width: number;
  height: number;
  is_active?: boolean;
};

export type ProductShippingBoxRule = {
  id?: number;
  shipping_box_id: number;
  min_smallest_side?: number | null;
  max_smallest_side?: number | null;
  max_quantity_per_box?: number | null;
  max_weight_per_box?: number | null;
  sort_order?: number;
  is_active?: boolean;
  box?: {
    id?: number;
    name?: string;
    length?: number;
    width?: number;
    height?: number;
  };
};
export type StorePickupAddress = {
  id: number;
  label: string;
  street_address: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  is_active?: boolean;
};

export type StoreAddress = {
  id: number;
  label: string;
  company?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  street_address: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postcode: string;
  country: string;
  is_default?: boolean;
  is_active?: boolean;
};

export type Tax = {
  id: number;
  name: string;
  percentage: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type TaxEstimateResponse = {
  success: boolean;
  taxRate: number;
  taxPercentage: number;
  tax: number;
  total: number;
  subtotal: number;
  shipping: number;
  postalCode?: string;
  addressId?: number | null;
  warning?: string;
};

export type ModifierOption = {
  id?: number;
  label: string;
  value: string;
  price_adjustment?: number;
  price_type?: string;
  is_default?: boolean;
  is_active?: boolean;
  sort_order?: number;
};

export type ModifierGroup = {
  id?: number;
  key: string;
  name: string;
  input_type?: string;
  is_required?: boolean;
  /** Any option key or "all". Dynamic — not limited to the legacy graphic_only/graphic_frame values. */
  mode_scope?: string;
  is_active?: boolean;
  sort_order?: number;
  options: ModifierOption[];
};

/** Admin-only: named bundle of existing catalog modifiers (by group id). */
export type ModifierPresetItem = {
  id: number;
  modifier_group_id: number;
  sort_order: number;
  key: string;
  name: string;
};

export type ModifierPreset = {
  id: number;
  name: string;
  sort_order: number;
  modifiers: ModifierPresetItem[];
};

export type ProductPurchaseOption = {
  id?: number;
  label: string;
  option_key: string;
  pricing_mode?: "fixed" | "area";
  unit_price?: number | null;
  base_unit_price?: number | null;
  price_per_sqft?: number | null;
  min_charge?: number | null;
  sort_order?: number;
  is_default?: boolean;
  is_active?: boolean;
};

export type HardwareTemplateOptionModifier = {
  id?: number;
  key: string;
  name?: string;
  is_required?: boolean;
  sort_order?: number;
};

export type HardwareTemplateOption = {
  id?: number;
  label: string;
  option_key: string;
  unit_price: number;
  base_unit_price?: number;
  modifier_total?: number;
  computed_unit_price?: number;
  is_default?: boolean;
  sort_order?: number;
  is_active?: boolean;
  modifiers: HardwareTemplateOptionModifier[];
};

export type HardwareTemplate = {
  id?: number;
  name: string;
  is_active?: boolean;
  options: HardwareTemplateOption[];
};

export type ProductConditionalModifierRule = {
  id?: number;
  product_id?: number;
  hardware_option_id?: number | null;
  hardware_option_key?: string | null;
  hardware_option_label?: string | null;
  source_modifier_id: number;
  source_modifier_key?: string;
  source_modifier_name?: string;
  source_option_id?: number | null;
  source_option_value?: string | null;
  source_option_label?: string | null;
  action_type: "auto_select" | "disable";
  target_modifier_id: number;
  target_modifier_key?: string;
  target_modifier_name?: string;
  target_option_id?: number | null;
  target_option_value?: string | null;
  target_option_label?: string | null;
  sort_order?: number;
};

export type ArtworkUploadPayload = {
  widthPx: number | null;
  heightPx: number | null;
  sizeBytes: number;
  mimeType: string;
  pdfPageCount?: number | null;
};
export type ArtworkRecord = {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  widthPx: number | null;
  heightPx: number | null;
  pdfPageCount: number | null;
  unit: "px";
  url: string;
  createdAt: string;
};

export type CartSummary = {
  subtotal: number;
  shipping: number;
  taxAmount: number;
  taxName: string | null;
  taxPercentage: number;
  total: number;
};

export type FedexRateQuote = {
  serviceType: string;
  serviceName: string;
  totalCharge: number;
  currency: string;
  estimatedDelivery?: string | null;
};

const FEDEX_SERVICE_TRANSIT_BUSINESS_DAYS: Record<string, number> = {
  FIRST_OVERNIGHT: 1,
  PRIORITY_OVERNIGHT: 1,
  STANDARD_OVERNIGHT: 1,
  FEDEX_2_DAY_AM: 2,
  FEDEX_2_DAY: 2,
  FEDEX_EXPRESS_SAVER: 3,
  FEDEX_GROUND: 5,
  GROUND_HOME_DELIVERY: 5,
  GROUND_ECONOMY: 7,
  SMART_POST: 7,
};

function addBusinessDays(date: Date, days: number): Date {
  const out = new Date(date.getTime());
  let remaining = Math.max(0, Math.trunc(days));
  while (remaining > 0) {
    out.setDate(out.getDate() + 1);
    const day = out.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return out;
}

function parseFedexDeliveryDate(value: string | null | undefined): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct;

  const match = raw.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:,\s*(\d{4}))?\b/);
  if (!match) return null;
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  const parsed = new Date(`${match[1]} ${match[2]}, ${year}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateForDeliveryEstimate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function productionTimeBusinessDays(value: unknown): number {
  if (value == null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.trunc(n);
}

export type ProductionTimeRule = {
  minQty: number;
  maxQty: number | null;
  businessDays: number;
};

export function normalizeProductionTimeRules(value: unknown): ProductionTimeRule[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = raw.trim() ? JSON.parse(raw) : [];
    } catch {
      raw = [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((rule) => {
      const r = rule && typeof rule === "object" ? rule as Record<string, unknown> : {};
      const minQty = Math.trunc(Number(r.minQty ?? r.min_qty ?? 1));
      const maxQtyRaw = r.maxQty ?? r.max_qty;
      const maxQty =
        maxQtyRaw == null || maxQtyRaw === "" ? null : Math.trunc(Number(maxQtyRaw));
      const businessDays = Math.trunc(Number(r.businessDays ?? r.business_days));
      if (!Number.isFinite(minQty) || minQty < 1) return null;
      if (maxQty !== null && (!Number.isFinite(maxQty) || maxQty < minQty)) return null;
      if (!Number.isFinite(businessDays) || businessDays < 0) return null;
      return { minQty, maxQty, businessDays };
    })
    .filter((rule): rule is ProductionTimeRule => Boolean(rule))
    .sort((a, b) => a.minQty - b.minQty);
}

export function productionTimeBusinessDaysForQuantity(
  quantity: unknown,
  rules: unknown
): number {
  const qty = Math.max(1, Math.trunc(Number(quantity) || 1));
  const match = normalizeProductionTimeRules(rules).find(
    (rule) => qty >= rule.minQty && (rule.maxQty == null || qty <= rule.maxQty)
  );
  return match ? match.businessDays : 0;
}

function productionTimeQuantityFromItem(item: Record<string, unknown>): number {
  const jobs = Array.isArray(item.jobs) ? item.jobs : [];
  if (jobs.length > 0) {
    return jobs.reduce((sum, job) => {
      const row = job && typeof job === "object" ? job as Record<string, unknown> : {};
      return sum + Math.max(1, Math.trunc(Number(row.quantity) || 1));
    }, 0);
  }
  return Math.max(1, Math.trunc(Number(item.quantity) || 1));
}

export function maxProductionTimeBusinessDays(
  items: Array<Record<string, unknown>> | null | undefined
): number {
  return (Array.isArray(items) ? items : []).reduce((max, item) => {
    const snap = item.pricing_snapshot && typeof item.pricing_snapshot === "object"
      ? item.pricing_snapshot as Record<string, unknown>
      : {};
    const rules =
      item.productionTimeRules ??
      item.production_time_rules ??
      snap.productionTimeRules ??
      snap.production_time_rules;
    const productionDays = productionTimeBusinessDaysForQuantity(
      productionTimeQuantityFromItem(item),
      rules
    );
    return Math.max(
      max,
      productionDays
    );
  }, 0);
}

export function fedexDeliveryEstimateWithProduction(
  rate: Pick<FedexRateQuote, "serviceType" | "estimatedDelivery"> | null | undefined,
  productionDaysRaw: unknown
): string | null {
  if (!rate) return null;
  const productionDays = productionTimeBusinessDays(productionDaysRaw);
  const serviceType = String(rate.serviceType || "").trim().toUpperCase();
  const serviceDays = FEDEX_SERVICE_TRANSIT_BUSINESS_DAYS[serviceType] ?? null;
  const fedexDate = parseFedexDeliveryDate(rate.estimatedDelivery);

  if (fedexDate) {
    return formatDateForDeliveryEstimate(addBusinessDays(fedexDate, productionDays));
  }
  if (serviceDays != null) {
    return formatDateForDeliveryEstimate(addBusinessDays(new Date(), productionDays + serviceDays));
  }
  if (rate.estimatedDelivery && String(rate.estimatedDelivery).trim()) {
    return productionDays > 0
      ? `${String(rate.estimatedDelivery).trim()} + ${productionDays} production business day${productionDays === 1 ? "" : "s"}`
      : String(rate.estimatedDelivery).trim();
  }
  return productionDays > 0
    ? `${productionDays} production business day${productionDays === 1 ? "" : "s"} + FedEx transit`
    : null;
}

export type ReportsDateRange = "all" | "today" | "last30" | "custom";

export type AdminDashboardSummary = {
  registeredUsersCount: number;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  pendingOrders: number;
  refundOrders: number;
  completedOrders: number;
  refundAmount: number;
  registeredCompletedOrders: number;
  registeredInProgressOrders: number;
  guestCompletedOrders: number;
  guestInProgressOrders: number;
};

export type AdminDashboardRevenuePoint = {
  bucket: string;
  revenue: number;
};

export type AdminDashboardOrdersOverview = {
  pending: number;
  processing: number;
  shipped: number;
  completed: number;
  statusBreakdown: { status: string; count: number }[];
};

export type AdminDashboardTopProduct = {
  productId: string | null;
  productName: string;
  orderCount: number;
  revenue: number;
};

export type AdminDashboardRecentOrder = {
  orderId: number;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  date: string;
};

export type AdminDashboardResponse = {
  filters: {
    range: ReportsDateRange;
    from: string;
    to: string;
  };
  summary: AdminDashboardSummary;
  revenueChart: {
    year: number;
    availableYears: number[];
    series: AdminDashboardRevenuePoint[];
  };
  ordersOverview: AdminDashboardOrdersOverview;
  topProducts: AdminDashboardTopProduct[];
  recentOrders: AdminDashboardRecentOrder[];
};

const DEFAULT_SHIPPING_RATES: ShippingRates = { ground: 120.07, express: 0, overnight: 0 };

/** Match backend: Ground / Express / Overnight → admin-configured prices */
export function shippingAmountForService(
  rates: ShippingRates | null | undefined,
  serviceLabel: string | undefined
): number {
  const r = rates ?? DEFAULT_SHIPPING_RATES;
  const s = String(serviceLabel || "").trim().toLowerCase();
  if (s === "ground") return Number(r.ground) || 0;
  if (s === "express") return Number(r.express) || 0;
  if (s === "overnight") return Number(r.overnight) || 0;
  return 0;
}

export function shippingAmountForMethod(
  methods: ShippingMethod[] | null | undefined,
  serviceLabel: string | undefined,
  fallbackRates?: ShippingRates | null
): number {
  const label = String(serviceLabel || "").trim().toLowerCase();
  const list = Array.isArray(methods) ? methods : [];
  const matched = list.find((m) => String(m?.name || "").trim().toLowerCase() === label);
  if (matched) return Number(matched.price) || 0;
  return shippingAmountForService(fallbackRates, serviceLabel);
}

function roundMoney2Client(n: number): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

/** Normalize shipping service name for grouping (same method = one charge). */
function normalizeShippingServiceKey(serviceLabel: string | null | undefined): string {
  return String(serviceLabel || "").trim().toLowerCase();
}

/** FedEx box from product admin `shipping_*` (inches, lb per sellable unit) when hardware template is set. */
export type HardwareFedexShipping = {
  length: number;
  width: number;
  height: number;
  weightPerUnit: number;
};

export type ProductFedexShipping = {
  length: number | null;
  weightPerUnit: number | null;
};

function parsePositiveProductNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function productShippingBoxRulesFrom(value: {
  shipping_box_rules?: unknown;
  shippingBoxRules?: unknown;
  pricing_snapshot?: Record<string, unknown>;
} | null | undefined): ProductShippingBoxRule[] {
  const raw =
    value?.shipping_box_rules ??
    value?.shippingBoxRules ??
    value?.pricing_snapshot?.shipping_box_rules ??
    value?.pricing_snapshot?.shippingBoxRules;
  return Array.isArray(raw) ? (raw as ProductShippingBoxRule[]) : [];
}

function hasActiveShippingBoxRules(value: {
  shipping_box_rules?: unknown;
  shippingBoxRules?: unknown;
  pricing_snapshot?: Record<string, unknown>;
} | null | undefined): boolean {
  return productShippingBoxRulesFrom(value).some((rule) => rule?.is_active !== false);
}

function boxFromRule(rule: ProductShippingBoxRule): { length: number; width: number; height: number } | null {
  const box = rule.box || {};
  const length = parsePositiveProductNumber(box.length ?? (rule as unknown as Record<string, unknown>).box_length);
  const width = parsePositiveProductNumber(box.width ?? (rule as unknown as Record<string, unknown>).box_width);
  const height = parsePositiveProductNumber(box.height ?? (rule as unknown as Record<string, unknown>).box_height);
  if (length == null || width == null || height == null) return null;
  return { length, width, height };
}

function matchingShippingBoxRuleFromRules(
  rulesRaw: ProductShippingBoxRule[] | null | undefined,
  widthInches: number,
  heightInches: number
): (ProductShippingBoxRule & { box: { length: number; width: number; height: number } }) | null {
  const rules = (Array.isArray(rulesRaw) ? rulesRaw : [])
    .filter((rule) => rule?.is_active !== false)
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
  if (rules.length === 0) return null;
  const smallestSide =
    widthInches > 0 && heightInches > 0 ? Math.min(widthInches, heightInches) : null;

  if (smallestSide != null) {
    for (const rule of rules) {
      const min = parsePositiveProductNumber(rule.min_smallest_side);
      const max = parsePositiveProductNumber(rule.max_smallest_side);
      const minOk = min == null || smallestSide >= min;
      const maxOk = max == null || smallestSide <= max;
      const box = boxFromRule(rule);
      if (box && minOk && maxOk) return { ...rule, box };
    }
  }

  for (const rule of rules) {
    const min = parsePositiveProductNumber(rule.min_smallest_side);
    const max = parsePositiveProductNumber(rule.max_smallest_side);
    const box = boxFromRule(rule);
    if (box && min == null && max == null) return { ...rule, box };
  }
  return null;
}

function weightPerSqftFromCartLikeItem(item: {
  weight_per_sqft?: unknown;
  weightPerSqft?: unknown;
  pricing_snapshot?: Record<string, unknown>;
}): number | null {
  const snap = item.pricing_snapshot && typeof item.pricing_snapshot === "object" ? item.pricing_snapshot : {};
  return parsePositiveProductNumber(item.weight_per_sqft ?? item.weightPerSqft ?? snap.weight_per_sqft ?? snap.weightPerSqft);
}

function unitWeightForBoxRuleItem(
  item: Record<string, unknown> & { pricing_snapshot?: Record<string, unknown> },
  widthInches: number,
  heightInches: number
): number {
  const weightPerSqft = weightPerSqftFromCartLikeItem(item);
  if (weightPerSqft != null && widthInches > 0 && heightInches > 0) {
    return (widthInches * heightInches / 144) * weightPerSqft;
  }
  return parsePositiveProductNumber(
    item.shipping_weight ??
      item.shippingWeight ??
      item.weight ??
      item.pricing_snapshot?.shipping_weight ??
      item.pricing_snapshot?.shippingWeight
  ) ?? 1;
}

function packagesForMatchedBoxRule(
  rule: ProductShippingBoxRule & { box: { length: number; width: number; height: number } },
  qty: number,
  unitWeight: number
): Array<{ weight: number; length: number; width: number; height: number }> {
  const maxQty = parsePositiveProductNumber(rule.max_quantity_per_box);
  const maxWeight = parsePositiveProductNumber(rule.max_weight_per_box);
  const totalQty = Math.max(1, Math.trunc(qty));
  const totalWeight = Math.max(1, unitWeight * totalQty);
  const qtyLimit = maxQty != null ? Math.max(1, Math.trunc(maxQty)) : totalQty;
  const boxesByQty = Math.max(1, Math.ceil(totalQty / qtyLimit));
  const boxesByWeight = maxWeight != null ? Math.max(1, Math.ceil(totalWeight / maxWeight)) : 1;
  const boxCount = Math.max(boxesByQty, boxesByWeight);
  const packages: Array<{ weight: number; length: number; width: number; height: number }> = [];
  let remainingWeight = totalWeight;
  for (let i = 0; i < boxCount; i += 1) {
    const remainingBoxes = boxCount - i;
    const idealWeight = remainingWeight / remainingBoxes;
    const cappedWeight = maxWeight != null ? Math.min(maxWeight, idealWeight) : idealWeight;
    const weight = Math.max(1, Math.round(cappedWeight * 100) / 100);
    packages.push({
      weight,
      length: Math.max(1, Math.ceil(rule.box.length)),
      width: Math.max(1, Math.ceil(rule.box.width)),
      height: Math.max(1, Math.ceil(rule.box.height)),
    });
    remainingWeight = Math.max(0, remainingWeight - cappedWeight);
  }
  return packages;
}

function firstActiveShippingBoxRuleWithBox(
  rulesRaw: ProductShippingBoxRule[] | null | undefined
): (ProductShippingBoxRule & { box: { length: number; width: number; height: number } }) | null {
  const rules = (Array.isArray(rulesRaw) ? rulesRaw : [])
    .filter((rule) => rule?.is_active !== false)
    .sort((a, b) => Number(a?.sort_order || 0) - Number(b?.sort_order || 0));
  if (rules.length === 0) return null;
  const box = boxFromRule(rules[0]);
  if (!box) return null;
  return { ...rules[0], box };
}

/** Hardware / graphic-scenario products use admin `shipping_*` for FedEx (matches backend validation). */
function isHardwareFedexProduct(row: {
  graphic_scenario_enabled?: unknown;
  graphicScenarioEnabled?: unknown;
  hardware_template_id?: unknown;
  hardwareTemplateId?: unknown;
} | null | undefined): boolean {
  if (!row) return false;
  if (row.graphic_scenario_enabled === true || row.graphicScenarioEnabled === true) return true;
  const htRaw = row.hardware_template_id ?? row.hardwareTemplateId;
  return htRaw != null && String(htRaw).trim() !== "" && Number.isFinite(Number(htRaw));
}

function isFixedPriceShippingProduct(row: {
  pricing_mode?: unknown;
  pricingMode?: unknown;
  graphic_scenario_enabled?: unknown;
  graphicScenarioEnabled?: unknown;
  hardware_template_id?: unknown;
  hardwareTemplateId?: unknown;
} | null | undefined): boolean {
  if (!row || isHardwareFedexProduct(row)) return false;
  const mode = String(row.pricing_mode ?? row.pricingMode ?? "").trim().toLowerCase();
  return mode === "fixed";
}

/**
 * Returns shipping dimensions/weight for FedEx when the product is hardware/graphic-scenario
 * and all `shipping_length`, `shipping_width`, `shipping_height`, `shipping_weight` are positive.
 */
export function hardwareFedexShippingFromProduct(product: {
  graphic_scenario_enabled?: unknown;
  graphicScenarioEnabled?: unknown;
  hardware_template_id?: number | null;
  hardwareTemplateId?: number | null;
  shipping_length?: unknown;
  shipping_width?: unknown;
  shipping_height?: unknown;
  shipping_weight?: unknown;
} | null | undefined): HardwareFedexShipping | null {
  if (!product || !isHardwareFedexProduct(product)) return null;
  const length = parsePositiveProductNumber(product.shipping_length);
  const width = parsePositiveProductNumber(product.shipping_width);
  const height = parsePositiveProductNumber(product.shipping_height);
  const weightPerUnit = parsePositiveProductNumber(product.shipping_weight);
  if (length == null || width == null || height == null || weightPerUnit == null) return null;
  return { length, width, height, weightPerUnit };
}

export function fixedPriceFedexShippingFromProduct(product: {
  pricing_mode?: unknown;
  pricingMode?: unknown;
  graphic_scenario_enabled?: unknown;
  graphicScenarioEnabled?: unknown;
  hardware_template_id?: unknown;
  hardwareTemplateId?: unknown;
  shipping_length?: unknown;
  shipping_width?: unknown;
  shipping_height?: unknown;
  shipping_weight?: unknown;
} | null | undefined): HardwareFedexShipping | null {
  if (!product || !isFixedPriceShippingProduct(product)) return null;
  const length = parsePositiveProductNumber(product.shipping_length);
  const width = parsePositiveProductNumber(product.shipping_width);
  const height = parsePositiveProductNumber(product.shipping_height);
  const weightPerUnit = parsePositiveProductNumber(product.shipping_weight);
  if (length == null || width == null || height == null || weightPerUnit == null) return null;
  return { length, width, height, weightPerUnit };
}

export function productFedexShippingFromProduct(product: {
  graphic_scenario_enabled?: unknown;
  graphicScenarioEnabled?: unknown;
  hardware_template_id?: unknown;
  hardwareTemplateId?: unknown;
  length?: unknown;
  weight?: unknown;
  shipping_length?: unknown;
  shipping_weight?: unknown;
  weight_per_sqft?: unknown;
} | null | undefined): ProductFedexShipping {
  if (!product) return { length: null, weightPerUnit: null };
  const hasHardware = isHardwareFedexProduct(product);
  return {
    length: parsePositiveProductNumber(hasHardware ? product.shipping_length : (product.length ?? product.shipping_length)),
    weightPerUnit: parsePositiveProductNumber(hasHardware ? product.shipping_weight : (product.weight ?? product.shipping_weight)),
  };
}

function isShippableFedexCartLine(item: Record<string, unknown>): boolean {
  const mode = String(item.shippingMode ?? item.shipping_mode ?? "").trim().toLowerCase();
  if (mode === "store_pickup" || mode === "store-pickup" || mode === "store pickup") return false;
  const ship = String(item.shipping ?? "").trim().toLowerCase();
  if (ship === "store-pickup" || ship === "store_pickup") return false;
  const pid = item.storePickupAddressId ?? item.store_pickup_address_id;
  if (pid != null && String(pid) !== "") return false;
  return true;
}

function billableQtyFromCartLikeItem(item: {
  jobs?: Array<{ quantity?: number | string }>;
  quantity?: number | string;
}): number {
  const jobs = Array.isArray(item?.jobs) ? item.jobs : [];
  if (jobs.length > 0) {
    return jobs.reduce((sum, j) => sum + Math.max(1, Number(j.quantity) || 1), 0);
  }
  return Math.max(1, Number(item?.quantity) || 1);
}

function hardwareFedexShippingFromCartLikeItem(item: {
  graphic_scenario_enabled?: unknown;
  graphicScenarioEnabled?: unknown;
  hardware_template_id?: number | null;
  hardwareTemplateId?: number | null;
  shipping_length?: unknown;
  shipping_width?: unknown;
  shipping_height?: unknown;
  shipping_weight?: unknown;
  shippingLength?: unknown;
  shippingWidth?: unknown;
  shippingHeight?: unknown;
  shippingWeight?: unknown;
  fixed_price_shipping_only?: unknown;
  fixedPriceShippingOnly?: unknown;
  pricing_snapshot?: Record<string, unknown>;
}): HardwareFedexShipping | null {
  const snap = item.pricing_snapshot && typeof item.pricing_snapshot === "object" ? item.pricing_snapshot : {};
  const isFixedPriceShipping =
    item.fixed_price_shipping_only === true ||
    item.fixedPriceShippingOnly === true ||
    snap.fixed_price_shipping_only === true ||
    snap.fixedPriceShippingOnly === true;
  if (!isHardwareFedexProduct({ ...item, ...snap }) && !isFixedPriceShipping) return null;

  const pick = (snake: string, camel: string) =>
    (item as Record<string, unknown>)[snake] ??
    (item as Record<string, unknown>)[camel] ??
    snap[snake] ??
    snap[camel];

  const length = parsePositiveProductNumber(pick("shipping_length", "shippingLength"));
  const width = parsePositiveProductNumber(pick("shipping_width", "shippingWidth"));
  const height = parsePositiveProductNumber(pick("shipping_height", "shippingHeight"));
  const weightPerUnit = parsePositiveProductNumber(pick("shipping_weight", "shippingWeight"));
  if (length == null || width == null || height == null || weightPerUnit == null) return null;
  return { length, width, height, weightPerUnit };
}

function hasHardwareTemplateOnCartLikeItem(item: {
  graphic_scenario_enabled?: unknown;
  graphicScenarioEnabled?: unknown;
  hardware_template_id?: unknown;
  hardwareTemplateId?: unknown;
  pricing_snapshot?: Record<string, unknown>;
}): boolean {
  const snap = item.pricing_snapshot && typeof item.pricing_snapshot === "object" ? item.pricing_snapshot : {};
  return isHardwareFedexProduct({ ...item, ...snap });
}

function isFixedPriceShippingCartLikeItem(item: {
  fixed_price_shipping_only?: unknown;
  fixedPriceShippingOnly?: unknown;
  pricing_snapshot?: Record<string, unknown>;
}): boolean {
  const snap = item.pricing_snapshot && typeof item.pricing_snapshot === "object" ? item.pricing_snapshot : {};
  return (
    item.fixed_price_shipping_only === true ||
    item.fixedPriceShippingOnly === true ||
    snap.fixed_price_shipping_only === true ||
    snap.fixedPriceShippingOnly === true
  );
}

/**
 * One consolidated package for FedEx (checkout / cart merge). Same rules as backend `fedexCartPackage.js`.
 */
export function buildFedexPackagesFromShippableCartItems(
  cartItems: Array<Record<string, unknown>> | null | undefined
): Array<{ weight: number; length: number; width: number; height: number }> {
  const shippable = (Array.isArray(cartItems) ? cartItems : []).filter((i) => isShippableFedexCartLine(i));
  if (shippable.length === 0) {
    return [{ weight: 1, length: 12, width: 10, height: 6 }];
  }

  let maxLen = 0;
  let maxWid = 0;
  let maxHt = 0;
  let sumWeight = 0;
  const packages: Array<{ weight: number; length: number; width: number; height: number }> = [];

  for (const raw of shippable) {
    const item = raw as {
      jobs?: Array<{ quantity?: number | string }>;
      quantity?: number | string;
      width?: number;
      height?: number;
      width_inches?: number;
      height_inches?: number;
      selection_mode?: string;
      selectionMode?: string;
      graphic_scenario_enabled?: boolean;
      graphicScenarioEnabled?: boolean;
      hardware_template_id?: number | null;
      hardwareTemplateId?: number | null;
      shipping_length?: unknown;
      shipping_width?: unknown;
      shipping_height?: unknown;
      shipping_weight?: unknown;
      shippingLength?: unknown;
      shippingWidth?: unknown;
      shippingHeight?: unknown;
      shippingWeight?: unknown;
      weight_per_sqft?: unknown;
      weightPerSqft?: unknown;
      fixed_price_shipping_only?: unknown;
      fixedPriceShippingOnly?: unknown;
      pricing_snapshot?: Record<string, unknown>;
    };
    const qty = billableQtyFromCartLikeItem(item);
    const itemWidth = Number(item.width ?? item.width_inches) || 0;
    const itemHeight = Number(item.height ?? item.height_inches) || 0;
    const isHardware = hasHardwareTemplateOnCartLikeItem(item) || isFixedPriceShippingCartLikeItem(item);
    const hw = hardwareFedexShippingFromCartLikeItem(item);
    const matchedRule = isHardware
      ? firstActiveShippingBoxRuleWithBox(productShippingBoxRulesFrom(item))
      : matchingShippingBoxRuleFromRules(productShippingBoxRulesFrom(item), itemWidth, itemHeight);
    if (matchedRule) {
      const unitWeight = hw?.weightPerUnit ?? unitWeightForBoxRuleItem(item as Record<string, unknown> & { pricing_snapshot?: Record<string, unknown> }, itemWidth, itemHeight);
      packages.push(...packagesForMatchedBoxRule(matchedRule, qty, unitWeight));
      continue;
    }
    if (!isHardware && hasActiveShippingBoxRules(item)) {
      throw new Error("Shipping box is not configured for this size. Please contact admin.");
    }

    if (hw) {
      maxLen = Math.max(maxLen, Math.ceil(hw.length));
      maxWid = Math.max(maxWid, Math.ceil(hw.width));
      maxHt = Math.max(maxHt, Math.ceil(hw.height));
      sumWeight += hw.weightPerUnit * qty;
    } else {
      const storedLength = parsePositiveProductNumber(item.shipping_length ?? item.shippingLength);
      const storedWeight = parsePositiveProductNumber(item.shipping_weight ?? item.shippingWeight);
      maxLen = Math.max(maxLen, storedLength != null ? Math.ceil(storedLength) : 12);
      maxWid = Math.max(maxWid, itemWidth > 0 ? Math.max(1, Math.ceil(itemWidth)) : 10);
      maxHt = Math.max(maxHt, itemHeight > 0 ? Math.max(1, Math.ceil(itemHeight)) : 6);
      sumWeight += (storedWeight != null ? storedWeight : 1) * qty;
    }
  }

  const length = maxLen > 0 ? maxLen : 12;
  const width = maxWid > 0 ? maxWid : 10;
  const height = maxHt > 0 ? maxHt : 6;
  const roundedWt = Math.round(sumWeight * 100) / 100;
  const weight = Math.max(1, roundedWt);

  if (sumWeight > 0 || packages.length === 0) {
    packages.push({ weight, length, width, height });
  }
  return packages;
}

export type CartLineShippingInput = {
  id?: string | number;
  shippingService?: string;
  shipping_service?: string;
  shippingMode?: string;
  shipping_mode?: string;
  shipping?: string;
  storePickupAddressId?: unknown;
  store_pickup_address_id?: unknown;
  shippingRateAmount?: unknown;
  shipping_rate_amount?: unknown;
  shippingRateServiceName?: string;
  shipping_rate_service_name?: string;
  shippingRateEstimatedDelivery?: unknown;
  shipping_rate_estimated_delivery?: unknown;
};

/** FedEx Rate API may return FEDEX_* or legacy names without that prefix (e.g. GROUND_HOME_DELIVERY). */
const FEDEX_RATE_TYPES_WITHOUT_FEDEX_PREFIX = new Set([
  "GROUND_HOME_DELIVERY",
  "SMART_POST",
  "FIRST_OVERNIGHT",
  "PRIORITY_OVERNIGHT",
  "STANDARD_OVERNIGHT",
  "INTERNATIONAL_PRIORITY",
  "INTERNATIONAL_ECONOMY",
  "INTERNATIONAL_FIRST",
  "REGIONAL_ECONOMY",
  "EUROPE_FIRST_INTERNATIONAL_PRIORITY",
]);

function isFedExCartServiceType(serviceLabel: string | null | undefined): boolean {
  const s = String(serviceLabel || "").trim().toUpperCase();
  if (!s) return false;
  if (s.startsWith("FEDEX_")) return true;
  return FEDEX_RATE_TYPES_WITHOUT_FEDEX_PREFIX.has(s);
}

/** Non-null when this line has a persisted FedEx quote (amount + FedEx REST service type). */
export function cartLineFedexQuotedAmount(item: CartLineShippingInput): number | null {
  const svc = String(item.shippingService ?? item.shipping_service ?? "").trim();
  if (!isFedExCartServiceType(svc)) return null;
  const raw = item.shippingRateAmount ?? item.shipping_rate_amount;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Blind-drop lines without a FedEx quote share this key so catalog "Ground" prices are not applied on the cart.
 */
export function cartMergedShippingGroupKey(item: CartLineShippingInput): string {
  if (isCartLineStorePickup(item)) return "";
  if (cartLineFedexQuotedAmount(item) != null) {
    const svc = String(item.shippingService ?? item.shipping_service ?? "").trim();
    return `__fedex__:${normalizeShippingServiceKey(svc)}`;
  }
  return "__pending_checkout__";
}

export function cartHasShippingQuotePending(
  items: CartLineShippingInput[],
  storePickupOrder: boolean
): boolean {
  if (storePickupOrder || !Array.isArray(items)) return false;
  return items.some(
    (it) => !isCartLineStorePickup(it) && cartMergedShippingGroupKey(it) === "__pending_checkout__"
  );
}

/** Matches cart page: line is store pickup → excluded from merged/stacked ship sums. */
export function isCartLineStorePickup(item: CartLineShippingInput): boolean {
  const mode = String(item.shippingMode ?? item.shipping_mode ?? "").trim().toLowerCase();
  if (mode === "store_pickup" || mode === "store-pickup" || mode === "store pickup") return true;
  const ship = String(item.shipping ?? "").trim().toLowerCase();
  if (ship === "store-pickup" || ship === "store_pickup") return true;
  const pid = item.storePickupAddressId ?? item.store_pickup_address_id;
  if (pid != null && String(pid) !== "") return true;
  return false;
}

/** True when every non–store-pickup line already has a FedEx quote (product page or prior checkout). */
export function cartShippableLinesAllFedexQuoted(items: CartLineShippingInput[]): boolean {
  if (!Array.isArray(items) || items.length === 0) return false;
  const shippable = items.filter((i) => !isCartLineStorePickup(i));
  if (shippable.length === 0) return true;
  return shippable.every((i) => cartLineFedexQuotedAmount(i) != null);
}

/** First ETA string found on FedEx-quoted shippable lines (for checkout summary). */
export function fedexEstimatedDeliveryFromCart(items: CartLineShippingInput[]): string | null {
  for (const it of items) {
    if (isCartLineStorePickup(it)) continue;
    if (cartLineFedexQuotedAmount(it) == null) continue;
    const ed = it.shippingRateEstimatedDelivery ?? it.shipping_rate_estimated_delivery;
    if (ed != null && String(ed).trim()) return String(ed).trim();
  }
  return null;
}

/**
 * One package for FedEx rating on the product page (same rules as checkout cart merge).
 * Hardware: all `shipping_*` from product DB.
 * Standard products: product length/weight + customer-entered width/height.
 */
export function buildFedexPackagesForProductConfigure(options: {
  billableQty: number;
  widthInches: number;
  heightInches: number;
  isGraphicScenario: boolean;
  hardwareShipping?: HardwareFedexShipping | null;
  productShipping?: ProductFedexShipping | null;
  shippingBoxRules?: ProductShippingBoxRule[] | null;
  weightPerSqft?: number | string | null;
}): Array<{ weight: number; length: number; width: number; height: number }> {
  const { billableQty, widthInches, heightInches, hardwareShipping, productShipping, shippingBoxRules, weightPerSqft } = options;
  const totalQty = Math.max(1, billableQty);
  const matchedRule = hardwareShipping
    ? firstActiveShippingBoxRuleWithBox(shippingBoxRules)
    : matchingShippingBoxRuleFromRules(shippingBoxRules, widthInches, heightInches);
  if (matchedRule) {
    const sqftWeight = parsePositiveProductNumber(weightPerSqft);
    const unitWeight = hardwareShipping
      ? hardwareShipping.weightPerUnit
      : sqftWeight != null && widthInches > 0 && heightInches > 0
      ? (widthInches * heightInches / 144) * sqftWeight
      : (productShipping?.weightPerUnit ?? 1);
    return packagesForMatchedBoxRule(matchedRule, totalQty, unitWeight);
  }
  if (!hardwareShipping && Array.isArray(shippingBoxRules) && shippingBoxRules.some((rule) => rule?.is_active !== false)) {
    throw new Error("Shipping box is not configured for this size. Please contact admin.");
  }

  if (hardwareShipping) {
    const wt = Math.round(hardwareShipping.weightPerUnit * totalQty * 100) / 100;
    return [
      {
        weight: Math.max(1, wt),
        length: Math.max(1, Math.ceil(hardwareShipping.length)),
        width: Math.max(1, Math.ceil(hardwareShipping.width)),
        height: Math.max(1, Math.ceil(hardwareShipping.height)),
      },
    ];
  }

  const w = widthInches || 0;
  const h = heightInches || 0;
  const productLength = productShipping?.length ?? null;
  const productWeight = productShipping?.weightPerUnit ?? null;
  const lengthIn = productLength != null ? Math.max(1, Math.ceil(productLength)) : 12;
  const widthIn = w > 0 ? Math.max(1, Math.ceil(w)) : 10;
  const heightIn = h > 0 ? Math.max(1, Math.ceil(h)) : 6;
  const weight = productWeight != null ? Math.round(productWeight * totalQty * 100) / 100 : totalQty;

  return [{ weight: Math.max(1, weight), length: lengthIn, width: widthIn, height: heightIn }];
}

/** Sum of list shipping if each line were charged separately (non-pickup lines only). */
export function stackedShippingFromCartItems(
  items: CartLineShippingInput[],
  methods: ShippingMethod[] | null | undefined,
  rates: ShippingRates | null | undefined,
  storePickupOrder: boolean
): number {
  if (storePickupOrder || !Array.isArray(items)) return 0;
  let sum = 0;
  for (const it of items) {
    if (isCartLineStorePickup(it)) continue;
    const gk = cartMergedShippingGroupKey(it);
    if (gk === "__pending_checkout__") continue;
    if (gk.startsWith("__fedex__:")) {
      const amt = cartLineFedexQuotedAmount(it);
      sum += amt != null ? amt : 0;
      continue;
    }
    sum += shippingAmountForMethod(methods, it.shippingService ?? it.shipping_service, rates);
  }
  return roundMoney2Client(sum);
}

/** One charge per distinct shipping method among shippable lines (Scenario 1 & 2). */
export function mergedShippingFromCartItems(
  items: CartLineShippingInput[],
  methods: ShippingMethod[] | null | undefined,
  rates: ShippingRates | null | undefined,
  storePickupOrder: boolean
): number {
  if (storePickupOrder || !Array.isArray(items)) return 0;
  const seen = new Set<string>();
  let sum = 0;
  for (const it of items) {
    if (isCartLineStorePickup(it)) continue;
    const gk = cartMergedShippingGroupKey(it);
    if (!gk || seen.has(gk)) continue;
    seen.add(gk);
    if (gk === "__pending_checkout__") continue;
    if (gk.startsWith("__fedex__:")) {
      const amt = cartLineFedexQuotedAmount(it);
      sum += amt != null ? amt : 0;
      continue;
    }
    sum += shippingAmountForMethod(methods, it.shippingService ?? it.shipping_service, rates);
  }
  return roundMoney2Client(sum);
}

/** Per line: full list price for that method, and this line's share when the method is shared (for UI). */
export function perLineMergedShippingAllocations(
  items: CartLineShippingInput[],
  methods: ShippingMethod[] | null | undefined,
  rates: ShippingRates | null | undefined,
  storePickupOrder: boolean
): Map<string, { rawLine: number; mergedShare: number }> {
  const byId = new Map<string, { rawLine: number; mergedShare: number }>();
  if (!Array.isArray(items)) return byId;
  if (storePickupOrder) {
    for (const it of items) {
      byId.set(String(it.id ?? ""), { rawLine: 0, mergedShare: 0 });
    }
    return byId;
  }
  const groups = new Map<string, CartLineShippingInput[]>();
  for (const it of items) {
    const id = String(it.id ?? "");
    if (isCartLineStorePickup(it)) {
      byId.set(id, { rawLine: 0, mergedShare: 0 });
      continue;
    }
    const gk = cartMergedShippingGroupKey(it);
    if (!gk) {
      byId.set(id, { rawLine: 0, mergedShare: 0 });
      continue;
    }
    if (!groups.has(gk)) groups.set(gk, []);
    groups.get(gk)!.push(it);
  }
  for (const [, group] of groups) {
    const rep = group[0];
    const gk = cartMergedShippingGroupKey(rep);
    let linePrice = 0;
    if (gk === "__pending_checkout__") {
      linePrice = 0;
    } else if (gk.startsWith("__fedex__:")) {
      const amt = cartLineFedexQuotedAmount(rep);
      linePrice = amt != null ? amt : 0;
    } else {
      linePrice = shippingAmountForMethod(
        methods,
        rep.shippingService ?? rep.shipping_service,
        rates
      );
    }
    const n = group.length;
    const totalCents = Math.round(linePrice * 100);
    const base = Math.floor(totalCents / n);
    const rem = totalCents % n;
    group.forEach((row, idx) => {
      const cents = base + (idx < rem ? 1 : 0);
      byId.set(String(row.id ?? ""), {
        rawLine: roundMoney2Client(linePrice),
        mergedShare: cents / 100,
      });
    });
  }
  for (const it of items) {
    const id = String(it.id ?? "");
    if (!byId.has(id)) byId.set(id, { rawLine: 0, mergedShare: 0 });
  }
  return byId;
}

/** True when cart qualifies for waived shipping (not store pickup). */
export function orderQualifiesForFreeShipping(
  orderSubtotal: number,
  policy: FreeShippingPolicy | null | undefined,
  storePickup: boolean
): boolean {
  if (storePickup) return false;
  if (!policy?.freeShippingEnabled) return false;
  const th = Number(policy.freeShippingThreshold);
  if (!Number.isFinite(th) || th < 0) return false;
  return orderSubtotal >= th;
}

/** Combined shipping $ after free-shipping rule (pass merged pre-threshold total, not store pickup). */
export function effectiveOrderShipping(
  preFreeShippingTotal: number,
  orderSubtotal: number,
  policy: FreeShippingPolicy | null | undefined,
  storePickup: boolean,
  options?: { disableFreeShipping?: boolean }
): number {
  if (storePickup) return 0;
  if (!options?.disableFreeShipping && orderQualifiesForFreeShipping(orderSubtotal, policy, false)) {
    return 0;
  }
  return roundMoney2Client(preFreeShippingTotal);
}

// Helper function for API calls
async function apiCall(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add auth token if available; guest cart uses X-Guest-Session-Id when not logged in
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    };
  } else if (typeof window !== 'undefined' && needsGuestSessionHeader(endpoint)) {
    const sid = getOrCreateGuestSessionId();
    if (sid) {
      config.headers = {
        ...config.headers,
        'X-Guest-Session-Id': sid,
      };
    }
  }

  const method = String(config.method || 'GET').toUpperCase();
  const hasBody = config.body != null;
  const shouldDedupeGet = method === 'GET' && !hasBody;
  const dedupeKey = shouldDedupeGet
    ? JSON.stringify({
        url,
        method,
        auth: token || '',
        guestSession: typeof window !== 'undefined' ? localStorage.getItem(GUEST_SESSION_STORAGE_KEY) || '' : '',
      })
    : '';

  if (shouldDedupeGet) {
    const inFlight = inFlightGetRequests.get(dedupeKey);
    if (inFlight) {
      return inFlight;
    }
  }

  const execute = async () => {
    try {
      const response = await fetch(url, config);
      
      // Handle non-JSON responses
      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
        data = await response.json();
        } catch {
          // If JSON parsing fails, try to get text
          const text = await response.text();
          throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
        }
      } else {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      if (!response.ok) {
        // Safely access error message from response data (include server error detail when present)
        const dataObj = data && typeof data === 'object' ? data : {};
        const msg = dataObj.message || dataObj.error;
        const detail = dataObj.error && dataObj.message !== dataObj.error ? dataObj.error : '';
        const errorMessage = msg
          ? (detail ? `${msg}: ${detail}` : msg)
          : `API request failed: ${response.status} ${response.statusText}`;
        
        const isTokenBasedCall = !!token;
        const isAuthError = response.status === 401 || response.status === 403;
        const isAccessTokenRequired = /access\s*token|token\s*required|session\s*invalid|invalid\s*token|token\s*expired/i.test(errorMessage || '');

        if (isAuthError && (isTokenBasedCall || isAccessTokenRequired)) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('user');
            localStorage.removeItem('userRole');
            window.location.href = '/';
          }
          throw new Error('Session invalid. Please log in again.');
        }
        throw new Error(errorMessage);
      }
      
      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      const isNetworkError =
        error?.message?.includes('Failed to fetch') ||
        error?.name === 'TypeError' ||
        (error?.message && typeof error.message === 'string' && error.message.toLowerCase().includes('network'));

      if (isNetworkError) {
        const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:5000';
        console.error(
          'API unreachable. Is the backend running? Expected base URL:',
          baseUrl,
          '\nStart backend: cd backend && npm run dev'
        );
        throw new Error(
          `Cannot connect to the API. Start the backend: cd backend && npm run dev (expected: ${baseUrl})`
        );
      }

      console.error('API Error:', error);
      
      // If it's already an Error object, throw it as is
      if (error instanceof Error) {
        throw error;
      }
      
      // Otherwise wrap it
      throw new Error(error.message || 'Network error. Please check your connection.');
    } finally {
      if (shouldDedupeGet) inFlightGetRequests.delete(dedupeKey);
    }
  };

  const promise = execute();
  if (shouldDedupeGet) inFlightGetRequests.set(dedupeKey, promise);
  return promise;
}

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    return apiCall('/auth/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  register: async (userData: any) => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },
  
  getProfile: async () => {
    return apiCall('/auth/profile');
  },
  /** Send 6-digit code to email for password reset */
  sendResetCode: async (email: string) => {
    return apiCall('/auth/send-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim() }),
    });
  },
  /** Reset password with email + code from email */
  resetPasswordWithCode: async (email: string, code: string, newPassword: string) => {
    return apiCall('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), code: code.trim(), newPassword }),
    });
  },
};

// Users API (profile update for logged-in user / admin / employee)
export const usersAPI = {
  getAllAdmin: async () => {
    return apiCall('/users/admin/all');
  },
  updateProfile: async (data: { fullName?: string; telephone?: string; newsletter?: boolean }) => {
    return apiCall('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  /** Logged-in user: set new password (Bearer token). */
  changePassword: async (newPassword: string) => {
    return apiCall('/users/password', {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  },
};

// Cards API (saved credit cards - requires login)
export const cardsAPI = {
  get: async () => apiCall('/cards'),
  add: async (data: { cardNumberLast4: string; cardholderName: string; expiryMonth: string | number; expiryYear: string | number; cardType?: string; isDefault?: boolean }) =>
    apiCall('/cards', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: { cardholderName?: string; expiryMonth?: string | number; expiryYear?: string | number; cardType?: string; isDefault?: boolean }) =>
    apiCall(`/cards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: async (id: string) => apiCall(`/cards/${id}`, { method: 'DELETE' }),
};

// Products API
export const productsAPI = {
  getAll: async (params?: { category?: string; subcategory?: string; search?: string; page?: number; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiCall(`/products${queryString}`);
  },
  
  getById: async (id: string) => {
    return apiCall(`/products/${id}`);
  },
  previewPrice: async (
    id: string,
    payload: {
      width?: number;
      height?: number;
      size_option_id?: number;
      sizeOptionId?: number;
      selectedModifiers?: Record<string, string>;
      selected_modifiers?: Record<string, string>;
      /** New: key of the selected purchase option (e.g. "flag_only", "graphic_frame") */
      purchase_option_key?: string;
      purchaseOptionKey?: string;
      /** Legacy: used when graphic_scenario_enabled but no purchase_options defined */
      selection_mode?: "graphic_only" | "graphic_frame";
      selectionMode?: "graphic_only" | "graphic_frame";
    }
  ) => {
    return apiCall(`/products/${id}/price-preview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  
  getCategories: async () => {
    return apiCall('/products/categories');
  },
  
  getRelated: async (productId: string, limit?: number) => {
    const params = new URLSearchParams({ productId });
    if (limit) params.append('limit', limit.toString());
    return apiCall(`/products/related?${params.toString()}`);
  },

  // Admin
  getAllAdmin: async (params?: { page?: number; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiCall(`/products/admin/products${queryString}`);
  },
  create: async (data: Record<string, unknown>) => {
    return apiCall('/products/admin/products', { method: 'POST', body: JSON.stringify(data) });
  },
  update: async (id: string, data: Record<string, unknown>) => {
    return apiCall(`/products/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete: async (id: string) => {
    return apiCall(`/products/admin/products/${id}`, { method: 'DELETE' });
  },
  createCategory: async (data: Record<string, unknown>) => {
    return apiCall('/products/admin/categories', { method: 'POST', body: JSON.stringify(data) });
  },
  updateCategory: async (id: string, data: Record<string, unknown>) => {
    return apiCall(`/products/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteCategory: async (id: string) => {
    return apiCall(`/products/admin/categories/${id}`, { method: 'DELETE' });
  },
  /** Upload product image file; returns { url: '/uploads/products/filename' } */
  uploadImage: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/products/admin/upload-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Upload failed');
    }
    return res.json();
  },
  /** Upload category/subcategory image file; returns { url: '/uploads/categories/filename' } */
  uploadCategoryImage: async (file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${API_BASE_URL}/products/admin/upload-category-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Upload failed');
    }
    return res.json();
  },
  getModifierCatalogAdmin: async () => {
    return apiCall('/products/admin/modifier-catalog');
  },
  updateModifierCatalogAdmin: async (data: { groups: ModifierGroup[] }) => {
    return apiCall('/products/admin/modifier-catalog', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteModifierCatalogGroupAdmin: async (key: string) => {
    return apiCall(`/products/admin/modifier-catalog/${encodeURIComponent(String(key || '').trim())}`, {
      method: 'DELETE',
    });
  },
  getModifierPresetsAdmin: async () => {
    return apiCall('/products/admin/modifier-presets') as Promise<{ presets: ModifierPreset[] }>;
  },
  createModifierPresetAdmin: async (data: { name: string; modifier_group_ids: number[] }) => {
    return apiCall('/products/admin/modifier-presets', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ preset: ModifierPreset }>;
  },
  updateModifierPresetAdmin: async (
    id: number | string,
    data: { name?: string; modifier_group_ids?: number[]; sort_order?: number }
  ) => {
    return apiCall(`/products/admin/modifier-presets/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ preset: ModifierPreset }>;
  },
  deleteModifierPresetAdmin: async (id: number | string) => {
    return apiCall(`/products/admin/modifier-presets/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });
  },
  getProductModifiersAdmin: async (id: string) => {
    return apiCall(`/products/admin/products/${id}/modifiers`);
  },
  updateProductModifiersAdmin: async (id: string, data: { groups: Array<{ key: string; is_required?: boolean; sort_order?: number; mode_scope?: string; options: Array<{ option_id?: number; value: string; is_default?: boolean; price_adjustment_override?: number | null }> }>; conditional_rules?: ProductConditionalModifierRule[] }) => {
    return apiCall(`/products/admin/products/${id}/modifiers`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  getProductPurchaseOptionsAdmin: async (id: string) => {
    return apiCall(`/products/admin/products/${id}/purchase-options`);
  },
  updateProductPurchaseOptionsAdmin: async (id: string, data: { purchase_options: ProductPurchaseOption[] }) => {
    return apiCall(`/products/admin/products/${id}/purchase-options`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  getProductShippingBoxRulesAdmin: async (id: string) => {
    return apiCall(`/products/admin/products/${id}/shipping-box-rules`);
  },
  updateProductShippingBoxRulesAdmin: async (
    id: string,
    data: {
      shipping_box_rules: Array<{
        shipping_box_id: number;
        min_smallest_side: number | null;
        max_smallest_side: number | null;
        max_quantity_per_box: number | null;
        max_weight_per_box: number | null;
      }>;
    }
  ) => {
    return apiCall(`/products/admin/products/${id}/shipping-box-rules`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  getHardwareTemplatesAdmin: async () => {
    return apiCall('/products/admin/hardware-templates') as Promise<{ templates: HardwareTemplate[] }>;
  },
  createHardwareTemplateAdmin: async (data: { name: string; options: HardwareTemplateOption[] }) => {
    return apiCall('/products/admin/hardware-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<{ template: HardwareTemplate | null; templates: HardwareTemplate[] }>;
  },
  updateHardwareTemplateAdmin: async (id: string | number, data: { name: string; options: HardwareTemplateOption[] }) => {
    return apiCall(`/products/admin/hardware-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<{ template: HardwareTemplate | null; templates: HardwareTemplate[] }>;
  },
  deleteHardwareTemplateAdmin: async (id: string | number) => {
    return apiCall(`/products/admin/hardware-templates/${id}`, {
      method: 'DELETE',
    });
  },
};

// Cart API (role-based: user/employee = own cart, admin = all carts)
export const cartAPI = {
  get: async () => apiCall('/cart'),
  getSummary: async (): Promise<CartSummary> => apiCall('/cart/summary'),
  add: async (itemData: Record<string, unknown>) =>
    apiCall('/cart', { method: 'POST', body: JSON.stringify(itemData) }),
  remove: async (id: string) => apiCall(`/cart/${id}`, { method: 'DELETE' }),
  update: async (id: string, itemData: Record<string, unknown>) =>
    apiCall(`/cart/${id}`, { method: 'PUT', body: JSON.stringify(itemData) }),
  clear: async () => apiCall('/cart/clear', { method: 'DELETE' }),
};

export const shippingRatesAPI = {
  get: async (): Promise<ShippingRatesResponse> => apiCall('/shipping-rates'),
  update: async (payload: ShippingRatesAdminPayload) =>
    apiCall('/shipping-rates', { method: 'PUT', body: JSON.stringify(payload) }),
  getAdminMethods: async (): Promise<{ methods: ShippingMethod[] }> => apiCall('/shipping-rates/admin'),
  createAdminMethod: async (data: { name: string; price: number; isActive?: boolean }) =>
    apiCall('/shipping-rates/admin', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminMethod: async (
    id: number | string,
    data: { name?: string; price?: number; isActive?: boolean }
  ) => apiCall(`/shipping-rates/admin/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminMethod: async (id: number | string) => apiCall(`/shipping-rates/admin/${id}`, { method: 'DELETE' }),
};

export const shippingBoxesAPI = {
  getAdmin: async (): Promise<{ boxes: ShippingBox[] }> => apiCall('/shipping-boxes/admin'),
  createAdmin: async (data: { name: string; length: number; width: number; height: number; isActive?: boolean }) =>
    apiCall('/shipping-boxes/admin', { method: 'POST', body: JSON.stringify(data) }) as Promise<{ box: ShippingBox }>,
  updateAdmin: async (
    id: number | string,
    data: Partial<{ name: string; length: number; width: number; height: number; isActive: boolean }>
  ) =>
    apiCall(`/shipping-boxes/admin/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<{ box: ShippingBox }>,
  deleteAdmin: async (id: number | string) => apiCall(`/shipping-boxes/admin/${id}`, { method: 'DELETE' }),
};

export const storePickupAddressesAPI = {
  getPublic: async (): Promise<{ addresses: StorePickupAddress[] }> => apiCall('/store-pickup-addresses'),
};

export const storeAddressesAPI = {
  getAdmin: async (): Promise<{ addresses: StoreAddress[] }> => apiCall('/store-addresses/admin'),
  createAdmin: async (data: Partial<StoreAddress>) =>
    apiCall('/store-addresses/admin', { method: 'POST', body: JSON.stringify(data) }),
  updateAdmin: async (id: number | string, data: Partial<StoreAddress>) =>
    apiCall(`/store-addresses/admin/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setDefaultAdmin: async (id: number | string) =>
    apiCall(`/store-addresses/admin/${id}/default`, { method: 'PATCH' }),
  deleteAdmin: async (id: number | string) => apiCall(`/store-addresses/admin/${id}`, { method: 'DELETE' }),
};

export const taxesAPI = {
  estimate: async (data: { subtotal: number; shipping: number; postalCode?: string }): Promise<TaxEstimateResponse> =>
    apiCall('/taxes/estimate', { method: 'POST', body: JSON.stringify(data) }),
};

export const artworksAPI = {
  upload: async (file: File, metadata: ArtworkUploadPayload) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("widthPx", String(metadata.widthPx ?? ""));
    formData.append("heightPx", String(metadata.heightPx ?? ""));
    formData.append("sizeBytes", String(metadata.sizeBytes));
    formData.append("mimeType", metadata.mimeType);
    if (metadata.pdfPageCount != null) {
      formData.append("pdfPageCount", String(metadata.pdfPageCount));
    }

    const res = await fetch(`${API_BASE_URL}/artworks/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || "Artwork upload failed");
    }

    return res.json() as Promise<ArtworkRecord>;
  },
  getMine: async () => {
    return apiCall("/artworks/my") as Promise<{ artworks: ArtworkRecord[] }>;
  },
  delete: async (id: number | string) => {
    return apiCall(`/artworks/${id}`, { method: "DELETE" }) as Promise<{ ok: boolean }>;
  },
};

// Orders API
export const ordersAPI = {
  create: async (orderData: any) => {
    return apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },
  
  getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.page != null) q.set('page', String(params.page));
    if (params?.limit != null) q.set('limit', String(params.limit));
    const qs = q.toString();
    return apiCall(qs ? `/orders?${qs}` : '/orders');
  },
  
  getAllAdmin: async (params?: { status?: string; page?: number; limit?: number }) => {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return apiCall(`/orders/admin/all${queryString}`);
  },
  
  getById: async (id: string) => {
    return apiCall(`/orders/${id}`);
  },
  
  getByIdAdmin: async (id: string) => {
    return apiCall(`/orders/admin/${id}`);
  },
  
  updateStatus: async (id: string, status: string) => {
    return apiCall(`/orders/admin/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  refundAdmin: async (id: string) => {
    return apiCall(`/orders/admin/${id}/refund`, {
      method: 'POST',
    });
  },

  requestCancellation: async (id: string) => {
    return apiCall(`/orders/${id}/request-cancellation`, {
      method: 'POST',
    });
  },

  getGuestById: async (id: string | number, token: string) => {
    const q = new URLSearchParams({ token: String(token || '') }).toString();
    return apiCall(`/orders/guest/${id}?${q}`);
  },

  requestGuestCancellation: async (id: string | number, token: string) => {
    const q = new URLSearchParams({ token: String(token || '') }).toString();
    return apiCall(`/orders/guest/${id}/request-cancellation?${q}`, {
      method: 'POST',
    });
  },

  updateOrderTrackingId: async (id: string, orderTrackingId: string | null) => {
    return apiCall(`/orders/admin/${id}/order-tracking`, {
      method: 'PUT',
      body: JSON.stringify({ orderTrackingId }),
    });
  },

  deleteAdmin: async (id: string) => {
    return apiCall(`/orders/admin/${id}`, { method: 'DELETE' });
  },

  /** Admin: create order from cart item with chosen status; returns { order } with order.id */
  createFromCartItem: async (cartItem: Record<string, unknown>, status: string) => {
    return apiCall('/orders/admin/from-cart', {
      method: 'POST',
      body: JSON.stringify({ cartItem, status }),
    });
  },

  /** Create order + Stripe PaymentIntent from cart; returns { orderId, orderNumber, clientSecret, stripePaymentSkipped? } */
  createPaymentIntent: async (
    cartItems: Record<string, unknown>[],
    guestCheckout?: Record<string, unknown>,
    addressIds?: { shippingAddressId?: number; billingAddressId?: number }
  ) => {
    const body: Record<string, unknown> = { cartItems };
    if (guestCheckout && typeof guestCheckout === 'object') {
      body.guestCheckout = guestCheckout;
    }
    if (addressIds?.shippingAddressId != null) {
      body.shippingAddressId = addressIds.shippingAddressId;
    }
    if (addressIds?.billingAddressId != null) {
      body.billingAddressId = addressIds.billingAddressId;
    }
    return apiCall('/orders/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Confirm succeeded Stripe PaymentIntent and mark order paid (fallback when webhook is delayed/missed). */
  confirmStripePayment: async (orderId: number, paymentIntentId: string) => {
    return apiCall('/orders/confirm-stripe-payment', {
      method: 'POST',
      body: JSON.stringify({ orderId, paymentIntentId }),
    });
  },

  /** Link approved customer artwork file to an order line (buyer only). */
  approveOrderItemArtwork: async (orderId: number, orderItemId: number, file: File) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(
      `${API_BASE_URL}/orders/${orderId}/items/${orderItemId}/approve-artwork`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Could not save artwork to order.');
    }
    return res.json() as Promise<{
      orderItemId: number;
      customerArtworkUrl: string;
      orderId: number;
      /** Present when every job on the order has artwork and the order advanced to processing. */
      orderStatus?: string;
    }>;
  },

  /** Guest checkout: save artwork using order tracking token (no JWT). */
  approveGuestOrderItemArtwork: async (
    orderId: number,
    orderItemId: number,
    guestTrackingToken: string,
    file: File
  ) => {
    const q = new URLSearchParams({ token: String(guestTrackingToken || '') }).toString();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(
      `${API_BASE_URL}/orders/guest/${orderId}/items/${orderItemId}/approve-artwork?${q}`,
      {
        method: 'POST',
        body: formData,
      }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Could not save artwork to order.');
    }
    return res.json() as Promise<{
      orderItemId: number;
      customerArtworkUrl: string;
      orderId: number;
      /** Present when every job on the order has artwork and the order advanced to processing. */
      orderStatus?: string;
    }>;
  },
};

export const reportsAPI = {
  getAdminDashboard: async (params: {
    range: ReportsDateRange;
    chartYear?: number;
    from?: string;
    to?: string;
    tzOffsetMinutes?: number;
  }) => {
    const query = new URLSearchParams();
    query.set("range", params.range);
    if (params.chartYear != null) query.set("chartYear", String(params.chartYear));
    if (params.from) query.set("from", params.from);
    if (params.to) query.set("to", params.to);
    if (params.tzOffsetMinutes != null) query.set("tzOffsetMinutes", String(params.tzOffsetMinutes));
    return apiCall(`/reports/admin/dashboard?${query.toString()}`) as Promise<AdminDashboardResponse>;
  },
};

// Admin Employees API
export const employeesAPI = {
  getAll: async () => {
    return apiCall('/admin/employees');
  },
  getById: async (id: string) => {
    return apiCall(`/admin/employees/${id}`);
  },
  /** Upload profile image file; returns { url: string } (path like /uploads/employees/xxx.jpg) */
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('profile_image', file);
    const res = await fetch(`${API_BASE_URL}/admin/employees/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || res.statusText || 'Upload failed');
    }
    return res.json();
  },
  create: async (data: {
    email: string;
    password: string;
    full_name: string;
    telephone?: string;
    role?: 'admin' | 'employee';
    profile_image?: string;
    hire_date?: string;
  }) => {
    return apiCall('/admin/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  update: async (
    id: string,
    data: {
      full_name?: string;
      email?: string;
      telephone?: string;
      is_active?: boolean;
      is_approved?: boolean;
      password?: string;
      role?: 'admin' | 'employee';
      profile_image?: string;
      hire_date?: string;
    }
  ) => {
    return apiCall(`/admin/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete: async (id: string) => {
    return apiCall(`/admin/employees/${id}`, {
      method: 'DELETE',
    });
  },
};

// Addresses API
export const addressesAPI = {
  getAll: async () => {
    return apiCall('/addresses');
  },
  
  create: async (addressData: any) => {
    return apiCall('/addresses', {
      method: 'POST',
      body: JSON.stringify(addressData),
    });
  },
  
  update: async (id: string, addressData: any) => {
    return apiCall(`/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(addressData),
    });
  },

  setDefault: async (
    id: string,
    addressSnapshot: {
      streetAddress: string;
      addressLine2?: string | null;
      city: string;
      state: string;
      postcode: string;
      country: string;
      addressType: string;
    }
  ) => {
    try {
      return await apiCall(`/addresses/${id}/set-default`, { method: 'POST' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/route not found/i.test(msg)) {
        return apiCall(`/addresses/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...addressSnapshot, isDefault: true }),
        });
      }
      throw e;
    }
  },

  delete: async (id: string) => {
    return apiCall(`/addresses/${id}`, {
      method: 'DELETE',
    });
  },
};

// Favorites API
export const favoritesAPI = {
  getAll: async () => {
    return apiCall('/favorites');
  },
  
  add: async (productId: string) => {
    return apiCall('/favorites', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    });
  },
  
  remove: async (id: string) => {
    return apiCall(`/favorites/${id}`, {
      method: 'DELETE',
    });
  },
};

export const fedexAPI = {
  getRates: async (
    destination: {
      postalCode: string;
      countryCode?: string;
      stateOrProvinceCode?: string;
      city?: string;
      streetLines?: string[];
      streetLine?: string;
      streetAddress?: string;
    },
    packages: Array<{ weight: number; length?: number; width?: number; height?: number }>,
    options?: { signal?: AbortSignal }
  ): Promise<{ rates: FedexRateQuote[] }> => {
    return apiCall('/fedex/rates', {
      method: 'POST',
      signal: options?.signal,
      body: JSON.stringify({ destination, packages }),
    });
  },

  createShipment: async (
    orderId: number | string,
    payload?: { serviceType?: string }
  ): Promise<{
    trackingNumber?: string;
    masterTrackingNumber?: string;
    shippingLabelUrl?: string | null;
    shipmentId?: string;
    order?: unknown;
  }> => {
    return apiCall(`/fedex/shipments/${orderId}/create`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  },

  getTracking: async (
    orderId: number | string
  ): Promise<{
    status?: string;
    latestEvent?: unknown;
    deliveryDate?: string | null;
    order?: unknown;
  }> => {
    return apiCall(`/fedex/shipments/${orderId}/track`);
  },
};

export default apiCall;

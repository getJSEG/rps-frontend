"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import {
  getProductImageUrl,
  productsAPI,
  type HardwareTemplate,
  type ModifierGroup,
  type ModifierPreset,
  type ProductConditionalModifierRule,
  type ProductPurchaseOption,
} from "../../../utils/api";
import { FiEdit, FiTrash2, FiChevronUp, FiChevronDown } from "react-icons/fi";

type Tab = "products" | "categories" | "subcategories";

interface Category {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  description: string | null;
  display_order: number;
  product_count: number;
  image_url?: string | null;
}

interface ProductProperty {
  key: string;
  value: string;
}

interface ProductFaqItem {
  question: string;
  answer: string;
}

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  spec?: string | null;
  file_setup?: string | null;
  installation_guide?: string | null;
  faq?: ProductFaqItem[] | string | null;
  category_id: number | null;
  category_name?: string;
  category_slug?: string;
  subcategory: string | null;
  price: number | null;
  price_per_sqft: number | null;
  min_charge: number | null;
  weight?: number | null;
  length?: number | null;
  shipping_length?: number | null;
  shipping_width?: number | null;
  shipping_height?: number | null;
  shipping_weight?: number | null;
  /** Whole units (e.g. business days); meaning is app-defined. */
  production_time?: number | null;
  /** Ordered bullet points shown under the product image on the storefront. */
  product_highlights?: string[] | null;
  pricing_mode?: "fixed" | "area" | null;
  graphic_scenario_enabled?: boolean | null;
  hardware_template_id?: number | null;
  size_mode?: "predefined" | "custom" | null;
  base_unit?: "inch" | null;
  min_width?: number | null;
  max_width?: number | null;
  min_height?: number | null;
  max_height?: number | null;
  size_options?: Array<{ id?: number; label: string; width: number; height: number; unit_price: number | null; is_default?: boolean }> | null;
  material: string | null;
  image_url: string | null;
  /** Ordered photos; first is used for listings (`image_url`). */
  gallery_images?: string[] | null;
  is_new: boolean;
  is_active: boolean;
  sku: string | null;
  properties?: ProductProperty[] | null;
}

type ProductModifierAssignment = {
  key: string;
  is_required?: boolean;
  sort_order?: number;
  /** Any option key or "all". Dynamic — matches purchase option keys or legacy graphic values. */
  mode_scope?: string;
  options: Array<{ option_id?: number; value: string; price_adjustment_override?: number | null }>;
};

type ConditionalRuleDraft = ProductConditionalModifierRule & {
  hardware_option_key?: string | null;
};

/** First image for admin list: gallery order matches storefront when `image_url` is out of sync. */
function primaryProductListImage(p: Pick<Product, "image_url" | "gallery_images">): string | null {
  const g = p.gallery_images;
  if (Array.isArray(g) && g.length) {
    const first = g.map((x) => String(x || "").trim()).find(Boolean);
    if (first) return first;
  }
  const u = p.image_url?.trim();
  return u || null;
}

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

/** Same suffix as Description for Spec / File setup labels. */
const WORD_STYLE_LABEL_SUFFIX = " (Word-style formatting)";
const RICH_PLACEHOLDER_HINT = "bold, italic, lists supported";

const isFloatInput = (v: string) => v === "" || /^\d*\.?\d*$/.test(v);
const isNonNegativeIntInput = (v: string) => v === "" || /^\d+$/.test(v);
type FedexShippingFieldErrors = Partial<Record<"length" | "width" | "height" | "weight", string>>;
const validateHardwareFedexShippingData = ({
  length,
  width,
  height,
  weight,
}: {
  length: string;
  width: string;
  height: string;
  weight: string;
}): { message: string; fields: FedexShippingFieldErrors } | null => {
  const required = [
    ["length", "length", length],
    ["width", "width", width],
    ["height", "height", height],
    ["weight", "weight", weight],
  ] as const;
  const invalid = required
    .filter(([, , value]) => {
      const n = Number(String(value || "").trim());
      return !Number.isFinite(n) || n <= 0;
    });
  if (invalid.length === 0) return null;
  const fields = invalid.reduce<FedexShippingFieldErrors>((acc, [key]) => {
    acc[key] = `Add ${key}.`;
    return acc;
  }, {});
  const missingLabels = invalid.map(([, label]) => label);
  const missingList =
    missingLabels.length > 1
      ? `${missingLabels.slice(0, -1).join(", ")}, and ${missingLabels[missingLabels.length - 1]}`
      : missingLabels[0];
  return {
    message: `FedEx shipping data is required. Add ${missingList}.`,
    fields,
  };
};
const toCleanDecimalInput = (v: unknown): string => {
  if (v == null) return "";
  const raw = String(v).trim();
  if (!raw) return "";
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return raw;
  return raw.replace(/(\.\d*?[1-9])0+$/,"$1").replace(/\.0+$/,"");
};

/** Seed contenteditable: existing HTML as-is; plain text escaped with line breaks as &lt;br&gt;. */
function toEditorInitialHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  if (/^[\s]*</.test(raw)) return raw;
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function useContentEditableRichText(setHtml: (html: string) => void) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastRangeRef = useRef<Range | null>(null);

  const captureSelection = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.commonAncestorContainer)) return;
    lastRangeRef.current = r.cloneRange();
  }, []);

  const applyCommand = useCallback(
    (command: string) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        const saved = lastRangeRef.current;
        if (saved) {
          try {
            sel.addRange(saved);
          } catch {
            const r = document.createRange();
            r.selectNodeContents(el);
            r.collapse(false);
            sel.addRange(r);
          }
        } else {
          const r = document.createRange();
          r.selectNodeContents(el);
          r.collapse(false);
          sel.addRange(r);
        }
      }
      try {
        document.execCommand(command, false);
      } catch {
        /* ignore */
      }
      captureSelection();
      setHtml(el.innerHTML);
    },
    [captureSelection, setHtml]
  );

  const insertList = useCallback(
    (ordered: boolean) => {
      const el = editorRef.current;
      if (!el) return;
      el.focus();

      const sel = window.getSelection();
      if (!sel) return;

      const restoreCaret = () => {
        sel.removeAllRanges();
        const saved = lastRangeRef.current;
        if (saved) {
          try {
            sel.addRange(saved);
            return;
          } catch {
            /* fall through */
          }
        }
        if (el.childNodes.length === 0) {
          el.appendChild(document.createElement("br"));
        }
        const r = document.createRange();
        r.selectNodeContents(el);
        r.collapse(false);
        sel.addRange(r);
      };

      restoreCaret();
      if (!sel.rangeCount) return;

      let range = sel.getRangeAt(0).cloneRange();
      if (!el.contains(range.commonAncestorContainer)) {
        restoreCaret();
        range = sel.getRangeAt(0).cloneRange();
      }

      const list = document.createElement(ordered ? "ol" : "ul");
      const li = document.createElement("li");

      if (range.collapsed) {
        li.appendChild(document.createElement("br"));
        list.appendChild(li);
        try {
          range.insertNode(list);
        } catch {
          el.appendChild(list);
        }
        const nr = document.createRange();
        nr.setStart(li, 0);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      } else {
        const textFallback = range.toString();
        try {
          const contents = range.extractContents();
          if (contents.textContent === "" && textFallback) {
            li.textContent = textFallback;
          } else {
            li.appendChild(contents);
          }
        } catch {
          li.textContent = textFallback;
        }
        list.appendChild(li);
        try {
          range.insertNode(list);
        } catch {
          el.appendChild(list);
        }
        const nr = document.createRange();
        nr.selectNodeContents(li);
        nr.collapse(false);
        sel.removeAllRanges();
        sel.addRange(nr);
      }

      lastRangeRef.current = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      setHtml(el.innerHTML);
    },
    [setHtml]
  );

  useEffect(() => {
    const onSelectionChange = () => {
      if (document.activeElement !== editorRef.current) return;
      captureSelection();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [captureSelection]);

  return { editorRef, captureSelection, applyCommand, insertList };
}

function useProductRichTextEditors(
  setDescription: (html: string) => void,
  setSpec: (html: string) => void,
  setFileSetup: (html: string) => void
) {
  const description = useContentEditableRichText(setDescription);
  const spec = useContentEditableRichText(setSpec);
  const fileSetup = useContentEditableRichText(setFileSetup);
  return { description, spec, fileSetup };
}

function AdminRichTextField({
  label,
  dataPlaceholder,
  editorRef,
  captureSelection,
  onBold,
  onItalic,
  onBulletList,
  onNumberedList,
  onInput,
}: {
  label: string;
  dataPlaceholder: string;
  editorRef: RefObject<HTMLDivElement | null>;
  captureSelection: () => void;
  onBold: () => void;
  onItalic: () => void;
  onBulletList: () => void;
  onNumberedList: () => void;
  onInput: () => void;
}) {
  return (
    <div className="md:col-span-2">
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex gap-1 rounded-t border-b border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            title="Bold"
            onMouseDown={(e) => {
              e.preventDefault();
              onBold();
            }}
            className="rounded-md px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            B
          </button>
          <button
            type="button"
            title="Italic"
            onMouseDown={(e) => {
              e.preventDefault();
              onItalic();
            }}
            className="rounded-md px-2 py-1 text-sm italic text-slate-700 hover:bg-slate-200"
          >
            I
          </button>
          <button
            type="button"
            title="Bullet list"
            onMouseDown={(e) => {
              e.preventDefault();
              onBulletList();
            }}
            className="rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-200"
          >
            • List
          </button>
          <button
            type="button"
            title="Numbered list"
            onMouseDown={(e) => {
              e.preventDefault();
              onNumberedList();
            }}
            className="rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-200"
          >
            1. List
          </button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onMouseUp={captureSelection}
          onKeyUp={captureSelection}
          onInput={onInput}
          className="admin-product-desc-editor max-h-[200px] min-h-[100px] overflow-y-auto px-3 py-2 text-slate-900 focus:outline-none"
          data-placeholder={dataPlaceholder}
          style={{ outline: "none" }}
        />
      </div>
    </div>
  );
}

type ThemedDropdownOption = {
  value: string;
  label: string;
};

/** Prefix preset dropdown option values so they never collide with modifier catalog `key`. */
const MODIFIER_PRESET_DD_PREFIX = "__preset:";
function presetDropdownOptionValue(id: number) {
  return `${MODIFIER_PRESET_DD_PREFIX}${id}`;
}
function parsePresetIdFromDropdownValue(v: string): string {
  if (!v) return "";
  return v.startsWith(MODIFIER_PRESET_DD_PREFIX) ? v.slice(MODIFIER_PRESET_DD_PREFIX.length) : v;
}

function ThemedDropdown({
  value,
  placeholder,
  options,
  onChange,
  className = "",
  disabled = false,
}: {
  value: string;
  placeholder: string;
  options: ThemedDropdownOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? placeholder;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
        disabled={disabled}
        className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 ${
          disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : "bg-white text-slate-900"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="block truncate">{selectedLabel}</span>
        <FiChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm transition ${
                  isActive ? "bg-sky-50 text-sky-800" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function AdminProductsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Category form
  const [catName, setCatName] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catParentId, setCatParentId] = useState<string>("");
  const [catDescription, setCatDescription] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  // Product form
  const [prodName, setProdName] = useState("");
  const [prodSlug, setProdSlug] = useState("");
  const [prodDescription, setProdDescription] = useState("");
  const [prodSpec, setProdSpec] = useState("");
  const [prodFileSetup, setProdFileSetup] = useState("");
  const [prodInstallationGuide, setProdInstallationGuide] = useState("");
  const [prodFaq, setProdFaq] = useState<ProductFaqItem[]>([]);
  const [prodParentId, setProdParentId] = useState<string>("");
  const [prodCategoryId, setProdCategoryId] = useState<string>("");
  const [prodSubcategory, setProdSubcategory] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodPricePerSqft, setProdPricePerSqft] = useState("");
  const [prodMinCharge, setProdMinCharge] = useState("");
  const [prodWeight, setProdWeight] = useState("");
  const [prodLength, setProdLength] = useState("");
  const [prodShippingLength, setProdShippingLength] = useState("");
  const [prodShippingWidth, setProdShippingWidth] = useState("");
  const [prodShippingHeight, setProdShippingHeight] = useState("");
  const [prodShippingWeight, setProdShippingWeight] = useState("");
  const [fedexShippingFieldErrors, setFedexShippingFieldErrors] = useState<FedexShippingFieldErrors>({});
  const [prodProductionTime, setProdProductionTime] = useState("");
  const [prodHighlights, setProdHighlights] = useState<string[]>([]);
  const [prodPricingMode, setProdPricingMode] = useState<"" | "fixed" | "area">("");
  const [prodGraphicScenarioEnabled, setProdGraphicScenarioEnabled] = useState(false);
  const [prodBaseUnit, setProdBaseUnit] = useState<"inch">("inch");
  const [prodMinWidth, setProdMinWidth] = useState("");
  const [prodMaxWidth, setProdMaxWidth] = useState("");
  const [prodMinHeight, setProdMinHeight] = useState("");
  const [prodMaxHeight, setProdMaxHeight] = useState("");
  const [prodMaterial, setProdMaterial] = useState("");
  /** Ordered product photos; first is listing thumbnail. */
  const [prodGalleryUrls, setProdGalleryUrls] = useState<string[]>([]);
  const [prodImageUrlInput, setProdImageUrlInput] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodIsNew, setProdIsNew] = useState(false);
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodProperties, setProdProperties] = useState<ProductProperty[]>([]);
  const {
    description: {
      editorRef: descEditorRef,
      captureSelection: captureDescSelection,
      applyCommand: applyDescCommand,
      insertList: insertDescList,
    },
    spec: {
      editorRef: specEditorRef,
      captureSelection: captureSpecSelection,
      applyCommand: applySpecCommand,
      insertList: insertSpecList,
    },
    fileSetup: {
      editorRef: fileSetupEditorRef,
      captureSelection: captureFileSetupSelection,
      applyCommand: applyFileSetupCommand,
      insertList: insertFileSetupList,
    },
  } = useProductRichTextEditors(setProdDescription, setProdSpec, setProdFileSetup);

  const productFormRef = useRef<HTMLFormElement>(null);
  const categoryFormRef = useRef<HTMLFormElement>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [productDeleteTarget, setProductDeleteTarget] = useState<Pick<Product, "id" | "name"> | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsPerPage] = useState(10);
  const [productsPagination, setProductsPagination] = useState({ total: 0, pages: 0 });
  const [modifierCatalog, setModifierCatalog] = useState<ModifierGroup[]>([]);
  const [modifierPresets, setModifierPresets] = useState<ModifierPreset[]>([]);
  const [hardwareTemplates, setHardwareTemplates] = useState<HardwareTemplate[]>([]);
  const [selectedHardwareTemplateId, setSelectedHardwareTemplateId] = useState<string>("");
  const [prodModifierAssignments, setProdModifierAssignments] = useState<Record<string, ProductModifierAssignment>>({});
  const [prodConditionalRules, setProdConditionalRules] = useState<ConditionalRuleDraft[]>([]);
  const [selectedModifierKey, setSelectedModifierKey] = useState<string>("");
  /** Value from preset dropdown (`presetDropdownOptionValue(id)`), or "" for placeholder. */
  const [selectedPresetDropdownValue, setSelectedPresetDropdownValue] = useState<string>("");
  /** Purchase options (always 2 for hardware products; empty for plain products) */
  const [prodPurchaseOptions, setProdPurchaseOptions] = useState<ProductPurchaseOption[]>([]);
  /** option_key of the option whose price is shown on the listing card */
  const [listingPriceOptionKey, setListingPriceOptionKey] = useState<string>("");
  /** Whether to use base price or modifier-adjusted preview price for listing */
  const [listingPriceUseComputed, setListingPriceUseComputed] = useState(false);

  const getProductImageSrc = (url: string | null | undefined) => {
    if (!url || typeof url !== "string") return "";
    const u = url.trim();
    if (!u) return "";
    if (u.startsWith("uploads/")) return getProductImageUrl(`/${u}`);
    return getProductImageUrl(u);
  };

  const isValidImageSrc = (url: string | null | undefined) => {
    if (!url || typeof url !== "string") return false;
    const u = url.trim();
    if (!u) return false;
    const lower = u.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://")) return true;
    if (u.startsWith("/")) return true;
    if (lower.startsWith("uploads/")) return true;
    return false;
  };

  const handleProductDelete = async (id: number) => {
    setDeletingProductId(id);
    try {
      await productsAPI.delete(String(id));
      showMsg("success", "Product deleted.");
      if (editingProductId === id) cancelEdit();
      setProductDeleteTarget(null);
      await loadProducts();
      await loadCategories();
    } catch (err: unknown) {
      showMsg("error", err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleProductImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!list.length) {
      showMsg("error", "Please select image files (JPEG, PNG, GIF, WebP).");
      e.target.value = "";
      return;
    }
    setUploadingImage(true);
    try {
      const urls: string[] = [];
      for (const file of list) {
        const res = await productsAPI.uploadImage(file);
        if (res?.url) urls.push(res.url);
      }
      if (urls.length) {
        setProdGalleryUrls((prev) => [...prev, ...urls]);
        showMsg("success", urls.length === 1 ? "Image uploaded." : `${urls.length} images uploaded.`);
      }
    } catch (err: unknown) {
      showMsg("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const moveGallery = (index: number, dir: -1 | 1) => {
    setProdGalleryUrls((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const removeGalleryAt = (index: number) => {
    setProdGalleryUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const addGalleryUrlFromInput = () => {
    const u = prodImageUrlInput.trim();
    if (!u) return;
    if (!u.startsWith("http") && !u.startsWith("/")) {
      showMsg("error", "URL must start with http(s) or /");
      return;
    }
    setProdGalleryUrls((prev) => [...prev, u]);
    setProdImageUrlInput("");
    showMsg("success", "Image URL added.");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }
    if (!canAccessAdminPanel()) {
      router.push("/");
      return;
    }
  }, [router]);

  const loadCategories = async () => {
    try {
      const res = await productsAPI.getCategories();
      setCategories(res.categories || []);
    } catch (e) {
      console.error(e);
      setCategories([]);
    }
  };

  const loadProducts = async (page?: number) => {
    try {
      const p = page ?? productsPage;
      const res = await productsAPI.getAllAdmin({ page: p, limit: productsPerPage });
      setProducts(res.products || []);
      if (res.pagination) {
        setProductsPagination({ total: res.pagination.total, pages: res.pagination.pages });
        setProductsPage(p);
      }
    } catch (e) {
      console.error(e);
      setProducts([]);
    }
  };

  const loadModifierCatalog = async () => {
    try {
      const res = await productsAPI.getModifierCatalogAdmin();
      setModifierCatalog(Array.isArray(res?.groups) ? res.groups : []);
    } catch (e) {
      console.error(e);
      setModifierCatalog([]);
    }
  };

  const loadHardwareTemplates = async () => {
    try {
      const res = await productsAPI.getHardwareTemplatesAdmin();
      setHardwareTemplates(Array.isArray(res?.templates) ? res.templates : []);
    } catch (e) {
      console.error(e);
      setHardwareTemplates([]);
    }
  };

  const loadModifierPresets = async () => {
    try {
      const res = await productsAPI.getModifierPresetsAdmin();
      setModifierPresets(Array.isArray(res?.presets) ? res.presets : []);
    } catch (e) {
      console.error(e);
      setModifierPresets([]);
    }
  };

  const assignmentFromCatalogGroup = useCallback((group: ModifierGroup, sortOrder: number): ProductModifierAssignment => ({
    key: group.key,
    is_required: false,
    sort_order: sortOrder,
    mode_scope: "all",
    options: (Array.isArray(group.options) ? group.options : []).map((o) => ({
      option_id: o.id != null ? Number(o.id) : undefined,
      value: String(o.value || ""),
      price_adjustment_override: null,
    })),
  }), []);

  const applyHardwareTemplate = useCallback((template: HardwareTemplate) => {
    const templateOptions = (Array.isArray(template.options) ? template.options : []).slice(0, 2);
    const nextOptions: ProductPurchaseOption[] = templateOptions.map((opt, idx) => ({
      label: String(opt.label || ""),
      option_key: String(opt.option_key || `option_${idx + 1}`),
      pricing_mode: "fixed",
      unit_price: opt.unit_price == null ? null : Number(opt.unit_price),
      is_default: !!opt.is_default,
      sort_order: idx,
    }));
    setProdPurchaseOptions(nextOptions);

    // Auto-select the default option as the listing price option
    const defaultOpt = nextOptions.find((o) => o.is_default) || nextOptions[0];
    if (defaultOpt) setListingPriceOptionKey(String(defaultOpt.option_key || "").trim().toLowerCase());

    const catalogByLowerKey = new Map<string, ModifierGroup>();
    for (const group of modifierCatalog) {
      const key = String(group.key || "").trim().toLowerCase();
      if (key) catalogByLowerKey.set(key, group);
    }

    const attachedModifierKeys = new Set<string>();
    for (const opt of templateOptions) {
      const modifiers = Array.isArray(opt.modifiers) ? opt.modifiers : [];
      for (const mod of modifiers) {
        const key = String(mod.key || "").trim().toLowerCase();
        if (key) attachedModifierKeys.add(key);
      }
    }

    const nextAssignments: Record<string, ProductModifierAssignment> = {};
    for (const lowerKey of attachedModifierKeys) {
      const group = catalogByLowerKey.get(lowerKey);
      if (!group) continue;
      nextAssignments[group.key] = assignmentFromCatalogGroup(group, Object.keys(nextAssignments).length);
    }

    const modifierScopes = new Map<string, Set<string>>();
    const modifierRequired = new Map<string, boolean>();

    for (const opt of templateOptions) {
      const scope = String(opt.option_key || "").trim().toLowerCase();
      const modifiers = Array.isArray(opt.modifiers) ? opt.modifiers : [];
      for (const mod of modifiers) {
        const lowerKey = String(mod.key || "").trim().toLowerCase();
        const group = catalogByLowerKey.get(lowerKey);
        if (!group || !nextAssignments[group.key]) continue;
        if (!modifierScopes.has(group.key)) modifierScopes.set(group.key, new Set<string>());
        if (scope) modifierScopes.get(group.key)!.add(scope);
        if (mod.is_required) modifierRequired.set(group.key, true);
      }
    }

    for (const key of Object.keys(nextAssignments)) {
      const scopes = modifierScopes.get(key);
      const scopeValues = scopes ? Array.from(scopes) : [];
      nextAssignments[key] = {
        ...nextAssignments[key],
        is_required: !!modifierRequired.get(key),
        mode_scope: scopeValues.length > 1 ? "all" : (scopeValues[0] || "all"),
      }
    }
    setProdModifierAssignments(nextAssignments);
    setProdConditionalRules([]);
  }, [assignmentFromCatalogGroup, modifierCatalog]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await Promise.all([
        loadCategories(),
        loadProducts(),
        loadModifierCatalog(),
        loadModifierPresets(),
        loadHardwareTemplates(),
      ]);
      setLoading(false);
    };
    run();
  }, []);

  const parentCategories = categories.filter((c) => !c.parent_id);
  const subCategories = categories.filter((c) => c.parent_id != null);
  const subCategoriesForParent = subCategories.filter(
    (c) => prodParentId !== "" && c.parent_id === parseInt(prodParentId)
  );
  const purchaseOptionsForView = (prodPurchaseOptions.length > 0 ? prodPurchaseOptions : [
    { label: "Option 1", option_key: "option_1", pricing_mode: "fixed" as const, unit_price: null, is_default: true },
    { label: "Option 2", option_key: "option_2", pricing_mode: "fixed" as const, unit_price: null, is_default: false },
  ]);
  const assignedModifierGroups = modifierCatalog.filter((g) => !!prodModifierAssignments[g.key]);
  const findModifierGroupById = (id: number | null | undefined) =>
    assignedModifierGroups.find((g) => Number(g.id) === Number(id));
  const findModifierOptionById = (groupId: number | null | undefined, optionId: number | null | undefined) =>
    findModifierGroupById(groupId)?.options.find((o) => Number(o.id) === Number(optionId));
  const isModifierVisibleForHardwareKey = (groupId: number, hardwareKey: string | null | undefined) => {
    const group = findModifierGroupById(groupId);
    if (!group) return false;
    const assignment = prodModifierAssignments[group.key];
    if (!assignment) return false;
    const scope = String(assignment.mode_scope || "all").trim().toLowerCase();
    const key = String(hardwareKey || "").trim().toLowerCase();
    return !key || scope === "all" || scope === key;
  };
  const cleanConditionalRules = (rules: ConditionalRuleDraft[]) =>
    rules.filter((rule) => {
      if (!rule.source_modifier_id || !rule.target_modifier_id) return false;
      if (rule.action_type !== "auto_select" && rule.action_type !== "disable") return false;
      const hardwareKey = String(rule.hardware_option_key || "").trim().toLowerCase();
      return (
        isModifierVisibleForHardwareKey(rule.source_modifier_id, hardwareKey) &&
        isModifierVisibleForHardwareKey(rule.target_modifier_id, hardwareKey) &&
        (!rule.source_option_id || !!findModifierOptionById(rule.source_modifier_id, rule.source_option_id)) &&
        (rule.action_type === "disable" && !rule.target_option_id
          ? true
          : !!findModifierOptionById(rule.target_modifier_id, rule.target_option_id))
      );
    });
  const createDefaultConditionalRule = (): ConditionalRuleDraft | null => {
    if (assignedModifierGroups.length === 0) return null;
    return {
      hardware_option_id: null,
      hardware_option_key: null,
      source_modifier_id: 0,
      source_option_id: 0,
      action_type: "auto_select",
      target_modifier_id: 0,
      target_option_id: null,
      sort_order: prodConditionalRules.length,
    };
  };

  /** Format price: remove unnecessary trailing zeros (100.0000 → "100", 100.50 → "100.50") */
  function formatOptionPrice(v: number | null | undefined): string {
    if (v == null) return "";
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    const fixed2 = parseFloat(n.toFixed(2));
    return fixed2 % 1 === 0 ? String(fixed2) : fixed2.toFixed(2);
  }

  /** Live preview: base price + default modifier option adjustments, per purchase option key */
  const optionPreviewPrices = useMemo(() => {
    const result: Record<string, number> = {};
    for (const opt of prodPurchaseOptions) {
      const base = Number(opt.unit_price || 0);
      const optKey = String(opt.option_key || "").trim().toLowerCase();
      let modifierTotal = 0;
      for (const assignment of Object.values(prodModifierAssignments)) {
        const scope = String(assignment.mode_scope || "all").trim().toLowerCase();
        if (scope !== "all" && scope !== optKey) continue;
        const catalogGroup = modifierCatalog.find((g) => g.key === assignment.key);
        if (!catalogGroup) continue;
        const defaultCatalogOption = catalogGroup.options.find((o) => o.is_default) || catalogGroup.options[0];
        if (!defaultCatalogOption) continue;
        const assignmentOption = assignment.options.find(
          (o) => String(o.value || "") === String(defaultCatalogOption.value || "")
        );
        const effectiveAdj =
          assignmentOption?.price_adjustment_override != null
            ? Number(assignmentOption.price_adjustment_override)
            : Number(defaultCatalogOption.price_adjustment || 0);
        const priceType = String(defaultCatalogOption.price_type || "percent").trim().toLowerCase();
        modifierTotal += priceType === "fixed" ? effectiveAdj : base * (effectiveAdj / 100);
      }
      result[optKey] = base + modifierTotal;
    }
    return result;
  }, [prodPurchaseOptions, prodModifierAssignments, modifierCatalog]);

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  /** Simple modifiers only: set product modifiers to exactly this preset (replaces previous assignments). */
  const applyModifierPresetFromId = (presetIdStr: string) => {
    const id = Number(presetIdStr);
    if (!Number.isFinite(id) || id <= 0) return;
    const preset = modifierPresets.find((p) => p.id === id);
    if (!preset) return;
    if (!Array.isArray(preset.modifiers) || preset.modifiers.length === 0) {
      showMsg("error", "This preset has no modifiers.");
      return;
    }
    const ordered = [...preset.modifiers].sort((a, b) => a.sort_order - b.sort_order);
    const next: Record<string, ProductModifierAssignment> = {};
    let sortBase = 0;
    for (const item of ordered) {
      const group =
        modifierCatalog.find((g) => Number(g.id) === Number(item.modifier_group_id)) ||
        modifierCatalog.find(
          (g) => String(g.key).toLowerCase() === String(item.key || "").toLowerCase()
        );
      if (!group) continue;
      next[group.key] = assignmentFromCatalogGroup(group, sortBase++);
    }
    if (Object.keys(next).length === 0) {
      showMsg("error", "No matching modifiers from that preset in the catalog.");
      return;
    }
    setProdModifierAssignments(next);
    setProdConditionalRules([]);
    setSelectedModifierKey("");
    showMsg("success", `Preset "${preset.name}" applied.`);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      showMsg("error", "Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingCategoryId) {
        await productsAPI.updateCategory(String(editingCategoryId), {
          name: catName.trim(),
          slug: catSlug.trim() || undefined,
          parent_id: catParentId === "" ? null : parseInt(catParentId),
          description: catDescription.trim() || undefined,
        });
        showMsg("success", "Category updated.");
      } else {
        await productsAPI.createCategory({
          name: catName.trim(),
          slug: (catSlug.trim() || catName.trim().toLowerCase().replace(/\s+/g, "-")).replace(/[^a-z0-9-]/g, ""),
          parent_id: catParentId === "" ? null : parseInt(catParentId),
          description: catDescription.trim() || undefined,
        });
        showMsg("success", "Category added.");
      }
      setCatName("");
      setCatSlug("");
      setCatParentId("");
      setCatDescription("");
      setEditingCategoryId(null);
      await loadCategories();
    } catch (err: unknown) {
      showMsg("error", err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) {
      showMsg("error", "Product name is required");
      return;
    }
    if (prodPricingMode !== "fixed" && prodPricingMode !== "area") {
      showMsg("error", "Please select a price type");
      return;
    }
    if (prodGraphicScenarioEnabled && prodPricingMode !== "fixed") {
      showMsg("error", "Graphic scenario products must use fixed pricing.");
      return;
    }
    if (prodGraphicScenarioEnabled && !selectedHardwareTemplateId && prodPurchaseOptions.length === 0) {
      showMsg("error", "Please select a hardware template.");
      return;
    }
    if (prodGraphicScenarioEnabled && prodPurchaseOptions.length > 0 && !listingPriceOptionKey) {
      showMsg("error", "Please select which option to show on the listing (Show on listing).");
      return;
    }
    if (prodGraphicScenarioEnabled) {
      const fedexShippingValidation = validateHardwareFedexShippingData({
        length: prodShippingLength,
        width: prodShippingWidth,
        height: prodShippingHeight,
        weight: prodShippingWeight,
      });
      if (fedexShippingValidation) {
        setFedexShippingFieldErrors(fedexShippingValidation.fields);
        showMsg("error", fedexShippingValidation.message);
        return;
      }
    }
    setFedexShippingFieldErrors({});
    setSaving(true);
    try {
      const payload = {
        name: prodName.trim(),
        slug: prodSlug.trim() || undefined,
        description: prodDescription.trim() || undefined,
        spec: prodSpec.trim() || undefined,
        file_setup: prodFileSetup.trim() || undefined,
        installation_guide: prodInstallationGuide.trim() || undefined,
        faq: prodFaq
          .filter((item) => item.question.trim() || item.answer.trim())
          .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() })),
        category_id: prodCategoryId === "" ? null : parseInt(prodCategoryId),
        subcategory: prodSubcategory.trim() || undefined,
        price: (() => {
          if (prodGraphicScenarioEnabled && prodPurchaseOptions.length > 0) {
            const listingOpt = prodPurchaseOptions.find(
              (o) => String(o.option_key || "").trim().toLowerCase() === listingPriceOptionKey
            ) || prodPurchaseOptions.find((o) => o.is_default) || prodPurchaseOptions[0];
            if (!listingOpt) return null;
            const optKey = String(listingOpt.option_key || "").trim().toLowerCase();
            if (listingPriceUseComputed) {
              return optionPreviewPrices[optKey] ?? (listingOpt.unit_price != null ? Number(listingOpt.unit_price) : null);
            }
            return listingOpt.unit_price != null ? Number(listingOpt.unit_price) : null;
          }
          return prodPricingMode === "fixed" ? (prodPrice === "" ? null : parseFloat(prodPrice)) : null;
        })(),
        price_per_sqft:
          prodPricingMode === "area"
            ? prodPricePerSqft === ""
              ? null
              : parseFloat(prodPricePerSqft)
            : null,
        min_charge: prodMinCharge === "" ? null : parseFloat(prodMinCharge),
        weight: prodWeight === "" ? null : parseFloat(prodWeight),
        length: prodLength === "" ? null : parseFloat(prodLength),
        shipping_length: prodShippingLength === "" ? null : parseFloat(prodShippingLength),
        shipping_width: prodShippingWidth === "" ? null : parseFloat(prodShippingWidth),
        shipping_height: prodShippingHeight === "" ? null : parseFloat(prodShippingHeight),
        shipping_weight: prodShippingWeight === "" ? null : parseFloat(prodShippingWeight),
        production_time: prodProductionTime === "" ? null : parseInt(prodProductionTime, 10),
        product_highlights: prodHighlights.map((h) => h.trim()).filter(Boolean),
        pricing_mode: prodPricingMode as "fixed" | "area",
        graphic_scenario_enabled: prodGraphicScenarioEnabled,
        hardware_template_id: prodGraphicScenarioEnabled && selectedHardwareTemplateId
          ? Number(selectedHardwareTemplateId)
          : null,
        size_mode: "custom" as const,
        base_unit: prodBaseUnit,
        min_width: prodGraphicScenarioEnabled ? null : (prodMinWidth === "" ? null : parseFloat(prodMinWidth)),
        max_width: prodGraphicScenarioEnabled ? null : (prodMaxWidth === "" ? null : parseFloat(prodMaxWidth)),
        min_height: prodGraphicScenarioEnabled ? null : (prodMinHeight === "" ? null : parseFloat(prodMinHeight)),
        max_height: prodGraphicScenarioEnabled ? null : (prodMaxHeight === "" ? null : parseFloat(prodMaxHeight)),
        size_options: [],
        material: prodMaterial.trim() || undefined,
        gallery_images: prodGalleryUrls,
        image_url: prodGalleryUrls[0]?.trim() || undefined,
        sku: prodSku.trim() || undefined,
        is_new: prodIsNew,
        is_active: prodIsActive,
        properties: prodProperties.filter((pr) => pr.key.trim() || pr.value.trim()).map((pr) => ({ key: pr.key.trim(), value: pr.value.trim() })),
      };
      const hasPurchaseOpts = prodPurchaseOptions.length > 0;
      const modifierPayload = {
        groups: Object.values(prodModifierAssignments).map((a) => ({
          key: a.key,
          is_required: !!a.is_required,
          sort_order: Number(a.sort_order || 0),
          mode_scope: (hasPurchaseOpts || prodGraphicScenarioEnabled) ? (a.mode_scope || "all") : "all",
          options: a.options.map((o) => ({
            option_id: o.option_id != null ? Number(o.option_id) : undefined,
            value: o.value,
            price_adjustment_override:
              o.price_adjustment_override == null ? null : Number(o.price_adjustment_override),
          })),
        })),
        conditional_rules: cleanConditionalRules(prodConditionalRules).map((rule, i) => ({
          hardware_option_key: rule.hardware_option_key || null,
          source_modifier_id: Number(rule.source_modifier_id),
          source_option_id: rule.source_option_id == null || Number(rule.source_option_id) <= 0 ? null : Number(rule.source_option_id),
          action_type: rule.action_type,
          target_modifier_id: Number(rule.target_modifier_id),
          target_option_id: rule.target_option_id == null || Number(rule.target_option_id) <= 0 ? null : Number(rule.target_option_id),
          sort_order: i,
        })),
      };
      const purchaseOptionsPayload = {
        purchase_options: prodPurchaseOptions
          .filter((o) => o.label.trim() && o.option_key.trim())
          .map((o, i) => ({ ...o, sort_order: i })),
      };
      let savedProductId: number | null = null;
      if (editingProductId) {
        const updateRes = await productsAPI.update(String(editingProductId), payload);
        savedProductId = Number(updateRes?.product?.id || editingProductId);
        await productsAPI.updateProductPurchaseOptionsAdmin(String(savedProductId), purchaseOptionsPayload);
        await productsAPI.updateProductModifiersAdmin(String(savedProductId), modifierPayload);
        showMsg("success", "Product updated.");
      } else {
        const createRes = await productsAPI.create(payload);
        savedProductId = Number(createRes?.product?.id);
        if (savedProductId) {
          await productsAPI.updateProductPurchaseOptionsAdmin(String(savedProductId), purchaseOptionsPayload);
          await productsAPI.updateProductModifiersAdmin(String(savedProductId), modifierPayload);
        }
        showMsg("success", "Product added.");
      }
      setProdName("");
      setProdSlug("");
      setProdDescription("");
      setProdSpec("");
      setProdFileSetup("");
      setProdInstallationGuide("");
      setProdFaq([]);
      setProdParentId("");
      setProdCategoryId("");
      setProdSubcategory("");
      setProdPrice("");
      setProdPricePerSqft("");
      setProdMinCharge("");
      setProdWeight("");
      setProdLength("");
      setProdShippingLength("");
      setProdShippingWidth("");
      setProdShippingHeight("");
      setProdShippingWeight("");
      setFedexShippingFieldErrors({});
      setProdProductionTime("");
      setProdHighlights([]);
      setProdPricingMode("");
      setProdGraphicScenarioEnabled(false);
      setProdBaseUnit("inch");
      setProdMinWidth("");
      setProdMaxWidth("");
      setProdMinHeight("");
      setProdMaxHeight("");
      setProdMaterial("");
      setProdGalleryUrls([]);
      setProdImageUrlInput("");
      setProdSku("");
      setProdIsNew(false);
      setProdIsActive(true);
      setProdProperties([]);
      setProdModifierAssignments({});
      setProdConditionalRules([]);
      setSelectedModifierKey("");
      setSelectedPresetDropdownValue("");
      setProdPurchaseOptions([]);
      setSelectedHardwareTemplateId("");
      setListingPriceOptionKey("");
      setListingPriceUseComputed(false);
      setEditingProductId(null);
      if (descEditorRef.current) descEditorRef.current.innerHTML = "";
      if (specEditorRef.current) specEditorRef.current.innerHTML = "";
      if (fileSetupEditorRef.current) fileSetupEditorRef.current.innerHTML = "";
      await loadProducts();
      await loadCategories();
    } catch (err: unknown) {
      showMsg("error", err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const startEditCategory = (c: Category) => {
    setEditingCategoryId(c.id);
    setCatName(c.name);
    setCatSlug(c.slug);
    setCatParentId(c.parent_id == null ? "" : String(c.parent_id));
    setCatDescription(c.description || "");
    setTimeout(() => {
      categoryFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleCategoryDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone. If it has products or subcategories, delete will be blocked.`)) return;
    setDeletingCategoryId(id);
    try {
      await productsAPI.deleteCategory(String(id));
      showMsg("success", "Category deleted.");
      if (editingCategoryId === id) cancelEdit();
      await loadCategories();
    } catch (err: unknown) {
      showMsg("error", err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const startEditProduct = async (p: Product) => {
    setEditingProductId(p.id);
    setSelectedPresetDropdownValue("");
    setProdName(p.name);
    setProdSlug(p.slug);
    setProdDescription(p.description || "");
    setProdSpec(p.spec || "");
    setProdFileSetup(p.file_setup || "");
    setProdInstallationGuide(p.installation_guide || "");
    {
      const f = p.faq;
      const parsedFaq =
        Array.isArray(f)
          ? f
          : typeof f === "string"
            ? (() => {
                try {
                  const parsed = JSON.parse(f);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              })()
            : [];
      setProdFaq(
        parsedFaq
          .map((x) => ({
            question: String((x as ProductFaqItem)?.question || ""),
            answer: String((x as ProductFaqItem)?.answer || ""),
          }))
      );
    }
    const props = p.properties;
    setProdProperties(Array.isArray(props) ? props : typeof props === "string" ? (() => { try { return JSON.parse(props); } catch { return []; } })() : []);
    const catId = p.category_id == null ? null : p.category_id;
    const cat = catId != null ? categories.find((catItem) => catItem.id === catId) : null;
    if (cat) {
      setProdParentId(cat.parent_id != null ? String(cat.parent_id) : String(cat.id));
      setProdCategoryId(String(cat.id));
      setProdSubcategory(p.subcategory || cat.name || "");
    } else {
      setProdParentId("");
      setProdCategoryId("");
      setProdSubcategory(p.subcategory || "");
    }
    setProdMinCharge(p.min_charge != null ? String(p.min_charge) : "");
    setProdWeight(toCleanDecimalInput(p.weight));
    setProdLength(toCleanDecimalInput(p.length));
    setProdShippingLength(toCleanDecimalInput(p.shipping_length));
    setProdShippingWidth(toCleanDecimalInput(p.shipping_width));
    setProdShippingHeight(toCleanDecimalInput(p.shipping_height));
    setProdShippingWeight(toCleanDecimalInput(p.shipping_weight));
    setFedexShippingFieldErrors({});
    setProdProductionTime(
      p.production_time != null && Number.isFinite(Number(p.production_time))
        ? String(Math.trunc(Number(p.production_time)))
        : ""
    );
    {
      const h = p.product_highlights;
      setProdHighlights(Array.isArray(h) ? h.map(String) : []);
    }
    const pm = p.pricing_mode;
    const isFixed = pm === "fixed";
    const isArea = pm === "area";
    const isGraphicScenario = !!p.graphic_scenario_enabled;
    setProdGraphicScenarioEnabled(isGraphicScenario);
    setSelectedHardwareTemplateId(
      p.hardware_template_id != null ? String(p.hardware_template_id) : ""
    );
    setProdPricingMode(isGraphicScenario ? "fixed" : (isFixed || isArea ? pm : ""));
    setProdPrice(isArea ? "" : p.price != null ? String(p.price) : "");
    setProdPricePerSqft(isGraphicScenario || isFixed ? "" : p.price_per_sqft != null ? String(p.price_per_sqft) : "");
    setProdBaseUnit("inch");
    setProdMinWidth(p.min_width != null ? String(p.min_width) : "");
    setProdMaxWidth(p.max_width != null ? String(p.max_width) : "");
    setProdMinHeight(p.min_height != null ? String(p.min_height) : "");
    setProdMaxHeight(p.max_height != null ? String(p.max_height) : "");
    setProdMaterial(p.material || "");
    {
      const g = p.gallery_images;
      let urls: string[] = [];
      if (Array.isArray(g)) urls = g.map((x) => String(x || "").trim()).filter(Boolean);
      else if (g && typeof g === "object" && !Array.isArray(g)) {
        /* ignore */
      }
      if (!urls.length && p.image_url) urls = [p.image_url];
      setProdGalleryUrls(urls);
    }
    setProdImageUrlInput("");
    setProdSku(p.sku || "");
    setProdIsNew(p.is_new);
    setProdIsActive(p.is_active);
    try {
      const [modRes, poRes] = await Promise.all([
        productsAPI.getProductModifiersAdmin(String(p.id)),
        productsAPI.getProductPurchaseOptionsAdmin(String(p.id)),
      ]);
      const rows = Array.isArray(modRes?.groups) ? modRes.groups : [];
      const next: Record<string, ProductModifierAssignment> = {};
      for (const row of rows) {
        next[String(row.key)] = {
          key: String(row.key),
          is_required: !!row.is_required,
          sort_order: Number(row.sort_order || 0),
          mode_scope: String(row.mode_scope || "all"),
          options: Array.isArray(row.options)
            ? row.options.map((o: { id?: number; value: string; price_adjustment?: number }) => ({
                option_id: o.id != null ? Number(o.id) : undefined,
                value: String(o.value),
                price_adjustment_override: o.price_adjustment != null ? Number(o.price_adjustment) : null,
              }))
            : [],
        };
      }
      setProdModifierAssignments(next);
      const ruleRows: ProductConditionalModifierRule[] = Array.isArray(modRes?.conditional_rules)
        ? modRes.conditional_rules
        : [];
      setProdConditionalRules(
        ruleRows.map((rule) => ({
          ...rule,
          hardware_option_key: rule.hardware_option_key || null,
          hardware_option_id: rule.hardware_option_id ?? null,
          source_modifier_id: Number(rule.source_modifier_id || 0),
          source_option_id: rule.source_option_id == null ? null : Number(rule.source_option_id || 0),
          action_type: rule.action_type === "disable" ? "disable" : "auto_select",
          target_modifier_id: Number(rule.target_modifier_id || 0),
          target_option_id: rule.target_option_id == null ? null : Number(rule.target_option_id || 0),
        }))
      );
      const poRows: ProductPurchaseOption[] = Array.isArray(poRes?.purchase_options) ? poRes.purchase_options : [];
      setProdPurchaseOptions(poRows);
      setSelectedHardwareTemplateId("");
      // Restore listing price option: find the option whose unit_price matches product.price,
      // fallback to the is_default option
      if (poRows.length > 0 && p.price != null) {
        const pPrice = Number(p.price);
        const matched = poRows.find((o) => o.unit_price != null && Number(o.unit_price) === pPrice);
        const fallback = poRows.find((o) => o.is_default) || poRows[0];
        const resolved = matched || fallback;
        setListingPriceOptionKey(String(resolved?.option_key || "").trim().toLowerCase());
      } else if (poRows.length > 0) {
        const fallback = poRows.find((o) => o.is_default) || poRows[0];
        setListingPriceOptionKey(String(fallback?.option_key || "").trim().toLowerCase());
      } else {
        setListingPriceOptionKey("");
      }
    } catch (e) {
      console.error(e);
      setProdModifierAssignments({});
      setProdConditionalRules([]);
      setSelectedModifierKey("");
      setSelectedPresetDropdownValue("");
      setProdPurchaseOptions([]);
      setSelectedHardwareTemplateId("");
      setListingPriceOptionKey("");
    }
    setTimeout(() => {
      productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    setTimeout(() => {
      if (descEditorRef.current) descEditorRef.current.innerHTML = toEditorInitialHtml(p.description);
      if (specEditorRef.current) specEditorRef.current.innerHTML = toEditorInitialHtml(p.spec);
      if (fileSetupEditorRef.current) fileSetupEditorRef.current.innerHTML = toEditorInitialHtml(p.file_setup);
    }, 0);
  };

  const cancelEdit = () => {
    setEditingCategoryId(null);
    setEditingProductId(null);
    setCatName("");
    setCatSlug("");
    setCatParentId("");
    setCatDescription("");
    setProdName("");
    setProdSlug("");
    setProdDescription("");
    setProdSpec("");
    setProdFileSetup("");
    setProdInstallationGuide("");
    setProdFaq([]);
    setProdParentId("");
    setProdCategoryId("");
    setProdSubcategory("");
    setProdPrice("");
    setProdPricePerSqft("");
    setProdMinCharge("");
    setProdWeight("");
    setProdLength("");
    setProdShippingLength("");
    setProdShippingWidth("");
    setProdShippingHeight("");
    setProdShippingWeight("");
    setFedexShippingFieldErrors({});
    setProdProductionTime("");
    setProdHighlights([]);
    setProdPricingMode("");
    setProdGraphicScenarioEnabled(false);
    setProdBaseUnit("inch");
    setProdMinWidth("");
    setProdMaxWidth("");
    setProdMinHeight("");
    setProdMaxHeight("");
    setProdMaterial("");
    setProdGalleryUrls([]);
    setProdImageUrlInput("");
    setProdSku("");
    setProdIsNew(false);
    setProdIsActive(true);
    setProdProperties([]);
    setProdModifierAssignments({});
    setProdConditionalRules([]);
    setSelectedModifierKey("");
    setSelectedPresetDropdownValue("");
    setProdPurchaseOptions([]);
    setSelectedHardwareTemplateId("");
    setListingPriceOptionKey("");
    setListingPriceUseComputed(false);
    if (descEditorRef.current) descEditorRef.current.innerHTML = "";
    if (specEditorRef.current) specEditorRef.current.innerHTML = "";
    if (fileSetupEditorRef.current) fileSetupEditorRef.current.innerHTML = "";
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25";
  const inputClassDisabled =
    `${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`;
  const selectClass =
    `${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`;

  return (
    <AdminNavbar title="Products" subtitle="Catalog, categories, and subcategories">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to orders
      </Link>

      {message && (
        <div
          role="alert"
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5">
        <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-6">
          {(["products", "categories", "subcategories"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? "bg-slate-700 text-white shadow-sm"
                  : "bg-white text-slate-600 ring-1 ring-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab === "subcategories" ? "Subcategories" : tab === "products" ? "Products" : "Categories"}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-6">
            {loading ? (
              <p className="flex items-center gap-2 text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                Loading…
              </p>
            ) : (
              <>
                {/* Products tab */}
                {activeTab === "products" && (
                  <div className="space-y-6">
                    <form
                      ref={productFormRef}
                      onSubmit={handleProductSubmit}
                      className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200/60 bg-slate-50/80 p-5 md:grid-cols-2"
                    >
                      <h3 className="md:col-span-2 text-base font-semibold text-slate-900">
                        {editingProductId ? "Edit Product" : "Add Product"}
                      </h3>
                      <input
                        type="text"
                        placeholder="Product name *"
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        placeholder="Slug (optional)"
                        value={prodSlug}
                        onChange={(e) => setProdSlug(e.target.value)}
                        className={inputClass}
                      />
                      <AdminRichTextField
                        label={`Description${WORD_STYLE_LABEL_SUFFIX}`}
                        dataPlaceholder={`Enter description (${RICH_PLACEHOLDER_HINT})...`}
                        editorRef={descEditorRef}
                        captureSelection={captureDescSelection}
                        onBold={() => applyDescCommand("bold")}
                        onItalic={() => applyDescCommand("italic")}
                        onBulletList={() => insertDescList(false)}
                        onNumberedList={() => insertDescList(true)}
                        onInput={() => descEditorRef.current && setProdDescription(descEditorRef.current.innerHTML)}
                      />
                      <div className="md:col-span-2">
                        <div className="mb-2 flex flex-wrap items-start justify-between mb-4 gap-3">
                          <label className="block text-sm font-medium text-slate-700">
                            Product properties (e.g. Size, Material)
                          </label>
                          <button
                            type="button"
                            onClick={() => setProdProperties([...prodProperties, { key: "", value: "" }])}
                            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                          >
                            + Add property
                          </button>
                        </div>
                        <div className="space-y-2">
                          {prodProperties.map((pr, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                placeholder="Property name"
                                value={pr.key}
                                onChange={(e) => {
                                  const next = [...prodProperties];
                                  next[idx] = { ...next[idx], key: e.target.value };
                                  setProdProperties(next);
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25"
                              />
                              <input
                                type="text"
                                placeholder="Value"
                                value={pr.value}
                                onChange={(e) => {
                                  const next = [...prodProperties];
                                  next[idx] = { ...next[idx], value: e.target.value };
                                  setProdProperties(next);
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25"
                              />
                              <button
                                type="button"
                                onClick={() => setProdProperties(prodProperties.filter((_, i) => i !== idx))}
                                title="Remove property"
                                aria-label="Remove property"
                                className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-800"
                              >
                                <FiTrash2 size={18} aria-hidden />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <select
                        value={prodParentId}
                        onChange={(e) => {
                          setProdParentId(e.target.value);
                          setProdCategoryId("");
                          setProdSubcategory("");
                        }}
                        className={selectClass}
                      >
                        <option value="">Select parent category</option>
                        {parentCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={prodCategoryId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setProdCategoryId(id);
                          const sub = subCategories.find((c) => String(c.id) === id);
                          if (sub) setProdSubcategory(sub.name);
                        }}
                        className={selectClass}
                        disabled={!prodParentId}
                      >
                        <option value="">Select subcategory</option>
                        {subCategoriesForParent.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={prodPricingMode}
                        onChange={(e) => {
                          const v = e.target.value as "" | "fixed" | "area";
                          if (prodGraphicScenarioEnabled && v === "area") return;
                          setProdPricingMode(v);
                          if (v === "fixed") setProdPricePerSqft("");
                          if (v === "area") setProdPrice("");
                        }}
                        className={selectClass}
                        aria-label="Price type"
                      >
                        <option value="" disabled hidden>
                          Price type
                        </option>
                        <option value="fixed">fixed</option>
                        <option value="area" disabled={prodGraphicScenarioEnabled}>
                          per square feet
                        </option>
                      </select>
                      {prodGraphicScenarioEnabled ? (
                        <p className="text-xs text-slate-500">
                          Hardware mode is enabled from Product Modifiers. Price type stays fixed-only.
                        </p>
                      ) : null}
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Price"
                        value={prodPrice}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isFloatInput(v)) setProdPrice(v);
                        }}
                        className={inputClassDisabled}
                        disabled={prodPricingMode === "" || prodPricingMode === "area"}
                        title={
                          prodPricingMode === ""
                            ? "Select price type first"
                            : prodPricingMode === "area"
                              ? "Not used for per square foot pricing"
                            : undefined
                        }
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Price per sq ft"
                        value={prodPricePerSqft}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isFloatInput(v)) setProdPricePerSqft(v);
                        }}
                        className={inputClassDisabled}
                        disabled={prodPricingMode === "" || prodPricingMode === "fixed"}
                        title={
                          prodPricingMode === ""
                            ? "Select price type first"
                            : prodPricingMode === "fixed"
                              ? "Not used for fixed pricing"
                            : undefined
                        }
                      />
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Min charge"
                        value={prodMinCharge}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isFloatInput(v)) setProdMinCharge(v);
                        }}
                        className={inputClass}
                      />
                      {!prodGraphicScenarioEnabled ? (
                        <>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Weight (kg)"
                            value={prodWeight}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isFloatInput(v)) setProdWeight(v);
                            }}
                            className={inputClass}
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Length (inch)"
                            value={prodLength}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isFloatInput(v)) setProdLength(v);
                            }}
                            className={inputClass}
                          />
                        </>
                      ) : null}
                      <input
                        type="text"
                        placeholder="Material"
                        value={prodMaterial}
                        onChange={(e) => setProdMaterial(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Production time (e.g. business days)"
                        value={prodProductionTime}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (isNonNegativeIntInput(v)) setProdProductionTime(v);
                        }}
                        className={inputClass}
                      />
                      {!prodGraphicScenarioEnabled ? (
                        <>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Min width (inches)"
                            value={prodMinWidth}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isFloatInput(v)) setProdMinWidth(v);
                            }}
                            className={inputClass}
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Max width (inches)"
                            value={prodMaxWidth}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isFloatInput(v)) setProdMaxWidth(v);
                            }}
                            className={inputClass}
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Min height (inches)"
                            value={prodMinHeight}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isFloatInput(v)) setProdMinHeight(v);
                            }}
                            className={inputClass}
                          />
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Max height (inches)"
                            value={prodMaxHeight}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (isFloatInput(v)) setProdMaxHeight(v);
                            }}
                            className={inputClass}
                          />
                        </>
                      ) : null}
                      <input
                        type="text"
                        placeholder="SKU"
                        value={prodSku}
                        onChange={(e) => setProdSku(e.target.value)}
                        className={inputClass}
                      />
                      {prodGraphicScenarioEnabled ? (
                        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="mb-3 text-sm font-medium text-slate-700">Fedex shipping data</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Length (inch)"
                                value={prodShippingLength}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (isFloatInput(v)) {
                                    setProdShippingLength(v);
                                    setFedexShippingFieldErrors((prev) => ({ ...prev, length: undefined }));
                                  }
                                }}
                                className={inputClass}
                                aria-invalid={!!fedexShippingFieldErrors.length}
                              />
                              {fedexShippingFieldErrors.length ? (
                                <p className="mt-1 text-xs font-medium text-rose-600">{fedexShippingFieldErrors.length}</p>
                              ) : null}
                            </div>
                            <div>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Width (inch)"
                                value={prodShippingWidth}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (isFloatInput(v)) {
                                    setProdShippingWidth(v);
                                    setFedexShippingFieldErrors((prev) => ({ ...prev, width: undefined }));
                                  }
                                }}
                                className={inputClass}
                                aria-invalid={!!fedexShippingFieldErrors.width}
                              />
                              {fedexShippingFieldErrors.width ? (
                                <p className="mt-1 text-xs font-medium text-rose-600">{fedexShippingFieldErrors.width}</p>
                              ) : null}
                            </div>
                            <div>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Height (inch)"
                                value={prodShippingHeight}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (isFloatInput(v)) {
                                    setProdShippingHeight(v);
                                    setFedexShippingFieldErrors((prev) => ({ ...prev, height: undefined }));
                                  }
                                }}
                                className={inputClass}
                                aria-invalid={!!fedexShippingFieldErrors.height}
                              />
                              {fedexShippingFieldErrors.height ? (
                                <p className="mt-1 text-xs font-medium text-rose-600">{fedexShippingFieldErrors.height}</p>
                              ) : null}
                            </div>
                            <div>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="Weight (kg)"
                                value={prodShippingWeight}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (isFloatInput(v)) {
                                    setProdShippingWeight(v);
                                    setFedexShippingFieldErrors((prev) => ({ ...prev, weight: undefined }));
                                  }
                                }}
                                className={inputClass}
                                aria-invalid={!!fedexShippingFieldErrors.weight}
                              />
                              {fedexShippingFieldErrors.weight ? (
                                <p className="mt-1 text-xs font-medium text-rose-600">{fedexShippingFieldErrors.weight}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-slate-700">Product Modifiers</p>
                          <div className="ml-auto inline-flex overflow-hidden rounded border border-slate-200">
                            <button
                              type="button"
                              className={`px-3 py-1.5 text-xs font-medium ${
                                prodPurchaseOptions.length === 0 && !prodGraphicScenarioEnabled
                                  ? "bg-slate-900 text-white"
                                  : "bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                              onClick={() => {
                                setProdGraphicScenarioEnabled(false);
                                setProdPurchaseOptions([]);
                                setSelectedHardwareTemplateId("");
                                setListingPriceOptionKey("");
                                setListingPriceUseComputed(false);
                                setFedexShippingFieldErrors({});
                                setProdModifierAssignments((prev) => {
                                  const next: Record<string, ProductModifierAssignment> = {};
                                  for (const [k, v] of Object.entries(prev)) {
                                    next[k] = { ...v, mode_scope: "all" };
                                  }
                                  return next;
                                });
                              }}
                            >
                              Simple modifiers
                            </button>
                            <button
                              type="button"
                              className={`border-l border-slate-200 px-3 py-1.5 text-xs font-medium ${
                                prodPurchaseOptions.length > 0 || prodGraphicScenarioEnabled
                                  ? "bg-slate-900 text-white"
                                  : "bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                              onClick={() => {
                                setProdGraphicScenarioEnabled(true);
                                setProdPricingMode("fixed");
                                setProdPricePerSqft("");
                                setProdMinWidth("");
                                setProdMaxWidth("");
                                setProdMinHeight("");
                                setProdMaxHeight("");
                                setProdPurchaseOptions([]);
                                setProdModifierAssignments({});
                                setProdConditionalRules([]);
                                setSelectedModifierKey("");
                                setSelectedPresetDropdownValue("");
                                setSelectedHardwareTemplateId("");
                                setListingPriceOptionKey("");
                                setListingPriceUseComputed(false);
                                setFedexShippingFieldErrors({});
                              }}
                            >
                              Hardware
                            </button>
                          </div>
                        </div>
                        {prodGraphicScenarioEnabled && (
                          <div className="mb-3 flex items-center gap-2">
                            <ThemedDropdown
                              value={selectedHardwareTemplateId}
                              onChange={(nextId) => {
                                setSelectedHardwareTemplateId(nextId);
                                if (!nextId) {
                                  setProdPurchaseOptions([]);
                                  setProdModifierAssignments({});
                                  setProdConditionalRules([]);
                                  setSelectedPresetDropdownValue("");
                                  setListingPriceOptionKey("");
                                  setListingPriceUseComputed(false);
                                  return;
                                }
                                const template = hardwareTemplates.find((t) => String(t.id) === nextId);
                                if (!template) return;
                                applyHardwareTemplate(template);
                              }}
                              placeholder="Select hardware template"
                              options={hardwareTemplates.map((t) => ({
                                value: String(t.id),
                                label: t.name,
                              }))}
                              className="min-w-[280px] w-full sm:w-auto"
                            />
                          </div>
                        )}
                        {/* Purchase Options editor */}
                        {prodGraphicScenarioEnabled && prodPurchaseOptions.length > 0 && (
                          <div className="mb-3 rounded border border-slate-200 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hardware Options</p>
                            </div>
                            <div className="space-y-2">
                              {purchaseOptionsForView.map((opt, idx) => {
                                const optKey = String(opt.option_key || `option_${idx + 1}`).trim().toLowerCase();
                                const isListingPrice = listingPriceOptionKey === optKey;
                                const basePrice = Number(opt.unit_price || 0);
                                const previewPrice = optionPreviewPrices[optKey] ?? basePrice;
                                const hasModifiers = Math.abs(previewPrice - basePrice) > 0.001;
                                return (
                                  <div key={idx} className="rounded border border-slate-200 bg-white/70 p-2 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="w-5 text-xs text-slate-400 shrink-0">{idx + 1}.</span>
                                      <input
                                        type="text"
                                        placeholder="Label (e.g. Flag Only)"
                                        className="flex-1 min-w-[140px] rounded border border-slate-200 bg-slate-100 px-2 py-1 text-sm text-slate-700"
                                        value={opt.label}
                                        readOnly
                                      />
                                      <div className="flex items-center gap-1 text-xs text-slate-600">
                                        <span className="text-slate-400">Base:</span>
                                        <span className="font-semibold text-slate-800">
                                          ${formatOptionPrice(opt.pricing_mode === "area" ? opt.price_per_sqft : opt.unit_price)}
                                        </span>
                                      </div>
                                      {hasModifiers && (
                                        <div className="flex items-center gap-1 text-xs">
                                          <span className="text-slate-400">With modifiers:</span>
                                          <span className="font-semibold text-emerald-700">${formatOptionPrice(previewPrice)}</span>
                                        </div>
                                      )}
                                      <label className="flex cursor-pointer items-center gap-1 text-xs text-slate-600">
                                        <input
                                          type="radio"
                                          name="purchase-option-default"
                                          checked={!!opt.is_default}
                                          onChange={() => {
                                            setProdPurchaseOptions((prev) =>
                                              prev.map((o, i) => ({ ...o, is_default: i === idx }))
                                            );
                                          }}
                                        />
                                        Default
                                      </label>
                                      <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-sky-700">
                                        <input
                                          type="radio"
                                          name="purchase-option-listing"
                                          checked={isListingPrice}
                                          onChange={() => setListingPriceOptionKey(optKey)}
                                        />
                                        Show on listing
                                      </label>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Listing price type toggle — only shown when a listing option is selected */}
                            {listingPriceOptionKey && (() => {
                              const listingOpt = prodPurchaseOptions.find(
                                (o) => String(o.option_key || "").trim().toLowerCase() === listingPriceOptionKey
                              );
                              const optKey = listingPriceOptionKey;
                              const base = Number(listingOpt?.unit_price || 0);
                              const computed = optionPreviewPrices[optKey] ?? base;
                              const hasModifiers = Math.abs(computed - base) > 0.001;
                              return (
                                <div className="mt-2 rounded border border-sky-100 bg-sky-50 p-2 text-xs">
                                  <p className="mb-1.5 font-semibold text-sky-800">Product listing card will show:</p>
                                  <div className="flex flex-wrap gap-3">
                                    <label className="flex cursor-pointer items-center gap-1.5 text-slate-700">
                                      <input
                                        type="radio"
                                        name="listing-price-type"
                                        checked={!listingPriceUseComputed}
                                        onChange={() => setListingPriceUseComputed(false)}
                                      />
                                      <span>Base price <strong>${formatOptionPrice(base)}</strong></span>
                                    </label>
                                    <label className={`flex cursor-pointer items-center gap-1.5 ${hasModifiers ? "text-slate-700" : "text-slate-400"}`}>
                                      <input
                                        type="radio"
                                        name="listing-price-type"
                                        checked={listingPriceUseComputed}
                                        onChange={() => setListingPriceUseComputed(true)}
                                        disabled={!hasModifiers}
                                      />
                                      <span>
                                        With modifiers <strong>${formatOptionPrice(computed)}</strong>
                                        {!hasModifiers && <span className="ml-1 text-slate-400">(no modifiers yet)</span>}
                                      </span>
                                    </label>
                                  </div>
                                </div>
                              );
                            })()}
                            {/* Quick visibility map so admin can distinguish option-wise modifiers */}
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {purchaseOptionsForView.map((opt, idx) => {
                                const key = String(opt.option_key || `option_${idx + 1}`).trim().toLowerCase();
                                const scoped = Object.values(prodModifierAssignments).filter((a) => {
                                  const scope = String(a.mode_scope || "all").trim().toLowerCase();
                                  return scope === "all" || scope === key;
                                });
                                return (
                                  <div key={`scope-map-${key}`} className="rounded border border-slate-200 bg-white p-2">
                                    <p className="text-xs font-semibold text-slate-700">
                                      {opt.label || `Option ${idx + 1}`} modifiers
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {scoped.length > 0
                                        ? scoped.map((g) => g.key).join(", ")
                                        : "No modifiers assigned"}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {modifierCatalog.length === 0 ? (
                          <p className="text-xs text-slate-500">No modifiers in catalog yet. Create them in Admin &gt; Modifiers.</p>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {!prodGraphicScenarioEnabled && modifierPresets.length > 0 ? (
                                <ThemedDropdown
                                  key="modifier-preset-apply"
                                  value={selectedPresetDropdownValue}
                                  onChange={(v) => {
                                    setSelectedPresetDropdownValue(v);
                                    applyModifierPresetFromId(parsePresetIdFromDropdownValue(v));
                                  }}
                                  placeholder="Apply modifier preset"
                                  options={modifierPresets.map((p) => ({
                                    value: presetDropdownOptionValue(p.id),
                                    label: p.name,
                                  }))}
                                  className="min-w-[220px] w-full sm:min-w-[200px] sm:w-auto"
                                />
                              ) : null}
                              <ThemedDropdown
                                key="modifier-group-add"
                                value={selectedModifierKey}
                                onChange={(nextKey) => setSelectedModifierKey(nextKey)}
                                placeholder="Add Modifier"
                                options={modifierCatalog
                                  .filter((g) => !prodModifierAssignments[g.key])
                                  .map((g) => ({
                                    value: g.key,
                                    label: `${g.name} (${g.key})`,
                                  }))}
                                className="min-w-[280px] w-full sm:w-auto"
                              />
                              <button
                                type="button"
                                className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                                disabled={!selectedModifierKey}
                                onClick={() => {
                                  const group = modifierCatalog.find((g) => g.key === selectedModifierKey);
                                  if (!group) return;
                                  setProdModifierAssignments((prev) => ({
                                    ...prev,
                                    [group.key]: assignmentFromCatalogGroup(group, Object.keys(prev).length),
                                  }));
                                  setSelectedModifierKey("");
                                }}
                              >
                                Add
                              </button>
                            </div>
                            {modifierCatalog.filter((g) => !!prodModifierAssignments[g.key]).map((group) => {
                              const assigned = prodModifierAssignments[group.key];
                              if (!assigned) return null;
                              return (
                                <div key={group.key} className="rounded border border-slate-200 p-2">
                                  <label className="mb-2 flex items-center justify-between gap-2 text-sm font-medium">
                                    {group.name} ({group.key})
                                    <button
                                      type="button"
                                      className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                                      onClick={() =>
                                        setProdModifierAssignments((prev) => {
                                          const next = { ...prev };
                                          delete next[group.key];
                                          return next;
                                        })
                                      }
                                    >
                                      Remove
                                    </button>
                                  </label>
                                  {(prodPurchaseOptions.length > 0 || prodGraphicScenarioEnabled) ? (
                                    <p className="mb-2 text-[11px] text-slate-500">
                                      Current scope:{" "}
                                      <span className="font-medium text-slate-700">
                                        {(() => {
                                          const scope = String(assigned.mode_scope || "all");
                                          if (scope === "all") return "All options";
                                          const mapped = purchaseOptionsForView.find(
                                            (o) => String(o.option_key || "").trim().toLowerCase() === scope
                                          );
                                          return mapped?.label || scope;
                                        })()}
                                      </span>
                                    </p>
                                  ) : null}
                                  {(prodPurchaseOptions.length > 0 || prodGraphicScenarioEnabled) ? (
                                    <div className="mb-2 flex flex-wrap items-center gap-3">
                                      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                        Show for
                                      </label>
                                      <select
                                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                                        value={assigned.mode_scope || "all"}
                                        onChange={(e) => {
                                          const nextScope = e.target.value;
                                          setProdModifierAssignments((prev) => ({
                                            ...prev,
                                            [group.key]: {
                                              ...assigned,
                                              mode_scope: nextScope,
                                            },
                                          }));
                                        }}
                                      >
                                        <option value="all">All options</option>
                                        {prodPurchaseOptions.map((o) => (
                                          <option key={o.option_key} value={o.option_key}>
                                            {o.label || o.option_key}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : null}
                                  <div className="space-y-1">
                                    {(Array.isArray(group.options) ? group.options : []).map((opt, oi) => {
                                      const optId = opt.id != null ? Number(opt.id) : null;
                                      const optAssigned = assigned.options.find((x) =>
                                        optId != null ? Number(x.option_id) === optId : x.value === String(opt.value || "")
                                      );
                                      return (
                                        <div key={`${group.key}-${opt.id ?? oi}`} className="flex items-center gap-2 text-xs">
                                          <input
                                            type="checkbox"
                                            checked={!!optAssigned}
                                            onChange={(e) => {
                                              const checked = e.target.checked;
                                              setProdModifierAssignments((prev) => {
                                                const g = prev[group.key];
                                                if (!g) return prev;
                                                const without = g.options.filter((x) =>
                                                  optId != null ? Number(x.option_id) !== optId : x.value !== String(opt.value || "")
                                                );
                                                const nextOptions = checked
                                                  ? [...without, { option_id: optId != null ? optId : undefined, value: String(opt.value || ""), price_adjustment_override: null }]
                                                  : without;
                                                return { ...prev, [group.key]: { ...g, options: nextOptions } };
                                              });
                                            }}
                                          />
                                          <span className="min-w-[220px]">{opt.label}</span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            placeholder="override"
                                            className="w-24 rounded border border-slate-200 px-2 py-1"
                                            value={optAssigned?.price_adjustment_override == null ? "" : String(optAssigned.price_adjustment_override)}
                                            onChange={(e) =>
                                              setProdModifierAssignments((prev) => {
                                                const g = prev[group.key];
                                                if (!g) return prev;
                                                return {
                                                  ...prev,
                                                  [group.key]: {
                                                    ...g,
                                                    options: g.options.map((x) =>
                                                      (optId != null ? Number(x.option_id) === optId : x.value === String(opt.value || ""))
                                                        ? { ...x, price_adjustment_override: e.target.value === "" ? null : Number(e.target.value) }
                                                        : x
                                                    ),
                                                  },
                                                };
                                              })
                                            }
                                            disabled={!optAssigned}
                                          />
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Conditional Modifier Rules</p>
                            <p className="text-xs text-slate-500">Auto-select or disable a target option when a source option is selected.</p>
                          </div>
                          <button
                            type="button"
                            className="rounded bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                            disabled={assignedModifierGroups.length === 0}
                            onClick={() => {
                              const nextRule = createDefaultConditionalRule();
                              if (!nextRule) {
                                showMsg("error", "Add at least one modifier with options before creating rules.");
                                return;
                              }
                              setProdConditionalRules((prev) => [...prev, nextRule]);
                            }}
                          >
                            + Add Rule
                          </button>
                        </div>
                        {prodConditionalRules.length === 0 ? (
                          <p className="text-xs text-slate-400">No conditional rules yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {prodConditionalRules.map((rule, idx) => {
                              const hardwareKey = String(rule.hardware_option_key || "").trim().toLowerCase();
                              const visibleGroups = assignedModifierGroups.filter((g) =>
                                isModifierVisibleForHardwareKey(Number(g.id || 0), hardwareKey)
                              );
                              const sourceGroup = findModifierGroupById(rule.source_modifier_id);
                              const targetGroup = findModifierGroupById(rule.target_modifier_id);
                              const sourceOptions = Array.isArray(sourceGroup?.options) ? sourceGroup.options : [];
                              const targetOptions = Array.isArray(targetGroup?.options) ? targetGroup.options : [];
                              const hasSourceModifier = !!sourceGroup;
                              const hasTargetModifier = !!targetGroup;
                              const usedTargetModifierIdsForSameCondition = new Set(
                                rule.action_type === "auto_select"
                                  ? prodConditionalRules
                                      .filter((other, otherIdx) => {
                                        if (otherIdx === idx || other.action_type !== "auto_select") return false;
                                        const sameHardware =
                                          (String(other.hardware_option_key || "").trim().toLowerCase() || "all") ===
                                          (hardwareKey || "all");
                                        const sameSourceModifier =
                                          Number(other.source_modifier_id || 0) === Number(rule.source_modifier_id || 0);
                                        return (
                                          sameHardware &&
                                          sameSourceModifier &&
                                          Number(other.target_modifier_id || 0) > 0
                                        );
                                      })
                                      .map((other) => Number(other.target_modifier_id))
                                  : []
                              );
                              const targetModifierGroups = visibleGroups.filter(
                                (g) => !usedTargetModifierIdsForSameCondition.has(Number(g.id || 0))
                              );
                              const targetModifierValue = targetModifierGroups.some(
                                (g) => Number(g.id) === Number(rule.target_modifier_id || 0)
                              )
                                ? String(rule.target_modifier_id || "")
                                : "";
                              const updateRule = (patch: Partial<ConditionalRuleDraft>) => {
                                setProdConditionalRules((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
                                );
                              };
                              return (
                                <div key={`conditional-rule-${idx}`} className="rounded border border-slate-200 bg-slate-50 p-3">
                                  <div className="mb-3 flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rule {idx + 1}</span>
                                    <button
                                      type="button"
                                      className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                                      onClick={() => setProdConditionalRules((prev) => prev.filter((_, i) => i !== idx))}
                                    >
                                      Remove
                                    </button>
                                  </div>
                                  <div className="grid gap-3 md:grid-cols-6">
                                    {prodPurchaseOptions.length > 0 ? (
                                      <div className="md:col-span-2">
                                        <label className="mb-1 block text-xs font-medium text-slate-600">Applies to</label>
                                        <ThemedDropdown
                                          value={hardwareKey}
                                          placeholder="Both Hardware Options"
                                          options={[
                                            { value: "", label: "Both Hardware Options" },
                                            ...prodPurchaseOptions.map((o) => ({
                                              value: String(o.option_key || "").trim().toLowerCase(),
                                              label: o.label || o.option_key,
                                            })),
                                          ]}
                                          onChange={(value) => {
                                            const nextKey = value || null;
                                            updateRule({
                                              hardware_option_key: nextKey,
                                              hardware_option_id: null,
                                              source_modifier_id: 0,
                                              source_option_id: 0,
                                              target_modifier_id: 0,
                                              target_option_id: null,
                                            });
                                          }}
                                        />
                                      </div>
                                    ) : null}
                                    <div className="md:col-span-2">
                                      <label className="mb-1 block text-xs font-medium text-slate-600">WHEN MODIFIER</label>
                                      <ThemedDropdown
                                        value={String(rule.source_modifier_id || "")}
                                        placeholder="Select modifier"
                                        options={[
                                          { value: "", label: "Select modifier" },
                                          ...targetModifierGroups.map((g) => ({
                                            value: String(g.id),
                                            label: g.name,
                                          })),
                                        ]}
                                        onChange={(value) => {
                                          const group = findModifierGroupById(Number(value));
                                          updateRule({
                                            source_modifier_id: Number(group?.id || 0),
                                            source_option_id: null,
                                            target_modifier_id: 0,
                                            target_option_id: null,
                                          });
                                        }}
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="mb-1 block text-xs font-medium text-slate-600">OPTION</label>
                                      <ThemedDropdown
                                        value={String(rule.source_option_id || "")}
                                        placeholder="Any selected option"
                                        options={[
                                          { value: "", label: "Any selected option" },
                                          ...sourceOptions.map((o) => ({
                                            value: String(o.id),
                                            label: o.label || o.value,
                                          })),
                                        ]}
                                        onChange={(value) =>
                                          updateRule({
                                            source_option_id: value ? Number(value) : null,
                                            target_modifier_id: 0,
                                            target_option_id: null,
                                          })
                                        }
                                        disabled={!hasSourceModifier}
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="mb-1 block text-xs font-medium text-slate-600">THAN ACTION</label>
                                      <ThemedDropdown
                                        value={rule.action_type}
                                        placeholder="Auto-select option"
                                        options={[
                                          { value: "auto_select", label: "Auto-select" },
                                          { value: "disable", label: "Disable" },
                                        ]}
                                        onChange={(value) => updateRule({
                                          action_type: value === "disable" ? "disable" : "auto_select",
                                          target_option_id: null,
                                        })}
                                        disabled={!hasSourceModifier}
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="mb-1 block text-xs font-medium text-slate-600">TARGET MODIFIER</label>
                                      <ThemedDropdown
                                        value={targetModifierValue}
                                        placeholder="Select modifier"
                                        options={[
                                          { value: "", label: "Select modifier" },
                                          ...visibleGroups.map((g) => ({
                                            value: String(g.id),
                                            label: g.name,
                                          })),
                                        ]}
                                        onChange={(value) => {
                                          const group = findModifierGroupById(Number(value));
                                          updateRule({
                                            target_modifier_id: Number(group?.id || 0),
                                            target_option_id: null,
                                          });
                                        }}
                                        disabled={!hasSourceModifier}
                                      />
                                    </div>
                                    <div className="md:col-span-2">
                                      <label className="mb-1 block text-xs font-medium text-slate-600">TARGET OPTION</label>
                                      <ThemedDropdown
                                        value={String(rule.target_option_id || "")}
                                        placeholder={rule.action_type === "disable" ? "None - disable whole modifier" : "Select option"}
                                        options={[
                                          {
                                            value: "",
                                            label: rule.action_type === "disable" ? "None - disable whole modifier" : "Select option",
                                          },
                                          ...targetOptions.map((o) => ({
                                            value: String(o.id),
                                            label: o.label || o.value,
                                          })),
                                        ]}
                                        onChange={(value) => updateRule({ target_option_id: value ? Number(value) : null })}
                                        disabled={!hasTargetModifier}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2 space-y-2">
                          <p className="text-sm font-medium text-slate-700">Product photos</p>
                          <p className="text-xs text-slate-500">
                            Upload multiple images. The first photo is used on product listings and category grids; all photos appear on the product detail page.
                          </p>
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <label className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                              {uploadingImage ? "Uploading…" : "Add image files"}
                              <input
                                type="file"
                                multiple
                                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                                className="hidden"
                                disabled={uploadingImage}
                                onChange={handleProductImagesUpload}
                              />
                            </label>
                            <span className="shrink-0 text-sm text-slate-400">or add URL</span>
                            <input
                              type="text"
                              placeholder="https://… or /uploads/…"
                              value={prodImageUrlInput}
                              onChange={(e) => setProdImageUrlInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addGalleryUrlFromInput();
                                }
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25"
                            />
                            <button
                              type="button"
                              onClick={addGalleryUrlFromInput}
                              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                            >
                              Add URL
                            </button>
                          </div>
                          {prodGalleryUrls.length > 0 ? (
                            <ul className="mt-3 flex flex-wrap gap-3">
                              {prodGalleryUrls.map((url, idx) => (
                                <li
                                  key={`${url}-${idx}`}
                                  className="flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
                                >
                                  {isValidImageSrc(url) ? (
                                    <div className="relative h-20 w-20 overflow-hidden rounded-md border border-slate-100 bg-slate-100">
                                      <img
                                        src={getProductImageSrc(url)}
                                        alt=""
                                        width={80}
                                        height={80}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex h-20 w-20 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-500">Invalid</div>
                                  )}
                                  <span className="max-w-[7rem] truncate text-center text-[10px] font-medium text-sky-800">
                                    {idx === 0 ? "Listing image" : `Photo ${idx + 1}`}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      title="Move up"
                                      disabled={idx === 0}
                                      onClick={() => moveGallery(idx, -1)}
                                      className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                    >
                                      <FiChevronUp size={16} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      title="Move down"
                                      disabled={idx >= prodGalleryUrls.length - 1}
                                      onClick={() => moveGallery(idx, 1)}
                                      className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                                    >
                                      <FiChevronDown size={16} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      title="Remove"
                                      onClick={() => removeGalleryAt(idx)}
                                      className="rounded p-1 text-rose-600 hover:bg-rose-50"
                                    >
                                      <FiTrash2 size={16} aria-hidden />
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      <AdminRichTextField
                        label={`Spec${WORD_STYLE_LABEL_SUFFIX}`}
                        dataPlaceholder={`Enter spec (${RICH_PLACEHOLDER_HINT})...`}
                        editorRef={specEditorRef}
                        captureSelection={captureSpecSelection}
                        onBold={() => applySpecCommand("bold")}
                        onItalic={() => applySpecCommand("italic")}
                        onBulletList={() => insertSpecList(false)}
                        onNumberedList={() => insertSpecList(true)}
                        onInput={() => specEditorRef.current && setProdSpec(specEditorRef.current.innerHTML)}
                      />
                      <AdminRichTextField
                        label={`File Setup${WORD_STYLE_LABEL_SUFFIX}`}
                        dataPlaceholder={`Enter file setup (${RICH_PLACEHOLDER_HINT})...`}
                        editorRef={fileSetupEditorRef}
                        captureSelection={captureFileSetupSelection}
                        onBold={() => applyFileSetupCommand("bold")}
                        onItalic={() => applyFileSetupCommand("italic")}
                        onBulletList={() => insertFileSetupList(false)}
                        onNumberedList={() => insertFileSetupList(true)}
                        onInput={() =>
                          fileSetupEditorRef.current && setProdFileSetup(fileSetupEditorRef.current.innerHTML)
                        }
                      />
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Installation Guide
                        </label>
                        <textarea
                          rows={4}
                          placeholder="Enter installation guide"
                          value={prodInstallationGuide}
                          onChange={(e) => setProdInstallationGuide(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                          <label className="block text-sm font-medium text-slate-700">
                            Product Highlights
                          </label>
                          <button
                            type="button"
                            onClick={() => setProdHighlights([...prodHighlights, ""])}
                            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                          >
                            + Add highlight
                          </button>
                        </div>
                        {prodHighlights.length === 0 && (
                          <p className="text-xs text-slate-400">No highlights yet. Each highlight appears as one bullet point under the product image.</p>
                        )}
                        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                          {prodHighlights.map((h, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => {
                                  const next = [...prodHighlights];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  setProdHighlights(next);
                                }}
                                title="Move up"
                                aria-label="Move up"
                                className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                              >
                                <FiChevronUp size={16} aria-hidden />
                              </button>
                              <button
                                type="button"
                                disabled={idx === prodHighlights.length - 1}
                                onClick={() => {
                                  const next = [...prodHighlights];
                                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                  setProdHighlights(next);
                                }}
                                title="Move down"
                                aria-label="Move down"
                                className="inline-flex shrink-0 items-center justify-center rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-30"
                              >
                                <FiChevronDown size={16} aria-hidden />
                              </button>
                              <input
                                type="text"
                                placeholder={`Highlight ${idx + 1}`}
                                value={h}
                                onChange={(e) => {
                                  const next = [...prodHighlights];
                                  next[idx] = e.target.value;
                                  setProdHighlights(next);
                                }}
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25"
                              />
                              <button
                                type="button"
                                onClick={() => setProdHighlights(prodHighlights.filter((_, i) => i !== idx))}
                                title="Remove highlight"
                                aria-label="Remove highlight"
                                className="inline-flex shrink-0 items-center justify-center rounded-lg p-2 text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-800"
                              >
                                <FiTrash2 size={18} aria-hidden />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                          <label className="block text-sm font-medium text-slate-700">
                            FAQ
                          </label>
                          <button
                            type="button"
                            onClick={() => setProdFaq([...prodFaq, { question: "", answer: "" }])}
                            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                          >
                            + Add FAQ
                          </button>
                        </div>
                        <div className="space-y-3">
                          {prodFaq.map((item, idx) => (
                            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                              <div className="mb-2 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setProdFaq(prodFaq.filter((_, i) => i !== idx))}
                                  title="Remove FAQ"
                                  className="inline-flex items-center justify-center rounded-lg p-2 text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-800"
                                >
                                  <FiTrash2 size={18} aria-hidden />
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="Question"
                                value={item.question}
                                onChange={(e) => {
                                  const next = [...prodFaq];
                                  next[idx] = { ...next[idx], question: e.target.value };
                                  setProdFaq(next);
                                }}
                                className={`${inputClass} mb-2`}
                              />
                              <textarea
                                rows={3}
                                placeholder="Answer"
                                value={item.answer}
                                onChange={(e) => {
                                  const next = [...prodFaq];
                                  next[idx] = { ...next[idx], answer: e.target.value };
                                  setProdFaq(next);
                                }}
                                className={inputClass}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      {/* <div className="flex items-center gap-6">
                        <label className="group flex cursor-pointer items-center gap-2 text-sm text-slate-700 transition-colors">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={prodIsNew}
                              onChange={(e) => setProdIsNew(e.target.checked)}
                            />
                            <div className="h-4 w-4 rounded border border-slate-300 bg-white transition-all peer-checked:border-sky-500 peer-checked:bg-sky-500 group-hover:border-sky-400"></div>
                            <svg className="absolute h-3 w-3 text-white opacity-0 transition-all peer-checked:opacity-100 peer-checked:scale-100 scale-50 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          New
                        </label>
                        <label className="group flex cursor-pointer items-center gap-2 text-sm text-slate-700 transition-colors">
                          <div className="relative flex items-center justify-center">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={prodIsActive}
                              onChange={(e) => setProdIsActive(e.target.checked)}
                            />
                            <div className="h-4 w-4 rounded border border-slate-300 bg-white transition-all peer-checked:border-sky-500 peer-checked:bg-sky-500 group-hover:border-sky-400"></div>
                            <svg className="absolute h-3 w-3 text-white opacity-0 transition-all peer-checked:opacity-100 peer-checked:scale-100 scale-50 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          Activesss
                        </label>
                      </div> */}
                      <div className="flex gap-2 md:col-span-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : editingProductId ? "Update" : "Add Product"}
                        </button>
                        {editingProductId && (
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                      <table className="w-full min-w-[880px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">Image</th>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Price</th>
                            <th className="px-4 py-3">Active</th>
                            <th className="px-4 py-3">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {products.map((p) => {
                            const descPlain = descriptionPreview(p.description);
                            const listImg = primaryProductListImage(p);
                            return (
                            <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                {listImg && isValidImageSrc(listImg) ? (
                                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                    <img
                                      src={getProductImageSrc(listImg)}
                                      alt=""
                                      width={40}
                                      height={40}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                              <td className="px-4 py-3 max-w-[min(28rem,40vw)] text-slate-600">
                                {descPlain ? (
                                  <span className="line-clamp-2 text-sm [overflow-wrap:anywhere]" title={descPlain}>
                                    {descPlain}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {p.category_name || "—"} {p.subcategory ? ` / ${p.subcategory}` : ""}
                              </td>
                              <td className="px-4 py-3 text-slate-700">{p.price != null ? `$${p.price}` : "—"}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-medium ${
                                    p.is_active ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80" : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
                                  }`}
                                >
                                  {p.is_active ? "Yes" : "No"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEditProduct(p)}
                                    className="font-medium text-sky-600 hover:text-sky-800"
                                    title="Edit"
                                  >
                                    <FiEdit size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setProductDeleteTarget({ id: p.id, name: p.name })}
                                    disabled={deletingProductId === p.id}
                                    className="font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deletingProductId === p.id ? (
                                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" />
                                    ) : (
                                      <FiTrash2 size={18} />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {productsPagination.pages > 1 && (
                      <div className="flex flex-col gap-3 border-t border-slate-100 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-600">
                          Showing {(productsPage - 1) * productsPerPage + 1}–
                          {Math.min(productsPage * productsPerPage, productsPagination.total)} of {productsPagination.total}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => loadProducts(productsPage - 1)}
                            disabled={productsPage <= 1}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Previous
                          </button>
                          {Array.from({ length: Math.min(5, productsPagination.pages) }, (_, i) => {
                            let pageNum: number;
                            if (productsPagination.pages <= 5) pageNum = i + 1;
                            else if (productsPage <= 3) pageNum = i + 1;
                            else if (productsPage >= productsPagination.pages - 2) pageNum = productsPagination.pages - 4 + i;
                            else pageNum = productsPage - 2 + i;
                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => loadProducts(pageNum)}
                                className={`min-w-[2.25rem] rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                                  productsPage === pageNum
                                    ? "border-slate-700 bg-slate-700 text-white shadow-sm"
                                    : "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => loadProducts(productsPage + 1)}
                            disabled={productsPage >= productsPagination.pages}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Categories tab */}
                {activeTab === "categories" && (
                  <div className="space-y-6">
                    <form
                      ref={categoryFormRef}
                      onSubmit={handleCategorySubmit}
                      className="max-w-md space-y-3 rounded-xl border border-slate-200/60 bg-slate-50/80 p-5"
                    >
                      <h3 className="font-semibold text-slate-900">{editingCategoryId ? "Edit Category" : "Add Category"}</h3>
                      <input
                        type="text"
                        placeholder="Name *"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        placeholder="Slug (optional)"
                        value={catSlug}
                        onChange={(e) => setCatSlug(e.target.value)}
                        className={inputClass}
                      />
                      <textarea
                        placeholder="Description"
                        value={catDescription}
                        onChange={(e) => setCatDescription(e.target.value)}
                        rows={2}
                        className={inputClass}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : editingCategoryId ? "Update" : "Add Category"}
                        </button>
                        {editingCategoryId && (
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Slug</th>
                            <th className="px-4 py-3">Products</th>
                            <th className="px-4 py-3">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parentCategories.map((c) => {
                            const descPlain = descriptionPreview(c.description);
                            return (
                            <tr key={c.id} className="hover:bg-slate-50/80">
                              <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                              <td className="px-4 py-3 max-w-[min(24rem,35vw)] text-slate-600">
                                {descPlain ? (
                                  <span className="line-clamp-2 text-sm [overflow-wrap:anywhere]" title={descPlain}>
                                    {descPlain}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{c.slug}</td>
                              <td className="px-4 py-3 text-slate-600">{c.product_count}</td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => startEditCategory(c)}
                                  className="mr-3 font-medium text-sky-600 hover:text-sky-800"
                                  title="Edit"
                                >
                                  <FiEdit size={18} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCategoryDelete(c.id, c.name)}
                                  disabled={deletingCategoryId === c.id}
                                  className="font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50"
                                  title="Delete"
                                >
                                  {deletingCategoryId === c.id ? (
                                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" />
                                    ) : (
                                      <FiTrash2 size={18} />
                                    )}
                                </button>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subcategories tab */}
                {activeTab === "subcategories" && (
                  <div className="space-y-6">
                    <form
                      ref={categoryFormRef}
                      onSubmit={handleCategorySubmit}
                      className="max-w-md space-y-3 rounded-xl border border-slate-200/60 bg-slate-50/80 p-5"
                    >
                      <h3 className="font-semibold text-slate-900">{editingCategoryId ? "Edit Subcategory" : "Add Subcategory"}</h3>
                      <select
                        value={catParentId}
                        onChange={(e) => setCatParentId(e.target.value)}
                        className={selectClass}
                      >
                        <option value="">Select parent category *</option>
                        {parentCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Subcategory name *"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="text"
                        placeholder="Slug (optional)"
                        value={catSlug}
                        onChange={(e) => setCatSlug(e.target.value)}
                        className={inputClass}
                      />
                      <textarea
                        placeholder="Description"
                        value={catDescription}
                        onChange={(e) => setCatDescription(e.target.value)}
                        rows={2}
                        className={inputClass}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : editingCategoryId ? "Update" : "Add Subcategory"}
                        </button>
                        {editingCategoryId && (
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                    <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                      <table className="w-full min-w-[800px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Parent</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Products</th>
                            <th className="px-4 py-3">Slug</th>
                            <th className="px-4 py-3">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {subCategories.map((c) => {
                            const parent = categories.find((x) => x.id === c.parent_id);
                            const descPlain = descriptionPreview(c.description);
                            return (
                              <tr key={c.id} className="hover:bg-slate-50/80">
                                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                                <td className="px-4 py-3 text-slate-600">{parent?.name || "—"}</td>
                                <td className="px-4 py-3 max-w-[min(24rem,35vw)] text-slate-600">
                                  {descPlain ? (
                                    <span className="line-clamp-2 text-sm [overflow-wrap:anywhere]" title={descPlain}>
                                      {descPlain}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-slate-600">{c.product_count}</td>
                                <td className="px-4 py-3 text-slate-600">{c.slug}</td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => startEditCategory(c)}
                                    className="mr-3 font-medium text-sky-600 hover:text-sky-800"
                                    title="Edit"
                                  >
                                    <FiEdit size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCategoryDelete(c.id, c.name)}
                                    disabled={deletingCategoryId === c.id}
                                    className="font-medium text-rose-600 hover:text-rose-800 disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {deletingCategoryId === c.id ? (
                                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" />
                                    ) : (
                                      <FiTrash2 size={18} />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {subCategories.length === 0 && (
                      <p className="text-sm text-slate-500">
                        No subcategories yet. Add one using the form above (select a parent category).
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
        </div>
      </div>
      {productDeleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-product-modal-title"
          onClick={() => {
            if (deletingProductId == null) setProductDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-product-modal-title" className="text-lg font-semibold text-slate-900">
              Delete product?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to delete <span className="font-medium text-slate-900">{productDeleteTarget.name}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setProductDeleteTarget(null)}
                disabled={deletingProductId != null}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleProductDelete(productDeleteTarget.id)}
                disabled={deletingProductId != null}
                className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingProductId === productDeleteTarget.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminNavbar>
  );
}

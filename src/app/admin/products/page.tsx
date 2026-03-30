"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { getProductImageUrl, productsAPI } from "../../../utils/api";
import { FiEdit, FiTrash2 } from "react-icons/fi";

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

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category_id: number | null;
  category_name?: string;
  category_slug?: string;
  subcategory: string | null;
  price: number | null;
  price_per_sqft: number | null;
  min_charge: number | null;
  material: string | null;
  image_url: string | null;
  is_new: boolean;
  is_active: boolean;
  sku: string | null;
  properties?: ProductProperty[] | null;
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
  const [prodParentId, setProdParentId] = useState<string>("");
  const [prodCategoryId, setProdCategoryId] = useState<string>("");
  const [prodSubcategory, setProdSubcategory] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodPricePerSqft, setProdPricePerSqft] = useState("");
  const [prodMinCharge, setProdMinCharge] = useState("");
  const [prodMaterial, setProdMaterial] = useState("");
  const [prodImageUrl, setProdImageUrl] = useState("");
  const [prodSku, setProdSku] = useState("");
  const [prodIsNew, setProdIsNew] = useState(false);
  const [prodIsActive, setProdIsActive] = useState(true);
  const [prodProperties, setProdProperties] = useState<ProductProperty[]>([]);
  const descEditorRef = useRef<HTMLDivElement>(null);
  /** Saved so toolbar clicks don’t lose the caret before execCommand / list insertion. */
  const descLastRangeRef = useRef<Range | null>(null);

  const captureDescSelection = useCallback(() => {
    const el = descEditorRef.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!el.contains(r.commonAncestorContainer)) return;
    descLastRangeRef.current = r.cloneRange();
  }, []);

  const applyDescCommand = useCallback(
    (command: string) => {
      const el = descEditorRef.current;
      if (!el) return;
      el.focus();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        const saved = descLastRangeRef.current;
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
      captureDescSelection();
      setProdDescription(el.innerHTML);
    },
    [captureDescSelection]
  );

  /** Inserts real <ul>/<ol> — browser execCommand for lists is unreliable in contenteditable. */
  const insertDescList = useCallback(
    (ordered: boolean) => {
      const el = descEditorRef.current;
      if (!el) return;
      el.focus();

      const sel = window.getSelection();
      if (!sel) return;

      const restoreCaret = () => {
        sel.removeAllRanges();
        const saved = descLastRangeRef.current;
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

      descLastRangeRef.current = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      setProdDescription(el.innerHTML);
    },
    []
  );

  useEffect(() => {
    const onSelectionChange = () => {
      if (document.activeElement !== descEditorRef.current) return;
      captureDescSelection();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [captureDescSelection]);

  const productFormRef = useRef<HTMLFormElement>(null);
  const categoryFormRef = useRef<HTMLFormElement>(null);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [productsPage, setProductsPage] = useState(1);
  const [productsPerPage] = useState(10);
  const [productsPagination, setProductsPagination] = useState({ total: 0, pages: 0 });

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
    return u.length > 0 && (u.startsWith("http") || u.startsWith("/"));
  };

  const handleProductDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete product "${name}"? This cannot be undone.`)) return;
    setDeletingProductId(id);
    try {
      await productsAPI.delete(String(id));
      showMsg("success", "Product deleted.");
      if (editingProductId === id) cancelEdit();
      await loadProducts();
      await loadCategories();
    } catch (err: unknown) {
      showMsg("error", err instanceof Error ? err.message : "Failed to delete product");
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showMsg("error", "Please select an image file (JPEG, PNG, GIF, WebP).");
      return;
    }
    setUploadingImage(true);
    try {
      const res = await productsAPI.uploadImage(file);
      if (res?.url) {
        setProdImageUrl(res.url);
        showMsg("success", "Image uploaded.");
      }
    } catch (err: unknown) {
      showMsg("error", err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
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

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await Promise.all([loadCategories(), loadProducts()]);
      setLoading(false);
    };
    run();
  }, []);

  const parentCategories = categories.filter((c) => !c.parent_id);
  const subCategories = categories.filter((c) => c.parent_id != null);
  const subCategoriesForParent = subCategories.filter(
    (c) => prodParentId !== "" && c.parent_id === parseInt(prodParentId)
  );

  const showMsg = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
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
    setSaving(true);
    try {
      const payload = {
        name: prodName.trim(),
        slug: prodSlug.trim() || undefined,
        description: prodDescription.trim() || undefined,
        category_id: prodCategoryId === "" ? null : parseInt(prodCategoryId),
        subcategory: prodSubcategory.trim() || undefined,
        price: prodPrice === "" ? null : parseFloat(prodPrice),
        price_per_sqft: prodPricePerSqft === "" ? null : parseFloat(prodPricePerSqft),
        min_charge: prodMinCharge === "" ? null : parseFloat(prodMinCharge),
        material: prodMaterial.trim() || undefined,
        image_url: prodImageUrl.trim() || undefined,
        sku: prodSku.trim() || undefined,
        is_new: prodIsNew,
        is_active: prodIsActive,
        properties: prodProperties.filter((pr) => pr.key.trim() || pr.value.trim()).map((pr) => ({ key: pr.key.trim(), value: pr.value.trim() })),
      };
      if (editingProductId) {
        await productsAPI.update(String(editingProductId), payload);
        showMsg("success", "Product updated.");
      } else {
        await productsAPI.create(payload);
        showMsg("success", "Product added.");
      }
      setProdName("");
      setProdSlug("");
      setProdDescription("");
      setProdParentId("");
      setProdCategoryId("");
      setProdSubcategory("");
      setProdPrice("");
      setProdPricePerSqft("");
      setProdMinCharge("");
      setProdMaterial("");
      setProdImageUrl("");
      setProdSku("");
      setProdIsNew(false);
      setProdIsActive(true);
      setProdProperties([]);
      setEditingProductId(null);
      if (descEditorRef.current) descEditorRef.current.innerHTML = "";
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

  const startEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdSlug(p.slug);
    setProdDescription(p.description || "");
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
    setProdPrice(p.price != null ? String(p.price) : "");
    setProdPricePerSqft(p.price_per_sqft != null ? String(p.price_per_sqft) : "");
    setProdMinCharge(p.min_charge != null ? String(p.min_charge) : "");
    setProdMaterial(p.material || "");
    setProdImageUrl(p.image_url || "");
    setProdSku(p.sku || "");
    setProdIsNew(p.is_new);
    setProdIsActive(p.is_active);
    setTimeout(() => {
      productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    setTimeout(() => {
      if (descEditorRef.current) descEditorRef.current.innerHTML = p.description || "";
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
    setProdParentId("");
    setProdCategoryId("");
    setProdSubcategory("");
    setProdPrice("");
    setProdPricePerSqft("");
    setProdMinCharge("");
    setProdMaterial("");
    setProdImageUrl("");
    setProdSku("");
    setProdIsNew(false);
    setProdIsActive(true);
    setProdProperties([]);
    if (descEditorRef.current) descEditorRef.current.innerHTML = "";
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25";
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
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-slate-700">
                          Description (Word-style formatting)
                        </label>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                          <div className="flex gap-1 rounded-t border-b border-slate-200 bg-slate-50 p-1">
                            <button
                              type="button"
                              title="Bold"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                applyDescCommand("bold");
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
                                applyDescCommand("italic");
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
                                insertDescList(false);
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
                                insertDescList(true);
                              }}
                              className="rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-200"
                            >
                              1. List
                            </button>
                          </div>
                          <div
                            ref={descEditorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onMouseUp={captureDescSelection}
                            onKeyUp={captureDescSelection}
                            onInput={() => descEditorRef.current && setProdDescription(descEditorRef.current.innerHTML)}
                            className="admin-product-desc-editor max-h-[200px] min-h-[100px] overflow-y-auto px-3 py-2 text-slate-900 focus:outline-none"
                            data-placeholder="Enter description (bold, italic, lists supported)..."
                            style={{ outline: "none" }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">Use toolbar for bold, italic, and lists. Shown on product page.</p>
                      </div>
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
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        className={inputClass}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price per sq ft"
                        value={prodPricePerSqft}
                        onChange={(e) => setProdPricePerSqft(e.target.value)}
                        className={inputClass}
                      />
                      <div className="md:col-span-2 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Min charge"
                          value={prodMinCharge}
                          onChange={(e) => setProdMinCharge(e.target.value)}
                          className={inputClass}
                        />
                        <input
                          type="text"
                          placeholder="Material"
                          value={prodMaterial}
                          onChange={(e) => setProdMaterial(e.target.value)}
                          className={inputClass}
                        />
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-700">Product image (file or URL)</p>
                        </div>
                        <div className="hidden min-h-[1.25rem] md:block" aria-hidden />
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <label className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                            {uploadingImage ? "Uploading…" : "Choose image file"}
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              className="hidden"
                              disabled={uploadingImage}
                              onChange={handleProductImageUpload}
                            />
                          </label>
                          <span className="shrink-0 text-sm text-slate-400">or</span>
                          <input
                            type="text"
                            placeholder="Image URL (e.g. /image.jpg)"
                            value={prodImageUrl}
                            onChange={(e) => setProdImageUrl(e.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="SKU"
                          value={prodSku}
                          onChange={(e) => setProdSku(e.target.value)}
                          className={`${inputClass} md:self-center`}
                        />
                        {prodImageUrl && isValidImageSrc(prodImageUrl) ? (
                          <>
                            <div className="h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                              <Image src={getProductImageSrc(prodImageUrl)} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized />
                            </div>
                            <div className="hidden md:block" aria-hidden />
                          </>
                        ) : null}
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
                            return (
                            <tr key={p.id} className="transition-colors hover:bg-slate-50/80">
                              <td className="px-4 py-3">
                                {p.image_url && isValidImageSrc(p.image_url) ? (
                                  <div className="h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                                    <Image src={getProductImageSrc(p.image_url)} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized />
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
                                    onClick={() => handleProductDelete(p.id, p.name)}
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
    </AdminNavbar>
  );
}

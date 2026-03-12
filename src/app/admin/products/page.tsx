"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { productsAPI } from "../../../utils/api";

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
    if (u.startsWith("/uploads/")) {
      const base = (typeof window !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined) || "http://localhost:5000/api";
      return (base.replace(/\/api\/?$/, "") || "http://localhost:5000") + u;
    }
    return u;
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

  return (
    <AdminNavbar title="Products">
      <div className="flex-1 p-6">
        <div className="mb-4">
          <Link href="/admin" className="text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
            ← Back to Orders
          </Link>
        </div>

        {message && (
          <div
            className={`mb-4 px-4 py-2 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200">
            {(["products", "categories", "subcategories"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-medium capitalize ${activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
              >
                {tab === "subcategories" ? "Subcategories" : tab === "products" ? "Products" : "Categories"}
              </button>
            ))}
          </div>

          <div className="p-6">
            {loading ? (
              <p className="text-gray-500">Loading…</p>
            ) : (
              <>
                {/* Products tab */}
                {activeTab === "products" && (
                  <div className="space-y-6">
                    <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <h3 className="md:col-span-2 font-semibold text-gray-800">
                        {editingProductId ? "Edit Product" : "Add Product"}
                      </h3>
                      <input
                        type="text"
                        placeholder="Product name *"
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Slug (optional)"
                        value={prodSlug}
                        onChange={(e) => setProdSlug(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded"
                      />
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description (Word-style formatting)</label>
                        <div className="border border-gray-300 rounded bg-white">
                          <div className="flex gap-1 p-1 border-b border-gray-200 bg-gray-50 rounded-t">
                            <button
                              type="button"
                              title="Bold"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                descEditorRef.current?.focus();
                                document.execCommand("bold");
                              }}
                              className="px-2 py-1 font-bold text-gray-700 hover:bg-gray-200 rounded text-sm"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              title="Italic"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                descEditorRef.current?.focus();
                                document.execCommand("italic");
                              }}
                              className="px-2 py-1 italic text-gray-700 hover:bg-gray-200 rounded text-sm"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              title="Bullet list"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                descEditorRef.current?.focus();
                                document.execCommand("insertUnorderedList");
                              }}
                              className="px-2 py-1 text-gray-700 hover:bg-gray-200 rounded text-sm"
                            >
                              • List
                            </button>
                            <button
                              type="button"
                              title="Numbered list"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                descEditorRef.current?.focus();
                                document.execCommand("insertOrderedList");
                              }}
                              className="px-2 py-1 text-gray-700 hover:bg-gray-200 rounded text-sm"
                            >
                              1. List
                            </button>
                          </div>
                          <div
                            ref={descEditorRef}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={() => descEditorRef.current && setProdDescription(descEditorRef.current.innerHTML)}
                            className="min-h-[100px] max-h-[200px] overflow-y-auto px-3 py-2 text-gray-900 focus:outline-none"
                            data-placeholder="Enter description (bold, italic, lists supported)..."
                            style={{ outline: "none" }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Use toolbar for bold, italic, and lists. Shown on product page.</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Product properties (e.g. Size, Material)</label>
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
                                className="flex-1 px-3 py-2 border border-gray-300 rounded"
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
                                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                              />
                              <button
                                type="button"
                                onClick={() => setProdProperties(prodProperties.filter((_, i) => i !== idx))}
                                className="text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setProdProperties([...prodProperties, { key: "", value: "" }])}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            + Add property
                          </button>
                        </div>
                      </div>
                      <select
                        value={prodParentId}
                        onChange={(e) => {
                          setProdParentId(e.target.value);
                          setProdCategoryId("");
                          setProdSubcategory("");
                        }}
                        className="px-3 py-2 border border-gray-300 rounded"
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
                        className="px-3 py-2 border border-gray-300 rounded"
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
                        className="px-3 py-2 border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price per sq ft"
                        value={prodPricePerSqft}
                        onChange={(e) => setProdPricePerSqft(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded"
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Min charge"
                        value={prodMinCharge}
                        onChange={(e) => setProdMinCharge(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Material"
                        value={prodMaterial}
                        onChange={(e) => setProdMaterial(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded"
                      />
                      <div className="md:col-span-2 space-y-2">
                        <p className="text-sm font-medium text-gray-700">Product image (file ya URL)</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="px-3 py-2 bg-gray-200 rounded cursor-pointer hover:bg-gray-300 text-sm font-medium">
                            {uploadingImage ? "Uploading…" : "Choose image file"}
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                              className="hidden"
                              disabled={uploadingImage}
                              onChange={handleProductImageUpload}
                            />
                          </label>
                          <span className="text-gray-500 text-sm">ya</span>
                          <input
                            type="text"
                            placeholder="Image URL (e.g. /image.jpg)"
                            value={prodImageUrl}
                            onChange={(e) => setProdImageUrl(e.target.value)}
                            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded"
                          />
                        </div>
                        {prodImageUrl && isValidImageSrc(prodImageUrl) && (
                          <div className="w-20 h-20 rounded border border-gray-300 overflow-hidden bg-gray-100">
                            <Image src={getProductImageSrc(prodImageUrl)} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="SKU"
                        value={prodSku}
                        onChange={(e) => setProdSku(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded"
                      />
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={prodIsNew} onChange={(e) => setProdIsNew(e.target.checked)} />
                          New
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={prodIsActive} onChange={(e) => setProdIsActive(e.target.checked)} />
                          Active
                        </label>
                      </div>
                      <div className="md:col-span-2 flex gap-2">
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                          {saving ? "Saving…" : editingProductId ? "Update" : "Add Product"}
                        </button>
                        {editingProductId && (
                          <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left p-2">Image</th>
                            <th className="text-left p-2">Name</th>
                            <th className="text-left p-2">Category</th>
                            <th className="text-left p-2">Price</th>
                            <th className="text-left p-2">Active</th>
                            <th className="text-left p-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => (
                            <tr key={p.id} className="border-b">
                              <td className="p-2">
                                {p.image_url && isValidImageSrc(p.image_url) ? (
                                  <div className="w-10 h-10 rounded border overflow-hidden bg-gray-100">
                                    <Image src={getProductImageSrc(p.image_url)} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
                                  </div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="p-2 font-medium">{p.name}</td>
                              <td className="p-2">{p.category_name || "—"} {p.subcategory ? ` / ${p.subcategory}` : ""}</td>
                              <td className="p-2">{p.price != null ? `$${p.price}` : "—"}</td>
                              <td className="p-2">{p.is_active ? "Yes" : "No"}</td>
                              <td className="p-2 flex items-center gap-2">
                                <button type="button" onClick={() => startEditProduct(p)} className="text-blue-600 hover:underline">
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleProductDelete(p.id, p.name)}
                                  disabled={deletingProductId === p.id}
                                  className="text-red-600 hover:underline disabled:opacity-50"
                                >
                                  {deletingProductId === p.id ? "Deleting…" : "Delete"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {productsPagination.pages > 1 && (
                      <div className="flex items-center justify-between px-2 py-4 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          Showing {(productsPage - 1) * productsPerPage + 1}–
                          {Math.min(productsPage * productsPerPage, productsPagination.total)} of {productsPagination.total}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => loadProducts(productsPage - 1)}
                            disabled={productsPage <= 1}
                            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                className={`px-3 py-1 border rounded text-sm ${
                                  productsPage === pageNum ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 hover:bg-gray-50"
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
                            className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <form onSubmit={handleCategorySubmit} className="p-4 bg-gray-50 rounded-lg max-w-md space-y-3">
                      <h3 className="font-semibold text-gray-800">{editingCategoryId ? "Edit Category" : "Add Category"}</h3>
                      <input
                        type="text"
                        placeholder="Name *"
                        value={catName}
                        onChange={(e) => setCatName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Slug (optional)"
                        value={catSlug}
                        onChange={(e) => setCatSlug(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                      <textarea
                        placeholder="Description"
                        value={catDescription}
                        onChange={(e) => setCatDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                      <div className="flex gap-2">
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                          {saving ? "Saving…" : editingCategoryId ? "Update" : "Add Category"}
                        </button>
                        {editingCategoryId && (
                          <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Slug</th>
                          <th className="text-left p-2">Products</th>
                          <th className="text-left p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parentCategories.map((c) => (
                          <tr key={c.id} className="border-b">
                            <td className="p-2 font-medium">{c.name}</td>
                            <td className="p-2">{c.slug}</td>
                            <td className="p-2">{c.product_count}</td>
                            <td className="p-2">
                              <button type="button" onClick={() => startEditCategory(c)} className="text-blue-600 hover:underline mr-2">
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCategoryDelete(c.id, c.name)}
                                disabled={deletingCategoryId === c.id}
                                className="text-red-600 hover:underline disabled:opacity-50"
                              >
                                {deletingCategoryId === c.id ? "Deleting…" : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Subcategories tab */}
                {activeTab === "subcategories" && (
                  <div className="space-y-6">
                    <form onSubmit={handleCategorySubmit} className="p-4 bg-gray-50 rounded-lg max-w-md space-y-3">
                      <h3 className="font-semibold text-gray-800">{editingCategoryId ? "Edit Subcategory" : "Add Subcategory"}</h3>
                      <select
                        value={catParentId}
                        onChange={(e) => setCatParentId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
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
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                      <input
                        type="text"
                        placeholder="Slug (optional)"
                        value={catSlug}
                        onChange={(e) => setCatSlug(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                      <textarea
                        placeholder="Description"
                        value={catDescription}
                        onChange={(e) => setCatDescription(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                      <div className="flex gap-2">
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                          {saving ? "Saving…" : editingCategoryId ? "Update" : "Add Subcategory"}
                        </button>
                        {editingCategoryId && (
                          <button type="button" onClick={cancelEdit} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Slug</th>
                          <th className="text-left p-2">Parent</th>
                          <th className="text-left p-2">Products</th>
                          <th className="text-left p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subCategories.map((c) => {
                          const parent = categories.find((x) => x.id === c.parent_id);
                          return (
                            <tr key={c.id} className="border-b">
                              <td className="p-2 font-medium">{c.name}</td>
                              <td className="p-2">{c.slug}</td>
                              <td className="p-2">{parent?.name || "—"}</td>
                              <td className="p-2">{c.product_count}</td>
                              <td className="p-2">
                                <button type="button" onClick={() => startEditCategory(c)} className="text-blue-600 hover:underline mr-2">
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCategoryDelete(c.id, c.name)}
                                  disabled={deletingCategoryId === c.id}
                                  className="text-red-600 hover:underline disabled:opacity-50"
                                >
                                  {deletingCategoryId === c.id ? "Deleting…" : "Delete"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {subCategories.length === 0 && (
                      <p className="text-gray-500">No subcategories yet. Add one using the form above (select a parent category).</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminNavbar>
  );
}

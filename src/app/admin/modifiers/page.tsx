"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiChevronDown, FiX } from "react-icons/fi";
import AdminNavbar from "../../components/AdminNavbar";
import {
  productsAPI,
  type ModifierCategory,
  type ModifierGroup,
  type ModifierPreset,
  type ModifierSubcategory,
} from "../../../utils/api";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";

type Tab = "catalog" | "presets" | "categories";
type EditorGroup = ModifierGroup & { __uiid: string };
type DeleteTarget =
  | { type: "modifier"; id: string; name: string }
  | { type: "category"; id: number; name: string }
  | { type: "subcategory"; id: number; name: string }
  | { type: "preset"; id: number; name: string };

function ThemedDropdown({
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
  className = "",
}: {
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, []);

  const label = options.find((option) => option.value === value)?.label || placeholder;
  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((previous) => !previous)}
        className={`relative w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 ${
          disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : value ? "bg-white text-slate-900" : "bg-white text-slate-500"
        }`}
      >
        <span className="block truncate pr-6">{label}</span>
        <FiChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="block w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={`block w-full px-3 py-2 text-left text-sm ${option.value === value ? "bg-sky-50 text-sky-800" : "text-slate-700 hover:bg-slate-50"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const newUiId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `modifier-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyGroup = (): EditorGroup => ({
  __uiid: newUiId(),
  name: "",
  key: "",
  input_type: "dropdown",
  category_id: null,
  subcategory_id: null,
  options: [{ label: "", value: "", price_adjustment: 0, price_type: "percent", is_default: false }],
});

export default function AdminModifiersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("catalog");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [catalog, setCatalog] = useState<EditorGroup[]>([]);
  const [categories, setCategories] = useState<ModifierCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ModifierSubcategory[]>([]);
  const [presets, setPresets] = useState<ModifierPreset[]>([]);

  const [editor, setEditor] = useState<EditorGroup>(emptyGroup());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [subcategoryName, setSubcategoryName] = useState("");
  const [subcategoryCategoryId, setSubcategoryCategoryId] = useState("");
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<number | null>(null);

  const [presetName, setPresetName] = useState("");
  const [presetIds, setPresetIds] = useState<number[]>([]);
  const [pendingPresetIds, setPendingPresetIds] = useState<number[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [presetCategoryId, setPresetCategoryId] = useState("");
  const [presetSubcategoryId, setPresetSubcategoryId] = useState("");
  const [presetSearch, setPresetSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const notify = (type: "success" | "error", text: string) => setMessage({ type, text });

  const loadAll = async () => {
    const [catalogRes, taxonomyRes, presetsRes] = await Promise.all([
      productsAPI.getModifierCatalogAdmin(),
      productsAPI.getModifierTaxonomyAdmin(),
      productsAPI.getModifierPresetsAdmin(),
    ]);
    setCatalog(
      (Array.isArray(catalogRes?.groups) ? catalogRes.groups : []).map((group: ModifierGroup) => ({
        ...group,
        __uiid: newUiId(),
      }))
    );
    setCategories(Array.isArray(taxonomyRes?.categories) ? taxonomyRes.categories : []);
    setSubcategories(Array.isArray(taxonomyRes?.subcategories) ? taxonomyRes.subcategories : []);
    setPresets(Array.isArray(presetsRes?.presets) ? presetsRes.presets : []);
  };

  useEffect(() => {
    if (!isAuthenticated() || !canAccessAdminPanel()) {
      router.push("/");
      return;
    }
    (async () => {
      try {
        await loadAll();
      } catch (error: unknown) {
        notify("error", error instanceof Error ? error.message : "Failed to load modifier data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const editorSubcategories = subcategories.filter(
    (item) => Number(item.category_id) === Number(editor.category_id)
  );

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog.filter((group) =>
      (catalogCategoryFilter === ""
        ? true
        : catalogCategoryFilter === "__uncategorized"
          ? group.category_id == null
          : Number(group.category_id) === Number(catalogCategoryFilter)) &&
      (!query ||
        [
          group.name,
          group.key,
          group.category_name || "Uncategorized",
          group.subcategory_name || "General",
        ].some((value) => String(value || "").toLowerCase().includes(query)))
    );
  }, [catalog, search, catalogCategoryFilter]);

  const groupedCatalog = useMemo(() => {
    const grouped = new Map<string, Map<string, EditorGroup[]>>();
    for (const group of filteredCatalog) {
      const category = group.category_name || "Uncategorized";
      const subcategory = group.subcategory_name || "General";
      if (!grouped.has(category)) grouped.set(category, new Map());
      const bySubcategory = grouped.get(category)!;
      if (!bySubcategory.has(subcategory)) bySubcategory.set(subcategory, []);
      bySubcategory.get(subcategory)!.push(group);
    }
    return grouped;
  }, [filteredCatalog]);

  const persistCatalog = async (next: EditorGroup[]) => {
    await productsAPI.updateModifierCatalogAdmin({
      groups: next.map((item) => {
        const group: ModifierGroup = { ...item };
        delete (group as ModifierGroup & { __uiid?: string }).__uiid;
        return group;
      }),
    });
    await loadAll();
  };

  const saveModifier = async () => {
    const name = editor.name.trim();
    const key = editor.key.trim().toLowerCase();
    if (!name || !key) return notify("error", "Modifier name and key are required.");
    if (
      catalog.some(
        (group) =>
          group.key.toLowerCase() === key && group.key.toLowerCase() !== String(editingKey || "").toLowerCase()
      )
    ) {
      return notify("error", "Modifier key already exists.");
    }
    if (editor.subcategory_id && !editor.category_id) {
      return notify("error", "Select a category before selecting a subcategory.");
    }
    const normalized: EditorGroup = {
      ...editor,
      name,
      key,
      category_id: editor.category_id || null,
      subcategory_id: editor.subcategory_id || null,
      options: editor.options
        .map((option) => ({
          ...option,
          label: String(option.label || "").trim(),
          value: String(option.value || option.label || "").trim(),
          price_adjustment: Number(option.price_adjustment || 0),
          price_type: "percent",
        }))
        .filter((option) => option.label),
    };
    const next =
      editingKey == null
        ? [...catalog, normalized]
        : catalog.map((group) =>
            group.key === editingKey ? { ...normalized, __uiid: group.__uiid } : group
          );
    try {
      setSavingCatalog(true);
      await persistCatalog(next);
      setEditor(emptyGroup());
      setEditingKey(null);
      notify("success", editingKey ? "Modifier updated." : "Modifier created.");
    } catch (error: unknown) {
      notify("error", error instanceof Error ? error.message : "Failed to save modifier.");
    } finally {
      setSavingCatalog(false);
    }
  };

  const editModifier = (group: EditorGroup) => {
    setEditor({
      ...group,
      __uiid: newUiId(),
      options: group.options.map((option) => ({ ...option })),
    });
    setEditingKey(group.key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      if (deleteTarget.type === "modifier") {
        await productsAPI.deleteModifierCatalogGroupAdmin(deleteTarget.id);
        if (editingKey === deleteTarget.id) {
          setEditor(emptyGroup());
          setEditingKey(null);
        }
      } else if (deleteTarget.type === "category") {
        await productsAPI.deleteModifierCategoryAdmin(deleteTarget.id);
      } else if (deleteTarget.type === "subcategory") {
        await productsAPI.deleteModifierSubcategoryAdmin(deleteTarget.id);
      } else {
        await productsAPI.deleteModifierPresetAdmin(deleteTarget.id);
      }
      await loadAll();
      notify("success", `${deleteTarget.type.charAt(0).toUpperCase()}${deleteTarget.type.slice(1)} deleted.`);
      setDeleteTarget(null);
    } catch (error: unknown) {
      notify("error", error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  const saveCategory = async () => {
    const name = categoryName.trim();
    if (!name) return notify("error", "Category name is required.");
    try {
      if (editingCategoryId) {
        await productsAPI.updateModifierCategoryAdmin(editingCategoryId, { name });
      } else {
        await productsAPI.createModifierCategoryAdmin({ name });
      }
      setCategoryName("");
      setEditingCategoryId(null);
      await loadAll();
      notify("success", editingCategoryId ? "Category updated." : "Category created.");
    } catch (error: unknown) {
      notify("error", error instanceof Error ? error.message : "Failed to save category.");
    }
  };

  const saveSubcategory = async () => {
    const name = subcategoryName.trim();
    const categoryId = Number(subcategoryCategoryId);
    if (!name || !categoryId) return notify("error", "Parent category and subcategory name are required.");
    try {
      if (editingSubcategoryId) {
        await productsAPI.updateModifierSubcategoryAdmin(editingSubcategoryId, {
          category_id: categoryId,
          name,
        });
      } else {
        await productsAPI.createModifierSubcategoryAdmin({ category_id: categoryId, name });
      }
      setSubcategoryName("");
      setSubcategoryCategoryId("");
      setEditingSubcategoryId(null);
      await loadAll();
      notify("success", editingSubcategoryId ? "Subcategory updated." : "Subcategory created.");
    } catch (error: unknown) {
      notify("error", error instanceof Error ? error.message : "Failed to save subcategory.");
    }
  };

  const availablePresetModifiers = useMemo(() => {
    const query = presetSearch.trim().toLowerCase();
    return catalog.filter((group) => {
      if (!group.id || presetIds.includes(group.id)) return false;
      if (presetCategoryId && Number(group.category_id) !== Number(presetCategoryId)) return false;
      if (presetSubcategoryId && Number(group.subcategory_id) !== Number(presetSubcategoryId)) return false;
      return !query || `${group.name} ${group.key}`.toLowerCase().includes(query);
    });
  }, [catalog, presetIds, presetCategoryId, presetSubcategoryId, presetSearch]);

  const togglePresetModifier = (id: number) =>
    setPresetIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );
  const togglePendingPresetModifier = (id: number) =>
    setPendingPresetIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]
    );

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) return notify("error", "Preset name is required.");
    try {
      if (editingPresetId) {
        await productsAPI.updateModifierPresetAdmin(editingPresetId, {
          name,
          modifier_group_ids: presetIds,
        });
      } else {
        await productsAPI.createModifierPresetAdmin({ name, modifier_group_ids: presetIds });
      }
      setPresetName("");
      setPresetIds([]);
      setPendingPresetIds([]);
      setEditingPresetId(null);
      await loadAll();
      notify("success", editingPresetId ? "Preset updated." : "Preset created.");
    } catch (error: unknown) {
      notify("error", error instanceof Error ? error.message : "Failed to save preset.");
    }
  };

  const tabClass = (value: Tab) =>
    `flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium ${
      tab === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
    }`;

  return (
    <AdminNavbar title="Modifiers" subtitle="Create and reuse categories, subcategories, modifiers, and presets">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        {message ? (
          <div
            className={`rounded border px-3 py-2 text-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        ) : null}
        <div className="flex gap-2">
          <button className={tabClass("catalog")} onClick={() => setTab("catalog")}>Modifier catalog</button>
          <button className={tabClass("presets")} onClick={() => setTab("presets")}>Modifier presets</button>
          <button className={tabClass("categories")} onClick={() => setTab("categories")}>Categories</button>
        </div>

        {loading ? (
          <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading...</div>
        ) : tab === "categories" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">Modifier categories</h2>
              <div className="mt-3 flex gap-2">
                <input className="flex-1 rounded border px-3 py-2 text-sm" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Category name" />
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={saveCategory}>{editingCategoryId ? "Update" : "Create"}</button>
              </div>
              <div className="mt-4 space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm">
                    <span className="font-medium">{category.name}</span>
                    <div className="flex gap-1">
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); }}>Edit</button>
                      <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => setDeleteTarget({ type: "category", id: category.id, name: category.name })}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">Modifier subcategories</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <ThemedDropdown className="min-w-0" value={subcategoryCategoryId} placeholder="Parent category" onChange={setSubcategoryCategoryId} options={categories.map((category) => ({ value: String(category.id), label: category.name }))} />
                <input className="rounded border px-3 py-2 text-sm" value={subcategoryName} onChange={(e) => setSubcategoryName(e.target.value)} placeholder="Subcategory name" />
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={saveSubcategory}>{editingSubcategoryId ? "Update" : "Create"}</button>
              </div>
              <div className="mt-4 space-y-2">
                {subcategories.map((subcategory) => (
                  <div key={subcategory.id} className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm">
                    <span><span className="font-medium">{subcategory.name}</span><span className="ml-2 text-xs text-slate-500">{subcategory.category_name}</span></span>
                    <div className="flex gap-1">
                      <button className="rounded border px-2 py-1 text-xs" onClick={() => { setEditingSubcategoryId(subcategory.id); setSubcategoryCategoryId(String(subcategory.category_id)); setSubcategoryName(subcategory.name); }}>Edit</button>
                      <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => setDeleteTarget({ type: "subcategory", id: subcategory.id, name: subcategory.name })}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : tab === "catalog" ? (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,1.2fr)]">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">{editingKey ? "Edit modifier" : "Create modifier"}</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className="rounded border px-3 py-2 text-sm" value={editor.name} onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" />
                <input className="rounded border px-3 py-2 text-sm" value={editor.key} onChange={(e) => setEditor((prev) => ({ ...prev, key: e.target.value }))} placeholder="Key" />
                <ThemedDropdown value={String(editor.category_id || "")} placeholder="Select category" onChange={(value) => setEditor((previous) => ({ ...previous, category_id: value ? Number(value) : null, subcategory_id: null }))} options={categories.map((category) => ({ value: String(category.id), label: category.name }))} />
                <ThemedDropdown value={String(editor.subcategory_id || "")} placeholder="Select subcategory" disabled={!editor.category_id} onChange={(value) => setEditor((previous) => ({ ...previous, subcategory_id: value ? Number(value) : null }))} options={editorSubcategories.map((subcategory) => ({ value: String(subcategory.id), label: subcategory.name }))} />
              </div>
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-[1fr_1fr_90px_70px] gap-2 text-[11px] font-semibold uppercase text-slate-500"><span>Label</span><span>Value</span><span>Percent</span><span>Action</span></div>
                {editor.options.map((option, index) => (
                  <div key={index} className="grid grid-cols-[1fr_1fr_90px_70px] gap-2">
                    <input className="min-w-0 rounded border px-2 py-1 text-sm" value={option.label} onChange={(e) => setEditor((prev) => ({ ...prev, options: prev.options.map((item, itemIndex) => itemIndex === index ? { ...item, label: e.target.value } : item) }))} />
                    <input className="min-w-0 rounded border px-2 py-1 text-sm" value={option.value} onChange={(e) => setEditor((prev) => ({ ...prev, options: prev.options.map((item, itemIndex) => itemIndex === index ? { ...item, value: e.target.value } : item) }))} />
                    <input type="number" step="0.01" className="min-w-0 rounded border px-2 py-1 text-sm" value={Number(option.price_adjustment || 0) === 0 ? "" : option.price_adjustment} placeholder="0" onChange={(e) => setEditor((prev) => ({ ...prev, options: prev.options.map((item, itemIndex) => itemIndex === index ? { ...item, price_adjustment: Number(e.target.value || 0) } : item) }))} />
                    <button className="rounded border border-rose-200 text-xs text-rose-700" onClick={() => setEditor((prev) => ({ ...prev, options: prev.options.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>
                    <label className="col-span-4 flex items-center gap-2 text-xs text-slate-600"><input type="radio" name="modifier-default" checked={!!option.is_default} onChange={() => setEditor((prev) => ({ ...prev, options: prev.options.map((item, itemIndex) => ({ ...item, is_default: itemIndex === index })) }))} /> Default option</label>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="rounded border px-3 py-2 text-xs" onClick={() => setEditor((prev) => ({ ...prev, options: [...prev.options, { label: "", value: "", price_adjustment: 0, price_type: "percent", is_default: false }] }))}>+ Option</button>
                <button className="rounded bg-slate-900 px-3 py-2 text-xs text-white disabled:opacity-50" disabled={savingCatalog} onClick={saveModifier}>{savingCatalog ? "Saving..." : editingKey ? "Update modifier" : "Create modifier"}</button>
                <button className="rounded border px-3 py-2 text-xs" onClick={() => { setEditor(emptyGroup()); setEditingKey(null); }}>Clear</button>
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Created modifiers</h2>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <div className="flex min-w-[220px] flex-1 items-center gap-1 sm:flex-none">
                    <ThemedDropdown
                      className="min-w-0 flex-1"
                      value={catalogCategoryFilter}
                      placeholder="Filter by category"
                      onChange={setCatalogCategoryFilter}
                      options={[
                        { value: "__uncategorized", label: "Uncategorized" },
                        ...categories.map((category) => ({
                          value: String(category.id),
                          label: category.name,
                        })),
                      ]}
                    />
                    {catalogCategoryFilter ? (
                      <button
                        type="button"
                        onClick={() => setCatalogCategoryFilter("")}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                        title="Clear category filter"
                        aria-label="Clear category filter"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <input className="min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 sm:w-72" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, key, category..." />
                </div>
              </div>
              <div className="mt-4 max-h-[720px] min-h-[420px] space-y-4 overflow-auto rounded border border-slate-200 bg-slate-50 p-3">
                {groupedCatalog.size === 0 ? <p className="text-sm text-slate-500">No matching modifiers.</p> : null}
                {Array.from(groupedCatalog.entries()).map(([category, bySubcategory]) => (
                  <div key={category}>
                    <h3 className="sticky top-0 z-10 rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white">{category}</h3>
                    {Array.from(bySubcategory.entries()).map(([subcategory, groups]) => (
                      <div key={`${category}-${subcategory}`} className="ml-2 mt-2 border-l-2 border-slate-300 pl-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{subcategory}</p>
                        <div className="space-y-1">
                          {groups.map((group) => (
                            <div key={group.__uiid} className="rounded border border-slate-200 bg-white p-2">
                              <div className="flex items-center justify-between gap-2">
                                <button className="text-left text-sm" onClick={() => setExpandedId(expandedId === group.__uiid ? null : group.__uiid)}><span className="font-medium">{group.name}</span> <span className="text-xs text-slate-500">[{group.key}]</span></button>
                                <div className="flex gap-1">
                                  <button className="rounded border px-2 py-1 text-xs" onClick={() => editModifier(group)}>Edit</button>
                                  <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => setDeleteTarget({ type: "modifier", id: group.key, name: group.name })}>Delete</button>
                                </div>
                              </div>
                              {expandedId === group.__uiid ? <ul className="mt-2 space-y-1 border-t pt-2 text-xs text-slate-600">{group.options.map((option, index) => <li key={index}>{option.label} [{option.value}] {Number(option.price_adjustment || 0).toFixed(2)}%</li>)}</ul> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">{editingPresetId ? "Edit preset" : "Create preset"}</h2>
              <input className="mt-3 w-full rounded border px-3 py-2 text-sm" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <ThemedDropdown value={presetCategoryId} placeholder="All categories" onChange={(value) => { setPresetCategoryId(value); setPresetSubcategoryId(""); }} options={categories.map((category) => ({ value: String(category.id), label: category.name }))} />
                <ThemedDropdown value={presetSubcategoryId} placeholder="All subcategories" disabled={!presetCategoryId} onChange={setPresetSubcategoryId} options={subcategories.filter((item) => Number(item.category_id) === Number(presetCategoryId)).map((subcategory) => ({ value: String(subcategory.id), label: subcategory.name }))} />
                <input className="rounded border px-3 py-2 text-sm" value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)} placeholder="Search modifiers" />
              </div>
              <div className="mt-3 max-h-72 overflow-auto rounded border border-slate-200 p-2">
                {availablePresetModifiers.length === 0 ? <p className="p-2 text-xs text-slate-500">No available modifiers match this filter.</p> : availablePresetModifiers.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={!!group.id && pendingPresetIds.includes(group.id)} onChange={() => group.id && togglePendingPresetModifier(group.id)} />
                    <span>{group.name} <span className="text-xs text-slate-500">[{group.key}] · {group.category_name || "Uncategorized"} / {group.subcategory_name || "General"}</span></span>
                  </label>
                ))}
              </div>
              <button
                className="mt-2 rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
                disabled={pendingPresetIds.length === 0}
                onClick={() => {
                  setPresetIds((previous) => [...previous, ...pendingPresetIds.filter((id) => !previous.includes(id))]);
                  setPendingPresetIds([]);
                }}
              >
                Add Selected ({pendingPresetIds.length})
              </button>
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected modifiers</p>
                <div className="mt-2 space-y-1">
                  {presetIds.map((id) => {
                    const group = catalog.find((item) => item.id === id);
                    return <div key={id} className="flex items-center justify-between rounded border p-2 text-sm"><span>{group?.name || `Modifier ${id}`} <span className="text-xs text-slate-500">[{group?.key}]</span></span><button className="text-xs text-rose-700" onClick={() => togglePresetModifier(id)}>Remove</button></div>;
                  })}
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={savePreset}>{editingPresetId ? "Update preset" : "Create preset"}</button>
                <button className="rounded border px-3 py-2 text-sm" onClick={() => { setPresetName(""); setPresetIds([]); setPendingPresetIds([]); setEditingPresetId(null); }}>Clear</button>
              </div>
            </section>
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="text-base font-semibold">Saved presets</h2>
              <div className="mt-3 space-y-2">
                {presets.map((preset) => (
                  <div key={preset.id} className="rounded border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div><p className="font-medium">{preset.name}</p><p className="text-xs text-slate-500">{preset.modifiers.length} modifiers</p></div>
                      <div className="flex gap-1">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => { setEditingPresetId(preset.id); setPresetName(preset.name); setPendingPresetIds([]); setPresetIds([...preset.modifiers].sort((a, b) => a.sort_order - b.sort_order).map((item) => item.modifier_group_id)); }}>Edit</button>
                        <button className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700" onClick={() => setDeleteTarget({ type: "preset", id: preset.id, name: preset.name })}>Delete</button>
                      </div>
                    </div>
                    <ul className="mt-2 list-inside list-disc text-xs text-slate-600">{preset.modifiers.map((item) => <li key={item.id}>{item.name} · {item.category_name || "Uncategorized"} / {item.subcategory_name || "General"}</li>)}</ul>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
        {deleteTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-xl text-rose-600">!</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">Delete {deleteTarget.type}?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Are you sure you want to delete <span className="font-semibold text-slate-900">“{deleteTarget.name}”</span>?
                {deleteTarget.type === "category"
                  ? " Its subcategories will also be deleted, and assigned modifiers will become uncategorized."
                  : deleteTarget.type === "subcategory"
                    ? " Assigned modifiers will be displayed under General."
                    : " This action cannot be undone."}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  onClick={() => void confirmDelete()}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminNavbar>
  );
}

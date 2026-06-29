"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "../../components/AdminNavbar";
import {
  productsAPI,
  shippingBoxesAPI,
  type HardwareTemplate,
  type HardwareTemplateOption,
  type ModifierGroup,
  type ShippingBox,
} from "../../../utils/api";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { FiChevronDown } from "react-icons/fi";

type EditorTemplate = {
  id?: number;
  name: string;
  options: HardwareTemplateOption[];
};

type ThemedDropdownOption = {
  value: string;
  label: string;
};

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
  const hasValue = value !== "";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={`w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 ${
          disabled
            ? "cursor-not-allowed bg-slate-50 text-slate-400"
            : hasValue
              ? "bg-white text-slate-900"
              : "bg-white text-slate-500"
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

function createEmptyOption(index: number, asDefault: boolean): HardwareTemplateOption {
  return {
    label: "",
    option_key: `option_${index + 1}`,
    unit_price: 0,
    weight_per_item: null,
    shipping_box_rules: [],
    is_default: asDefault,
    sort_order: index,
    modifiers: [],
  };
}

function createEmptyTemplate(): EditorTemplate {
  return {
    name: "",
    options: [createEmptyOption(0, true), createEmptyOption(1, false)],
  };
}

function optionKeyFromLabel(label: string, fallback: string) {
  const normalized = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return normalized || fallback;
}

function defaultModifierAmountForBase(group: ModifierGroup, basePrice: number): number {
  const options = Array.isArray(group.options) ? group.options : [];
  const selected = options.find((o) => o.is_default) || options[0];
  if (!selected) return 0;
  const raw = Number(selected.price_adjustment || 0);
  if (!Number.isFinite(raw)) return 0;
  const priceType = String(selected.price_type || "percent").trim().toLowerCase();
  if (priceType === "fixed") return raw;
  return basePrice * (raw / 100);
}

export default function AdminHardwarePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HardwareTemplate | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [templates, setTemplates] = useState<HardwareTemplate[]>([]);
  const [modifierCatalog, setModifierCatalog] = useState<ModifierGroup[]>([]);
  const [shippingBoxes, setShippingBoxes] = useState<ShippingBox[]>([]);
  const [editor, setEditor] = useState<EditorTemplate>(createEmptyTemplate());
  const [modifierCategoryId, setModifierCategoryId] = useState("");
  const [modifierSubcategoryId, setModifierSubcategoryId] = useState("");
  const [modifierSearch, setModifierSearch] = useState("");

  const modifierCatalogByKey = useMemo(() => {
    const map = new Map<string, ModifierGroup>();
    for (const g of modifierCatalog) {
      map.set(String(g.key || "").trim().toLowerCase(), g);
    }
    return map;
  }, [modifierCatalog]);
  const modifierCategories = useMemo(
    () =>
      Array.from(
        new Map(
          modifierCatalog
            .filter((group) => group.category_id != null)
            .map((group) => [
              Number(group.category_id),
              { id: Number(group.category_id), name: group.category_name || "Uncategorized" },
            ])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [modifierCatalog]
  );
  const modifierSubcategories = useMemo(
    () =>
      Array.from(
        new Map(
          modifierCatalog
            .filter(
              (group) =>
                group.subcategory_id != null &&
                (!modifierCategoryId || Number(group.category_id) === Number(modifierCategoryId))
            )
            .map((group) => [
              Number(group.subcategory_id),
              { id: Number(group.subcategory_id), name: group.subcategory_name || "General" },
            ])
        ).values()
      ).sort((a, b) => a.name.localeCompare(b.name)),
    [modifierCatalog, modifierCategoryId]
  );
  const filteredModifierCatalog = useMemo(() => {
    const query = modifierSearch.trim().toLowerCase();
    return modifierCatalog.filter((group) => {
      if (modifierCategoryId === "__uncategorized" && group.category_id != null) return false;
      if (
        modifierCategoryId &&
        modifierCategoryId !== "__uncategorized" &&
        Number(group.category_id) !== Number(modifierCategoryId)
      ) return false;
      if (modifierSubcategoryId === "__general" && group.subcategory_id != null) return false;
      if (
        modifierSubcategoryId &&
        modifierSubcategoryId !== "__general" &&
        Number(group.subcategory_id) !== Number(modifierSubcategoryId)
      ) return false;
      return !query || `${group.name} ${group.key}`.toLowerCase().includes(query);
    });
  }, [modifierCatalog, modifierCategoryId, modifierSubcategoryId, modifierSearch]);

  const loadData = async () => {
    const [templatesRes, catalogRes, boxesRes] = await Promise.all([
      productsAPI.getHardwareTemplatesAdmin(),
      productsAPI.getModifierCatalogAdmin(),
      shippingBoxesAPI.getAdmin(),
    ]);
    setTemplates(Array.isArray(templatesRes?.templates) ? templatesRes.templates : []);
    setModifierCatalog(Array.isArray(catalogRes?.groups) ? catalogRes.groups : []);
    setShippingBoxes(Array.isArray(boxesRes?.boxes) ? boxesRes.boxes : []);
  };

  useEffect(() => {
    if (!isAuthenticated() || !canAccessAdminPanel()) {
      router.push("/");
      return;
    }
    (async () => {
      setLoading(true);
      try {
        await loadData();
      } catch (error: unknown) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to load hardware page data." });
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const resetEditor = () => {
    setEditor(createEmptyTemplate());
  };

  const startEdit = (template: HardwareTemplate) => {
    setEditor({
      id: template.id,
      name: String(template.name || ""),
      options: (Array.isArray(template.options) ? template.options : [])
        .slice(0, 2)
        .map((opt, index) => ({
          ...opt,
          unit_price: Number(opt.unit_price || 0),
          option_key: String(opt.option_key || optionKeyFromLabel(opt.label, `option_${index + 1}`)),
          modifiers: Array.isArray(opt.modifiers) ? opt.modifiers.map((m) => ({ ...m })) : [],
          weight_per_item: opt.weight_per_item == null ? null : Number(opt.weight_per_item),
          shipping_box_rules: Array.isArray(opt.shipping_box_rules) ? opt.shipping_box_rules.slice(0, 1) : [],
          sort_order: index,
        })),
    });
  };

  const setDefaultOption = (index: number) => {
    setEditor((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => ({ ...opt, is_default: i === index })),
    }));
  };

  const toggleModifierForOption = (optionIndex: number, modifierKey: string, checked: boolean) => {
    setEditor((prev) => ({
      ...prev,
      options: prev.options.map((opt, idx) => {
        if (idx !== optionIndex) return opt;
        const key = String(modifierKey).trim().toLowerCase();
        const existing = Array.isArray(opt.modifiers) ? opt.modifiers : [];
        const without = existing.filter((m) => String(m.key || "").trim().toLowerCase() !== key);
        const catalogGroup = modifierCatalog.find((group) => String(group.key || "").trim().toLowerCase() === key);
        return {
          ...opt,
          modifiers: checked
            ? [...without, {
                key,
                is_required: false,
                options: (Array.isArray(catalogGroup?.options) ? catalogGroup.options : []).map((groupOption) => ({
                  option_id: groupOption.id != null ? Number(groupOption.id) : undefined,
                  value: String(groupOption.value || ""),
                  label: String(groupOption.label || ""),
                  price_adjustment_override: null,
                })),
              }]
            : without,
        };
      }),
    }));
  };

  const validateEditor = (): string | null => {
    if (!editor.name.trim()) return "Template name is required.";
    if (!Array.isArray(editor.options) || editor.options.length !== 2) return "Hardware template must have exactly 2 options.";
    const defaultCount = editor.options.filter((o) => o.is_default).length;
    if (defaultCount !== 1) return "Please mark exactly one option as default.";
    for (let i = 0; i < editor.options.length; i++) {
      const option = editor.options[i];
      if (!String(option.label || "").trim()) return `Option ${i + 1} label is required.`;
      if (!Number.isFinite(Number(option.unit_price)) || Number(option.unit_price) < 0) {
        return `Option ${i + 1} price must be zero or greater.`;
      }
      if (!Number.isFinite(Number(option.weight_per_item)) || Number(option.weight_per_item) <= 0) {
        return `Option ${i + 1} weight per item is required.`;
      }
      const rule = Array.isArray(option.shipping_box_rules) ? option.shipping_box_rules[0] : null;
      if (!rule?.shipping_box_id) return `Option ${i + 1} shipping box rule is required.`;
      if (!Number.isFinite(Number(rule.max_quantity_per_box)) || Number(rule.max_quantity_per_box) <= 0) {
        return `Option ${i + 1} max quantity per box is required.`;
      }
      if (rule.max_weight_per_box != null && (!Number.isFinite(Number(rule.max_weight_per_box)) || Number(rule.max_weight_per_box) <= 0)) {
        return `Option ${i + 1} max weight per box must be greater than zero.`;
      }
    }
    return null;
  };

  const saveTemplate = async () => {
    const validationError = validateEditor();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      return;
    }
    try {
      setSaving(true);
      setMessage(null);
      const payload = {
        name: editor.name.trim(),
        options: editor.options.map((opt, index) => ({
          label: String(opt.label || "").trim(),
          option_key: optionKeyFromLabel(opt.label, `option_${index + 1}`),
          unit_price: Number(opt.unit_price || 0),
          weight_per_item: Number(opt.weight_per_item || 0),
          shipping_box_rules: (Array.isArray(opt.shipping_box_rules) ? opt.shipping_box_rules : [])
            .slice(0, 1)
            .filter((rule) => rule.shipping_box_id)
            .map((rule) => ({
              shipping_box_id: Number(rule.shipping_box_id),
              max_quantity_per_box: Number(rule.max_quantity_per_box),
              max_weight_per_box:
                rule.max_weight_per_box == null
                  ? null
                  : Number(rule.max_weight_per_box),
            })),
          is_default: !!opt.is_default,
          modifiers: (Array.isArray(opt.modifiers) ? opt.modifiers : []).map((m) => ({
            key: String(m.key || "").trim().toLowerCase(),
            is_required: !!m.is_required,
            options: (Array.isArray(m.options) ? m.options : []).map((modifierOption) => ({
              option_id: modifierOption.option_id == null ? undefined : Number(modifierOption.option_id),
              value: String(modifierOption.value || ""),
              price_adjustment_override:
                modifierOption.price_adjustment_override == null
                  ? null
                  : Number(modifierOption.price_adjustment_override),
            })),
          })),
        })),
      };
      if (editor.id != null) {
        await productsAPI.updateHardwareTemplateAdmin(editor.id, payload);
        setMessage({ type: "success", text: "Hardware template updated." });
      } else {
        await productsAPI.createHardwareTemplateAdmin(payload);
        setMessage({ type: "success", text: "Hardware template created." });
      }
      await loadData();
      resetEditor();
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to save hardware template." });
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (template: HardwareTemplate) => {
    const id = Number(template.id);
    if (!Number.isFinite(id)) return;
    try {
      setDeletingId(id);
      await productsAPI.deleteHardwareTemplateAdmin(id);
      if (editor.id === id) resetEditor();
      await loadData();
      setMessage({ type: "success", text: "Hardware template deleted." });
      setDeleteTarget(null);
    } catch (error: unknown) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Failed to delete hardware template." });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminNavbar title="Hardware" subtitle="Create reusable 2-option hardware templates">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {message ? (
          <div
            className={`rounded px-3 py-2 text-sm ${
              message.type === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading...</div>
        ) : (
          <>
            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-4 text-base font-semibold">{editor.id ? "Edit Hardware Template" : "New Hardware Template"}</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  value={editor.name}
                  onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Template label/name (e.g. Banner Hardware)"
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  {editor.options.map((option, optionIndex) => {
                    const attachedKeys = new Set(
                      (Array.isArray(option.modifiers) ? option.modifiers : []).map((m) =>
                        String(m.key || "").trim().toLowerCase()
                      )
                    );
                    const base = Number(option.unit_price || 0);
                    const modifiersPreviewTotal = Array.from(attachedKeys).reduce((sum, key) => {
                      const group = modifierCatalogByKey.get(key);
                      if (!group) return sum;
                      return sum + defaultModifierAmountForBase(group, base);
                    }, 0);
                    const optionTotalPreview = base + modifiersPreviewTotal;

                    return (
                      <div key={`hardware-opt-${optionIndex}`} className="rounded border border-slate-200 p-3">
                        <div className="mb-2 text-sm font-semibold text-slate-700">Option {optionIndex + 1}</div>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={option.label}
                            onChange={(e) =>
                              setEditor((prev) => ({
                                ...prev,
                                options: prev.options.map((o, i) =>
                                  i === optionIndex ? { ...o, label: e.target.value } : o
                                ),
                              }))
                            }
                            placeholder="Option label (e.g. Graphic Only)"
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={String(option.unit_price ?? 0)}
                            onChange={(e) =>
                              setEditor((prev) => ({
                                ...prev,
                                options: prev.options.map((o, i) =>
                                  i === optionIndex ? { ...o, unit_price: Number(e.target.value || 0) } : o
                                ),
                              }))
                            }
                            placeholder="Price"
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={option.weight_per_item == null ? "" : String(option.weight_per_item)}
                            onChange={(e) =>
                              setEditor((prev) => ({
                                ...prev,
                                options: prev.options.map((o, i) =>
                                  i === optionIndex ? { ...o, weight_per_item: e.target.value === "" ? null : Number(e.target.value) } : o
                                ),
                              }))
                            }
                            placeholder="Weight per item (lb)"
                            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                          />
                          <div className="grid gap-2 rounded border border-slate-200 bg-slate-50 p-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Shipping Boxes Rules
                            </p>
                            <ThemedDropdown
                              value={String(option.shipping_box_rules?.[0]?.shipping_box_id ?? "")}
                              placeholder="Select shipping box"
                              options={shippingBoxes.map((box) => ({
                                value: String(box.id),
                                label: `${box.name} (${box.length}x${box.width}x${box.height})`,
                              }))}
                              onChange={(value) =>
                                setEditor((prev) => ({
                                  ...prev,
                                  options: prev.options.map((o, i) => {
                                    if (i !== optionIndex) return o;
                                    const prevRule = o.shipping_box_rules?.[0] || { shipping_box_id: 0 };
                                    return {
                                      ...o,
                                      shipping_box_rules: [{ ...prevRule, shipping_box_id: value ? Number(value) : 0 }],
                                    };
                                  }),
                                }))
                              }
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={option.shipping_box_rules?.[0]?.max_quantity_per_box == null ? "" : String(option.shipping_box_rules[0].max_quantity_per_box)}
                                onChange={(e) =>
                                  setEditor((prev) => ({
                                    ...prev,
                                    options: prev.options.map((o, i) => {
                                      if (i !== optionIndex) return o;
                                      const prevRule = o.shipping_box_rules?.[0] || { shipping_box_id: 0 };
                                      return {
                                        ...o,
                                        shipping_box_rules: [{ ...prevRule, max_quantity_per_box: e.target.value === "" ? null : Number(e.target.value) }],
                                      };
                                    }),
                                  }))
                                }
                                placeholder="Max qty/box"
                                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={option.shipping_box_rules?.[0]?.max_weight_per_box == null ? "" : String(option.shipping_box_rules[0].max_weight_per_box)}
                                onChange={(e) =>
                                  setEditor((prev) => ({
                                    ...prev,
                                    options: prev.options.map((o, i) => {
                                      if (i !== optionIndex) return o;
                                      const prevRule = o.shipping_box_rules?.[0] || { shipping_box_id: 0 };
                                      return {
                                        ...o,
                                        shipping_box_rules: [{ ...prevRule, max_weight_per_box: e.target.value === "" ? null : Number(e.target.value) }],
                                      };
                                    }),
                                  }))
                                }
                                placeholder="Max lb/box"
                                className="rounded border border-slate-200 px-2 py-1.5 text-sm"
                              />
                            </div>
                          </div>
                          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="radio"
                              checked={!!option.is_default}
                              onChange={() => setDefaultOption(optionIndex)}
                            />
                            Default option
                          </label>
                          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                            <div>Base price: ${base.toFixed(2)}</div>
                            <div>Attached modifiers preview add: ${modifiersPreviewTotal.toFixed(2)}</div>
                            <div className="mt-1 font-semibold text-slate-800">
                              Total preview: ${optionTotalPreview.toFixed(2)}
                            </div>
                          </div>
                          <div className="rounded border border-slate-200 p-2">
                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Attach Modifiers
                            </div>
                            <div className="mb-2 grid gap-1">
                              <ThemedDropdown
                                value={modifierCategoryId}
                                placeholder="All categories"
                                options={[
                                  { value: "", label: "All categories" },
                                  { value: "__uncategorized", label: "Uncategorized" },
                                  ...modifierCategories.map((category) => ({
                                    value: String(category.id),
                                    label: category.name,
                                  })),
                                ]}
                                onChange={(value) => {
                                  setModifierCategoryId(value);
                                  setModifierSubcategoryId("");
                                }}
                              />
                              <ThemedDropdown
                                value={modifierSubcategoryId}
                                placeholder="All subcategories"
                                options={[
                                  { value: "", label: "All subcategories" },
                                  { value: "__general", label: "General" },
                                  ...modifierSubcategories.map((subcategory) => ({
                                    value: String(subcategory.id),
                                    label: subcategory.name,
                                  })),
                                ]}
                                onChange={(value) => setModifierSubcategoryId(value)}
                              />
                              <input
                                className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
                                value={modifierSearch}
                                onChange={(e) => setModifierSearch(e.target.value)}
                                placeholder="Search modifiers"
                              />
                            </div>
                            <div className="max-h-56 space-y-1 overflow-auto">
                              {filteredModifierCatalog.map((group) => {
                                const key = String(group.key || "").trim().toLowerCase();
                                const checked = attachedKeys.has(key);
                                return (
                                  <div key={`opt-${optionIndex}-mod-${key}`} className="grid gap-1 rounded border border-slate-100 bg-white p-1.5">
                                  <label className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => toggleModifierForOption(optionIndex, key, e.target.checked)}
                                    />
                                    <span>{group.name} ({group.key}) <span className="text-slate-400">· {group.category_name || "Uncategorized"} / {group.subcategory_name || "General"}</span></span>
                                  </label>
                                  {checked ? (
                                    <div className="space-y-1 pl-5">
                                      {(Array.isArray(group.options) ? group.options : []).map((modifierOption) => {
                                        const modifier = option.modifiers.find((m) => String(m.key || "").trim().toLowerCase() === key);
                                        const optionId = modifierOption.id != null ? Number(modifierOption.id) : null;
                                        const selectedOption = (Array.isArray(modifier?.options) ? modifier.options : []).find((assigned) =>
                                          optionId != null
                                            ? Number(assigned.option_id) === optionId
                                            : String(assigned.value || "") === String(modifierOption.value || "")
                                        );
                                        const optionChecked = !!selectedOption;
                                        return (
                                          <div key={`${key}-${modifierOption.id ?? modifierOption.value}`} className="flex items-center gap-2 text-xs">
                                            <input
                                              type="checkbox"
                                              checked={optionChecked}
                                              onChange={(e) =>
                                                setEditor((prev) => ({
                                                  ...prev,
                                                  options: prev.options.map((o, i) => {
                                                    if (i !== optionIndex) return o;
                                                    return {
                                                      ...o,
                                                      modifiers: o.modifiers.map((m) => {
                                                        if (String(m.key || "").trim().toLowerCase() !== key) return m;
                                                        const existingOptions = Array.isArray(m.options) ? m.options : [];
                                                        const without = existingOptions.filter((assigned) =>
                                                          optionId != null
                                                            ? Number(assigned.option_id) !== optionId
                                                            : String(assigned.value || "") !== String(modifierOption.value || "")
                                                        );
                                                        return {
                                                          ...m,
                                                          options: e.target.checked
                                                            ? [...without, {
                                                                option_id: optionId != null ? optionId : undefined,
                                                                value: String(modifierOption.value || ""),
                                                                label: String(modifierOption.label || ""),
                                                                price_adjustment_override: null,
                                                              }]
                                                            : without,
                                                        };
                                                      }),
                                                    };
                                                  }),
                                                }))
                                              }
                                            />
                                            <span className="min-w-0 flex-1 truncate">{modifierOption.label || modifierOption.value}</span>
                                            <input
                                              type="number"
                                              step="0.01"
                                              disabled={!optionChecked}
                                              value={selectedOption?.price_adjustment_override == null ? "" : String(selectedOption.price_adjustment_override)}
                                              onChange={(e) =>
                                                setEditor((prev) => ({
                                                  ...prev,
                                                  options: prev.options.map((o, i) => {
                                                    if (i !== optionIndex) return o;
                                                    return {
                                                      ...o,
                                                      modifiers: o.modifiers.map((m) => {
                                                        if (String(m.key || "").trim().toLowerCase() !== key) return m;
                                                        return {
                                                          ...m,
                                                          options: (Array.isArray(m.options) ? m.options : []).map((assigned) =>
                                                            (optionId != null
                                                              ? Number(assigned.option_id) === optionId
                                                              : String(assigned.value || "") === String(modifierOption.value || ""))
                                                              ? { ...assigned, price_adjustment_override: e.target.value === "" ? null : Number(e.target.value) }
                                                              : assigned
                                                          ),
                                                        };
                                                      }),
                                                    };
                                                  }),
                                                }))
                                              }
                                              placeholder="override"
                                              className="w-24 rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50"
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveTemplate}
                    disabled={saving}
                    className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : editor.id ? "Update Template" : "Save Template"}
                  </button>
                  <button
                    type="button"
                    onClick={resetEditor}
                    disabled={saving}
                    className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-base font-semibold">Saved Hardware Templates</h2>
              {templates.length === 0 ? (
                <p className="text-sm text-slate-500">No hardware template yet.</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div key={`tpl-${template.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{template.name}</p>
                        <p className="text-xs text-slate-500">
                          {(Array.isArray(template.options) ? template.options : []).map((o) => `${o.label} ($${Number(o.unit_price || 0).toFixed(2)})`).join(" | ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(template)}
                          className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(template)}
                          disabled={deletingId === template.id}
                          className="rounded border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:opacity-50"
                        >
                          {deletingId === template.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-hardware-template-title"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-hardware-template-title" className="text-lg font-semibold text-slate-900">
              Delete hardware template?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This will remove {deleteTarget.name ? `"${deleteTarget.name}"` : "this hardware template"} and its saved options.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === deleteTarget.id}
                onClick={() => deleteTemplate(deleteTarget)}
                className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingId === deleteTarget.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminNavbar>
  );
}

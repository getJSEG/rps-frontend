"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "../../components/AdminNavbar";
import {
  productsAPI,
  type HardwareTemplate,
  type HardwareTemplateOption,
  type ModifierGroup,
} from "../../../utils/api";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";

type EditorTemplate = {
  id?: number;
  name: string;
  options: HardwareTemplateOption[];
};

function createEmptyOption(index: number, asDefault: boolean): HardwareTemplateOption {
  return {
    label: "",
    option_key: `option_${index + 1}`,
    unit_price: 0,
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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [templates, setTemplates] = useState<HardwareTemplate[]>([]);
  const [modifierCatalog, setModifierCatalog] = useState<ModifierGroup[]>([]);
  const [editor, setEditor] = useState<EditorTemplate>(createEmptyTemplate());

  const modifierCatalogByKey = useMemo(() => {
    const map = new Map<string, ModifierGroup>();
    for (const g of modifierCatalog) {
      map.set(String(g.key || "").trim().toLowerCase(), g);
    }
    return map;
  }, [modifierCatalog]);

  const loadData = async () => {
    const [templatesRes, catalogRes] = await Promise.all([
      productsAPI.getHardwareTemplatesAdmin(),
      productsAPI.getModifierCatalogAdmin(),
    ]);
    setTemplates(Array.isArray(templatesRes?.templates) ? templatesRes.templates : []);
    setModifierCatalog(Array.isArray(catalogRes?.groups) ? catalogRes.groups : []);
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
        return {
          ...opt,
          modifiers: checked
            ? [...without, { key, is_required: false }]
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
          is_default: !!opt.is_default,
          modifiers: (Array.isArray(opt.modifiers) ? opt.modifiers : []).map((m) => ({
            key: String(m.key || "").trim().toLowerCase(),
            is_required: !!m.is_required,
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

  const deleteTemplate = async (id: number) => {
    if (!window.confirm("Delete this hardware template?")) return;
    try {
      setDeletingId(id);
      await productsAPI.deleteHardwareTemplateAdmin(id);
      if (editor.id === id) resetEditor();
      await loadData();
      setMessage({ type: "success", text: "Hardware template deleted." });
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
                            <div className="max-h-40 space-y-1 overflow-auto">
                              {modifierCatalog.map((group) => {
                                const key = String(group.key || "").trim().toLowerCase();
                                const checked = attachedKeys.has(key);
                                return (
                                  <label key={`opt-${optionIndex}-mod-${key}`} className="flex items-center gap-2 text-xs text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) => toggleModifierForOption(optionIndex, key, e.target.checked)}
                                    />
                                    <span>{group.name} ({group.key})</span>
                                  </label>
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
                          onClick={() => deleteTemplate(Number(template.id))}
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
    </AdminNavbar>
  );
}

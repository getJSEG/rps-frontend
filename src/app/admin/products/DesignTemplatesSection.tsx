"use client";

import { useEffect, useRef, useState } from "react";
import { FiChevronDown, FiPlus, FiTrash2, FiX } from "react-icons/fi";
import {
  getProductImageUrl,
  productsAPI,
  type DesignTemplateUpload,
  type ProductDesignTemplate,
} from "../../../utils/api";

export type DesignTemplateDraft = Partial<DesignTemplateUpload> & {
  client_key: string;
  id?: number;
  name: string;
  uploading?: boolean;
  /** SVG key the row had when loaded from the server; a different key means an unsaved upload. */
  original_svg_storage_key?: string;
  /** Modifier options the template is for; empty = the product's default template. */
  modifier_option_ids?: number[];
  /** Modifiers added to the row before any option is ticked (form only, not saved). */
  added_group_ids?: number[];
};

const createDraftKey = () =>
  `design-template-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function designTemplateDraftsFromProduct(
  templates: ProductDesignTemplate[] | null | undefined
): DesignTemplateDraft[] {
  return (Array.isArray(templates) ? templates : []).map((t) => ({
    ...t,
    client_key: createDraftKey(),
    original_svg_storage_key: t.svg_storage_key,
  }));
}

/** Delete files uploaded in this form session that were never saved to the product. */
export async function cleanupUnsavedDesignTemplateUpload(draft: DesignTemplateDraft) {
  const isUnsaved =
    draft.svg_storage_key &&
    draft.image_storage_key &&
    (!draft.id || draft.svg_storage_key !== draft.original_svg_storage_key);
  if (!isUnsaved) return;
  try {
    await productsAPI.deleteUploadedDesignTemplate(draft.svg_storage_key!, draft.image_storage_key!);
  } catch (error) {
    console.error("Failed to clean up design template upload:", error);
  }
}

export function validateDesignTemplateDrafts(drafts: DesignTemplateDraft[]): string | null {
  for (const [i, d] of drafts.entries()) {
    const label = d.name.trim() || `Design template ${i + 1}`;
    if (d.uploading) return `${label}: wait for the upload to finish.`;
    if (!d.name.trim()) return `Design template ${i + 1}: enter a name.`;
    if (!d.svg_url || !d.image_url) return `${label}: upload the SVG or PNG file.`;
  }
  return null;
}

export function designTemplatePayload(drafts: DesignTemplateDraft[]) {
  return drafts.map((d, index) => ({
    id: d.id,
    name: d.name.trim(),
    svg_url: d.svg_url,
    svg_storage_key: d.svg_storage_key,
    image_url: d.image_url,
    image_storage_key: d.image_storage_key,
    image_width_px: d.image_width_px,
    image_height_px: d.image_height_px,
    sort_order: index,
    modifier_option_ids: d.modifier_option_ids ?? [],
  }));
}

/** The product's modifiers, offered as "use this template when…" options. */
export type DesignTemplateModifierGroup = {
  id: number;
  name: string;
  options: Array<{ id: number; label: string }>;
};

/** "+ Add modifier" dropdown styled like the admin (the native select list can't be themed). */
function AddModifierMenu({
  groups,
  onSelect,
}: {
  groups: DesignTemplateModifierGroup[];
  onSelect: (groupId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add modifier"
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        <FiPlus size={13} aria-hidden />
        Add modifier
        <FiChevronDown size={13} aria-hidden className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-30 mt-1.5 max-h-60 min-w-[200px] overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              role="menuitem"
              onClick={() => {
                onSelect(g.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {g.name}
              <span className="text-[11px] font-normal text-slate-400">{g.options.length} options</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Props = {
  drafts: DesignTemplateDraft[];
  onChange: (updater: (prev: DesignTemplateDraft[]) => DesignTemplateDraft[]) => void;
  showMsg: (type: "success" | "error", text: string) => void;
  inputClass: string;
  modifierGroups: DesignTemplateModifierGroup[];
};

export default function DesignTemplatesSection({ drafts, onChange, showMsg, inputClass, modifierGroups }: Props) {
  const updateRow = (clientKey: string, patch: Partial<DesignTemplateDraft>) => {
    onChange((prev) => prev.map((row) => (row.client_key === clientKey ? { ...row, ...patch } : row)));
  };

  const toggleModifierOption = (row: DesignTemplateDraft, optionId: number) => {
    const current = row.modifier_option_ids ?? [];
    updateRow(row.client_key, {
      modifier_option_ids: current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId],
    });
  };

  /** Modifiers shown on a row: those with a ticked option, plus ones just added. */
  const shownGroups = (row: DesignTemplateDraft) => {
    const ticked = new Set(row.modifier_option_ids ?? []);
    const added = new Set(row.added_group_ids ?? []);
    return modifierGroups.filter((g) => added.has(g.id) || g.options.some((o) => ticked.has(o.id)));
  };

  const addModifier = (row: DesignTemplateDraft, groupId: number) => {
    updateRow(row.client_key, { added_group_ids: [...(row.added_group_ids ?? []), groupId] });
  };

  const removeModifier = (row: DesignTemplateDraft, group: DesignTemplateModifierGroup) => {
    const optionIds = new Set(group.options.map((o) => o.id));
    updateRow(row.client_key, {
      modifier_option_ids: (row.modifier_option_ids ?? []).filter((id) => !optionIds.has(id)),
      added_group_ids: (row.added_group_ids ?? []).filter((id) => id !== group.id),
    });
  };

  const addRow = () => {
    onChange((prev) => [...prev, { client_key: createDraftKey(), name: "" }]);
  };

  const removeRow = async (row: DesignTemplateDraft) => {
    onChange((prev) => prev.filter((item) => item.client_key !== row.client_key));
    await cleanupUnsavedDesignTemplateUpload(row);
  };

  const handleUpload = async (row: DesignTemplateDraft, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/\.(svg|png)$/i.test(file.name)) {
      showMsg("error", "Design templates must be SVG or PNG files.");
      return;
    }
    updateRow(row.client_key, { uploading: true });
    try {
      const uploaded = await productsAPI.uploadDesignTemplate(file);
      await cleanupUnsavedDesignTemplateUpload(row);
      updateRow(row.client_key, {
        svg_url: uploaded.svg_url,
        svg_storage_key: uploaded.svg_storage_key,
        image_url: uploaded.image_url,
        image_storage_key: uploaded.image_storage_key,
        image_width_px: uploaded.image_width_px,
        image_height_px: uploaded.image_height_px,
        name: row.name || file.name.replace(/\.(svg|png)$/i, ""),
        uploading: false,
      });
      showMsg("success", "Design template uploaded.");
    } catch (err: unknown) {
      updateRow(row.client_key, { uploading: false });
      showMsg("error", err instanceof Error ? err.message : "Design template upload failed");
    }
  };

  return (
    <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Design Editor Templates</p>
          <p className="mt-1 text-xs text-slate-500">
            SVG or PNG templates customers open in the design editor. Files are saved as uploaded.
          </p>
          {modifierGroups.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              Add the modifiers a template is for and tick their options; it opens automatically when the customer
              picks them. A template with no modifiers added is the default.
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
        >
          + Add design template
        </button>
      </div>

      {drafts.length === 0 ? (
        <p className="text-xs text-slate-400">No design templates. Customers will only be able to upload artwork.</p>
      ) : (
        <div className="space-y-3">
          {drafts.map((row) => {
            return (
              <div key={row.client_key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
                    {row.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getProductImageUrl(row.image_url)}
                        alt={row.name || "Design template preview"}
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="px-2 text-center text-[11px] text-slate-400">No file</span>
                    )}
                  </div>
                  <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr]">
                    <label>
                      <span className="mb-1 block text-xs font-medium text-slate-600">Template Name</span>
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.client_key, { name: e.target.value })}
                        placeholder="Example: Feather Angled XL Double Sided"
                        className={inputClass}
                      />
                    </label>
                    <div>
                      <span className="mb-1 block text-xs font-medium text-slate-600">Template File</span>
                      <label className="inline-block cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                        {row.uploading ? "Uploading…" : row.svg_url ? "Replace file" : "Choose SVG or PNG"}
                        <input
                          type="file"
                          accept=".svg,.png,image/svg+xml,image/png"
                          className="hidden"
                          disabled={row.uploading}
                          onChange={(e) => void handleUpload(row, e)}
                        />
                      </label>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeRow(row)}
                    disabled={row.uploading}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-rose-200 bg-white px-3 text-rose-600 shadow-sm hover:bg-rose-50"
                    title="Remove design template"
                  >
                    <FiTrash2 size={17} aria-hidden />
                  </button>
                </div>
                {modifierGroups.length > 0 ? (() => {
                  const shown = shownGroups(row);
                  const addable = modifierGroups.filter((g) => !shown.includes(g));
                  return (
                    <div className="mt-3 border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs font-medium text-slate-600">
                        Use this template when the customer picks
                        {(row.modifier_option_ids ?? []).length === 0 ? (
                          <span className="ml-1 font-normal text-slate-400">(no options ticked: default template)</span>
                        ) : null}
                      </p>
                      <div className="space-y-2">
                        {shown.map((group) => (
                          <div key={group.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="min-w-[120px] text-xs font-semibold text-slate-700">{group.name}</span>
                            {group.options.map((opt) => (
                              <label key={opt.id} className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={(row.modifier_option_ids ?? []).includes(opt.id)}
                                  onChange={() => toggleModifierOption(row, opt.id)}
                                  className="h-3.5 w-3.5 accent-slate-900"
                                />
                                {opt.label}
                              </label>
                            ))}
                            <button
                              type="button"
                              onClick={() => removeModifier(row, group)}
                              className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              title={`Remove ${group.name}`}
                              aria-label={`Remove ${group.name}`}
                            >
                              <FiX size={14} aria-hidden />
                            </button>
                          </div>
                        ))}
                        {addable.length > 0 ? (
                          <AddModifierMenu groups={addable} onSelect={(groupId) => addModifier(row, groupId)} />
                        ) : null}
                      </div>
                    </div>
                  );
                })() : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

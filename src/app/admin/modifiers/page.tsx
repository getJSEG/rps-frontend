"use client";

import { useEffect, useState } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import { productsAPI, type ModifierGroup, type ModifierPreset } from "../../../utils/api";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { useRouter } from "next/navigation";

type UiModifierGroup = ModifierGroup & { __uiid: string };

function newUiId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `mod-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyEditorGroup(): UiModifierGroup {
  return {
    __uiid: newUiId(),
    key: "",
    name: "",
    input_type: "dropdown",
    options: [{ label: "", value: "", price_adjustment: 0, price_type: "percent", is_default: false }],
  };
}

export default function AdminModifiersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [editorGroup, setEditorGroup] = useState<UiModifierGroup>(emptyEditorGroup());
  const [savedCatalog, setSavedCatalog] = useState<UiModifierGroup[]>([]);
  const [editingSavedKey, setEditingSavedKey] = useState<string | null>(null);
  const [activeListingUiid, setActiveListingUiid] = useState<string | null>(null);
  const [pendingDeleteUiid, setPendingDeleteUiid] = useState<string | null>(null);
  const [presets, setPresets] = useState<ModifierPreset[]>([]);
  const [modifiersTab, setModifiersTab] = useState<"catalog" | "presets">("catalog");
  const [presetName, setPresetName] = useState("");
  const [presetModifierIds, setPresetModifierIds] = useState<number[]>([]);
  const [editingPresetId, setEditingPresetId] = useState<number | null>(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [pendingDeletePresetId, setPendingDeletePresetId] = useState<number | null>(null);

  const loadPresetsFromServer = async () => {
    try {
      const presetsRes = await productsAPI.getModifierPresetsAdmin();
      setPresets(Array.isArray(presetsRes?.presets) ? presetsRes.presets : []);
    } catch {
      setPresets([]);
    }
  };

  const loadCatalogFromServer = async () => {
    const catalogRes = await productsAPI.getModifierCatalogAdmin();
    const incoming = Array.isArray(catalogRes?.groups) ? catalogRes.groups : [];
    setSavedCatalog(
      incoming.map((g: ModifierGroup) => ({
        ...g,
        __uiid: newUiId(),
      }))
    );
    await loadPresetsFromServer();
  };

  useEffect(() => {
    if (!isAuthenticated() || !canAccessAdminPanel()) {
      router.push("/");
      return;
    }
    const run = async () => {
      setLoading(true);
      try {
        const catalogRes = await productsAPI.getModifierCatalogAdmin();
        const incoming = Array.isArray(catalogRes?.groups) ? catalogRes.groups : [];
        setSavedCatalog(
          incoming.map((g: ModifierGroup) => ({
            ...g,
            __uiid: newUiId(),
          }))
        );
        await loadPresetsFromServer();
        setEditorGroup(emptyEditorGroup());
        setEditingSavedKey(null);
      } catch (e: unknown) {
        setMessageType("error");
        setMessage(e instanceof Error ? e.message : "Failed to load modifier data");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [router]);

  const saveCatalog = async () => {
    try {
      setSavingCatalog(true);
      setMessageType("success");
      setMessage("");
      const key = String(editorGroup.key || "").trim().toLowerCase();
      const name = String(editorGroup.name || "").trim();
      if (!key || !name) {
        setMessageType("error");
        setMessage("Group name and key are required.");
        return;
      }
      const isDuplicateKey = savedCatalog.some(
        (g) => String(g.key).toLowerCase() === key && String(g.key) !== String(editingSavedKey || "")
      );
      if (isDuplicateKey) {
        setMessageType("error");
        setMessage("Modifier key already exists. Use a unique key.");
        return;
      }
      const normalizedEditor: UiModifierGroup = {
        ...editorGroup,
        key,
        name,
        options: Array.isArray(editorGroup.options)
          ? editorGroup.options.map((o) => ({
              ...o,
              label: String(o.label || "").trim(),
              value: String(o.value || o.label || "").trim(),
              price_adjustment: Number(o.price_adjustment || 0),
              price_type: "percent",
              is_default: !!o.is_default,
            }))
          : [],
      };
      const nextSaved =
        editingSavedKey == null
          ? [...savedCatalog, { ...normalizedEditor, __uiid: newUiId() }]
          : savedCatalog.map((g) =>
              String(g.key) === String(editingSavedKey)
                ? { ...normalizedEditor, __uiid: g.__uiid }
                : g
            );
      await productsAPI.updateModifierCatalogAdmin({
        groups: nextSaved.map((g) => ({
          key: g.key,
          name: g.name,
          input_type: g.input_type,
          is_required: g.is_required,
          is_active: g.is_active,
          sort_order: g.sort_order,
          options: g.options,
        })),
      });
      await loadCatalogFromServer();
      setEditorGroup(emptyEditorGroup());
      setEditingSavedKey(null);
      setMessageType("success");
      setMessage(editingSavedKey == null ? `${name} created successfully.` : `${name} updated successfully.`);
    } catch (e: unknown) {
      setMessageType("error");
      setMessage(e instanceof Error ? e.message : "Failed to save modifier catalog");
    } finally {
      setSavingCatalog(false);
    }
  };


  const deleteGroupByUiid = async (uiid: string) => {
    setPendingDeleteUiid(uiid);
  };

  const confirmDeleteGroup = async () => {
    const uiid = pendingDeleteUiid;
    if (!uiid) return;
    const row = savedCatalog.find((g) => g.__uiid === uiid);
    if (!row) return;
    try {
      // If saved group has a key, delete immediately in DB.
      if (String(row.key || '').trim()) {
        await productsAPI.deleteModifierCatalogGroupAdmin(String(row.key));
      }
      await loadCatalogFromServer();
      if (String(editingSavedKey || "") === String(row.key)) {
        setEditorGroup(emptyEditorGroup());
        setEditingSavedKey(null);
      }
      if (activeListingUiid === uiid) setActiveListingUiid(null);
      setMessageType("success");
      setMessage(`${row.name || row.key} deleted successfully.`);
    } catch (e: unknown) {
      setMessageType("error");
      setMessage(e instanceof Error ? e.message : "Failed to delete modifier group");
    } finally {
      setPendingDeleteUiid(null);
    }
  };

  const updateGroupFromListing = async (uiid: string) => {
    const savedRow = savedCatalog.find((g) => g.__uiid === uiid);
    if (!savedRow) return;
    setEditorGroup({
      ...savedRow,
      __uiid: newUiId(),
      options: Array.isArray(savedRow.options)
        ? savedRow.options.map((o) => ({ ...o }))
        : [],
    });
    setEditingSavedKey(String(savedRow.key));
    setMessage("");
  };

  const clearPresetEditor = () => {
    setPresetName("");
    setPresetModifierIds([]);
    setEditingPresetId(null);
  };

  const addModifierIdToPreset = (groupId: number) => {
    if (!Number.isFinite(groupId) || groupId <= 0) return;
    setPresetModifierIds((prev) => (prev.includes(groupId) ? prev : [...prev, groupId]));
  };

  const removeModifierIdFromPreset = (groupId: number) => {
    setPresetModifierIds((prev) => prev.filter((x) => x !== groupId));
  };

  const movePresetModifier = (index: number, delta: number) => {
    setPresetModifierIds((prev) => {
      const j = index + delta;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const labelForGroupId = (groupId: number) => {
    const g = savedCatalog.find((x) => x.id === groupId);
    if (g) return `${g.name} [${g.key}]`;
    return `id ${groupId}`;
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      setMessageType("error");
      setMessage("Preset name is required.");
      return;
    }
    try {
      setSavingPreset(true);
      setMessage("");
      if (editingPresetId != null) {
        await productsAPI.updateModifierPresetAdmin(editingPresetId, {
          name,
          modifier_group_ids: presetModifierIds,
        });
        setMessageType("success");
        setMessage(`Preset "${name}" updated.`);
      } else {
        await productsAPI.createModifierPresetAdmin({
          name,
          modifier_group_ids: presetModifierIds,
        });
        setMessageType("success");
        setMessage(`Preset "${name}" created.`);
      }
      await loadPresetsFromServer();
      clearPresetEditor();
    } catch (e: unknown) {
      setMessageType("error");
      setMessage(e instanceof Error ? e.message : "Failed to save preset");
    } finally {
      setSavingPreset(false);
    }
  };

  const beginEditPreset = (p: ModifierPreset) => {
    setEditingPresetId(p.id);
    setPresetName(p.name);
    const ordered = [...p.modifiers].sort((a, b) => a.sort_order - b.sort_order);
    setPresetModifierIds(ordered.map((m) => m.modifier_group_id));
    setMessage("");
  };

  const confirmDeletePreset = async () => {
    const id = pendingDeletePresetId;
    if (id == null) return;
    try {
      await productsAPI.deleteModifierPresetAdmin(id);
      await loadPresetsFromServer();
      if (editingPresetId === id) clearPresetEditor();
      setMessageType("success");
      setMessage("Preset deleted.");
    } catch (e: unknown) {
      setMessageType("error");
      setMessage(e instanceof Error ? e.message : "Failed to delete preset");
    } finally {
      setPendingDeletePresetId(null);
    }
  };

  const catalogGroupsWithId = savedCatalog.filter(
    (g): g is UiModifierGroup & { id: number } =>
      g.id != null && typeof g.id === "number" && Number.isFinite(g.id) && g.id > 0
  );

  const addableModifierGroups = catalogGroupsWithId.filter((g) => !presetModifierIds.includes(g.id));

  return (
    <AdminNavbar title="Modifiers" subtitle="Manage modifier fields and per-product assignments">
      <div className="mx-auto w-full max-w-3xl">
      {message ? (
        <div
          className={`rounded px-3 py-2 text-sm ${
            messageType === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {message}
        </div>
      ) : null}
      {loading ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setModifiersTab("catalog")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                modifiersTab === "catalog"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Modifier catalog
            </button>
            <button
              type="button"
              onClick={() => setModifiersTab("presets")}
              className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                modifiersTab === "presets"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Modifier presets
            </button>
          </div>

          {modifiersTab === "catalog" ? (
          <section className="rounded border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold">Modifier catalog</h2>
            <div className="space-y-4">
                <div className="rounded border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input className="rounded border px-2 py-1 text-sm" value={editorGroup.name} onChange={(e) => setEditorGroup((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name" />
                    <input className="rounded border px-2 py-1 text-sm" value={editorGroup.key} onChange={(e) => setEditorGroup((prev) => ({ ...prev, key: e.target.value }))} placeholder="key" />
                  </div>
                  <div className="mt-2">
                    <label className="text-xs text-slate-600">Input type</label>
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-sm"
                      value={
                        editorGroup.input_type === "radio"
                          ? "dropdown"
                          : editorGroup.input_type || "dropdown"
                      }
                      onChange={(e) => setEditorGroup((prev) => ({ ...prev, input_type: e.target.value }))}
                    >
                      <option value="dropdown">Dropdown</option>
                      {/* Radio option omitted in UI until storefront supports input_type radio */}
                    </select>
                  </div>
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-5 gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>Label</span>
                      <span>Value</span>
                      <span>Percent</span>
                      <span>Default</span>
                      <span>Action</span>
                    </div>
                    {editorGroup.options.map((opt, oi) => (
                      <div key={`opt-row-${oi}`} className="grid grid-cols-5 gap-2">
                        <input className="rounded border px-2 py-1 text-sm" value={opt.label} onChange={(e) => setEditorGroup((prev) => ({ ...prev, options: prev.options.map((o, j) => j === oi ? { ...o, label: e.target.value } : o) }))} />
                        <input className="rounded border px-2 py-1 text-sm" value={opt.value} onChange={(e) => setEditorGroup((prev) => ({ ...prev, options: prev.options.map((o, j) => j === oi ? { ...o, value: e.target.value } : o) }))} />
                        <input
                          className="rounded border px-2 py-1 text-sm"
                          type="text"
                          inputMode="decimal"
                          value={String(opt.price_adjustment ?? "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v !== "" && !/^\d*\.?\d*$/.test(v)) return;
                            setEditorGroup((prev) => ({
                              ...prev,
                              options: prev.options.map((o, j) =>
                                j === oi
                                  ? {
                                      ...o,
                                      price_adjustment: v === "" ? 0 : Number(v),
                                      price_type: "percent",
                                    }
                                  : o
                              ),
                            }));
                          }}
                          placeholder="0.00"
                        />
                        <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={!!opt.is_default}
                            onChange={(e) =>
                              setEditorGroup((prev) => ({
                                ...prev,
                                options: prev.options.map((o, j) => ({
                                  ...o,
                                  is_default: e.target.checked ? j === oi : (j === oi ? false : !!o.is_default),
                                })),
                              }))
                            }
                          />
                          Default
                        </label>
                        <button
                          type="button"
                          className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                          onClick={() =>
                            setEditorGroup((prev) => ({
                              ...prev,
                              options: prev.options.filter((_, j) => j !== oi),
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs"
                        onClick={() =>
                          setEditorGroup((prev) => ({
                            ...prev,
                            options: [
                              ...prev.options,
                              {
                                label: "",
                                value: "",
                                price_adjustment: 0,
                                price_type: "percent",
                                is_default: false,
                              },
                            ],
                          }))
                        }
                      >
                        + Option
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                        onClick={() => {
                          setEditorGroup(emptyEditorGroup());
                          setEditingSavedKey(null);
                        }}
                      >
                        Clear Form
                      </button>
                    </div>
                  </div>
                </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" className="rounded bg-slate-900 px-3 py-2 text-sm text-white" onClick={saveCatalog} disabled={savingCatalog}>{savingCatalog ? "Saving..." : editingSavedKey ? "Update Modifier" : "Create Modifier"}</button>
            </div>
            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-semibold text-slate-800">Created Modifiers Listing</p>
              {savedCatalog.length === 0 ? (
                <p className="text-xs text-slate-500">No modifier groups created yet.</p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {[...savedCatalog].reverse().map((g) => (
                    <li key={`list-${g.__uiid}`} className="rounded border border-slate-200 bg-white p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() =>
                            setActiveListingUiid((prev) => (prev === g.__uiid ? null : g.__uiid))
                          }
                        >
                          <span className="font-semibold">{g.name || "(no name)"}</span>{" "}
                          <span className="text-slate-500">[{g.key || "no_key"}]</span>{" "}
                          - {Array.isArray(g.options) ? g.options.length : 0} options
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="rounded border px-2 py-1 text-[11px]"
                            onClick={() =>
                              setActiveListingUiid((prev) => (prev === g.__uiid ? null : g.__uiid))
                            }
                          >
                            {activeListingUiid === g.__uiid ? "Hide" : "View"}
                          </button>
                          <button
                            type="button"
                            className="rounded border border-sky-200 px-2 py-1 text-[11px] text-sky-700"
                            onClick={() => updateGroupFromListing(g.__uiid)}
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-700"
                            onClick={() => void deleteGroupByUiid(g.__uiid)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {activeListingUiid === g.__uiid ? (
                        <div className="mt-2 rounded border border-slate-100 bg-slate-50 p-2">
                          <p className="text-[11px] text-slate-600">
                            Input: <span className="font-medium text-slate-800">{g.input_type || "dropdown"}</span>
                          </p>
                          {Array.isArray(g.options) && g.options.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {g.options.map((o, oi) => (
                                <li key={`${g.__uiid}-opt-${oi}`} className="text-[11px] text-slate-700">
                                  {o.label || "(no label)"} [{o.value || "no_value"}] -{" "}
                                  {Number(o.price_adjustment || 0) >= 0 ? "+" : ""}
                                  {Number(o.price_adjustment || 0).toFixed(2)}%
                                  {o.is_default ? " (default)" : ""}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-[11px] text-slate-500">No options yet.</p>
                          )}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          ) : (
          <section className="rounded border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-base font-semibold">Modifier presets</h2>
              <div className="space-y-4">
                <div className="rounded border border-slate-200 p-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-medium text-slate-600">Preset name</label>
                      <input
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="e.g. Banner Modifier Set"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Add modifier</label>
                      <select
                        className="mt-1 w-full rounded border px-2 py-1 text-sm"
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) addModifierIdToPreset(Number(v));
                          e.target.value = "";
                        }}
                      >
                        <option value="">Choose a saved modifier…</option>
                        {addableModifierGroups.map((g) => (
                          <option key={g.__uiid} value={g.id}>
                            {g.name} ({g.key})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {catalogGroupsWithId.length === 0 && savedCatalog.length > 0 ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Save each modifier once so it gets a database id; then you can add it to a preset.
                    </p>
                  ) : null}
                  {presetModifierIds.length > 0 ? (
                    <ul className="mt-3 space-y-1 rounded border border-slate-100 bg-slate-50 p-2">
                      {presetModifierIds.map((gid, idx) => (
                        <li
                          key={`preset-mod-${gid}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded bg-white px-2 py-1.5 text-xs text-slate-800"
                        >
                          <span>{labelForGroupId(gid)}</span>
                          <span className="flex shrink-0 gap-1">
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 text-[11px]"
                              disabled={idx === 0}
                              onClick={() => movePresetModifier(idx, -1)}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className="rounded border px-1.5 py-0.5 text-[11px]"
                              disabled={idx === presetModifierIds.length - 1}
                              onClick={() => movePresetModifier(idx, 1)}
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              className="rounded border border-rose-200 px-1.5 py-0.5 text-[11px] text-rose-700"
                              onClick={() => removeModifierIdFromPreset(gid)}
                            >
                              Remove
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No modifiers in this preset yet.</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
                      disabled={savingPreset}
                      onClick={() => void savePreset()}
                    >
                      {savingPreset ? "Saving…" : editingPresetId != null ? "Update preset" : "Create preset"}
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-700"
                      onClick={() => clearPresetEditor()}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-800">Saved presets</p>
                  {presets.length === 0 ? (
                    <p className="text-xs text-slate-500">No presets yet.</p>
                  ) : (
                    <ul className="space-y-2 text-xs text-slate-700">
                      {[...presets].reverse().map((p) => (
                        <li key={`preset-${p.id}`} className="rounded border border-slate-200 bg-white p-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <span className="font-semibold text-slate-900">{p.name}</span>
                              <span className="ml-2 text-slate-500">
                                {p.modifiers.length} modifier{p.modifiers.length === 1 ? "" : "s"}
                              </span>
                              {p.modifiers.length > 0 ? (
                                <ul className="mt-1 list-inside list-disc text-[11px] text-slate-600">
                                  {[...p.modifiers]
                                    .sort((a, b) => a.sort_order - b.sort_order)
                                    .map((m) => (
                                      <li key={`${p.id}-m-${m.modifier_group_id}`}>
                                        {m.name} [{m.key}]
                                      </li>
                                    ))}
                                </ul>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                className="rounded border border-sky-200 px-2 py-1 text-[11px] text-sky-700"
                                onClick={() => beginEditPreset(p)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="rounded border border-rose-200 px-2 py-1 text-[11px] text-rose-700"
                                onClick={() => setPendingDeletePresetId(p.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
          </section>
          )}

        </div>
      )}
      {pendingDeletePresetId != null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Delete preset?</h3>
            <p className="mt-1 text-sm text-slate-600">
              This removes the preset only. Catalog modifiers are not deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                onClick={() => setPendingDeletePresetId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white"
                onClick={() => void confirmDeletePreset()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : pendingDeleteUiid ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Are you sure?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Delete this modifier group? This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                onClick={() => setPendingDeleteUiid(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white"
                onClick={() => void confirmDeleteGroup()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </AdminNavbar>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FiArrowDown, FiArrowUp, FiEdit2, FiTrash2 } from "react-icons/fi";
import AdminNavbar from "../../components/AdminNavbar";
import { helpCenterAPI, type HelpCategory, type HelpFaq } from "../../../utils/api";

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100";

type FaqForm = { id: number | null; question: string; answer: string };
type DeleteTarget = { kind: "category" | "faq"; id: number; label: string };

const EMPTY_FAQ_FORM: FaqForm = { id: null, question: "", answer: "" };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Swap item `index` with its neighbour in `direction`; null when it can't move. */
function moved<T extends { id: number }>(list: T[], index: number, direction: -1 | 1): number[] | null {
  const target = index + direction;
  if (target < 0 || target >= list.length) return null;
  const ids = list.map((item) => item.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return ids;
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? "Visible" : "Hidden"}
    </span>
  );
}

function OrderButtons({ onUp, onDown, disabled }: { onUp: () => void; onDown: () => void; disabled: boolean }) {
  const cls =
    "rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40";
  return (
    <>
      <button type="button" onClick={onUp} disabled={disabled} className={cls} aria-label="Move up" title="Move up">
        <FiArrowUp size={14} />
      </button>
      <button type="button" onClick={onDown} disabled={disabled} className={cls} aria-label="Move down" title="Move down">
        <FiArrowDown size={14} />
      </button>
    </>
  );
}

export default function AdminHelpCenterPage() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [faqForm, setFaqForm] = useState<FaqForm>(EMPTY_FAQ_FORM);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const applyCategories = (list: HelpCategory[]) => {
    setCategories(list);
    setSelectedId((cur) => (cur != null && list.some((c) => c.id === cur) ? cur : list[0]?.id ?? null));
  };

  const load = async () => {
    const res = await helpCenterAPI.getAdmin();
    applyCategories(Array.isArray(res?.categories) ? res.categories : []);
  };

  useEffect(() => {
    helpCenterAPI
      .getAdmin()
      .then((res) => {
        const list = Array.isArray(res?.categories) ? res.categories : [];
        setCategories(list);
        setSelectedId(list[0]?.id ?? null);
      })
      .catch((error: unknown) => toast.error(errorMessage(error, "Failed to load the Help Center.")))
      .finally(() => setLoading(false));
  }, []);

  /** Run a change, reload the list, and report errors. */
  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      setBusy(true);
      await action();
      await load();
      if (success) toast.success(success);
      return true;
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Something went wrong."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const selected = categories.find((c) => c.id === selectedId) ?? null;

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    const ok = await run(() => helpCenterAPI.createCategory({ name }), "Category added.");
    if (ok) setNewCategoryName("");
  };

  const saveRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renaming || !renaming.name.trim()) return;
    const ok = await run(() => helpCenterAPI.updateCategory(renaming.id, { name: renaming.name.trim() }), "Category renamed.");
    if (ok) setRenaming(null);
  };

  const moveCategory = (index: number, direction: -1 | 1) => {
    const ids = moved(categories, index, direction);
    if (ids) void run(() => helpCenterAPI.reorderCategories(ids));
  };

  const moveFaq = (faqs: HelpFaq[], index: number, direction: -1 | 1) => {
    const ids = moved(faqs, index, direction);
    if (ids && selected) void run(() => helpCenterAPI.reorderFaqs(selected.id, ids));
  };

  const saveFaq = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const question = faqForm.question.trim();
    const answer = faqForm.answer.trim();
    if (!question || !answer) {
      toast.error("Question and answer are both required.");
      return;
    }
    const ok = faqForm.id
      ? await run(() => helpCenterAPI.updateFaq(faqForm.id as number, { question, answer }), "Question updated.")
      : await run(() => helpCenterAPI.createFaq({ categoryId: selected.id, question, answer }), "Question added.");
    if (ok) setFaqForm(EMPTY_FAQ_FORM);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const ok = await run(
      () => (target.kind === "category" ? helpCenterAPI.deleteCategory(target.id) : helpCenterAPI.deleteFaq(target.id)),
      target.kind === "category" ? "Category deleted." : "Question deleted."
    );
    if (ok) {
      setDeleteTarget(null);
      if (target.kind === "faq" && faqForm.id === target.id) setFaqForm(EMPTY_FAQ_FORM);
    }
  };

  return (
    <AdminNavbar title="Help Center"subtitle="Manage the categories and questions shown on the Help Center page">
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Categories</h2>
            <form onSubmit={addCategory} className="mb-4 flex gap-2">
              <input
                className={FIELD_CLASS}
                placeholder="New category, e.g. Shipping"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                maxLength={120}
              />
              <button
                type="submit"
                disabled={busy || !newCategoryName.trim()}
                className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                Add
              </button>
            </form>

            {categories.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                No categories yet. Add one to start writing questions.
              </p>
            ) : (
              <ul className="space-y-2">
                {categories.map((c, index) => {
                  const isSelected = c.id === selectedId;
                  return (
                    <li
                      key={c.id}
                      className={`rounded-lg border p-3 transition ${
                        isSelected ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {renaming?.id === c.id ? (
                        <form onSubmit={saveRename} className="flex gap-2">
                          <input
                            className={FIELD_CLASS}
                            value={renaming.name}
                            onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                            maxLength={120}
                            autoFocus
                          />
                          <button type="submit" disabled={busy} className="rounded-lg bg-sky-600 px-3 text-sm font-medium text-white">
                            Save
                          </button>
                          <button type="button" onClick={() => setRenaming(null)} className="rounded-lg border border-slate-300 px-3 text-sm">
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(c.id);
                              setFaqForm(EMPTY_FAQ_FORM);
                            }}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <span className="font-medium text-slate-900">{c.name}</span>
                            <span className="text-xs text-slate-500">{c.faqs.length} questions</span>
                          </button>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <ActiveBadge active={c.isActive} />
                            <span className="flex-1" />
                            <OrderButtons
                              onUp={() => moveCategory(index, -1)}
                              onDown={() => moveCategory(index, 1)}
                              disabled={busy}
                            />
                            <button
                              type="button"
                              onClick={() => void run(() => helpCenterAPI.updateCategory(c.id, { isActive: !c.isActive }))}
                              disabled={busy}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                            >
                              {c.isActive ? "Hide" : "Show"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenaming({ id: c.id, name: c.name })}
                              className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                              aria-label="Rename category"
                              title="Rename"
                            >
                              <FiEdit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget({ kind: "category", id: c.id, label: c.name })}
                              className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                              aria-label="Delete category"
                              title="Delete"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {!selected ? (
              <p className="text-sm text-slate-500">Select or add a category to manage its questions.</p>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Questions in “{selected.name}”</h2>
                {!selected.isActive ? (
                  <p className="mt-1 text-xs text-amber-700">This category is hidden, so its questions don’t show on the site.</p>
                ) : null}

                <form onSubmit={saveFaq} className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  <p className="text-sm font-medium text-slate-800">{faqForm.id ? "Edit question" : "Add a question"}</p>
                  <input
                    className={FIELD_CLASS}
                    placeholder="Question"
                    value={faqForm.question}
                    onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
                    maxLength={500}
                  />
                  <textarea
                    className={`${FIELD_CLASS} min-h-28`}
                    placeholder="Answer"
                    value={faqForm.answer}
                    onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
                  />
                  <div className="flex justify-end gap-2">
                    {faqForm.id ? (
                      <button
                        type="button"
                        onClick={() => setFaqForm(EMPTY_FAQ_FORM)}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-white"
                      >
                        Cancel
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {faqForm.id ? "Save Question" : "Add Question"}
                    </button>
                  </div>
                </form>

                {selected.faqs.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
                    No questions in this category yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {selected.faqs.map((f, index) => (
                      <li
                        key={f.id}
                        className={`rounded-lg border p-3 ${faqForm.id === f.id ? "border-sky-400 bg-sky-50/40" : "border-slate-200"}`}
                      >
                        <p className="font-medium text-slate-900">{f.question}</p>
                        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{f.answer}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <ActiveBadge active={f.isActive} />
                          <span className="flex-1" />
                          <OrderButtons
                            onUp={() => moveFaq(selected.faqs, index, -1)}
                            onDown={() => moveFaq(selected.faqs, index, 1)}
                            disabled={busy}
                          />
                          <button
                            type="button"
                            onClick={() => void run(() => helpCenterAPI.updateFaq(f.id, { isActive: !f.isActive }))}
                            disabled={busy}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            {f.isActive ? "Hide" : "Show"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFaqForm({ id: f.id, question: f.question, answer: f.answer })}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                            aria-label="Edit question"
                            title="Edit"
                          >
                            <FiEdit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ kind: "faq", id: f.id, label: f.question })}
                            className="rounded-md border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                            aria-label="Delete question"
                            title="Delete"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Delete {deleteTarget.kind === "category" ? "category" : "question"}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">“{deleteTarget.label}”</span>
              {deleteTarget.kind === "category" ? " and all of its questions will be deleted." : " will be deleted."}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busy}
                className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AdminNavbar>
  );
}

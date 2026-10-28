"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiSearch } from "react-icons/fi";
import InfoPageLayout from "../components/InfoPageLayout";
import { helpCenterAPI, type HelpCategory, type HelpFaq } from "../../utils/api";

function FaqItem({ faq, open, onToggle }: { faq: HelpFaq; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <span className="font-medium text-gray-900">{faq.question}</span>
        <FiChevronDown
          className={`shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{faq.answer}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function HelpCenterPage() {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    helpCenterAPI
      .get()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res?.categories) ? res.categories : [];
        setCategories(list);
        setActiveId(list[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("The Help Center could not be loaded. Please try again later.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const search = query.trim().toLowerCase();

  /** While searching, every category's matching questions; otherwise just the selected category. */
  const visible = useMemo(() => {
    if (search) {
      return categories
        .map((c) => ({
          ...c,
          faqs: c.faqs.filter(
            (f) => f.question.toLowerCase().includes(search) || f.answer.toLowerCase().includes(search)
          ),
        }))
        .filter((c) => c.faqs.length > 0);
    }
    return categories.filter((c) => c.id === activeId);
  }, [categories, activeId, search]);

  const selectCategory = (id: number) => {
    setActiveId(id);
    setQuery("");
    setOpenFaqId(null);
  };

  return (
    <InfoPageLayout title="Help Center" subtitle="Answers to common questions about ordering, artwork, shipping and more.">
      <div className="relative mx-auto mb-8 max-w-xl">
        <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenFaqId(null);
          }}
          placeholder="Search questions"
          aria-label="Search help questions"
          className="w-full rounded-full border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-[#0B6BCB] focus:ring-2 focus:ring-[#0B6BCB]/20"
        />
      </div>

      {loading ? (
        <p className="text-center text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="text-center text-sm text-rose-600">{error}</p>
      ) : categories.length === 0 ? (
        <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="font-medium text-gray-900">Help articles are coming soon.</p>
          <p className="mt-1 text-sm text-gray-500">In the meantime, our team is happy to help.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 md:flex-row">
          <nav className="md:w-60 md:shrink-0" aria-label="Help categories">
            <select
              value={activeId ?? ""}
              onChange={(e) => selectCategory(Number(e.target.value))}
              aria-label="Help category"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm md:hidden"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ul className="hidden overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:block">
              {categories.map((c) => {
                const active = !search && c.id === activeId;
                return (
                  <li key={c.id} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => selectCategory(c.id)}
                      className={`flex w-full items-center justify-between gap-2 border-l-2 px-4 py-3 text-left text-sm transition-colors ${
                        active
                          ? "border-[#f47b23] bg-orange-50/60 font-semibold text-gray-900"
                          : "border-transparent text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{c.name}</span>
                      <span className="text-xs text-gray-400">{c.faqs.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="min-w-0 flex-1 space-y-8">
            {visible.length === 0 ? (
              <p className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-600">
                No questions match “{query.trim()}”.
              </p>
            ) : (
              visible.map((c) => (
                <section key={c.id}>
                  <h2 className="mb-3 text-lg font-semibold text-gray-900">{c.name}</h2>
                  <div className="space-y-3">
                    {c.faqs.map((f) => (
                      <FaqItem
                        key={f.id}
                        faq={f}
                        open={openFaqId === f.id}
                        onToggle={() => setOpenFaqId((cur) => (cur === f.id ? null : f.id))}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}

      <p className="mt-10 text-center text-sm text-gray-600">
        Still need help?{" "}
        <Link href="/contact-us" className="font-medium text-[#0B6BCB] hover:underline">
          Contact us
        </Link>
      </p>
    </InfoPageLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminNavbar from "../../components/AdminNavbar";
import { shippingRatesAPI, type ShippingRates } from "../../../utils/api";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";

export default function AdminShippingRatesPage() {
  const router = useRouter();
  const [rates, setRates] = useState<ShippingRates>({ ground: 0, express: 0, overnight: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated() || !canAccessAdminPanel()) {
      router.push("/");
      return;
    }
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await shippingRatesAPI.get();
        if (!c && res?.rates) setRates(res.rates);
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : "Failed to load rates");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [router]);

  const handleChange = (key: keyof ShippingRates, raw: string) => {
    const n = parseFloat(raw);
    setRates((prev) => ({ ...prev, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await shippingRatesAPI.update(rates);
      if (res?.rates) setRates(res.rates);
      setMessage("Shipping charges saved. They apply to new checkouts immediately.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminNavbar title="Rates" subtitle="Shipping charges used at checkout">
      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <Link
          href="/admin"
          className="mb-6 inline-flex text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          ← Back to orders
        </Link>

        <h2 className="text-lg font-bold text-slate-900">Shipping charges</h2>

        {loading ? (
          <p className="mt-8 text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {(
              [
                { key: "ground" as const, label: "Ground" },
                { key: "express" as const, label: "Express" },
                { key: "overnight" as const, label: "Overnight" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <label htmlFor={key} className="block text-sm font-medium text-slate-700">
                  {label} (USD)
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    id={key}
                    type="number"
                    min={0}
                    step={0.01}
                    value={rates[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
            ))}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {message && <p className="text-sm text-emerald-700">{message}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save rates"}
            </button>
          </form>
        )}
      </div>
    </AdminNavbar>
  );
}

"use client";

import { useState, useEffect } from "react";
import AdminNavbar from "../../components/AdminNavbar";
import {
  shippingRatesAPI,
  type ShippingRates,
  type FreeShippingPolicy,
  type ShippingTier,
} from "../../../utils/api";

const isFloatInput = (v: string) => v === "" || /^\d*\.?\d*$/.test(v);

const DISCOUNT_TIERS: Array<{ key: ShippingTier; label: string }> = [
  { key: "economy", label: "Economy" },
  { key: "standard", label: "Standard" },
  { key: "express", label: "Express" },
];

function normalizePolicy(res: { freeShippingEnabled?: boolean; freeShippingThreshold?: number }): FreeShippingPolicy {
  return {
    freeShippingEnabled: !!res.freeShippingEnabled,
    freeShippingThreshold: Math.max(0, Number(res.freeShippingThreshold) || 0),
  };
}

export default function AdminShippingRatesPage() {
  const [error, setError] = useState("");
  const [legacyRates, setLegacyRates] = useState<ShippingRates | null>(null);
  const [freePolicy, setFreePolicy] = useState<FreeShippingPolicy>({
    freeShippingEnabled: false,
    freeShippingThreshold: 0,
  });
  const [freeThresholdInput, setFreeThresholdInput] = useState("0");
  const [savingFree, setSavingFree] = useState(false);
  const [freeMessage, setFreeMessage] = useState("");
  const [discountInputs, setDiscountInputs] = useState<Record<ShippingTier, string>>({
    economy: "0",
    standard: "0",
    express: "0",
  });
  const [savingDiscounts, setSavingDiscounts] = useState(false);
  const [discountMessage, setDiscountMessage] = useState("");
  const [discountError, setDiscountError] = useState("");

  const load = async () => {
    setError("");
    try {
      const ratesRes = await shippingRatesAPI.get();
      if (ratesRes?.rates) {
        setLegacyRates(ratesRes.rates);
        const p = normalizePolicy(ratesRes);
        setFreePolicy(p);
        setFreeThresholdInput(String(p.freeShippingThreshold));
        const d = ratesRes.tierDiscounts;
        setDiscountInputs({
          economy: String(Number(d?.economy) || 0),
          standard: String(Number(d?.standard) || 0),
          express: String(Number(d?.express) || 0),
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load shipping settings");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveFreeShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legacyRates) {
      setError("Shipping rates not loaded yet. Refresh the page.");
      return;
    }
    setSavingFree(true);
    setError("");
    setFreeMessage("");
    const th = parseFloat(freeThresholdInput);
    if (!Number.isFinite(th) || th < 0) {
      setError("Free shipping threshold must be a non-negative number");
      setSavingFree(false);
      return;
    }
    try {
      await shippingRatesAPI.update({
        ...legacyRates,
        freeShippingEnabled: freePolicy.freeShippingEnabled,
        freeShippingThreshold: th,
      });
      setFreePolicy((p) => ({ ...p, freeShippingThreshold: th }));
      await load();
      setFreeMessage("Free shipping saved.");
    } catch (err: any) {
      setError(err?.message || "Failed to save free shipping settings");
    } finally {
      setSavingFree(false);
    }
  };

  const saveDiscounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legacyRates) {
      setDiscountError("Shipping rates not loaded yet. Refresh the page.");
      return;
    }
    const tierDiscounts = {} as Record<ShippingTier, number>;
    for (const { key, label } of DISCOUNT_TIERS) {
      const n = parseFloat(discountInputs[key] || "0");
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setDiscountError(`${label} discount must be between 0 and 100`);
        return;
      }
      tierDiscounts[key] = n;
    }
    setSavingDiscounts(true);
    setDiscountError("");
    setDiscountMessage("");
    try {
      await shippingRatesAPI.update({ ...legacyRates, tierDiscounts });
      await load();
      setDiscountMessage("Shipping discounts saved.");
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "Failed to save shipping discounts");
    } finally {
      setSavingDiscounts(false);
    }
  };

  return (
    <AdminNavbar title="Shipping Discounts" subtitle="Free shipping threshold and per-tier shipping discounts">
      <div className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Free shipping</h2>
        <p className="text-sm text-slate-600 mb-4">
          When enabled, orders at or above the threshold pay no shipping.
        </p>
        <form onSubmit={saveFreeShipping} className="space-y-3 max-w-md">
          <label className="inline-flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={freePolicy.freeShippingEnabled}
              onChange={(e) => {
                setFreePolicy((p) => ({ ...p, freeShippingEnabled: e.target.checked }));
                setFreeMessage("");
              }}
            />
            Enable free shipping above threshold
          </label>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Minimum subtotal ($)</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              type="text"
              inputMode="decimal"
              value={freeThresholdInput}
              onChange={(e) => {
                const v = e.target.value;
                if (isFloatInput(v)) {
                  setFreeThresholdInput(v);
                  setFreeMessage("");
                }
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingFree || !legacyRates}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
            >
              {savingFree ? "Saving…" : "Save"}
            </button>
            {freeMessage ? <span className="text-sm text-emerald-700">{freeMessage}</span> : null}
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Shipping discounts</h2>
        <p className="text-sm text-slate-600 mb-4">
          Percentage taken off the FedEx price of each shipping option, for every customer. Use 0 for no discount.
        </p>
        <form onSubmit={saveDiscounts}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DISCOUNT_TIERS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label} discount (%)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  type="text"
                  inputMode="decimal"
                  value={discountInputs[key]}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (isFloatInput(v)) {
                      setDiscountInputs((p) => ({ ...p, [key]: v }));
                      setDiscountMessage("");
                    }
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={savingDiscounts || !legacyRates}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm disabled:opacity-50"
            >
              {savingDiscounts ? "Saving…" : "Save"}
            </button>
            {discountMessage ? <span className="text-sm text-emerald-700">{discountMessage}</span> : null}
            {discountError ? <span className="text-sm text-rose-700">{discountError}</span> : null}
          </div>
        </form>
      </div>
      </div>
    </AdminNavbar>
  );
}

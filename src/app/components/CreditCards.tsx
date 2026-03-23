"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cardsAPI } from "../../utils/api";
import { toast } from "react-toastify";

interface Card {
  id: number;
  card_number_last4: string;
  cardholder_name: string;
  expiry_month: number;
  expiry_year: number;
  card_type: string | null;
  is_default: boolean;
}

export default function CreditCards() {
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    cardNumber: "",
    nameOnCard: "",
    expMonth: "",
    expYear: "",
    cvv: "",
    cardType: "",
    isDefault: false,
  });

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    const fetchCards = async () => {
      try {
        setLoading(true);
        const res = await cardsAPI.get();
        setCards(res?.cards || []);
      } catch (err: any) {
        if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("token")) {
          router.push("/login");
          return;
        }
        toast.error(err?.message || "Failed to load cards");
        setCards([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const fillFormForEdit = (card: Card) => {
    setEditingId(card.id);
    setFormData({
      cardNumber: "",
      nameOnCard: card.cardholder_name,
      expMonth: String(card.expiry_month).padStart(2, "0"),
      expYear: String(card.expiry_year).length === 2 ? String(card.expiry_year) : String(card.expiry_year).slice(-2),
      cvv: "",
      cardType: card.card_type || "",
      isDefault: !!card.is_default,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      cardNumber: "",
      nameOnCard: "",
      expMonth: "",
      expYear: "",
      cvv: "",
      cardType: "",
      isDefault: false,
    });
  };

  const handleSetDefault = async (cardId: number) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.is_default) return;
    try {
      await cardsAPI.update(String(cardId), { isDefault: true });
      setCards((prev) =>
        prev.map((c) => ({ ...c, is_default: c.id === cardId }))
      );
      toast.success("Default card updated.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to set default.");
    }
  };

  const handleDelete = async (cardId: number) => {
    if (!window.confirm("Remove this card?")) return;
    try {
      await cardsAPI.delete(String(cardId));
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      if (editingId === cardId) cancelEdit();
      toast.success("Card removed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete card.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    if (editingId) {
      try {
        setSaving(true);
        await cardsAPI.update(String(editingId), {
          cardholderName: formData.nameOnCard.trim(),
          expiryMonth: formData.expMonth ? parseInt(formData.expMonth, 10) : undefined,
          expiryYear: formData.expYear ? parseInt(formData.expYear, 10) : undefined,
          cardType: formData.cardType || undefined,
          isDefault: formData.isDefault,
        });
        setCards((prev) =>
          prev.map((c) =>
            c.id === editingId
              ? {
                  ...c,
                  cardholder_name: formData.nameOnCard.trim(),
                  expiry_month: parseInt(formData.expMonth, 10),
                  expiry_year: parseInt(formData.expYear, 10),
                  card_type: formData.cardType || null,
                  is_default: formData.isDefault,
                }
              : { ...c, is_default: formData.isDefault ? false : c.is_default }
          )
        );
        toast.success("Card updated.");
        cancelEdit();
      } catch (err: any) {
        toast.error(err?.message || "Failed to update card.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const digitsOnly = formData.cardNumber.replace(/\D/g, "");
    const last4 = digitsOnly.slice(-4);
    if (last4.length !== 4) {
      toast.error("Enter a valid card number (at least 4 digits).");
      return;
    }
    if (!formData.nameOnCard.trim()) {
      toast.error("Name on card is required.");
      return;
    }
    if (!formData.expMonth || !formData.expYear) {
      toast.error("Expiration date is required.");
      return;
    }

    try {
      setSaving(true);
      const res = await cardsAPI.add({
        cardNumberLast4: last4,
        cardholderName: formData.nameOnCard.trim(),
        expiryMonth: parseInt(formData.expMonth, 10),
        expiryYear: parseInt(formData.expYear, 10),
        cardType: formData.cardType || undefined,
        isDefault: formData.isDefault,
      });
      const newCard = (res as { card?: Card })?.card;
      if (newCard) setCards((prev) => [newCard, ...prev]);
      toast.success("Card added.");
      setFormData({
        cardNumber: "",
        nameOnCard: "",
        expMonth: "",
        expYear: "",
        cvv: "",
        cardType: "",
        isDefault: false,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to add card.");
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { label: "Account Settings", href: "/account-settings" },
    { label: "Change Password", href: "/change-password" },
    { label: "Reseller Permit", href: "/reseller-permit" },
    { label: "Credit Cards", href: "/credit-cards", active: true },
    { label: "Your Default Address", href: "/address-book" },
  ];

  const months = ["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const years = ["", ...Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() + i).slice(-2))];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20 flex items-center justify-center">
        <div className="rounded-sm border border-gray-200 bg-white px-6 py-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-medium text-gray-600">Loading cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 rounded-sm border border-gray-200 bg-white/80 px-5 py-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Area</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Credit Cards</h1>
          <p className="mt-1.5 text-sm text-gray-600">Manage saved cards and choose your default payment method.</p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          <aside className="h-fit w-full shrink-0 self-start rounded-sm border border-gray-200 bg-white p-4 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] lg:w-72 lg:p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Settings</h2>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group block w-full border-l-2 px-3 py-2.5 text-sm transition-all ${
                    item.active
                      ? "border-blue-600 bg-blue-50/80 font-semibold text-blue-800 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.5)]"
                      : "border-transparent text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className="text-[10px] text-gray-300 transition-colors group-hover:text-gray-400">&gt;</span>
                  </span>
                </Link>
              ))}
            </nav>
          </aside>

          <main className="flex-1 rounded-sm border border-gray-200 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)] sm:p-7">
            <h2 className="mb-6 text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Manage Credit Cards</h2>

            {cards.length > 0 && (
              <div className="space-y-4 mb-8">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center justify-between rounded-sm border border-gray-200 bg-white p-5 shadow-[0_8px_26px_-24px_rgba(15,23,42,0.5)]"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(card.id)}
                        className={`rounded-sm px-4 py-2 text-sm font-medium transition-colors ${
                          card.is_default ? "bg-gray-200 text-gray-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {card.is_default ? "Default" : "Set Default"}
                      </button>
                      <div className="flex-1 ">
                        <div className="font-semibold text-gray-900">{card.card_type || "Card"}</div>
                        <div className="text-sm text-gray-600">.... {card.card_number_last4}</div>
                        <div className="text-sm text-gray-600">{card.cardholder_name}</div>
                        <div className="text-sm text-gray-600">
                          Exp: {String(card.expiry_month).padStart(2, "0")}/{String(card.expiry_year).slice(-2)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fillFormForEdit(card)}
                        className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(card.id)}
                      className="text-gray-500 hover:text-red-600 p-2"
                      aria-label="Delete card"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editingId ? "Update card details" : "Add new card"}
            </h3>
            {editingId && (
              <p className="text-sm text-gray-500 mb-4">
                Card number is not editable. Change name or expiry and save.
              </p>
            )}
            <div className="rounded-sm border border-gray-200 bg-white p-6 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.5)]">
              <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
                {!editingId && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Card Number *</label>
                    <input
                      type="text"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleChange}
                      placeholder="Card number (last 4 digits stored)"
                      maxLength={19}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    />
                  </div>
                )}
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Name on card *</label>
                  <input
                    type="text"
                    name="nameOnCard"
                    value={formData.nameOnCard}
                    onChange={handleChange}
                    placeholder="Name on card"
                    className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Expiration month *</label>
                    <select
                      name="expMonth"
                      value={formData.expMonth}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      required
                    >
                      {months.map((m) => (
                        <option key={m || "x"} value={m}>{m || "Month..."}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Expiration year *</label>
                    <select
                      name="expYear"
                      value={formData.expYear}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      required
                    >
                      {years.map((y) => (
                        <option key={y || "x"} value={y}>{y || "Year..."}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {!editingId && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Card type</label>
                    <select
                      name="cardType"
                      value={formData.cardType}
                      onChange={handleChange}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    >
                      <option value="">Select...</option>
                      <option value="Visa">Visa</option>
                      <option value="MasterCard">MasterCard</option>
                      <option value="Amex">Amex</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
                {editingId && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDefault"
                      name="isDefault"
                      checked={formData.isDefault}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">Set as default</label>
                  </div>
                )}
                {!editingId && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDefaultNew"
                      name="isDefault"
                      checked={formData.isDefault}
                      onChange={handleChange}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <label htmlFor="isDefaultNew" className="text-sm font-medium text-gray-700">Set as default</label>
                  </div>
                )}
                {!editingId && (
                  <div>
                    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">CVV</label>
                    <input
                      type="text"
                      name="cvv"
                      value={formData.cvv}
                      onChange={handleChange}
                      placeholder="CVV (not stored)"
                      maxLength={4}
                      className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-w-28 items-center justify-center rounded-sm bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Saving…" : editingId ? "Update" : "Add"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className="rounded-sm border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

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
      <div className="min-h-screen bg-white pt-20 flex items-center justify-center">
        <p className="text-gray-600">Loading cards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          <aside className="w-64 shrink-0 bg-gray-100 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>
            <nav className="space-y-0">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block w-full text-left px-4 py-3 transition-colors border-b border-gray-200 last:border-b-0 ${
                    item.active ? "bg-blue-100 text-gray-900 font-medium" : "text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          <main className="flex-1 bg-white p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Manage Credit Cards</h1>

            {cards.length > 0 && (
              <div className="space-y-4 mb-8">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-white border border-gray-300 rounded-lg p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        type="button"
                        onClick={() => handleSetDefault(card.id)}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                          card.is_default ? "bg-gray-300 text-gray-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
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
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
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

            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? "Update card details" : "Add new card"}
            </h2>
            {editingId && (
              <p className="text-sm text-gray-500 mb-4">
                Card number is not editable. Change name or expiry and save.
              </p>
            )}
            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
                {!editingId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card Number *</label>
                    <input
                      type="text"
                      name="cardNumber"
                      value={formData.cardNumber}
                      onChange={handleChange}
                      placeholder="Card number (last 4 digits stored)"
                      maxLength={19}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name on card *</label>
                  <input
                    type="text"
                    name="nameOnCard"
                    value={formData.nameOnCard}
                    onChange={handleChange}
                    placeholder="Name on card"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiration month *</label>
                    <select
                      name="expMonth"
                      value={formData.expMonth}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    >
                      {months.map((m) => (
                        <option key={m || "x"} value={m}>{m || "Month..."}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiration year *</label>
                    <select
                      name="expYear"
                      value={formData.expYear}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Card type</label>
                    <select
                      name="cardType"
                      value={formData.cardType}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                    <input
                      type="text"
                      name="cvv"
                      value={formData.cvv}
                      onChange={handleChange}
                      placeholder="CVV (not stored)"
                      maxLength={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-8 py-3 rounded-lg transition-colors"
                  >
                    {saving ? "Saving…" : editingId ? "Update" : "Add"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={cancelEdit} className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
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

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authAPI, usersAPI } from "../../utils/api";
import { toast } from "react-toastify";

interface ProfileUser {
  id: number;
  email: string;
  full_name: string | null;
  hear_about_us: string | null;
  telephone: string | null;
  newsletter: boolean;
  role: string;
  is_active?: boolean;
  is_approved?: boolean;
}

export default function AccountSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    telephone: "",
    hearAboutUs: "",
    newsletter: false,
    role: "",
  });

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await authAPI.getProfile();
        const user = (res?.user || res) as ProfileUser;
        if (user) {
          setFormData({
            fullName: user.full_name ?? "",
            email: user.email ?? "",
            telephone: user.telephone ?? "",
            hearAboutUs: user.hear_about_us ?? "",
            newsletter: !!user.newsletter,
            role: user.role ?? "",
          });
        }
      } catch (err: any) {
        if (err?.message?.includes("401") || err?.message?.toLowerCase().includes("token")) {
          router.push("/login");
          return;
        }
        toast.error(err?.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      setSaving(true);
      await usersAPI.updateProfile({
        fullName: formData.fullName.trim() || undefined,
        telephone: formData.telephone.trim() || undefined,
        newsletter: formData.newsletter,
      });
      toast.success("Profile updated successfully.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const menuItems = [
    { label: "Account Settings", href: "/account-settings", active: true },
    { label: "Change Password", href: "/change-password" },
    { label: "Reseller Permit", href: "/reseller-permit" },
    { label: "Credit Cards", href: "/credit-cards" },
    { label: "Your Default Address", href: "/address-book" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 pt-20 flex items-center justify-center">
        <p className="text-gray-600">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-20">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Left Panel - Settings Menu */}
          <aside className="w-64 shrink-0 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>
            <nav className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`block w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    item.active
                      ? "bg-gray-200 text-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Central Content - Account Profile Form */}
          <main className="flex-1 bg-white rounded-lg shadow-md p-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Profile</h1>
            <p className="text-gray-500 text-sm mb-6">
              Logged in as <span className="font-medium text-gray-700">{formData.role}</span>. Update your details below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed here.</p>
              </div>

              {/* Telephone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Telephone</label>
                <input
                  type="tel"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Hear about us (read-only display) */}
              {formData.hearAboutUs && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">How you heard about us</label>
                  <input
                    type="text"
                    value={formData.hearAboutUs}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
              )}

              {/* Newsletter */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="newsletter"
                  name="newsletter"
                  checked={formData.newsletter}
                  onChange={handleChange}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="newsletter" className="text-sm font-medium text-gray-700">
                  Subscribe to newsletter
                </label>
              </div>

              {/* Update Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium px-8 py-3 rounded-lg transition-colors"
                >
                  {saving ? "Updating…" : "Update"}
                </button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}

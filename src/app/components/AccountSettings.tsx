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
}

function formatAccountRole(role: string | undefined): string {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "employee") return "Employee";
  return "Customer";
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
    { label: "Credit Cards", href: "/credit-cards" },
    { label: "Your Default Address", href: "/address-book" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20 flex items-center justify-center">
        <div className="rounded-sm border border-gray-200 bg-white px-6 py-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.4)]">
          <p className="text-sm font-medium text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
        <div className="mb-6 rounded-sm border border-gray-200 bg-white/80 px-5 py-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.5)] backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500">Account Area</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Account Settings</h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Logged in as <span className="font-medium text-gray-800">{formatAccountRole(formData.role)}</span>. Keep your profile details up to date.
          </p>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
          {/* Left Panel - Settings Menu */}
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

          {/* Central Content - Account Profile Form */}
          <main className="flex-1 rounded-sm border border-gray-200 bg-white p-5 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.5)] sm:p-7">
            <div className="mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Account Profile</h2>
              <p className="mt-1 text-sm text-gray-600">Review and update your personal details.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-[0_1px_0_rgba(15,23,42,0.02)] outline-none transition-all placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  required
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  readOnly
                  className="w-full cursor-not-allowed rounded-sm border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed here.</p>
              </div>

              {/* Telephone */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">Telephone</label>
                <input
                  type="tel"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  className="w-full rounded-sm border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
              </div>

              {/* Hear about us (read-only display) */}
              {formData.hearAboutUs && (
                <div>
                  <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-600">How you heard about us</label>
                  <input
                    type="text"
                    value={formData.hearAboutUs}
                    readOnly
                    className="w-full cursor-not-allowed rounded-sm border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600"
                  />
                </div>
              )}

              {/* Newsletter */}
              <div className="rounded-sm border border-gray-200 bg-gray-50/80 px-3 py-3">
                <label htmlFor="newsletter" className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  id="newsletter"
                  name="newsletter"
                  checked={formData.newsletter}
                  onChange={handleChange}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-gray-300"
                />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">Subscribe to newsletter</span>
                    <span className="block text-xs text-gray-500">Receive product updates and new offers.</span>
                  </span>
                </label>
              </div>

              {/* Update Button */}
              <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-500">Changes are saved to your profile immediately.</p>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-32 items-center justify-center rounded-sm bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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

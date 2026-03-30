"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNavbar from "../../components/AdminNavbar";
import { canAccessAdminPanel, isAuthenticated } from "../../../utils/roles";
import { usersAPI } from "../../../utils/api";

interface RegisteredUser {
  id: number;
  email: string;
  full_name: string | null;
  telephone: string | null;
  newsletter: boolean;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated()) {
      router.push("/");
      return;
    }
    if (!canAccessAdminPanel()) {
      router.push("/");
      return;
    }
  }, [router]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await usersAPI.getAllAdmin();
        setUsers(Array.isArray(res?.users) ? res.users : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load users");
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      return (
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.telephone || "").toLowerCase().includes(q) ||
        (u.role || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const formatDate = (date: string) => {
    if (!date) return "—";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AdminNavbar
      title="Users"
      subtitle="All registered customer accounts"
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm shadow-slate-900/5">
        <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-5 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">Registered users</h2>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-14 text-slate-500">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
              Loading…
            </div>
          ) : error ? (
            <div className="px-6 py-14 text-center text-rose-700">{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-14 text-center text-slate-500">No registered users found.</div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3.5 sm:px-6">Serial Number</th>
                  <th className="px-4 py-3.5 sm:px-6">Name</th>
                  <th className="px-4 py-3.5 sm:px-6">Email</th>
                  <th className="px-4 py-3.5 sm:px-6">Phone</th>
                  <th className="px-4 py-3.5 sm:px-6">Role</th>
                  <th className="px-4 py-3.5 sm:px-6">Status</th>
                  <th className="px-4 py-3.5 sm:px-6">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map((user, index) => (
                  <tr key={user.id} className="transition-colors hover:bg-slate-50/90">
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500 sm:px-6">{index + 1}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-slate-900 sm:px-6">
                      {user.full_name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-700 sm:px-6">{user.email}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600 sm:px-6">{user.telephone || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200/80">
                        {user.role || "customer"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 sm:px-6">
                      <span
                        className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${
                          user.is_active
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
                            : "bg-slate-100 text-slate-600 ring-slate-200/80"
                        }`}
                      >
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600 sm:px-6">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminNavbar>
  );
}


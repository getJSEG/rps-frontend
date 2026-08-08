"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { usersAPI } from "../../utils/api";

function formatDate(value: string | null | undefined): string {
  if (!value) return "the scheduled date";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "the scheduled date";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysRemaining(scheduledAt: string | null | undefined): number | null {
  if (!scheduledAt) return null;
  const end = new Date(scheduledAt).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export default function AccountPendingDeletion() {
  const router = useRouter();
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const status = await usersAPI.getDeletionStatus();
        if (cancelled) return;
        if (!status?.pendingDeletion) {
          try {
            const raw = localStorage.getItem("user");
            const user = raw ? JSON.parse(raw) : {};
            localStorage.setItem(
              "user",
              JSON.stringify({
                ...user,
                pendingDeletion: false,
                deletionScheduledAt: null,
                deletionRequestedAt: null,
              })
            );
          } catch {
            /* ignore */
          }
          router.replace("/");
          return;
        }
        setScheduledAt(status.deletionScheduledAt || null);
      } catch (err: unknown) {
        try {
          const raw = localStorage.getItem("user");
          const user = raw ? JSON.parse(raw) : null;
          if (user?.pendingDeletion) {
            setScheduledAt(user.deletionScheduledAt || null);
          } else {
            const msg = err instanceof Error ? err.message : "Unable to load deletion status.";
            toast.error(msg);
            router.replace("/");
          }
        } catch {
          router.replace("/");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const remaining = useMemo(() => daysRemaining(scheduledAt), [scheduledAt]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    window.dispatchEvent(new Event("loginStatusChanged"));
    router.push("/");
  };

  const handleCancelDeletion = async () => {
    try {
      setCancelling(true);
      await usersAPI.cancelAccountDeletion();
      try {
        const raw = localStorage.getItem("user");
        const user = raw ? JSON.parse(raw) : {};
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...user,
            pendingDeletion: false,
            deletionScheduledAt: null,
            deletionRequestedAt: null,
          })
        );
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event("loginStatusChanged"));
      toast.success("Account deletion cancelled. Welcome back.");
      router.replace("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to cancel deletion.";
      toast.error(msg);
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
        <div className="rounded-sm border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-sm text-gray-600">Loading account status…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-20">
      <div className="mx-auto flex max-w-xl flex-col px-4 py-12 sm:px-6">
        <div className="rounded-sm border border-amber-200 bg-white p-6 shadow-[0_14px_35px_-24px_rgba(15,23,42,0.45)] sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Your account is on deletion period
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            Your account will be deleted on{" "}
            <span className="font-medium text-gray-900">{formatDate(scheduledAt)}</span>
            {remaining != null ? (
              <>
                {" "}
                ({remaining} day{remaining === 1 ? "" : "s"} remaining).
              </>
            ) : (
              "."
            )}{" "}
            Account access is blocked until you cancel deletion or the waiting period ends.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-sm bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Cancel Account Deletion
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-sm border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-sm border border-gray-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Are you sure?</h3>
            <p className="mt-2 text-sm text-gray-600">
              This will cancel the deletion request and restore normal access to your account.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                className="rounded-sm border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Keep deletion scheduled
              </button>
              <button
                type="button"
                onClick={handleCancelDeletion}
                disabled={cancelling}
                className="rounded-sm bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {cancelling ? "Restoring…" : "Yes, cancel deletion"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

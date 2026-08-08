"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const ALLOWED_WHEN_PENDING = ["/account-pending-deletion", "/login"];

function readPendingDeletion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("isLoggedIn") !== "true") return false;
    const raw = localStorage.getItem("user");
    if (!raw) return false;
    const user = JSON.parse(raw);
    return !!user?.pendingDeletion;
  } catch {
    return false;
  }
}

/**
 * If the logged-in user has a pending account deletion, keep them on the
 * cancel-deletion page only (block cart/orders/settings/etc.).
 */
export default function PendingDeletionGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!readPendingDeletion()) return;
    const path = pathname || "/";
    const allowed = ALLOWED_WHEN_PENDING.some(
      (p) => path === p || path.startsWith(`${p}/`)
    );
    if (!allowed) {
      router.replace("/account-pending-deletion");
    }
  }, [pathname, router]);

  return null;
}

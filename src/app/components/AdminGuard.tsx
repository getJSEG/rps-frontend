"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { canAccessAdminPanel, isAuthenticated } from "../../utils/roles";
import FullScreenLoader from "./FullScreenLoader";

type AuthStatus = "loading" | "authorized" | "unauthenticated" | "forbidden";

/**
 * Gate every /admin route behind the auth check so protected UI is never
 * painted before we know the visitor is an admin.
 */
export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const check = () => {
      if (!isAuthenticated()) {
        setStatus("unauthenticated");
        router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
        return;
      }
      if (!canAccessAdminPanel()) {
        setStatus("forbidden");
        router.replace("/");
        return;
      }
      setStatus("authorized");
    };

    check();
    window.addEventListener("loginStatusChanged", check);
    return () => window.removeEventListener("loginStatusChanged", check);
  }, [router, pathname]);

  if (status === "authorized") return <>{children}</>;

  return (
    <FullScreenLoader
      message={status === "loading" ? "Checking your access…" : "Redirecting…"}
    />
  );
}

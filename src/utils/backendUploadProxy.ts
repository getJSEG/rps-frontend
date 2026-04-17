/**
 * Shared rules for proxying backend `/uploads/...` files through `/api/artwork-download`.
 * Aligns with getBackendBaseUrl() / NEXT_PUBLIC_API_URL and treats localhost ↔ 127.0.0.1 as the same dev server.
 */

function backendBaseNoApi(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
  const trimmed = raw.trim().replace(/\/+$/, "");
  const withoutApi = trimmed.endsWith("/api")
    ? trimmed.slice(0, -4)
    : trimmed.replace(/\/api\/?$/, "");
  return withoutApi.replace(/\/+$/, "") || "http://localhost:8080";
}

/** Origins that may serve uploaded files (dev: localhost and 127.0.0.1 with same port). */
export function getBackendFileOrigins(): string[] {
  const base = backendBaseNoApi();
  const out = new Set<string>();
  try {
    const u = new URL(base);
    out.add(u.origin);
    const portSuffix = u.port ? `:${u.port}` : "";
    if (u.hostname === "localhost") {
      out.add(`${u.protocol}//127.0.0.1${portSuffix}`);
    } else if (u.hostname === "127.0.0.1") {
      out.add(`${u.protocol}//localhost${portSuffix}`);
    }
  } catch {
    out.add(base);
  }
  return [...out];
}

/** True if URL points at this app's backend `/uploads/...` (safe to proxy). */
export function isBackendUploadsAssetUrl(url: string): boolean {
  try {
    const p = new URL(url);
    if (!p.pathname.startsWith("/uploads/")) return false;
    return getBackendFileOrigins().some((origin) => p.origin === origin);
  } catch {
    return false;
  }
}

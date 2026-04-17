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
function getBackendFileOrigins(): string[] {
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
function isBackendUploadsAssetUrl(url: string): boolean {
  try {
    const p = new URL(url);
    if (!p.pathname.startsWith("/uploads/")) return false;
    return getBackendFileOrigins().some((origin) => p.origin === origin);
  } catch {
    return false;
  }
}

function normalizeUrlPrefix(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/** Public CDN bases for artwork (custom DO Spaces CDN or mirror of DO_SPACES_PUBLIC_URL for the client bundle). */
function getSpacesPublicUrlPrefixes(): string[] {
  const out: string[] = [];
  const pub = process.env.NEXT_PUBLIC_DO_SPACES_PUBLIC_URL?.trim();
  const server = process.env.DO_SPACES_PUBLIC_URL?.trim();
  for (const s of [pub, server]) {
    if (s) {
      const n = normalizeUrlPrefix(s);
      if (n) out.push(n);
    }
  }
  return [...new Set(out)];
}

/**
 * URLs we may fetch server-side in `/api/artwork-download` and same-origin to the browser.
 * Includes backend `/uploads/...` and DigitalOcean Spaces artwork objects (img preview works but
 * direct fetch() often fails CORS without this proxy).
 */
export function isArtworkDownloadProxyUrl(url: string): boolean {
  if (isBackendUploadsAssetUrl(url)) return true;
  try {
    const p = new URL(url);
    if (p.protocol !== "http:" && p.protocol !== "https:") return false;
    const path = p.pathname.replace(/\/+$/, "") || "/";
    // Default DO Spaces public URL shape from `publicUrlForKey` (see backend spaces.js).
    if (
      p.hostname.endsWith("digitaloceanspaces.com") &&
      path.includes("/elmer/artworks/")
    ) {
      return true;
    }
    const full = `${p.origin}${p.pathname}`;
    for (const base of getSpacesPublicUrlPrefixes()) {
      if (full.startsWith(`${base}/`) || full === base) return true;
    }
    return false;
  } catch {
    return false;
  }
}

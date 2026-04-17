import { NextRequest, NextResponse } from "next/server";
import { isBackendUploadsAssetUrl } from "../../../utils/backendUploadProxy";

export const dynamic = "force-dynamic";

/**
 * Proxies backend `/uploads/...` files same-origin so the client can download without CORS issues.
 */
export async function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u");
  const fn = request.nextUrl.searchParams.get("fn") || "download";
  if (!u || !isBackendUploadsAssetUrl(u)) {
    return NextResponse.json({ message: "Invalid or forbidden URL" }, { status: 403 });
  }
  let safeFn = fn.replace(/[/\\]/g, "_").slice(0, 200);
  if (!safeFn) safeFn = "download";

  try {
    const upstream = await fetch(u, { cache: "no-store", headers: { Accept: "*/*" } });
    if (!upstream.ok) {
      return NextResponse.json({ message: "File not found" }, { status: upstream.status });
    }
    const buf = await upstream.arrayBuffer();
    const ct = upstream.headers.get("content-type") || "application/octet-stream";
    const asciiName = safeFn.replace(/[^\x20-\x7E]/g, "_");
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Content-Disposition": `attachment; filename="${asciiName.replace(/"/g, "")}"`,
      },
    });
  } catch {
    return NextResponse.json({ message: "Download failed" }, { status: 502 });
  }
}

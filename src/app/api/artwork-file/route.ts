import { NextRequest } from "next/server";

function toSafeTarget(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const source = req.nextUrl.searchParams.get("source")?.trim() || "";
  const target = toSafeTarget(source);
  if (!target) {
    return new Response("Invalid source URL", { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), { cache: "no-store" });
    if (!upstream.ok) {
      return new Response(`Could not load artwork (${upstream.status}).`, { status: upstream.status });
    }

    const body = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Failed to fetch artwork source", { status: 502 });
  }
}

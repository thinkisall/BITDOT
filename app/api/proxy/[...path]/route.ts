import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function handler(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const pathname = "/" + path.join("/");
    const search = req.nextUrl.search;
    const targetUrl = `${BACKEND_URL}${pathname}${search}`;

    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await req.arrayBuffer()
        : undefined;

    const res = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "content-type": req.headers.get("content-type") || "application/json",
      },
      body,
    });

    const data = await res.arrayBuffer();

    return new NextResponse(data, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    console.error("[proxy] error:", err);
    return NextResponse.json(
      { error: "Proxy error", detail: String(err) },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;

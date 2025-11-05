// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_SIDE = process.env.NEXT_PUBLIC_APP_SIDE; // "A" | "B"
const STUDIO_HOST = process.env.NEXT_PUBLIC_STUDIO_HOST || "studio.kingstalent.com.tw";
const POSTER_HOST = process.env.NEXT_PUBLIC_POSTER_HOST || "poster.kingstalent.com.tw";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const path = url.pathname;

  // 沒有設定身分就完全不動，避免「誤傷」
  if (!APP_SIDE) {
    const res = NextResponse.next();
    res.headers.set("x-app-side", "undefined");
    res.headers.set("x-host", host);
    res.headers.set("x-path", path);
    return res;
  }

  // 只在自己該管的網域上動手腳
  if (APP_SIDE === "A" && (host === STUDIO_HOST || host.startsWith("studio."))) {
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      const res = NextResponse.rewrite(url);
      res.headers.set("x-app-side", "A");
      res.headers.set("x-rewrite-to", url.pathname);
      return res;
    }
  }

  if (APP_SIDE === "B" && (host === POSTER_HOST || host.startsWith("poster."))) {
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      const res = NextResponse.rewrite(url);
      res.headers.set("x-app-side", "B");
      res.headers.set("x-rewrite-to", url.pathname);
      return res;
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-app-side", APP_SIDE);
  res.headers.set("x-host", host);
  res.headers.set("x-path", path);
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/|api/|favicon.ico|apple-touch-icon.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)).*)",
  ],
};

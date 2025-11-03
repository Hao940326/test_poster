// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

function isStatic(path: string) {
  return (
    path.startsWith("/_next") ||                  // Next chunks、RSC、images
    path.startsWith("/assets") ||
    path.startsWith("/static") ||
    path.startsWith("/fonts") ||
    path.startsWith("/images") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml" ||
    path.startsWith("/icon") ||                   // icon.svg / icon.png
    path.startsWith("/apple-touch-icon") ||
    path.startsWith("/manifest.webmanifest")
  );
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const path = url.pathname;

  // ============ 🎨 B 端（poster.kingstalent.com.tw） ============
  if (host === POSTER_HOST || host.startsWith("poster.")) {
    // ✅ 這些路徑直通
    if (
      isStatic(path) ||
      path.startsWith("/api") ||
      path.startsWith("/auth/callback") ||
      path.startsWith("/edit/auth/callback") ||
      path.startsWith("/edit/login") ||
      path.startsWith("/access-denied")
    ) {
      const res = NextResponse.next();
      res.headers.set("x-where", "poster-pass");
      return res;
    }

    // ✅ 其他不是 /edit 開頭的，一律掛到 /edit 底下
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      const res = NextResponse.rewrite(url);
      res.headers.set("x-where", "poster-rewrite");
      return res;
    }

    const res = NextResponse.next();
    res.headers.set("x-where", "poster-normal");
    return res;
  }

  // ============ 🛠️ A 端（studio.kingstalent.com.tw） ============
  if (host === STUDIO_HOST || host.startsWith("studio.")) {
    if (
      isStatic(path) ||
      path.startsWith("/api") ||
      path.startsWith("/auth/callback") ||
      path.startsWith("/studio/auth/callback") ||
      path.startsWith("/studio/login")
    ) {
      return NextResponse.next();
    }
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 其他網域：照原路
  return NextResponse.next();
}

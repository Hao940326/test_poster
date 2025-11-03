// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

// Helper: 乾淨 hostname（去除 port / preview）
function cleanHost(req: NextRequest) {
  const h =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  return h.split(":")[0].toLowerCase();
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = cleanHost(req);
  const path = url.pathname;

  // ============ 🎨 B 端（poster.kingstalent.com.tw） ============
  if (host === POSTER_HOST || host.startsWith("poster.")) {
    // ✅ 允許這些頁面直通，不改寫
    if (
      path.startsWith("/auth/callback") ||
      path.startsWith("/edit/login") ||
      path.startsWith("/access-denied")
    ) {
      return NextResponse.next();
    }

    // ✅ 其他不是 /edit 開頭的頁面，全掛到 /edit 底下
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // ============ 🏗️ A 端（studio.kingstalent.com.tw） ============
  if (host === STUDIO_HOST || host.startsWith("studio.")) {
    // ✅ callback 與拒絕頁也要放行
    if (
      path.startsWith("/auth/callback") ||
      path.startsWith("/access-denied")
    ) {
      return NextResponse.next();
    }

    // ✅ 非 /studio 開頭的頁面掛到 /studio
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }

    return NextResponse.next();
  }

  // ============ 🧑‍💻 其他（localhost、Vercel preview 等） ============
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};

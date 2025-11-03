// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const path = url.pathname;

  // ============ A 端（studio） ============
  if (host === STUDIO_HOST || host.startsWith("studio.")) {
    // ✅ 放行 A 端的 callback（你只有 /auth/callback）
    if (path.startsWith("/auth/callback")) {
      return NextResponse.next();
    }
    // 其餘不是 /studio 開頭的，rewrite 到 /studio
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ============ B 端（poster） ============
  if (host === POSTER_HOST || host.startsWith("poster.")) {
    // ✅ 放行 B 端的 callback（/edit/auth/callback）
    if (path.startsWith("/edit/auth/callback")) {
      return NextResponse.next();
    }
    // 也放行登入頁與拒絕頁
    if (
      path.startsWith("/edit/login") ||
      path.startsWith("/access-denied")
    ) {
      return NextResponse.next();
    }
    // 其他不是 /edit 開頭的，rewrite 到 /edit
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 其他網域照常
  return NextResponse.next();
}

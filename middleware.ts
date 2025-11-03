// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

// 取得乾淨的 hostname（去掉 :3000 / Vercel 轉發）
function getHostname(req: NextRequest) {
  const h =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    "";
  return h.split(":")[0].toLowerCase();
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = getHostname(req);
  const path = url.pathname;

  // ---- B 端（poster）----
  if (host === POSTER_HOST || host.startsWith("poster.")) {
    // 登入/回呼/拒絕頁 一律放行（避免被 rewrite）
    if (
      path.startsWith("/auth/callback") ||
      path.startsWith("/edit/login") ||
      path.startsWith("/access-denied")
    ) {
      return NextResponse.next();
    }
    // 其他路徑都掛到 /edit 底下
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ---- A 端（studio）----
  if (host === STUDIO_HOST || host.startsWith("studio.")) {
    // 回呼/拒絕頁也放行（若 A 端也有）
    if (
      path.startsWith("/auth/callback") ||
      path.startsWith("/access-denied")
    ) {
      return NextResponse.next();
    }
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // 其他 host（本機 localhost、預覽 domain…）→ 不做 A 端強制導向，避免一律變 studio
  return NextResponse.next();
}

export const config = {
  matcher: [
    // 依需求調整
    "/((?!_next|.*\\..*).*)",
  ],
};

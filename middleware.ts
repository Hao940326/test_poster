// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STUDIO_HOST = "studio.kingstalent.com.tw";
const POSTER_HOST = "poster.kingstalent.com.tw";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = req.headers.get("host") || "";
  const path = url.pathname;

  // ✅ 1) 放行 OAuth 回呼與靜態檔案等，不做任何 rewrite
  if (path.startsWith("/auth/") || path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // ✅ 2) 原本你的雙域名改寫規則
  if (host === STUDIO_HOST || host.startsWith("studio.")) {
    if (!path.startsWith("/studio")) {
      url.pathname = "/studio" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
  }
  if (host === POSTER_HOST || host.startsWith("poster.")) {
    if (!path.startsWith("/edit")) {
      url.pathname = "/edit" + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }
  }
  return NextResponse.next();
}

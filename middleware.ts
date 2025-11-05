import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl;

  // 靜態與 API 不處理，避免干擾資源載入
  const excluded =
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname.startsWith("/api");
  if (excluded) return NextResponse.next();

  // studio.* 強制路徑落在 /studio 分區
  if (host.startsWith("studio.")) {
    if (!url.pathname.startsWith("/studio")) {
      url.pathname = `/studio${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // poster.* 強制路徑落在 /edit 分區
  if (host.startsWith("poster.")) {
    if (!url.pathname.startsWith("/edit")) {
      url.pathname = `/edit${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

// 只攔你需要的路徑（可避免干擾資源）
export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:png|jpg|jpeg|svg|gif|ico|webp|css|js)).*)",
  ],
};
